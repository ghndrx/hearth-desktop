<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	interface StartupItem {
		name: string;
		path: string;
		enabled: boolean;
		source: string;
	}

	interface BootStats {
		items: StartupItem[];
		totalCount: number;
		enabledCount: number;
		lastBootTime: string | null;
		uptimeSeconds: number;
	}

	let stats = $state<BootStats | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let uptimeInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let liveUptime = $state<number>(0);

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) {
			return `${days}d ${hours}h ${mins}m`;
		}
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	async function scan() {
		loading = true;
		error = null;
		try {
			const result = await invoke<BootStats>('boot_scan');
			stats = result;
			liveUptime = result.uptimeSeconds;
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function refreshUptime() {
		try {
			const secs = await invoke<number>('boot_get_uptime');
			liveUptime = secs;
		} catch {
			// silently ignore
		}
	}

	function startUptimeTicker() {
		if (uptimeInterval) clearInterval(uptimeInterval);
		uptimeInterval = setInterval(() => {
			liveUptime += 1;
		}, 1000);
	}

	function stopUptimeTicker() {
		if (uptimeInterval) {
			clearInterval(uptimeInterval);
			uptimeInterval = null;
		}
	}

	$effect(() => {
		scan();
		startUptimeTicker();
		// Refresh real uptime every 60s to avoid drift
		const refresh = setInterval(refreshUptime, 60000);
		return () => {
			stopUptimeTicker();
			clearInterval(refresh);
		};
	});
</script>

<div class="boot-panel" class:compact>
	<div class="header">
		<span class="title">Startup Manager</span>
		<button class="scan-btn" onclick={scan} disabled={loading}>
			{loading ? 'Scanning...' : 'Rescan'}
		</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	<div class="boot-info">
		<div class="info-row">
			<span class="info-label">Uptime</span>
			<span class="info-value">{formatUptime(liveUptime)}</span>
		</div>
		{#if stats?.lastBootTime}
			<div class="info-row">
				<span class="info-label">Last Boot</span>
				<span class="info-value">{stats.lastBootTime}</span>
			</div>
		{/if}
		{#if stats}
			<div class="info-row">
				<span class="info-label">Startup Items</span>
				<span class="info-value">{stats.enabledCount} / {stats.totalCount} enabled</span>
			</div>
		{/if}
	</div>

	{#if stats && !compact}
		<div class="items-list">
			{#each stats.items as item}
				<div class="item-row" class:disabled={!item.enabled}>
					<div class="item-info">
						<span class="item-name">{item.name}</span>
						<span class="item-source" class:system={item.source === 'system'} class:user={item.source === 'user'}>
							{item.source}
						</span>
					</div>
					<div class="item-status">
						<span class="status-dot" class:enabled={item.enabled} class:off={!item.enabled}></span>
						<span class="status-text">{item.enabled ? 'On' : 'Off'}</span>
					</div>
				</div>
			{/each}
			{#if stats.items.length === 0}
				<div class="empty-msg">No startup items found</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.boot-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.boot-panel.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.scan-btn {
		background: none;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		color: var(--text-muted, #72767d);
		font-size: 11px;
		padding: 3px 10px;
		border-radius: 4px;
		cursor: pointer;
	}

	.scan-btn:hover:not(:disabled) {
		color: var(--text-primary, #dcddde);
		border-color: var(--text-muted, #72767d);
	}

	.scan-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.error-msg {
		font-size: 11px;
		color: var(--error, #ed4245);
		background: rgba(237, 66, 69, 0.1);
		padding: 6px 8px;
		border-radius: 4px;
	}

	.boot-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 6px;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.info-label {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.info-value {
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		font-weight: 500;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.items-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 240px;
		overflow-y: auto;
	}

	.item-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 4px;
		transition: opacity 0.15s ease;
	}

	.item-row.disabled {
		opacity: 0.5;
	}

	.item-info {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}

	.item-name {
		font-size: 12px;
		color: var(--text-primary, #dcddde);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-source {
		font-size: 9px;
		padding: 1px 5px;
		border-radius: 3px;
		font-weight: 600;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.item-source.system {
		background: rgba(88, 101, 242, 0.15);
		color: var(--accent, #5865f2);
	}

	.item-source.user {
		background: rgba(87, 242, 135, 0.15);
		color: var(--success, #57f287);
	}

	.item-status {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.enabled {
		background: var(--success, #57f287);
		box-shadow: 0 0 4px rgba(87, 242, 135, 0.4);
	}

	.status-dot.off {
		background: var(--text-muted, #72767d);
	}

	.status-text {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.empty-msg {
		text-align: center;
		font-size: 12px;
		color: var(--text-muted, #72767d);
		padding: 16px;
	}
</style>
