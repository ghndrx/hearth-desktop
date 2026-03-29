<script lang="ts">
	import { settings, currentTheme } from '$lib/stores/app';
	import { HotkeySettings } from '$lib';

	// Available themes
	const themes = [
		{ value: 'dark', label: 'Dark' },
		{ value: 'light', label: 'Light' },
		{ value: 'midnight', label: 'Midnight' }
	];

	// Available font sizes
	const fontSizes = [
		{ value: 'small', label: 'Small' },
		{ value: 'medium', label: 'Medium' },
		{ value: 'large', label: 'Large' }
	];

	let activeTab = $state('general');

	function setActiveTab(tab: string) {
		activeTab = tab;
	}

	// Apply theme change
	function handleThemeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newTheme = target.value as 'dark' | 'light' | 'midnight';
		import('$lib/stores/app').then(({ app }) => {
			app.setTheme(newTheme);
		});
	}
</script>

<svelte:head>
	<title>Settings - Hearth</title>
</svelte:head>

<div class="settings-container">
	<div class="settings-sidebar">
		<h2>Settings</h2>
		<nav class="settings-nav">
			<button
				class="nav-item"
				class:active={activeTab === 'general'}
				onclick={() => setActiveTab('general')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
				</svg>
				General
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'appearance'}
				onclick={() => setActiveTab('appearance')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 18.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm-6-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S6 17.83 6 17zm13-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
				</svg>
				Appearance
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'hotkeys'}
				onclick={() => setActiveTab('hotkeys')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
				</svg>
				Hotkeys
			</button>
			<button
				class="nav-item"
				class:active={activeTab === 'notifications'}
				onclick={() => setActiveTab('notifications')}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
				</svg>
				Notifications
			</button>
		</nav>
	</div>

	<div class="settings-content">
		{#if activeTab === 'general'}
			<div class="settings-section">
				<h3>General Settings</h3>

				<div class="setting-group">
					<label class="setting-label">
						<input
							type="checkbox"
							bind:checked={$settings.compactMode}
							onchange={() => settings.update({ compactMode: !$settings.compactMode })}
						/>
						<span class="checkmark"></span>
						Enable compact mode
					</label>
					<p class="setting-description">Use a more condensed layout to show more content.</p>
				</div>

				<div class="setting-group">
					<label for="fontSize" class="setting-title">Font Size</label>
					<select
						id="fontSize"
						value={$settings.fontSize}
						onchange={(e) => settings.update({ fontSize: (e.target as HTMLSelectElement).value as 'small' | 'medium' | 'large' })}
					>
						{#each fontSizes as size}
							<option value={size.value}>{size.label}</option>
						{/each}
					</select>
				</div>
			</div>

		{:else if activeTab === 'appearance'}
			<div class="settings-section">
				<h3>Appearance</h3>

				<div class="setting-group">
					<label for="theme" class="setting-title">Theme</label>
					<select
						id="theme"
						value={$currentTheme}
						onchange={handleThemeChange}
					>
						{#each themes as theme}
							<option value={theme.value}>{theme.label}</option>
						{/each}
					</select>
					<p class="setting-description">Choose your preferred color scheme.</p>
				</div>
			</div>

		{:else if activeTab === 'hotkeys'}
			<div class="settings-section">
				<HotkeySettings />
			</div>

		{:else if activeTab === 'notifications'}
			<div class="settings-section">
				<h3>Notification Settings</h3>

				<div class="setting-group">
					<label class="setting-label">
						<input
							type="checkbox"
							bind:checked={$settings.notifications}
							onchange={() => settings.update({ notifications: !$settings.notifications })}
						/>
						<span class="checkmark"></span>
						Enable notifications
					</label>
					<p class="setting-description">Show desktop notifications for new messages.</p>
				</div>

				<div class="setting-group">
					<label class="setting-label">
						<input
							type="checkbox"
							bind:checked={$settings.sounds}
							onchange={() => settings.update({ sounds: !$settings.sounds })}
						/>
						<span class="checkmark"></span>
						Enable sounds
					</label>
					<p class="setting-description">Play notification sounds for new messages.</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.settings-container {
		display: flex;
		height: 100vh;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.settings-sidebar {
		width: 280px;
		background: var(--bg-secondary);
		border-right: 1px solid var(--border-secondary);
		padding: 24px;
		overflow-y: auto;
	}

	.settings-sidebar h2 {
		margin: 0 0 24px 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.settings-nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary);
		text-align: left;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.nav-item:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.nav-item.active {
		background: var(--brand-primary);
		color: white;
	}

	.nav-item svg {
		flex-shrink: 0;
	}

	.settings-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.settings-section {
		padding: 24px;
		max-width: 800px;
	}

	.settings-section h3 {
		margin: 0 0 24px 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		border-bottom: 1px solid var(--border-secondary);
		padding-bottom: 8px;
	}

	.setting-group {
		margin-bottom: 24px;
	}

	.setting-title {
		display: block;
		margin-bottom: 8px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
	}

	.setting-label {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary);
		cursor: pointer;
		user-select: none;
	}

	.setting-label input[type="checkbox"] {
		display: none;
	}

	.checkmark {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border-secondary);
		border-radius: 4px;
		background: var(--bg-primary);
		position: relative;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.setting-label input[type="checkbox"]:checked + .checkmark {
		background: var(--brand-primary);
		border-color: var(--brand-primary);
	}

	.setting-label input[type="checkbox"]:checked + .checkmark::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 2px;
		width: 6px;
		height: 10px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.setting-description {
		margin: 6px 0 0 0;
		font-size: 13px;
		color: var(--text-muted);
		line-height: 1.4;
	}

	select {
		padding: 8px 12px;
		border: 1px solid var(--border-secondary);
		border-radius: 6px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 14px;
		min-width: 120px;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	select:focus {
		outline: none;
		border-color: var(--brand-primary);
	}

	/* CSS variables for theming */
	:global([data-theme="dark"]) {
		--bg-primary: #1e1e1e;
		--bg-secondary: #2b2b2b;
		--bg-hover: #323232;
		--border-secondary: #404040;
		--text-primary: #ffffff;
		--text-secondary: #cccccc;
		--text-muted: #a0a0a0;
		--brand-primary: #5865f2;
	}

	:global([data-theme="light"]) {
		--bg-primary: #ffffff;
		--bg-secondary: #f8f8f8;
		--bg-hover: #f0f0f0;
		--border-secondary: #d0d0d0;
		--text-primary: #000000;
		--text-secondary: #333333;
		--text-muted: #666666;
		--brand-primary: #5865f2;
	}

	:global([data-theme="midnight"]) {
		--bg-primary: #0f0f0f;
		--bg-secondary: #1a1a1a;
		--bg-hover: #242424;
		--border-secondary: #303030;
		--text-primary: #ffffff;
		--text-secondary: #cccccc;
		--text-muted: #a0a0a0;
		--brand-primary: #5865f2;
	}
</style>