import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { mentions, unreadMentions, unreadMentionCount, mentionsByChannel, mentionsByServer, type MentionContext } from './mentions';

// Mock the api module
vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn(),
		patch: vi.fn(),
		post: vi.fn()
	}
}));

// Mock the gateway store
vi.mock('$lib/stores/gateway', () => ({
	gateway: {
		subscribe: vi.fn(() => () => {}),
		on: vi.fn(() => () => {})
	}
}));

import { api } from '$lib/api';

const mockMentions: MentionContext[] = [
	{
		id: 'mention-1',
		user_id: 'user-1',
		message_id: 'message-1',
		mentioned_by: 'author-1',
		channel_id: 'channel-1',
		guild_id: 'guild-1',
		mention_type: 'user',
		created_at: '2024-01-15T10:00:00Z',
		author_name: 'TestUser',
		preview: 'Hello @you!'
	},
	{
		id: 'mention-2',
		user_id: 'user-1',
		message_id: 'message-2',
		mentioned_by: 'author-2',
		channel_id: 'channel-2',
		guild_id: 'guild-1',
		mention_type: 'role',
		read_at: '2024-01-15T11:00:00Z',
		created_at: '2024-01-15T10:30:00Z',
		author_name: 'OtherUser',
		preview: 'Attention @moderators!'
	},
	{
		id: 'mention-3',
		user_id: 'user-1',
		message_id: 'message-3',
		mentioned_by: 'author-3',
		channel_id: 'channel-1',
		mention_type: 'everyone',
		created_at: '2024-01-15T09:00:00Z',
		author_name: 'Admin',
		preview: '@everyone announcement'
	}
];

describe('mentions store', () => {
	beforeEach(() => {
		mentions.reset();
		vi.clearAllMocks();
	});

	afterEach(() => {
		mentions.reset();
	});

	describe('load', () => {
		it('loads mentions successfully', async () => {
			const mockResponse = {
				mentions: mockMentions,
				total_count: 3,
				has_more: false
			};

			vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

			await mentions.load();

			const state = get(mentions);
			expect(state.mentions).toHaveLength(3);
			expect(state.totalCount).toBe(3);
			expect(state.hasMore).toBe(false);
			expect(state.loading).toBe(false);
			expect(api.get).toHaveBeenCalledWith('/mentions');
		});

		it('loads unread mentions only', async () => {
			const mockResponse = {
				mentions: [mockMentions[0], mockMentions[2]],
				total_count: 2,
				has_more: false
			};

			vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

			await mentions.load({ unread: true });

			expect(api.get).toHaveBeenCalledWith('/mentions?unread=true');
		});

		it('handles pagination', async () => {
			const mockResponse = {
				mentions: mockMentions.slice(0, 2),
				total_count: 3,
				has_more: true
			};

			vi.mocked(api.get).mockResolvedValueOnce(mockResponse);

			await mentions.load({ limit: 2, offset: 0 });

			const state = get(mentions);
			expect(state.hasMore).toBe(true);
			expect(api.get).toHaveBeenCalledWith('/mentions?limit=2&offset=0');
		});

		it('sets error on failure', async () => {
			vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

			await expect(mentions.load()).rejects.toThrow('Network error');

			const state = get(mentions);
			expect(state.error).toBe('Network error');
			expect(state.loading).toBe(false);
		});
	});

	describe('loadStats', () => {
		it('loads mention statistics', async () => {
			const mockStats = {
				total_count: 100,
				unread_count: 5,
				today_count: 3
			};

			vi.mocked(api.get).mockResolvedValueOnce(mockStats);

			await mentions.loadStats();

			const state = get(mentions);
			expect(state.stats).toEqual(mockStats);
			expect(api.get).toHaveBeenCalledWith('/mentions/stats');
		});
	});

	describe('getUnreadCount', () => {
		it('returns unread count', async () => {
			vi.mocked(api.get).mockResolvedValueOnce({ count: 5 });

			const count = await mentions.getUnreadCount();

			expect(count).toBe(5);
			expect(api.get).toHaveBeenCalledWith('/mentions/unread/count');
		});

		it('returns 0 on error', async () => {
			vi.mocked(api.get).mockRejectedValueOnce(new Error('Failed'));

			const count = await mentions.getUnreadCount();

			expect(count).toBe(0);
		});
	});

	describe('markAsRead', () => {
		it('marks a mention as read', async () => {
			// First load mentions
			vi.mocked(api.get).mockResolvedValueOnce({
				mentions: mockMentions,
				total_count: 3,
				has_more: false
			});
			await mentions.load();

			vi.mocked(api.patch).mockResolvedValueOnce({ success: true });

			await mentions.markAsRead('mention-1');

			expect(api.patch).toHaveBeenCalledWith('/mentions/mention-1/read', {});

			const state = get(mentions);
			const mention = state.mentions.find(m => m.id === 'mention-1');
			expect(mention?.read_at).toBeTruthy();
		});
	});

	describe('markAllAsRead', () => {
		it('marks all mentions as read', async () => {
			// First load mentions
			vi.mocked(api.get).mockResolvedValueOnce({
				mentions: mockMentions,
				total_count: 3,
				has_more: false
			});
			await mentions.load();

			vi.mocked(api.post).mockResolvedValueOnce({ success: true, count: 2 });

			const count = await mentions.markAllAsRead();

			expect(count).toBe(2);
			expect(api.post).toHaveBeenCalledWith('/mentions/read-all', {});

			const state = get(mentions);
			expect(state.mentions.every(m => m.read_at)).toBe(true);
		});
	});

	describe('markChannelAsRead', () => {
		it('marks channel mentions as read', async () => {
			// First load mentions
			vi.mocked(api.get).mockResolvedValueOnce({
				mentions: mockMentions,
				total_count: 3,
				has_more: false
			});
			await mentions.load();

			vi.mocked(api.post).mockResolvedValueOnce({ success: true, count: 2 });
			vi.mocked(api.get).mockResolvedValueOnce({
				total_count: 100,
				unread_count: 3,
				today_count: 1
			});

			await mentions.markChannelAsRead('channel-1');

			expect(api.post).toHaveBeenCalledWith('/mentions/channel/channel-1/read-all', {});
		});
	});

	describe('search', () => {
		it('searches mentions', async () => {
			const searchResults = [mockMentions[0]];
			vi.mocked(api.get).mockResolvedValueOnce({ mentions: searchResults });

			const results = await mentions.search('hello');

			expect(results).toHaveLength(1);
			expect(api.get).toHaveBeenCalledWith('/mentions/search?q=hello&limit=20');
		});

		it('returns empty array on error', async () => {
			vi.mocked(api.get).mockRejectedValueOnce(new Error('Failed'));

			const results = await mentions.search('hello');

			expect(results).toHaveLength(0);
		});
	});

	describe('reset', () => {
		it('resets the store', async () => {
			vi.mocked(api.get).mockResolvedValueOnce({
				mentions: mockMentions,
				total_count: 3,
				has_more: false
			});
			await mentions.load();

			mentions.reset();

			const state = get(mentions);
			expect(state.mentions).toHaveLength(0);
			expect(state.stats).toBeNull();
			expect(state.loading).toBe(false);
			expect(state.error).toBeNull();
		});
	});
});

describe('derived stores', () => {
	beforeEach(async () => {
		mentions.reset();
		vi.clearAllMocks();

		vi.mocked(api.get).mockResolvedValueOnce({
			mentions: mockMentions,
			total_count: 3,
			has_more: false
		});
		await mentions.load();
	});

	afterEach(() => {
		mentions.reset();
	});

	describe('unreadMentions', () => {
		it('filters to unread mentions only', () => {
			const unread = get(unreadMentions);
			expect(unread).toHaveLength(2); // mention-1 and mention-3 are unread
		});
	});

	describe('unreadMentionCount', () => {
		it('returns count of unread mentions', () => {
			const count = get(unreadMentionCount);
			expect(count).toBe(2);
		});

		it('prefers stats.unread_count when available', async () => {
			vi.mocked(api.get).mockResolvedValueOnce({
				total_count: 100,
				unread_count: 10,
				today_count: 5
			});
			await mentions.loadStats();

			const count = get(unreadMentionCount);
			expect(count).toBe(10);
		});
	});

	describe('mentionsByChannel', () => {
		it('groups mentions by channel', () => {
			const grouped = get(mentionsByChannel);
			expect(grouped.get('channel-1')).toHaveLength(2);
			expect(grouped.get('channel-2')).toHaveLength(1);
		});
	});

	describe('mentionsByServer', () => {
		it('groups mentions by server', () => {
			const grouped = get(mentionsByServer);
			expect(grouped.get('guild-1')).toHaveLength(2);
			expect(grouped.get(null)).toHaveLength(1); // DM mention
		});
	});
});
