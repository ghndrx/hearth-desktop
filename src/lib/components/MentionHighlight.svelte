<script lang="ts">
	import { user as currentUser } from '$lib/stores/auth';

	export let content: string;
	export let mentions: string[] = []; // User IDs that are mentioned
	export let mentionRoles: string[] = []; // Role IDs that are mentioned
	export let mentionEveryone = false;
	
	// User lookup map (passed from parent)
	export let userMap: Record<string, { username: string; displayName?: string }> = {};
	export let roleMap: Record<string, { name: string; color?: number }> = {};

	interface ContentPart {
		type: 'text' | 'user-mention' | 'role-mention' | 'everyone' | 'here' | 'channel';
		text: string;
		id?: string;
		isCurrentUser?: boolean;
		color?: string;
	}

	// Parse content into parts
	$: parts = parseContent(content, userMap, roleMap, $currentUser?.id);

	function parseContent(
		text: string, 
		users: typeof userMap, 
		roles: typeof roleMap,
		currentUserId?: string
	): ContentPart[] {
		const parts: ContentPart[] = [];
		
		// Combined regex for all mention types
		// <@user_id> or <@!user_id> - user mention
		// <@&role_id> - role mention
		// <#channel_id> - channel mention
		const mentionRegex = /<@!?([a-f0-9-]{36})>|<@&([a-f0-9-]{36})>|<#([a-f0-9-]{36})>|@everyone|@here/g;
		
		let lastIndex = 0;
		let match;
		
		while ((match = mentionRegex.exec(text)) !== null) {
			// Add text before this match
			if (match.index > lastIndex) {
				parts.push({
					type: 'text',
					text: text.substring(lastIndex, match.index)
				});
			}
			
			const fullMatch = match[0];
			const userId = match[1];
			const roleId = match[2];
			const channelId = match[3];
			
			if (userId) {
				// User mention
				const user = users[userId];
				const isCurrentUser = userId === currentUserId;
				parts.push({
					type: 'user-mention',
					text: user ? `@${user.displayName || user.username}` : '@Unknown User',
					id: userId,
					isCurrentUser
				});
			} else if (roleId) {
				// Role mention
				const role = roles[roleId];
				parts.push({
					type: 'role-mention',
					text: role ? `@${role.name}` : '@Unknown Role',
					id: roleId,
					color: role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined
				});
			} else if (channelId) {
				// Channel mention
				parts.push({
					type: 'channel',
					text: `#channel`,
					id: channelId
				});
			} else if (fullMatch === '@everyone') {
				parts.push({
					type: 'everyone',
					text: '@everyone',
					isCurrentUser: true // Everyone includes current user
				});
			} else if (fullMatch === '@here') {
				parts.push({
					type: 'here',
					text: '@here',
					isCurrentUser: true // Here includes online users (assume current user)
				});
			}
			
			lastIndex = match.index + fullMatch.length;
		}
		
		// Add remaining text
		if (lastIndex < text.length) {
			parts.push({
				type: 'text',
				text: text.substring(lastIndex)
			});
		}
		
		return parts;
	}
</script>

<span class="mention-content">
	{#each parts as part}
		{#if part.type === 'text'}
			{part.text}
		{:else if part.type === 'user-mention'}
			<span 
				class="mention user-mention" 
				class:mention-me={part.isCurrentUser}
				role="button"
				tabindex="0"
				data-user-id={part.id}
			>
				{part.text}
			</span>
		{:else if part.type === 'role-mention'}
			<span 
				class="mention role-mention"
				style={part.color ? `color: ${part.color}; background-color: ${part.color}20;` : ''}
				data-role-id={part.id}
			>
				{part.text}
			</span>
		{:else if part.type === 'everyone' || part.type === 'here'}
			<span 
				class="mention everyone-mention"
				class:mention-me={part.isCurrentUser}
			>
				{part.text}
			</span>
		{:else if part.type === 'channel'}
			<button
				class="mention channel-mention"
				data-channel-id={part.id}
				type="button"
			>
				{part.text}
			</button>
		{/if}
	{/each}
</span>

<style>
	.mention-content {
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.mention {
		padding: 0 2px;
		border-radius: 3px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.user-mention {
		color: var(--brand-primary, #5865f2);
		background-color: rgba(88, 101, 242, 0.1);
	}

	.user-mention:hover {
		background-color: rgba(88, 101, 242, 0.2);
		text-decoration: underline;
	}

	.mention-me {
		color: var(--brand-primary, #5865f2);
		background-color: rgba(88, 101, 242, 0.3);
	}

	.mention-me:hover {
		background-color: rgba(88, 101, 242, 0.4);
	}

	.role-mention {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.role-mention:hover {
		filter: brightness(1.1);
	}

	.everyone-mention {
		color: var(--brand-primary, #5865f2);
		background-color: rgba(88, 101, 242, 0.2);
	}

	.channel-mention {
		color: var(--brand-primary, #5865f2);
		background-color: rgba(88, 101, 242, 0.1);
		border: none;
		font: inherit;
	}

	.channel-mention:hover {
		background-color: rgba(88, 101, 242, 0.2);
	}
</style>
