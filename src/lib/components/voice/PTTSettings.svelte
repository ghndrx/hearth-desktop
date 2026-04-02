<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { isPttEnabled, pttHotkey, voiceActions } from '$lib/stores/voice';
	import { pttManager } from '$lib/voice/PTTManager';

	const dispatch = createEventDispatcher<{
		error: string;
		success: string;
	}>();

	let isCapturing = false;
	let capturedKeys: string[] = [];
	let testingHotkey = false;
	let hotkeyError = '';

	// Common PTT hotkeys
	const presetHotkeys = [
		{ label: 'F4 (Default)', value: 'F4' },
		{ label: 'Mouse Button 4', value: 'Mouse4' },
		{ label: 'Mouse Button 5', value: 'Mouse5' },
		{ label: 'Ctrl+Space', value: 'CommandOrControl+Space' },
		{ label: 'Alt+T', value: 'Alt+T' },
		{ label: '`/~ (Backtick)', value: 'Backquote' },
	];

	async function togglePTT() {
		try {
			const newEnabled = !$isPttEnabled;
			await pttManager.enablePTT(newEnabled);

			if (newEnabled) {
				dispatch('success', `PTT enabled with hotkey: ${$pttHotkey}`);
			} else {
				dispatch('success', 'PTT disabled');
			}
		} catch (error) {
			dispatch('error', `Failed to ${$isPttEnabled ? 'disable' : 'enable'} PTT: ${error}`);
		}
	}

	async function setPresetHotkey(hotkey: string) {
		try {
			await pttManager.setHotkey(hotkey);
			dispatch('success', `PTT hotkey set to: ${hotkey}`);
			hotkeyError = '';
		} catch (error) {
			hotkeyError = `Failed to set hotkey: ${error}`;
			dispatch('error', hotkeyError);
		}
	}

	async function testCurrentHotkey() {
		if (!$pttHotkey) return;

		testingHotkey = true;
		try {
			const isAvailable = await pttManager.testHotkey($pttHotkey);
			if (isAvailable) {
				dispatch('success', `Hotkey ${$pttHotkey} is working correctly`);
			} else {
				dispatch('error', `Hotkey ${$pttHotkey} is not available or failed to register`);
			}
		} catch (error) {
			dispatch('error', `Hotkey test failed: ${error}`);
		} finally {
			testingHotkey = false;
		}
	}

	function startKeyCapture() {
		isCapturing = true;
		capturedKeys = [];
		hotkeyError = '';
	}

	function stopKeyCapture() {
		isCapturing = false;
		if (capturedKeys.length > 0) {
			const hotkey = capturedKeys.join('+');
			setPresetHotkey(hotkey);
		}
		capturedKeys = [];
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!isCapturing) return;

		event.preventDefault();
		event.stopPropagation();

		const key = event.key;
		const modifiers = [];

		if (event.ctrlKey || event.metaKey) modifiers.push('CommandOrControl');
		if (event.altKey) modifiers.push('Alt');
		if (event.shiftKey) modifiers.push('Shift');

		// Convert some common keys to Tauri format
		let keyName = key;
		if (key === ' ') keyName = 'Space';
		else if (key === '`') keyName = 'Backquote';
		else if (key.length === 1 && key.match(/[a-zA-Z]/)) keyName = key.toUpperCase();

		const fullKey = [...modifiers, keyName].join('+');
		capturedKeys = [fullKey];
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (!isCapturing) return;

		event.preventDefault();
		event.stopPropagation();

		// Stop capturing on key up
		setTimeout(stopKeyCapture, 100);
	}
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<div class="ptt-settings">
	<div class="setting-group">
		<label class="setting-label">
			<input
				type="checkbox"
				bind:checked={$isPttEnabled}
				on:change={togglePTT}
				class="setting-checkbox"
			/>
			Enable Push-to-Talk (PTT)
		</label>
		<p class="setting-description">
			Use a hotkey to temporarily unmute while speaking. Useful for staying muted by default.
		</p>
	</div>

	{#if $isPttEnabled}
		<div class="setting-group">
			<label class="setting-label" for="ptt-hotkey">PTT Hotkey</label>
			<div class="hotkey-controls">
				<div class="current-hotkey">
					<span class="hotkey-display">{$pttHotkey}</span>
					<button
						class="btn-secondary btn-small"
						on:click={testCurrentHotkey}
						disabled={testingHotkey}
						title="Test current hotkey"
					>
						{testingHotkey ? 'Testing...' : 'Test'}
					</button>
				</div>

				<div class="hotkey-capture">
					<button
						class="btn-primary"
						class:capturing={isCapturing}
						on:click={isCapturing ? stopKeyCapture : startKeyCapture}
					>
						{#if isCapturing}
							{capturedKeys.length > 0 ? `Captured: ${capturedKeys.join('+')}` : 'Press your hotkey...'}
						{:else}
							Capture New Hotkey
						{/if}
					</button>
					{#if isCapturing}
						<button class="btn-secondary" on:click={stopKeyCapture}>Cancel</button>
					{/if}
				</div>

				<div class="preset-hotkeys">
					<label class="setting-label">Quick Select:</label>
					<div class="preset-grid">
						{#each presetHotkeys as preset}
							<button
								class="preset-btn"
								class:active={$pttHotkey === preset.value}
								on:click={() => setPresetHotkey(preset.value)}
								disabled={isCapturing}
							>
								{preset.label}
							</button>
						{/each}
					</div>
				</div>
			</div>

			{#if hotkeyError}
				<div class="error-message">{hotkeyError}</div>
			{/if}

			<p class="setting-description">
				Choose a hotkey that won't conflict with other applications. Mouse buttons (4, 5) or function keys (F1-F12) work well.
			</p>
		</div>
	{/if}
</div>

<style>
	.ptt-settings {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-label {
		font-weight: 600;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.setting-checkbox {
		width: 1rem;
		height: 1rem;
	}

	.setting-description {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin: 0;
		line-height: 1.4;
	}

	.hotkey-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.current-hotkey {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.hotkey-display {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.hotkey-capture {
		display: flex;
		gap: 0.5rem;
	}

	.btn-primary, .btn-secondary {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	.btn-primary.capturing {
		background: var(--warning);
		border-color: var(--warning);
		animation: pulse 1.5s infinite;
	}

	.btn-secondary {
		background: transparent;
		color: var(--text);
		border-color: var(--border);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.btn-small {
		padding: 0.25rem 0.5rem;
		font-size: 0.875rem;
	}

	.preset-hotkeys {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.preset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.preset-btn {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-secondary);
		color: var(--text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.preset-btn:hover:not(:disabled) {
		background: var(--bg-hover);
		border-color: var(--border-hover);
	}

	.preset-btn.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.preset-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		color: var(--error);
		font-size: 0.875rem;
		padding: 0.5rem;
		background: var(--error-bg, rgba(220, 38, 38, 0.1));
		border-radius: 6px;
		border: 1px solid var(--error-border, rgba(220, 38, 38, 0.2));
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	/* CSS custom properties that should be defined in your app's theme */
	:root {
		--text: #333;
		--text-secondary: #666;
		--bg-secondary: #f5f5f5;
		--bg-hover: #e5e5e5;
		--border: #d1d5db;
		--border-hover: #9ca3af;
		--accent: #3b82f6;
		--accent-hover: #2563eb;
		--warning: #f59e0b;
		--error: #dc2626;
	}

	@media (prefers-color-scheme: dark) {
		:root {
			--text: #f3f4f6;
			--text-secondary: #9ca3af;
			--bg-secondary: #374151;
			--bg-hover: #4b5563;
			--border: #4b5563;
			--border-hover: #6b7280;
			--accent: #3b82f6;
			--accent-hover: #2563eb;
			--warning: #f59e0b;
			--error: #ef4444;
		}
	}
</style>