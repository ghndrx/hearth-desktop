/**
 * Mention Parser Utility
 * Parses @user, @role, and #channel mentions from message content
 */

export interface ParsedMention {
	type: 'user' | 'role' | 'channel' | 'everyone' | 'here';
	id?: string;
	raw: string;
	start: number;
	end: number;
}

export interface MentionParseResult {
	mentions: ParsedMention[];
	userIds: string[];
	roleIds: string[];
	channelIds: string[];
	mentionsEveryone: boolean;
	mentionsHere: boolean;
}

// Regex patterns for different mention types
const USER_ID_MENTION_REGEX = /<@!?([a-f0-9-]{36})>/g;
const ROLE_MENTION_REGEX = /<@&([a-f0-9-]{36})>/g;
const CHANNEL_MENTION_REGEX = /<#([a-f0-9-]{36})>/g;
const EVERYONE_MENTION_REGEX = /@everyone\b/g;
const HERE_MENTION_REGEX = /@here\b/g;

// Username mention pattern for input (before conversion to ID format)
const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_]{2,32})\b/g;

/**
 * Parse all mentions from message content
 */
export function parseMentions(content: string): MentionParseResult {
	const mentions: ParsedMention[] = [];
	const userIds = new Set<string>();
	const roleIds = new Set<string>();
	const channelIds = new Set<string>();
	let mentionsEveryone = false;
	let mentionsHere = false;

	// Parse user ID mentions (<@user_id> or <@!user_id>)
	let match;
	while ((match = USER_ID_MENTION_REGEX.exec(content)) !== null) {
		const id = match[1];
		userIds.add(id);
		mentions.push({
			type: 'user',
			id,
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}
	USER_ID_MENTION_REGEX.lastIndex = 0;

	// Parse role mentions (<@&role_id>)
	while ((match = ROLE_MENTION_REGEX.exec(content)) !== null) {
		const id = match[1];
		roleIds.add(id);
		mentions.push({
			type: 'role',
			id,
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}
	ROLE_MENTION_REGEX.lastIndex = 0;

	// Parse channel mentions (<#channel_id>)
	while ((match = CHANNEL_MENTION_REGEX.exec(content)) !== null) {
		const id = match[1];
		channelIds.add(id);
		mentions.push({
			type: 'channel',
			id,
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}
	CHANNEL_MENTION_REGEX.lastIndex = 0;

	// Parse @everyone
	while ((match = EVERYONE_MENTION_REGEX.exec(content)) !== null) {
		mentionsEveryone = true;
		mentions.push({
			type: 'everyone',
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}
	EVERYONE_MENTION_REGEX.lastIndex = 0;

	// Parse @here
	while ((match = HERE_MENTION_REGEX.exec(content)) !== null) {
		mentionsHere = true;
		mentions.push({
			type: 'here',
			raw: match[0],
			start: match.index,
			end: match.index + match[0].length
		});
	}
	HERE_MENTION_REGEX.lastIndex = 0;

	// Sort mentions by position
	mentions.sort((a, b) => a.start - b.start);

	return {
		mentions,
		userIds: Array.from(userIds),
		roleIds: Array.from(roleIds),
		channelIds: Array.from(channelIds),
		mentionsEveryone,
		mentionsHere
	};
}

/**
 * Extract user IDs from content (simple extraction)
 */
export function extractUserMentions(content: string): string[] {
	const ids: string[] = [];
	let match;
	while ((match = USER_ID_MENTION_REGEX.exec(content)) !== null) {
		ids.push(match[1]);
	}
	USER_ID_MENTION_REGEX.lastIndex = 0;
	return ids;
}

/**
 * Check if content contains a mention for a specific user
 */
export function containsUserMention(content: string, userId: string): boolean {
	const result = parseMentions(content);
	return result.userIds.includes(userId) || result.mentionsEveryone || result.mentionsHere;
}

/**
 * Convert @username mentions to <@user_id> format
 * This is used when sending a message to convert human-readable mentions to stored format
 */
export function formatMentionsForStorage(
	content: string,
	userLookup: (username: string) => string | undefined
): string {
	return content.replace(USERNAME_MENTION_REGEX, (match, username) => {
		// Don't convert @everyone or @here
		if (username === 'everyone' || username === 'here') {
			return match;
		}
		const userId = userLookup(username);
		return userId ? `<@${userId}>` : match;
	});
}

/**
 * Convert <@user_id> format to @username for display
 */
export function formatMentionsForDisplay(
	content: string,
	usernameLookup: (userId: string) => string | undefined
): string {
	return content.replace(USER_ID_MENTION_REGEX, (match, userId) => {
		const username = usernameLookup(userId);
		return username ? `@${username}` : match;
	});
}

/**
 * Highlight mentions in content by wrapping them in spans
 * Returns an array of content parts (text or mention objects)
 */
export interface ContentPart {
	type: 'text' | 'user' | 'role' | 'channel' | 'everyone' | 'here';
	content: string;
	id?: string;
}

export function splitContentByMentions(content: string): ContentPart[] {
	const result = parseMentions(content);
	const parts: ContentPart[] = [];
	let lastIndex = 0;

	for (const mention of result.mentions) {
		// Add text before this mention
		if (mention.start > lastIndex) {
			parts.push({
				type: 'text',
				content: content.substring(lastIndex, mention.start)
			});
		}

		// Add the mention
		parts.push({
			type: mention.type,
			content: mention.raw,
			id: mention.id
		});

		lastIndex = mention.end;
	}

	// Add remaining text
	if (lastIndex < content.length) {
		parts.push({
			type: 'text',
			content: content.substring(lastIndex)
		});
	}

	return parts;
}

/**
 * Count mentions in content
 */
export function countMentions(content: string): number {
	const result = parseMentions(content);
	return result.mentions.length;
}

/**
 * Check if content has any mentions
 */
export function hasMentions(content: string): boolean {
	return (
		USER_ID_MENTION_REGEX.test(content) ||
		ROLE_MENTION_REGEX.test(content) ||
		CHANNEL_MENTION_REGEX.test(content) ||
		EVERYONE_MENTION_REGEX.test(content) ||
		HERE_MENTION_REGEX.test(content)
	);
}
