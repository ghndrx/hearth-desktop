<script lang="ts">
	import {
		globalShortcuts,
		shortcutBindings,
		type ShortcutBinding,
	} from '$lib/stores/globalShortcuts';
	import { pttActions, isPTTMode } from '$lib/stores/ptt';
	import { invoke } from '@tauri-apps/api/core';

	let recording: string | null = $state(null);
	let recordedKeys: string[] = $state([]);
	let conflict: string | null = $state(null);

	function startRecording(id: string) {
		recording = id;
		recordedKeys = [];
		conflict = null;
	}

	function cancelRecording() {
		recording = null;
		recordedKeys = [];
		conflict = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!recording) return;
		e.preventDefault();
		e.stopPropagation();

		const keys: string[] = [];
		if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
		if (e.shiftKey) keys.push('Shift');
		if (e.altKey) keys.push('Alt');

		const key = e.key;
		if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
			keys.push(key.length === 1 ? key.toUpperCase() : key);
			recordedKeys = keys;
		}
	}

	async function handleKeyup(e: KeyboardEvent) {
		if (!recording || recordedKeys.length === 0) return;

		// Check for conflicts
		try {
			const hasConflict = await invoke<boolean>('check_shortcut_conflict', {
				keys: recordedKeys,
			});
			if (hasConflict) {
				conflict = 'This shortcut is already in use';
				return;
			}
		} catch {
			// continue
		}

		// Unregister old, update binding, register new
		const bindingId = recording;
		await globalShortcuts.unregisterShortcut(bindingId);
		globalShortcuts.updateBinding(bindingId, recordedKeys);

		const binding = $shortcutBindings.find((b) => b.id === bindingId);
		if (binding) {
			await globalShortcuts.registerShortcut({ ...binding, keys: recordedKeys });
		}

		recording = null;
		recordedKeys = [];
		conflict = null;
	}

	function formatKeys(keys: string[]): string {
		return keys.join(' + ');
	}

	async function resetDefaults() {
		await globalShortcuts.unregisterAll();
		globalShortcuts.resetToDefaults();

		// Re-register all defaults
		const { DEFAULT_GLOBAL_BINDINGS } = await import('$lib/stores/globalShortcuts');
		for (const binding of DEFAULT_GLOBAL_BINDINGS) {
			await globalShortcuts.registerShortcut(binding);
		}
	}

	function togglePTTMode() {
		pttActions.setPTTMode(!$isPTTMode);
	}
</script>

<svelte:window on:keydown={handleKeydown} on:keyup={handleKeyup} />

<div class="settings-panel">
	<div class="settings-header">
		<h2>Keyboard Shortcuts</h2>
		<button class="reset-btn" onclick={resetDefaults}>Reset to Defaults</button>
	</div>

	<div class="shortcut-list">
		{#each $shortcutBindings as binding (binding.id)}
			<div class="shortcut-item">
				<div class="shortcut-info">
					<span class="shortcut-name">{binding.label}</span>
					{#if binding.action === 'pushToTalk'}
						<span class="ptt-badge" class:active={$isPTTMode}>PTT</span>
					{/if}
				</div>

				<div class="shortcut-control">
					{#if recording === binding.id}
						<div class="recording-indicator">
							{#if recordedKeys.length > 0}
								<span class="recorded-keys">{formatKeys(recordedKeys)}</span>
							{:else}
								<span class="recording-text">Press keys...</span>
							{/if}
							<button class="cancel-btn" onclick={cancelRecording}>Cancel</button>
						</div>
					{:else}
						<button
							class="keybind-btn"
							onclick={() => startRecording(binding.id)}
							title="Click to change shortcut"
						>
							{#each binding.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < binding.keys.length - 1}
									<span class="separator">+</span>
								{/if}
							{/each}
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if conflict}
		<div class="conflict-warning">{conflict}</div>
	{/if}

	<div class="ptt-section">
		<div class="ptt-toggle">
			<span>Push-to-Talk Mode</span>
			<button class="toggle-btn" class:active={$isPTTMode} onclick={togglePTTMode}>
				{$isPTTMode ? 'ON' : 'OFF'}
			</button>
		</div>
		<p class="ptt-description">
			When enabled, your microphone is muted by default. Hold the PTT key to transmit.
		</p>
	</div>
</div>

<style>
	.settings-panel {
		padding: 20px;
		max-width: 600px;
	}

	.settings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.settings-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	.reset-btn {
		background: transparent;
		border: 1px solid var(--border-subtle, #3f4147);
		color: var(--text-secondary, #b5bac1);
		padding: 6px 12px;
		border-radius: 4px;
		font-size: 13px;
		cursor: pointer;
	}
	.reset-btn:hover {
		color: var(--text-primary, #f2f3f5);
		border-color: var(--text-muted, #949ba4);
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.shortcut-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.shortcut-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.shortcut-name {
		font-size: 14px;
		color: var(--text-primary, #f2f3f5);
	}

	.ptt-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
	}
	.ptt-badge.active {
		background: #23a55a;
		color: #fff;
	}

	.keybind-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.keybind-btn:hover {
		border-color: var(--brand-primary, #e87620);
	}

	kbd {
		background: var(--bg-primary, #313338);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 3px;
		padding: 2px 6px;
		font-size: 12px;
		font-family: inherit;
		color: var(--text-primary, #f2f3f5);
		min-width: 18px;
		text-align: center;
	}

	.separator {
		color: var(--text-muted, #949ba4);
		font-size: 11px;
	}

	.recording-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--brand-primary, #e87620);
		border-radius: 4px;
		animation: pulse-border 1.5s ease-in-out infinite;
	}

	@keyframes pulse-border {
		0%,
		100% {
			border-color: var(--brand-primary, #e87620);
		}
		50% {
			border-color: transparent;
		}
	}

	.recording-text {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		font-style: italic;
	}

	.recorded-keys {
		font-size: 12px;
		color: var(--text-primary, #f2f3f5);
		font-weight: 500;
	}

	.cancel-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 11px;
		cursor: pointer;
		text-decoration: underline;
	}

	.conflict-warning {
		margin-top: 8px;
		padding: 8px 12px;
		background: rgba(250, 168, 26, 0.1);
		border: 1px solid rgba(250, 168, 26, 0.3);
		border-radius: 4px;
		color: #faa81a;
		font-size: 13px;
	}

	.ptt-section {
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid var(--border-subtle, #3f4147);
	}

	.ptt-toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		color: var(--text-primary, #f2f3f5);
		font-size: 14px;
	}

	.toggle-btn {
		padding: 6px 16px;
		border-radius: 14px;
		border: none;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		transition:
			background 0.15s,
			color 0.15s;
	}
	.toggle-btn.active {
		background: #23a55a;
		color: #fff;
	}

	.ptt-description {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		line-height: 1.4;
	}
</style>
