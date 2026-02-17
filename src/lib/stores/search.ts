import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { api } from '$lib/api';

// ==================== Types ====================

export interface SearchResult {
	id: string;
	channel_id: string;
	guild_id?: string;
	author: {
		id: string;
		username: string;
		display_name?: string | null;
		avatar?: string | null;
	} | null;
	content: string;
	timestamp: string;
	edited_timestamp?: string | null;
	attachments?: { id: string; filename: string; url: string; alt_text?: string }[];
	pinned: boolean;
}

export interface SearchResponse {
	messages: SearchResult[];
	total_count: number;
	has_more: boolean;
}

export interface SearchSuggestion {
	type: 'user' | 'channel' | 'filter' | 'recent';
	id?: string;
	name: string;
	description?: string;
	icon?: string;
	value: string;
}

export interface SearchSuggestionsResponse {
	users?: SearchSuggestion[];
	channels?: SearchSuggestion[];
	filters?: SearchSuggestion[];
}

export interface ParsedSearchToken {
	type: 'text' | 'from' | 'in' | 'has' | 'before' | 'after' | 'pinned' | 'mentions';
	value: string;
	raw: string;
}

export interface SearchFilters {
	query: string;
	guild_id?: string;
	channel_id?: string;
	author_id?: string;
	before?: string;
	after?: string;
	has_attachments?: boolean;
	has_image?: boolean;
	has_video?: boolean;
	has_link?: boolean;
	has_embed?: boolean;
	pinned?: boolean;
}

export interface RecentSearch {
	query: string;
	timestamp: number;
	filters?: Partial<SearchFilters>;
}

interface SearchState {
	isOpen: boolean;
	filters: SearchFilters;
	results: SearchResult[];
	totalCount: number;
	hasMore: boolean;
	loading: boolean;
	error: string | null;
	offset: number;
	// Type-ahead suggestions
	suggestions: SearchSuggestion[];
	suggestionsLoading: boolean;
	showSuggestions: boolean;
	selectedSuggestionIndex: number;
	// Parsed query tokens for UI display
	parsedTokens: ParsedSearchToken[];
	freeText: string;
	// Recent searches
	recentSearches: RecentSearch[];
}

// ==================== Constants ====================

const RECENT_SEARCHES_KEY = 'hearth_recent_searches';
const MAX_RECENT_SEARCHES = 10;

const FILTER_PATTERNS: Record<string, RegExp> = {
	from: /from:\s*<?@?([^\s>]+)>?/gi,
	in: /in:\s*<?#?([^\s>]+)>?/gi,
	has: /has:\s*(\w+)/gi,
	before: /before:\s*(\d{4}-\d{2}-\d{2})/gi,
	after: /after:\s*(\d{4}-\d{2}-\d{2})/gi,
	pinned: /pinned:\s*(true|false|yes|no)/gi,
	mentions: /mentions:\s*<?@?([^\s>]+)>?/gi,
};

// ==================== Helper Functions ====================

function loadRecentSearches(): RecentSearch[] {
	if (!browser) return [];
	try {
		const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
		if (stored) {
			const searches = JSON.parse(stored) as RecentSearch[];
			// Filter out old searches (older than 30 days)
			const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
			return searches.filter(s => s.timestamp > thirtyDaysAgo);
		}
	} catch (e) {
		console.error('Failed to load recent searches:', e);
	}
	return [];
}

function saveRecentSearches(searches: RecentSearch[]) {
	if (!browser) return;
	try {
		localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)));
	} catch (e) {
		console.error('Failed to save recent searches:', e);
	}
}

export function parseSearchQuery(query: string): { tokens: ParsedSearchToken[]; freeText: string } {
	const tokens: ParsedSearchToken[] = [];
	let remainingQuery = query;

	// Parse each filter type
	for (const [filterType, pattern] of Object.entries(FILTER_PATTERNS)) {
		const regex = new RegExp(pattern.source, pattern.flags);
		let match;
		while ((match = regex.exec(query)) !== null) {
			tokens.push({
				type: filterType as ParsedSearchToken['type'],
				value: match[1],
				raw: match[0],
			});
			remainingQuery = remainingQuery.replace(match[0], '');
		}
	}

	return {
		tokens,
		freeText: remainingQuery.trim(),
	};
}

export function tokensToFilters(tokens: ParsedSearchToken[], freeText: string): Partial<SearchFilters> {
	const filters: Partial<SearchFilters> = {
		query: freeText,
	};

	for (const token of tokens) {
		switch (token.type) {
			case 'has':
				const hasValue = token.value.toLowerCase();
				if (hasValue === 'attachment' || hasValue === 'file') {
					filters.has_attachments = true;
				} else if (hasValue === 'image') {
					filters.has_image = true;
				} else if (hasValue === 'video') {
					filters.has_video = true;
				} else if (hasValue === 'link' || hasValue === 'url') {
					filters.has_link = true;
				} else if (hasValue === 'embed') {
					filters.has_embed = true;
				}
				break;
			case 'before':
				filters.before = token.value + 'T23:59:59Z';
				break;
			case 'after':
				filters.after = token.value + 'T00:00:00Z';
				break;
			case 'pinned':
				const pinnedVal = token.value.toLowerCase();
				filters.pinned = pinnedVal === 'true' || pinnedVal === 'yes';
				break;
		}
	}

	return filters;
}

// Filter badge info for UI display
export const FILTER_BADGES: Record<string, { label: string; icon: string; color: string }> = {
	from: { label: 'From', icon: '👤', color: 'blue' },
	in: { label: 'In', icon: '#', color: 'green' },
	has: { label: 'Has', icon: '📎', color: 'purple' },
	before: { label: 'Before', icon: '📅', color: 'orange' },
	after: { label: 'After', icon: '📅', color: 'orange' },
	pinned: { label: 'Pinned', icon: '📌', color: 'red' },
	mentions: { label: 'Mentions', icon: '@', color: 'yellow' },
};

// ==================== Store ====================

const initialState: SearchState = {
	isOpen: false,
	filters: { query: '' },
	results: [],
	totalCount: 0,
	hasMore: false,
	loading: false,
	error: null,
	offset: 0,
	suggestions: [],
	suggestionsLoading: false,
	showSuggestions: false,
	selectedSuggestionIndex: -1,
	parsedTokens: [],
	freeText: '',
	recentSearches: loadRecentSearches(),
};

function createSearchStore() {
	const { subscribe, set, update } = writable<SearchState>(initialState);

	let suggestionsAbortController: AbortController | null = null;
	let suggestionsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	return {
		subscribe,

		open(serverId?: string, channelId?: string) {
			update(state => ({
				...state,
				isOpen: true,
				showSuggestions: true,
				filters: {
					...state.filters,
					guild_id: serverId,
					channel_id: channelId,
				},
			}));
		},

		close() {
			update(state => ({
				...state,
				isOpen: false,
				showSuggestions: false,
			}));
		},

		setQuery(query: string) {
			const { tokens, freeText } = parseSearchQuery(query);
			const derivedFilters = tokensToFilters(tokens, freeText);
			
			update(state => ({
				...state,
				filters: { 
					...state.filters, 
					...derivedFilters,
					query: freeText 
				},
				parsedTokens: tokens,
				freeText,
				showSuggestions: true,
				selectedSuggestionIndex: -1,
			}));
		},

		setFilters(filters: Partial<SearchFilters>) {
			update(state => ({
				...state,
				filters: { ...state.filters, ...filters },
				results: [],
				offset: 0,
				totalCount: 0,
				hasMore: false,
			}));
		},

		async fetchSuggestions(query: string, serverId?: string) {
			// Cancel previous request
			if (suggestionsAbortController) {
				suggestionsAbortController.abort();
			}
			if (suggestionsDebounceTimer) {
				clearTimeout(suggestionsDebounceTimer);
			}

			// Debounce
			suggestionsDebounceTimer = setTimeout(async () => {
				update(state => ({ ...state, suggestionsLoading: true }));
				
				suggestionsAbortController = new AbortController();

				try {
					const params = new URLSearchParams();
					params.set('q', query);
					params.set('limit', '5');
					if (serverId) {
						params.set('guild_id', serverId);
					}

					const response = await api.get<SearchSuggestionsResponse>(`/search/suggestions?${params}`);
					
					const suggestions: SearchSuggestion[] = [];
					
					// Add filter suggestions
					if (response.filters) {
						suggestions.push(...response.filters.map(f => ({ ...f, type: 'filter' as const })));
					}
					
					// Add user suggestions
					if (response.users) {
						suggestions.push(...response.users.map(u => ({ ...u, type: 'user' as const })));
					}
					
					// Add channel suggestions
					if (response.channels) {
						suggestions.push(...response.channels.map(c => ({ ...c, type: 'channel' as const })));
					}

					update(state => ({
						...state,
						suggestions,
						suggestionsLoading: false,
					}));
				} catch (error) {
					if (error instanceof Error && error.name !== 'AbortError') {
						console.error('Failed to fetch suggestions:', error);
						update(state => ({ ...state, suggestionsLoading: false }));
					}
				}
			}, 150);
		},

		selectSuggestion(suggestion: SearchSuggestion) {
			update(state => {
				const currentQuery = state.freeText;
				const tokens = state.parsedTokens;
				
				// Build new query with the suggestion value appended
				let newQuery = tokens.map(t => t.raw).join(' ');
				if (newQuery) newQuery += ' ';
				
				// For filter suggestions, just add the value
				if (suggestion.type === 'filter') {
					newQuery += suggestion.value;
				} else {
					newQuery += suggestion.value;
				}

				// Preserve any remaining free text that wasn't part of the suggestion
				const { tokens: newTokens, freeText: newFreeText } = parseSearchQuery(newQuery);

				return {
					...state,
					filters: {
						...state.filters,
						query: newFreeText,
					},
					parsedTokens: newTokens,
					freeText: newFreeText,
					showSuggestions: false,
					selectedSuggestionIndex: -1,
				};
			});

			// Return the new full query for the input
			const state = get({ subscribe });
			return state.parsedTokens.map(t => t.raw).join(' ') + (state.freeText ? ' ' + state.freeText : '');
		},

		hideSuggestions() {
			update(state => ({ ...state, showSuggestions: false }));
		},

		showSuggestions() {
			update(state => ({ ...state, showSuggestions: true }));
		},

		navigateSuggestions(direction: 'up' | 'down') {
			update(state => {
				const total = state.suggestions.length + state.recentSearches.length;
				if (total === 0) return state;

				let newIndex = state.selectedSuggestionIndex;
				if (direction === 'down') {
					newIndex = newIndex < total - 1 ? newIndex + 1 : 0;
				} else {
					newIndex = newIndex > 0 ? newIndex - 1 : total - 1;
				}

				return { ...state, selectedSuggestionIndex: newIndex };
			});
		},

		getSelectedSuggestion(): SearchSuggestion | RecentSearch | null {
			const state = get({ subscribe });
			const idx = state.selectedSuggestionIndex;
			
			if (idx < 0) return null;
			
			if (idx < state.suggestions.length) {
				return state.suggestions[idx];
			}
			
			const recentIdx = idx - state.suggestions.length;
			if (recentIdx < state.recentSearches.length) {
				return state.recentSearches[recentIdx];
			}
			
			return null;
		},

		async search(append = false) {
			const state = get({ subscribe });
			
			// Build full query from tokens + freeText
			const fullQuery = [
				...state.parsedTokens.map(t => t.raw),
				state.freeText
			].filter(Boolean).join(' ');
			
			if (!fullQuery.trim() && !state.filters.author_id && !state.filters.channel_id) {
				update(s => ({ ...s, results: [], totalCount: 0, hasMore: false, error: null }));
				return;
			}

			update(s => ({ ...s, loading: true, error: null, showSuggestions: false }));

			try {
				const params = new URLSearchParams();
				params.set('q', fullQuery);
				params.set('limit', '25');
				params.set('offset', append ? String(state.offset) : '0');

				if (state.filters.guild_id) {
					params.set('guild_id', state.filters.guild_id);
				}
				if (state.filters.channel_id) {
					params.set('channel_id', state.filters.channel_id);
				}
				if (state.filters.author_id) {
					params.set('author_id', state.filters.author_id);
				}
				if (state.filters.before) {
					params.set('before', state.filters.before);
				}
				if (state.filters.after) {
					params.set('after', state.filters.after);
				}
				if (state.filters.has_attachments) {
					params.set('has_attachments', 'true');
				}
				if (state.filters.pinned !== undefined) {
					params.set('pinned', String(state.filters.pinned));
				}

				const response = await api.get<SearchResponse>(`/search/messages?${params}`);

				// Save to recent searches
				if (!append && fullQuery.trim()) {
					const recentSearch: RecentSearch = {
						query: fullQuery,
						timestamp: Date.now(),
						filters: state.filters,
					};
					
					update(s => {
						const recentSearches = [
							recentSearch,
							...s.recentSearches.filter(r => r.query !== fullQuery)
						].slice(0, MAX_RECENT_SEARCHES);
						
						saveRecentSearches(recentSearches);
						
						return {
							...s,
							recentSearches,
						};
					});
				}

				update(s => ({
					...s,
					results: append ? [...s.results, ...response.messages] : response.messages,
					totalCount: response.total_count,
					hasMore: response.has_more,
					offset: append ? s.offset + response.messages.length : response.messages.length,
					loading: false,
				}));
			} catch (error) {
				console.error('Search failed:', error);
				update(s => ({
					...s,
					loading: false,
					error: error instanceof Error ? error.message : 'Search failed',
				}));
			}
		},

		loadMore() {
			return this.search(true);
		},

		removeToken(index: number) {
			update(state => {
				const newTokens = [...state.parsedTokens];
				newTokens.splice(index, 1);
				
				const derivedFilters = tokensToFilters(newTokens, state.freeText);
				
				return {
					...state,
					parsedTokens: newTokens,
					filters: {
						...state.filters,
						...derivedFilters,
					},
					results: [],
					offset: 0,
					totalCount: 0,
					hasMore: false,
				};
			});

			// Return new full query
			const state = get({ subscribe });
			return state.parsedTokens.map(t => t.raw).join(' ') + (state.freeText ? ' ' + state.freeText : '');
		},

		clearRecentSearches() {
			update(state => ({ ...state, recentSearches: [] }));
			saveRecentSearches([]);
		},

		removeRecentSearch(query: string) {
			update(state => {
				const recentSearches = state.recentSearches.filter(r => r.query !== query);
				saveRecentSearches(recentSearches);
				return { ...state, recentSearches };
			});
		},

		applyRecentSearch(recent: RecentSearch) {
			const { tokens, freeText } = parseSearchQuery(recent.query);
			
			update(state => ({
				...state,
				parsedTokens: tokens,
				freeText,
				filters: {
					...state.filters,
					...recent.filters,
					query: freeText,
				},
				showSuggestions: false,
			}));
			
			return recent.query;
		},

		clear() {
			set({
				...initialState,
				recentSearches: loadRecentSearches(),
			});
		},

		reset() {
			update(state => ({
				...initialState,
				isOpen: state.isOpen,
				filters: { query: '', guild_id: state.filters.guild_id },
				recentSearches: state.recentSearches,
			}));
		},
	};
}

export const searchStore = createSearchStore();

// ==================== Derived Stores ====================

export const isSearchOpen = derived(searchStore, $s => $s.isOpen);
export const searchResults = derived(searchStore, $s => $s.results);
export const searchLoading = derived(searchStore, $s => $s.loading);
export const searchError = derived(searchStore, $s => $s.error);
export const searchTotalCount = derived(searchStore, $s => $s.totalCount);
export const searchHasMore = derived(searchStore, $s => $s.hasMore);
export const searchSuggestions = derived(searchStore, $s => $s.suggestions);
export const searchSuggestionsLoading = derived(searchStore, $s => $s.suggestionsLoading);
export const showSearchSuggestions = derived(searchStore, $s => $s.showSuggestions);
export const searchParsedTokens = derived(searchStore, $s => $s.parsedTokens);
export const searchFreeText = derived(searchStore, $s => $s.freeText);
export const recentSearches = derived(searchStore, $s => $s.recentSearches);
export const selectedSuggestionIndex = derived(searchStore, $s => $s.selectedSuggestionIndex);

// ==================== Highlighting Utility ====================

export interface HighlightMatch {
	text: string;
	isMatch: boolean;
}

/**
 * Highlights matching text in a string, supporting fuzzy matching
 */
export function highlightSearchMatches(content: string, query: string, tokens: ParsedSearchToken[]): HighlightMatch[] {
	if (!content) return [{ text: '', isMatch: false }];
	if (!query && tokens.length === 0) return [{ text: content, isMatch: false }];

	// Build list of terms to highlight
	const terms: string[] = [];
	
	// Add free text query terms
	if (query) {
		terms.push(...query.toLowerCase().split(/\s+/).filter(Boolean));
	}

	if (terms.length === 0) {
		return [{ text: content, isMatch: false }];
	}

	// Create a regex that matches any of the terms (word boundary aware for better highlighting)
	const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
	
	const parts = content.split(regex);
	const result: HighlightMatch[] = [];
	
	for (const part of parts) {
		if (!part) continue;
		
		const isMatch = terms.some(term => 
			part.toLowerCase().includes(term.toLowerCase())
		);
		
		result.push({ text: part, isMatch });
	}

	return result;
}

/**
 * Returns HTML string with highlighted matches (for use with {@html})
 */
export function highlightSearchMatchesHtml(content: string, query: string, tokens: ParsedSearchToken[] = []): string {
	const matches = highlightSearchMatches(content, query, tokens);
	
	return matches
		.map(m => {
			const escaped = escapeHtml(m.text);
			return m.isMatch 
				? `<mark class="search-highlight">${escaped}</mark>` 
				: escaped;
		})
		.join('');
}

function escapeHtml(str: string): string {
	const div = document.createElement('div');
	div.textContent = str;
	return div.innerHTML;
}
