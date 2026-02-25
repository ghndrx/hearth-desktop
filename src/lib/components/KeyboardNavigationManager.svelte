<!--
  KeyboardNavigationManager.svelte
  
  Centralized keyboard navigation management for full accessibility support.
  Handles:
  - Focus regions (sidebar, content, message input)
  - Skip links
  - Keyboard shortcuts help modal
  - Region-based focus cycling
  
  WCAG 2.1.1 Compliance
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { shortcuts, isShortcutPressed, shortcutsByCategory, formatKeys, getCategoryLabel, getCategoryIcon, type ShortcutCategory } from '$lib/stores/shortcuts';
  import { announce } from '$lib/utils/keyboard';

  /** Focus regions in tab order */
  type FocusRegion = 'skip-links' | 'server-sidebar' | 'channel-sidebar' | 'main-content' | 'message-input' | 'member-list';
  
  const REGION_SELECTORS: Record<FocusRegion, string> = {
    'skip-links': '.skip-links',
    'server-sidebar': '[data-region="server-sidebar"]',
    'channel-sidebar': '[data-region="channel-sidebar"]',
    'main-content': '[data-region="main-content"]',
    'message-input': '[data-region="message-input"]',
    'member-list': '[data-region="member-list"]',
  };

  const REGION_ORDER: FocusRegion[] = [
    'server-sidebar',
    'channel-sidebar', 
    'main-content',
    'message-input',
    'member-list',
  ];

  const REGION_LABELS: Record<FocusRegion, string> = {
    'skip-links': 'Skip Links',
    'server-sidebar': 'Server Sidebar',
    'channel-sidebar': 'Channel Sidebar',
    'main-content': 'Main Content',
    'message-input': 'Message Input',
    'member-list': 'Member List',
  };

  let showShortcutsHelp = false;
  let currentRegionIndex = 0;
  
  /** Find the first focusable element in a region */
  function getFocusableInRegion(region: FocusRegion): HTMLElement | null {
    const container = document.querySelector(REGION_SELECTORS[region]);
    if (!container) return null;

    const focusable = container.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    return focusable;
  }

  /** Focus a specific region */
  function focusRegion(region: FocusRegion) {
    const element = getFocusableInRegion(region);
    if (element) {
      element.focus();
      announce(`Navigated to ${REGION_LABELS[region]}`);
    }
  }

  /** Move to next focus region */
  function nextRegion() {
    currentRegionIndex = (currentRegionIndex + 1) % REGION_ORDER.length;
    let attempts = 0;
    
    while (attempts < REGION_ORDER.length) {
      const region = REGION_ORDER[currentRegionIndex];
      const element = getFocusableInRegion(region);
      
      if (element) {
        element.focus();
        announce(`${REGION_LABELS[region]}`);
        return;
      }
      
      currentRegionIndex = (currentRegionIndex + 1) % REGION_ORDER.length;
      attempts++;
    }
  }

  /** Move to previous focus region */
  function prevRegion() {
    currentRegionIndex = (currentRegionIndex - 1 + REGION_ORDER.length) % REGION_ORDER.length;
    let attempts = 0;
    
    while (attempts < REGION_ORDER.length) {
      const region = REGION_ORDER[currentRegionIndex];
      const element = getFocusableInRegion(region);
      
      if (element) {
        element.focus();
        announce(`${REGION_LABELS[region]}`);
        return;
      }
      
      currentRegionIndex = (currentRegionIndex - 1 + REGION_ORDER.length) % REGION_ORDER.length;
      attempts++;
    }
  }

  /** Skip to main content */
  function skipToMain() {
    focusRegion('main-content');
  }

  /** Skip to message input */
  function skipToInput() {
    focusRegion('message-input');
  }

  /** Handle global keyboard events */
  function handleKeydown(event: KeyboardEvent) {
    // Don't handle if user is typing in an input
    const target = event.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

    // Region navigation with F6 (standard Windows/Linux behavior)
    if (event.key === 'F6') {
      event.preventDefault();
      if (event.shiftKey) {
        prevRegion();
      } else {
        nextRegion();
      }
      return;
    }

    // Show keyboard shortcuts help with ? (when not typing)
    if (event.key === '?' && !isTyping) {
      event.preventDefault();
      showShortcutsHelp = true;
      return;
    }

    // Close shortcuts help with Escape
    if (event.key === 'Escape' && showShortcutsHelp) {
      event.preventDefault();
      showShortcutsHelp = false;
      return;
    }

    // Skip link shortcuts (Alt+1 = main, Alt+2 = input)
    if (event.altKey && !isTyping) {
      if (event.key === '1') {
        event.preventDefault();
        skipToMain();
        return;
      }
      if (event.key === '2') {
        event.preventDefault();
        skipToInput();
        return;
      }
    }

    // Navigate to specific regions with Ctrl+number (when not typing)
    if (event.ctrlKey && !event.shiftKey && !event.altKey && !isTyping) {
      const num = parseInt(event.key, 10);
      if (num >= 1 && num <= REGION_ORDER.length) {
        event.preventDefault();
        currentRegionIndex = num - 1;
        focusRegion(REGION_ORDER[currentRegionIndex]);
        return;
      }
    }
  }

  /** Track which region currently has focus */
  function handleFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement;
    
    for (let i = 0; i < REGION_ORDER.length; i++) {
      const region = REGION_ORDER[i];
      const container = document.querySelector(REGION_SELECTORS[region]);
      if (container?.contains(target)) {
        currentRegionIndex = i;
        break;
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('focusin', handleFocusIn);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('focusin', handleFocusIn);
  });
</script>

<!-- Skip Links (visually hidden until focused) -->
<nav class="skip-links" aria-label="Skip links">
  <a href="#main-content" class="skip-link" on:click|preventDefault={skipToMain}>
    Skip to main content
  </a>
  <a href="#message-input" class="skip-link" on:click|preventDefault={skipToInput}>
    Skip to message input
  </a>
</nav>

<!-- Keyboard Shortcuts Help Modal -->
{#if showShortcutsHelp}
  <div 
    class="shortcuts-modal-overlay"
    on:click={() => showShortcutsHelp = false}
    on:keydown={(e) => e.key === 'Escape' && (showShortcutsHelp = false)}
    role="dialog"
    aria-modal="true"
    aria-labelledby="shortcuts-title"
  >
    <div 
      class="shortcuts-modal"
      on:click|stopPropagation
      role="document"
    >
      <header class="shortcuts-header">
        <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
        <button 
          class="close-btn"
          on:click={() => showShortcutsHelp = false}
          aria-label="Close shortcuts help"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      
      <div class="shortcuts-content">
        <!-- Navigation section -->
        <section class="region-nav-section">
          <h3>Region Navigation</h3>
          <div class="shortcut-row">
            <span class="shortcut-name">Next Region</span>
            <kbd>F6</kbd>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-name">Previous Region</span>
            <kbd>Shift</kbd> + <kbd>F6</kbd>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-name">Skip to Main Content</span>
            <kbd>Alt</kbd> + <kbd>1</kbd>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-name">Skip to Message Input</span>
            <kbd>Alt</kbd> + <kbd>2</kbd>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-name">Show Shortcuts Help</span>
            <kbd>?</kbd>
          </div>
        </section>

        <!-- Categories from shortcuts store -->
        {#each Object.entries($shortcutsByCategory) as [category, categoryShortcuts] (category)}
          {@const cat = category as ShortcutCategory}
          {#if categoryShortcuts.length > 0}
            <section class="shortcuts-category">
              <h3>
                <span class="category-icon">{getCategoryIcon(cat)}</span>
                {getCategoryLabel(cat)}
              </h3>
              {#each categoryShortcuts as shortcut}
                <div class="shortcut-row" class:disabled={!shortcut.enabled}>
                  <span class="shortcut-name">{shortcut.name}</span>
                  <span class="shortcut-keys">
                    {#each shortcut.currentKeys as key, i}
                      <kbd>{key}</kbd>
                      {#if i < shortcut.currentKeys.length - 1}
                        <span class="key-separator">+</span>
                      {/if}
                    {:else}
                      <span class="not-set">Not set</span>
                    {/each}
                  </span>
                </div>
              {/each}
            </section>
          {/if}
        {/each}
      </div>
      
      <footer class="shortcuts-footer">
        <p>Press <kbd>Esc</kbd> to close • <a href="/settings/keybinds">Customize shortcuts</a></p>
      </footer>
    </div>
  </div>
{/if}

<style>
  /* Skip Links - visually hidden until focused */
  .skip-links {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9999;
  }

  .skip-link {
    position: absolute;
    top: -100vh;
    left: 0;
    padding: 0.75rem 1.5rem;
    background: var(--hearth-500, #f97316);
    color: white;
    font-weight: 600;
    text-decoration: none;
    border-radius: 0 0 0.5rem 0;
    transition: top 0.2s ease;
  }

  .skip-link:focus {
    top: 0;
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .skip-link:nth-child(2):focus {
    left: 200px;
  }

  /* Shortcuts Modal */
  .shortcuts-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .shortcuts-modal {
    background: var(--surface-primary, #1e1e1e);
    border-radius: 1rem;
    width: min(90vw, 700px);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border-primary, #333);
  }

  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-primary, #333);
  }

  .shortcuts-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .close-btn {
    background: transparent;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary, #999);
    border-radius: 0.375rem;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--surface-secondary, #2a2a2a);
    color: var(--text-primary, #fff);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--hearth-500, #f97316);
    outline-offset: 2px;
  }

  .shortcuts-content {
    padding: 1.5rem;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .shortcuts-category,
  .region-nav-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .shortcuts-category h3,
  .region-nav-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary, #999);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .category-icon {
    font-size: 1rem;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    transition: background 0.15s;
  }

  .shortcut-row:hover {
    background: var(--surface-secondary, #2a2a2a);
  }

  .shortcut-row.disabled {
    opacity: 0.5;
  }

  .shortcut-name {
    font-size: 0.875rem;
    color: var(--text-primary, #fff);
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-primary, #fff);
    background: var(--surface-tertiary, #333);
    border: 1px solid var(--border-primary, #444);
    border-radius: 0.25rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .key-separator {
    color: var(--text-tertiary, #666);
    font-size: 0.75rem;
  }

  .not-set {
    font-size: 0.75rem;
    color: var(--text-tertiary, #666);
    font-style: italic;
  }

  .shortcuts-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-primary, #333);
    text-align: center;
  }

  .shortcuts-footer p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #999);
  }

  .shortcuts-footer a {
    color: var(--hearth-500, #f97316);
    text-decoration: none;
  }

  .shortcuts-footer a:hover {
    text-decoration: underline;
  }

  .shortcuts-footer a:focus-visible {
    outline: 2px solid var(--hearth-500, #f97316);
    outline-offset: 2px;
    border-radius: 0.25rem;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skip-link,
    .close-btn,
    .shortcut-row {
      transition: none;
    }
  }
</style>
