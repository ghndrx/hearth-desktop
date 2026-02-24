<script lang="ts">
	/**
	 * SkeletonUser Component
	 * 
	 * Loading skeleton for user/member list items.
	 * Mimics the structure of member entries with avatar and name.
	 */
	import SkeletonBase from './SkeletonBase.svelte';

	export let count: number = 1;
	export let animated = true;
	export let showStatus = true;
	export let showActivity = false;
	export let size: 'sm' | 'md' = 'md';
</script>

<div 
	class="skeleton-user-list"
	role="status" 
	aria-label="Loading members"
	aria-busy="true"
>
	<span class="sr-only">Loading members...</span>
	
	{#each Array(count) as _, i}
		<div 
			class="skeleton-user" 
			class:sm={size === 'sm'}
			style="--delay: {i * 0.05}s"
		>
			<div class="user-avatar">
				<SkeletonBase 
					width={size === 'sm' ? '32px' : '40px'}
					height={size === 'sm' ? '32px' : '40px'}
					borderRadius="50%" 
					{animated}
				/>
				{#if showStatus}
					<div class="status-indicator">
						<SkeletonBase 
							width={size === 'sm' ? '10px' : '14px'}
							height={size === 'sm' ? '10px' : '14px'}
							borderRadius="50%" 
							{animated}
						/>
					</div>
				{/if}
			</div>
			
			<div class="user-info">
				<SkeletonBase 
					width="{60 + Math.random() * 40}%" 
					height={size === 'sm' ? '12px' : '14px'}
					borderRadius="4px" 
					{animated}
				/>
				{#if showActivity}
					<SkeletonBase 
						width="{40 + Math.random() * 30}%" 
						height={size === 'sm' ? '10px' : '12px'}
						borderRadius="4px" 
						{animated}
					/>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.skeleton-user-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.skeleton-user {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		border-radius: 4px;
		animation: fadeIn 0.3s ease-out;
		animation-delay: var(--delay);
		animation-fill-mode: backwards;
	}

	.skeleton-user.sm {
		gap: 10px;
		padding: 4px 8px;
	}

	.user-avatar {
		position: relative;
		flex-shrink: 0;
	}

	.status-indicator {
		position: absolute;
		bottom: -2px;
		right: -2px;
		background-color: var(--bg-secondary, #2b2d31);
		border-radius: 50%;
		padding: 2px;
	}

	.user-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
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
