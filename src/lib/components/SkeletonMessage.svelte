<script lang="ts">
	/**
	 * SkeletonMessage Component
	 * 
	 * Loading skeleton for message list items.
	 * Mimics the structure of chat messages with avatar, username, and content lines.
	 */
	import SkeletonBase from './SkeletonBase.svelte';

	export let count: number = 1;
	export let animated = true;
	export let grouped = false;
</script>

<div 
	class="skeleton-message-list"
	role="status" 
	aria-label="Loading messages"
	aria-busy="true"
>
	<span class="sr-only">Loading messages...</span>
	
	{#each Array(count) as _, i}
		{@const showAvatar = !grouped || i === 0}
		{@const lineCount = 1 + Math.floor(Math.random() * 2)}
		
		<div 
			class="skeleton-message" 
			class:grouped={grouped && i > 0}
			style="--delay: {i * 0.08}s"
		>
			{#if showAvatar}
				<div class="message-avatar">
					<SkeletonBase width="40px" height="40px" borderRadius="50%" {animated} />
				</div>
			{:else}
				<div class="message-avatar-spacer"></div>
			{/if}
			
			<div class="message-content">
				{#if showAvatar}
					<div class="message-header">
						<SkeletonBase 
							width="{80 + Math.random() * 60}px" 
							height="14px" 
							borderRadius="4px" 
							{animated}
						/>
						<SkeletonBase 
							width="50px" 
							height="10px" 
							borderRadius="4px" 
							{animated}
						/>
					</div>
				{/if}
				
				<div class="message-lines">
					{#each Array(lineCount) as _, j}
						<SkeletonBase 
							width="{40 + Math.random() * 55}%" 
							height="14px" 
							borderRadius="4px" 
							{animated}
						/>
					{/each}
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.skeleton-message-list {
		display: flex;
		flex-direction: column;
		padding: 16px;
		gap: 4px;
	}

	.skeleton-message {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 4px 0;
		animation: fadeIn 0.3s ease-out;
		animation-delay: var(--delay);
		animation-fill-mode: backwards;
	}

	.skeleton-message:not(.grouped) {
		margin-top: 16px;
	}

	.skeleton-message:not(.grouped):first-child {
		margin-top: 0;
	}

	.message-avatar {
		flex-shrink: 0;
	}

	.message-avatar-spacer {
		width: 40px;
		flex-shrink: 0;
	}

	.message-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.message-lines {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
