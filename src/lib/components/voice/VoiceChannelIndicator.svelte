<script lang="ts">
	import { voiceState, isInVoice, voiceChannel, currentVoiceUsers, voiceConnectionState } from '$lib/stores/voice';
	import type { VoiceUser } from '$lib/stores/voice';

	export let channelId: string = '';
	export let compact: boolean = false;

	$: isCurrentChannel = $voiceState.channelId === channelId;
	$: users = $currentVoiceUsers;
	$: connectionState = $voiceConnectionState;

	function getUserStatusIcon(user: VoiceUser): string {
		if (user.self_deafened) return 'deafened';
		if (user.self_muted) return 'muted';
		if (user.speaking) return 'speaking';
		return 'idle';
	}
</script>

{#if $isInVoice && isCurrentChannel}
	<div class="voice-indicator" class:compact role="status" aria-label="Voice channel state">
		{#if !compact}
			<div class="indicator-header">
				<div class="signal-icon" class:active={connectionState === 'connected'}>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
						<path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z"/>
					</svg>
				</div>
				<span class="channel-label">{$voiceChannel.name || 'Voice'}</span>
				{#if connectionState === 'reconnecting'}
					<span class="reconnecting-badge">Reconnecting</span>
				{/if}
			</div>
		{/if}

		<div class="user-list" class:compact>
			{#each users as user (user.id)}
				<div
					class="user-item"
					class:speaking={user.speaking}
					title="{user.display_name || user.username}{user.self_muted ? ' (muted)' : ''}{user.self_deafened ? ' (deafened)' : ''}"
				>
					{#if compact}
						<div class="avatar-dot" class:speaking={user.speaking} class:muted={user.self_muted}></div>
					{:else}
						<div class="user-avatar" class:speaking={user.speaking}>
							{#if user.avatar}
								<img src={user.avatar} alt="" class="avatar-img" />
							{:else}
								<div class="avatar-placeholder">
									{(user.display_name || user.username).charAt(0).toUpperCase()}
								</div>
							{/if}
						</div>
						<span class="username">{user.display_name || user.username}</span>
						{#if getUserStatusIcon(user) === 'muted'}
							<svg class="status-icon muted" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
								<path d="M19 11c0 1.19-.34 2.3-.9 3.28l-1.23-1.23c.27-.62.43-1.3.43-2.05H19zm-4-2V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.17l6 6V9zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
							</svg>
						{:else if getUserStatusIcon(user) === 'deafened'}
							<svg class="status-icon deafened" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
								<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4z"/>
							</svg>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.voice-indicator {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
	}

	.voice-indicator.compact {
		flex-direction: row;
		align-items: center;
		gap: 4px;
		padding: 4px;
	}

	.indicator-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-bottom: 4px;
	}

	.signal-icon {
		color: #949ba4;
		display: flex;
		align-items: center;
	}

	.signal-icon.active {
		color: #23a559;
	}

	.channel-label {
		font-size: 12px;
		font-weight: 600;
		color: #949ba4;
		text-transform: uppercase;
	}

	.reconnecting-badge {
		font-size: 10px;
		color: #faa61a;
		background: rgba(250, 166, 26, 0.1);
		padding: 1px 6px;
		border-radius: 3px;
	}

	.user-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.user-list.compact {
		flex-direction: row;
		gap: 4px;
	}

	.user-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background-color 0.1s ease;
	}

	.user-item:hover {
		background: rgba(79, 84, 92, 0.32);
	}

	.user-item.speaking {
		background: rgba(35, 165, 89, 0.1);
	}

	.avatar-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #949ba4;
		flex-shrink: 0;
	}

	.avatar-dot.speaking {
		background: #23a559;
		box-shadow: 0 0 4px rgba(35, 165, 89, 0.5);
	}

	.avatar-dot.muted {
		background: #f23f42;
	}

	.user-avatar {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		border: 2px solid transparent;
		transition: border-color 0.2s ease;
	}

	.user-avatar.speaking {
		border-color: #23a559;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #5865f2;
		color: white;
		font-size: 12px;
		font-weight: 600;
	}

	.username {
		font-size: 13px;
		color: #dbdee1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.status-icon {
		flex-shrink: 0;
	}

	.status-icon.muted {
		color: #f23f42;
	}

	.status-icon.deafened {
		color: #f23f42;
	}
</style>
