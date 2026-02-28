<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { invoke } from '@tauri-apps/api/core';
    import { writable, derived } from 'svelte/store';

    interface SearchResult {
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

    interface SearchOptions {
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

    interface IndexStats {
        total_messages: number;
        total_channels: number;
        total_servers: number;
        index_size_bytes: number;
        last_indexed_at: number | null;
        oldest_message: number | null;
        newest_message: number | null;
    }

    interface IndexableMessage {
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

    // Props
    export let visible = false;
    export let onClose: () => void = () => {};
    export let onResultClick: (result: SearchResult) => void = () => {};

    // State
    const query = writable('');
    const results = writable<SearchResult[]>([]);
    const stats = writable<IndexStats | null>(null);
    const isSearching = writable(false);
    const isIndexing = writable(false);
    const error = writable<string | null>(null);
    const sortBy = writable<'relevance' | 'date'>('relevance');
    const sortOrder = writable<'asc' | 'desc'>('desc');
    const showFilters = writable(false);
    const selectedChannels = writable<string[]>([]);
    const selectedServers = writable<string[]>([]);
    const dateFrom = writable<string>('');
    const dateTo = writable<string>('');
    const hasAttachments = writable<boolean | null>(null);
    const isPinned = writable<boolean | null>(null);

    let searchInput: HTMLInputElement;
    let searchDebounceTimer: ReturnType<typeof setTimeout>;

    // Formatted stats
    const formattedStats = derived(stats, ($stats) => {
        if (!$stats) return null;
        return {
            totalMessages: $stats.total_messages.toLocaleString(),
            totalChannels: $stats.total_channels.toLocaleString(),
            totalServers: $stats.total_servers.toLocaleString(),
            indexSize: formatBytes($stats.index_size_bytes),
            lastIndexed: $stats.last_indexed_at
                ? new Date($stats.last_indexed_at * 1000).toLocaleString()
                : 'Never',
            dateRange: formatDateRange($stats.oldest_message, $stats.newest_message),
        };
    });

    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDateRange(oldest: number | null, newest: number | null): string {
        if (!oldest || !newest) return 'No messages indexed';
        const oldDate = new Date(oldest * 1000).toLocaleDateString();
        const newDate = new Date(newest * 1000).toLocaleDateString();
        return `${oldDate} - ${newDate}`;
    }

    function formatTimestamp(ts: number): string {
        const date = new Date(ts * 1000);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'long' }) + ' at ' + 
                date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString() + ' ' + 
                date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    async function search() {
        const q = $query.trim();
        if (!q) {
            results.set([]);
            return;
        }

        isSearching.set(true);
        error.set(null);

        try {
            const options: SearchOptions = {
                query: q,
                sort_by: $sortBy,
                sort_order: $sortOrder,
                limit: 50,
            };

            // Apply filters
            if ($selectedChannels.length > 0) {
                options.channel_ids = $selectedChannels;
            }
            if ($selectedServers.length > 0) {
                options.server_ids = $selectedServers;
            }
            if ($dateFrom) {
                options.from_date = Math.floor(new Date($dateFrom).getTime() / 1000);
            }
            if ($dateTo) {
                options.to_date = Math.floor(new Date($dateTo).getTime() / 1000);
            }
            if ($hasAttachments !== null) {
                options.has_attachments = $hasAttachments;
            }
            if ($isPinned !== null) {
                options.is_pinned = $isPinned;
            }

            const searchResults = await invoke<SearchResult[]>('search_messages', { options });
            results.set(searchResults);
        } catch (e) {
            console.error('Search error:', e);
            error.set(String(e));
        } finally {
            isSearching.set(false);
        }
    }

    function handleInput() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(search, 300);
    }

    async function loadStats() {
        try {
            const indexStats = await invoke<IndexStats>('get_search_stats');
            stats.set(indexStats);
        } catch (e) {
            console.error('Failed to load search stats:', e);
        }
    }

    async function optimizeIndex() {
        isIndexing.set(true);
        try {
            await invoke('optimize_search_index');
            await loadStats();
        } catch (e) {
            console.error('Failed to optimize index:', e);
            error.set(String(e));
        } finally {
            isIndexing.set(false);
        }
    }

    async function clearIndex() {
        if (!confirm('Are you sure you want to clear all indexed messages? This cannot be undone.')) {
            return;
        }

        isIndexing.set(true);
        try {
            await invoke('clear_search_index');
            results.set([]);
            await loadStats();
        } catch (e) {
            console.error('Failed to clear index:', e);
            error.set(String(e));
        } finally {
            isIndexing.set(false);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter') {
            search();
        }
    }

    function handleResultClick(result: SearchResult) {
        onResultClick(result);
    }

    onMount(() => {
        loadStats();
        if (visible && searchInput) {
            searchInput.focus();
        }
    });

    onDestroy(() => {
        clearTimeout(searchDebounceTimer);
    });

    // Re-focus when becoming visible
    $: if (visible && searchInput) {
        searchInput.focus();
    }

    // Export functions for external use
    export async function indexMessage(msg: IndexableMessage): Promise<void> {
        await invoke('index_message', { message: msg });
    }

    export async function indexMessages(messages: IndexableMessage[]): Promise<number> {
        return await invoke<number>('index_messages_batch', { messages });
    }

    export async function deleteMessage(messageId: string): Promise<void> {
        await invoke('delete_indexed_message', { messageId });
    }

    export async function refreshStats(): Promise<void> {
        await loadStats();
    }
</script>

{#if visible}
    <div class="local-search-overlay" on:click|self={onClose} on:keydown={handleKeydown} role="dialog" aria-modal="true" tabindex="-1">
        <div class="local-search-modal">
            <div class="search-header">
                <div class="search-input-wrapper">
                    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        bind:this={searchInput}
                        type="text"
                        class="search-input"
                        placeholder="Search all messages locally..."
                        bind:value={$query}
                        on:input={handleInput}
                    />
                    {#if $isSearching}
                        <div class="search-spinner"></div>
                    {/if}
                </div>

                <div class="search-controls">
                    <button
                        class="filter-toggle"
                        class:active={$showFilters}
                        on:click={() => showFilters.update(v => !v)}
                        title="Toggle filters"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"></path>
                        </svg>
                    </button>

                    <select bind:value={$sortBy} on:change={search} class="sort-select">
                        <option value="relevance">Relevance</option>
                        <option value="date">Date</option>
                    </select>

                    <button
                        class="sort-order-toggle"
                        on:click={() => { sortOrder.update(v => v === 'asc' ? 'desc' : 'asc'); search(); }}
                        title={$sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
                    >
                        {#if $sortOrder === 'desc'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12l7 7 7-7"></path>
                            </svg>
                        {:else}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 19V5M5 12l7-7 7 7"></path>
                            </svg>
                        {/if}
                    </button>

                    <button class="close-btn" on:click={onClose} title="Close search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            {#if $showFilters}
                <div class="search-filters">
                    <div class="filter-row">
                        <label>
                            <span>From:</span>
                            <input type="date" bind:value={$dateFrom} on:change={search} />
                        </label>
                        <label>
                            <span>To:</span>
                            <input type="date" bind:value={$dateTo} on:change={search} />
                        </label>
                    </div>
                    <div class="filter-row">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={$hasAttachments === true}
                                on:change={(e) => {
                                    hasAttachments.set(e.currentTarget.checked ? true : null);
                                    search();
                                }}
                            />
                            <span>Has attachments</span>
                        </label>
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                checked={$isPinned === true}
                                on:change={(e) => {
                                    isPinned.set(e.currentTarget.checked ? true : null);
                                    search();
                                }}
                            />
                            <span>Pinned only</span>
                        </label>
                    </div>
                </div>
            {/if}

            <div class="search-results">
                {#if $error}
                    <div class="search-error">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
                        </svg>
                        <span>{$error}</span>
                    </div>
                {:else if $results.length > 0}
                    <div class="results-list">
                        {#each $results as result (result.message_id)}
                            <button
                                class="result-item"
                                on:click={() => handleResultClick(result)}
                            >
                                <div class="result-header">
                                    <span class="result-author">{result.author_name}</span>
                                    <span class="result-timestamp">{formatTimestamp(result.timestamp)}</span>
                                    {#if result.is_pinned}
                                        <span class="result-badge pinned" title="Pinned">📌</span>
                                    {/if}
                                    {#if result.has_attachments}
                                        <span class="result-badge attachment" title="Has attachments">📎</span>
                                    {/if}
                                </div>
                                <div class="result-snippet">
                                    {@html result.snippet}
                                </div>
                                <div class="result-meta">
                                    <span class="result-relevance" title="Search relevance">
                                        {Math.round(result.relevance * 100)}% match
                                    </span>
                                </div>
                            </button>
                        {/each}
                    </div>
                {:else if $query.trim() && !$isSearching}
                    <div class="no-results">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                            <path d="M8 8l6 6M14 8l-6 6"></path>
                        </svg>
                        <p>No results found for "{$query}"</p>
                    </div>
                {:else}
                    <div class="search-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <p>Search your message history offline</p>
                        <p class="search-tip">Try searching for keywords, usernames, or phrases</p>
                    </div>
                {/if}
            </div>

            <div class="search-footer">
                {#if $formattedStats}
                    <div class="stats-info">
                        <span title="Total indexed messages">
                            📊 {$formattedStats.totalMessages} messages
                        </span>
                        <span title="Index size on disk">
                            💾 {$formattedStats.indexSize}
                        </span>
                        <span title="Date range of indexed messages">
                            📅 {$formattedStats.dateRange}
                        </span>
                    </div>
                {/if}
                <div class="index-actions">
                    <button
                        class="action-btn"
                        on:click={optimizeIndex}
                        disabled={$isIndexing}
                        title="Optimize search index for better performance"
                    >
                        {#if $isIndexing}
                            <div class="btn-spinner"></div>
                        {:else}
                            ⚡
                        {/if}
                        Optimize
                    </button>
                    <button
                        class="action-btn danger"
                        on:click={clearIndex}
                        disabled={$isIndexing}
                        title="Clear all indexed messages"
                    >
                        🗑️ Clear Index
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .local-search-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 10vh;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .local-search-modal {
        width: 100%;
        max-width: 680px;
        max-height: 80vh;
        background: var(--bg-primary, #1e1e1e);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideDown 0.2s ease-out;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .search-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-bottom: 1px solid var(--border-color, #333);
    }

    .search-input-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg-secondary, #2a2a2a);
        border-radius: 8px;
        padding: 8px 12px;
    }

    .search-icon {
        width: 20px;
        height: 20px;
        color: var(--text-muted, #888);
        flex-shrink: 0;
    }

    .search-input {
        flex: 1;
        background: none;
        border: none;
        color: var(--text-primary, #fff);
        font-size: 16px;
        outline: none;
    }

    .search-input::placeholder {
        color: var(--text-muted, #666);
    }

    .search-spinner, .btn-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid var(--text-muted, #666);
        border-top-color: var(--accent-color, #5865f2);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .btn-spinner {
        width: 14px;
        height: 14px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .search-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .filter-toggle, .sort-order-toggle, .close-btn {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-secondary, #2a2a2a);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        color: var(--text-muted, #888);
        transition: all 0.15s;
    }

    .filter-toggle:hover, .sort-order-toggle:hover, .close-btn:hover {
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
    }

    .filter-toggle.active {
        background: var(--accent-color, #5865f2);
        color: #fff;
    }

    .filter-toggle svg, .sort-order-toggle svg, .close-btn svg {
        width: 18px;
        height: 18px;
    }

    .sort-select {
        background: var(--bg-secondary, #2a2a2a);
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        color: var(--text-primary, #fff);
        font-size: 14px;
        cursor: pointer;
    }

    .search-filters {
        padding: 12px 16px;
        background: var(--bg-secondary, #2a2a2a);
        border-bottom: 1px solid var(--border-color, #333);
    }

    .filter-row {
        display: flex;
        gap: 16px;
        margin-bottom: 8px;
    }

    .filter-row:last-child {
        margin-bottom: 0;
    }

    .filter-row label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: var(--text-secondary, #b0b0b0);
    }

    .filter-row input[type="date"] {
        background: var(--bg-primary, #1e1e1e);
        border: 1px solid var(--border-color, #444);
        border-radius: 6px;
        padding: 6px 10px;
        color: var(--text-primary, #fff);
        font-size: 13px;
    }

    .checkbox-label {
        cursor: pointer;
    }

    .checkbox-label input[type="checkbox"] {
        accent-color: var(--accent-color, #5865f2);
    }

    .search-results {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
    }

    .results-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .result-item {
        width: 100%;
        text-align: left;
        padding: 12px;
        background: var(--bg-secondary, #2a2a2a);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s;
    }

    .result-item:hover {
        background: var(--bg-tertiary, #333);
    }

    .result-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .result-author {
        font-weight: 600;
        color: var(--text-primary, #fff);
        font-size: 14px;
    }

    .result-timestamp {
        font-size: 12px;
        color: var(--text-muted, #666);
    }

    .result-badge {
        font-size: 12px;
    }

    .result-snippet {
        color: var(--text-secondary, #b0b0b0);
        font-size: 14px;
        line-height: 1.5;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .result-snippet :global(mark) {
        background: var(--accent-color, #5865f2);
        color: #fff;
        padding: 1px 3px;
        border-radius: 3px;
    }

    .result-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
    }

    .result-relevance {
        font-size: 11px;
        color: var(--text-muted, #666);
        background: var(--bg-primary, #1e1e1e);
        padding: 2px 6px;
        border-radius: 4px;
    }

    .no-results, .search-empty, .search-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: var(--text-muted, #888);
    }

    .no-results svg, .search-empty svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .search-error {
        color: var(--error-color, #f04747);
    }

    .search-error svg {
        width: 24px;
        height: 24px;
        margin-right: 8px;
    }

    .search-tip {
        font-size: 13px;
        color: var(--text-muted, #666);
        margin-top: 8px;
    }

    .search-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #333);
        background: var(--bg-secondary, #2a2a2a);
    }

    .stats-info {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: var(--text-muted, #888);
    }

    .index-actions {
        display: flex;
        gap: 8px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: var(--bg-primary, #1e1e1e);
        border: 1px solid var(--border-color, #444);
        border-radius: 6px;
        color: var(--text-secondary, #b0b0b0);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s;
    }

    .action-btn:hover:not(:disabled) {
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
    }

    .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .action-btn.danger:hover:not(:disabled) {
        border-color: var(--error-color, #f04747);
        color: var(--error-color, #f04747);
    }
</style>
