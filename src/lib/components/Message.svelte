<script context="module" lang="ts">
	const avatarColors = [
		'#5865f2', '#eb459e', '#3ba55d', '#f23f43', 
		'#faa61a', '#2d8dd6', '#99aab5', '#747f8d'
	];

	export function getAvatarColor(username: string): string {
		let hash = 0;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + ((hash << 5) - hash);
		}
		return avatarColors[Math.abs(hash) % avatarColors.length];
	}
	
	function formatTime(date: string | Date, format: 'short' | 'long' = 'short'): string {
		const d = new Date(date);
		if (format === 'short') {
			return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		}
		return d.toLocaleDateString(undefined, { 
			weekday: 'long', 
			year: 'numeric', 
			month: 'long', 
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
	
	function parseMessage(content: string): string {
		if (!content) return '';
		
		let html = content
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		
		html = html
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.+?)\*/g, '<em>$1</em>')
			.replace(/`(.+?)`/g, '<code class="bg-[#2b2d31] px-1 py-0.5 rounded text-sm">$1</code>')
			.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="text-[#00a8fc] hover:underline">$1</a>')
			.replace(/\n/g, '<br>');
		
		return html;
	}
	
	function formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let message: any;
	export let grouped = false;
	export let isOwn = false;
	export let roleColor: string | null = null;
	
	const dispatch = createEventDispatcher();
	
	let showActions = false;
	let editing = false;
	let editContent = message.content;
	
	function handleReaction(emoji: string) {
		dispatch('react', { messageId: message.id, emoji });
	}
	
	function startEdit() {
		editing = true;
		editContent = message.content;
	}
	
	function cancelEdit() {
		editing = false;
		editContent = message.content;
	}
	
	function saveEdit() {
		if (editContent.trim() !== message.content) {
			dispatch('edit', { messageId: message.id, content: editContent.trim() });
		}
		editing = false;
	}
	
	function handleDelete() {
		if (confirm('Are you sure you want to delete this message?')) {
			dispatch('delete', { messageId: message.id });
		}
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') cancelEdit();
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
	}
	
	$: displayName = message.author?.display_name || message.author?.username || 'Unknown';
	$: avatarUrl = message.author?.avatar;
	$: timestamp = formatTime(message.created_at, 'long');
	$: shortTime = formatTime(message.created_at, 'short');
	$: isEdited = !!message.edited_at;
	$: usernameColor = roleColor || message.author?.role_color || '#f2f3f5';
</script>

<div
	class="flex relative px-0 py-0.5 hover:bg-[#2e3035] group transition-colors"
	class:mt-4={!grouped}
	on:mouseenter={() => (showActions = true)}
	on:mouseleave={() => (showActions = false)}
>
	{#if !grouped}
		<!-- Avatar (40px) -->
		<div class="w-10 h-10 mr-4 ml-4 mt-0.5 flex-shrink-0">
			{#if avatarUrl}
				<img 
					src={avatarUrl} 
					alt={displayName}
					class="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
				/>
			{:else}
				<div 
					class="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
					style="background-color: {getAvatarColor(displayName)}"
				>
					<span class="text-white font-semibold text-base">
						{displayName.charAt(0).toUpperCase()}
					</span>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Timestamp gutter for grouped messages -->
		<div class="w-10 mr-4 ml-4 flex-shrink-0 flex items-start justify-center pt-1">
			<span class="text-[11px] text-[#949ba4] opacity-0 group-hover:opacity-100 transition-opacity">
				{shortTime}
			</span>
		</div>
	{/if}
	
	<div class="flex-1 min-w-0 py-0.5 pr-4">
		{#if !grouped}
			<!-- Header with author name and timestamp -->
			<div class="flex items-baseline gap-2 mb-0.5">
				<span 
					class="font-medium text-base cursor-pointer hover:underline"
					style="color: {usernameColor}"
				>
					{displayName}
				</span>
				<span class="text-xs text-[#949ba4] cursor-default" title={timestamp}>
					{shortTime}
				</span>
				{#if isEdited}
					<span class="text-[10px] text-[#949ba4]" title="Edited {formatTime(message.edited_at, 'long')}">(edited)</span>
				{/if}
			</div>
		{/if}
		
		<!-- Reply context -->
		{#if message.reply_to}
			<div class="flex items-center gap-1 text-sm text-[#949ba4] mb-1 ml-1">
				<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" class="text-[#b5bac1]">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
				</svg>
				<span class="text-[#b5bac1] font-medium">{message.reply_to_author?.username || 'Unknown'}</span>
				<span class="truncate">{message.reply_to_content}</span>
			</div>
		{/if}
		
		<!-- Message content -->
		{#if editing}
			<div class="mt-1">
				<textarea
					bind:value={editContent}
					on:keydown={handleKeydown}
					autofocus
					class="w-full min-h-[44px] p-3 bg-[#383a40] rounded-lg text-[#f2f3f5] text-base resize-none border-0 focus:outline-none"
				></textarea>
				<div class="text-xs text-[#949ba4] mt-1">
					escape to <button on:click={cancelEdit} class="text-[#00a8fc] hover:underline">cancel</button> • enter to <button on:click={saveEdit} class="text-[#00a8fc] hover:underline">save</button>
				</div>
			</div>
		{:else}
			<div class="text-[#dbdee1] text-base leading-[1.375rem] break-words">
				{@html parseMessage(message.content)}
			</div>
		{/if}
		
		<!-- Attachments -->
		{#if message.attachments?.length > 0}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each message.attachments as attachment}
					{#if attachment.content_type?.startsWith('image/')}
						<img 
							src={attachment.url} 
							alt={attachment.filename}
							class="max-w-[400px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
						/>
					{:else}
						<a 
							href={attachment.url} 
							class="flex items-center gap-3 p-3 bg-[#2b2d31] rounded-lg text-[#f2f3f5] hover:bg-[#383a40] transition-colors"
							download
						>
							<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="text-[#949ba4]">
								<path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
							</svg>
							<div class="flex flex-col">
								<span class="text-sm font-medium">{attachment.filename}</span>
								<span class="text-xs text-[#949ba4]">{formatSize(attachment.size)}</span>
							</div>
						</a>
					{/if}
				{/each}
			</div>
		{/if}
		
		<!-- Reactions -->
		{#if message.reactions?.length > 0}
			<div class="flex flex-wrap gap-1 mt-1">
				{#each message.reactions as reaction}
					<button 
						class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm transition-colors border"
						class:reaction-active={reaction.me}
						class:reaction-inactive={!reaction.me}
						on:click={() => handleReaction(reaction.emoji)}
					>
						<span>{reaction.emoji}</span>
						<span class="text-xs" class:text-[#dbdee1]={reaction.me} class:text-[#949ba4]={!reaction.me}>{reaction.count}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
	
	<!-- Message Actions -->
	{#if showActions && !editing}
		<div class="absolute right-4 -top-4 flex gap-1 bg-[#313338] border border-[#1e1f22] rounded-md p-0.5 shadow-md">
			<button 
				class="p-1.5 hover:bg-[#383a40] rounded text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
				on:click={() => handleReaction('👍')}
				title="Add Reaction"
			>
				👍
			</button>
			{#if isOwn}
				<button 
					class="p-1.5 hover:bg-[#383a40] rounded text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
					on:click={startEdit}
					title="Edit"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
					</svg>
				</button>
				<button 
					class="p-1.5 hover:bg-[#f23f43] hover:text-white rounded text-[#b5bac1] transition-colors"
					on:click={handleDelete}
					title="Delete"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
.reaction-active {
	background-color: rgba(88, 101, 242, 0.3);
	border-color: #5865f2;
}
.reaction-inactive {
	background-color: #2b2d31;
	border-color: transparent;
}
</style>
