<script lang="ts">
	/**
	 * SortableChannelList Component
	 * 
	 * A drag-and-drop enabled channel list for reordering channels within a server.
	 * Supports categories, text channels, and voice channels with visual drag feedback.
	 */
	
	import { createEventDispatcher } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { 
		serverChannels, 
		updateChannel,
		type Channel 
	} from '$lib/stores/channels';
	import { currentServer } from '$lib/stores/servers';
	import { user } from '$lib/stores/auth';
	import { api } from '$lib/api';
	import ChannelCategory from './ChannelCategory.svelte';

	export let editable = false;

	const dispatch = createEventDispatcher<{
		reorder: { channels: Channel[] };
		channelClick: Channel;
		createChannel: { type: 'text' | 'voice' | 'category'; parentId?: string };
		editChannel: Channel;
	}>();

	// Drag state
	let draggedChannel: Channel | null = null;
	let dragOverId: string | null = null;
	let dragOverPosition: 'before' | 'after' | 'inside' | null = null;

	// Channel type constants
	const TYPE_TEXT = 0;
	const TYPE_VOICE = 2;
	const TYPE_CATEGORY = 4;

	$: isOwner = $currentServer?.owner_id === $user?.id;
	$: canReorder = editable && isOwner;

	// Group channels by category
	$: categorizedChannels = organizeChannels($serverChannels);

	interface ChannelGroup {
		category: Channel | null;
		channels: Channel[];
	}

	function organizeChannels(channels: Channel[]): ChannelGroup[] {
		const groups: ChannelGroup[] = [];
		const categories = channels.filter(c => c.type === TYPE_CATEGORY).sort((a, b) => a.position - b.position);
		const uncategorized: Channel[] = [];

		// First, collect channels without a parent
		for (const channel of channels) {
			if (channel.type === TYPE_CATEGORY) continue;
			if (!channel.parent_id) {
				uncategorized.push(channel);
			}
		}

		// Add uncategorized channels first
		if (uncategorized.length > 0) {
			groups.push({
				category: null,
				channels: uncategorized.sort((a, b) => a.position - b.position)
			});
		}

		// Then add each category with its children
		for (const category of categories) {
			const children = channels
				.filter(c => c.parent_id === category.id && c.type !== TYPE_CATEGORY)
				.sort((a, b) => a.position - b.position);
			
			groups.push({
				category,
				channels: children
			});
		}

		return groups;
	}

	// Drag handlers
	function handleDragStart(event: DragEvent, channel: Channel | null) {
		if (!canReorder || !channel) return;
		
		draggedChannel = channel;
		
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', channel.id);
		}

		// Add visual feedback
		const target = event.target as HTMLElement;
		setTimeout(() => target.classList.add('dragging'), 0);
	}

	function handleDragEnd(event: DragEvent) {
		draggedChannel = null;
		dragOverId = null;
		dragOverPosition = null;
		
		const target = event.target as HTMLElement;
		target.classList.remove('dragging');
	}

	function handleDragOver(event: DragEvent, channel: Channel | null) {
		if (!draggedChannel || !canReorder || !channel) return;
		if (draggedChannel.id === channel.id) return;

		event.preventDefault();
		
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const y = event.clientY - rect.top;
		const height = rect.height;

		// Determine position based on mouse location
		if (channel.type === TYPE_CATEGORY) {
			// For categories, allow dropping inside
			if (y < height * 0.25) {
				dragOverPosition = 'before';
			} else if (y > height * 0.75) {
				dragOverPosition = 'after';
			} else {
				dragOverPosition = 'inside';
			}
		} else {
			// For regular channels, before/after only
			dragOverPosition = y < height / 2 ? 'before' : 'after';
		}

		dragOverId = channel.id;

		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDragLeave() {
		dragOverId = null;
		dragOverPosition = null;
	}

	async function handleDrop(event: DragEvent, targetChannel: Channel | null) {
		event.preventDefault();
		
		if (!draggedChannel || !canReorder || !$currentServer || !targetChannel) return;
		if (draggedChannel.id === targetChannel.id) {
			resetDragState();
			return;
		}

		const updates: { id: string; position?: number; parent_id?: string | null }[] = [];
		let newChannels = [...$serverChannels];

		// Calculate new position and parent
		if (targetChannel.type === TYPE_CATEGORY && dragOverPosition === 'inside') {
			// Moving into a category
			const categoryChildren = newChannels.filter(c => c.parent_id === targetChannel.id);
			const newPosition = categoryChildren.length > 0 
				? Math.max(...categoryChildren.map(c => c.position)) + 1 
				: 0;

			updates.push({
				id: draggedChannel.id,
				position: newPosition,
				parent_id: targetChannel.id
			});
		} else {
			// Moving before/after a channel
			const targetIndex = newChannels.findIndex(c => c.id === targetChannel.id);
			const draggedIndex = newChannels.findIndex(c => c.id === draggedChannel!.id);

			// Remove dragged from current position
			newChannels.splice(draggedIndex, 1);

			// Calculate new index
			let insertIndex = targetIndex;
			if (draggedIndex < targetIndex) insertIndex--;
			if (dragOverPosition === 'after') insertIndex++;

			// Insert at new position
			newChannels.splice(insertIndex, 0, draggedChannel);

			// Update parent_id if needed (inherit from target or target's parent)
			const newParentId = targetChannel.type === TYPE_CATEGORY 
				? null 
				: targetChannel.parent_id;

			// Recalculate positions for affected channels
			const sameParentChannels = newChannels.filter(c => 
				c.parent_id === newParentId && c.type !== TYPE_CATEGORY
			);

			sameParentChannels.forEach((ch, idx) => {
				if (ch.position !== idx || (ch.id === draggedChannel!.id && ch.parent_id !== newParentId)) {
					updates.push({
						id: ch.id,
						position: idx,
						parent_id: ch.id === draggedChannel!.id ? newParentId : undefined
					});
				}
			});
		}

		// Apply updates
		try {
			for (const update of updates) {
				await api.patch(`/channels/${update.id}`, {
					position: update.position,
					parent_id: update.parent_id
				});
			}

			dispatch('reorder', { channels: newChannels });
		} catch (error) {
			console.error('Failed to reorder channels:', error);
		}

		resetDragState();
	}

	function resetDragState() {
		draggedChannel = null;
		dragOverId = null;
		dragOverPosition = null;
	}

	function getChannelIcon(type: number): string {
		switch (type) {
			case TYPE_TEXT: return '#';
			case TYPE_VOICE: return '🔊';
			case TYPE_CATEGORY: return '📁';
			default: return '#';
		}
	}

	function handleChannelClick(channel: Channel) {
		dispatch('channelClick', channel);
	}

	function handleEditChannel(channel: Channel) {
		dispatch('editChannel', channel);
	}

	function handleCreateInCategory(categoryId: string | null, type: 'text' | 'voice') {
		dispatch('createChannel', { 
			type, 
			parentId: categoryId || undefined 
		});
	}
</script>

<div class="sortable-channel-list" class:editable={canReorder}>
	{#each categorizedChannels as group (group.category?.id || 'uncategorized')}
		<!-- Category Header (if exists) -->
		{#if group.category}
			<div
				class="channel-item category"
				class:drag-over={dragOverId === group.category.id}
				class:drag-over-before={dragOverId === group.category.id && dragOverPosition === 'before'}
				class:drag-over-after={dragOverId === group.category.id && dragOverPosition === 'after'}
				class:drag-over-inside={dragOverId === group.category.id && dragOverPosition === 'inside'}
				draggable={canReorder}
				on:dragstart={(e) => handleDragStart(e, group.category)}
				on:dragend={handleDragEnd}
				on:dragover={(e) => handleDragOver(e, group.category)}
				on:dragleave={handleDragLeave}
				on:drop={(e) => handleDrop(e, group.category)}
				role="button"
				tabindex="0"
			>
				<span class="collapse-icon">▸</span>
				<span class="category-name">{group.category.name.toUpperCase()}</span>
				{#if canReorder}
					<div class="category-actions">
						<button
							class="action-btn"
							title="Add text channel"
							on:click|stopPropagation={() => handleCreateInCategory(group.category?.id || null, 'text')}
						>
							+
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Channels in this group -->
		<div class="channel-group" class:has-category={!!group.category}>
			{#each group.channels as channel (channel.id)}
				<div
					class="channel-item"
					class:text={channel.type === TYPE_TEXT}
					class:voice={channel.type === TYPE_VOICE}
					class:drag-over={dragOverId === channel.id}
					class:drag-over-before={dragOverId === channel.id && dragOverPosition === 'before'}
					class:drag-over-after={dragOverId === channel.id && dragOverPosition === 'after'}
					draggable={canReorder}
					animate:flip={{ duration: 200 }}
					on:dragstart={(e) => handleDragStart(e, channel)}
					on:dragend={handleDragEnd}
					on:dragover={(e) => handleDragOver(e, channel)}
					on:dragleave={handleDragLeave}
					on:drop={(e) => handleDrop(e, channel)}
					on:click={() => handleChannelClick(channel)}
					on:keydown={(e) => e.key === 'Enter' && handleChannelClick(channel)}
					role="button"
					tabindex="0"
				>
					{#if canReorder}
						<span class="drag-handle">⋮⋮</span>
					{/if}
					<span class="channel-icon">{getChannelIcon(channel.type)}</span>
					<span class="channel-name">{channel.name}</span>
					{#if channel.nsfw}
						<span class="badge nsfw">NSFW</span>
					{/if}
					{#if canReorder}
						<button
							class="edit-btn"
							title="Edit channel"
							on:click|stopPropagation={() => handleEditChannel(channel)}
						>
							✏️
						</button>
					{/if}
				</div>
			{/each}

			{#if group.channels.length === 0}
				<div class="empty-category">
					No channels
				</div>
			{/if}
		</div>
	{/each}

	{#if categorizedChannels.length === 0}
		<div class="empty-state">
			<span class="empty-icon">#</span>
			<p>No channels yet</p>
		</div>
	{/if}
</div>

<style>
	.sortable-channel-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
	}

	.channel-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.15s ease;
		user-select: none;
		position: relative;
	}

	.channel-item:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.channel-item.category {
		margin-top: 16px;
		padding: 6px 8px;
	}

	.channel-item.category:first-child {
		margin-top: 0;
	}

	.channel-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.channel-group.has-category {
		padding-left: 8px;
	}

	/* Drag states */
	.sortable-channel-list.editable .channel-item {
		cursor: grab;
	}

	.sortable-channel-list.editable .channel-item:active {
		cursor: grabbing;
	}

	.channel-item.drag-over-before::before {
		content: '';
		position: absolute;
		top: -2px;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--blurple, #5865f2);
		border-radius: 2px;
	}

	.channel-item.drag-over-after::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--blurple, #5865f2);
		border-radius: 2px;
	}

	.channel-item.drag-over-inside {
		background: rgba(88, 101, 242, 0.2);
		box-shadow: inset 0 0 0 2px var(--blurple, #5865f2);
	}

	:global(.channel-item.dragging) {
		opacity: 0.5;
	}

	/* Icons and text */
	.drag-handle {
		color: var(--text-muted, #b5bac1);
		font-size: 12px;
		cursor: grab;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.channel-item:hover .drag-handle {
		opacity: 1;
	}

	.collapse-icon {
		font-size: 10px;
		color: var(--text-muted, #b5bac1);
	}

	.channel-icon {
		color: var(--text-muted, #b5bac1);
		font-size: 18px;
		width: 20px;
		text-align: center;
		flex-shrink: 0;
	}

	.channel-name {
		flex: 1;
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.category-name {
		flex: 1;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
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

	/* Action buttons */
	.category-actions,
	.edit-btn {
		opacity: 0;
		transition: opacity 0.15s;
	}

	.channel-item:hover .category-actions,
	.channel-item:hover .edit-btn {
		opacity: 1;
	}

	.action-btn,
	.edit-btn {
		background: none;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		padding: 2px 6px;
		font-size: 14px;
	}

	.action-btn:hover,
	.edit-btn:hover {
		color: var(--text-normal, #f2f3f5);
	}

	/* Empty states */
	.empty-category {
		padding: 8px 12px 8px 36px;
		font-size: 13px;
		color: var(--text-muted, #b5bac1);
		font-style: italic;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		color: var(--text-muted, #b5bac1);
	}

	.empty-icon {
		font-size: 48px;
		opacity: 0.5;
		margin-bottom: 8px;
	}
</style>
