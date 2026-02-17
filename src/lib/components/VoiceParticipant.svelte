<script lang="ts">
	import type { VoiceUser } from '$lib/stores/voice';
	import Avatar from './Avatar.svelte';

	export let user: VoiceUser;
	export let showControls = false;
	export let isCurrentUser = false;

	$: isMuted = user.self_muted || user.muted;
	$: isDeafened = user.self_deafened || user.deafened;
	$: displayName = user.display_name || user.username;
</script>

<div class="voice-participant" class:speaking={user.speaking} class:muted={isMuted}>
	<div class="avatar-wrapper" class:speaking={user.speaking}>
		<Avatar
			src={user.avatar}
			username={user.username}
			size="sm"
			alt={displayName}
		/>
		{#if user.speaking}
			<div class="speaking-ring" aria-hidden="true"></div>
		{/if}
	</div>

	<div class="user-info">
		<span class="username" class:current-user={isCurrentUser}>
			{displayName}
			{#if isCurrentUser}
				<span class="you-badge">(you)</span>
			{/if}
		</span>
	</div>

	<div class="status-icons">
		{#if user.self_stream}
			<div class="status-icon streaming" title="Streaming">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8l7 4-7 4z"/>
				</svg>
			</div>
		{/if}

		{#if user.self_video}
			<div class="status-icon video" title="Camera On">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
				</svg>
			</div>
		{/if}

		{#if isDeafened}
			<div class="status-icon deafened" title="Deafened">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M12 4c3.87 0 7 3.13 7 7v2h-2.92L21 17.92V11c0-4.97-4.03-9-9-9-1.95 0-3.76.62-5.23 1.68l1.44 1.44C9.3 4.41 10.6 4 12 4zM2.71 2.71c-.39.39-.39 1.02 0 1.41l2.02 2.02C3.62 7.62 3 9.23 3 11v7c0 1.1.9 2 2 2h4v-8H5v-1c0-1.14.29-2.21.8-3.15l10.51 10.51c-.08.05-.17.1-.25.15-.69.46-1.69.21-2.02-.55-.23-.53-.75-.87-1.35-.87-.63 0-1.2.43-1.42 1.06-.36 1.04-1.32 1.74-2.42 1.81l1.3 1.3c1.08-.3 2.01-1.02 2.58-1.98.73.82 1.77 1.32 2.93 1.32 2.16 0 3.92-1.76 3.92-3.92v-.92l2.69 2.69c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.12 2.71c-.39-.39-1.02-.39-1.41 0z"/>
				</svg>
			</div>
		{:else if isMuted}
			<div class="status-icon muted" title="Muted">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
					<path d="M7.72 21.78c.39.39 1.02.39 1.41 0L12 18.91l2.87 2.87c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L13.41 17.5l2.87-2.87c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L12 16.09l-2.87-2.87c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l2.87 2.87-2.87 2.87c-.39.39-.39 1.02 0 1.41zM12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
				</svg>
			</div>
		{/if}
	</div>
</div>

<style>
	.voice-participant {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.voice-participant:hover {
		background: rgba(79, 84, 92, 0.16);
	}

	.voice-participant.speaking {
		background: rgba(35, 165, 89, 0.1);
	}

	.avatar-wrapper {
		position: relative;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.avatar-wrapper.speaking {
		box-shadow: 0 0 0 2px #23a559;
	}

	.speaking-ring {
		position: absolute;
		inset: -3px;
		border: 2px solid #23a559;
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.username {
		display: block;
		font-size: 13px;
		font-weight: 500;
		color: #949ba4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.voice-participant:hover .username {
		color: #dbdee1;
	}

	.voice-participant.speaking .username {
		color: #23a559;
	}

	.username.current-user {
		color: #dbdee1;
	}

	.you-badge {
		font-weight: 400;
		font-size: 11px;
		color: #6d6f78;
	}

	.status-icons {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #949ba4;
	}

	.status-icon.muted,
	.status-icon.deafened {
		color: #f23f42;
	}

	.status-icon.streaming {
		color: #9b59b6;
	}

	.status-icon.video {
		color: #43b581;
	}
</style>
