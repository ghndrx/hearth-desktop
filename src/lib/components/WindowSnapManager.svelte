<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	// Types matching Rust backend
	type SnapZone = 'Left' | 'Right' | 'TopLeft' | 'TopRight' | 'BottomLeft' | 'BottomRight' | 'Top' | 'Center';
	type CycleDirection = 'Next' | 'Prev';

	interface SnapConfig {
		enabled: boolean;
		snap_threshold: number;
		animation_enabled: boolean;
		show_snap_preview: boolean;
		gap: number;
	}

	interface SnapState {
		is_snapped: boolean;
		current_zone: SnapZone | null;
		original_bounds: { x: number; y: number; width: number; height: number } | null;
	}

	interface MonitorInfo {
		index: number;
		name: string;
		x: number;
		y: number;
		width: number;
		height: number;
		scale_factor: number;
		is_primary: boolean;
	}

	interface ZoneDefinition {
		zone: SnapZone;
		x: number;
		y: number;
		width: number;
		height: number;
		label: string;
	}

	// State
	let config: SnapConfig = {
		enabled: true,
		snap_threshold: 20,
		animation_enabled: true,
		show_snap_preview: true,
		gap: 8
	};
	let snapState: SnapState = {
		is_snapped: false,
		current_zone: null,
		original_bounds: null
	};
	let monitors: MonitorInfo[] = [];
	let zones: ZoneDefinition[] = [];
	let selectedMonitor = 0;
	let hoveredZone: SnapZone | null = null;
	let showSettings = false;
	let loading = false;

	// Zone grid layout: maps zones to grid positions (row, col)
	const zoneGrid: { zone: SnapZone; row: number; col: number; label: string; shortcut: string }[] = [
		{ zone: 'TopLeft', row: 0, col: 0, label: 'Top Left', shortcut: 'Ctrl+Win+7' },
		{ zone: 'Top', row: 0, col: 1, label: 'Maximize', shortcut: 'Ctrl+Win+8' },
		{ zone: 'TopRight', row: 0, col: 2, label: 'Top Right', shortcut: 'Ctrl+Win+9' },
		{ zone: 'Left', row: 1, col: 0, label: 'Left Half', shortcut: 'Ctrl+Win+4' },
		{ zone: 'Center', row: 1, col: 1, label: 'Center', shortcut: 'Ctrl+Win+5' },
		{ zone: 'Right', row: 1, col: 2, label: 'Right Half', shortcut: 'Ctrl+Win+6' },
		{ zone: 'BottomLeft', row: 2, col: 0, label: 'Bottom Left', shortcut: 'Ctrl+Win+1' },
		{ zone: 'Center', row: 2, col: 1, label: 'Cascade', shortcut: 'Ctrl+Win+2' },
		{ zone: 'BottomRight', row: 2, col: 2, label: 'Bottom Right', shortcut: 'Ctrl+Win+3' }
	];

	let unlisteners: (() => void)[] = [];

	onMount(async () => {
		await loadState();
		await loadConfig();
		await loadMonitors();
		await loadZones();

		// Listen for window move/resize events to detect manual unsnapping
		try {
			const unlisten1 = await listen('tauri://move', handleWindowMoveResize);
			const unlisten2 = await listen('tauri://resize', handleWindowMoveResize);
			unlisteners.push(unlisten1, unlisten2);
		} catch (e) {
			console.error('Failed to listen for window events:', e);
		}
	});

	onDestroy(() => {
		unlisteners.forEach((fn) => fn());
	});

	async function loadState() {
		try {
			snapState = await invoke('snap_get_state');
		} catch (e) {
			console.error('Failed to load snap state:', e);
		}
	}

	async function loadConfig() {
		try {
			config = await invoke('snap_get_config');
		} catch (e) {
			console.error('Failed to load snap config:', e);
		}
	}

	async function loadMonitors() {
		try {
			monitors = await invoke('snap_get_monitors');
			if (monitors.length > 0) {
				const primary = monitors.findIndex((m) => m.is_primary);
				selectedMonitor = primary >= 0 ? primary : 0;
			}
		} catch (e) {
			console.error('Failed to load monitors:', e);
		}
	}

	async function loadZones() {
		try {
			zones = await invoke('snap_get_zones');
		} catch (e) {
			console.error('Failed to load zones:', e);
		}
	}

	async function handleSnapToZone(zone: SnapZone) {
		if (!config.enabled) return;
		loading = true;
		try {
			await invoke('snap_window', { zone });
			await loadState();
		} catch (e) {
			console.error('Failed to snap window:', e);
		} finally {
			loading = false;
		}
	}

	async function handleRestore() {
		loading = true;
		try {
			await invoke('snap_restore');
			await loadState();
		} catch (e) {
			console.error('Failed to restore window:', e);
		} finally {
			loading = false;
		}
	}

	async function handleCycle(direction: CycleDirection) {
		loading = true;
		try {
			await invoke('snap_cycle_zone', { direction });
			await loadState();
		} catch (e) {
			console.error('Failed to cycle zone:', e);
		} finally {
			loading = false;
		}
	}

	async function handleCascade() {
		loading = true;
		try {
			await invoke('snap_cascade');
		} catch (e) {
			console.error('Failed to cascade:', e);
		} finally {
			loading = false;
		}
	}

	async function handleMoveToMonitor() {
		loading = true;
		try {
			await invoke('snap_to_monitor', { monitorIndex: selectedMonitor });
		} catch (e) {
			console.error('Failed to move to monitor:', e);
		} finally {
			loading = false;
		}
	}

	async function handleConfigChange() {
		try {
			await invoke('snap_set_config', { config });
		} catch (e) {
			console.error('Failed to save config:', e);
		}
	}

	function handleWindowMoveResize() {
		// Refresh state on window move/resize to detect manual changes
		loadState();
	}

	function isActiveZone(zone: SnapZone): boolean {
		return snapState.current_zone === zone;
	}
</script>

<div class="snap-manager">
	<div class="snap-header">
		<h3>Window Snapping</h3>
		<div class="header-actions">
			<button
				class="icon-btn"
				class:active={showSettings}
				on:click={() => (showSettings = !showSettings)}
				title="Settings"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
					<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318z"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Snap State Indicator -->
	<div class="snap-status" class:snapped={snapState.is_snapped}>
		{#if snapState.is_snapped}
			<span class="status-dot active"></span>
			<span>Snapped: {snapState.current_zone}</span>
		{:else}
			<span class="status-dot"></span>
			<span>Not snapped</span>
		{/if}
	</div>

	<!-- Snap Zone Grid -->
	<div class="zone-grid" class:disabled={!config.enabled}>
		{#each zoneGrid as item, idx}
			<button
				class="zone-cell"
				class:active={isActiveZone(item.zone)}
				class:hovered={hoveredZone === item.zone && !isActiveZone(item.zone)}
				class:preview={config.show_snap_preview && hoveredZone === item.zone}
				disabled={!config.enabled || loading}
				on:click={() => {
					if (idx === 7) {
						handleCascade();
					} else {
						handleSnapToZone(item.zone);
					}
				}}
				on:mouseenter={() => (hoveredZone = item.zone)}
				on:mouseleave={() => (hoveredZone = null)}
				title="{item.label} ({item.shortcut})"
			>
				<span class="zone-label">{item.label}</span>
				<span class="zone-shortcut">{item.shortcut}</span>
			</button>
		{/each}
	</div>

	<!-- Action Buttons -->
	<div class="action-bar">
		<button
			class="action-btn"
			disabled={!snapState.is_snapped || loading}
			on:click={handleRestore}
			title="Restore original size and position"
		>
			Restore
		</button>
		<button
			class="action-btn"
			disabled={!config.enabled || loading}
			on:click={() => handleCycle('Prev')}
			title="Previous snap zone"
		>
			&#9664; Prev
		</button>
		<button
			class="action-btn"
			disabled={!config.enabled || loading}
			on:click={() => handleCycle('Next')}
			title="Next snap zone"
		>
			Next &#9654;
		</button>
	</div>

	<!-- Monitor Selector -->
	{#if monitors.length > 1}
		<div class="monitor-section">
			<label class="section-label" for="monitor-select">Move to Monitor</label>
			<div class="monitor-row">
				<select
					id="monitor-select"
					bind:value={selectedMonitor}
					class="monitor-select"
				>
					{#each monitors as monitor}
						<option value={monitor.index}>
							{monitor.name || `Monitor ${monitor.index + 1}`}
							({monitor.width}x{monitor.height})
							{monitor.is_primary ? ' (Primary)' : ''}
						</option>
					{/each}
				</select>
				<button class="action-btn" on:click={handleMoveToMonitor} disabled={loading}>
					Move
				</button>
			</div>
		</div>
	{/if}

	<!-- Keyboard Shortcuts Reference -->
	<div class="shortcuts-section">
		<button
			class="shortcuts-toggle"
			on:click={() => {
				const el = document.getElementById('shortcuts-list');
				if (el) el.classList.toggle('expanded');
			}}
		>
			Keyboard Shortcuts
		</button>
		<div id="shortcuts-list" class="shortcuts-list">
			<div class="shortcut-item"><kbd>Ctrl+Win+Arrow</kbd> Snap Left/Right/Max/Restore</div>
			<div class="shortcut-item"><kbd>Ctrl+Win+Numpad</kbd> Snap to zone (numpad layout)</div>
			<div class="shortcut-item"><kbd>Ctrl+Shift+Arrow</kbd> Cycle snap zones</div>
			<div class="shortcut-item"><kbd>Ctrl+Win+M</kbd> Move to next monitor</div>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="settings-panel">
			<h4>Snap Settings</h4>

			<label class="toggle-row">
				<span>Enable Snapping</span>
				<input
					type="checkbox"
					bind:checked={config.enabled}
					on:change={handleConfigChange}
				/>
			</label>

			<label class="toggle-row">
				<span>Animate Transitions</span>
				<input
					type="checkbox"
					bind:checked={config.animation_enabled}
					on:change={handleConfigChange}
				/>
			</label>

			<label class="toggle-row">
				<span>Show Snap Preview</span>
				<input
					type="checkbox"
					bind:checked={config.show_snap_preview}
					on:change={handleConfigChange}
				/>
			</label>

			<div class="slider-row">
				<div class="slider-header">
					<span>Snap Threshold</span>
					<span class="slider-value">{config.snap_threshold}px</span>
				</div>
				<input
					type="range"
					min="5"
					max="50"
					step="5"
					bind:value={config.snap_threshold}
					on:change={handleConfigChange}
					class="slider"
				/>
			</div>

			<div class="slider-row">
				<div class="slider-header">
					<span>Window Gap</span>
					<span class="slider-value">{config.gap}px</span>
				</div>
				<input
					type="range"
					min="0"
					max="24"
					step="2"
					bind:value={config.gap}
					on:change={handleConfigChange}
					class="slider"
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.snap-manager {
		background-color: #2b2d31;
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		color: #dcddde;
	}

	.snap-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.snap-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: #b5bac1;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s, color 0.15s;
	}

	.icon-btn:hover,
	.icon-btn.active {
		background-color: #313338;
		color: #f2f3f5;
	}

	/* Snap status */
	.snap-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #b5bac1;
		padding: 4px 8px;
		background-color: #1e1f22;
		border-radius: 4px;
	}

	.snap-status.snapped {
		color: #5865f2;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: #4e5058;
		flex-shrink: 0;
	}

	.status-dot.active {
		background-color: #5865f2;
		box-shadow: 0 0 6px rgba(88, 101, 242, 0.5);
	}

	/* Zone grid */
	.zone-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(3, 1fr);
		gap: 4px;
		aspect-ratio: 16 / 10;
	}

	.zone-grid.disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.zone-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		background-color: #1e1f22;
		border: 2px solid #313338;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
		padding: 4px;
		color: #b5bac1;
	}

	.zone-cell:hover:not(:disabled) {
		border-color: #5865f2;
		background-color: rgba(88, 101, 242, 0.1);
	}

	.zone-cell.active {
		border-color: #5865f2;
		background-color: rgba(88, 101, 242, 0.2);
		color: #f2f3f5;
	}

	.zone-cell.hovered {
		border-color: #5865f2;
		background-color: rgba(88, 101, 242, 0.08);
	}

	.zone-cell.preview {
		box-shadow: inset 0 0 12px rgba(88, 101, 242, 0.25);
	}

	.zone-cell:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.zone-label {
		font-size: 10px;
		font-weight: 500;
		text-align: center;
		line-height: 1.2;
	}

	.zone-shortcut {
		font-size: 8px;
		color: #4e5058;
	}

	/* Action bar */
	.action-bar {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		flex: 1;
		padding: 6px 10px;
		font-size: 12px;
		font-weight: 500;
		color: #dcddde;
		background-color: #313338;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background-color: #3b3d44;
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* Monitor section */
	.monitor-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.section-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: #b5bac1;
	}

	.monitor-row {
		display: flex;
		gap: 4px;
	}

	.monitor-select {
		flex: 1;
		padding: 6px 8px;
		font-size: 12px;
		background-color: #1e1f22;
		color: #dcddde;
		border: 1px solid #313338;
		border-radius: 4px;
		outline: none;
	}

	.monitor-select:focus {
		border-color: #5865f2;
	}

	/* Shortcuts section */
	.shortcuts-section {
		display: flex;
		flex-direction: column;
	}

	.shortcuts-toggle {
		background: none;
		border: none;
		color: #b5bac1;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		cursor: pointer;
		padding: 4px 0;
		text-align: left;
		transition: color 0.15s;
	}

	.shortcuts-toggle:hover {
		color: #f2f3f5;
	}

	.shortcuts-list {
		display: none;
		flex-direction: column;
		gap: 4px;
		padding-top: 4px;
	}

	.shortcuts-list.expanded {
		display: flex;
	}

	:global(.shortcuts-list.expanded) {
		display: flex !important;
	}

	.shortcut-item {
		font-size: 11px;
		color: #b5bac1;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.shortcut-item kbd {
		display: inline-block;
		padding: 1px 5px;
		font-size: 10px;
		font-family: monospace;
		background-color: #1e1f22;
		border: 1px solid #313338;
		border-radius: 3px;
		color: #dcddde;
		white-space: nowrap;
	}

	/* Settings panel */
	.settings-panel {
		background-color: #1e1f22;
		border-radius: 6px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.settings-panel h4 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: #f2f3f5;
		text-transform: uppercase;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
		cursor: pointer;
		color: #dcddde;
	}

	.toggle-row input[type='checkbox'] {
		accent-color: #5865f2;
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.slider-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.slider-header {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #dcddde;
	}

	.slider-value {
		color: #b5bac1;
		font-size: 12px;
	}

	.slider {
		width: 100%;
		height: 6px;
		appearance: none;
		-webkit-appearance: none;
		background-color: #313338;
		border-radius: 3px;
		outline: none;
		cursor: pointer;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background-color: #5865f2;
		cursor: pointer;
		border: none;
	}

	.slider::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background-color: #5865f2;
		cursor: pointer;
		border: none;
	}
</style>
