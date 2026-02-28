import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
    localSearch,
    isSearchOpen,
    searchResults,
    searchStats,
    isSearchBusy,
    createMessageIndexer,
    type IndexableMessage,
    type SearchResult,
    type IndexStats,
} from './localSearch';

const mockInvoke = vi.mocked(invoke);

describe('localSearch store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localSearch.reset();
    });

    describe('UI state', () => {
        it('should open and close search modal', () => {
            expect(get(isSearchOpen)).toBe(false);
            
            localSearch.open();
            expect(get(isSearchOpen)).toBe(true);
            
            localSearch.close();
            expect(get(isSearchOpen)).toBe(false);
        });

        it('should toggle search modal', () => {
            expect(get(isSearchOpen)).toBe(false);
            
            localSearch.toggle();
            expect(get(isSearchOpen)).toBe(true);
            
            localSearch.toggle();
            expect(get(isSearchOpen)).toBe(false);
        });

        it('should update query', () => {
            localSearch.setQuery('test query');
            const state = get(localSearch);
            expect(state.query).toBe('test query');
        });

        it('should update options', () => {
            localSearch.setOptions({
                sort_by: 'date',
                has_attachments: true,
            });
            
            const state = get(localSearch);
            expect(state.options.sort_by).toBe('date');
            expect(state.options.has_attachments).toBe(true);
        });

        it('should clear filters', () => {
            localSearch.setOptions({
                channel_ids: ['chan1'],
                has_attachments: true,
            });
            
            localSearch.clearFilters();
            
            const state = get(localSearch);
            expect(state.options.channel_ids).toBeUndefined();
            expect(state.options.has_attachments).toBeUndefined();
            expect(state.options.sort_by).toBe('relevance');
        });
    });

    describe('search', () => {
        it('should search messages', async () => {
            const mockResults: SearchResult[] = [
                {
                    message_id: 'msg1',
                    channel_id: 'chan1',
                    server_id: 'srv1',
                    author_id: 'user1',
                    author_name: 'Alice',
                    content: 'Hello world',
                    snippet: 'Hello <mark>world</mark>',
                    timestamp: 1700000000,
                    relevance: 0.95,
                    has_attachments: false,
                    has_embeds: false,
                    is_pinned: false,
                },
            ];

            mockInvoke.mockResolvedValue(mockResults);

            localSearch.setQuery('world');
            const results = await localSearch.search();

            expect(mockInvoke).toHaveBeenCalledWith('search_messages', {
                options: expect.objectContaining({
                    query: 'world',
                }),
            });
            expect(results).toEqual(mockResults);
            expect(get(searchResults)).toEqual(mockResults);
        });

        it('should clear results for empty query', async () => {
            localSearch.setQuery('');
            await localSearch.search();

            expect(mockInvoke).not.toHaveBeenCalled();
            expect(get(searchResults)).toEqual([]);
        });

        it('should handle search errors', async () => {
            mockInvoke.mockRejectedValue(new Error('Search failed'));

            localSearch.setQuery('test');
            
            await expect(localSearch.search()).rejects.toThrow('Search failed');
            
            const state = get(localSearch);
            expect(state.error).toBe('Search failed');
            expect(state.isSearching).toBe(false);
        });
    });

    describe('indexing', () => {
        it('should index a single message', async () => {
            mockInvoke.mockResolvedValue(undefined);

            const message: IndexableMessage = {
                message_id: 'msg1',
                channel_id: 'chan1',
                server_id: 'srv1',
                author_id: 'user1',
                author_name: 'Alice',
                content: 'Test message',
                timestamp: 1700000000,
                has_attachments: false,
                has_embeds: false,
                is_pinned: false,
                is_edited: false,
            };

            await localSearch.indexMessage(message);

            expect(mockInvoke).toHaveBeenCalledWith('index_message', { message });
        });

        it('should batch index messages', async () => {
            mockInvoke.mockResolvedValue(10);

            const messages: IndexableMessage[] = Array(10).fill(null).map((_, i) => ({
                message_id: `msg${i}`,
                channel_id: 'chan1',
                server_id: 'srv1',
                author_id: 'user1',
                author_name: 'Alice',
                content: `Message ${i}`,
                timestamp: 1700000000 + i,
                has_attachments: false,
                has_embeds: false,
                is_pinned: false,
                is_edited: false,
            }));

            const count = await localSearch.indexMessages(messages);

            expect(mockInvoke).toHaveBeenCalledWith('index_messages_batch', { messages });
            expect(count).toBe(10);
        });

        it('should delete indexed message', async () => {
            mockInvoke.mockResolvedValue(undefined);

            await localSearch.deleteMessage('msg1');

            expect(mockInvoke).toHaveBeenCalledWith('delete_indexed_message', {
                messageId: 'msg1',
            });
        });
    });

    describe('stats and maintenance', () => {
        it('should load stats', async () => {
            const mockStats: IndexStats = {
                total_messages: 1000,
                total_channels: 50,
                total_servers: 5,
                index_size_bytes: 1024 * 1024,
                last_indexed_at: 1700000000,
                oldest_message: 1600000000,
                newest_message: 1700000000,
            };

            mockInvoke.mockResolvedValue(mockStats);

            const stats = await localSearch.loadStats();

            expect(mockInvoke).toHaveBeenCalledWith('get_search_stats');
            expect(stats).toEqual(mockStats);
            expect(get(searchStats)).toEqual(mockStats);
        });

        it('should optimize index', async () => {
            mockInvoke.mockResolvedValue(undefined);

            await localSearch.optimize();

            expect(mockInvoke).toHaveBeenCalledWith('optimize_search_index');
            expect(get(isSearchBusy)).toBe(false);
        });

        it('should clear index', async () => {
            mockInvoke.mockResolvedValue(undefined);

            // Set some state first
            localSearch.setQuery('test');
            
            await localSearch.clear();

            expect(mockInvoke).toHaveBeenCalledWith('clear_search_index');
            expect(get(searchResults)).toEqual([]);
            expect(get(searchStats)).toBeNull();
        });
    });
});

describe('messageIndexer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should queue and flush messages', async () => {
        mockInvoke.mockResolvedValue(1);
        const indexer = createMessageIndexer();

        const message: IndexableMessage = {
            message_id: 'msg1',
            channel_id: 'chan1',
            server_id: null,
            author_id: 'user1',
            author_name: 'Alice',
            content: 'Test',
            timestamp: 1700000000,
            has_attachments: false,
            has_embeds: false,
            is_pinned: false,
            is_edited: false,
        };

        indexer.queue(message);
        
        // Fast-forward past the flush delay
        await vi.advanceTimersByTimeAsync(3000);

        expect(mockInvoke).toHaveBeenCalledWith('index_messages_batch', {
            messages: [message],
        });
    });

    it('should force flush immediately', async () => {
        mockInvoke.mockResolvedValue(1);
        const indexer = createMessageIndexer();

        const message: IndexableMessage = {
            message_id: 'msg1',
            channel_id: 'chan1',
            server_id: null,
            author_id: 'user1',
            author_name: 'Alice',
            content: 'Test',
            timestamp: 1700000000,
            has_attachments: false,
            has_embeds: false,
            is_pinned: false,
            is_edited: false,
        };

        indexer.queue(message);
        await indexer.forceFlush();

        expect(mockInvoke).toHaveBeenCalledWith('index_messages_batch', {
            messages: [message],
        });
    });

    it('should clear pending messages', () => {
        const indexer = createMessageIndexer();

        const message: IndexableMessage = {
            message_id: 'msg1',
            channel_id: 'chan1',
            server_id: null,
            author_id: 'user1',
            author_name: 'Alice',
            content: 'Test',
            timestamp: 1700000000,
            has_attachments: false,
            has_embeds: false,
            is_pinned: false,
            is_edited: false,
        };

        indexer.queue(message);
        indexer.clear();

        // Should not invoke after clear
        vi.advanceTimersByTime(3000);
        expect(mockInvoke).not.toHaveBeenCalled();
    });
});
