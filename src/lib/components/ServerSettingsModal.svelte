<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { currentServer, updateServer, updateServerIcon, removeServerIcon, deleteServer } from '$lib/stores/servers';
	import { serverChannels, createChannel, updateChannel, deleteChannel, type Channel } from '$lib/stores/channels';
	import { user } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import Avatar from './Avatar.svelte';
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';
	import MemberRolesModal from './MemberRolesModal.svelte';
	import MemberBanModal from './MemberBanModal.svelte';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	type TabId = 'overview' | 'roles' | 'channels' | 'members' | 'invites';
	
	let activeTab: TabId = 'overview';
	let saving = false;
	let uploadingIcon = false;
	let iconInput: HTMLInputElement;

	// Server form data
	let serverForm = {
		name: '',
		description: ''
	};

	// Members data
	interface Member {
		id: string;
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		nickname: string | null;
		roles: string[];
		joined_at: string;
	}

	let members: Member[] = [];
	let membersLoading = false;
	let membersError: string | null = null;

	// Roles data
	interface Role {
		id: string;
		name: string;
		color: string;
		position: number;
		permissions: number;
		hoist: boolean;
		mentionable: boolean;
	}

	let roles: Role[] = [];
	let rolesLoading = false;
	let rolesError: string | null = null;

	// Member modal state
	let showMemberRolesModal = false;
	let showMemberBanModal = false;
	let selectedMember: Member | null = null;

	// Invites data
	interface Invite {
		code: string;
		channel_id: string;
		inviter?: {
			id: string;
			username: string;
		};
		uses: number;
		max_uses: number;
		expires_at: string | null;
		created_at: string;
	}

	let invites: Invite[] = [];
	let invitesLoading = false;
	let invitesError: string | null = null;

	// Channel editing
	let showCreateChannelModal = false;
	let editingChannel: Channel | null = null;
	let newChannel: { name: string; type: 'text' | 'voice' | 'announcement' } = { name: '', type: 'text' };
	let channelForm = { name: '', topic: '', slowmode: 0, nsfw: false };

	const tabs: { id: TabId; label: string; icon: string }[] = [
		{ id: 'overview', label: 'Overview', icon: '⚙️' },
		{ id: 'roles', label: 'Roles', icon: '🛡️' },
		{ id: 'channels', label: 'Channels', icon: '#' },
		{ id: 'members', label: 'Members', icon: '👥' },
		{ id: 'invites', label: 'Invites', icon: '🔗' }
	];

	$: isOwner = $currentServer?.owner_id === $user?.id;

	$: if (open && $currentServer) {
		serverForm = {
			name: $currentServer.name || '',
			description: $currentServer.description || ''
		};
	}

	$: textChannels = $serverChannels.filter(c => c.type === 0);
	$: voiceChannels = $serverChannels.filter(c => c.type === 2);

	// Load data when tab changes
	$: if (open && activeTab === 'members' && $currentServer) {
		loadMembers();
	}

	$: if (open && activeTab === 'roles' && $currentServer) {
		loadRoles();
	}

	$: if (open && activeTab === 'invites' && $currentServer) {
		loadInvites();
	}

	async function loadMembers() {
		if (!$currentServer || membersLoading) return;
		membersLoading = true;
		membersError = null;
		try {
			members = await api.get<Member[]>(`/servers/${$currentServer.id}/members`);
		} catch (err) {
			console.error('Failed to load members:', err);
			membersError = 'Failed to load members';
		} finally {
			membersLoading = false;
		}
	}

	async function loadRoles() {
		if (!$currentServer || rolesLoading) return;
		rolesLoading = true;
		rolesError = null;
		try {
			roles = await api.get<Role[]>(`/servers/${$currentServer.id}/roles`);
		} catch (err) {
			console.error('Failed to load roles:', err);
			rolesError = 'Failed to load roles';
		} finally {
			rolesLoading = false;
		}
	}

	async function loadInvites() {
		if (!$currentServer || invitesLoading) return;
		invitesLoading = true;
		invitesError = null;
		try {
			invites = await api.get<Invite[]>(`/servers/${$currentServer.id}/invites`);
		} catch (err) {
			console.error('Failed to load invites:', err);
			invitesError = 'Failed to load invites';
		} finally {
			invitesLoading = false;
		}
	}

	function close() {
		open = false;
		activeTab = 'overview';
		showCreateChannelModal = false;
		editingChannel = null;
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			if (showCreateChannelModal) {
				showCreateChannelModal = false;
			} else if (editingChannel) {
				editingChannel = null;
			} else {
				close();
			}
		}
	}

	async function saveOverview() {
		if (!$currentServer || saving) return;
		saving = true;
		try {
			await updateServer($currentServer.id, {
				name: serverForm.name,
				description: serverForm.description || undefined
			});
		} catch (error) {
			console.error('Failed to save server settings:', error);
		} finally {
			saving = false;
		}
	}

	async function handleIconUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !$currentServer) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}

		if (file.size > 8 * 1024 * 1024) {
			alert('Image must be less than 8MB.');
			return;
		}

		uploadingIcon = true;
		try {
			await updateServerIcon($currentServer.id, file);
		} catch (error) {
			console.error('Failed to upload icon:', error);
			alert('Failed to upload icon. Please try again.');
		} finally {
			uploadingIcon = false;
			input.value = '';
		}
	}

	async function handleRemoveIcon() {
		if (!$currentServer) return;
		uploadingIcon = true;
		try {
			await removeServerIcon($currentServer.id);
		} catch (error) {
			console.error('Failed to remove icon:', error);
		} finally {
			uploadingIcon = false;
		}
	}

	async function handleCreateChannel() {
		if (!$currentServer || !newChannel.name.trim()) return;
		try {
			await createChannel($currentServer.id, { name: newChannel.name.trim(), type: newChannel.type });
			newChannel = { name: '', type: 'text' };
			showCreateChannelModal = false;
		} catch (error) {
			console.error('Failed to create channel:', error);
		}
	}

	function startEditChannel(channel: Channel) {
		editingChannel = channel;
		channelForm = {
			name: channel.name,
			topic: channel.topic || '',
			slowmode: channel.slowmode,
			nsfw: channel.nsfw
		};
	}

	async function saveChannelEdits() {
		if (!editingChannel) return;
		try {
			await updateChannel(editingChannel.id, {
				name: channelForm.name,
				topic: channelForm.topic || null,
				slowmode: channelForm.slowmode,
				nsfw: channelForm.nsfw
			});
			editingChannel = null;
		} catch (error) {
			console.error('Failed to update channel:', error);
		}
	}

	async function handleDeleteChannel(channel: Channel) {
		if (!confirm(`Are you sure you want to delete #${channel.name}? This cannot be undone.`)) return;
		try {
			await deleteChannel(channel.id);
		} catch (error) {
			console.error('Failed to delete channel:', error);
		}
	}

	async function handleKickMember(member: Member) {
		if (!$currentServer) return;
		if (!confirm(`Kick ${member.user.username} from the server?`)) return;
		try {
			await api.delete(`/servers/${$currentServer.id}/members/${member.user.id}`);
			members = members.filter(m => m.id !== member.id);
		} catch (error) {
			console.error('Failed to kick member:', error);
		}
	}

	function openMemberRoles(member: Member) {
		selectedMember = member;
		showMemberRolesModal = true;
	}

	function openBanModal(member: Member) {
		selectedMember = member;
		showMemberBanModal = true;
	}

	function handleMemberBanned(event: CustomEvent<{ userId: string }>) {
		// Remove banned member from list
		members = members.filter(m => m.user.id !== event.detail.userId);
		showMemberBanModal = false;
		selectedMember = null;
	}

	function handleRolesSaved(event: CustomEvent<{ userId: string; roles: string[] }>) {
		// Update member's roles in the list
		members = members.map(m => 
			m.user.id === event.detail.userId 
				? { ...m, roles: event.detail.roles }
				: m
		);
		showMemberRolesModal = false;
		selectedMember = null;
	}

	async function handleDeleteInvite(invite: Invite) {
		if (!confirm('Delete this invite?')) return;
		try {
			await api.delete(`/invites/${invite.code}`);
			invites = invites.filter(i => i.code !== invite.code);
		} catch (error) {
			console.error('Failed to delete invite:', error);
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString();
	}

	function formatExpiry(expiresAt: string | null): string {
		if (!expiresAt) return 'Never';
		const date = new Date(expiresAt);
		if (date < new Date()) return 'Expired';
		return date.toLocaleDateString();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && $currentServer}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		on:click|self={close}
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<div
			class="settings-modal"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<!-- Header -->
			<div class="modal-header">
				<h2 id="settings-title">Server Settings</h2>
				<button class="close-btn" on:click={close} aria-label="Close settings">
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/>
					</svg>
				</button>
			</div>

			<!-- Tabs -->
			<div class="tabs" role="tablist">
				{#each tabs as tab}
					<button
						class="tab"
						class:active={activeTab === tab.id}
						on:click={() => activeTab = tab.id}
						role="tab"
						aria-selected={activeTab === tab.id}
						aria-controls="panel-{tab.id}"
					>
						<span class="tab-icon">{tab.icon}</span>
						<span class="tab-label">{tab.label}</span>
					</button>
				{/each}
			</div>

			<!-- Content -->
			<div class="modal-content">
				{#if activeTab === 'overview'}
					<div class="tab-panel" role="tabpanel" id="panel-overview">
						<div class="overview-layout">
							<div class="icon-section">
								<div class="server-icon-preview">
									{#if $currentServer.icon}
										<img src={$currentServer.icon} alt={$currentServer.name} />
									{:else}
										<span class="icon-placeholder">
											{$currentServer.name.charAt(0).toUpperCase()}
										</span>
									{/if}
								</div>
								<input
									type="file"
									accept="image/*"
									bind:this={iconInput}
									on:change={handleIconUpload}
									style="display: none; position: absolute; visibility: hidden;"
								/>
								<div class="icon-actions">
									<Button
										variant="secondary"
										size="sm"
										disabled={!isOwner || uploadingIcon}
										on:click={() => iconInput?.click()}
									>
										{uploadingIcon ? 'Uploading...' : 'Upload'}
									</Button>
									{#if $currentServer.icon}
										<Button
											variant="secondary"
											size="sm"
											disabled={!isOwner || uploadingIcon}
											on:click={handleRemoveIcon}
										>
											Remove
										</Button>
									{/if}
								</div>
							</div>

							<div class="form-section">
								<div class="form-field">
									<label for="server-name">Server Name</label>
									<input
										type="text"
										id="server-name"
										bind:value={serverForm.name}
										maxlength={100}
										disabled={!isOwner}
									/>
								</div>

								<div class="form-field">
									<label for="server-description">Description</label>
									<textarea
										id="server-description"
										bind:value={serverForm.description}
										placeholder="What's this server about?"
										maxlength={1024}
										rows={3}
										disabled={!isOwner}
									></textarea>
								</div>

								{#if isOwner}
									<Button
										variant="primary"
										on:click={saveOverview}
										disabled={saving || !serverForm.name.trim()}
									>
										{saving ? 'Saving...' : 'Save Changes'}
									</Button>
								{/if}
							</div>
						</div>
					</div>

				{:else if activeTab === 'roles'}
					<div class="tab-panel" role="tabpanel" id="panel-roles">
						<div class="panel-header">
							<h3>Roles</h3>
							{#if isOwner}
								<Button variant="primary" size="sm">Create Role</Button>
							{/if}
						</div>

						{#if rolesLoading}
							<div class="loading">Loading roles...</div>
						{:else if rolesError}
							<div class="error">{rolesError}</div>
						{:else if roles.length === 0}
							<div class="empty-state">
								<span class="empty-icon">🛡️</span>
								<p>No roles yet</p>
							</div>
						{:else}
							<div class="roles-list">
								{#each roles.sort((a, b) => b.position - a.position) as role}
									<div class="role-item">
										<span
											class="role-color"
											style="background-color: {role.color || '#99aab5'}"
										></span>
										<span class="role-name">{role.name}</span>
										<span class="role-members">{role.hoist ? 'Hoisted' : ''}</span>
										{#if isOwner && role.name !== '@everyone'}
											<button class="action-btn" title="Edit role">✏️</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'channels'}
					<div class="tab-panel" role="tabpanel" id="panel-channels">
						<div class="panel-header">
							<h3>Channels</h3>
							{#if isOwner}
								<Button variant="primary" size="sm" on:click={() => showCreateChannelModal = true}>
									Create Channel
								</Button>
							{/if}
						</div>

						<div class="channels-section">
							<h4>Text Channels</h4>
							{#if textChannels.length === 0}
								<p class="no-items">No text channels</p>
							{:else}
								<div class="channel-list">
									{#each textChannels as channel}
										<div class="channel-item">
											<span class="channel-icon">#</span>
											<span class="channel-name">{channel.name}</span>
											{#if channel.nsfw}
												<span class="badge nsfw">NSFW</span>
											{/if}
											{#if isOwner}
												<div class="channel-actions">
													<button class="action-btn" on:click={() => startEditChannel(channel)} title="Edit">✏️</button>
													<button class="action-btn danger" on:click={() => handleDeleteChannel(channel)} title="Delete">🗑️</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div class="channels-section">
							<h4>Voice Channels</h4>
							{#if voiceChannels.length === 0}
								<p class="no-items">No voice channels</p>
							{:else}
								<div class="channel-list">
									{#each voiceChannels as channel}
										<div class="channel-item">
											<span class="channel-icon">🔊</span>
											<span class="channel-name">{channel.name}</span>
											{#if isOwner}
												<div class="channel-actions">
													<button class="action-btn" on:click={() => startEditChannel(channel)} title="Edit">✏️</button>
													<button class="action-btn danger" on:click={() => handleDeleteChannel(channel)} title="Delete">🗑️</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

				{:else if activeTab === 'members'}
					<div class="tab-panel" role="tabpanel" id="panel-members">
						<div class="panel-header">
							<h3>Members ({members.length})</h3>
						</div>

						{#if membersLoading}
							<div class="loading">Loading members...</div>
						{:else if membersError}
							<div class="error">{membersError}</div>
						{:else if members.length === 0}
							<div class="empty-state">
								<span class="empty-icon">👥</span>
								<p>No members</p>
							</div>
						{:else}
							<div class="members-list">
								{#each members as member}
									<div class="member-item">
										<Avatar
											src={member.user.avatar}
											username={member.user.username}
											size="sm"
										/>
										<div class="member-info">
											<span class="member-name">
												{member.nickname || member.user.display_name || member.user.username}
											</span>
											<span class="member-username">@{member.user.username}</span>
										</div>
										<span class="member-joined">Joined {formatDate(member.joined_at)}</span>
										{#if isOwner && member.user.id !== $currentServer.owner_id && member.user.id !== $user?.id}
											<div class="member-actions">
												<button
													class="action-btn"
													on:click={() => openMemberRoles(member)}
													title="Manage roles"
												>
													🛡️
												</button>
												<button
													class="action-btn"
													on:click={() => openBanModal(member)}
													title="Ban member"
												>
													🔨
												</button>
												<button
													class="action-btn danger"
													on:click={() => handleKickMember(member)}
													title="Kick member"
												>
													👢
												</button>
											</div>
										{/if}
										{#if member.user.id === $currentServer.owner_id}
											<span class="owner-badge">👑</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if activeTab === 'invites'}
					<div class="tab-panel" role="tabpanel" id="panel-invites">
						<div class="panel-header">
							<h3>Invites</h3>
						</div>

						{#if invitesLoading}
							<div class="loading">Loading invites...</div>
						{:else if invitesError}
							<div class="error">{invitesError}</div>
						{:else if invites.length === 0}
							<div class="empty-state">
								<span class="empty-icon">🔗</span>
								<p>No active invites</p>
								<p class="empty-hint">Create invites from the channel context menu</p>
							</div>
						{:else}
							<div class="invites-list">
								{#each invites as invite}
									<div class="invite-item">
										<div class="invite-code">
											<code>{invite.code}</code>
										</div>
										<div class="invite-info">
											{#if invite.inviter}
												<span class="invite-creator">by {invite.inviter.username}</span>
											{/if}
											<span class="invite-uses">
												{invite.uses}{invite.max_uses > 0 ? `/${invite.max_uses}` : ''} uses
											</span>
											<span class="invite-expires">
												Expires: {formatExpiry(invite.expires_at)}
											</span>
										</div>
										{#if isOwner}
											<button
												class="action-btn danger"
												on:click={() => handleDeleteInvite(invite)}
												title="Delete invite"
											>
												🗑️
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Create Channel Modal -->
	{#if showCreateChannelModal}
		<Modal open={true} title="Create Channel" on:close={() => showCreateChannelModal = false}>
			<div class="create-channel-form">
				<div class="channel-type-select">
					<label class="channel-type-option" class:selected={newChannel.type === 'text'}>
						<input type="radio" value="text" bind:group={newChannel.type} />
						<span class="type-icon">#</span>
						<div>
							<span class="type-name">Text</span>
							<span class="type-desc">Send messages and files</span>
						</div>
					</label>
					<label class="channel-type-option" class:selected={newChannel.type === 'voice'}>
						<input type="radio" value="voice" bind:group={newChannel.type} />
						<span class="type-icon">🔊</span>
						<div>
							<span class="type-name">Voice</span>
							<span class="type-desc">Talk with voice and video</span>
						</div>
					</label>
				</div>

				<div class="form-field">
					<label for="new-channel-name">Channel Name</label>
					<div class="channel-name-input">
						<span class="prefix">{newChannel.type === 'text' ? '#' : '🔊'}</span>
						<input
							type="text"
							id="new-channel-name"
							bind:value={newChannel.name}
							placeholder="new-channel"
							maxlength={100}
						/>
					</div>
				</div>
			</div>

			<svelte:fragment slot="footer">
				<Button variant="secondary" on:click={() => showCreateChannelModal = false}>
					Cancel
				</Button>
				<Button variant="primary" on:click={handleCreateChannel} disabled={!newChannel.name.trim()}>
					Create Channel
				</Button>
			</svelte:fragment>
		</Modal>
	{/if}

	<!-- Edit Channel Modal -->
	{#if editingChannel}
		<Modal open={true} title="Edit Channel" on:close={() => editingChannel = null}>
			<div class="edit-channel-form">
				<div class="form-field">
					<label for="edit-channel-name">Channel Name</label>
					<input
						type="text"
						id="edit-channel-name"
						bind:value={channelForm.name}
						maxlength={100}
					/>
				</div>

				{#if editingChannel.type === 0}
					<div class="form-field">
						<label for="edit-channel-topic">Topic</label>
						<textarea
							id="edit-channel-topic"
							bind:value={channelForm.topic}
							placeholder="What's this channel about?"
							maxlength={1024}
							rows={2}
						></textarea>
					</div>

					<div class="toggle-field">
						<label>
							<input type="checkbox" bind:checked={channelForm.nsfw} />
							<span>Age-Restricted (NSFW)</span>
						</label>
					</div>
				{/if}
			</div>

			<svelte:fragment slot="footer">
				<Button variant="secondary" on:click={() => editingChannel = null}>
					Cancel
				</Button>
				<Button variant="primary" on:click={saveChannelEdits} disabled={!channelForm.name.trim()}>
					Save Changes
				</Button>
			</svelte:fragment>
		</Modal>
	{/if}

	<!-- Member Roles Modal -->
	{#if showMemberRolesModal && selectedMember && $currentServer}
		<MemberRolesModal
			open={showMemberRolesModal}
			serverId={$currentServer.id}
			serverName={$currentServer.name}
			member={selectedMember}
			on:close={() => { showMemberRolesModal = false; selectedMember = null; }}
			on:saved={handleRolesSaved}
		/>
	{/if}

	<!-- Member Ban Modal -->
	{#if showMemberBanModal && selectedMember && $currentServer}
		<MemberBanModal
			open={showMemberBanModal}
			serverId={$currentServer.id}
			serverName={$currentServer.name}
			member={selectedMember}
			on:close={() => { showMemberBanModal = false; selectedMember = null; }}
			on:banned={handleMemberBanned}
		/>
	{/if}
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 40px;
	}

	.settings-modal {
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		width: 660px;
		max-width: 100%;
		max-height: calc(100vh - 80px);
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 16px 0;
	}

	.modal-header h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.tabs {
		display: flex;
		gap: 4px;
		padding: 16px 16px 0;
		border-bottom: 1px solid var(--bg-modifier-accent, #404249);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		margin-bottom: -1px;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.tab:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.tab.active {
		color: var(--text-normal, #f2f3f5);
		border-bottom-color: var(--blurple, #5865f2);
	}

	.tab-icon {
		font-size: 16px;
	}

	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.tab-panel {
		min-height: 300px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.panel-header h3 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0;
	}

	/* Overview styles */
	.overview-layout {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 24px;
	}

	.icon-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.server-icon-preview {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--bg-secondary, #2b2d31);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.server-icon-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.icon-placeholder {
		font-size: 32px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.icon-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.hidden {
		display: none;
	}

	.form-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-field label {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
	}

	.form-field input,
	.form-field textarea,
	.form-field select {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #f2f3f5);
		font-size: 16px;
		font-family: inherit;
	}

	.form-field input:focus,
	.form-field textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--blurple, #5865f2);
	}

	.form-field input:disabled,
	.form-field textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-field textarea {
		resize: vertical;
		min-height: 60px;
	}

	/* Roles styles */
	.roles-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 8px;
	}

	.role-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 4px;
	}

	.role-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.role-color {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.role-name {
		flex: 1;
		color: var(--text-normal, #f2f3f5);
		font-weight: 500;
	}

	.role-members {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	/* Channels styles */
	.channels-section {
		margin-bottom: 24px;
	}

	.channels-section h4 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
		margin-bottom: 8px;
	}

	.channel-list {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		overflow: hidden;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--bg-modifier-accent, #404249);
	}

	.channel-item:last-child {
		border-bottom: none;
	}

	.channel-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.channel-icon {
		color: var(--text-muted, #b5bac1);
		font-size: 18px;
		width: 20px;
		text-align: center;
	}

	.channel-name {
		flex: 1;
		color: var(--text-normal, #f2f3f5);
	}

	.channel-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.channel-item:hover .channel-actions {
		opacity: 1;
	}

	.badge {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
	}

	.badge.nsfw {
		background: var(--red, #da373c);
		color: white;
	}

	/* Members styles */
	.members-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 8px;
	}

	.member-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 12px;
		border-radius: 4px;
	}

	.member-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.member-info {
		flex: 1;
		min-width: 0;
	}

	.member-name {
		display: block;
		color: var(--text-normal, #f2f3f5);
		font-weight: 500;
	}

	.member-username {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.member-joined {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.owner-badge {
		font-size: 16px;
	}

	/* Invites styles */
	.invites-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 8px;
	}

	.invite-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 4px;
	}

	.invite-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.invite-code code {
		font-family: 'Consolas', 'Monaco', monospace;
		background: var(--bg-tertiary, #1e1f22);
		padding: 4px 8px;
		border-radius: 4px;
		color: var(--blurple, #5865f2);
		font-size: 14px;
	}

	.invite-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.invite-creator {
		font-size: 13px;
		color: var(--text-normal, #f2f3f5);
	}

	.invite-uses,
	.invite-expires {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	/* Action buttons */
	.action-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		font-size: 14px;
		opacity: 0.7;
		transition: opacity 0.15s ease;
	}

	.action-btn:hover {
		opacity: 1;
	}

	.action-btn.danger:hover {
		filter: hue-rotate(320deg);
	}

	/* States */
	.loading,
	.error,
	.empty-state,
	.no-items {
		padding: 24px;
		text-align: center;
		color: var(--text-muted, #b5bac1);
	}

	.error {
		color: var(--red, #da373c);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.5;
	}

	.empty-hint {
		font-size: 12px;
	}

	/* Create/Edit Channel Modal */
	.create-channel-form,
	.edit-channel-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 360px;
	}

	.channel-type-select {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.channel-type-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px solid transparent;
		border-radius: 4px;
		cursor: pointer;
	}

	.channel-type-option.selected {
		border-color: var(--blurple, #5865f2);
	}

	.channel-type-option input[type="radio"] {
		display: none;
	}

	.type-icon {
		font-size: 24px;
		color: var(--text-muted, #b5bac1);
	}

	.type-name {
		display: block;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.type-desc {
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
	}

	.channel-name-input {
		display: flex;
		align-items: center;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		overflow: hidden;
	}

	.channel-name-input .prefix {
		padding: 10px 0 10px 12px;
		color: var(--text-muted, #b5bac1);
		font-size: 18px;
	}

	.channel-name-input input {
		flex: 1;
		padding: 10px 12px 10px 4px;
		background: transparent;
		border: none;
	}

	.toggle-field {
		display: flex;
		align-items: center;
	}

	.toggle-field label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		color: var(--text-normal, #f2f3f5);
	}

	.toggle-field input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--blurple, #5865f2);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.modal-backdrop {
			padding: 20px;
		}

		.settings-modal {
			width: 100%;
		}

		.overview-layout {
			grid-template-columns: 1fr;
		}

		.icon-section {
			flex-direction: row;
			gap: 16px;
		}

		.tabs {
			overflow-x: auto;
		}

		.tab-label {
			display: none;
		}

		.tab-icon {
			font-size: 20px;
		}
	}
</style>
