<script lang="ts">
	import type { Channel } from '$lib/stores/app';
	import Avatar from './Avatar.svelte';

	interface ConnectedUser {
		id: string;
		username: string;
		avatar: string | null;
		speaking?: boolean;
	}

	interface Props {
		channel: Channel;
		active?: boolean;
		muted?: boolean;
		unread?: boolean;
		connectedUsers?: ConnectedUser[];
		onSelect?: (channel: Channel) => void;
		onOpenSettings?: (channel: Channel) => void;
	}

	let {
		channel,
		active = false,
		muted = false,
		unread = false,
		connectedUsers = [],
		onSelect,
		onOpenSettings
	}: Props = $props();

	let isText = $derived(channel.type === 'text');
	let isVoice = $derived(channel.type === 'voice');

	let showSettings = $state(false);

	function handleSelect() {
		onSelect?.(channel);
	}

	function handleSettingsClick(e: MouseEvent) {
		e.stopPropagation();
		onOpenSettings?.(channel);
	}
</script>

<div class="channel-item-wrapper">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="channel-item"
		class:active
		class:muted
		class:unread
		class:voice={isVoice}
		onclick={handleSelect}
		onmouseenter={() => (showSettings = true)}
		onmouseleave={() => (showSettings = false)}
		role="button"
		tabindex="0"
	>
		<div class="channel-icon">
			{#if isVoice}
				<!-- Speaker icon for voice channels -->
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path
						d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904Z"
					/>
					<path d="M14 9C14 9 16 10.5 16 12C16 13.5 14 15 14 15" />
					<path d="M17.7 6.3C17.7 6.3 21 9.5 21 12C21 14.5 17.7 17.7 17.7 17.7" />
				</svg>
			{:else}
				<!-- Hash icon for text channels -->
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path
						d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z"
					/>
				</svg>
			{/if}
		</div>

		<span class="channel-name">{channel.name}</span>

		{#if showSettings || active}
			<button class="settings-button" title="Edit Channel" onclick={handleSettingsClick}>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
					<path
						d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
					/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Connected users for voice channels -->
	{#if isVoice && connectedUsers.length > 0}
		<div class="connected-users">
			{#each connectedUsers as user (user.id)}
				<div class="connected-user" class:speaking={user.speaking}>
					<Avatar src={user.avatar} username={user.username} size="xs" alt={user.username} />
					<span class="user-name">{user.username}</span>
					{#if user.speaking}
						<div class="speaking-indicator">
							<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
								<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
								<path
									d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
								/>
							</svg>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.channel-item-wrapper {
		display: flex;
		flex-direction: column;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		margin: 1px 8px;
		border-radius: 4px;
		background: none;
		border: none;
		color: #949ba4;
		font-size: 16px;
		cursor: pointer;
		width: calc(100% - 16px);
		text-align: left;
		transition:
			background-color 0.1s ease,
			color 0.1s ease;
	}

	.channel-item:hover {
		background: #35373c;
		color: #dbdee1;
	}

	.channel-item.active {
		background: #404249;
		color: #ffffff;
	}

	.channel-item.muted {
		color: #6d6f78;
	}

	.channel-item.unread {
		color: #f2f3f5;
	}

	.channel-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		color: inherit;
	}

	.channel-icon svg {
		color: inherit;
		fill: currentColor;
	}

	.channel-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.settings-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background: none;
		border: none;
		color: #949ba4;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		transition:
			opacity 0.1s ease,
			color 0.1s ease;
	}

	.channel-item:hover .settings-button,
	.channel-item.active .settings-button {
		opacity: 1;
	}

	.settings-button:hover {
		color: #dbdee1;
	}

	/* Connected users for voice channels */
	.connected-users {
		display: flex;
		flex-direction: column;
		margin-left: 32px;
		padding: 2px 8px 2px 8px;
	}

	.connected-user {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	.connected-user:hover {
		background: rgba(79, 84, 92, 0.16);
	}

	.connected-user.speaking {
		background: rgba(35, 165, 89, 0.1);
	}

	.connected-user.speaking :global(.avatar-wrapper) {
		box-shadow: 0 0 0 2px #23a559;
		border-radius: 50%;
	}

	.user-name {
		font-size: 13px;
		color: #949ba4;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.connected-user:hover .user-name {
		color: #dbdee1;
	}

	.speaking-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #23a559;
	}
</style>
