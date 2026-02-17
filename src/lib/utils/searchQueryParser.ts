/**
 * Search Query Parser
 * Parses Discord-like search syntax: from:@user in:#channel has:attachment before:2024-01-01
 */

export interface SearchToken {
	type: 'text' | 'from' | 'in' | 'has' | 'before' | 'after' | 'mentions' | 'pinned';
	value: string;
	raw: string;
	startIndex: number;
	endIndex: number;
}

export interface ParsedQuery {
	tokens: SearchToken[];
	freeText: string;
	from?: string;
	in?: string;
	has: string[];
	before?: string;
	after?: string;
	mentions?: string;
	pinned?: boolean;
}

// Filter patterns
const filterPatterns: Record<string, RegExp> = {
	from: /from:\s*<?@?([^\s>]+)>?/gi,
	in: /in:\s*<?#?([^\s>]+)>?/gi,
	has: /has:\s*(\w+)/gi,
	before: /before:\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?)?)/gi,
	after: /after:\s*(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?)?)/gi,
	mentions: /mentions:\s*<?@?([^\s>]+)>?/gi,
	pinned: /pinned:\s*(true|false|yes|no)/gi,
};

/**
 * Parse a search query string and extract filter tokens
 */
export function parseSearchQuery(query: string): ParsedQuery {
	const result: ParsedQuery = {
		tokens: [],
		freeText: '',
		has: [],
	};

	if (!query) {
		return result;
	}

	let remainingQuery = query;
	const allMatches: { type: string; match: RegExpExecArray }[] = [];

	// Collect all matches with their positions
	for (const [type, pattern] of Object.entries(filterPatterns)) {
		// Reset lastIndex for global regex
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(query)) !== null) {
			allMatches.push({ type, match });
		}
	}

	// Sort by position
	allMatches.sort((a, b) => a.match.index - b.match.index);

	// Process matches and build tokens
	for (const { type, match } of allMatches) {
		const token: SearchToken = {
			type: type as SearchToken['type'],
			value: match[1],
			raw: match[0],
			startIndex: match.index,
			endIndex: match.index + match[0].length,
		};
		result.tokens.push(token);

		// Remove matched filter from remaining query
		remainingQuery = remainingQuery.replace(match[0], ' ');

		// Set parsed values
		switch (type) {
			case 'from':
				result.from = match[1];
				break;
			case 'in':
				result.in = match[1];
				break;
			case 'has':
				result.has.push(normalizeHasValue(match[1]));
				break;
			case 'before':
				result.before = match[1];
				break;
			case 'after':
				result.after = match[1];
				break;
			case 'mentions':
				result.mentions = match[1];
				break;
			case 'pinned':
				result.pinned = match[1].toLowerCase() === 'true' || match[1].toLowerCase() === 'yes';
				break;
		}
	}

	// Clean up remaining free text
	result.freeText = remainingQuery.replace(/\s+/g, ' ').trim();

	return result;
}

/**
 * Normalize "has:" filter values
 */
function normalizeHasValue(value: string): string {
	const lower = value.toLowerCase();
	switch (lower) {
		case 'file':
		case 'attachment':
		case 'attachments':
			return 'attachment';
		case 'image':
		case 'images':
			return 'image';
		case 'video':
		case 'videos':
			return 'video';
		case 'link':
		case 'links':
		case 'url':
			return 'link';
		case 'embed':
		case 'embeds':
			return 'embed';
		case 'reaction':
		case 'reactions':
			return 'reaction';
		default:
			return lower;
	}
}

/**
 * Build a query string from parsed components
 */
export function buildQueryString(parsed: ParsedQuery): string {
	const parts: string[] = [];

	if (parsed.from) {
		parts.push(`from:${parsed.from}`);
	}
	if (parsed.in) {
		parts.push(`in:${parsed.in}`);
	}
	for (const has of parsed.has) {
		parts.push(`has:${has}`);
	}
	if (parsed.before) {
		parts.push(`before:${parsed.before}`);
	}
	if (parsed.after) {
		parts.push(`after:${parsed.after}`);
	}
	if (parsed.mentions) {
		parts.push(`mentions:${parsed.mentions}`);
	}
	if (parsed.pinned !== undefined) {
		parts.push(`pinned:${parsed.pinned}`);
	}
	if (parsed.freeText) {
		parts.push(parsed.freeText);
	}

	return parts.join(' ');
}

/**
 * Get the current filter being typed (for autocomplete)
 */
export function getCurrentFilter(query: string, cursorPosition: number): { type: string; value: string; startIndex: number } | null {
	// Look backwards from cursor to find filter prefix
	const beforeCursor = query.slice(0, cursorPosition);
	const lastSpaceIdx = beforeCursor.lastIndexOf(' ');
	const currentToken = beforeCursor.slice(lastSpaceIdx + 1);

	// Check if it's a filter being typed
	const filterPrefixes = ['from:', 'in:', 'has:', 'before:', 'after:', 'mentions:', 'pinned:'];
	for (const prefix of filterPrefixes) {
		if (currentToken.toLowerCase().startsWith(prefix.toLowerCase())) {
			return {
				type: prefix.slice(0, -1), // Remove colon
				value: currentToken.slice(prefix.length),
				startIndex: lastSpaceIdx + 1,
			};
		}
	}

	// Check if typing a partial filter prefix
	for (const prefix of filterPrefixes) {
		if (prefix.toLowerCase().startsWith(currentToken.toLowerCase()) && currentToken.length > 0) {
			return {
				type: 'filter-prefix',
				value: currentToken,
				startIndex: lastSpaceIdx + 1,
			};
		}
	}

	return null;
}

/**
 * Remove a token from the query
 */
export function removeToken(query: string, token: SearchToken): string {
	return (
		query.slice(0, token.startIndex) + query.slice(token.endIndex)
	).replace(/\s+/g, ' ').trim();
}

/**
 * Available filter suggestions
 */
export const FILTER_SUGGESTIONS = [
	{ type: 'from', label: 'from:', description: 'Messages from a user', value: 'from:' },
	{ type: 'in', label: 'in:', description: 'Messages in a channel', value: 'in:' },
	{ type: 'has', label: 'has:attachment', description: 'Messages with attachments', value: 'has:attachment' },
	{ type: 'has', label: 'has:image', description: 'Messages with images', value: 'has:image' },
	{ type: 'has', label: 'has:video', description: 'Messages with videos', value: 'has:video' },
	{ type: 'has', label: 'has:link', description: 'Messages with links', value: 'has:link' },
	{ type: 'has', label: 'has:embed', description: 'Messages with embeds', value: 'has:embed' },
	{ type: 'has', label: 'has:reaction', description: 'Messages with reactions', value: 'has:reaction' },
	{ type: 'before', label: 'before:', description: 'Messages before a date', value: 'before:' },
	{ type: 'after', label: 'after:', description: 'Messages after a date', value: 'after:' },
	{ type: 'pinned', label: 'pinned:true', description: 'Pinned messages only', value: 'pinned:true' },
	{ type: 'mentions', label: 'mentions:', description: 'Messages mentioning a user', value: 'mentions:' },
];

/**
 * Get matching filter suggestions
 */
export function getFilterSuggestions(query: string): typeof FILTER_SUGGESTIONS {
	if (!query) return FILTER_SUGGESTIONS.slice(0, 5);

	const lower = query.toLowerCase();
	return FILTER_SUGGESTIONS.filter(
		f => f.label.toLowerCase().includes(lower) || f.description.toLowerCase().includes(lower)
	);
}
