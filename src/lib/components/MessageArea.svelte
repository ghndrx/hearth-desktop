<script lang="ts">
	import { currentChannel } from '$lib/stores/app';
	import MessageInput from './MessageInput.svelte';

	interface Message {
		id: string;
		content: string;
		author: {
			id: string;
			username: string;
			avatar: string | null;
		};
		created_at: string;
		edited_at?: string;
	}

	interface Props {
		messages?: Message[];
	}

	let { messages = [] }: Props = $props();

	let messagesContainer: HTMLDivElement | undefined = $state();

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date(today); // eslint-disable-line svelte/prefer-svelte-reactivity -- local variable
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			return 'Yesterday';
		}
		return date.toLocaleDateString();
	}

	function shouldShowDateDivider(msgs: Message[], index: number): boolean {
		if (index === 0) return true;
		const current = new Date(msgs[index].created_at).toDateString();
		const previous = new Date(msgs[index - 1].created_at).toDateString();
		return current !== previous;
	}

	function shouldGroupWithPrevious(msgs: Message[], index: number): boolean {
		if (index === 0) return false;
		const current = msgs[index];
		const previous = msgs[index - 1];

		if (current.author.id !== previous.author.id) return false;
		const timeDiff =
			new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
		return timeDiff < 7 * 60 * 1000;
	}

	function getAvatarColor(username: string): string {
		let hash = 0;
		for (let i = 0; i < username.length; i++) {
			hash = username.charCodeAt(i) + ((hash << 5) - hash);
		}
		const colors = [
			'#5865f2',
			'#eb459e',
			'#3ba55d',
			'#f23f43',
			'#faa61a',
			'#2d8dd6',
			'#99aab5',
			'#747f8d'
		];
		return colors[Math.abs(hash) % colors.length];
	}

	function handleSendMessage(event: { content: string; attachments: File[] }) {
		// TODO: Send message via API
		console.log('Send message:', event.content);
	}
</script>

<div class="flex-1 flex flex-col bg-dark-700 min-w-0">
	{#if $currentChannel}
		<!-- Channel header -->
		<header class="h-12 px-4 flex items-center border-b border-dark-900 shadow-sm shrink-0">
			<span class="text-xl text-gray-400 mr-2">#</span>
			<h1 class="font-semibold text-white">{$currentChannel.name}</h1>
			{#if $currentChannel.topic}
				<div class="mx-4 w-px h-6 bg-dark-500"></div>
				<p class="text-sm text-gray-400 truncate">{$currentChannel.topic}</p>
			{/if}
		</header>

		<!-- Messages -->
		<div class="flex-1 overflow-y-auto px-4 py-4" bind:this={messagesContainer}>
			{#each messages as message, index (message.id)}
				{#if shouldShowDateDivider(messages, index)}
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
					class:mt-4={!shouldGroupWithPrevious(messages, index)}
				>
					{#if !shouldGroupWithPrevious(messages, index)}
						<div class="flex items-start gap-4">
							<div
								class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
								style="background-color: {getAvatarColor(message.author.username)}"
							>
								{#if message.author.avatar}
									<img
										src={message.author.avatar}
										alt={message.author.username}
										class="w-10 h-10 rounded-full object-cover"
									/>
								{:else}
									<span class="text-sm font-medium text-white">
										{message.author.username.charAt(0).toUpperCase()}
									</span>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-baseline gap-2">
									<span class="font-medium text-white hover:underline cursor-pointer">
										{message.author.username}
									</span>
									<span class="text-xs text-gray-500">
										{formatTime(message.created_at)}
									</span>
									{#if message.edited_at}
										<span
											class="text-xs text-gray-600"
											title="Edited {new Date(message.edited_at).toLocaleString()}"
										>
											(edited)
										</span>
									{/if}
								</div>
								<p class="text-gray-200 break-words whitespace-pre-wrap">{message.content}</p>
							</div>
						</div>
					{:else}
						<div class="flex items-start gap-4">
							<span
								class="w-10 text-center text-xs text-gray-600 opacity-0 group-hover:opacity-100 pt-1"
							>
								{formatTime(message.created_at)}
							</span>
							<p class="text-gray-200 break-words whitespace-pre-wrap">{message.content}</p>
							{#if message.edited_at}
								<span
									class="text-xs text-gray-600 ml-1"
									title="Edited {new Date(message.edited_at).toLocaleString()}"
								>
									(edited)
								</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			{#if messages.length === 0}
				<div class="flex flex-col items-center justify-center h-full text-center">
					<div class="w-16 h-16 rounded-full bg-dark-600 flex items-center justify-center mb-4">
						<span class="text-4xl">#</span>
					</div>
					<h3 class="text-2xl font-bold text-white mb-2">
						Welcome to #{$currentChannel.name}!
					</h3>
					<p class="text-gray-400">This is the start of the #{$currentChannel.name} channel.</p>
				</div>
			{/if}
		</div>

		<!-- Message input -->
		<div class="px-4 pb-6 shrink-0">
			<MessageInput
				placeholder="Message #{$currentChannel.name}"
				onSend={handleSendMessage}
			/>
		</div>
	{:else}
		<!-- No channel selected -->
		<div class="flex flex-col items-center justify-center h-full text-center p-8">
			<div class="w-24 h-24 rounded-full bg-dark-600 flex items-center justify-center mb-6">
				<svg class="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
					/>
				</svg>
			</div>
			<h2 class="text-2xl font-bold text-white mb-2">Welcome to Hearth</h2>
			<p class="text-gray-400 max-w-md">
				Select a server from the sidebar and choose a channel to start chatting.
			</p>
		</div>
	{/if}
</div>
