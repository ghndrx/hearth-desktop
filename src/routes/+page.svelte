<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Sidebar,
		VoiceTranscriptionPanel,
		MessageList,
		MessageInput,
		messagesStore,
		currentChannel
	} from '$lib';

	// Mock channel for testing - in a real app this would come from navigation
	const MOCK_CHANNEL = {
		id: 'test-channel-1',
		server_id: 'test-server-1',
		name: 'general',
		topic: 'General discussion',
		type: 'text' as const,
		position: 0,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	onMount(() => {
		// Set current channel
		currentChannel.set(MOCK_CHANNEL);
	});
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden">
		<!-- Channel Header -->
		<div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
			<div class="flex items-center space-x-3">
				<div class="flex items-center">
					<span class="text-gray-500 dark:text-gray-400">#</span>
					<h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100 ml-1">
						{MOCK_CHANNEL.name}
					</h1>
				</div>
				{#if MOCK_CHANNEL.topic}
					<div class="border-l border-gray-300 dark:border-gray-600 pl-3">
						<p class="text-sm text-gray-600 dark:text-gray-400">{MOCK_CHANNEL.topic}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Messages Area -->
		<div class="flex-1 flex flex-col overflow-hidden">
			<MessageList channelId={MOCK_CHANNEL.id} />
		</div>

		<!-- Message Input -->
		<MessageInput
			channelId={MOCK_CHANNEL.id}
			placeholder={`Message #${MOCK_CHANNEL.name}`}
		/>
	</main>

	<VoiceTranscriptionPanel />
</div>
