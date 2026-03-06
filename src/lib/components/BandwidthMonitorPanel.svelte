<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface BandwidthStats {
		bytes_sent: number;
		bytes_received: number;
		session_start: number;
		peak_download_rate: number;
		peak_upload_rate: number;
		current_download_rate: number;
		current_upload_rate: number;
	}

	let stats: BandwidthStats = {
		bytes_sent: 0,
		bytes_received: 0,
		session_start: 0,
		peak_download_rate: 0,
		peak_upload_rate: 0,
		current_download_rate: 0,
		current_upload_rate: 0
	};

	let monitoring = false;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let downloadHistory: number[] = Array(30).fill(0);
	let uploadHistory: number[] = Array(30).fill(0);

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	}

	function formatRate(bytesPerSec: number): string {
		return `${formatBytes(bytesPerSec)}/s`;
	}

	function formatDuration(startSecs: number): string {
		const now = Math.floor(Date.now() / 1000);
		const elapsed = now - startSecs;
		if (elapsed < 60) return `${elapsed}s`;
		if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
		const h = Math.floor(elapsed / 3600);
		const m = Math.floor((elapsed % 3600) / 60);
		return `${h}h ${m}m`;
	}

	async function startMonitoring() {
		try {
			await invoke('bandwidth_start_monitor');
			monitoring = true;
			startPolling();
		} catch (e) {
			console.error('Failed to start bandwidth monitor:', e);
		}
	}

	async function stopMonitoring() {
		try {
			await invoke('bandwidth_stop_monitor');
			monitoring = false;
			stopPolling();
		} catch (e) {
			console.error('Failed to stop bandwidth monitor:', e);
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(async () => {
			try {
				stats = await invoke<BandwidthStats>('bandwidth_get_stats');
				downloadHistory = [...downloadHistory.slice(1), stats.current_download_rate];
				uploadHistory = [...uploadHistory.slice(1), stats.current_upload_rate];
			} catch (e) {
				console.error('Failed to get bandwidth stats:', e);
			}
		}, 1000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function resetStats() {
		try {
			await invoke('bandwidth_reset');
			stats = await invoke<BandwidthStats>('bandwidth_get_stats');
			downloadHistory = Array(30).fill(0);
			uploadHistory = Array(30).fill(0);
		} catch (e) {
			console.error('Failed to reset bandwidth stats:', e);
		}
	}

	function getSparklinePath(data: number[], width: number, height: number): string {
		const max = Math.max(...data, 1);
		const step = width / (data.length - 1);
		return data
			.map((v, i) => {
				const x = i * step;
				const y = height - (v / max) * height;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	function getSparklineAreaPath(data: number[], width: number, height: number): string {
		const linePath = getSparklinePath(data, width, height);
		const step = width / (data.length - 1);
		return `${linePath} L${width},${height} L0,${height} Z`;
	}

	onMount(() => {
		startMonitoring();
	});

	onDestroy(() => {
		stopPolling();
	});
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Network Monitor</h3>
		<div class="flex items-center gap-2">
			{#if monitoring}
				<span class="flex items-center gap-1 text-[10px] text-green-400">
					<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-400"></span>
					Live
				</span>
			{/if}
			<button
				class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
				onclick={resetStats}
				title="Reset counters"
			>
				Reset
			</button>
		</div>
	</div>

	<!-- Live Speed Indicators -->
	<div class="grid grid-cols-2 gap-3">
		<!-- Download -->
		<div class="rounded-md bg-[var(--bg-tertiary)] p-3">
			<div class="mb-1 flex items-center gap-1.5">
				<svg class="h-3.5 w-3.5 text-blue-400" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 12l-4-4h2.5V4h3v4H12L8 12z" />
				</svg>
				<span class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Download</span>
			</div>
			<div class="text-lg font-bold tabular-nums text-blue-400">
				{formatRate(stats.current_download_rate)}
			</div>
			<!-- Sparkline -->
			<svg class="mt-1.5 h-8 w-full" viewBox="0 0 120 32" preserveAspectRatio="none">
				<path
					d={getSparklineAreaPath(downloadHistory, 120, 32)}
					fill="rgba(96, 165, 250, 0.1)"
				/>
				<path
					d={getSparklinePath(downloadHistory, 120, 32)}
					fill="none"
					stroke="rgba(96, 165, 250, 0.6)"
					stroke-width="1.5"
				/>
			</svg>
		</div>

		<!-- Upload -->
		<div class="rounded-md bg-[var(--bg-tertiary)] p-3">
			<div class="mb-1 flex items-center gap-1.5">
				<svg class="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 4l4 4h-2.5v4h-3V8H4l4-4z" />
				</svg>
				<span class="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Upload</span>
			</div>
			<div class="text-lg font-bold tabular-nums text-emerald-400">
				{formatRate(stats.current_upload_rate)}
			</div>
			<!-- Sparkline -->
			<svg class="mt-1.5 h-8 w-full" viewBox="0 0 120 32" preserveAspectRatio="none">
				<path
					d={getSparklineAreaPath(uploadHistory, 120, 32)}
					fill="rgba(52, 211, 153, 0.1)"
				/>
				<path
					d={getSparklinePath(uploadHistory, 120, 32)}
					fill="none"
					stroke="rgba(52, 211, 153, 0.6)"
					stroke-width="1.5"
				/>
			</svg>
		</div>
	</div>

	<!-- Session Stats -->
	<div class="grid grid-cols-2 gap-2">
		<div class="rounded bg-[var(--bg-tertiary)] px-3 py-2">
			<div class="text-[10px] text-[var(--text-muted)]">Total Downloaded</div>
			<div class="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
				{formatBytes(stats.bytes_received)}
			</div>
		</div>
		<div class="rounded bg-[var(--bg-tertiary)] px-3 py-2">
			<div class="text-[10px] text-[var(--text-muted)]">Total Uploaded</div>
			<div class="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
				{formatBytes(stats.bytes_sent)}
			</div>
		</div>
	</div>

	<!-- Peak Rates & Session Duration -->
	<div class="grid grid-cols-3 gap-2 text-center">
		<div>
			<div class="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
				{formatRate(stats.peak_download_rate)}
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Peak DL</div>
		</div>
		<div>
			<div class="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
				{formatRate(stats.peak_upload_rate)}
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Peak UL</div>
		</div>
		<div>
			<div class="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
				{stats.session_start > 0 ? formatDuration(stats.session_start) : '--'}
			</div>
			<div class="text-[10px] text-[var(--text-muted)]">Session</div>
		</div>
	</div>

	<!-- Monitor Toggle -->
	<button
		class="w-full rounded bg-[var(--bg-tertiary)] py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)]"
		onclick={() => monitoring ? stopMonitoring() : startMonitoring()}
	>
		{monitoring ? 'Stop Monitoring' : 'Start Monitoring'}
	</button>
</div>
