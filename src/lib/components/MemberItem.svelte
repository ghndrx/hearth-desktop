<script lang="ts">
	/**
	 * MemberItem Component
	 * 
	 * Displays a single member row in the member sidebar.
	 * Per PRD Section 3.5:
	 * - Avatar (32px) with status dot
	 * - Display name (colored by highest role)
	 * - Activity/game name if present
	 */
	
	import Avatar from './Avatar.svelte';
	import Tooltip from './Tooltip.svelte';
	import { createEventDispatcher } from 'svelte';
	
	export let member: {
		id: string;
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		nickname: string | null;
		roles: string[];
	};
	
	export let color: string = 'var(--text-normal)';
	export let isOffline: boolean = false;
	export let activity: {
		type: number;
		name: string;
		state?: string;
		details?: string;
	} | null = null;
	export let activityText: string | null = null;
	
	const dispatch = createEventDispatcher<{
		click: { member: typeof member };
		contextmenu: { member: typeof member; event: MouseEvent };
	}>();
	
	$: displayName = member.nickname || member.user.display_name || member.user.username;
	$: displayActivity = activityText || (activity ? formatActivity(activity) : null);
	
	function formatActivity(act: NonNullable<typeof activity>): string {
		const activityLabels: Record<number, string> = {
			0: 'Playing',
			1: 'Streaming',
			2: 'Listening to',
			3: 'Watching',
			4: '', // Custom status - show state directly
			5: 'Competing in'
		};
		
		const prefix = activityLabels[act.type] ?? '';
		if (act.type === 4 && act.state) {
			return act.state;
		}
		return prefix ? `${prefix} ${act.name}` : act.name;
	}
	
	function handleClick() {
		dispatch('click', { member });
	}
	
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		dispatch('contextmenu', { member, event });
	}
</script>

<Tooltip text={displayName} position="left" delay={500}>
	<button
		class="member-item"
		class:offline={isOffline}
		on:click={handleClick}
		on:contextmenu={handleContextMenu}
		aria-label="View {displayName}'s profile"
	>
		<!-- Avatar with status indicator -->
		<Avatar
			src={member.user.avatar}
			username={member.user.username}
			size="sm"
			userId={member.user.id}
			showPresence={true}
		/>
		
		<!-- Member info -->
		<div class="member-info">
			<span
				class="member-name"
				style:color={color}
			>
				{displayName}
			</span>
			
			{#if displayActivity && !isOffline}
				<span class="member-activity">
					{displayActivity}
				</span>
			{/if}
		</div>
	</button>
</Tooltip>

<style>
	.member-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 4px 8px;
		border-radius: var(--radius-md, 4px);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color var(--transition-fast, 0.1s ease);
		text-align: left;
	}
	
	.member-item:hover {
		background-color: var(--bg-modifier-hover, #35373c);
	}
	
	.member-item:active {
		background-color: var(--bg-modifier-active, #404249);
	}
	
	.member-item:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: -2px;
	}
	
	.member-item.offline {
		opacity: 0.3;
	}
	
	.member-item.offline:hover {
		opacity: 0.6;
	}
	
	.member-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	
	.member-name {
		font-size: var(--font-size-sm, 14px);
		font-weight: 500;
		line-height: var(--line-height-tight, 1.25);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.member-activity {
		font-size: var(--font-size-xs, 12px);
		color: var(--text-muted, #b5bac1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: var(--line-height-tight, 1.25);
	}
</style>
