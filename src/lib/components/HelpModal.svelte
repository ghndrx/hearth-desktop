<script lang="ts">
	import { ui, helpOpen } from '$lib/stores/ui';
	import { fade, scale } from 'svelte/transition';

	function close() {
		ui.setHelpOpen(false);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	const shortcuts = [
		{ category: 'Navigation', items: [
			{ keys: ['Ctrl', 'K'], description: 'Open search' },
			{ keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
			{ keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle mute' },
			{ keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle deafen' },
			{ keys: ['Escape'], description: 'Close modal / Clear selection' },
		]},
		{ category: 'Messaging', items: [
			{ keys: ['Enter'], description: 'Send message' },
			{ keys: ['Shift', 'Enter'], description: 'New line' },
			{ keys: ['↑'], description: 'Edit last message (when input empty)' },
			{ keys: ['Ctrl', 'E'], description: 'Open emoji picker' },
		]},
		{ category: 'View', items: [
			{ keys: ['Ctrl', '\\'], description: 'Toggle sidebar' },
			{ keys: ['Ctrl', 'Shift', 'I'], description: 'Toggle member list' },
		]},
	];
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if $helpOpen}
	<div class="help-backdrop" transition:fade={{ duration: 100 }} onclick={handleBackdropClick}>
		<div
			class="help-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="help-title"
			transition:scale={{ duration: 100, start: 0.95 }}
		>
			<div class="help-header">
				<h2 id="help-title">Keyboard Shortcuts</h2>
				<button class="close-btn" onclick={close} aria-label="Close" type="button">
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
					</svg>
				</button>
			</div>
			<div class="help-content">
				{#each shortcuts as section}
					<div class="shortcut-section">
						<h3>{section.category}</h3>
						<div class="shortcut-list">
							{#each section.items as shortcut}
								<div class="shortcut-row">
									<div class="shortcut-keys">
										{#each shortcut.keys as key, i}
											{#if i > 0}<span class="plus">+</span>{/if}
											<kbd>{key}</kbd>
										{/each}
									</div>
									<span class="shortcut-desc">{shortcut.description}</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.help-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 40px;
	}

	.help-modal {
		width: 600px;
		max-width: 90vw;
		max-height: calc(100vh - 80px);
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 16px rgba(0, 0, 0, 0.24);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.help-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.help-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.1s ease;
	}

	.close-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.help-content {
		padding: 16px 20px;
		overflow-y: auto;
		flex: 1;
	}

	.shortcut-section {
		margin-bottom: 24px;
	}

	.shortcut-section:last-child {
		margin-bottom: 0;
	}

	.shortcut-section h3 {
		margin: 0 0 12px 0;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
	}

	.shortcut-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
	}

	.shortcut-keys {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.plus {
		color: var(--text-muted, #b5bac1);
		font-size: 12px;
	}

	kbd {
		display: inline-block;
		padding: 4px 8px;
		font-size: 12px;
		font-family: inherit;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
		min-width: 20px;
		text-align: center;
	}

	.shortcut-desc {
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
	}
</style>
