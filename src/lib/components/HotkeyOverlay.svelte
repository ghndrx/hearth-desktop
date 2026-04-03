<script lang="ts">
	import { shortcutBindings } from '$lib/stores/globalShortcuts';
	import { isSelfMuted, isSelfDeafened } from '$lib/stores/voice';
	import { isPTTMode, isPTTActive } from '$lib/stores/ptt';
	import { fly } from 'svelte/transition';

	let visible = $state(false);

	function toggle() {
		visible = !visible;
	}

	function formatKeys(keys: string[]): string {
		return keys.join(' + ');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.shiftKey && e.key === '?') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<div
		class="overlay"
		transition:fly={{ y: 20, duration: 200 }}
		role="dialog"
		aria-label="Keyboard shortcuts"
	>
		<div class="overlay-header">
			<h3>Keyboard Shortcuts</h3>
			<button class="close-btn" onclick={toggle} aria-label="Close">&times;</button>
		</div>

		<div class="shortcuts-list">
			{#each $shortcutBindings as binding}
				<div class="shortcut-row">
					<span class="shortcut-label">{binding.label}</span>
					<span class="shortcut-keys">
						{#each binding.keys as key, i}
							<kbd>{key}</kbd>
							{#if i < binding.keys.length - 1}
								<span class="plus">+</span>
							{/if}
						{/each}
					</span>
				</div>
			{/each}
		</div>

		<div class="status-indicators">
			<div class="status-row">
				<span class="status-dot" class:active={!$isSelfMuted} class:inactive={$isSelfMuted}
				></span>
				<span>{$isSelfMuted ? 'Muted' : 'Unmuted'}</span>
			</div>
			<div class="status-row">
				<span
					class="status-dot"
					class:active={!$isSelfDeafened}
					class:inactive={$isSelfDeafened}
				></span>
				<span>{$isSelfDeafened ? 'Deafened' : 'Listening'}</span>
			</div>
			{#if $isPTTMode}
				<div class="status-row">
					<span class="status-dot" class:active={$isPTTActive} class:inactive={!$isPTTActive}
					></span>
					<span>{$isPTTActive ? 'Transmitting' : 'PTT Ready'}</span>
				</div>
			{/if}
		</div>

		<p class="hint">Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>?</kbd> to toggle</p>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		bottom: 80px;
		right: 20px;
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 12px;
		padding: 16px;
		min-width: 280px;
		z-index: 9999;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		color: var(--text-primary, #f2f3f5);
	}

	.overlay-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.overlay-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-secondary, #b5bac1);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		font-size: 20px;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}
	.close-btn:hover {
		color: var(--text-primary, #f2f3f5);
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.shortcut-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.shortcut-label {
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
	}

	.shortcut-keys {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.plus {
		color: var(--text-muted, #949ba4);
		font-size: 11px;
	}

	kbd {
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 11px;
		font-family: inherit;
		color: var(--text-primary, #f2f3f5);
		min-width: 20px;
		text-align: center;
	}

	.status-indicators {
		border-top: 1px solid var(--border-subtle, #3f4147);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 10px;
	}

	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary, #b5bac1);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.status-dot.active {
		background: #23a55a;
	}
	.status-dot.inactive {
		background: #80848e;
	}

	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		text-align: center;
	}
</style>
