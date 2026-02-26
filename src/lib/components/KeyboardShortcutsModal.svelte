<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    
    export let open = false;
    
    const dispatch = createEventDispatcher();
    
    interface Shortcut {
        keys: string[];
        description: string;
    }
    
    interface ShortcutCategory {
        name: string;
        shortcuts: Shortcut[];
    }
    
    const categories: ShortcutCategory[] = [
        {
            name: 'Navigation',
            shortcuts: [
                { keys: ['Ctrl', 'K'], description: 'Open Quick Switcher' },
                { keys: ['Ctrl', 'Tab'], description: 'Next channel' },
                { keys: ['Ctrl', 'Shift', 'Tab'], description: 'Previous channel' },
                { keys: ['Alt', '↑'], description: 'Previous unread channel' },
                { keys: ['Alt', '↓'], description: 'Next unread channel' },
                { keys: ['Ctrl', '1-9'], description: 'Switch to server 1-9' },
                { keys: ['Escape'], description: 'Close modal / Cancel' }
            ]
        },
        {
            name: 'Messages',
            shortcuts: [
                { keys: ['Enter'], description: 'Send message' },
                { keys: ['Shift', 'Enter'], description: 'New line' },
                { keys: ['↑'], description: 'Edit last message' },
                { keys: ['Ctrl', 'E'], description: 'Toggle emoji picker' },
                { keys: ['Ctrl', 'G'], description: 'Toggle GIF picker' },
                { keys: ['Ctrl', 'U'], description: 'Upload file' },
                { keys: ['Ctrl', 'B'], description: 'Bold text' },
                { keys: ['Ctrl', 'I'], description: 'Italic text' },
                { keys: ['Ctrl', 'Shift', 'X'], description: 'Strikethrough' }
            ]
        },
        {
            name: 'View',
            shortcuts: [
                { keys: ['Ctrl', '+'], description: 'Zoom in' },
                { keys: ['Ctrl', '-'], description: 'Zoom out' },
                { keys: ['Ctrl', '0'], description: 'Reset zoom' },
                { keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle member list' },
                { keys: ['Ctrl', 'Shift', 'I'], description: 'Toggle DevTools' },
                { keys: ['F11'], description: 'Toggle fullscreen' }
            ]
        },
        {
            name: 'Voice & Video',
            shortcuts: [
                { keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle deafen' },
                { keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle mute' },
                { keys: ['Ctrl', 'Shift', 'V'], description: 'Start/stop video' },
                { keys: ['Ctrl', 'Shift', 'S'], description: 'Share screen' }
            ]
        },
        {
            name: 'Desktop',
            shortcuts: [
                { keys: ['Ctrl', ','], description: 'Open settings' },
                { keys: ['Ctrl', 'Shift', 'P'], description: 'Pin window on top' },
                { keys: ['Ctrl', 'Q'], description: 'Quit application' },
                { keys: ['Ctrl', 'H'], description: 'Hide to tray' },
                { keys: ['Ctrl', 'R'], description: 'Reload' },
                { keys: ['Ctrl', '?'], description: 'Show this help' }
            ]
        }
    ];
    
    let searchQuery = '';
    let searchInput: HTMLInputElement;
    
    $: filteredCategories = categories.map(cat => ({
        ...cat,
        shortcuts: cat.shortcuts.filter(s => 
            s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.shortcuts.length > 0);
    
    function close() {
        open = false;
        dispatch('close');
    }
    
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            close();
        }
    }
    
    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            close();
        }
    }
    
    $: if (open && searchInput) {
        setTimeout(() => searchInput?.focus(), 100);
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
    <div 
        class="modal-backdrop"
        on:click={handleBackdropClick}
        on:keydown={handleKeydown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        transition:fade={{ duration: 150 }}
    >
        <div 
            class="modal"
            transition:fly={{ y: -20, duration: 200 }}
        >
            <header class="modal-header">
                <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                <button class="close-btn" on:click={close} aria-label="Close">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>
            
            <div class="search-container">
                <input
                    bind:this={searchInput}
                    bind:value={searchQuery}
                    type="text"
                    placeholder="Search shortcuts..."
                    class="search-input"
                />
            </div>
            
            <div class="modal-content">
                {#each filteredCategories as category}
                    <section class="category">
                        <h3 class="category-title">{category.name}</h3>
                        <div class="shortcuts-grid">
                            {#each category.shortcuts as shortcut}
                                <div class="shortcut-row">
                                    <span class="shortcut-description">{shortcut.description}</span>
                                    <span class="shortcut-keys">
                                        {#each shortcut.keys as key, i}
                                            <kbd class="key">{key}</kbd>
                                            {#if i < shortcut.keys.length - 1}
                                                <span class="key-separator">+</span>
                                            {/if}
                                        {/each}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/each}
                
                {#if filteredCategories.length === 0}
                    <div class="no-results">
                        <p>No shortcuts match "{searchQuery}"</p>
                    </div>
                {/if}
            </div>
            
            <footer class="modal-footer">
                <p class="footer-tip">
                    <kbd class="key">Ctrl</kbd>
                    <span class="key-separator">+</span>
                    <kbd class="key">?</kbd>
                    to toggle this panel
                </p>
            </footer>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 2rem;
    }
    
    .modal {
        background: var(--bg-primary, #1e1e1e);
        border-radius: 12px;
        max-width: 680px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--border-color, #333);
    }
    
    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #333);
    }
    
    .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary, #fff);
    }
    
    .close-btn {
        background: none;
        border: none;
        color: var(--text-secondary, #888);
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
        transition: color 0.15s, background 0.15s;
    }
    
    .close-btn:hover {
        color: var(--text-primary, #fff);
        background: var(--bg-hover, #333);
    }
    
    .search-container {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #333);
    }
    
    .search-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-color, #444);
        border-radius: 6px;
        background: var(--bg-secondary, #2a2a2a);
        color: var(--text-primary, #fff);
        font-size: 0.9rem;
        outline: none;
        transition: border-color 0.15s;
    }
    
    .search-input:focus {
        border-color: var(--accent-color, #5865f2);
    }
    
    .search-input::placeholder {
        color: var(--text-muted, #666);
    }
    
    .modal-content {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 1.5rem;
    }
    
    .category {
        margin-bottom: 1.5rem;
    }
    
    .category:last-child {
        margin-bottom: 0;
    }
    
    .category-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary, #888);
        margin: 0 0 0.75rem 0;
    }
    
    .shortcuts-grid {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .shortcut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        background: var(--bg-secondary, #2a2a2a);
    }
    
    .shortcut-description {
        color: var(--text-primary, #fff);
        font-size: 0.9rem;
    }
    
    .shortcut-keys {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.75rem;
        padding: 0.25rem 0.5rem;
        background: var(--bg-tertiary, #1a1a1a);
        border: 1px solid var(--border-color, #444);
        border-radius: 4px;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--text-primary, #fff);
        box-shadow: 0 2px 0 var(--border-color, #333);
    }
    
    .key-separator {
        color: var(--text-muted, #666);
        font-size: 0.75rem;
        margin: 0 0.125rem;
    }
    
    .no-results {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted, #666);
    }
    
    .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #333);
        display: flex;
        justify-content: center;
    }
    
    .footer-tip {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--text-muted, #666);
        font-size: 0.8rem;
    }
    
    .footer-tip .key {
        font-size: 0.65rem;
        padding: 0.125rem 0.375rem;
        min-width: 1.25rem;
    }
</style>
