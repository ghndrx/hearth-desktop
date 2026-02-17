<script lang="ts">
	/**
	 * ThreadParticipants.svelte
	 * FEAT-001: Message Threading Enhancements
	 * 
	 * Displays avatars of users participating in a thread.
	 * Shows stacked avatars with overflow count when there are many participants.
	 */
	import Avatar from './Avatar.svelte';

	export let participants: Array<{
		id: string;
		username: string;
		display_name?: string | null;
		avatar?: string | null;
	}> = [];
	
	export let maxDisplay = 3;
	export let size: 'xs' | 'sm' | 'md' = 'sm';
	export let showNames = false;
	
	$: displayedParticipants = participants.slice(0, maxDisplay);
	$: overflowCount = Math.max(0, participants.length - maxDisplay);
	$: allNames = participants.map(p => p.display_name || p.username).join(', ');
	
	const sizeMap = {
		xs: 'w-4 h-4',
		sm: 'w-6 h-6',
		md: 'w-8 h-8'
	};
	
	const overlapMap = {
		xs: '-ml-1.5',
		sm: '-ml-2',
		md: '-ml-3'
	};
	
	const textSizeMap = {
		xs: 'text-[10px]',
		sm: 'text-xs',
		md: 'text-sm'
	};
</script>

{#if participants.length > 0}
	<div 
		class="flex items-center gap-2"
		title="{participants.length} participant{participants.length !== 1 ? 's' : ''}: {allNames}"
		role="group"
		aria-label="{participants.length} thread participant{participants.length !== 1 ? 's' : ''}"
	>
		<!-- Stacked avatars -->
		<div class="flex items-center">
			{#each displayedParticipants as participant, i}
				<div 
					class="relative ring-2 ring-[var(--bg-secondary,#2b2d31)] rounded-full {sizeMap[size]}"
					class:ml-0={i === 0}
					class:-ml-1.5={i > 0 && size === 'xs'}
					class:-ml-2={i > 0 && size === 'sm'}
					class:-ml-3={i > 0 && size === 'md'}
					style="z-index: {maxDisplay - i};"
				>
					<Avatar 
						src={participant.avatar}
						username={participant.display_name || participant.username}
						{size}
					/>
				</div>
			{/each}
			
			<!-- Overflow indicator -->
			{#if overflowCount > 0}
				<div 
					class="relative flex items-center justify-center rounded-full bg-[var(--bg-modifier-accent,#4e5058)] text-[var(--text-muted,#949ba4)] {sizeMap[size]} {textSizeMap[size]} font-semibold"
					class:-ml-1.5={size === 'xs'}
					class:-ml-2={size === 'sm'}
					class:-ml-3={size === 'md'}
					style="z-index: 0;"
				>
					+{overflowCount}
				</div>
			{/if}
		</div>
		
		<!-- Participant names (optional) -->
		{#if showNames}
			<span class="text-[var(--text-muted,#949ba4)] {textSizeMap[size]} truncate max-w-[150px]">
				{#if participants.length === 1}
					{participants[0].display_name || participants[0].username}
				{:else if participants.length === 2}
					{participants[0].display_name || participants[0].username} and {participants[1].display_name || participants[1].username}
				{:else}
					{participants[0].display_name || participants[0].username} and {participants.length - 1} others
				{/if}
			</span>
		{/if}
	</div>
{/if}
