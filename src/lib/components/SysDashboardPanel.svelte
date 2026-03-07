<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface CpuInfo { usage_percent: number; core_count: number; model_name: string; }
	interface MemoryInfo { total_bytes: number; used_bytes: number; available_bytes: number; usage_percent: number; }
	interface DiskInfo { name: string; mount_point: string; total_bytes: number; used_bytes: number; free_bytes: number; usage_percent: number; fs_type: string; }
	interface NetworkStats { interface_name: string; bytes_sent: number; bytes_received: number; is_up: boolean; }
	interface ProcessInfo { pid: number; name: string; cpu_percent: number; memory_bytes: number; }
	interface DashboardSnapshot {
		cpu: CpuInfo; memory: MemoryInfo; disks: DiskInfo[]; networks: NetworkStats[];
		top_processes: ProcessInfo[]; uptime_seconds: number; hostname: string; os_name: string; timestamp: number;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let snapshot = $state<DashboardSnapshot | null>(null);
	let error = $state<string | null>(null);
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	let activeTab = $state<'overview' | 'processes' | 'disks'>('overview');

	onMount(() => {
		if (open) startRefresh();
	});

	$effect(() => {
		if (open) {
			startRefresh();
		} else {
			stopRefresh();
		}
	});

	onDestroy(() => stopRefresh());

	function startRefresh() {
		loadSnapshot();
		if (!refreshInterval) {
			refreshInterval = setInterval(loadSnapshot, 3000);
		}
	}

	function stopRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	async function loadSnapshot() {
		try {
			error = null;
			snapshot = await invoke<DashboardSnapshot>('sysdash_snapshot');
		} catch (e) {
			error = String(e);
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
		if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${(bytes / 1073741824).toFixed(1)} GB`;
	}

	function formatUptime(secs: number): string {
		const days = Math.floor(secs / 86400);
		const hours = Math.floor((secs % 86400) / 3600);
		const mins = Math.floor((secs % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function usageColor(pct: number): string {
		if (pct < 50) return '#23a55a';
		if (pct < 80) return '#f0b232';
		return '#f23f43';
	}

	function handleClose() {
		open = false;
		stopRefresh();
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { handleClose(); e.preventDefault(); }
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div class="panel-backdrop" transition:fade={{ duration: 100 }} onclick={handleClose} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="panel" transition:slide={{ duration: 200, axis: 'x' }} onclick={(e) => e.stopPropagation()}>
			<div class="panel-header">
				<div class="header-left">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M8 21h8M12 17v4" />
					</svg>
					<h2>System Dashboard</h2>
				</div>
				<button class="close-btn" onclick={handleClose}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="tab-bar">
				<button class="tab" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>Overview</button>
				<button class="tab" class:active={activeTab === 'processes'} onclick={() => activeTab = 'processes'}>Processes</button>
				<button class="tab" class:active={activeTab === 'disks'} onclick={() => activeTab = 'disks'}>Disks</button>
			</div>

			{#if snapshot}
				<div class="content">
					{#if activeTab === 'overview'}
						<div class="sys-info">
							<span class="hostname">{snapshot.hostname}</span>
							<span class="os">{snapshot.os_name}</span>
							<span class="uptime">Up {formatUptime(snapshot.uptime_seconds)}</span>
						</div>

						<div class="gauge-row">
							<div class="gauge">
								<div class="gauge-ring" style="--pct: {snapshot.cpu.usage_percent}; --color: {usageColor(snapshot.cpu.usage_percent)}">
									<span class="gauge-val">{snapshot.cpu.usage_percent.toFixed(0)}%</span>
								</div>
								<span class="gauge-label">CPU</span>
								<span class="gauge-sub">{snapshot.cpu.core_count} cores</span>
							</div>
							<div class="gauge">
								<div class="gauge-ring" style="--pct: {snapshot.memory.usage_percent}; --color: {usageColor(snapshot.memory.usage_percent)}">
									<span class="gauge-val">{snapshot.memory.usage_percent.toFixed(0)}%</span>
								</div>
								<span class="gauge-label">Memory</span>
								<span class="gauge-sub">{formatBytes(snapshot.memory.used_bytes)} / {formatBytes(snapshot.memory.total_bytes)}</span>
							</div>
						</div>

						<div class="section-title">Network</div>
						{#each snapshot.networks as net}
							<div class="net-row">
								<span class="net-name">{net.interface_name}</span>
								<span class="net-stat">RX {formatBytes(net.bytes_received)}</span>
								<span class="net-stat">TX {formatBytes(net.bytes_sent)}</span>
								<span class="net-status" class:up={net.is_up}>{net.is_up ? 'UP' : 'DOWN'}</span>
							</div>
						{/each}

					{:else if activeTab === 'processes'}
						<div class="proc-header">
							<span class="proc-col name">Process</span>
							<span class="proc-col pid">PID</span>
							<span class="proc-col mem">Memory</span>
						</div>
						<div class="proc-list">
							{#each snapshot.top_processes as proc}
								<div class="proc-row">
									<span class="proc-col name">{proc.name}</span>
									<span class="proc-col pid">{proc.pid}</span>
									<span class="proc-col mem">{formatBytes(proc.memory_bytes)}</span>
								</div>
							{/each}
						</div>

					{:else if activeTab === 'disks'}
						{#each snapshot.disks as disk}
							<div class="disk-item">
								<div class="disk-header">
									<span class="disk-name">{disk.name}</span>
									<span class="disk-mount">{disk.mount_point}</span>
									<span class="disk-fs">{disk.fs_type}</span>
								</div>
								<div class="disk-bar-container">
									<div class="disk-bar" style="width: {disk.usage_percent}%; background: {usageColor(disk.usage_percent)}"></div>
								</div>
								<div class="disk-stats">
									<span>{formatBytes(disk.used_bytes)} used</span>
									<span>{formatBytes(disk.free_bytes)} free</span>
									<span>{disk.usage_percent.toFixed(1)}%</span>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{:else if !error}
				<div class="loading">Loading system info...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end; }
	.panel { width: 440px; max-width: 90vw; height: 100%; background: var(--bg-secondary, #2b2d31); display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,0.3); }
	.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.header-left { display: flex; align-items: center; gap: 10px; color: var(--text-primary, #f2f3f5); }
	.header-left h2 { font-size: 16px; font-weight: 600; margin: 0; }
	.close-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.close-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.error-bar { padding: 8px 16px; background: var(--status-danger, #f23f43); color: white; font-size: 13px; }
	.tab-bar { display: flex; gap: 2px; padding: 8px 16px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.tab { padding: 6px 14px; background: none; border: none; border-radius: 6px; color: var(--text-muted, #949ba4); font-size: 13px; font-weight: 500; cursor: pointer; }
	.tab:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); }
	.tab.active { color: white; background: var(--brand-primary, #5865f2); }
	.content { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
	.sys-info { display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary, #1e1f22); border-radius: 8px; }
	.hostname { font-weight: 600; color: var(--text-primary, #f2f3f5); font-size: 14px; }
	.os { font-size: 12px; color: var(--text-muted, #949ba4); }
	.uptime { margin-left: auto; font-size: 12px; color: var(--text-muted, #949ba4); background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); padding: 2px 8px; border-radius: 10px; }
	.gauge-row { display: flex; gap: 24px; justify-content: center; padding: 16px 0; }
	.gauge { display: flex; flex-direction: column; align-items: center; gap: 6px; }
	.gauge-ring { width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(var(--color) calc(var(--pct) * 1%), var(--bg-tertiary, #1e1f22) 0); display: flex; align-items: center; justify-content: center; position: relative; }
	.gauge-ring::before { content: ''; position: absolute; width: 60px; height: 60px; border-radius: 50%; background: var(--bg-secondary, #2b2d31); }
	.gauge-val { position: relative; z-index: 1; font-size: 16px; font-weight: 700; color: var(--text-primary, #f2f3f5); }
	.gauge-label { font-size: 13px; font-weight: 600; color: var(--text-primary, #f2f3f5); }
	.gauge-sub { font-size: 11px; color: var(--text-muted, #949ba4); }
	.section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); padding: 0 4px; }
	.net-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px; font-size: 12px; }
	.net-name { font-weight: 600; color: var(--text-primary, #f2f3f5); min-width: 60px; }
	.net-stat { color: var(--text-muted, #949ba4); }
	.net-status { margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 8px; background: rgba(243,63,67,0.2); color: #f23f43; }
	.net-status.up { background: rgba(35,165,90,0.2); color: #23a55a; }
	.proc-header { display: flex; padding: 6px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #949ba4); border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.proc-list { flex: 1; overflow-y: auto; }
	.proc-row { display: flex; padding: 6px 12px; font-size: 12px; color: var(--text-secondary, #b5bac1); }
	.proc-row:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); border-radius: 4px; }
	.proc-col.name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.proc-col.pid { width: 70px; text-align: right; color: var(--text-muted, #949ba4); }
	.proc-col.mem { width: 80px; text-align: right; }
	.disk-item { padding: 12px; background: var(--bg-tertiary, #1e1f22); border-radius: 8px; }
	.disk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
	.disk-name { font-size: 13px; font-weight: 600; color: var(--text-primary, #f2f3f5); }
	.disk-mount { font-size: 11px; color: var(--text-muted, #949ba4); }
	.disk-fs { margin-left: auto; font-size: 10px; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); padding: 1px 6px; border-radius: 8px; color: var(--text-muted, #949ba4); }
	.disk-bar-container { height: 6px; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; overflow: hidden; }
	.disk-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
	.disk-stats { display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-muted, #949ba4); }
	.loading { display: flex; align-items: center; justify-content: center; padding: 48px; color: var(--text-muted, #949ba4); }
	.content::-webkit-scrollbar { width: 6px; }
	.content::-webkit-scrollbar-track { background: transparent; }
	.content::-webkit-scrollbar-thumb { background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; }
</style>
