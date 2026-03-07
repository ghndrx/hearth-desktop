<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface KeystrokeStats {
		counts: Record<string, number>;
		total_keystrokes: number;
		session_start: number;
		peak_key: string | null;
		peak_count: number;
	}

	const KEYBOARD_ROWS = [
		['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
		['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
		['space']
	];

	let stats: KeystrokeStats | null = $state(null);
	let maxCount = $state(1);
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let recording = $state(false);
	let keyListener: ((e: KeyboardEvent) => void) | null = null;
	let keyBuffer: string[] = [];
	let flushTimer: ReturnType<typeof setTimeout> | null = null;

	function getHeatColor(count: number): string {
		if (count === 0) return 'rgba(255, 255, 255, 0.03)';
		const ratio = Math.min(count / maxCount, 1);
		if (ratio < 0.25) return `rgba(88, 101, 242, ${0.15 + ratio * 1.4})`;
		if (ratio < 0.5) return `rgba(250, 168, 26, ${0.3 + ratio * 0.8})`;
		if (ratio < 0.75) return `rgba(242, 121, 63, ${0.5 + ratio * 0.4})`;
		return `rgba(242, 63, 67, ${0.6 + ratio * 0.4})`;
	}

	function getKeyLabel(key: string): string {
		if (key === 'space') return 'Space';
		if (key === 'backspace') return 'Bksp';
		if (key === 'enter') return 'Enter';
		if (key === 'shift') return 'Shift';
		if (key === 'control') return 'Ctrl';
		if (key === 'alt') return 'Alt';
		if (key === 'tab') return 'Tab';
		if (key === 'escape') return 'Esc';
		if (key === 'arrowup') return '\u2191';
		if (key === 'arrowdown') return '\u2193';
		if (key === 'arrowleft') return '\u2190';
		if (key === 'arrowright') return '\u2192';
		return key.toUpperCase();
	}

	function getKeyCount(key: string): number {
		if (!stats) return 0;
		const normalized = key.toLowerCase();
		return stats.counts[normalized] || 0;
	}

	function getKeyWidth(key: string): string {
		if (key === 'space') return '240px';
		return '36px';
	}

	async function flushKeys() {
		if (keyBuffer.length === 0) return;
		const batch = [...keyBuffer];
		keyBuffer = [];
		try {
			await invoke('heatmap_record_keys', { keys: batch });
		} catch {
			// silently fail
		}
	}

	function startRecording() {
		recording = true;
		keyListener = (e: KeyboardEvent) => {
			if (e.repeat) return;
			const key = e.key === ' ' ? 'space' : e.key.toLowerCase();
			keyBuffer.push(key);

			if (flushTimer) clearTimeout(flushTimer);
			if (keyBuffer.length >= 20) {
				flushKeys();
			} else {
				flushTimer = setTimeout(flushKeys, 500);
			}
		};
		window.addEventListener('keydown', keyListener, { capture: true });
	}

	function stopRecording() {
		recording = false;
		if (keyListener) {
			window.removeEventListener('keydown', keyListener, { capture: true });
			keyListener = null;
		}
		flushKeys();
	}

	async function fetchStats() {
		try {
			stats = await invoke<KeystrokeStats>('heatmap_get_stats');
			if (stats) {
				const values = Object.values(stats.counts);
				maxCount = values.length > 0 ? Math.max(...values) : 1;
			}
		} catch {
			// silently fail
		}
	}

	async function resetStats() {
		try {
			await invoke('heatmap_reset');
			await fetchStats();
		} catch {
			// silently fail
		}
	}

	function formatNumber(n: number): string {
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
		if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
		return n.toString();
	}

	function getSessionDuration(): string {
		if (!stats) return '0m';
		const elapsed = Date.now() - stats.session_start;
		const minutes = Math.floor(elapsed / 60000);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		return `${minutes}m`;
	}

	let kpm = $derived((() => {
		if (!stats || stats.total_keystrokes === 0) return 0;
		const elapsed = (Date.now() - stats.session_start) / 60000;
		if (elapsed < 0.1) return 0;
		return Math.round(stats.total_keystrokes / elapsed);
	})());

	onMount(() => {
		fetchStats();
		pollInterval = setInterval(fetchStats, 2000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
		stopRecording();
		if (flushTimer) clearTimeout(flushTimer);
	});
</script>

<div class="heatmap-panel">
	<div class="panel-header">
		<h3>Keystroke Heatmap</h3>
		<div class="header-actions">
			<button
				class="record-btn"
				class:active={recording}
				onclick={() => recording ? stopRecording() : startRecording()}
			>
				<span class="record-dot" class:pulse={recording}></span>
				{recording ? 'Stop' : 'Record'}
			</button>
			<button class="reset-btn" onclick={resetStats}>Reset</button>
		</div>
	</div>

	<div class="stats-bar">
		<div class="stat">
			<span class="stat-value">{stats ? formatNumber(stats.total_keystrokes) : '0'}</span>
			<span class="stat-label">Total</span>
		</div>
		<div class="stat">
			<span class="stat-value">{kpm}</span>
			<span class="stat-label">Keys/min</span>
		</div>
		<div class="stat">
			<span class="stat-value">{stats?.peak_key ? getKeyLabel(stats.peak_key) : '-'}</span>
			<span class="stat-label">Top Key</span>
		</div>
		<div class="stat">
			<span class="stat-value">{getSessionDuration()}</span>
			<span class="stat-label">Session</span>
		</div>
	</div>

	<div class="keyboard">
		{#each KEYBOARD_ROWS as row, rowIdx}
			<div class="keyboard-row" style="padding-left: {rowIdx * 12}px">
				{#each row as key}
					{@const count = getKeyCount(key)}
					<div
						class="key"
						style="
							background: {getHeatColor(count)};
							width: {getKeyWidth(key)};
						"
						title="{getKeyLabel(key)}: {count} presses"
					>
						<span class="key-label">{getKeyLabel(key)}</span>
						{#if count > 0}
							<span class="key-count">{formatNumber(count)}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="legend">
		<span class="legend-label">Low</span>
		<div class="legend-gradient"></div>
		<span class="legend-label">High</span>
	</div>

	{#if stats && stats.total_keystrokes > 0}
		<div class="top-keys">
			<h4>Most Used Keys</h4>
			<div class="top-keys-list">
				{#each Object.entries(stats.counts)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 10) as [key, count]}
					<div class="top-key-item">
						<span class="top-key-name">{getKeyLabel(key)}</span>
						<div class="top-key-bar-container">
							<div
								class="top-key-bar"
								style="width: {(count / maxCount) * 100}%"
							></div>
						</div>
						<span class="top-key-count">{formatNumber(count)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.heatmap-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.header-actions {
		display: flex;
		gap: 6px;
	}

	.record-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.15s;
	}

	.record-btn.active {
		background: rgba(242, 63, 67, 0.15);
		color: #f23f43;
		border-color: rgba(242, 63, 67, 0.3);
	}

	.record-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted, #949ba4);
	}

	.record-btn.active .record-dot {
		background: #f23f43;
	}

	.record-dot.pulse {
		animation: pulse-dot 1.5s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.8); }
	}

	.reset-btn {
		padding: 5px 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.15s;
	}

	.reset-btn:hover {
		color: var(--text-normal, #dbdee1);
		background: rgba(255, 255, 255, 0.06);
	}

	.stats-bar {
		display: flex;
		gap: 16px;
		justify-content: center;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
	}

	.stat {
		text-align: center;
		min-width: 60px;
	}

	.stat-value {
		display: block;
		font-size: 18px;
		font-weight: 700;
		color: var(--header-primary, #f2f3f5);
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.keyboard {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		align-items: center;
	}

	.keyboard-row {
		display: flex;
		gap: 3px;
	}

	.key {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 36px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		cursor: default;
		transition: background 0.3s;
		position: relative;
		min-width: 36px;
	}

	.key-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
		line-height: 1;
	}

	.key-count {
		font-size: 8px;
		color: rgba(255, 255, 255, 0.6);
		line-height: 1;
		margin-top: 1px;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: center;
	}

	.legend-label {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
	}

	.legend-gradient {
		width: 120px;
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			rgba(88, 101, 242, 0.2),
			rgba(250, 168, 26, 0.6),
			rgba(242, 121, 63, 0.8),
			rgba(242, 63, 67, 0.95)
		);
	}

	.top-keys {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.top-keys h4 {
		margin: 0;
		font-size: 13px;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.top-keys-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.top-key-item {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.top-key-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
		min-width: 48px;
		text-align: right;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}

	.top-key-bar-container {
		flex: 1;
		height: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 3px;
		overflow: hidden;
	}

	.top-key-bar {
		height: 100%;
		background: var(--brand-experiment, #5865f2);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.top-key-count {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		min-width: 36px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
