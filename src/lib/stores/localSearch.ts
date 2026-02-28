/**
 * Local Search Store - Manages FTS5-powered local message search
 */
import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface SearchResult {
    message_id: string;
    channel_id: string;
    server_id: string | null;
    author_id: string;
    author_name: string;
    content: string;
    snippet: string;
    timestamp: number;
    relevance: number;
    has_attachments: boolean;
    has_embeds: boolean;
    is_pinned: boolean;
}

export interface SearchOptions {
    query: string;
    channel_ids?: string[];
    server_ids?: string[];
    author_ids?: string[];
    from_date?: number;
    to_date?: number;
    has_attachments?: boolean;
    has_embeds?: boolean;
    is_pinned?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: 'relevance' | 'date';
    sort_order?: 'asc' | 'desc';
}

export interface IndexableMessage {
    message_id: string;
    channel_id: string;
    server_id: string | null;
    author_id: string;
    author_name: string;
    content: string;
    timestamp: number;
    has_attachments: boolean;
    has_embeds: boolean;
    is_pinned: boolean;
    is_edited: boolean;
}

export interface IndexStats {
    total_messages: number;
    total_channels: number;
    total_servers: number;
    index_size_bytes: number;
    last_indexed_at: number | null;
    oldest_message: number | null;
    newest_message: number | null;
}

// Store state
interface LocalSearchState {
    isOpen: boolean;
    isSearching: boolean;
    isIndexing: boolean;
    query: string;
    results: SearchResult[];
    stats: IndexStats | null;
    error: string | null;
    options: Partial<SearchOptions>;
}

const initialState: LocalSearchState = {
    isOpen: false,
    isSearching: false,
    isIndexing: false,
    query: '',
    results: [],
    stats: null,
    error: null,
    options: {
        sort_by: 'relevance',
        sort_order: 'desc',
        limit: 50,
    },
};

function createLocalSearchStore() {
    const { subscribe, set, update } = writable<LocalSearchState>(initialState);

    return {
        subscribe,
        
        // UI state
        open: () => update(s => ({ ...s, isOpen: true })),
        close: () => update(s => ({ ...s, isOpen: false })),
        toggle: () => update(s => ({ ...s, isOpen: !s.isOpen })),
        
        setQuery: (query: string) => update(s => ({ ...s, query })),
        
        setOptions: (options: Partial<SearchOptions>) => update(s => ({
            ...s,
            options: { ...s.options, ...options },
        })),
        
        clearFilters: () => update(s => ({
            ...s,
            options: {
                sort_by: 'relevance',
                sort_order: 'desc',
                limit: 50,
            },
        })),

        // Search operations
        search: async (query?: string) => {
            update(s => ({
                ...s,
                isSearching: true,
                error: null,
                query: query ?? s.query,
            }));

            try {
                const state = get({ subscribe });
                const searchQuery = query ?? state.query;
                
                if (!searchQuery.trim()) {
                    update(s => ({ ...s, results: [], isSearching: false }));
                    return [];
                }

                const options: SearchOptions = {
                    query: searchQuery,
                    ...state.options,
                };

                const results = await invoke<SearchResult[]>('search_messages', { options });
                update(s => ({ ...s, results, isSearching: false }));
                return results;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                update(s => ({ ...s, error: errorMessage, isSearching: false }));
                throw error;
            }
        },

        // Index operations
        indexMessage: async (message: IndexableMessage) => {
            try {
                await invoke('index_message', { message });
            } catch (error) {
                console.error('Failed to index message:', error);
                throw error;
            }
        },

        indexMessages: async (messages: IndexableMessage[]) => {
            update(s => ({ ...s, isIndexing: true }));
            try {
                const count = await invoke<number>('index_messages_batch', { messages });
                update(s => ({ ...s, isIndexing: false }));
                return count;
            } catch (error) {
                update(s => ({ ...s, isIndexing: false }));
                throw error;
            }
        },

        deleteMessage: async (messageId: string) => {
            try {
                await invoke('delete_indexed_message', { messageId });
            } catch (error) {
                console.error('Failed to delete indexed message:', error);
                throw error;
            }
        },

        // Stats and maintenance
        loadStats: async () => {
            try {
                const stats = await invoke<IndexStats>('get_search_stats');
                update(s => ({ ...s, stats }));
                return stats;
            } catch (error) {
                console.error('Failed to load search stats:', error);
                throw error;
            }
        },

        optimize: async () => {
            update(s => ({ ...s, isIndexing: true }));
            try {
                await invoke('optimize_search_index');
                update(s => ({ ...s, isIndexing: false }));
            } catch (error) {
                update(s => ({ ...s, isIndexing: false }));
                throw error;
            }
        },

        clear: async () => {
            update(s => ({ ...s, isIndexing: true }));
            try {
                await invoke('clear_search_index');
                update(s => ({ ...s, results: [], stats: null, isIndexing: false }));
            } catch (error) {
                update(s => ({ ...s, isIndexing: false }));
                throw error;
            }
        },

        reset: () => set(initialState),
    };
}

export const localSearch = createLocalSearchStore();

// Derived stores
export const isSearchOpen = derived(localSearch, $s => $s.isOpen);
export const searchResults = derived(localSearch, $s => $s.results);
export const searchStats = derived(localSearch, $s => $s.stats);
export const isSearchBusy = derived(localSearch, $s => $s.isSearching || $s.isIndexing);

// Helper to auto-index messages from WebSocket/API events
export function createMessageIndexer() {
    const pendingMessages: IndexableMessage[] = [];
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;
    const BATCH_SIZE = 50;
    const FLUSH_DELAY = 2000;

    const flush = async () => {
        if (pendingMessages.length === 0) return;
        
        const batch = pendingMessages.splice(0, BATCH_SIZE);
        try {
            await localSearch.indexMessages(batch);
        } catch (error) {
            console.error('Failed to flush message batch to search index:', error);
            // Re-queue failed messages
            pendingMessages.unshift(...batch);
        }

        // Continue if there are more
        if (pendingMessages.length > 0) {
            flushTimeout = setTimeout(flush, FLUSH_DELAY);
        }
    };

    return {
        queue: (message: IndexableMessage) => {
            pendingMessages.push(message);
            
            // Auto-flush when batch size reached
            if (pendingMessages.length >= BATCH_SIZE) {
                if (flushTimeout) {
                    clearTimeout(flushTimeout);
                }
                flush();
            } else if (!flushTimeout) {
                // Schedule delayed flush for small batches
                flushTimeout = setTimeout(flush, FLUSH_DELAY);
            }
        },
        
        forceFlush: flush,
        
        clear: () => {
            pendingMessages.length = 0;
            if (flushTimeout) {
                clearTimeout(flushTimeout);
                flushTimeout = null;
            }
        },
    };
}

// Singleton indexer instance
export const messageIndexer = createMessageIndexer();
