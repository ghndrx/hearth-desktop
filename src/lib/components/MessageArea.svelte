<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { messages, activeChannel, websocket, currentUser } from '$stores';
	import { loadMessages, addMessage, sendMessage as sendMessageFn, sendTypingIndicator, editMessage, deleteMessage } from '$lib/stores/messages';
	import type { Message } from '$lib/stores/messages';
	import TypingIndicator from './TypingIndicator.svelte';
	import EmojiPicker from './EmojiPicker.svelte';

	let messageInput = '';
	let messagesContainer: HTMLDivElement;
	let textareaEl: HTMLTextAreaElement;
	let unsubscribeWS: (() => void) | null = null;
	let lastTypingTime = 0;
	
	// Reply state
	let replyingTo: Message | null = null;
	
	// Edit state
	let editingMessage: Message | null = null;
	let editContent = '';
	
	// Message actions hover state
	let hoveredMessageId: string | null = null;
	
	// Emoji picker
	let showEmojiPicker = false;

	$: channelMessages = $activeChannel
		? $messages[$activeChannel.id] || []
		: [];

	$: if ($activeChannel) {
		loadMessages($activeChannel.id);
		// Clear reply state when changing channels
		replyingTo = null;
		editingMessage = null;
	}

	onMount(() => {
		unsubscribeWS = websocket.on('MESSAGE_CREATE', (event) => {
			const message = event.data as Message;
			addMessage(message);
			scrollToBottom();
		});
	});

	onDestroy(() => {
		unsubscribeWS?.();
	});

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 0);
	}
	
	function scrollToMessage(messageId: string) {
		const el = messagesContainer?.querySelector(`[data-message-id="${messageId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			// Flash highlight
			el.classList.add('message-highlight');
			setTimeout(() => el.classList.remove('message-highlight'), 1500);
		}
	}

	async function handleSendMessage() {
		if (!messageInput.trim() || !$activeChannel) return;

		const content = messageInput.trim();
		const replyToId = replyingTo?.id;
		
		messageInput = '';
		replyingTo = null;
		
		await sendMessageFn($activeChannel.id, content, [], replyToId);
	}
	
	function startReply(message: Message) {
		replyingTo = message;
		editingMessage = null;
		tick().then(() => textareaEl?.focus());
	}
	
	function cancelReply() {
		replyingTo = null;
	}
	
	function startEdit(message: Message) {
		editingMessage = message;
		editContent = message.content;
		replyingTo = null;
	}
	
	function cancelEdit() {
		editingMessage = null;
		editContent = '';
	}
	
	async function saveEdit() {
		if (!editingMessage || !$activeChannel) return;
		await editMessage(editingMessage.id, $activeChannel.id, editContent);
		cancelEdit();
	}
	
	async function handleDelete(message: Message) {
		if (!$activeChannel) return;
		if (confirm('Delete this message? This cannot be undone.')) {
			await deleteMessage(message.id, $activeChannel.id);
		}
	}
	
	function handleEmojiSelect(emoji: string) {
		messageInput += emoji;
		showEmojiPicker = false;
		textareaEl?.focus();
	}

	function handleInput() {
		// Send typing indicator (throttled to every 3 seconds)
		const now = Date.now();
		if (now - lastTypingTime > 3000 && $activeChannel) {
			lastTypingTime = now;
			sendTypingIndicator($activeChannel.id);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
		if (event.key === 'Escape') {
			if (replyingTo) cancelReply();
			if (editingMessage) cancelEdit();
		}
	}
	
	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			saveEdit();
		}
		if (event.key === 'Escape') {
			cancelEdit();
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		}
		return date.toLocaleDateString();
	}

	function shouldShowDateDivider(messages: Message[], index: number): boolean {
		if (index === 0) return true;
		const current = new Date(messages[index].created_at).toDateString();
		const previous = new Date(messages[index - 1].created_at).toDateString();
		return current !== previous;
	}

	function shouldGroupWithPrevious(messages: Message[], index: number): boolean {
		if (index === 0) return false;
		const current = messages[index];
		const previous = messages[index - 1];

		// Don't group if this is a reply
		if (current.reply_to) return false;

		// Same author and within 7 minutes
		if (current.author_id !== previous.author_id) return false;
		const timeDiff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
		return timeDiff < 7 * 60 * 1000;
	}
	
	function isOwnMessage(message: Message): boolean {
		return message.author_id === $currentUser?.id;
	}
	
	function truncateText(text: string, maxLen: number): string {
		if (!text) return '';
		if (text.length <= maxLen) return text;
		return text.slice(0, maxLen) + '…';
	}
</script>

<div class="flex-1 flex flex-col bg-dark-700 min-w-0">
	{#if $activeChannel}
		<!-- Channel header -->
		<header class="h-12 px-4 flex items-center border-b border-dark-900 shadow-sm shrink-0">
			<span class="text-xl text-gray-400 mr-2">#</span>
			<h1 class="font-semibold text-white">{$activeChannel.name}</h1>
			{#if $activeChannel.topic}
				<div class="mx-4 w-px h-6 bg-dark-500"></div>
				<p class="text-sm text-gray-400 truncate">{$activeChannel.topic}</p>
			{/if}
		</header>

		<!-- Messages -->
		<div
			class="flex-1 overflow-y-auto px-4 py-4"
			bind:this={messagesContainer}
		>
			{#each channelMessages as message, index (message.id)}
				{#if shouldShowDateDivider(channelMessages, index)}
					<div class="flex items-center my-4">
						<div class="flex-1 h-px bg-dark-500"></div>
						<span class="px-4 text-xs text-gray-500 font-medium">
							{formatDate(message.created_at)}
						</span>
						<div class="flex-1 h-px bg-dark-500"></div>
					</div>
				{/if}

				<div
					class="group relative -mx-4 px-4 py-0.5 transition-colors hover:bg-dark-600/30"
					class:mt-4={!shouldGroupWithPrevious(channelMessages, index)}
					class:replying-to={replyingTo?.id === message.id}
					data-message-id={message.id}
					on:mouseenter={() => hoveredMessageId = message.id}
					on:mouseleave={() => hoveredMessageId = null}
				>
					<!-- Reply context (if this message is a reply) -->
					{#if message.reply_to}
						<button 
							class="flex items-center gap-2 ml-14 mb-1 text-sm text-gray-400 hover:text-gray-200 cursor-pointer"
							on:click={() => scrollToMessage(message.reply_to || '')}
						>
							<svg class="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
									d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
							</svg>
							<span class="font-medium text-hearth-400">
								@{message.reply_to_author?.username || 'Unknown'}
							</span>
							<span class="text-gray-500 truncate max-w-xs">
								{truncateText(message.reply_to_content || '', 60)}
							</span>
						</button>
					{/if}
					
					{#if !shouldGroupWithPrevious(channelMessages, index)}
						<div class="flex items-start gap-4">
							<div class="w-10 h-10 rounded-full bg-hearth-500 flex items-center justify-center shrink-0">
								<span class="text-sm font-medium text-white">
									{message.author?.username?.charAt(0).toUpperCase() || 'U'}
								</span>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-baseline gap-2">
									<span class="font-medium text-white hover:underline cursor-pointer">
										{message.author?.username || 'Unknown'}
									</span>
									<span class="text-xs text-gray-500">
										{formatTime(message.created_at)}
									</span>
									{#if message.edited_at}
										<span class="text-xs text-gray-600" title="Edited {new Date(message.edited_at).toLocaleString()}">
											(edited)
										</span>
									{/if}
								</div>
								
								{#if editingMessage?.id === message.id}
									<div class="mt-1">
										<textarea
											class="w-full bg-dark-800 rounded-lg px-3 py-2 text-gray-100 border border-dark-500 focus:border-hearth-500 focus:outline-none resize-none"
											bind:value={editContent}
											on:keydown={handleEditKeydown}
											rows="2"
										></textarea>
										<div class="text-xs text-gray-500 mt-1">
											escape to <button class="text-hearth-400 hover:underline" on:click={cancelEdit}>cancel</button>
											 • enter to <button class="text-hearth-400 hover:underline" on:click={saveEdit}>save</button>
										</div>
									</div>
								{:else}
									<p class="text-gray-200 break-words whitespace-pre-wrap">{message.content}</p>
								{/if}
							</div>
						</div>
					{:else}
						<div class="flex items-start gap-4">
							<span class="w-10 text-center text-xs text-gray-600 opacity-0 group-hover:opacity-100 pt-1">
								{formatTime(message.created_at)}
							</span>
							{#if editingMessage?.id === message.id}
								<div class="flex-1">
									<textarea
										class="w-full bg-dark-800 rounded-lg px-3 py-2 text-gray-100 border border-dark-500 focus:border-hearth-500 focus:outline-none resize-none"
										bind:value={editContent}
										on:keydown={handleEditKeydown}
										rows="2"
									></textarea>
									<div class="text-xs text-gray-500 mt-1">
										escape to <button class="text-hearth-400 hover:underline" on:click={cancelEdit}>cancel</button>
										 • enter to <button class="text-hearth-400 hover:underline" on:click={saveEdit}>save</button>
									</div>
								</div>
							{:else}
								<p class="text-gray-200 break-words whitespace-pre-wrap">{message.content}</p>
								{#if message.edited_at}
									<span class="text-xs text-gray-600 ml-1" title="Edited {new Date(message.edited_at).toLocaleString()}">
										(edited)
									</span>
								{/if}
							{/if}
						</div>
					{/if}
					
					<!-- Message action buttons (hover) -->
					{#if hoveredMessageId === message.id && !editingMessage}
						<div class="absolute right-4 -top-3 flex items-center gap-0.5 bg-dark-800 rounded-md border border-dark-500 shadow-lg">
							<button 
								class="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-dark-600 rounded"
								title="Add Reaction"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
										d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</button>
							<button 
								class="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-dark-600 rounded"
								title="Reply"
								on:click={() => startReply(message)}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
										d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
								</svg>
							</button>
							{#if isOwnMessage(message)}
								<button 
									class="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-dark-600 rounded"
									title="Edit"
									on:click={() => startEdit(message)}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
											d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>
								<button 
									class="p-1.5 text-gray-400 hover:text-red-400 hover:bg-dark-600 rounded"
									title="Delete"
									on:click={() => handleDelete(message)}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if channelMessages.length === 0 && !$messages.loading}
				<div class="flex flex-col items-center justify-center h-full text-center">
					<div class="w-16 h-16 rounded-full bg-dark-600 flex items-center justify-center mb-4">
						<span class="text-4xl">#</span>
					</div>
					<h3 class="text-2xl font-bold text-white mb-2">
						Welcome to #{$activeChannel.name}!
					</h3>
					<p class="text-gray-400">
						This is the start of the #{$activeChannel.name} channel.
					</p>
				</div>
			{/if}
		</div>

		<!-- Typing indicator + Reply banner + Message input -->
		<div class="px-4 pb-6 shrink-0">
			<TypingIndicator channelId={$activeChannel.id} />
			
			<!-- Reply banner -->
			{#if replyingTo}
				<div class="flex items-center justify-between bg-dark-800 border-l-2 border-hearth-500 px-3 py-2 rounded-t-lg">
					<div class="flex items-center gap-2 text-sm overflow-hidden">
						<svg class="w-4 h-4 text-hearth-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
								d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
						</svg>
						<span class="text-gray-400">Replying to</span>
						<span class="text-hearth-400 font-medium">@{replyingTo.author?.username}</span>
						<span class="text-gray-500 truncate">{truncateText(replyingTo.content, 50)}</span>
					</div>
					<button 
						class="text-gray-400 hover:text-gray-200 p-1"
						on:click={cancelReply}
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}
			
			<div class="bg-dark-600 flex items-end" class:rounded-lg={!replyingTo} class:rounded-b-lg={replyingTo}>
				<button class="p-3 text-gray-400 hover:text-gray-200">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M12 4v16m8-8H4" />
					</svg>
				</button>
				<textarea
					bind:this={textareaEl}
					class="flex-1 bg-transparent border-0 resize-none py-3 px-2 text-gray-100
					       placeholder-gray-500 focus:ring-0 max-h-48"
					placeholder={replyingTo 
						? `Reply to @${replyingTo.author?.username}...`
						: `Message #${$activeChannel.name}`}
					rows="1"
					bind:value={messageInput}
					on:input={handleInput}
					on:keydown={handleKeydown}
				></textarea>
				<div class="flex items-center gap-1 p-2 relative">
					<button 
						class="p-1.5 text-gray-400 hover:text-gray-200"
						on:click={() => showEmojiPicker = !showEmojiPicker}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</button>
					{#if showEmojiPicker}
						<div class="absolute bottom-12 right-0 z-50">
							<EmojiPicker 
								on:select={(e) => handleEmojiSelect(e.detail)}
								on:close={() => showEmojiPicker = false}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<!-- No channel selected -->
		<div class="flex flex-col items-center justify-center h-full text-center p-8">
			<div class="w-24 h-24 rounded-full bg-dark-600 flex items-center justify-center mb-6">
				<svg class="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
				</svg>
			</div>
			<h2 class="text-2xl font-bold text-white mb-2">Welcome to Hearth</h2>
			<p class="text-gray-400 max-w-md">
				Select a server from the sidebar and choose a channel to start chatting.
			</p>
		</div>
	{/if}
</div>

<style>
	.message-highlight {
		animation: highlight-flash 1.5s ease-out;
	}
	
	@keyframes highlight-flash {
		0% { background-color: rgba(239, 68, 68, 0.3); }
		100% { background-color: transparent; }
	}
	
	.replying-to {
		background-color: rgba(239, 68, 68, 0.1) !important;
	}
</style>
