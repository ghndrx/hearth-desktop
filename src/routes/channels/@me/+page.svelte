<script lang="ts">
	import { user } from '$lib/stores/auth';
	import { api } from '$lib/api';
	
	let activeTab = 'online';
	let showAddFriend = false;
	let friendUsername = '';
	let addFriendError = '';
	let addFriendSuccess = '';
	let isSubmitting = false;
	let container: HTMLElement;
	
	function setTab(tab: string) {
		if (tab === 'add') {
			showAddFriend = true;
		} else {
			activeTab = tab;
			showAddFriend = false;
		}
		addFriendError = '';
		addFriendSuccess = '';
	}
	
	async function handleAddFriend() {
		if (!friendUsername.trim()) {
			addFriendError = 'Please enter a username';
			return;
		}
		
		isSubmitting = true;
		addFriendError = '';
		addFriendSuccess = '';
		
		try {
			await api.post('/users/@me/relationships', {
				username: friendUsername.trim()
			});
			addFriendSuccess = `Friend request sent to ${friendUsername}!`;
			friendUsername = '';
		} catch (err: any) {
			addFriendError = err.message || 'Failed to send friend request';
		} finally {
			isSubmitting = false;
		}
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isSubmitting) {
			handleAddFriend();
		}
	}
</script>

<svelte:head>
	<title>Friends | Hearth</title>
</svelte:head>

<!-- Header Row (Grid row 1) -->
<header class="friends-header">
	<span class="header-icon">👥</span>
	<span class="header-title">Friends</span>
	<div class="header-divider"></div>
	
	<nav class="header-tabs">
		<button 
			class="tab" 
			class:active={activeTab === 'online' && !showAddFriend}
			on:click={() => setTab('online')}
		>Online</button>
		<button 
			class="tab"
			class:active={activeTab === 'all' && !showAddFriend}
			on:click={() => setTab('all')}
		>All</button>
		<button 
			class="tab"
			class:active={activeTab === 'pending' && !showAddFriend}
			on:click={() => setTab('pending')}
		>Pending</button>
		<button 
			class="tab"
			class:active={activeTab === 'blocked' && !showAddFriend}
			on:click={() => setTab('blocked')}
		>Blocked</button>
		<button 
			class="tab tab-add"
			class:active={showAddFriend}
			on:click={() => setTab('add')}
		>Add Friend</button>
	</nav>
</header>

<!-- Content Row (Grid row 2) -->
<main class="friends-content" bind:this={container}>
	{#if showAddFriend}
		<div class="add-friend-panel">
			<h2>ADD FRIEND</h2>
			<p>You can add friends with their Hearth username.</p>
			
			<div class="input-wrapper" class:error={addFriendError} class:success={addFriendSuccess}>
				<input 
					type="text" 
					placeholder="Enter a username#0000"
					bind:value={friendUsername}
					on:keydown={handleKeydown}
					disabled={isSubmitting}
				/>
				<button 
					class="send-btn"
					on:click={handleAddFriend}
					disabled={isSubmitting || !friendUsername.trim()}
				>
					{isSubmitting ? 'Sending...' : 'Send Friend Request'}
				</button>
			</div>
			
			{#if addFriendError}
				<p class="msg-error">{addFriendError}</p>
			{/if}
			{#if addFriendSuccess}
				<p class="msg-success">{addFriendSuccess}</p>
			{/if}
		</div>
	{:else}
		<div class="empty-state">
			<img src="/images/friends-empty.svg" alt="Hearth flame" class="empty-illustration" />
			<h2>Your hearth awaits friends</h2>
			<p>Add friends by their username to start chatting.</p>
		</div>
	{/if}
</main>

<style>
	/* Header - First grid row */
	.friends-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 16px;
		height: 48px;
		background: #313338;
		border-bottom: 1px solid #3f4147;
		box-shadow: 0 1px 0 rgba(0,0,0,0.2);
	}
	
	.header-icon {
		font-size: 24px;
	}
	
	.header-title {
		font-weight: 600;
		color: #f2f3f5;
		font-size: 16px;
	}

	.header-divider {
		width: 1px;
		height: 24px;
		background: #3f4147;
		margin: 0 8px;
	}
	
	.header-tabs {
		display: flex;
		gap: 8px;
	}
	
	.tab {
		background: none;
		border: none;
		color: #949ba4;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: background 0.15s, color 0.15s;
	}
	
	.tab:hover {
		background: #393c41;
		color: #f2f3f5;
	}
	
	.tab.active {
		background: #43444b;
		color: #f2f3f5;
	}
	
	.tab-add {
		background: #23a559;
		color: white;
	}
	
	.tab-add:hover {
		background: #1a8f4a;
	}
	
	.tab-add.active {
		background: #1a8f4a;
	}
	
	/* Content - Second grid row */
	.friends-content {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px;
		overflow-y: auto;
		background: #313338;
	}
	
	.empty-state {
		text-align: center;
		max-width: 400px;
	}
	
	.empty-illustration {
		width: 200px;
		height: 200px;
		margin-bottom: 16px;
	}
	
	.empty-state h2 {
		font-size: 20px;
		color: #f2f3f5;
		margin: 0 0 8px 0;
	}
	
	.empty-state p {
		color: #949ba4;
		margin: 0;
	}
	
	/* Add Friend Panel */
	.add-friend-panel {
		width: 100%;
		max-width: 900px;
		align-self: flex-start;
	}
	
	.add-friend-panel h2 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: #f2f3f5;
		margin: 0 0 8px 0;
	}
	
	.add-friend-panel > p {
		color: #949ba4;
		font-size: 14px;
		margin: 0 0 16px 0;
	}
	
	.input-wrapper {
		display: flex;
		align-items: center;
		background: #1e1f22;
		border-radius: 8px;
		padding: 4px 4px 4px 12px;
		border: 1px solid transparent;
	}
	
	.input-wrapper:focus-within {
		border-color: #00a8fc;
	}
	
	.input-wrapper.error {
		border-color: #f23f43;
	}
	
	.input-wrapper.success {
		border-color: #23a559;
	}
	
	.input-wrapper input {
		flex: 1;
		background: none;
		border: none;
		color: #f2f3f5;
		font-size: 16px;
		padding: 12px 0;
		outline: none;
	}
	
	.input-wrapper input::placeholder {
		color: #949ba4;
	}
	
	.send-btn {
		background: #5865f2;
		color: white;
		border: none;
		border-radius: 4px;
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}
	
	.send-btn:hover:not(:disabled) {
		background: #4752c4;
	}
	
	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.msg-error {
		color: #f23f43;
		font-size: 14px;
		margin: 8px 0 0 0;
	}
	
	.msg-success {
		color: #23a559;
		font-size: 14px;
		margin: 8px 0 0 0;
	}
</style>
