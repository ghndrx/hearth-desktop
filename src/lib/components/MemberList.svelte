<script lang="ts">
	import { currentServer } from '$lib/stores/app';
	import Avatar from './Avatar.svelte';

	interface Member {
		id: string;
		user: {
			id: string;
			username: string;
			display_name: string | null;
			avatar: string | null;
		};
		nickname: string | null;
		roles: string[];
		status: 'online' | 'idle' | 'dnd' | 'offline';
	}

	interface Role {
		id: string;
		name: string;
		color: string;
		position: number;
		hoist: boolean;
	}

	interface Props {
		members?: Member[];
		roles?: Role[];
	}

	let { members = [], roles = [] }: Props = $props();

	function getMemberColor(member: Member): string {
		const memberRoles = roles
			.filter((r) => member.roles.includes(r.id) && r.color && r.color !== '#000000')
			.sort((a, b) => b.position - a.position);
		return memberRoles[0]?.color || '#dbdee1';
	}

	let groupedMembers = $derived(groupMembersByRole(members, roles));

	function groupMembersByRole(membersList: Member[], rolesList: Role[]) {
		const groups: {
			role: Role | null;
			members: Member[];
			label: string;
			isOffline?: boolean;
		}[] = [];

		const usedMembers = new Set<string>();

		const hoistedRoles = rolesList
			.filter((r) => r.hoist && r.name !== '@everyone')
			.sort((a, b) => b.position - a.position);

		for (const role of hoistedRoles) {
			const roleMembers = membersList.filter((m) => {
				if (usedMembers.has(m.id)) return false;
				if (!m.roles.includes(role.id)) return false;
				return m.status !== 'offline';
			});

			if (roleMembers.length > 0) {
				roleMembers.sort((a, b) => {
					const nameA = a.nickname || a.user.display_name || a.user.username;
					const nameB = b.nickname || b.user.display_name || b.user.username;
					return nameA.localeCompare(nameB);
				});

				groups.push({
					role,
					members: roleMembers,
					label: role.name.toUpperCase()
				});
				roleMembers.forEach((m) => usedMembers.add(m.id));
			}
		}

		const onlineMembers = membersList.filter((m) => {
			if (usedMembers.has(m.id)) return false;
			return m.status !== 'offline';
		});

		if (onlineMembers.length > 0) {
			onlineMembers.sort((a, b) => {
				const nameA = a.nickname || a.user.display_name || a.user.username;
				const nameB = b.nickname || b.user.display_name || b.user.username;
				return nameA.localeCompare(nameB);
			});

			groups.push({
				role: null,
				members: onlineMembers,
				label: 'ONLINE'
			});
			onlineMembers.forEach((m) => usedMembers.add(m.id));
		}

		const offlineMembers = membersList.filter((m) => {
			if (usedMembers.has(m.id)) return false;
			return m.status === 'offline';
		});

		if (offlineMembers.length > 0) {
			offlineMembers.sort((a, b) => {
				const nameA = a.nickname || a.user.display_name || a.user.username;
				const nameB = b.nickname || b.user.display_name || b.user.username;
				return nameA.localeCompare(nameB);
			});

			groups.push({
				role: null,
				members: offlineMembers,
				label: 'OFFLINE',
				isOffline: true
			});
		}

		return groups;
	}
</script>

{#if $currentServer}
	<aside class="member-list">
		{#each groupedMembers as group}
			<div class="member-group">
				<h3 class="group-header">{group.label} — {group.members.length}</h3>

				{#each group.members as member}
					<button class="member-item" class:offline={group.isOffline}>
						<Avatar
							src={member.user.avatar}
							username={member.user.username}
							size="sm"
							showPresence={true}
							status={member.status}
						/>

						<div class="member-info">
							<span class="member-name" style="color: {getMemberColor(member)}">
								{member.nickname || member.user.display_name || member.user.username}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<div class="empty-members">
				<p>No members to display</p>
			</div>
		{/each}
	</aside>
{/if}

<style>
	.member-list {
		width: 240px;
		height: 100%;
		background-color: #2b2d31;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 0;
		flex-shrink: 0;
	}

	.member-group {
		margin-bottom: 8px;
	}

	.group-header {
		padding: 24px 8px 4px 16px;
		font-size: 12px;
		font-weight: 600;
		color: #949ba4;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		line-height: 1.3;
	}

	.member-group:first-child .group-header {
		padding-top: 8px;
	}

	.member-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: calc(100% - 16px);
		margin: 0 8px;
		padding: 4px 8px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.1s ease;
		text-align: left;
	}

	.member-item:hover {
		background-color: #35373c;
	}

	.member-item:active {
		background-color: #404249;
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
		font-size: 14px;
		font-weight: 500;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty-members {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		color: #949ba4;
		font-size: 14px;
	}
</style>
