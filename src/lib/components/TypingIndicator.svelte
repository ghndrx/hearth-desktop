<script lang="ts">
	import { typingStore, formatTypingText, type TypingUser } from '$lib/stores/typing';
	import Avatar from './Avatar.svelte';
	
	export let channelId: string;
	
	// Derived store for this channel's typing users
	$: typingUsers = typingStore.forChannel(channelId);
	$: text = formatTypingText($typingUsers);
	$: visible = $typingUsers.length > 0;
	
	// Show avatars for up to 3 users
	$: displayedUsers = $typingUsers.slice(0, 3);
</script>

{#if visible}
	<div 
		class="typing-indicator"
		role="status"
		aria-live="polite"
		aria-label={text}
	>
		<div class="typing-avatars">
			{#each displayedUsers as user, i (user.userId)}
				<div class="avatar-wrapper" style="z-index: {3 - i}; margin-left: {i > 0 ? '-8px' : '0'}">
					<Avatar
						src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64` : null}
						size="xs"
						username={user.displayName || user.username}
						userId={user.userId}
					/>
				</div>
			{/each}
		</div>
		<div class="typing-dots" aria-hidden="true">
			<span class="dot"></span>
			<span class="dot"></span>
			<span class="dot"></span>
		</div>
		<span class="typing-text">{text}</span>
	</div>
{/if}

<style>
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 16px;
		height: 32px;
		font-size: 13px;
		color: var(--text-muted, #72767d);
	}

	.typing-avatars {
		display: flex;
		align-items: center;
		margin-right: 4px;
	}

	.avatar-wrapper {
		border-radius: 50%;
		border: 2px solid var(--background-primary, #313338);
		transition: transform 0.2s ease;
	}

	.avatar-wrapper:hover {
		transform: scale(1.1);
	}
	
	.typing-dots {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--text-muted, #72767d);
		animation: typing-bounce 1.4s ease-in-out infinite;
	}
	
	.dot:nth-child(1) {
		animation-delay: 0s;
	}
	
	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	
	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	
	@keyframes typing-bounce {
		0%, 60%, 100% {
			transform: translateY(0);
			opacity: 0.6;
		}
		30% {
			transform: translateY(-4px);
			opacity: 1;
		}
	}
	
	.typing-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 300px;
	}
	
	/* Mobile responsive */
	@media (max-width: 640px) {
		.typing-indicator {
			padding: 4px 12px;
			font-size: 12px;
		}
		
		.typing-text {
			max-width: 200px;
		}
	}
</style>
