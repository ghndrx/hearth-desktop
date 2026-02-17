<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { voiceChannelStates, type VoiceUser } from '$lib/stores/voice';
	import { user as authUser } from '$lib/stores/auth';
	import VoiceParticipant from './VoiceParticipant.svelte';
	import ContextMenu from './ContextMenu.svelte';
	import ContextMenuItem from './ContextMenuItem.svelte';

	export let channelId: string;
	export let isAdmin = false;
	export let canMuteOthers = false;

	const dispatch = createEventDispatcher<{
		muteUser: { userId: string };
		kickUser: { userId: string };
		openProfile: { userId: string };
	}>();

	// Context menu state
	let contextMenuOpen = false;
	let contextMenuPosition = { x: 0, y: 0 };
	let contextMenuUser: VoiceUser | null = null;

	$: users = $voiceChannelStates[channelId] || [];
	$: sortedUsers = [...users].sort((a, b) => {
		// Current user first
		const currentUserId = $authUser?.id;
		if (a.id === currentUserId) return -1;
		if (b.id === currentUserId) return 1;
		// Then sort by speaking status (speaking users first)
		if (a.speaking && !b.speaking) return -1;
		if (!a.speaking && b.speaking) return 1;
		// Then alphabetically
		const nameA = (a.display_name || a.username).toLowerCase();
		const nameB = (b.display_name || b.username).toLowerCase();
		return nameA.localeCompare(nameB);
	});

	function handleContextMenu(event: MouseEvent, user: VoiceUser) {
		event.preventDefault();
		if (user.id === $authUser?.id) return; // Don't show context menu for self

		contextMenuUser = user;
		contextMenuPosition = { x: event.clientX, y: event.clientY };
		contextMenuOpen = true;
	}

	function closeContextMenu() {
		contextMenuOpen = false;
		contextMenuUser = null;
	}

	function handleMuteUser() {
		if (contextMenuUser) {
			dispatch('muteUser', { userId: contextMenuUser.id });
		}
		closeContextMenu();
	}

	function handleKickUser() {
		if (contextMenuUser) {
			dispatch('kickUser', { userId: contextMenuUser.id });
		}
		closeContextMenu();
	}

	function handleOpenProfile() {
		if (contextMenuUser) {
			dispatch('openProfile', { userId: contextMenuUser.id });
		}
		closeContextMenu();
	}
</script>

<div class="voice-user-list" role="list" aria-label="Voice channel participants">
	{#if users.length === 0}
		<div class="empty-state">
			<p>No one is in this voice channel</p>
		</div>
	{:else}
		{#each sortedUsers as voiceUser (voiceUser.id)}
			<div
				class="user-wrapper"
				on:contextmenu={(e) => handleContextMenu(e, voiceUser)}
				role="listitem"
			>
				<VoiceParticipant
					user={voiceUser}
					isCurrentUser={voiceUser.id === $authUser?.id}
					showControls={false}
				/>
			</div>
		{/each}
	{/if}
</div>

<!-- Context Menu -->
{#if contextMenuOpen && contextMenuUser}
	<ContextMenu
		x={contextMenuPosition.x}
		y={contextMenuPosition.y}
		on:close={closeContextMenu}
	>
		<ContextMenuItem
			label="View Profile"
			icon="👤"
			on:click={handleOpenProfile}
		/>

		{#if canMuteOthers || isAdmin}
			<ContextMenuItem
				label={contextMenuUser.muted ? 'Unmute User' : 'Mute User'}
				icon="🔇"
				disabled={contextMenuUser.muted}
				on:click={handleMuteUser}
			/>
		{/if}

		{#if isAdmin}
			<ContextMenuItem
				label="Disconnect User"
				icon="⛔"
				danger
				on:click={handleKickUser}
			/>
		{/if}
	</ContextMenu>
{/if}

<style>
	.voice-user-list {
		display: flex;
		flex-direction: column;
		padding: 4px 0;
	}

	.user-wrapper {
		padding: 0 8px;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.empty-state p {
		font-size: 13px;
		color: #949ba4;
		text-align: center;
	}
</style>
