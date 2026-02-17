<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Message as MessageType } from '$lib/stores/messages';
	import Message from './Message.svelte';

	export let messages: MessageType[] = [];
	export let currentUserId: string | null = null;
	export let compact = false;
	export let roleColors: Record<string, string> = {};

	const dispatch = createEventDispatcher<{
		react: { messageId: string; emoji: string };
		edit: { messageId: string; content: string };
		delete: { messageId: string };
		reply: { message: MessageType };
		mention: { userId: string };
	}>();

	// Group messages by author and time (within 7 minutes)
	$: groupedMessages = messages.reduce(
		(groups, message, index) => {
			if (index === 0) {
				return [[message]];
			}

			const prevMessage = messages[index - 1];
			const timeDiff =
				new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime();
			const isSameAuthor = message.author_id === prevMessage.author_id;
			const isWithinTimeWindow = timeDiff < 7 * 60 * 1000; // 7 minutes

			if (isSameAuthor && isWithinTimeWindow) {
				groups[groups.length - 1].push(message);
			} else {
				groups.push([message]);
			}

			return groups;
		},
		[] as (typeof messages)[]
	);

	function isGrouped(groupIndex: number, messageIndex: number): boolean {
		return messageIndex > 0;
	}
</script>

<div class="message-group-container">
	{#each groupedMessages as group, groupIndex}
		<div class="message-group">
			{#each group as message, messageIndex}
				<Message
					{message}
					grouped={isGrouped(groupIndex, messageIndex)}
					isOwn={message.author_id === currentUserId}
					
					roleColor={roleColors[message.author_id] || null}
					on:react={(e) => dispatch('react', e.detail)}
					on:edit={(e) => dispatch('edit', e.detail)}
					on:delete={(e) => dispatch('delete', e.detail)}
					on:reply={(e) => dispatch('reply', e.detail)}
					on:mention={(e) => dispatch('mention', e.detail)}
				/>
			{/each}
		</div>
	{/each}
</div>

<style>
	.message-group-container {
		display: flex;
		flex-direction: column;
	}

	.message-group {
		display: flex;
		flex-direction: column;
	}
</style>
