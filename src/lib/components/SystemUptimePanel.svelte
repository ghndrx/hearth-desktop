<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface UptimeInfo {
		systemUptimeSecs: number;
		systemUptimeFormatted: string;
		appUptimeSecs: number;
		appUptimeFormatted: string;
		appStartedAt: string;
		systemBootTime: string;
		milestonesReached: string[];
	}

	let info = $state<UptimeInfo | null>(null);
	let error = $state<string | null>(null);
	let interval: ReturnType<typeof setInterval> | null = null;
	let showDetails = $state(false);

	onMount(() => {
		loadUptime();
		interval = setInterval(loadUptime, 5000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	async function loadUptime() {
		try {
			info = await invoke<UptimeInfo>('uptime_get_info');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function formatDateTime(iso: string): string {
		try { return new Date(iso).toLocaleString(); }
		catch { return ''; }
	}

	function getUptimeColor(secs: number): string {
		if (secs >= 86400) return '#faa61a';
		if (secs >= 3600) return '#3ba55d';
		return '#5865f2';
	}

	let appProgress = $derived(info ? Math.min((info.appUptimeSecs / 86400) * 100, 100) : 0);
	let sysProgress = $derived(info ? Math.min((info.systemUptimeSecs / (7 * 86400)) * 100, 100) : 0);
</script>

<div class="uptime-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x23F1;</span>
			<h3>System Uptime</h3>
		</div>
		<button class="icon-btn" class:active={showDetails} onclick={() => { showDetails = !showDetails; }} title="Details">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="16" x2="12" y2="12" />
				<line x1="12" y1="8" x2="12.01" y2="8" />
			</svg>
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{:else if info}
		<div class="uptime-cards">
			<div class="uptime-card">
				<span class="card-label">App Session</span>
				<span class="card-value" style="color: {getUptimeColor(info.appUptimeSecs)}">{info.appUptimeFormatted}</span>
				<div class="progress-bg">
					<div class="progress-fill" style="width: {appProgress}%; background: {getUptimeColor(info.appUptimeSecs)}"></div>
				</div>
				<span class="card-sub">of 24h</span>
			</div>

			<div class="uptime-card">
				<span class="card-label">System Uptime</span>
				<span class="card-value" style="color: {getUptimeColor(info.systemUptimeSecs)}">{info.systemUptimeFormatted}</span>
				<div class="progress-bg">
					<div class="progress-fill" style="width: {sysProgress}%; background: {getUptimeColor(info.systemUptimeSecs)}"></div>
				</div>
				<span class="card-sub">of 7d</span>
			</div>
		</div>

		{#if info.milestonesReached.length > 0}
			<div class="milestones">
				{#each info.milestonesReached as milestone}
					<span class="milestone-badge">&#x1F3C6; {milestone}</span>
				{/each}
			</div>
		{/if}

		{#if showDetails}
			<div class="details">
				<div class="detail-row">
					<span class="detail-label">App Started</span>
					<span class="detail-value">{formatDateTime(info.appStartedAt)}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">System Boot</span>
					<span class="detail-value">{formatDateTime(info.systemBootTime)}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">App Uptime (raw)</span>
					<span class="detail-value">{info.appUptimeSecs.toLocaleString()}s</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">System Uptime (raw)</span>
					<span class="detail-value">{info.systemUptimeSecs.toLocaleString()}s</span>
				</div>
			</div>
		{/if}
	{:else}
		<div class="loading">Loading uptime...</div>
	{/if}
</div>

<style>
	.uptime-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover, .icon-btn.active { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.error, .loading { text-align: center; font-size: 13px; color: var(--text-muted, #6d6f78); padding: 16px 0; }
	.error { color: #ed4245; }

	.uptime-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

	.uptime-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
	}

	.card-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.3px; }
	.card-value { font-size: 16px; font-weight: 700; font-family: monospace; }
	.card-sub { font-size: 10px; color: var(--text-muted, #6d6f78); }

	.progress-bg {
		width: 100%;
		height: 4px;
		background: rgba(255, 255, 255, 0.06);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }

	.milestones { display: flex; flex-wrap: wrap; gap: 6px; }
	.milestone-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		background: rgba(250, 166, 26, 0.12);
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		color: #faa61a;
	}

	.details { display: flex; flex-direction: column; gap: 6px; }
	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 12px;
	}
	.detail-label { color: var(--text-secondary, #949ba4); }
	.detail-value { font-family: monospace; font-size: 11px; }
</style>
