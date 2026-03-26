<script lang="ts">
	import { settings, type Theme, type MessageDisplay } from '$lib/stores/settings';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { onMount, onDestroy } from 'svelte';

	let systemTheme: string | null = null;
	let unlisten: UnlistenFn | null = null;

	const themes: { id: Theme; label: string; description: string; colors: string[] }[] = [
		{ id: 'dark', label: 'Dark', description: 'Easy on the eyes', colors: ['#36393f', '#2f3136', '#202225'] },
		{ id: 'light', label: 'Light', description: 'Classic bright look', colors: ['#ffffff', '#f2f3f5', '#e3e5e8'] },
		{ id: 'midnight', label: 'Midnight', description: 'True dark AMOLED', colors: ['#0e0e10', '#18181b', '#1e1e22'] },
		{ id: 'sunset', label: 'Sunset', description: 'Warm amber tones', colors: ['#1c1210', '#261a16', '#140e0c'] },
		{ id: 'ocean', label: 'Ocean', description: 'Cool deep blue', colors: ['#0c1a24', '#10222e', '#081318'] }
	];

	const displayModes: { id: MessageDisplay; label: string; description: string }[] = [
		{ id: 'cozy', label: 'Cozy', description: 'Avatars and larger spacing between messages' },
		{ id: 'compact', label: 'Compact', description: 'Denser layout showing more messages at once' }
	];

	$: currentSettings = $settings.app;

	function setTheme(theme: Theme) {
		settings.updateApp({ theme });
	}

	function setMessageDisplay(display: MessageDisplay) {
		settings.updateApp({ messageDisplay: display });
	}

	function setFontSize(size: number) {
		settings.updateApp({ fontSize: Math.max(12, Math.min(24, size)) });
	}

	function toggleCompactMode() {
		settings.updateApp({ compactMode: !currentSettings.compactMode });
	}

	function toggleAnimations() {
		settings.updateApp({ enableAnimations: !currentSettings.enableAnimations });
	}

	function setWindowOpacity(opacity: number) {
		settings.updateApp({ windowOpacity: Math.max(50, Math.min(100, opacity)) });
	}

	onMount(async () => {
		try {
			const theme = await invoke<string>('get_system_theme');
			systemTheme = theme;
		} catch {
			// Not in Tauri environment
		}

		try {
			unlisten = await listen<{ is_dark: boolean }>('system-theme-changed', (event) => {
				systemTheme = event.payload.is_dark ? 'dark' : 'light';
			});
		} catch {
			// Not in Tauri environment
		}
	});

	onDestroy(() => {
		if (unlisten) unlisten();
	});
</script>

<div class="appearance-settings">
	<h2>Appearance</h2>
	<p class="description">Customize how Hearth looks on your device.</p>

	<!-- Theme Selection -->
	<section class="setting-group">
		<h3>Theme</h3>
		{#if systemTheme}
			<p class="system-theme-hint">Your system is using {systemTheme} mode</p>
		{/if}
		<div class="theme-grid">
			{#each themes as theme}
				<button
					class="theme-card"
					class:selected={currentSettings.theme === theme.id}
					on:click={() => setTheme(theme.id)}
					aria-label="Select {theme.label} theme"
					aria-pressed={currentSettings.theme === theme.id}
				>
					<div class="theme-preview">
						<div class="preview-sidebar" style="background: {theme.colors[2]}"></div>
						<div class="preview-main" style="background: {theme.colors[0]}">
							<div class="preview-line" style="background: {theme.colors[1]}"></div>
							<div class="preview-line short" style="background: {theme.colors[1]}"></div>
							<div class="preview-line" style="background: {theme.colors[1]}"></div>
						</div>
					</div>
					<span class="theme-label">{theme.label}</span>
					<span class="theme-desc">{theme.description}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Message Display -->
	<section class="setting-group">
		<h3>Message Display</h3>
		<div class="display-options">
			{#each displayModes as mode}
				<button
					class="display-option"
					class:selected={currentSettings.messageDisplay === mode.id}
					on:click={() => setMessageDisplay(mode.id)}
					aria-label="Select {mode.label} display"
					aria-pressed={currentSettings.messageDisplay === mode.id}
				>
					<div class="radio-indicator">
						{#if currentSettings.messageDisplay === mode.id}
							<div class="radio-dot"></div>
						{/if}
					</div>
					<div class="option-text">
						<span class="option-label">{mode.label}</span>
						<span class="option-desc">{mode.description}</span>
					</div>
				</button>
			{/each}
		</div>
	</section>

	<!-- Font Size -->
	<section class="setting-group">
		<h3>Chat Font Size — {currentSettings.fontSize}px</h3>
		<div class="slider-row">
			<span class="slider-label">12px</span>
			<input
				type="range"
				min="12"
				max="24"
				step="1"
				value={currentSettings.fontSize}
				on:input={(e) => setFontSize(Number(e.currentTarget.value))}
				aria-label="Font size"
			/>
			<span class="slider-label">24px</span>
		</div>
		<div class="font-preview" style="font-size: {currentSettings.fontSize}px">
			The quick brown fox jumps over the lazy dog.
		</div>
	</section>

	<!-- Window Opacity -->
	<section class="setting-group">
		<h3>Window Opacity — {currentSettings.windowOpacity ?? 100}%</h3>
		<div class="slider-row">
			<span class="slider-label">50%</span>
			<input
				type="range"
				min="50"
				max="100"
				step="1"
				value={currentSettings.windowOpacity ?? 100}
				on:input={(e) => setWindowOpacity(Number(e.currentTarget.value))}
				aria-label="Window opacity"
			/>
			<span class="slider-label">100%</span>
		</div>
	</section>

	<!-- Toggles -->
	<section class="setting-group">
		<h3>Advanced</h3>
		<div class="toggle-list">
			<label class="toggle-item">
				<div class="toggle-text">
					<span class="toggle-label">Compact Mode</span>
					<span class="toggle-desc">Reduce padding and margins throughout the UI</span>
				</div>
				<button
					class="toggle-switch"
					class:active={currentSettings.compactMode}
					on:click={toggleCompactMode}
					role="switch"
					aria-checked={currentSettings.compactMode}
					aria-label="Toggle compact mode"
				>
					<div class="toggle-knob"></div>
				</button>
			</label>
			<label class="toggle-item">
				<div class="toggle-text">
					<span class="toggle-label">Enable Animations</span>
					<span class="toggle-desc">Show transition effects and motion throughout the app</span>
				</div>
				<button
					class="toggle-switch"
					class:active={currentSettings.enableAnimations}
					on:click={toggleAnimations}
					role="switch"
					aria-checked={currentSettings.enableAnimations}
					aria-label="Toggle animations"
				>
					<div class="toggle-knob"></div>
				</button>
			</label>
		</div>
	</section>

	<!-- Reset -->
	<section class="setting-group">
		<button class="reset-btn" on:click={() => settings.reset()}>
			Reset to Defaults
		</button>
	</section>
</div>

<style>
	.appearance-settings {
		max-width: 660px;
		padding: 24px 0;
		color: var(--text-primary, #dcddde);
	}

	h2 {
		margin: 0 0 4px 0;
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.description {
		margin: 0 0 24px 0;
		font-size: 14px;
		color: var(--text-muted, #72767d);
	}

	.setting-group {
		margin-bottom: 32px;
	}

	h3 {
		margin: 0 0 12px 0;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #b5bac1);
	}

	.system-theme-hint {
		margin: -8px 0 12px 0;
		font-size: 12px;
		color: var(--text-muted, #72767d);
		font-style: italic;
	}

	/* Theme Cards */
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	.theme-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--bg-secondary, #2f3136);
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.theme-card:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}

	.theme-card.selected {
		border-color: var(--brand-experiment, #5865f2);
	}

	.theme-preview {
		display: flex;
		width: 100%;
		height: 60px;
		border-radius: 4px;
		overflow: hidden;
	}

	.preview-sidebar {
		width: 20%;
	}

	.preview-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 8px;
	}

	.preview-line {
		height: 4px;
		border-radius: 2px;
		opacity: 0.5;
	}

	.preview-line.short {
		width: 60%;
	}

	.theme-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.theme-desc {
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	/* Display Options */
	.display-options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.display-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: var(--bg-secondary, #2f3136);
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.display-option:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}

	.display-option.selected {
		border-color: var(--brand-experiment, #5865f2);
	}

	.radio-indicator {
		width: 20px;
		height: 20px;
		border: 2px solid var(--text-muted, #72767d);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.display-option.selected .radio-indicator {
		border-color: var(--brand-experiment, #5865f2);
	}

	.radio-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--brand-experiment, #5865f2);
	}

	.option-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.option-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #dcddde);
	}

	.option-desc {
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	/* Sliders */
	.slider-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.slider-label {
		font-size: 12px;
		color: var(--text-muted, #72767d);
		min-width: 32px;
		text-align: center;
	}

	input[type='range'] {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		background: var(--bg-tertiary, #202225);
		outline: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--brand-experiment, #5865f2);
		cursor: pointer;
		border: 2px solid var(--bg-primary, #36393f);
	}

	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--brand-experiment, #5865f2);
		cursor: pointer;
		border: 2px solid var(--bg-primary, #36393f);
	}

	.font-preview {
		margin-top: 12px;
		padding: 12px 16px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 6px;
		color: var(--text-primary, #dcddde);
		line-height: 1.375;
	}

	/* Toggles */
	.toggle-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.toggle-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		cursor: pointer;
	}

	.toggle-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #dcddde);
	}

	.toggle-desc {
		font-size: 12px;
		color: var(--text-muted, #72767d);
	}

	.toggle-switch {
		position: relative;
		width: 40px;
		height: 24px;
		border-radius: 12px;
		background: var(--bg-tertiary, #72767d);
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
		padding: 0;
	}

	.toggle-switch.active {
		background: var(--brand-experiment, #5865f2);
	}

	.toggle-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.15s ease;
	}

	.toggle-switch.active .toggle-knob {
		transform: translateX(16px);
	}

	/* Reset */
	.reset-btn {
		padding: 8px 16px;
		background: transparent;
		border: 1px solid var(--status-danger, #ed4245);
		border-radius: 4px;
		color: var(--status-danger, #ed4245);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: var(--status-danger, #ed4245);
		color: #fff;
	}

	@media (max-width: 500px) {
		.theme-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
