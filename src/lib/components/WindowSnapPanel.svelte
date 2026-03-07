<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	interface SnapState {
		isSnapped: boolean;
		currentZone: string | null;
	}

	interface MonitorInfo {
		name: string;
		width: number;
		height: number;
		scaleFactor: number;
	}

	let snapState = $state<SnapState | null>(null);
	let monitors = $state<MonitorInfo[]>([]);
	let error = $state<string | null>(null);

	const zones = [
		{ id: 'Left', label: 'Left Half', icon: '◧', grid: 'left' },
		{ id: 'Right', label: 'Right Half', icon: '◨', grid: 'right' },
		{ id: 'TopLeft', label: 'Top Left', icon: '◰', grid: 'top-left' },
		{ id: 'TopRight', label: 'Top Right', icon: '◳', grid: 'top-right' },
		{ id: 'BottomLeft', label: 'Bottom Left', icon: '◱', grid: 'bottom-left' },
		{ id: 'BottomRight', label: 'Bottom Right', icon: '◲', grid: 'bottom-right' },
		{ id: 'Maximized', label: 'Maximize', icon: '⬜', grid: 'full' },
		{ id: 'Center', label: 'Center', icon: '◻', grid: 'center' },
	];

	onMount(async () => {
		await refresh();
	});

	async function refresh() {
		try {
			snapState = await invoke<SnapState>('snap_get_state');
			monitors = await invoke<MonitorInfo[]>('snap_get_monitors');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function snapTo(zone: string) {
		try {
			await invoke('snap_window', { zone });
			snapState = await invoke<SnapState>('snap_get_state');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function restore() {
		try {
			await invoke('snap_restore');
			snapState = await invoke<SnapState>('snap_get_state');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function cascade() {
		try {
			await invoke('snap_cascade');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function moveToMonitor(index: number) {
		try {
			await invoke('snap_to_monitor', { monitorIndex: index });
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function cycleZone(direction: string) {
		try {
			await invoke('snap_cycle_zone', { direction });
			snapState = await invoke<SnapState>('snap_get_state');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}
</script>

<div class="snap-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<rect x="2" y="2" width="20" height="20" rx="2" />
					<path d="M12 2v20M2 12h20" />
				</svg>
			</span>
			<h3>Window Snap</h3>
		</div>
		{#if snapState?.isSnapped}
			<button class="restore-btn" onclick={restore} title="Restore">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
					<path d="M23 4v6h-6M1 20v-6h6" />
					<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
				</svg>
			</button>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if snapState?.isSnapped}
		<div class="current-snap">
			<span class="snap-indicator"></span>
			<span class="snap-text">Snapped: {snapState.currentZone}</span>
		</div>
	{/if}

	<div class="snap-grid">
		<div class="grid-row">
			<button class="grid-cell top-left" class:active={snapState?.currentZone === 'TopLeft'} onclick={() => snapTo('TopLeft')} title="Top Left">
				<span class="zone-highlight"></span>
			</button>
			<button class="grid-cell top-right" class:active={snapState?.currentZone === 'TopRight'} onclick={() => snapTo('TopRight')} title="Top Right">
				<span class="zone-highlight"></span>
			</button>
		</div>
		<div class="grid-row">
			<button class="grid-cell bottom-left" class:active={snapState?.currentZone === 'BottomLeft'} onclick={() => snapTo('BottomLeft')} title="Bottom Left">
				<span class="zone-highlight"></span>
			</button>
			<button class="grid-cell bottom-right" class:active={snapState?.currentZone === 'BottomRight'} onclick={() => snapTo('BottomRight')} title="Bottom Right">
				<span class="zone-highlight"></span>
			</button>
		</div>
	</div>

	<div class="zone-buttons">
		{#each zones as zone}
			<button
				class="zone-btn"
				class:active={snapState?.currentZone === zone.id}
				onclick={() => snapTo(zone.id)}
				title={zone.label}
			>
				<span class="zone-icon">{zone.icon}</span>
				<span class="zone-label">{zone.label}</span>
			</button>
		{/each}
	</div>

	<div class="action-row">
		<button class="action-btn" onclick={() => cycleZone('Previous')} title="Previous zone">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Prev
		</button>
		<button class="action-btn" onclick={cascade} title="Cascade window">Cascade</button>
		<button class="action-btn" onclick={() => cycleZone('Next')} title="Next zone">
			Next
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
				<polyline points="9 18 15 12 9 6" />
			</svg>
		</button>
	</div>

	{#if monitors.length > 1}
		<div class="monitors-section">
			<span class="section-label">Monitors ({monitors.length})</span>
			<div class="monitor-list">
				{#each monitors as monitor, idx}
					<button class="monitor-btn" onclick={() => moveToMonitor(idx)} title="Move to {monitor.name}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
							<rect x="2" y="3" width="20" height="14" rx="2" />
							<path d="M8 21h8M12 17v4" />
						</svg>
						<span class="monitor-name">{monitor.name || `Monitor ${idx + 1}`}</span>
						<span class="monitor-res">{monitor.width}x{monitor.height}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.snap-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { color: #fee75c; display: flex; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.restore-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.restore-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error-msg { font-size: 12px; color: #ed4245; }

	.current-snap {
		display: flex; align-items: center; gap: 6px;
		padding: 6px 10px; border-radius: 4px; font-size: 12px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.snap-indicator { width: 6px; height: 6px; border-radius: 50%; background: #fee75c; }
	.snap-text { color: var(--text-secondary, #949ba4); }

	.snap-grid {
		display: flex; flex-direction: column; gap: 2px;
		padding: 8px; background: var(--bg-tertiary, #1e1f22); border-radius: 8px;
	}
	.grid-row { display: flex; gap: 2px; }
	.grid-cell {
		flex: 1; aspect-ratio: 16/9; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-secondary, #2b2d31);
		cursor: pointer; position: relative; overflow: hidden;
	}
	.grid-cell:hover { border-color: #fee75c; }
	.grid-cell.active { border-color: #fee75c; }
	.zone-highlight {
		position: absolute; inset: 2px; border-radius: 2px;
		background: transparent; transition: background 0.15s;
	}
	.grid-cell:hover .zone-highlight { background: rgba(254, 231, 92, 0.15); }
	.grid-cell.active .zone-highlight { background: rgba(254, 231, 92, 0.25); }

	.zone-buttons { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
	.zone-btn {
		display: flex; flex-direction: column; align-items: center; gap: 2px;
		padding: 6px 4px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 10px; cursor: pointer;
	}
	.zone-btn:hover { color: var(--text-primary, #dbdee1); border-color: #fee75c; }
	.zone-btn.active { border-color: #fee75c; background: rgba(254, 231, 92, 0.1); }
	.zone-icon { font-size: 16px; }
	.zone-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

	.action-row { display: flex; gap: 4px; }
	.action-btn {
		flex: 1; padding: 5px 8px; border-radius: 4px; font-size: 11px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;
	}
	.action-btn:hover { color: var(--text-primary, #dbdee1); }

	.monitors-section { display: flex; flex-direction: column; gap: 4px; }
	.section-label {
		font-size: 11px; color: var(--text-secondary, #949ba4);
		text-transform: uppercase; letter-spacing: 0.5px;
	}
	.monitor-list { display: flex; flex-direction: column; gap: 2px; }
	.monitor-btn {
		display: flex; align-items: center; gap: 6px;
		padding: 6px 8px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px; cursor: pointer; text-align: left;
	}
	.monitor-btn:hover { color: var(--text-primary, #dbdee1); border-color: var(--text-muted, #6d6f78); }
	.monitor-name { flex: 1; }
	.monitor-res { color: var(--text-muted, #6d6f78); font-size: 10px; font-family: monospace; }
</style>
