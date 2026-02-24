<script lang="ts">
	import type { TopChannelStat } from '$lib/types';

	export let data: TopChannelStat[] = [];
	export let onChannelClick: ((channelId: string) => void) | undefined = undefined;

	// Get channel type icon
	function getChannelIcon(type: string): string {
		switch (type) {
			case 'voice':
				return '🔊';
			case 'announcement':
				return '📢';
			case 'forum':
				return '💬';
			default:
				return '#';
		}
	}

	// Format relative time
	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'No activity';
		
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Calculate max for progress bar scaling
	$: maxMessages = Math.max(...data.map(d => d.message_count), 1);

	// Total messages across all channels
	$: totalMessages = data.reduce((sum, d) => sum + d.message_count, 0);
</script>

<div class="channels-container">
	<div class="channels-header">
		<h3>Top Channels</h3>
		<div class="stats">
			<span class="total">{totalMessages.toLocaleString()} messages</span>
		</div>
	</div>

	{#if data.length === 0}
		<div class="empty-state">
			<p>No channel activity in this period</p>
		</div>
	{:else}
		<div class="channels-list">
			{#each data as channel, index}
				<button 
					class="channel-item"
					class:clickable={!!onChannelClick}
					on:click={() => onChannelClick?.(channel.channel_id)}
					disabled={!onChannelClick}
				>
					<div class="channel-rank">{index + 1}</div>
					<div class="channel-info">
						<div class="channel-name">
							<span class="channel-icon">{getChannelIcon(channel.channel_type)}</span>
							<span class="name">{channel.channel_name}</span>
						</div>
						<div class="channel-meta">
							<span class="authors">{channel.unique_authors} contributors</span>
							<span class="dot">·</span>
							<span class="last-activity">{formatRelativeTime(channel.last_activity)}</span>
						</div>
					</div>
					<div class="channel-stats">
						<span class="message-count">{channel.message_count.toLocaleString()}</span>
						<div class="progress-bar">
							<div 
								class="progress-fill"
								style="width: {(channel.message_count / maxMessages) * 100}%"
							></div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.channels-container {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.channels-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.total {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.channels-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: transparent;
		border: none;
		border-radius: 6px;
		cursor: default;
		transition: background-color 0.15s ease;
		text-align: left;
		width: 100%;
	}

	.channel-item.clickable {
		cursor: pointer;
	}

	.channel-item.clickable:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.channel-rank {
		width: 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted, #b5bac1);
		text-align: center;
		flex-shrink: 0;
	}

	.channel-info {
		flex: 1;
		min-width: 0;
	}

	.channel-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
	}

	.channel-icon {
		flex-shrink: 0;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.channel-meta {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--text-muted, #b5bac1);
		margin-top: 2px;
	}

	.dot {
		opacity: 0.5;
	}

	.channel-stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
		min-width: 80px;
	}

	.message-count {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.progress-bar {
		width: 60px;
		height: 4px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #5865f2;
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.empty-state {
		text-align: center;
		padding: 32px 16px;
		color: var(--text-muted, #b5bac1);
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}
</style>
