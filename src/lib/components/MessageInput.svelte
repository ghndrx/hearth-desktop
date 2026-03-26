<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { messagesStore } from '../stores/messages';

	export let channelId: string;
	export let placeholder: string = 'Type a message...';

	const dispatch = createEventDispatcher<{
		send: { content: string; channelId: string };
	}>();

	let inputElement: HTMLTextAreaElement;
	let content = '';
	let sending = false;

	// Load draft when channel changes
	$: if (channelId && $messagesStore.initialized) {
		loadDraft();
	}

	// Save draft when content changes
	$: if (content && channelId) {
		saveDraft();
	}

	onMount(() => {
		// Focus input when component mounts
		if (inputElement) {
			inputElement.focus();
		}
	});

	function loadDraft() {
		const draft = messagesStore.getDraft(channelId);
		if (draft) {
			content = draft.content;
		} else {
			content = '';
		}
	}

	function saveDraft() {
		if (content.trim()) {
			messagesStore.saveDraft(channelId, content);
		} else {
			messagesStore.clearDraft(channelId);
		}
	}

	async function sendMessage() {
		if (sending || !content.trim()) return;

		const messageContent = content.trim();
		sending = true;

		try {
			await messagesStore.sendMessage(channelId, messageContent);
			content = '';
			messagesStore.clearDraft(channelId);

			// Emit event for parent components
			dispatch('send', { content: messageContent, channelId });

			// Focus back to input
			if (inputElement) {
				inputElement.focus();
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		} finally {
			sending = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Send on Enter (without Shift)
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function autoResize() {
		if (inputElement) {
			inputElement.style.height = 'auto';
			const scrollHeight = inputElement.scrollHeight;
			const maxHeight = 150; // Maximum height in pixels
			inputElement.style.height = Math.min(scrollHeight, maxHeight) + 'px';
		}
	}

	// Auto-resize when content changes
	$: if (content !== undefined && inputElement) {
		autoResize();
	}
</script>

<div class="message-input-container">
	<div class="message-input-wrapper">
		<textarea
			bind:this={inputElement}
			bind:value={content}
			on:keydown={handleKeyDown}
			on:input={autoResize}
			{placeholder}
			rows="1"
			class="message-input"
			disabled={sending || !$messagesStore.connected}
		></textarea>

		<button
			type="button"
			on:click={sendMessage}
			disabled={!content.trim() || sending || !$messagesStore.connected}
			class="send-button"
			aria-label="Send message"
		>
			{#if sending}
				<svg class="animate-spin w-4 h-4" viewBox="0 0 24 24">
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
						fill="none"
					/>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					/>
				</svg>
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
					/>
				</svg>
			{/if}
		</button>
	</div>

	{#if !$messagesStore.connected}
		<div class="connection-warning">
			<svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
				<path
					fill-rule="evenodd"
					d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
					clip-rule="evenodd"
				/>
			</svg>
			<span class="text-sm text-yellow-600">Connecting to chat server...</span>
		</div>
	{/if}
</div>

<style>
	.message-input-container {
		@apply flex flex-col space-y-2 p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700;
	}

	.message-input-wrapper {
		@apply flex items-end space-x-2;
	}

	.message-input {
		@apply flex-1 p-3 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg resize-none overflow-y-auto;
		@apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
		@apply text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400;
		min-height: 44px;
		max-height: 150px;
		line-height: 1.5;
	}

	.message-input:disabled {
		@apply bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed;
	}

	.send-button {
		@apply p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600;
		@apply text-white rounded-lg transition-colors duration-150;
		@apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
		@apply disabled:cursor-not-allowed disabled:text-gray-500;
		min-width: 44px;
		height: 44px;
	}

	.connection-warning {
		@apply flex items-center space-x-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg;
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>