import { describe, it, expect } from 'vitest';
import {
	parseMentions,
	extractUserMentions,
	containsUserMention,
	formatMentionsForStorage,
	formatMentionsForDisplay,
	splitContentByMentions,
	countMentions,
	hasMentions
} from './mentionParser';

describe('mentionParser', () => {
	describe('parseMentions', () => {
		it('parses user ID mentions', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440000>!';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(1);
			expect(result.userIds[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
			expect(result.mentions).toHaveLength(1);
			expect(result.mentions[0].type).toBe('user');
		});

		it('parses user ID mentions with exclamation mark', () => {
			const content = 'Hi <@!550e8400-e29b-41d4-a716-446655440000>';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(1);
			expect(result.userIds[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
		});

		it('parses multiple user mentions', () => {
			const content =
				'<@550e8400-e29b-41d4-a716-446655440001> and <@550e8400-e29b-41d4-a716-446655440002>';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(2);
			expect(result.mentions).toHaveLength(2);
		});

		it('parses role mentions', () => {
			const content = 'Attention <@&550e8400-e29b-41d4-a716-446655440003>!';
			const result = parseMentions(content);

			expect(result.roleIds).toHaveLength(1);
			expect(result.roleIds[0]).toBe('550e8400-e29b-41d4-a716-446655440003');
			expect(result.mentions).toHaveLength(1);
			expect(result.mentions[0].type).toBe('role');
		});

		it('parses channel mentions', () => {
			const content = 'Check out <#550e8400-e29b-41d4-a716-446655440004>';
			const result = parseMentions(content);

			expect(result.channelIds).toHaveLength(1);
			expect(result.channelIds[0]).toBe('550e8400-e29b-41d4-a716-446655440004');
			expect(result.mentions).toHaveLength(1);
			expect(result.mentions[0].type).toBe('channel');
		});

		it('parses @everyone', () => {
			const content = 'Attention @everyone!';
			const result = parseMentions(content);

			expect(result.mentionsEveryone).toBe(true);
			expect(result.mentions).toHaveLength(1);
			expect(result.mentions[0].type).toBe('everyone');
		});

		it('parses @here', () => {
			const content = 'Hello @here';
			const result = parseMentions(content);

			expect(result.mentionsHere).toBe(true);
			expect(result.mentions).toHaveLength(1);
			expect(result.mentions[0].type).toBe('here');
		});

		it('parses mixed mentions', () => {
			const content =
				'Hey <@550e8400-e29b-41d4-a716-446655440001>, check <#550e8400-e29b-41d4-a716-446655440002> and @everyone';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(1);
			expect(result.channelIds).toHaveLength(1);
			expect(result.mentionsEveryone).toBe(true);
			expect(result.mentions).toHaveLength(3);
		});

		it('handles no mentions', () => {
			const content = 'Just a regular message';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(0);
			expect(result.roleIds).toHaveLength(0);
			expect(result.channelIds).toHaveLength(0);
			expect(result.mentionsEveryone).toBe(false);
			expect(result.mentionsHere).toBe(false);
			expect(result.mentions).toHaveLength(0);
		});

		it('deduplicates user IDs', () => {
			const content =
				'<@550e8400-e29b-41d4-a716-446655440001> said <@550e8400-e29b-41d4-a716-446655440001>';
			const result = parseMentions(content);

			expect(result.userIds).toHaveLength(1);
			expect(result.mentions).toHaveLength(2); // Still returns both mention occurrences
		});

		it('sorts mentions by position', () => {
			const content = '@everyone, check <#channel-id> and <@user-id>'.replace(
				'<#channel-id>',
				'<#550e8400-e29b-41d4-a716-446655440001>'
			).replace('<@user-id>', '<@550e8400-e29b-41d4-a716-446655440002>');
			const result = parseMentions(content);

			expect(result.mentions[0].type).toBe('everyone');
			expect(result.mentions[0].start).toBeLessThan(result.mentions[1].start);
		});
	});

	describe('extractUserMentions', () => {
		it('extracts user IDs from content', () => {
			const content =
				'<@550e8400-e29b-41d4-a716-446655440001> and <@550e8400-e29b-41d4-a716-446655440002>';
			const ids = extractUserMentions(content);

			expect(ids).toHaveLength(2);
			expect(ids).toContain('550e8400-e29b-41d4-a716-446655440001');
			expect(ids).toContain('550e8400-e29b-41d4-a716-446655440002');
		});

		it('returns empty array for no mentions', () => {
			const content = 'No mentions here';
			const ids = extractUserMentions(content);

			expect(ids).toHaveLength(0);
		});
	});

	describe('containsUserMention', () => {
		it('returns true for direct mention', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440001>!';
			expect(containsUserMention(content, '550e8400-e29b-41d4-a716-446655440001')).toBe(true);
		});

		it('returns true for @everyone', () => {
			const content = 'Attention @everyone';
			expect(containsUserMention(content, '550e8400-e29b-41d4-a716-446655440001')).toBe(true);
		});

		it('returns true for @here', () => {
			const content = 'Hey @here';
			expect(containsUserMention(content, '550e8400-e29b-41d4-a716-446655440001')).toBe(true);
		});

		it('returns false when user is not mentioned', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440002>!';
			expect(containsUserMention(content, '550e8400-e29b-41d4-a716-446655440001')).toBe(false);
		});
	});

	describe('formatMentionsForStorage', () => {
		it('converts @username to <@user_id>', () => {
			const content = 'Hello @testuser!';
			const lookup = (username: string) =>
				username === 'testuser' ? '550e8400-e29b-41d4-a716-446655440001' : undefined;

			const result = formatMentionsForStorage(content, lookup);

			expect(result).toBe('Hello <@550e8400-e29b-41d4-a716-446655440001>!');
		});

		it('keeps @everyone unchanged', () => {
			const content = 'Hello @everyone';
			const lookup = () => undefined;

			const result = formatMentionsForStorage(content, lookup);

			expect(result).toBe('Hello @everyone');
		});

		it('keeps @here unchanged', () => {
			const content = 'Hello @here';
			const lookup = () => undefined;

			const result = formatMentionsForStorage(content, lookup);

			expect(result).toBe('Hello @here');
		});

		it('keeps unknown usernames unchanged', () => {
			const content = 'Hello @unknownuser!';
			const lookup = () => undefined;

			const result = formatMentionsForStorage(content, lookup);

			expect(result).toBe('Hello @unknownuser!');
		});
	});

	describe('formatMentionsForDisplay', () => {
		it('converts <@user_id> to @username', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440001>!';
			const lookup = (userId: string) =>
				userId === '550e8400-e29b-41d4-a716-446655440001' ? 'testuser' : undefined;

			const result = formatMentionsForDisplay(content, lookup);

			expect(result).toBe('Hello @testuser!');
		});

		it('keeps unknown user IDs unchanged', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440001>!';
			const lookup = () => undefined;

			const result = formatMentionsForDisplay(content, lookup);

			expect(result).toBe('Hello <@550e8400-e29b-41d4-a716-446655440001>!');
		});
	});

	describe('splitContentByMentions', () => {
		it('splits content correctly', () => {
			const content = 'Hello <@550e8400-e29b-41d4-a716-446655440001> how are you?';
			const parts = splitContentByMentions(content);

			expect(parts).toHaveLength(3);
			expect(parts[0]).toEqual({ type: 'text', content: 'Hello ' });
			expect(parts[1]).toEqual({
				type: 'user',
				content: '<@550e8400-e29b-41d4-a716-446655440001>',
				id: '550e8400-e29b-41d4-a716-446655440001'
			});
			expect(parts[2]).toEqual({ type: 'text', content: ' how are you?' });
		});

		it('handles content starting with mention', () => {
			const content = '<@550e8400-e29b-41d4-a716-446655440001> hello';
			const parts = splitContentByMentions(content);

			expect(parts).toHaveLength(2);
			expect(parts[0].type).toBe('user');
			expect(parts[1].type).toBe('text');
		});

		it('handles content ending with mention', () => {
			const content = 'Hey @everyone';
			const parts = splitContentByMentions(content);

			expect(parts).toHaveLength(2);
			expect(parts[0]).toEqual({ type: 'text', content: 'Hey ' });
			expect(parts[1].type).toBe('everyone');
		});

		it('handles content with no mentions', () => {
			const content = 'Just text';
			const parts = splitContentByMentions(content);

			expect(parts).toHaveLength(1);
			expect(parts[0]).toEqual({ type: 'text', content: 'Just text' });
		});
	});

	describe('countMentions', () => {
		it('counts all mentions', () => {
			const content =
				'<@550e8400-e29b-41d4-a716-446655440001> and <@&550e8400-e29b-41d4-a716-446655440002> plus @everyone';
			expect(countMentions(content)).toBe(3);
		});

		it('returns 0 for no mentions', () => {
			expect(countMentions('No mentions')).toBe(0);
		});
	});

	describe('hasMentions', () => {
		it('returns true for user mentions', () => {
			expect(hasMentions('<@550e8400-e29b-41d4-a716-446655440001>')).toBe(true);
		});

		it('returns true for role mentions', () => {
			expect(hasMentions('<@&550e8400-e29b-41d4-a716-446655440001>')).toBe(true);
		});

		it('returns true for channel mentions', () => {
			expect(hasMentions('<#550e8400-e29b-41d4-a716-446655440001>')).toBe(true);
		});

		it('returns true for @everyone', () => {
			expect(hasMentions('@everyone')).toBe(true);
		});

		it('returns true for @here', () => {
			expect(hasMentions('@here')).toBe(true);
		});

		it('returns false for no mentions', () => {
			expect(hasMentions('Just text')).toBe(false);
		});
	});
});
