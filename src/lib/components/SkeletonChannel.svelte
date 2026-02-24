<script lang="ts">
	/**
	 * SkeletonChannel Component
	 * 
	 * Loading skeleton for channel list items.
	 * Mimics the structure of channel list entries.
	 */
	import SkeletonBase from './SkeletonBase.svelte';

	export let count: number = 1;
	export let animated = true;
	export let showCategory = false;
</script>

<div 
	class="skeleton-channel-list"
	role="status" 
	aria-label="Loading channels"
	aria-busy="true"
>
	<span class="sr-only">Loading channels...</span>
	
	{#if showCategory}
		<div class="skeleton-category">
			<SkeletonBase width="12px" height="12px" borderRadius="2px" {animated} />
			<SkeletonBase width="80px" height="10px" borderRadius="2px" {animated} />
		</div>
	{/if}
	
	{#each Array(count) as _, i}
		<div class="skeleton-channel" style="--delay: {i * 0.05}s">
			<div class="channel-icon">
				<SkeletonBase width="20px" height="20px" borderRadius="4px" {animated} />
			</div>
			<div class="channel-name">
				<SkeletonBase 
					width="{60 + Math.random() * 40}%" 
					height="14px" 
					borderRadius="4px" 
					{animated}
				/>
			</div>
		</div>
	{/each}
</div>

<style>
	.skeleton-channel-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 8px;
	}

	.skeleton-category {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 16px 8px 6px;
	}

	.skeleton-channel {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 8px;
		border-radius: 4px;
		animation: fadeIn 0.3s ease-out;
		animation-delay: var(--delay);
		animation-fill-mode: backwards;
	}

	.channel-icon {
		flex-shrink: 0;
	}

	.channel-name {
		flex: 1;
		min-width: 0;
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
