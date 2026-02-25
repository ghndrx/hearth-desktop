<script lang="ts">
  /**
   * KeyboardShortcutsSettings Component
   * 
   * Displays and manages keyboard shortcuts with recording functionality.
   * Supports custom key bindings, conflict detection, and category grouping.
   */
  
  import { onMount, onDestroy } from 'svelte';
  import {
    shortcutsStore,
    shortcutsByCategory,
    isRecording,
    recordingId,
    recordedKeys,
    conflicts,
    formatKeys,
    getCategoryLabel,
    getCategoryIcon,
    type Shortcut,
    type ShortcutCategory,
  } from '../stores/shortcuts';
  
  let searchQuery = '';
  let expandedCategories: Set<ShortcutCategory> = new Set([
    'navigation',
    'messaging',
    'voice',
    'media',
    'window',
    'accessibility',
  ]);
  let showGlobalOnly = false;
  let showConflictsOnly = false;
  
  $: filteredCategories = Object.entries($shortcutsByCategory).reduce(
    (acc, [category, shortcuts]) => {
      const filtered = shortcuts.filter(shortcut => {
        const matchesSearch = searchQuery === '' ||
          shortcut.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shortcut.description.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesGlobal = !showGlobalOnly || shortcut.isGlobal;
        
        const matchesConflicts = !showConflictsOnly ||
          $conflicts.some(c => c.shortcutId === shortcut.id || c.conflictsWith === shortcut.id);
        
        return matchesSearch && matchesGlobal && matchesConflicts;
      });
      
      if (filtered.length > 0) {
        acc[category as ShortcutCategory] = filtered;
      }
      
      return acc;
    },
    {} as Record<ShortcutCategory, Shortcut[]>
  );
  
  $: hasConflicts = $conflicts.length > 0;
  
  function toggleCategory(category: ShortcutCategory) {
    if (expandedCategories.has(category)) {
      expandedCategories.delete(category);
    } else {
      expandedCategories.add(category);
    }
    expandedCategories = expandedCategories;
  }
  
  function startRecording(shortcutId: string) {
    shortcutsStore.startRecording(shortcutId);
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (!$isRecording) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // Escape cancels recording
    if (event.key === 'Escape') {
      shortcutsStore.cancelRecording();
      return;
    }
    
    // Enter confirms recording
    if (event.key === 'Enter' && $recordedKeys.length > 0) {
      shortcutsStore.confirmRecording();
      return;
    }
    
    // Add modifier keys
    if (event.ctrlKey && !$recordedKeys.includes('Ctrl')) {
      shortcutsStore.addRecordedKey('Ctrl');
    }
    if (event.altKey && !$recordedKeys.includes('Alt')) {
      shortcutsStore.addRecordedKey('Alt');
    }
    if (event.shiftKey && !$recordedKeys.includes('Shift')) {
      shortcutsStore.addRecordedKey('Shift');
    }
    if (event.metaKey && !$recordedKeys.includes('Cmd')) {
      shortcutsStore.addRecordedKey('Cmd');
    }
    
    // Add non-modifier key
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      shortcutsStore.addRecordedKey(event.key);
      // Auto-confirm after adding a non-modifier key
      setTimeout(() => shortcutsStore.confirmRecording(), 100);
    }
  }
  
  function getConflictForShortcut(shortcutId: string): string | null {
    const conflict = $conflicts.find(
      c => c.shortcutId === shortcutId || c.conflictsWith === shortcutId
    );
    
    if (!conflict) return null;
    
    const otherId = conflict.shortcutId === shortcutId
      ? conflict.conflictsWith
      : conflict.shortcutId;
    
    const shortcuts = Object.values($shortcutsByCategory).flat();
    const other = shortcuts.find(s => s.id === otherId);
    
    return other?.name || otherId;
  }
  
  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });
  
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="keyboard-shortcuts-settings">
  <div class="header">
    <h2>Keyboard Shortcuts</h2>
    <p class="subtitle">
      Customize your keyboard shortcuts. Click a shortcut to record a new key combination.
    </p>
  </div>
  
  <div class="controls">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search shortcuts..."
        class="search-input"
      />
    </div>
    
    <div class="filters">
      <label class="filter-checkbox">
        <input type="checkbox" bind:checked={showGlobalOnly} />
        <span>Global shortcuts only</span>
      </label>
      
      <label class="filter-checkbox" class:has-conflicts={hasConflicts}>
        <input type="checkbox" bind:checked={showConflictsOnly} />
        <span>Show conflicts {hasConflicts ? `(${$conflicts.length})` : ''}</span>
      </label>
    </div>
    
    <button class="reset-all-btn" on:click={() => shortcutsStore.resetAllShortcuts()}>
      Reset All to Defaults
    </button>
  </div>
  
  {#if hasConflicts}
    <div class="conflicts-banner">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L1 21h22L12 2zm0 3.83L19.13 19H4.87L12 5.83zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
      </svg>
      <span>
        {$conflicts.length} shortcut conflict{$conflicts.length > 1 ? 's' : ''} detected.
        Some shortcuts may not work as expected.
      </span>
    </div>
  {/if}
  
  {#if $isRecording}
    <div class="recording-overlay">
      <div class="recording-modal">
        <h3>Recording Shortcut</h3>
        <div class="recorded-keys">
          {#if $recordedKeys.length > 0}
            {formatKeys($recordedKeys)}
          {:else}
            <span class="hint">Press a key combination...</span>
          {/if}
        </div>
        <p class="recording-hint">
          Press <kbd>Enter</kbd> to confirm or <kbd>Escape</kbd> to cancel
        </p>
        <div class="recording-actions">
          <button class="cancel-btn" on:click={() => shortcutsStore.cancelRecording()}>
            Cancel
          </button>
          <button
            class="confirm-btn"
            disabled={$recordedKeys.length === 0}
            on:click={() => shortcutsStore.confirmRecording()}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="categories">
    {#each Object.entries(filteredCategories) as [category, shortcuts] (category)}
      {@const cat = category as ShortcutCategory}
      <div class="category">
        <button
          class="category-header"
          on:click={() => toggleCategory(cat)}
          aria-expanded={expandedCategories.has(cat)}
        >
          <span class="category-icon">{getCategoryIcon(cat)}</span>
          <span class="category-name">{getCategoryLabel(cat)}</span>
          <span class="category-count">{shortcuts.length}</span>
          <svg
            class="expand-icon"
            class:expanded={expandedCategories.has(cat)}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        
        {#if expandedCategories.has(cat)}
          <div class="shortcuts-list">
            {#each shortcuts as shortcut}
              {@const conflict = getConflictForShortcut(shortcut.id)}
              <div
                class="shortcut-row"
                class:disabled={!shortcut.enabled}
                class:has-conflict={conflict !== null}
              >
                <div class="shortcut-info">
                  <div class="shortcut-name">
                    {shortcut.name}
                    {#if shortcut.isGlobal}
                      <span class="global-badge" title="Works even when app is not focused">
                        Global
                      </span>
                    {/if}
                  </div>
                  <div class="shortcut-description">{shortcut.description}</div>
                  {#if conflict}
                    <div class="conflict-warning">
                      ⚠️ Conflicts with: {conflict}
                    </div>
                  {/if}
                </div>
                
                <div class="shortcut-actions">
                  <button
                    class="keybind-btn"
                    class:recording={$recordingId === shortcut.id}
                    class:empty={shortcut.currentKeys.length === 0}
                    on:click={() => startRecording(shortcut.id)}
                    title="Click to record new shortcut"
                  >
                    {formatKeys(shortcut.currentKeys)}
                  </button>
                  
                  <button
                    class="icon-btn reset-btn"
                    on:click={() => shortcutsStore.resetShortcut(shortcut.id)}
                    title="Reset to default"
                    disabled={JSON.stringify(shortcut.currentKeys) === JSON.stringify(shortcut.defaultKeys)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                    </svg>
                  </button>
                  
                  <button
                    class="icon-btn clear-btn"
                    on:click={() => shortcutsStore.clearShortcut(shortcut.id)}
                    title="Clear shortcut"
                    disabled={shortcut.currentKeys.length === 0}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                  
                  <label class="toggle-switch" title={shortcut.enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      checked={shortcut.enabled}
                      on:change={() => shortcutsStore.toggleShortcut(shortcut.id)}
                    />
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    
    {#if Object.keys(filteredCategories).length === 0}
      <div class="no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <p>No shortcuts found matching your search.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .keyboard-shortcuts-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
  }
  
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
  }
  
  .search-box {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    flex: 1;
    min-width: 200px;
  }
  
  .search-icon {
    width: 18px;
    height: 18px;
    color: var(--text-muted, #949ba4);
    margin-right: 0.5rem;
  }
  
  .search-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary, #fff);
    width: 100%;
    font-size: 0.875rem;
  }
  
  .search-input::placeholder {
    color: var(--text-muted, #949ba4);
  }
  
  .filters {
    display: flex;
    gap: 1rem;
  }
  
  .filter-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
    cursor: pointer;
  }
  
  .filter-checkbox.has-conflicts span {
    color: var(--status-warning, #faa61a);
  }
  
  .filter-checkbox input {
    accent-color: var(--brand-primary, #5865f2);
  }
  
  .reset-all-btn {
    padding: 0.5rem 1rem;
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #fff);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
  }
  
  .reset-all-btn:hover {
    background: var(--bg-tertiary, #1e1f22);
  }
  
  .conflicts-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--status-warning-bg, rgba(250, 166, 26, 0.1));
    border: 1px solid var(--status-warning, #faa61a);
    border-radius: 4px;
    color: var(--status-warning, #faa61a);
    font-size: 0.875rem;
  }
  
  .conflicts-banner svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  
  .recording-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .recording-modal {
    background: var(--bg-primary, #313338);
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    min-width: 300px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
  
  .recording-modal h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary, #fff);
    font-size: 1.25rem;
  }
  
  .recorded-keys {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
    padding: 1rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 4px;
    min-height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .recorded-keys .hint {
    color: var(--text-muted, #949ba4);
    font-size: 1rem;
    font-weight: normal;
  }
  
  .recording-hint {
    margin: 1rem 0;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.875rem;
  }
  
  .recording-hint kbd {
    background: var(--bg-tertiary, #1e1f22);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: inherit;
    font-size: 0.75rem;
  }
  
  .recording-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }
  
  .cancel-btn,
  .confirm-btn {
    padding: 0.5rem 1.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .cancel-btn {
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #fff);
  }
  
  .confirm-btn {
    background: var(--brand-primary, #5865f2);
    color: white;
  }
  
  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .categories {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .category {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .category-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .category-header:hover {
    background: var(--bg-tertiary, #1e1f22);
  }
  
  .category-icon {
    font-size: 1.25rem;
  }
  
  .category-name {
    flex: 1;
    text-align: left;
  }
  
  .category-count {
    color: var(--text-muted, #949ba4);
    font-size: 0.75rem;
    background: var(--bg-primary, #313338);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }
  
  .expand-icon {
    width: 20px;
    height: 20px;
    transition: transform 0.2s;
  }
  
  .expand-icon.expanded {
    transform: rotate(180deg);
  }
  
  .shortcuts-list {
    border-top: 1px solid var(--bg-tertiary, #1e1f22);
  }
  
  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    gap: 1rem;
    border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
  }
  
  .shortcut-row:last-child {
    border-bottom: none;
  }
  
  .shortcut-row.disabled {
    opacity: 0.5;
  }
  
  .shortcut-row.has-conflict {
    background: rgba(250, 166, 26, 0.05);
  }
  
  .shortcut-info {
    flex: 1;
    min-width: 0;
  }
  
  .shortcut-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
    font-weight: 500;
  }
  
  .global-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.125rem 0.375rem;
    background: var(--brand-primary, #5865f2);
    color: white;
    border-radius: 3px;
  }
  
  .shortcut-description {
    color: var(--text-muted, #949ba4);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  .conflict-warning {
    color: var(--status-warning, #faa61a);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  .shortcut-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .keybind-btn {
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 0.75rem;
    font-weight: 500;
    font-family: monospace;
    cursor: pointer;
    min-width: 80px;
    text-align: center;
    transition: all 0.2s;
  }
  
  .keybind-btn:hover {
    border-color: var(--brand-primary, #5865f2);
  }
  
  .keybind-btn.recording {
    border-color: var(--status-positive, #3ba55d);
    animation: pulse 1s infinite;
  }
  
  .keybind-btn.empty {
    color: var(--text-muted, #949ba4);
    font-style: italic;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .icon-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #949ba4);
    transition: all 0.2s;
  }
  
  .icon-btn:hover:not(:disabled) {
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-primary, #fff);
  }
  
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .icon-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .toggle-switch {
    position: relative;
    width: 40px;
    height: 22px;
    cursor: pointer;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 11px;
    transition: background 0.2s;
  }
  
  .slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  
  .toggle-switch input:checked + .slider {
    background: var(--status-positive, #3ba55d);
  }
  
  .toggle-switch input:checked + .slider::before {
    transform: translateX(18px);
  }
  
  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-muted, #949ba4);
    text-align: center;
  }
  
  .no-results svg {
    width: 48px;
    height: 48px;
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .no-results p {
    margin: 0;
    font-size: 0.875rem;
  }
</style>
