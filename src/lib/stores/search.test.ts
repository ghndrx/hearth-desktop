import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import {
	parseSearchQuery,
	tokensToFilters,
	FILTER_BADGES,
	highlightSearchMatches,
	highlightSearchMatchesHtml,
	type ParsedSearchToken,
	type SearchState
} from './search';

vi.mock('$lib/api', () => ({
	api: {
		get: vi.fn(() => Promise.resolve({ messages: [], total_count: 0, has_more: false }))
	}
}));

describe('searchStore', () => {
	let searchStore: any;
	let api: any;

	beforeEach(async () => {
		vi.resetModules();
		vi.useFakeTimers();
		const module = await import('./search');
		searchStore = module.searchStore;
		searchStore.clear();
		api = (await import('$lib/api')).api;
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('parseSearchQuery', () => {
		it('should parse simple text query', () => {
			const result = parseSearchQuery('hello world');
			expect(result.tokens).toHaveLength(0);
			expect(result.freeText).toBe('hello world');
		});

		it('should parse from: filter', () => {
			const result = parseSearchQuery('from:@user123 test');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('from');
			expect(result.tokens[0].value).toBe('user123');
			expect(result.freeText).toBe('test');
		});

		it('should parse in: filter', () => {
			const result = parseSearchQuery('in:#general hello');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('in');
			expect(result.tokens[0].value).toBe('general');
			expect(result.freeText).toBe('hello');
		});

		it('should parse has: filter', () => {
			const result = parseSearchQuery('has:image');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('has');
			expect(result.tokens[0].value).toBe('image');
		});

		it('should parse before: filter', () => {
			const result = parseSearchQuery('before:2024-01-01 test');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('before');
			expect(result.tokens[0].value).toBe('2024-01-01');
		});

		it('should parse after: filter', () => {
			const result = parseSearchQuery('after:2024-01-01 test');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('after');
			expect(result.tokens[0].value).toBe('2024-01-01');
		});

		it('should parse pinned: filter', () => {
			const resultPinned = parseSearchQuery('pinned:true test');
			expect(resultPinned.tokens[0].type).toBe('pinned');
			expect(resultPinned.tokens[0].value).toBe('true');

			const resultYes = parseSearchQuery('pinned:yes test');
			expect(resultYes.tokens[0].value).toBe('yes');

			const resultNo = parseSearchQuery('pinned:false test');
			expect(resultNo.tokens[0].value).toBe('false');
		});

		it('should parse mentions: filter', () => {
			const result = parseSearchQuery('mentions:@user123');
			expect(result.tokens).toHaveLength(1);
			expect(result.tokens[0].type).toBe('mentions');
			expect(result.tokens[0].value).toBe('user123');
		});

		it('should parse multiple filters', () => {
			const result = parseSearchQuery('from:@user123 in:#general has:image test');
			expect(result.tokens).toHaveLength(3);
			expect(result.freeText).toBe('test');
		});

		it('should preserve raw values', () => {
			const result = parseSearchQuery('from:@user123');
			expect(result.tokens[0].raw).toBe('from:@user123');
		});
	});

	describe('tokensToFilters', () => {
		it('should convert has:attachment to has_attachments', () => {
			const tokens: ParsedSearchToken[] = [
				{ type: 'has', value: 'attachment', raw: 'has:attachment' }
			];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_attachments).toBe(true);
		});

		it('should convert has:image to has_image', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'image', raw: 'has:image' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_image).toBe(true);
		});

		it('should convert has:video to has_video', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'video', raw: 'has:video' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_video).toBe(true);
		});

		it('should convert has:link to has_link', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'link', raw: 'has:link' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_link).toBe(true);
		});

		it('should convert has:file to has_attachments', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'file', raw: 'has:file' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_attachments).toBe(true);
		});

		it('should convert has:url to has_link', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'url', raw: 'has:url' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_link).toBe(true);
		});

		it('should convert has:embed to has_embed', () => {
			const tokens: ParsedSearchToken[] = [{ type: 'has', value: 'embed', raw: 'has:embed' }];
			const filters = tokensToFilters(tokens, '');
			expect(filters.has_embed).toBe(true);
		});

		it('should convert before: to before filter', () => {
			const tokens: ParsedSearchToken[] = [
				{ type: 'before', value: '2024-01-01', raw: 'before:2024-01-01' }
			];
			const filters = tokensToFilters(tokens, '');
			expect(filters.before).toBe('2024-01-01T23:59:59Z');
		});

		it('should convert after: to after filter', () => {
			const tokens: ParsedSearchToken[] = [
				{ type: 'after', value: '2024-01-01', raw: 'after:2024-01-01' }
			];
			const filters = tokensToFilters(tokens, '');
			expect(filters.after).toBe('2024-01-01T00:00:00Z');
		});

		it('should convert pinned:true/yes to pinned', () => {
			const tokensTrue: ParsedSearchToken[] = [
				{ type: 'pinned', value: 'true', raw: 'pinned:true' }
			];
			const tokensYes: ParsedSearchToken[] = [{ type: 'pinned', value: 'yes', raw: 'pinned:yes' }];

			expect(tokensToFilters(tokensTrue, '').pinned).toBe(true);
			expect(tokensToFilters(tokensYes, '').pinned).toBe(true);
		});

		it('should convert pinned:false/no to pinned:false', () => {
			const tokensFalse: ParsedSearchToken[] = [
				{ type: 'pinned', value: 'false', raw: 'pinned:false' }
			];
			const tokensNo: ParsedSearchToken[] = [{ type: 'pinned', value: 'no', raw: 'pinned:no' }];

			expect(tokensToFilters(tokensFalse, '').pinned).toBe(false);
			expect(tokensToFilters(tokensNo, '').pinned).toBe(false);
		});

		it('should preserve free text as query', () => {
			const tokens: ParsedSearchToken[] = [];
			const filters = tokensToFilters(tokens, 'hello world');
			expect(filters.query).toBe('hello world');
		});
	});

	describe('FILTER_BADGES', () => {
		it('should have all filter types', () => {
			expect(FILTER_BADGES.from).toBeDefined();
			expect(FILTER_BADGES.in).toBeDefined();
			expect(FILTER_BADGES.has).toBeDefined();
			expect(FILTER_BADGES.before).toBeDefined();
			expect(FILTER_BADGES.after).toBeDefined();
			expect(FILTER_BADGES.pinned).toBeDefined();
			expect(FILTER_BADGES.mentions).toBeDefined();
		});

		it('should have correct badge structure', () => {
			expect(FILTER_BADGES.from.label).toBe('From');
			expect(FILTER_BADGES.from.icon).toBe('👤');
			expect(FILTER_BADGES.from.color).toBe('blue');
		});
	});

	describe('store state', () => {
		it('should have correct initial state', () => {
			const state = get(searchStore) as SearchState;

			expect(state.isOpen).toBe(false);
			expect(state.filters.query).toBe('');
			expect(state.results).toEqual([]);
			expect(state.totalCount).toBe(0);
			expect(state.hasMore).toBe(false);
			expect(state.loading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.offset).toBe(0);
			expect(state.suggestions).toEqual([]);
			expect(state.showSuggestions).toBe(false);
			expect(state.selectedSuggestionIndex).toBe(-1);
			expect(state.parsedTokens).toEqual([]);
			expect(state.freeText).toBe('');
		});

		it('should open search', () => {
			searchStore.open('server-1', 'channel-1');

			const state = get(searchStore) as SearchState;
			expect(state.isOpen).toBe(true);
			expect(state.showSuggestions).toBe(true);
			expect(state.filters.guild_id).toBe('server-1');
			expect(state.filters.channel_id).toBe('channel-1');
		});

		it('should open search with only server id', () => {
			searchStore.open('server-1');

			const state = get(searchStore) as SearchState;
			expect(state.isOpen).toBe(true);
			expect(state.filters.guild_id).toBe('server-1');
			expect(state.filters.channel_id).toBeUndefined();
		});

		it('should close search', () => {
			searchStore.open();
			searchStore.close();

			const state = get(searchStore) as SearchState;
			expect(state.isOpen).toBe(false);
			expect(state.showSuggestions).toBe(false);
		});

		it('should set query', () => {
			searchStore.setQuery('from:@user123 test');

			const state = get(searchStore) as SearchState;
			expect(state.filters.query).toBe('test');
			expect(state.parsedTokens).toHaveLength(1);
			expect(state.parsedTokens[0].type).toBe('from');
			expect(state.freeText).toBe('test');
			expect(state.showSuggestions).toBe(true);
		});

		it('should set query and reset suggestion index', () => {
			searchStore.setQuery('test');
			searchStore.navigateSuggestions('down');

			searchStore.setQuery('new query');

			const state = get(searchStore) as SearchState;
			expect(state.selectedSuggestionIndex).toBe(-1);
		});

		it('should set filters', () => {
			searchStore.setFilters({ guild_id: 'server-1', author_id: 'user-1' });

			const state = get(searchStore) as SearchState;
			expect(state.filters.guild_id).toBe('server-1');
			expect(state.filters.author_id).toBe('user-1');
			expect(state.results).toEqual([]);
			expect(state.offset).toBe(0);
		});

		it('should preserve existing filters when setting new ones', () => {
			searchStore.setFilters({ guild_id: 'server-1' });
			searchStore.setFilters({ author_id: 'user-1' });

			const state = get(searchStore) as SearchState;
			expect(state.filters.guild_id).toBe('server-1');
			expect(state.filters.author_id).toBe('user-1');
		});

		it('should hide suggestions', () => {
			searchStore.open();
			searchStore.hideSuggestions();

			const state = get(searchStore) as SearchState;
			expect(state.showSuggestions).toBe(false);
		});

		it('should show suggestions', () => {
			searchStore.hideSuggestions();
			searchStore.showSuggestions();

			const state = get(searchStore) as SearchState;
			expect(state.showSuggestions).toBe(true);
		});

		it('should navigate suggestions down', async () => {
			searchStore.setQuery('');

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				filters: [{ id: '1', name: 'test', value: 'test' }]
			});

			searchStore.fetchSuggestions('test', 'server-1');
			await vi.advanceTimersByTimeAsync(200);
			await vi.waitFor(() => {
				const state = get(searchStore) as SearchState;
				return state.suggestions.length > 0;
			});

			searchStore.navigateSuggestions('down');

			const state = get(searchStore) as SearchState;
			expect(state.selectedSuggestionIndex).toBe(0);
		});

		it('should navigate suggestions up from beginning to end', async () => {
			searchStore.setQuery('');

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				filters: [{ id: '1', name: 'test', value: 'test' }]
			});

			searchStore.fetchSuggestions('test', 'server-1');
			await vi.advanceTimersByTimeAsync(200);
			await vi.waitFor(() => {
				const state = get(searchStore) as SearchState;
				return state.suggestions.length > 0;
			});

			searchStore.navigateSuggestions('up');

			const state = get(searchStore) as SearchState;
			expect(state.selectedSuggestionIndex).toBeGreaterThanOrEqual(0);
		});

		it('should get selected suggestion', async () => {
			searchStore.setQuery('');

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				filters: [
					{ id: '1', name: 'test1', value: 'test1' },
					{ id: '2', name: 'test2', value: 'test2' }
				]
			});

			searchStore.fetchSuggestions('test', 'server-1');
			await vi.advanceTimersByTimeAsync(200);
			await vi.waitFor(() => {
				const state = get(searchStore) as SearchState;
				return state.suggestions.length > 0;
			});
			searchStore.navigateSuggestions('down');

			const suggestion = searchStore.getSelectedSuggestion();
			expect(suggestion).not.toBeNull();
			expect((suggestion as any).name).toBe('test1');
		});

		it('should return null for invalid selected suggestion index', () => {
			const suggestion = searchStore.getSelectedSuggestion();
			expect(suggestion).toBeNull();
		});

		it('should remove token', () => {
			searchStore.setQuery('from:@user123 test');
			searchStore.removeToken(0);

			const state = get(searchStore) as SearchState;
			expect(state.parsedTokens).toHaveLength(0);
			expect(state.results).toEqual([]);
		});

		it('should clear recent searches', () => {
			searchStore.clearRecentSearches();

			const state = get(searchStore) as SearchState;
			expect(state.recentSearches).toEqual([]);
		});

		it('should remove recent search', () => {
			searchStore.clearRecentSearches();
			searchStore.setQuery('test1');
			searchStore.setQuery('test2');

			searchStore.removeRecentSearch('test1');

			const state = get(searchStore) as SearchState;
			expect(state.recentSearches.some((r) => r.query === 'test1')).toBe(false);
		});

		it('should apply recent search', () => {
			searchStore.clearRecentSearches();
			searchStore.setQuery('test query');
			searchStore.setFilters({ guild_id: 'server-1' });

			const recentSearch = (get(searchStore) as SearchState).recentSearches[0];
			if (recentSearch) {
				searchStore.applyRecentSearch(recentSearch);

				const state = get(searchStore) as SearchState;
				expect(state.filters.query).toBe('test query');
				expect(state.showSuggestions).toBe(false);
			}
		});

		it('should clear store', () => {
			searchStore.setQuery('test');
			searchStore.clear();

			const state = get(searchStore) as SearchState;
			expect(state.filters.query).toBe('');
			expect(state.results).toEqual([]);
			expect(state.parsedTokens).toEqual([]);
		});

		it('should reset store', () => {
			searchStore.open('server-1');
			searchStore.setQuery('test');
			searchStore.reset();

			const state = get(searchStore) as SearchState;
			expect(state.filters.query).toBe('');
			expect(state.filters.guild_id).toBe('server-1');
		});
	});

	describe('search functionality', () => {
		it('should do nothing for empty query with no filters', async () => {
			await searchStore.search();

			const state = get(searchStore) as SearchState;
			expect(state.results).toEqual([]);
			expect(state.totalCount).toBe(0);
		});

		it('should search and return results', async () => {
			const mockResponse = {
				messages: [
					{
						id: '1',
						content: 'test message 1',
						channel_id: 'channel-1',
						author: null,
						timestamp: '',
						pinned: false
					},
					{
						id: '2',
						content: 'test message 2',
						channel_id: 'channel-1',
						author: null,
						timestamp: '',
						pinned: false
					}
				],
				total_count: 2,
				has_more: false
			};

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

			await searchStore.setQuery('test');
			await searchStore.search();

			const state = get(searchStore) as SearchState;
			expect(state.results).toHaveLength(2);
			expect(state.totalCount).toBe(2);
			expect(state.hasMore).toBe(false);
			expect(state.loading).toBe(false);
		});

		it('should handle search errors', async () => {
			(api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Search failed'));

			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			await searchStore.setQuery('test');
			await searchStore.search();

			const state = get(searchStore) as SearchState;
			expect(state.loading).toBe(false);
			expect(state.error).toBe('Search failed');

			consoleSpy.mockRestore();
		});

		it('should append results when loading more', async () => {
			const mockResponse1 = {
				messages: [
					{
						id: '1',
						content: 'message 1',
						channel_id: 'channel-1',
						author: null,
						timestamp: '',
						pinned: false
					}
				],
				total_count: 3,
				has_more: true
			};
			const mockResponse2 = {
				messages: [
					{
						id: '2',
						content: 'message 2',
						channel_id: 'channel-1',
						author: null,
						timestamp: '',
						pinned: false
					}
				],
				total_count: 3,
				has_more: false
			};

			(api.get as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(mockResponse1)
				.mockResolvedValueOnce(mockResponse2);

			await searchStore.setQuery('test');
			await searchStore.search();
			await searchStore.loadMore();

			const state = get(searchStore) as SearchState;
			expect(state.results).toHaveLength(2);
			expect(state.offset).toBe(2);
		});

		it('should use author_id filter', async () => {
			const mockResponse = {
				messages: [],
				total_count: 0,
				has_more: false
			};

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

			searchStore.setQuery('');
			searchStore.setFilters({ author_id: 'user-1' });
			await searchStore.search();

			expect(api.get).toHaveBeenCalledWith(expect.stringContaining('author_id=user-1'));
		});

		it('should use channel_id filter', async () => {
			const mockResponse = {
				messages: [],
				total_count: 0,
				has_more: false
			};

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

			searchStore.setQuery('');
			searchStore.setFilters({ channel_id: 'channel-1' });
			await searchStore.search();

			expect(api.get).toHaveBeenCalledWith(expect.stringContaining('channel_id=channel-1'));
		});

		it('should save recent search after successful search', async () => {
			const mockResponse = {
				messages: [
					{
						id: '1',
						content: 'test',
						channel_id: 'channel-1',
						author: null,
						timestamp: '',
						pinned: false
					}
				],
				total_count: 1,
				has_more: false
			};

			(api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

			await searchStore.setQuery('test query');
			await searchStore.search();

			const state = get(searchStore) as SearchState;
			expect(state.recentSearches.some((r) => r.query === 'test query')).toBe(true);
		});
	});
});

describe('highlightSearchMatches', () => {
	it('should return original text when query is empty', () => {
		const result = highlightSearchMatches('hello world', '', []);
		expect(result).toEqual([{ text: 'hello world', isMatch: false }]);
	});

	it('should highlight matching terms', () => {
		const result = highlightSearchMatches('hello world', 'hello', []);
		const matchingParts = result.filter((r) => r.isMatch);
		expect(matchingParts.length).toBeGreaterThan(0);
		expect(result.some((r) => r.text === 'hello' && r.isMatch)).toBe(true);
	});

	it('should handle multiple search terms', () => {
		const result = highlightSearchMatches('hello beautiful world', 'hello world', []);
		const matchTexts = result.filter((r) => r.isMatch).map((r) => r.text);
		expect(matchTexts).toContain('hello');
		expect(matchTexts).toContain('world');
	});

	it('should be case insensitive', () => {
		const result = highlightSearchMatches('Hello World', 'hello', []);
		expect(result.some((r) => r.isMatch)).toBe(true);
	});

	it('should handle empty content', () => {
		const result = highlightSearchMatches('', 'test', []);
		expect(result).toEqual([{ text: '', isMatch: false }]);
	});

	it('should handle no matching terms', () => {
		const result = highlightSearchMatches('hello world', 'xyz', []);
		expect(result).toHaveLength(1);
		expect(result[0].isMatch).toBe(false);
	});

	it('should escape regex special characters in query', () => {
		const result = highlightSearchMatches('test (1+1)', 'test (1', []);
		expect(result.some((r) => r.isMatch)).toBe(true);
	});
});

describe('highlightSearchMatchesHtml', () => {
	it('should return escaped HTML with highlights', () => {
		const result = highlightSearchMatchesHtml('hello world', 'hello', []);
		expect(result).toContain('<mark class="search-highlight">hello</mark>');
		expect(result).toContain('world');
	});

	it('should escape HTML special characters and highlight matches', () => {
		const result = highlightSearchMatchesHtml('<script>alert(1)</script>', 'script', []);
		expect(result).toContain('<mark class="search-highlight">script</mark>');
		expect(result).toContain('&lt;');
		expect(result).toContain('&gt;');
	});

	it('should handle empty inputs', () => {
		const result = highlightSearchMatchesHtml('', '', []);
		expect(result).toBe('');
	});
});
