<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { settings, currentTheme } from '$lib/stores/app.js';
	import GlobalShortcutSettings from './GlobalShortcutSettings.svelte';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let activeTab = 'general';

	const tabs = [
		{ id: 'general', label: 'General', icon: '⚙️' },
		{ id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
		{ id: 'appearance', label: 'Appearance', icon: '🎨' }
	];

	function closeModal() {
		dispatch('close');
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function setTheme(theme: 'dark' | 'light' | 'midnight') {
		import('$lib/stores/app.js').then(({ app }) => {
			app.setTheme(theme);
		});
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick}>
	<div class="modal-content">
		<div class="modal-header">
			<h2>Settings</h2>
			<button class="close-button" onclick={closeModal} aria-label="Close settings">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
					<path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 0 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
				</svg>
			</button>
		</div>

		<div class="modal-body">
			<nav class="tabs">
				{#each tabs as tab}
					<button
						class="tab"
						class:active={activeTab === tab.id}
						onclick={() => activeTab = tab.id}
					>
						<span class="tab-icon">{tab.icon}</span>
						{tab.label}
					</button>
				{/each}
			</nav>

			<div class="tab-content">
				{#if activeTab === 'general'}
					<div class="settings-section">
						<h3>General Settings</h3>

						<div class="setting-row">
							<label class="setting-label">
								<input
									type="checkbox"
									checked={$settings.notifications}
									onchange={(e) => settings.update({ notifications: (e.target as HTMLInputElement).checked })}
								/>
								<span>Enable notifications</span>
							</label>
						</div>

						<div class="setting-row">
							<label class="setting-label">
								<input
									type="checkbox"
									checked={$settings.sounds}
									onchange={(e) => settings.update({ sounds: (e.target as HTMLInputElement).checked })}
								/>
								<span>Enable sounds</span>
							</label>
						</div>

						<div class="setting-row">
							<label class="setting-label">
								<input
									type="checkbox"
									checked={$settings.compactMode}
									onchange={(e) => settings.update({ compactMode: (e.target as HTMLInputElement).checked })}
								/>
								<span>Compact mode</span>
							</label>
						</div>

						<div class="setting-row">
							<label class="setting-label">
								Font size:
								<select
									value={$settings.fontSize}
									onchange={(e) => settings.update({ fontSize: (e.target as HTMLSelectElement).value as 'small' | 'medium' | 'large' })}
								>
									<option value="small">Small</option>
									<option value="medium">Medium</option>
									<option value="large">Large</option>
								</select>
							</label>
						</div>
					</div>
				{:else if activeTab === 'shortcuts'}
					<GlobalShortcutSettings />
				{:else if activeTab === 'appearance'}
					<div class="settings-section">
						<h3>Appearance</h3>

						<div class="setting-row">
							<label class="setting-label">
								Theme:
								<select value={$currentTheme} onchange={(e) => setTheme((e.target as HTMLSelectElement).value as 'dark' | 'light' | 'midnight')}>
									<option value="dark">Dark</option>
									<option value="light">Light</option>
									<option value="midnight">Midnight</option>
								</select>
							</label>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 2rem;
	}

	.modal-content {
		background: var(--bg-primary, #313338);
		border-radius: 0.5rem;
		width: 100%;
		max-width: 800px;
		max-height: 80vh;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
		border: 1px solid var(--bg-modifier-accent, #404040);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--bg-modifier-accent, #404040);
		background: var(--bg-secondary, #2b2d31);
	}

	.modal-header h2 {
		margin: 0;
		color: var(--text-normal, #fff);
		font-size: 1.5rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		color: var(--text-muted, #b9bbbe);
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.375rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: var(--bg-modifier-hover, #404040);
		color: var(--text-normal, #fff);
	}

	.modal-body {
		display: flex;
		height: 60vh;
		min-height: 400px;
	}

	.tabs {
		width: 200px;
		background: var(--bg-secondary, #2b2d31);
		border-right: 1px solid var(--bg-modifier-accent, #404040);
		padding: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tab {
		background: none;
		border: none;
		color: var(--text-muted, #b9bbbe);
		cursor: pointer;
		padding: 0.75rem 1.5rem;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s;
	}

	.tab:hover {
		background: var(--bg-modifier-hover, #404040);
		color: var(--text-normal, #fff);
	}

	.tab.active {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.tab-icon {
		font-size: 1rem;
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.settings-section {
		padding: 2rem;
	}

	.settings-section h3 {
		margin: 0 0 1.5rem 0;
		color: var(--text-normal, #fff);
		font-size: 1.25rem;
		font-weight: 600;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--bg-modifier-accent, #404040);
	}

	.setting-row {
		margin-bottom: 1.5rem;
	}

	.setting-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text-normal, #fff);
		cursor: pointer;
		font-size: 0.875rem;
	}

	.setting-label input[type="checkbox"] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand-primary, #5865f2);
		cursor: pointer;
	}

	.setting-label select {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-normal, #fff);
		border: 1px solid var(--bg-modifier-accent, #404040);
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		cursor: pointer;
		margin-left: auto;
	}

	.setting-label select:focus {
		outline: none;
		border-color: var(--brand-primary, #5865f2);
	}
</style>