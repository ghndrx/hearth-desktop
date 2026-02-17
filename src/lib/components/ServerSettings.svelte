<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	import { currentServer, updateServer, updateServerIcon, removeServerIcon, deleteServer } from '$lib/stores/servers';
	import { serverChannels, createChannel, updateChannel, deleteChannel, type Channel } from '$lib/stores/channels';
	import { user } from '$lib/stores/auth';
	import Avatar from './Avatar.svelte';
	import Modal from './Modal.svelte';
	import RoleEditor from './RoleEditor.svelte';
	import AuditLogViewer from './AuditLogViewer.svelte';
	import AutoModerationSettings from './AutoModerationSettings.svelte';
	import BanListSection from './BanListSection.svelte';
	
	export let open = false;
	
	const dispatch = createEventDispatcher();
	
	let activeSection = 'overview';
	let saving = false;
	let uploadingIcon = false;
	let deleteConfirmation = '';
	let showDeleteModal = false;
	let showCreateChannelModal = false;
	let editingChannel: Channel | null = null;
	let iconInput: HTMLInputElement;
	
	interface ServerForm {
		name: string;
		description: string;
		region: string;
		verification_level: number;
		explicit_content_filter: number;
		default_notifications: number;
		afk_timeout: number;
	}

	let serverForm: ServerForm = {
		name: '',
		description: '',
		region: 'us-east',
		verification_level: 0,
		explicit_content_filter: 0,
		default_notifications: 0,
		afk_timeout: 300
	};

	const regions = [
		{ value: 'us-east', label: 'US East', flag: '🇺🇸' },
		{ value: 'us-west', label: 'US West', flag: '🇺🇸' },
		{ value: 'us-central', label: 'US Central', flag: '🇺🇸' },
		{ value: 'us-south', label: 'US South', flag: '🇺🇸' },
		{ value: 'eu-west', label: 'Europe West', flag: '🇪🇺' },
		{ value: 'eu-central', label: 'Europe Central', flag: '🇪🇺' },
		{ value: 'singapore', label: 'Singapore', flag: '🇸🇬' },
		{ value: 'japan', label: 'Japan', flag: '🇯🇵' },
		{ value: 'sydney', label: 'Sydney', flag: '🇦🇺' },
		{ value: 'brazil', label: 'Brazil', flag: '🇧🇷' },
		{ value: 'india', label: 'India', flag: '🇮🇳' },
		{ value: 'south-africa', label: 'South Africa', flag: '🇿🇦' }
	];
	
	let newChannel: { name: string; type: 'text' | 'voice' | 'announcement'; topic: string } = {
		name: '',
		type: 'text',
		topic: ''
	};
	
	let channelForm = {
		name: '',
		topic: '',
		slowmode: 0,
		nsfw: false
	};
	
	const sections = [
		{ id: 'divider-server', label: 'Server Settings', divider: true },
		{ id: 'overview', label: 'Overview', icon: 'server' },
		{ id: 'roles', label: 'Roles', icon: 'shield' },
		{ id: 'emoji', label: 'Emoji', icon: 'emoji' },
		{ id: 'divider-moderation', label: 'Moderation', divider: true },
		{ id: 'safety', label: 'Safety Setup', icon: 'safety' },
		{ id: 'automod', label: 'AutoMod', icon: 'automod' },
		{ id: 'audit-log', label: 'Audit Log', icon: 'log' },
		{ id: 'bans', label: 'Bans', icon: 'bans' },
		{ id: 'divider-channels', label: 'Channel Settings', divider: true },
		{ id: 'channels', label: 'Channels', icon: 'channels' },
		{ id: 'divider-other', label: '', divider: true },
		{ id: 'delete', label: 'Delete Server', icon: 'trash', danger: true }
	];
	
	const verificationLevels = [
		{ value: 0, label: 'None', description: 'Unrestricted' },
		{ value: 1, label: 'Low', description: 'Must have a verified email' },
		{ value: 2, label: 'Medium', description: 'Must be registered for 5+ minutes' },
		{ value: 3, label: 'High', description: 'Must be a member for 10+ minutes' },
		{ value: 4, label: 'Highest', description: 'Must have a verified phone' }
	];
	
	const contentFilters = [
		{ value: 0, label: 'Don\'t scan any media content', description: 'No automatic moderation' },
		{ value: 1, label: 'Scan from members without roles', description: 'Recommended for public servers' },
		{ value: 2, label: 'Scan all media content', description: 'Maximum protection' }
	];
	
	const notificationDefaults = [
		{ value: 0, label: 'All Messages', description: 'Members are notified of all messages' },
		{ value: 1, label: 'Only @mentions', description: 'Members only receive notifications for mentions' }
	];
	
	const afkTimeouts = [
		{ value: 60, label: '1 minute' },
		{ value: 300, label: '5 minutes' },
		{ value: 900, label: '15 minutes' },
		{ value: 1800, label: '30 minutes' },
		{ value: 3600, label: '1 hour' }
	];
	
	const slowmodeOptions = [
		{ value: 0, label: 'Off' },
		{ value: 5, label: '5 seconds' },
		{ value: 10, label: '10 seconds' },
		{ value: 15, label: '15 seconds' },
		{ value: 30, label: '30 seconds' },
		{ value: 60, label: '1 minute' },
		{ value: 120, label: '2 minutes' },
		{ value: 300, label: '5 minutes' },
		{ value: 600, label: '10 minutes' },
		{ value: 900, label: '15 minutes' },
		{ value: 1800, label: '30 minutes' },
		{ value: 3600, label: '1 hour' },
		{ value: 7200, label: '2 hours' },
		{ value: 21600, label: '6 hours' }
	];
	
	$: isOwner = $currentServer?.owner_id === $user?.id;
	$: console.log('ServerSettings ownership check:', { 
		serverOwnerId: $currentServer?.owner_id, 
		userId: $user?.id, 
		isOwner 
	});
	
	$: if (open && $currentServer) {
		serverForm = {
			name: $currentServer.name || '',
			description: $currentServer.description || '',
			region: ($currentServer as any).region || 'us-east',
			verification_level: 0,
			explicit_content_filter: 0,
			default_notifications: 0,
			afk_timeout: 300
		};
	}
	
	$: textChannels = $serverChannels.filter(c => c.type === 0);
	$: voiceChannels = $serverChannels.filter(c => c.type === 2);
	$: categories = $serverChannels.filter(c => c.type === 4);
	
	function close() {
		open = false;
		activeSection = 'overview';
		deleteConfirmation = '';
		showDeleteModal = false;
		showCreateChannelModal = false;
		editingChannel = null;
		dispatch('close');
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showDeleteModal) {
				showDeleteModal = false;
			} else if (showCreateChannelModal) {
				showCreateChannelModal = false;
			} else if (editingChannel) {
				editingChannel = null;
			} else {
				close();
			}
		}
	}
	
	function handleSectionClick(id: string) {
		if (!id.startsWith('divider')) {
			activeSection = id;
		}
	}
	
	async function saveOverview() {
		if (!$currentServer) return;
		saving = true;
		try {
			await updateServer($currentServer.id, {
				name: serverForm.name,
				description: serverForm.description || null,
				region: serverForm.region
			} as any);
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

		// Validate file type
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}

		// Validate file size (max 8MB)
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
	
	async function handleDeleteServer() {
		if (!$currentServer || deleteConfirmation !== $currentServer.name) return;
		try {
			await deleteServer($currentServer.id);
			close();
		} catch (error) {
			console.error('Failed to delete server:', error);
		}
	}
	
	async function handleCreateChannel() {
		if (!$currentServer || !newChannel.name.trim()) return;
		try {
			await createChannel($currentServer.id, { name: newChannel.name.trim(), type: newChannel.type, topic: newChannel.topic });
			newChannel = { name: '', type: 'text', topic: '' };
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
	
	function getChannelIcon(type: number): string {
		switch (type) {
			case 0: return '#';
			case 2: return '🔊';
			case 4: return '📁';
			default: return '#';
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && $currentServer}
	<div 
		class="settings-overlay"
		transition:fade={{ duration: 150 }}
		on:click|self={close}
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<div 
			class="settings-container"
			transition:fly={{ y: 20, duration: 200 }}
		>
			<!-- Sidebar -->
			<nav class="settings-sidebar" aria-label="Server settings navigation">
				<div class="sidebar-content">
					<div class="sidebar-header">
						<span class="server-name">{$currentServer.name}</span>
					</div>
					{#each sections as section}
						{#if section.divider}
							<div class="sidebar-divider">
								{#if section.label}
									<span>{section.label}</span>
								{/if}
							</div>
						{:else}
							<button
								class="sidebar-item"
								class:active={activeSection === section.id}
								class:danger={section.danger}
								class:disabled={!isOwner && section.id === 'delete'}
								on:click={() => handleSectionClick(section.id)}
								disabled={!isOwner && section.id === 'delete'}
							>
								{section.label}
							</button>
						{/if}
					{/each}
				</div>
			</nav>
			
			<!-- Content -->
			<main class="settings-content">
				<div class="content-scroll">
					{#if activeSection === 'overview'}
						<section>
							<h1 id="settings-title">Server Overview</h1>
							
							<div class="overview-grid">
								<div class="icon-section">
									<div class="server-icon-large">
										{#if $currentServer.icon}
											<img src={$currentServer.icon} alt={$currentServer.name} />
										{:else}
											<span class="icon-placeholder">
												{$currentServer.name.charAt(0).toUpperCase()}
											</span>
										{/if}
									</div>
									<p class="icon-hint">Min 128x128. Recommended 512x512.</p>
									<input
										type="file"
										accept="image/*"
										bind:this={iconInput}
										on:change={handleIconUpload}
										class="hidden-input"
									/>
									<button
										class="btn btn-secondary"
										disabled={!isOwner || uploadingIcon}
										on:click={() => iconInput?.click()}
									>
										{uploadingIcon ? 'Uploading...' : 'Upload Image'}
									</button>
									{#if $currentServer.icon}
										<button
											class="btn btn-text"
											disabled={!isOwner || uploadingIcon}
											on:click={handleRemoveIcon}
										>
											Remove
										</button>
									{/if}
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
										<label for="server-description">Server Description</label>
										<textarea
											id="server-description"
											bind:value={serverForm.description}
											placeholder="Tell people what this server is about"
											maxlength={1024}
											rows={4}
											disabled={!isOwner}
										></textarea>
										<span class="char-count">{serverForm.description.length}/1024</span>
									</div>

									<div class="form-field">
										<label for="server-region">Server Region</label>
										<p class="field-hint">Select the region closest to your members for optimal voice quality.</p>
										<div class="region-select-wrapper">
											<select
												id="server-region"
												bind:value={serverForm.region}
												disabled={!isOwner}
												class="region-select"
											>
												{#each regions as region}
													<option value={region.value}>
														{region.flag} {region.label}
													</option>
												{/each}
											</select>
										</div>
									</div>

									{#if isOwner}
										<div class="form-actions">
											<button
												class="btn btn-primary"
												on:click={saveOverview}
												disabled={saving || !serverForm.name.trim()}
											>
												{saving ? 'Saving...' : 'Save Changes'}
											</button>
										</div>
									{/if}
								</div>
							</div>
							
							{#if isOwner}
								<div class="settings-section">
									<h2>Server Features</h2>
									
									<div class="feature-grid">
										<div class="feature-card">
											<div class="feature-icon">🔗</div>
											<div class="feature-info">
												<span class="feature-title">Vanity URL</span>
												<span class="feature-desc">Create a custom invite link</span>
											</div>
											<button class="btn btn-secondary btn-sm">Setup</button>
										</div>
										
										<div class="feature-card">
											<div class="feature-icon">🎨</div>
											<div class="feature-info">
												<span class="feature-title">Server Banner</span>
												<span class="feature-desc">Add a banner to your server</span>
											</div>
											<button class="btn btn-secondary btn-sm">Upload</button>
										</div>
									</div>
								</div>
							{/if}
						</section>
					
					{:else if activeSection === 'safety'}
						<section>
							<h1>Safety Setup</h1>
							
							<div class="settings-section">
								<h2>Verification Level</h2>
								<p class="section-desc">
									Restrict which users can send messages in this server.
								</p>
								
								<div class="option-list">
									{#each verificationLevels as level}
										<label class="option-item" class:disabled={!isOwner}>
											<input 
												type="radio" 
												name="verification"
												value={level.value}
												bind:group={serverForm.verification_level}
												disabled={!isOwner}
											/>
											<div class="option-content">
												<span class="option-title">{level.label}</span>
												<span class="option-desc">{level.description}</span>
											</div>
										</label>
									{/each}
								</div>
							</div>
							
							<div class="settings-section">
								<h2>Explicit Media Content Filter</h2>
								<p class="section-desc">
									Automatically scan and delete messages with explicit content.
								</p>
								
								<div class="option-list">
									{#each contentFilters as filter}
										<label class="option-item" class:disabled={!isOwner}>
											<input 
												type="radio" 
												name="content-filter"
												value={filter.value}
												bind:group={serverForm.explicit_content_filter}
												disabled={!isOwner}
											/>
											<div class="option-content">
												<span class="option-title">{filter.label}</span>
												<span class="option-desc">{filter.description}</span>
											</div>
										</label>
									{/each}
								</div>
							</div>
							
							<div class="settings-section">
								<h2>Default Notification Settings</h2>
								<p class="section-desc">
									Default notification preference for new members.
								</p>
								
								<div class="option-list">
									{#each notificationDefaults as notif}
										<label class="option-item" class:disabled={!isOwner}>
											<input 
												type="radio" 
												name="notifications"
												value={notif.value}
												bind:group={serverForm.default_notifications}
												disabled={!isOwner}
											/>
											<div class="option-content">
												<span class="option-title">{notif.label}</span>
												<span class="option-desc">{notif.description}</span>
											</div>
										</label>
									{/each}
								</div>
							</div>
						</section>
					
					{:else if activeSection === 'roles'}
						<section class="roles-section">
							<h1>Roles</h1>
							<RoleEditor serverId={$currentServer.id} {isOwner} />
						</section>
					
					{:else if activeSection === 'emoji'}
						<section>
							<h1>Emoji</h1>
							
							<div class="placeholder-section">
								<div class="placeholder-icon">😀</div>
								<h3>Custom Emoji</h3>
								<p>Upload custom emoji for your server.</p>
								<p class="coming-soon">Coming soon</p>
							</div>
						</section>
					
					{:else if activeSection === 'audit-log'}
						<section class="audit-log-section">
							<h1>Audit Log</h1>
							<AuditLogViewer serverId={$currentServer.id} />
						</section>
					
					{:else if activeSection === 'automod'}
						<section class="automod-section">
							<AutoModerationSettings serverId={$currentServer.id} {isOwner} />
						</section>
					
					{:else if activeSection === 'bans'}
						<section>
							<h1>Bans</h1>
							<p class="section-desc">
								View and manage banned users in this server.
							</p>
							<BanListSection 
								serverId={$currentServer.id}
								canUnban={isOwner}
							/>
						</section>
					
					{:else if activeSection === 'channels'}
						<section>
							<h1>Channels</h1>
							
							{#if isOwner}
								<div class="channel-actions">
									<button 
										class="btn btn-primary"
										on:click={() => showCreateChannelModal = true}
									>
										Create Channel
									</button>
								</div>
							{/if}
							
							<div class="settings-section">
								<h2>Text Channels</h2>
								
								{#if textChannels.length === 0}
									<p class="no-items">No text channels</p>
								{:else}
									<div class="channel-list">
										{#each textChannels as channel}
											<div class="channel-item">
												<span class="channel-icon">#</span>
												<span class="channel-name">{channel.name}</span>
												{#if channel.nsfw}
													<span class="channel-badge nsfw">NSFW</span>
												{/if}
												{#if channel.slowmode > 0}
													<span class="channel-badge slowmode">🐢</span>
												{/if}
												{#if isOwner}
													<div class="channel-actions-inline">
														<button 
															class="btn-icon" 
															on:click={() => startEditChannel(channel)}
															title="Edit channel"
														>
															✏️
														</button>
														<button 
															class="btn-icon danger" 
															on:click={() => handleDeleteChannel(channel)}
															title="Delete channel"
														>
															🗑️
														</button>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
							
							<div class="settings-section">
								<h2>Voice Channels</h2>
								
								{#if voiceChannels.length === 0}
									<p class="no-items">No voice channels</p>
								{:else}
									<div class="channel-list">
										{#each voiceChannels as channel}
											<div class="channel-item">
												<span class="channel-icon">🔊</span>
												<span class="channel-name">{channel.name}</span>
												{#if isOwner}
													<div class="channel-actions-inline">
														<button 
															class="btn-icon" 
															on:click={() => startEditChannel(channel)}
															title="Edit channel"
														>
															✏️
														</button>
														<button 
															class="btn-icon danger" 
															on:click={() => handleDeleteChannel(channel)}
															title="Delete channel"
														>
															🗑️
														</button>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
							
							{#if categories.length > 0}
								<div class="settings-section">
									<h2>Categories</h2>
									
									<div class="channel-list">
										{#each categories as category}
											<div class="channel-item">
												<span class="channel-icon">📁</span>
												<span class="channel-name">{category.name}</span>
												{#if isOwner}
													<div class="channel-actions-inline">
														<button 
															class="btn-icon" 
															on:click={() => startEditChannel(category)}
															title="Edit category"
														>
															✏️
														</button>
														<button 
															class="btn-icon danger" 
															on:click={() => handleDeleteChannel(category)}
															title="Delete category"
														>
															🗑️
														</button>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</section>
					
					{:else if activeSection === 'delete'}
						<section>
							<h1>Delete Server</h1>
							
							{#if isOwner}
								<div class="danger-zone">
									<div class="danger-warning">
										<div class="warning-icon">⚠️</div>
										<div>
											<h3>This action is irreversible</h3>
											<p>
												Deleting this server will permanently remove all channels, 
												messages, and member data. This cannot be undone.
											</p>
										</div>
									</div>
									
									<button 
										class="btn btn-danger"
										on:click={() => showDeleteModal = true}
									>
										Delete Server
									</button>
								</div>
							{:else}
								<div class="no-permission">
									<p>Only the server owner can delete this server.</p>
								</div>
							{/if}
						</section>
					{/if}
				</div>
				
				<!-- Close button -->
				<button class="close-btn" on:click={close} aria-label="Close settings">
					<div class="close-icon">
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
						</svg>
					</div>
					<span class="close-keybind">ESC</span>
				</button>
			</main>
		</div>
	</div>
	
	<!-- Delete Confirmation Modal -->
	{#if showDeleteModal}
		<Modal open={true} on:close={() => showDeleteModal = false}>
			<div class="delete-modal">
				<h2>Delete '{$currentServer.name}'</h2>
				<p>
					Are you sure you want to delete <strong>{$currentServer.name}</strong>? 
					This action cannot be undone.
				</p>
				<div class="form-field">
					<label for="delete-confirm">Enter the server name to confirm</label>
					<input 
						type="text" 
						id="delete-confirm"
						bind:value={deleteConfirmation}
						placeholder={$currentServer.name}
					/>
				</div>
				<div class="modal-actions">
					<button class="btn btn-secondary" on:click={() => showDeleteModal = false}>
						Cancel
					</button>
					<button 
						class="btn btn-danger"
						disabled={deleteConfirmation !== $currentServer.name}
						on:click={handleDeleteServer}
					>
						Delete Server
					</button>
				</div>
			</div>
		</Modal>
	{/if}
	
	<!-- Create Channel Modal -->
	{#if showCreateChannelModal}
		<Modal open={true} on:close={() => showCreateChannelModal = false}>
			<div class="create-channel-modal">
				<h2>Create Channel</h2>
				
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
					<label for="channel-name">Channel Name</label>
					<div class="channel-name-input">
						<span class="prefix">{newChannel.type === 'text' ? '#' : '🔊'}</span>
						<input 
							type="text" 
							id="channel-name"
							bind:value={newChannel.name}
							placeholder="new-channel"
							maxlength={100}
						/>
					</div>
				</div>
				
				<div class="modal-actions">
					<button class="btn btn-secondary" on:click={() => showCreateChannelModal = false}>
						Cancel
					</button>
					<button 
						class="btn btn-primary"
						disabled={!newChannel.name.trim()}
						on:click={handleCreateChannel}
					>
						Create Channel
					</button>
				</div>
			</div>
		</Modal>
	{/if}
	
	<!-- Edit Channel Modal -->
	{#if editingChannel}
		<Modal open={true} on:close={() => editingChannel = null}>
			<div class="edit-channel-modal">
				<h2>Edit Channel</h2>
				
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
						<label for="edit-channel-topic">Channel Topic</label>
						<textarea 
							id="edit-channel-topic"
							bind:value={channelForm.topic}
							placeholder="What's this channel about?"
							maxlength={1024}
							rows={3}
						></textarea>
					</div>
					
					<div class="form-field">
						<label for="edit-slowmode">Slowmode</label>
						<select id="edit-slowmode" bind:value={channelForm.slowmode}>
							{#each slowmodeOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					
					<div class="toggle-item">
						<div>
							<span class="toggle-label">Age-Restricted Channel</span>
							<span class="toggle-description">
								Only users 18+ can view this channel.
							</span>
						</div>
						<label class="toggle">
							<input type="checkbox" bind:checked={channelForm.nsfw} />
							<span class="toggle-slider"></span>
						</label>
					</div>
				{/if}
				
				<div class="modal-actions">
					<button class="btn btn-secondary" on:click={() => editingChannel = null}>
						Cancel
					</button>
					<button 
						class="btn btn-primary"
						disabled={!channelForm.name.trim()}
						on:click={saveChannelEdits}
					>
						Save Changes
					</button>
				</div>
			</div>
		</Modal>
	{/if}
{/if}

<style>
	.settings-overlay {
		position: fixed;
		inset: 0;
		background: var(--bg-tertiary, #1e1f22);
		z-index: 1000;
		display: flex;
	}
	
	.settings-container {
		display: flex;
		width: 100%;
		height: 100%;
	}
	
	/* Sidebar */
	.settings-sidebar {
		width: 218px;
		background: var(--bg-secondary);
		display: flex;
		justify-content: flex-end;
		padding: 60px 6px 60px 20px;
		flex-shrink: 0;
	}
	
	.sidebar-content {
		width: 192px;
	}
	
	.sidebar-header {
		padding: 6px 10px 16px;
	}
	
	.server-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		display: block;
	}
	
	.sidebar-divider {
		padding: 6px 10px;
		margin-top: 8px;
	}
	
	.sidebar-divider span {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted);
	}
	
	.sidebar-item {
		width: 100%;
		padding: 6px 10px;
		margin-bottom: 2px;
		background: none;
		border: none;
		border-radius: 4px;
		font-size: 16px;
		color: var(--text-secondary);
		cursor: pointer;
		text-align: left;
	}
	
	.sidebar-item:hover:not(:disabled) {
		background: var(--bg-modifier-hover);
		color: var(--text-primary);
	}
	
	.sidebar-item.active {
		background: var(--bg-modifier-selected);
		color: var(--text-primary);
	}
	
	.sidebar-item.danger {
		color: var(--status-danger);
	}
	
	.sidebar-item.danger:hover:not(:disabled) {
		background: rgba(242, 63, 67, 0.1);
	}
	
	.sidebar-item.disabled,
	.sidebar-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	/* Content */
	.settings-content {
		flex: 1;
		position: relative;
		display: flex;
		justify-content: flex-start;
		padding: 60px 40px 80px;
	}
	
	.content-scroll {
		width: 100%;
		max-width: 740px;
		overflow-y: auto;
	}
	
	section h1 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 20px;
	}
	
	section h2 {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	
	section h3 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 4px;
	}
	
	.settings-section {
		margin-bottom: 40px;
		padding-bottom: 40px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.section-desc {
		color: var(--text-secondary);
		font-size: 14px;
		margin-bottom: 16px;
	}
	
	/* Overview Grid */
	.overview-grid {
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 40px;
		margin-bottom: 40px;
		padding-bottom: 40px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.icon-section {
		text-align: center;
	}
	
	.server-icon-large {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: var(--bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 12px;
		overflow: hidden;
	}
	
	.server-icon-large img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.icon-placeholder {
		font-size: 40px;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.icon-hint {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}

	.hidden-input {
		display: none;
	}
	
	/* Form */
	.form-field {
		margin-bottom: 20px;
	}
	
	.form-field label {
		display: block;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	
	.form-field input,
	.form-field textarea,
	.form-field select {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 16px;
		font-family: inherit;
	}
	
	.form-field input:focus,
	.form-field textarea:focus,
	.form-field select:focus {
		outline: 2px solid var(--brand-primary);
	}
	
	.form-field input:disabled,
	.form-field textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.form-field textarea {
		resize: vertical;
		min-height: 100px;
	}
	
	.char-count {
		display: block;
		text-align: right;
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.field-hint {
		font-size: 14px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.region-select-wrapper {
		position: relative;
	}

	.region-select {
		width: 100%;
		padding: 10px 12px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 16px;
		font-family: inherit;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23b5bac1' d='M6 8.5L1.5 4h9L6 8.5z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		padding-right: 36px;
	}

	.region-select:focus {
		outline: 2px solid var(--brand-primary);
	}

	.region-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.region-select option {
		background: var(--bg-tertiary);
		color: var(--text-primary);
		padding: 8px;
	}
	
	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	
	/* Buttons */
	.btn {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.btn-sm {
		padding: 4px 12px;
		font-size: 12px;
	}
	
	.btn-primary {
		background: var(--brand-primary);
		color: white;
	}
	
	.btn-primary:hover:not(:disabled) {
		background: var(--brand-hover);
	}
	
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-secondary {
		background: var(--bg-modifier-accent);
		color: var(--text-primary);
	}
	
	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-modifier-selected);
	}
	
	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-danger {
		background: var(--status-danger);
		color: white;
	}
	
	.btn-danger:hover:not(:disabled) {
		background: #d62f33;
	}
	
	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.btn-text {
		background: none;
		color: var(--text-secondary);
	}
	
	.btn-text:hover {
		color: var(--text-primary);
	}
	
	.btn-icon {
		background: none;
		border: none;
		padding: 4px 8px;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease;
	}
	
	.btn-icon.danger:hover {
		color: var(--status-danger);
	}
	
	/* Feature Grid */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}
	
	.feature-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary);
		border-radius: 8px;
	}
	
	.feature-icon {
		font-size: 24px;
	}
	
	.feature-info {
		flex: 1;
	}
	
	.feature-title {
		display: block;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.feature-desc {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	/* Option List */
	.option-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	
	.option-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px;
		background: var(--bg-secondary);
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.option-item:hover:not(.disabled) {
		background: var(--bg-modifier-hover);
	}
	
	.option-item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.option-item input[type="radio"] {
		margin-top: 2px;
		accent-color: var(--brand-primary);
	}
	
	.option-content {
		flex: 1;
	}
	
	.option-title {
		display: block;
		font-weight: 500;
		color: var(--text-primary);
	}
	
	.option-desc {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	/* Channel List */
	.channel-actions {
		margin-bottom: 24px;
	}
	
	.channel-list {
		background: var(--bg-secondary);
		border-radius: 8px;
		overflow: hidden;
	}
	
	.channel-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.channel-item:last-child {
		border-bottom: none;
	}
	
	.channel-item:hover .btn-icon {
		opacity: 1;
	}
	
	.channel-icon {
		font-size: 18px;
		color: var(--text-muted);
		width: 24px;
		text-align: center;
	}
	
	.channel-name {
		flex: 1;
		color: var(--text-primary);
	}
	
	.channel-badge {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
	}
	
	.channel-badge.nsfw {
		background: var(--status-danger);
		color: white;
	}
	
	.channel-badge.slowmode {
		background: var(--status-warning);
	}
	
	.channel-actions-inline {
		display: flex;
		gap: 4px;
	}
	
	.no-items {
		color: var(--text-muted);
		padding: 16px;
		text-align: center;
	}
	
	/* Roles Section */
	.roles-section {
		height: calc(100vh - 200px);
		min-height: 500px;
		display: flex;
		flex-direction: column;
	}
	
	.roles-section h1 {
		flex-shrink: 0;
	}
	
	.roles-section :global(.role-editor) {
		flex: 1;
		background: var(--bg-secondary);
		border-radius: 8px;
		overflow: hidden;
	}
	
	/* Audit Log Section */
	.audit-log-section {
		height: calc(100vh - 200px);
		min-height: 500px;
		display: flex;
		flex-direction: column;
	}
	
	.audit-log-section h1 {
		flex-shrink: 0;
	}
	
	.audit-log-section :global(.audit-log-viewer) {
		flex: 1;
		background: var(--bg-secondary);
		border-radius: 8px;
		overflow: hidden;
	}
	
	/* AutoMod Section */
	.automod-section {
		min-height: 400px;
	}
	
	/* Placeholder Section */
	.placeholder-section {
		text-align: center;
		padding: 60px 20px;
	}
	
	.placeholder-icon {
		font-size: 64px;
		margin-bottom: 16px;
	}
	
	.placeholder-section h3 {
		font-size: 24px;
		margin-bottom: 8px;
	}
	
	.placeholder-section p {
		color: var(--text-secondary);
	}
	
	.coming-soon {
		margin-top: 16px;
		padding: 8px 16px;
		background: var(--bg-secondary);
		border-radius: 20px;
		display: inline-block;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	
	/* Danger Zone */
	.danger-zone {
		padding: 24px;
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid rgba(242, 63, 67, 0.3);
		border-radius: 8px;
	}
	
	.danger-warning {
		display: flex;
		gap: 16px;
		margin-bottom: 20px;
	}
	
	.warning-icon {
		font-size: 32px;
	}
	
	.danger-warning h3 {
		color: var(--status-danger);
		margin-bottom: 4px;
	}
	
	.danger-warning p {
		color: var(--text-secondary);
		font-size: 14px;
	}
	
	.no-permission {
		padding: 24px;
		background: var(--bg-secondary);
		border-radius: 8px;
		text-align: center;
		color: var(--text-muted);
	}
	
	/* Toggle */
	.toggle-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 0;
		border-bottom: 1px solid var(--bg-modifier-accent);
	}
	
	.toggle-item:last-child {
		border-bottom: none;
	}
	
	.toggle-label {
		display: block;
		font-size: 16px;
		color: var(--text-primary);
		margin-bottom: 4px;
	}
	
	.toggle-description {
		font-size: 14px;
		color: var(--text-muted);
	}
	
	.toggle {
		position: relative;
		display: inline-block;
		width: 40px;
		height: 24px;
		flex-shrink: 0;
	}
	
	.toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	
	.toggle-slider {
		position: absolute;
		cursor: pointer;
		inset: 0;
		background: var(--bg-modifier-accent);
		border-radius: 24px;
		transition: background 0.2s;
	}
	
	.toggle-slider::before {
		content: '';
		position: absolute;
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
	}
	
	.toggle input:checked + .toggle-slider {
		background: var(--brand-primary);
	}
	
	.toggle input:checked + .toggle-slider::before {
		transform: translateX(16px);
	}
	
	/* Close Button */
	.close-btn {
		position: absolute;
		top: 60px;
		right: 40px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
	}
	
	.close-btn:hover {
		color: var(--text-primary);
	}
	
	.close-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid currentColor;
		border-radius: 50%;
	}
	
	.close-keybind {
		font-size: 12px;
		font-weight: 600;
	}
	
	/* Modal Styles */
	.delete-modal,
	.create-channel-modal,
	.edit-channel-modal {
		padding: 16px;
		max-width: 440px;
	}
	
	.delete-modal h2,
	.create-channel-modal h2,
	.edit-channel-modal h2 {
		font-size: 20px;
		margin-bottom: 16px;
		color: var(--text-primary);
	}
	
	.delete-modal p {
		color: var(--text-secondary);
		margin-bottom: 16px;
	}
	
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 24px;
	}
	
	/* Channel Type Select */
	.channel-type-select {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 20px;
	}
	
	.channel-type-option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--bg-secondary);
		border: 2px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}
	
	.channel-type-option.selected {
		border-color: var(--brand-primary);
	}
	
	.channel-type-option input[type="radio"] {
		display: none;
	}
	
	.type-icon {
		font-size: 24px;
		color: var(--text-muted);
	}
	
	.type-name {
		display: block;
		font-weight: 600;
		color: var(--text-primary);
	}
	
	.type-desc {
		font-size: 12px;
		color: var(--text-muted);
	}
	
	.channel-name-input {
		display: flex;
		align-items: center;
		background: var(--bg-tertiary);
		border-radius: 4px;
		overflow: hidden;
	}
	
	.channel-name-input .prefix {
		padding: 10px 0 10px 12px;
		color: var(--text-muted);
		font-size: 18px;
	}
	
	.channel-name-input input {
		flex: 1;
		padding: 10px 12px 10px 4px;
		background: transparent;
		border: none;
	}
	
	/* Responsive */
	@media (max-width: 1024px) {
		.settings-sidebar {
			width: 180px;
			padding: 40px 6px 40px 12px;
		}
		
		.sidebar-content {
			width: 100%;
		}
		
		.settings-content {
			padding: 40px 20px 60px;
		}
		
		.overview-grid {
			grid-template-columns: 1fr;
			gap: 24px;
		}
		
		.close-btn {
			top: 20px;
			right: 20px;
		}
	}
	
	@media (max-width: 768px) {
		.settings-container {
			flex-direction: column;
		}
		
		.settings-sidebar {
			width: 100%;
			padding: 16px;
			justify-content: flex-start;
			overflow-x: auto;
		}
		
		.sidebar-content {
			display: flex;
			gap: 8px;
			align-items: center;
		}
		
		.sidebar-header {
			padding: 6px 10px;
		}
		
		.sidebar-divider {
			display: none;
		}
		
		.sidebar-item {
			white-space: nowrap;
			margin-bottom: 0;
		}
	}
</style>
