<script lang="ts">
	/**
	 * MemberSection Component
	 * 
	 * Displays a collapsible section of members grouped by role or status.
	 * Per PRD Section 3.5:
	 * - Role group headers (ONLINE, OFFLINE, role names)
	 * - Member count display
	 * - Optional collapse functionality
	 */
	
	import { slide } from 'svelte/transition';
	import MemberItem from './MemberItem.svelte';
	import { createEventDispatcher } from 'svelte';
	
	export let label: string;
	export let count: number;
	export let members: Array<{
		id: string;
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		nickname: string | null;
		roles: string[];
	}> = [];
	export let isOffline: boolean = false;
	export let collapsible: boolean = false;
	export let collapsed: boolean = false;
	export let getMemberColor: (member: typeof members[0]) => string = () => 'var(--text-normal)';
	export let getMemberActivity: (userId: string) => {
		type: number;
		name: string;
		state?: string;
		details?: string;
	} | null = () => null;
	export let getActivityText: (userId: string) => string | null = () => null;
	
	const dispatch = createEventDispatcher<{
		memberClick: { member: typeof members[0] };
		memberContextMenu: { member: typeof members[0]; event: MouseEvent };
		toggle: { collapsed: boolean };
	}>();
	
	function handleToggle() {
		if (collapsible) {
			collapsed = !collapsed;
			dispatch('toggle', { collapsed });
		}
	}
	
	function handleMemberClick(event: CustomEvent<{ member: typeof members[0] }>) {
		dispatch('memberClick', event.detail);
	}
	
	function handleMemberContextMenu(event: CustomEvent<{ member: typeof members[0]; event: MouseEvent }>) {
		dispatch('memberContextMenu', event.detail);
	}
</script>

<div class="member-section" class:collapsed>
	<!-- Section Header -->
	<button
		class="section-header"
		class:collapsible
		on:click={handleToggle}
		aria-expanded={collapsible ? !collapsed : undefined}
		aria-controls={collapsible ? `section-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
		disabled={!collapsible}
	>
		{#if collapsible}
			<svg 
				class="collapse-icon" 
				class:collapsed
				width="12" 
				height="12" 
				viewBox="0 0 12 12"
				aria-hidden="true"
			>
				<path 
					fill="currentColor" 
					d="M2.7 4.3a1 1 0 0 1 1.4 0L6 6.2l1.9-1.9a1 1 0 1 1 1.4 1.4l-2.6 2.6a1 1 0 0 1-1.4 0L2.7 5.7a1 1 0 0 1 0-1.4z"
				/>
			</svg>
		{/if}
		<span class="section-label">{label}</span>
		<span class="section-count">&mdash; {count}</span>
	</button>
	
	<!-- Members List -->
	{#if !collapsed}
		<div 
			class="section-members"
			id={collapsible ? `section-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
			transition:slide={{ duration: collapsible ? 150 : 0 }}
		>
			{#each members as member (member.id)}
				<MemberItem
					{member}
					color={getMemberColor(member)}
					{isOffline}
					activity={getMemberActivity(member.user.id)}
					activityText={getActivityText(member.user.id)}
					on:click={handleMemberClick}
					on:contextmenu={handleMemberContextMenu}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.member-section {
		margin-bottom: var(--spacing-sm, 8px);
	}
	
	.section-header {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 24px 8px 4px 8px;
		background: transparent;
		border: none;
		cursor: default;
		text-align: left;
	}
	
	.member-section:first-child .section-header {
		padding-top: var(--spacing-sm, 8px);
	}
	
	.section-header.collapsible {
		cursor: pointer;
	}
	
	.section-header.collapsible:hover .section-label,
	.section-header.collapsible:hover .section-count {
		color: var(--text-normal, #f2f3f5);
	}
	
	.collapse-icon {
		color: var(--text-muted, #949ba4);
		transition: transform var(--transition-fast, 0.1s ease);
		flex-shrink: 0;
	}
	
	.collapse-icon.collapsed {
		transform: rotate(-90deg);
	}
	
	.section-label {
		font-size: var(--font-size-xs, 12px);
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		line-height: var(--line-height-tight, 1.25);
		transition: color var(--transition-fast, 0.1s ease);
	}
	
	.section-count {
		font-size: var(--font-size-xs, 12px);
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		transition: color var(--transition-fast, 0.1s ease);
	}
	
	.section-members {
		padding: 0 var(--spacing-sm, 8px);
		display: flex;
		flex-direction: column;
	}
</style>
