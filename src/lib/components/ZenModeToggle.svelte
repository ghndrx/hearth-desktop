<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	/**
	 * ZenModeToggle - Distraction-free mode toggle with settings popover
	 *
	 * Integrates with the Tauri zenmode backend to toggle and configure
	 * Zen Mode: hiding sidebars, adjusting font scale, and optionally
	 * going fullscreen for a focused chat experience.
	 */

	interface ZenModeConfig {
		enabled: boolean;
		fullscreen: boolean;
		showHeader: boolean;
		showInput: boolean;
		backgroundBlur: number;
		fontScale: number;
		hideTimestamps: boolean;
		hideAvatars: boolean;
		autoHideUi: boolean;
		autoHideDelay: number;
	}

	// Props
	export let compact = false;

	// State
	let enabled = false;
	let config: ZenModeConfig | null = null;
	let showSettings = false;
	let loading = false;
	let unlisteners: UnlistenFn[] = [];

	const presetNames = ['Minimal', 'Reading', 'Focus'];
	let currentPresetLabel = '';

	async function loadState() {
		try {
			enabled = await invoke<boolean>('is_zen_mode_enabled');
			config = await invoke<ZenModeConfig>('get_zen_mode_config');
			updatePresetLabel();
		} catch (e) {
			console.error('Failed to load Zen Mode state:', e);
		}
	}

	async function toggle() {
		if (loading) return;
		loading = true;
		try {
			config = await invoke<ZenModeConfig>('toggle_zen_mode');
			enabled = config.enabled;
			updatePresetLabel();
		} catch (e) {
			console.error('Failed to toggle Zen Mode:', e);
		} finally {
			loading = false;
		}
	}

	async function cyclePreset() {
		if (loading) return;
		loading = true;
		try {
			config = await invoke<ZenModeConfig>('cycle_zen_mode_preset');
			enabled = config.enabled;
			updatePresetLabel();
		} catch (e) {
			console.error('Failed to cycle Zen Mode preset:', e);
		} finally {
			loading = false;
		}
	}

	async function updateConfig(partial: Partial<ZenModeConfig>) {
		if (!config) return;
		const newConfig = { ...config, ...partial };
		try {
			config = await invoke<ZenModeConfig>('update_zen_mode_config', { newConfig });
			enabled = config.enabled;
			updatePresetLabel();
		} catch (e) {
			console.error('Failed to update Zen Mode config:', e);
		}
	}

	async function resetConfig() {
		try {
			config = await invoke<ZenModeConfig>('reset_zen_mode_config');
			enabled = config.enabled;
			currentPresetLabel = '';
		} catch (e) {
			console.error('Failed to reset Zen Mode config:', e);
		}
	}

	function updatePresetLabel() {
		if (!config || !config.enabled) {
			currentPresetLabel = '';
			return;
		}
		if (config.fullscreen && !config.showHeader && config.hideTimestamps) {
			currentPresetLabel = 'Minimal';
		} else if (!config.fullscreen && !config.showInput) {
			currentPresetLabel = 'Reading';
		} else if (config.fullscreen && config.showHeader && config.showInput) {
			currentPresetLabel = 'Focus';
		} else {
			currentPresetLabel = 'Custom';
		}
	}

	function toggleSettings(e: MouseEvent) {
		e.stopPropagation();
		showSettings = !showSettings;
	}

	function closeSettings() {
		showSettings = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && showSettings) {
			closeSettings();
		}
	}

	onMount(async () => {
		await loadState();

		const u1 = await listen('zen-mode-entered', (event) => {
			config = event.payload as ZenModeConfig;
			enabled = true;
			updatePresetLabel();
		});

		const u2 = await listen('zen-mode-exited', (event) => {
			config = event.payload as ZenModeConfig;
			enabled = false;
			updatePresetLabel();
		});

		const u3 = await listen('zen-mode-config-changed', (event) => {
			config = event.payload as ZenModeConfig;
			enabled = config.enabled;
			updatePresetLabel();
		});

		const u4 = await listen<{ enabled: boolean }>('zen-mode-changed', (event) => {
			enabled = event.payload.enabled;
			if (event.payload.config) {
				config = event.payload.config as ZenModeConfig;
			}
			updatePresetLabel();
		});

		unlisteners = [u1, u2, u3, u4];
	});

	onDestroy(() => {
		unlisteners.forEach((fn) => fn());
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="zen-toggle-wrapper" class:compact>
	<!-- Main toggle button -->
	<button
		class="zen-toggle"
		class:active={enabled}
		class:loading
		on:click={toggle}
		title={enabled ? 'Exit Zen Mode (Ctrl+Shift+Z)' : 'Enter Zen Mode (Ctrl+Shift+Z)'}
		aria-label="Toggle Zen Mode"
		aria-pressed={enabled}
		disabled={loading}
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 18 18"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="zen-icon"
			class:active={enabled}
		>
			<!-- Zen circle -->
			<circle
				cx="9"
				cy="9"
				r="7.5"
				stroke="currentColor"
				stroke-width="1.5"
				fill="none"
				class="zen-circle"
			/>
			<!-- Zen wave -->
			<path
				d="M5 9C5.5 7.5 6.5 7 7.5 8C8.5 9 9.5 8.5 10.5 7.5C11.5 6.5 12.5 7 13 9"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linecap="round"
				fill="none"
				class="zen-wave"
			/>
		</svg>

		{#if !compact}
			<span class="zen-label">
				{#if enabled && currentPresetLabel}
					{currentPresetLabel}
				{:else}
					Zen
				{/if}
			</span>
		{/if}

		{#if enabled}
			<span class="active-dot" transition:scale={{ duration: 200 }} />
		{/if}
	</button>

	<!-- Preset cycle button (only when enabled) -->
	{#if enabled}
		<button
			class="preset-btn"
			on:click={cyclePreset}
			title="Cycle Zen Mode preset"
			transition:fade={{ duration: 150 }}
		>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
				<path
					d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"
					fill="none"
					stroke="currentColor"
					stroke-width="1.2"
				/>
				<path
					d="M7 4v3l2 1.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	{/if}

	<!-- Settings button -->
	<button
		class="settings-btn"
		on:click={toggleSettings}
		title="Zen Mode settings"
		aria-expanded={showSettings}
	>
		<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
			<circle cx="7" cy="3" r="1.2" />
			<circle cx="7" cy="7" r="1.2" />
			<circle cx="7" cy="11" r="1.2" />
		</svg>
	</button>

	<!-- Settings popover -->
	{#if showSettings && config}
		<div
			class="settings-overlay"
			on:click={closeSettings}
			on:keydown={(e) => e.key === 'Enter' && closeSettings()}
			role="button"
			tabindex="-1"
		/>
		<div class="settings-popover" transition:scale={{ duration: 150, start: 0.95 }}>
			<div class="settings-header">
				<h3>Zen Mode Settings</h3>
				<button class="reset-btn" on:click={resetConfig}>Reset</button>
			</div>

			<div class="settings-body">
				<label class="setting-row">
					<span>Fullscreen</span>
					<input
						type="checkbox"
						checked={config.fullscreen}
						on:change={(e) => updateConfig({ fullscreen: e.currentTarget.checked })}
					/>
				</label>

				<label class="setting-row">
					<span>Show header</span>
					<input
						type="checkbox"
						checked={config.showHeader}
						on:change={(e) => updateConfig({ showHeader: e.currentTarget.checked })}
					/>
				</label>

				<label class="setting-row">
					<span>Show input</span>
					<input
						type="checkbox"
						checked={config.showInput}
						on:change={(e) => updateConfig({ showInput: e.currentTarget.checked })}
					/>
				</label>

				<label class="setting-row">
					<span>Hide timestamps</span>
					<input
						type="checkbox"
						checked={config.hideTimestamps}
						on:change={(e) => updateConfig({ hideTimestamps: e.currentTarget.checked })}
					/>
				</label>

				<label class="setting-row">
					<span>Hide avatars</span>
					<input
						type="checkbox"
						checked={config.hideAvatars}
						on:change={(e) => updateConfig({ hideAvatars: e.currentTarget.checked })}
					/>
				</label>

				<label class="setting-row">
					<span>Auto-hide UI</span>
					<input
						type="checkbox"
						checked={config.autoHideUi}
						on:change={(e) => updateConfig({ autoHideUi: e.currentTarget.checked })}
					/>
				</label>

				<div class="setting-row">
					<span>Font scale</span>
					<div class="range-group">
						<input
							type="range"
							min="0.8"
							max="1.5"
							step="0.05"
							value={config.fontScale}
							on:input={(e) => updateConfig({ fontScale: parseFloat(e.currentTarget.value) })}
						/>
						<span class="range-value">{config.fontScale.toFixed(2)}x</span>
					</div>
				</div>

				<div class="setting-row">
					<span>Background blur</span>
					<div class="range-group">
						<input
							type="range"
							min="0"
							max="100"
							step="5"
							value={config.backgroundBlur}
							on:input={(e) =>
								updateConfig({ backgroundBlur: parseInt(e.currentTarget.value) })}
						/>
						<span class="range-value">{config.backgroundBlur}%</span>
					</div>
				</div>
			</div>

			<div class="settings-footer">
				<span class="shortcut-hint">Ctrl+Shift+Z</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.zen-toggle-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.zen-toggle {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 13px;
		font-weight: 500;
	}

	.zen-toggle:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--text-primary, #e5e7eb);
	}

	.zen-toggle.active {
		background: var(--accent-zen, rgba(139, 92, 246, 0.15));
		color: var(--accent-zen-text, #a78bfa);
	}

	.zen-toggle.active:hover {
		background: var(--accent-zen-hover, rgba(139, 92, 246, 0.25));
	}

	.zen-toggle.loading {
		opacity: 0.6;
		pointer-events: none;
	}

	.compact .zen-toggle {
		padding: 6px;
	}

	.zen-icon {
		flex-shrink: 0;
		transition: transform 0.3s ease;
	}

	.zen-icon.active {
		transform: rotate(180deg);
	}

	.zen-circle {
		transition: all 0.3s ease;
	}

	.zen-toggle.active .zen-circle {
		stroke: var(--accent-zen-text, #a78bfa);
	}

	.zen-wave {
		transition: all 0.3s ease;
	}

	.zen-toggle.active .zen-wave {
		stroke: var(--accent-zen-text, #a78bfa);
	}

	.zen-label {
		white-space: nowrap;
	}

	.active-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--accent-zen-text, #a78bfa);
		flex-shrink: 0;
	}

	.preset-btn,
	.settings-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.7;
	}

	.preset-btn:hover,
	.settings-btn:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--text-primary, #e5e7eb);
		opacity: 1;
	}

	.settings-overlay {
		position: fixed;
		inset: 0;
		z-index: 99;
	}

	.settings-popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		width: 280px;
		background: var(--bg-primary, #2f3136);
		border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		z-index: 100;
		overflow: hidden;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
	}

	.settings-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary, #e5e7eb);
	}

	.reset-btn {
		border: none;
		background: transparent;
		color: var(--text-muted, #72767d);
		font-size: 11px;
		cursor: pointer;
		padding: 2px 8px;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: var(--bg-hover, rgba(255, 255, 255, 0.06));
		color: var(--text-secondary, #b9bbbe);
	}

	.settings-body {
		padding: 8px 16px;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 13px;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
	}

	.setting-row input[type='checkbox'] {
		accent-color: var(--accent-zen-text, #a78bfa);
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.range-group {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.range-group input[type='range'] {
		width: 80px;
		accent-color: var(--accent-zen-text, #a78bfa);
		cursor: pointer;
	}

	.range-value {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		min-width: 36px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.settings-footer {
		padding: 8px 16px;
		border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
		text-align: center;
	}

	.shortcut-hint {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		padding: 2px 8px;
		background: var(--bg-secondary, rgba(255, 255, 255, 0.04));
		border-radius: 4px;
		font-family: monospace;
	}
</style>
