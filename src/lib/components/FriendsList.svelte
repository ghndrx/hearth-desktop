<script lang="ts">
	import { onMount } from 'svelte';
	import {
		friendsStore,
		friends,
		onlineFriends,
		pendingIncoming,
		pendingOutgoing,
		blocked,
		pendingCount,
		type Relationship
	} from '$lib/stores/friends';
	import Avatar from './Avatar.svelte';
	import Button from './Button.svelte';

	type TabType = 'online' | 'all' | 'pending' | 'blocked' | 'add';
	let activeTab: TabType = 'online';
	let addFriendInput = '';
	let addFriendStatus: 'idle' | 'sending' | 'success' | 'error' = 'idle';

	$: currentList = getListForTab(activeTab, $friends, $onlineFriends, $pendingIncoming, $pendingOutgoing, $blocked);
	$: pendingTotal = $pendingIncoming.length + $pendingOutgoing.length;

	function getListForTab(
		tab: TabType,
		friendsList: Relationship[],
		onlineList: Relationship[],
		incomingList: Relationship[],
		outgoingList: Relationship[],
		blockedList: Relationship[]
	): Relationship[] {
		switch (tab) {
			case 'online':
				return onlineList;
			case 'all':
				return friendsList;
			case 'pending':
				return [...incomingList, ...outgoingList];
			case 'blocked':
				return blockedList;
			default:
				return [];
		}
	}

	onMount(() => {
		friendsStore.loadRelationships();
	});

	async function handleAccept(userId: string) {
		await friendsStore.acceptRequest(userId);
	}

	async function handleDecline(userId: string) {
		await friendsStore.declineRequest(userId);
	}

	async function handleRemove(relationshipId: string) {
		await friendsStore.removeFriend(relationshipId);
	}

	async function handleAddFriend() {
		if (!addFriendInput.trim()) return;
		
		addFriendStatus = 'sending';
		const success = await friendsStore.sendFriendRequest(addFriendInput.trim());
		addFriendStatus = success ? 'success' : 'error';
		
		if (success) {
			addFriendInput = '';
			setTimeout(() => {
				addFriendStatus = 'idle';
			}, 3000);
		}
	}

	function getStatusColor(status?: string): string {
		switch (status) {
			case 'online':
				return 'bg-green-500';
			case 'idle':
				return 'bg-yellow-500';
			case 'dnd':
				return 'bg-red-500';
			default:
				return 'bg-gray-500';
		}
	}

	function isIncoming(rel: Relationship): boolean {
		return rel.type === 3; // PENDING_INCOMING
	}

	function isOutgoing(rel: Relationship): boolean {
		return rel.type === 4; // PENDING_OUTGOING
	}
</script>

<div class="friends-list">
	<!-- Header with tabs -->
	<div class="friends-header">
		<div class="friends-icon">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
			</svg>
			<span>Friends</span>
		</div>

		<div class="tab-divider"></div>

		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'online'}
				on:click={() => (activeTab = 'online')}
			>
				Online
			</button>
			<button
				class="tab"
				class:active={activeTab === 'all'}
				on:click={() => (activeTab = 'all')}
			>
				All
			</button>
			<button
				class="tab"
				class:active={activeTab === 'pending'}
				on:click={() => (activeTab = 'pending')}
			>
				Pending
				{#if pendingTotal > 0}
					<span class="badge">{pendingTotal}</span>
				{/if}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'blocked'}
				on:click={() => (activeTab = 'blocked')}
			>
				Blocked
			</button>
			<button
				class="tab add-friend"
				class:active={activeTab === 'add'}
				on:click={() => (activeTab = 'add')}
			>
				Add Friend
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="friends-content">
		{#if activeTab === 'add'}
			<div class="add-friend-section">
				<h2>Add Friend</h2>
				<p class="add-friend-description">
					You can add friends with their Hearth username.
				</p>
				<div class="add-friend-input-wrapper" class:success={addFriendStatus === 'success'} class:error={addFriendStatus === 'error'}>
					<input
						type="text"
						bind:value={addFriendInput}
						placeholder="Enter a Username#0000"
						on:keydown={(e) => e.key === 'Enter' && handleAddFriend()}
						disabled={addFriendStatus === 'sending'}
					/>
					<Button
						variant="primary"
						disabled={!addFriendInput.trim() || addFriendStatus === 'sending'}
						on:click={handleAddFriend}
					>
						{addFriendStatus === 'sending' ? 'Sending...' : 'Send Friend Request'}
					</Button>
				</div>
				{#if addFriendStatus === 'success'}
					<p class="status-message success">Friend request sent successfully!</p>
				{:else if addFriendStatus === 'error'}
					<p class="status-message error">{$friendsStore.error || 'Failed to send friend request'}</p>
				{/if}
			</div>
		{:else if $friendsStore.loading}
			<div class="loading">
				<div class="spinner"></div>
				<span>Loading friends...</span>
			</div>
		{:else if currentList.length === 0}
			<div class="empty-state">
				{#if activeTab === 'online'}
					<div class="empty-illustration">👋</div>
					<p>No friends online right now</p>
				{:else if activeTab === 'all'}
					<div class="empty-illustration">🤝</div>
					<p>You don't have any friends yet</p>
					<Button variant="primary" on:click={() => (activeTab = 'add')}>Add Friend</Button>
				{:else if activeTab === 'pending'}
					<div class="empty-illustration">📬</div>
					<p>No pending friend requests</p>
				{:else if activeTab === 'blocked'}
					<div class="empty-illustration">🚫</div>
					<p>You haven't blocked anyone</p>
				{/if}
			</div>
		{:else}
			<div class="friend-count">
				{activeTab.toUpperCase()} — {currentList.length}
			</div>
			<ul class="friend-list">
				{#each currentList as relationship (relationship.id)}
					<li class="friend-item">
						<div class="friend-info">
							<div class="avatar-wrapper">
								<Avatar
									src={relationship.user.avatar_url}
									alt={relationship.user.username}
									size="md"
								/>
								{#if activeTab !== 'pending' && activeTab !== 'blocked'}
									<span class="status-dot {getStatusColor(relationship.user.status)}"></span>
								{/if}
							</div>
							<div class="friend-details">
								<span class="username">
									{relationship.user.username}
									<span class="discriminator">#{relationship.user.discriminator}</span>
								</span>
								{#if activeTab === 'pending'}
									<span class="pending-type">
										{isIncoming(relationship) ? 'Incoming Friend Request' : 'Outgoing Friend Request'}
									</span>
								{:else if activeTab !== 'blocked'}
									<span class="status-text">
										{relationship.user.status || 'Offline'}
									</span>
								{/if}
							</div>
						</div>
						<div class="friend-actions">
							{#if isIncoming(relationship)}
								<button
									class="action-btn accept"
									title="Accept"
									on:click={() => handleAccept(relationship.user.id)}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
									</svg>
								</button>
								<button
									class="action-btn decline"
									title="Decline"
									on:click={() => handleDecline(relationship.user.id)}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
									</svg>
								</button>
							{:else if isOutgoing(relationship)}
								<button
									class="action-btn cancel"
									title="Cancel Request"
									on:click={() => handleRemove(relationship.id)}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
									</svg>
								</button>
							{:else if activeTab === 'blocked'}
								<button
									class="action-btn unblock"
									title="Unblock"
									on:click={() => handleRemove(relationship.id)}
								>
									Unblock
								</button>
							{:else}
								<button class="action-btn message" title="Message">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
									</svg>
								</button>
								<button
									class="action-btn more"
									title="More"
									on:click={() => handleRemove(relationship.id)}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
									</svg>
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.friends-list {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--background-primary, #36393f);
	}

	.friends-header {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
		gap: 16px;
	}

	.friends-icon {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--header-primary, #fff);
		font-weight: 600;
	}

	.tab-divider {
		width: 1px;
		height: 24px;
		background-color: var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.tabs {
		display: flex;
		gap: 8px;
	}

	.tab {
		padding: 4px 8px;
		border-radius: 4px;
		background: none;
		border: none;
		color: var(--interactive-normal, #b9bbbe);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
	}

	.tab:hover {
		background-color: var(--background-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--interactive-hover, #dcddde);
	}

	.tab.active {
		background-color: var(--background-modifier-selected, rgba(79, 84, 92, 0.32));
		color: var(--interactive-active, #fff);
	}

	.tab.add-friend {
		background-color: var(--button-positive-background, #3ba55c);
		color: #fff;
	}

	.tab.add-friend:hover {
		background-color: var(--button-positive-background-hover, #2d7d46);
	}

	.tab.add-friend.active {
		background-color: transparent;
		color: #3ba55c;
	}

	.badge {
		margin-left: 4px;
		padding: 0 5px;
		background-color: var(--status-danger, #ed4245);
		color: #fff;
		font-size: 12px;
		border-radius: 8px;
	}

	.friends-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.add-friend-section {
		padding: 20px;
	}

	.add-friend-section h2 {
		color: var(--header-primary, #fff);
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.add-friend-description {
		color: var(--header-secondary, #b9bbbe);
		font-size: 14px;
		margin-bottom: 16px;
	}

	.add-friend-input-wrapper {
		display: flex;
		gap: 8px;
		padding: 8px;
		background-color: var(--background-tertiary, #202225);
		border-radius: 8px;
		border: 1px solid transparent;
	}

	.add-friend-input-wrapper.success {
		border-color: var(--button-positive-background, #3ba55c);
	}

	.add-friend-input-wrapper.error {
		border-color: var(--status-danger, #ed4245);
	}

	.add-friend-input-wrapper input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #dcddde);
		font-size: 14px;
		outline: none;
	}

	.add-friend-input-wrapper input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.status-message {
		margin-top: 8px;
		font-size: 14px;
	}

	.status-message.success {
		color: var(--button-positive-background, #3ba55c);
	}

	.status-message.error {
		color: var(--status-danger, #ed4245);
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: var(--text-muted, #72767d);
		gap: 12px;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
		border-top-color: var(--brand-experiment, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		text-align: center;
		color: var(--text-muted, #72767d);
	}

	.empty-illustration {
		font-size: 64px;
		margin-bottom: 16px;
	}

	.empty-state p {
		margin-bottom: 16px;
	}

	.friend-count {
		color: var(--channels-default, #8e9297);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		margin-bottom: 8px;
		padding: 0 8px;
	}

	.friend-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.friend-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.15s;
		border-top: 1px solid var(--background-modifier-accent, rgba(79, 84, 92, 0.48));
	}

	.friend-item:first-child {
		border-top: none;
	}

	.friend-item:hover {
		background-color: var(--background-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.friend-info {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar-wrapper {
		position: relative;
	}

	.status-dot {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 3px solid var(--background-primary, #36393f);
	}

	.friend-details {
		display: flex;
		flex-direction: column;
	}

	.username {
		color: var(--header-primary, #fff);
		font-weight: 600;
	}

	.discriminator {
		color: var(--header-secondary, #b9bbbe);
		font-weight: 400;
	}

	.status-text,
	.pending-type {
		color: var(--header-secondary, #b9bbbe);
		font-size: 12px;
	}

	.friend-actions {
		display: flex;
		gap: 8px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.friend-item:hover .friend-actions {
		opacity: 1;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background-color: var(--background-secondary, #2f3136);
		color: var(--interactive-normal, #b9bbbe);
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
	}

	.action-btn:hover {
		background-color: var(--background-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--interactive-hover, #dcddde);
	}

	.action-btn.accept:hover {
		color: var(--button-positive-background, #3ba55c);
	}

	.action-btn.decline:hover,
	.action-btn.cancel:hover {
		color: var(--status-danger, #ed4245);
	}

	.action-btn.unblock {
		width: auto;
		padding: 0 12px;
		border-radius: 4px;
		font-size: 14px;
	}

	/* Custom scrollbar */
	.friends-content::-webkit-scrollbar {
		width: 8px;
	}

	.friends-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.friends-content::-webkit-scrollbar-thumb {
		background-color: var(--background-tertiary, #202225);
		border-radius: 4px;
	}
</style>
