<script lang="ts">
	import { user, auth } from '$lib/stores/auth';
	import { gatewayState } from '$lib/gateway';
	import { settings } from '$lib/stores/settings';
	import { primaryActivity, isIdle } from '$lib/stores/activity';
	import ConnectionStatus from './ConnectionStatus.svelte';
	import UserActivity from './UserActivity.svelte';

	export let status: 'online' | 'idle' | 'dnd' | 'offline' = 'online';
	
	// Auto-update status based on idle detection
	$: effectiveStatus = $isIdle && status === 'online' ? 'idle' : status;

	let isMuted = false;
	let isDeafened = false;

	function toggleMute() {
		isMuted = !isMuted;
	}

	function toggleDeafen() {
		isDeafened = !isDeafened;
		if (isDeafened) isMuted = true;
	}

	function openSettings() {
		settings.open('account');
	}

	// Generate a discriminator from user ID (Discord-style 4 digits)
	function getDiscriminator(userId: string | undefined): string {
		if (!userId) return '0000';
		// Use last 4 characters of ID or hash to 4 digits
		const hash = userId.split('').reduce((acc, char) => {
			return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
		}, 0);
		return Math.abs(hash % 10000).toString().padStart(4, '0');
	}

	$: discriminator = getDiscriminator($user?.id);
	$: statusColor = {
		online: '#23a559',
		idle: '#f0b232',
		dnd: '#f23f43',
		offline: '#80848e'
	}[effectiveStatus];
</script>

<div class="user-panel">
	<button class="user-info" on:click={openSettings}>
		<div class="avatar">
			{#if $user?.avatar}
				<img src={$user.avatar} alt="" />
			{:else}
				<div class="avatar-placeholder">
					{($user?.username || '?')[0].toUpperCase()}
				</div>
			{/if}
			<div class="status-dot" style="background: {statusColor}"></div>
		</div>

		<div class="user-details">
			<span class="username">{$user?.display_name || $user?.username}</span>
			{#if $primaryActivity}
				<UserActivity localActivity={$primaryActivity} compact showTime={false} />
			{:else if $gatewayState === 'connected'}
				<span class="discriminator">#{discriminator}</span>
			{:else}
				<ConnectionStatus compact />
			{/if}
		</div>
	</button>

	<div class="controls">
		<button
			class="control-btn"
			class:active={isMuted}
			on:click={toggleMute}
			title={isMuted ? 'Unmute' : 'Mute'}
		>
			{#if isMuted}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
					<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
					<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
				</svg>
			{/if}
		</button>

		<button
			class="control-btn"
			class:active={isDeafened}
			on:click={toggleDeafen}
			title={isDeafened ? 'Undeafen' : 'Deafen'}
		>
			{#if isDeafened}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
					<rect x="6" y="12" width="4" height="8" rx="1"/>
					<rect x="14" y="12" width="4" height="8" rx="1"/>
					<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
					<rect x="6" y="12" width="4" height="8" rx="1"/>
					<rect x="14" y="12" width="4" height="8" rx="1"/>
				</svg>
			{/if}
		</button>

		<button class="control-btn" on:click={openSettings} title="User Settings">
			<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
				<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
			</svg>
		</button>
	</div>
</div>

<style>
	.user-panel {
		display: flex;
		align-items: center;
		padding: 0 8px;
		height: 52px;
		background: #232428;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		background: none;
		border: none;
		text-align: left;
	}

	.user-info:hover {
		background: rgba(79, 84, 92, 0.32);
	}

	.avatar {
		position: relative;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.avatar-placeholder {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--brand-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 600;
		font-size: 14px;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 3px solid #232428;
		box-sizing: content-box;
	}

	.user-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.username {
		font-size: 14px;
		font-weight: 600;
		color: #f2f3f5;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 18px;
	}

	.discriminator {
		font-size: 12px;
		color: #949ba4;
		line-height: 13px;
	}

	.controls {
		display: flex;
		gap: 0;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: none;
		border: none;
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
	}

	.control-btn:hover {
		background: rgba(79, 84, 92, 0.32);
		color: #dbdee1;
	}

	.control-btn.active {
		color: #dbdee1;
	}
</style>
