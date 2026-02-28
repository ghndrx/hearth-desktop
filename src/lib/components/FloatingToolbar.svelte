<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // Types
  interface ToolbarAction {
    id: string;
    icon: string;
    label: string;
    shortcut?: string;
    group?: string;
    disabled?: boolean;
    danger?: boolean;
  }

  interface ToolbarPosition {
    x: number;
    y: number;
    placement: 'above' | 'below';
  }

  interface SelectionInfo {
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect | null;
  }

  // Props
  export let actions: ToolbarAction[] = [];
  export let enabled: boolean = true;
  export let autoHideDelay: number = 3000;
  export let showOnSelection: boolean = true;
  export let showOnRightClick: boolean = true;
  export let containerSelector: string = 'body';
  export let offset: number = 8;
  export let maxWidth: number = 400;

  // Default actions if none provided
  const defaultActions: ToolbarAction[] = [
    { id: 'copy', icon: '📋', label: 'Copy', shortcut: 'Ctrl+C', group: 'clipboard' },
    { id: 'cut', icon: '✂️', label: 'Cut', shortcut: 'Ctrl+X', group: 'clipboard' },
    { id: 'paste', icon: '📄', label: 'Paste', shortcut: 'Ctrl+V', group: 'clipboard' },
    { id: 'bold', icon: 'B', label: 'Bold', shortcut: 'Ctrl+B', group: 'format' },
    { id: 'italic', icon: 'I', label: 'Italic', shortcut: 'Ctrl+I', group: 'format' },
    { id: 'underline', icon: 'U', label: 'Underline', shortcut: 'Ctrl+U', group: 'format' },
    { id: 'link', icon: '🔗', label: 'Add Link', shortcut: 'Ctrl+K', group: 'insert' },
    { id: 'quote', icon: '❝', label: 'Quote', group: 'insert' },
    { id: 'code', icon: '</>', label: 'Code', shortcut: 'Ctrl+`', group: 'format' },
    { id: 'search', icon: '🔍', label: 'Search Selection', group: 'tools' },
  ];

  const dispatch = createEventDispatcher<{
    action: { actionId: string; selection: SelectionInfo };
    show: { position: ToolbarPosition; selection: SelectionInfo };
    hide: void;
  }>();

  // State
  const visible: Writable<boolean> = writable(false);
  const position: Writable<ToolbarPosition> = writable({ x: 0, y: 0, placement: 'above' });
  const currentSelection: Writable<SelectionInfo | null> = writable(null);
  const hovering: Writable<boolean> = writable(false);
  const activeGroup: Writable<string | null> = writable(null);

  // Computed
  const effectiveActions = derived([writable(actions)], ([acts]) => 
    acts.length > 0 ? acts : defaultActions
  );

  const groupedActions = derived(effectiveActions, ($actions) => {
    const groups: Map<string, ToolbarAction[]> = new Map();
    $actions.forEach(action => {
      const group = action.group || 'default';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(action);
    });
    return groups;
  });

  let toolbar: HTMLElement;
  let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
  let container: Element | null = null;

  // Lifecycle
  onMount(() => {
    container = document.querySelector(containerSelector);
    if (!container) container = document.body;

    if (showOnSelection) {
      document.addEventListener('selectionchange', handleSelectionChange);
      document.addEventListener('mouseup', handleMouseUp);
    }

    if (showOnRightClick) {
      container.addEventListener('contextmenu', handleContextMenu as EventListener);
    }

    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
  });

  onDestroy(() => {
    if (showOnSelection) {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    if (showOnRightClick && container) {
      container.removeEventListener('contextmenu', handleContextMenu as EventListener);
    }

    document.removeEventListener('scroll', handleScroll, true);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);

    clearAutoHideTimer();
  });

  // Functions
  function getSelectionInfo(): SelectionInfo | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    return {
      text: selection.toString(),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      rect,
    };
  }

  function calculatePosition(rect: DOMRect): ToolbarPosition {
    const toolbarHeight = 44;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let x = rect.left + (rect.width / 2);
    let y: number;
    let placement: 'above' | 'below';

    // Check if there's room above
    if (rect.top - toolbarHeight - offset > 0) {
      y = rect.top - offset;
      placement = 'above';
    } else {
      y = rect.bottom + offset;
      placement = 'below';
    }

    // Constrain x to viewport
    const halfToolbar = Math.min(maxWidth, 300) / 2;
    x = Math.max(halfToolbar + 10, Math.min(viewportWidth - halfToolbar - 10, x));

    return { x, y, placement };
  }

  function showToolbar(selectionInfo: SelectionInfo) {
    if (!enabled || !selectionInfo.rect) return;

    const pos = calculatePosition(selectionInfo.rect);
    position.set(pos);
    currentSelection.set(selectionInfo);
    visible.set(true);

    dispatch('show', { position: pos, selection: selectionInfo });
    resetAutoHideTimer();
  }

  function hideToolbar() {
    visible.set(false);
    currentSelection.set(null);
    activeGroup.set(null);
    clearAutoHideTimer();
    dispatch('hide');
  }

  function handleSelectionChange() {
    // Debounce selection changes
    if (!showOnSelection) return;
  }

  function handleMouseUp(event: MouseEvent) {
    if (!enabled || !showOnSelection) return;
    
    // Ignore clicks on the toolbar itself
    if (toolbar?.contains(event.target as Node)) return;

    // Small delay to let selection finalize
    setTimeout(() => {
      const selection = getSelectionInfo();
      if (selection) {
        showToolbar(selection);
      } else if (!$hovering) {
        hideToolbar();
      }
    }, 10);
  }

  function handleContextMenu(event: MouseEvent) {
    if (!enabled || !showOnRightClick) return;

    const selection = getSelectionInfo();
    if (selection) {
      event.preventDefault();
      showToolbar(selection);
    }
  }

  function handleScroll() {
    if ($visible && !$hovering) {
      hideToolbar();
    }
  }

  function handleResize() {
    if ($visible) {
      const selection = getSelectionInfo();
      if (selection?.rect) {
        const pos = calculatePosition(selection.rect);
        position.set(pos);
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && $visible) {
      hideToolbar();
    }
  }

  function handleAction(action: ToolbarAction) {
    if (action.disabled) return;

    const selection = $currentSelection;
    if (selection) {
      dispatch('action', { actionId: action.id, selection });

      // Execute built-in actions
      switch (action.id) {
        case 'copy':
          navigator.clipboard.writeText(selection.text);
          break;
        case 'cut':
          navigator.clipboard.writeText(selection.text);
          document.execCommand('delete');
          break;
        case 'search':
          window.open(`https://www.google.com/search?q=${encodeURIComponent(selection.text)}`, '_blank');
          break;
      }
    }

    // Hide after action for non-format actions
    if (!action.group?.includes('format')) {
      hideToolbar();
    }
  }

  function resetAutoHideTimer() {
    clearAutoHideTimer();
    if (autoHideDelay > 0 && !$hovering) {
      autoHideTimer = setTimeout(() => {
        if (!$hovering) hideToolbar();
      }, autoHideDelay);
    }
  }

  function clearAutoHideTimer() {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  function handleToolbarEnter() {
    hovering.set(true);
    clearAutoHideTimer();
  }

  function handleToolbarLeave() {
    hovering.set(false);
    resetAutoHideTimer();
  }

  // Public API
  export function show(rect: DOMRect, text: string = '') {
    const selection: SelectionInfo = {
      text,
      startOffset: 0,
      endOffset: text.length,
      rect,
    };
    showToolbar(selection);
  }

  export function hide() {
    hideToolbar();
  }

  export function isVisible(): boolean {
    return $visible;
  }

  // Reactive
  $: if (!enabled && $visible) {
    hideToolbar();
  }
</script>

{#if $visible}
  <div
    bind:this={toolbar}
    class="floating-toolbar"
    class:above={$position.placement === 'above'}
    class:below={$position.placement === 'below'}
    style="
      --x: {$position.x}px;
      --y: {$position.y}px;
      --max-width: {maxWidth}px;
    "
    role="toolbar"
    aria-label="Text formatting toolbar"
    on:mouseenter={handleToolbarEnter}
    on:mouseleave={handleToolbarLeave}
    transition:scale={{ duration: 150, easing: cubicOut, start: 0.9 }}
  >
    <div class="toolbar-content">
      {#each [...$groupedActions] as [groupName, groupActions], groupIndex}
        {#if groupIndex > 0}
          <div class="toolbar-divider" aria-hidden="true"></div>
        {/if}
        <div class="toolbar-group" role="group" aria-label={groupName}>
          {#each groupActions as action (action.id)}
            <button
              class="toolbar-button"
              class:danger={action.danger}
              class:disabled={action.disabled}
              title="{action.label}{action.shortcut ? ` (${action.shortcut})` : ''}"
              aria-label={action.label}
              aria-disabled={action.disabled}
              on:click={() => handleAction(action)}
            >
              <span class="button-icon" class:text-icon={action.icon.length === 1 && /[A-Z]/.test(action.icon)}>
                {action.icon}
              </span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
    
    <div class="toolbar-arrow" aria-hidden="true"></div>

    {#if $currentSelection?.text}
      <div class="selection-preview" transition:fade={{ duration: 100 }}>
        <span class="preview-text">
          {$currentSelection.text.length > 50 
            ? $currentSelection.text.slice(0, 50) + '...' 
            : $currentSelection.text}
        </span>
        <span class="preview-count">{$currentSelection.text.length} chars</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .floating-toolbar {
    position: fixed;
    left: var(--x);
    transform: translateX(-50%);
    z-index: 10000;
    max-width: var(--max-width);
    pointer-events: auto;
    user-select: none;
  }

  .floating-toolbar.above {
    bottom: calc(100vh - var(--y));
  }

  .floating-toolbar.below {
    top: var(--y);
  }

  .toolbar-content {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: var(--bg-tertiary, #1e1e1e);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 0 1px rgba(255, 255, 255, 0.1) inset;
    backdrop-filter: blur(12px);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--border-color, #444);
    margin: 0 4px;
  }

  .toolbar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 16px;
  }

  .toolbar-button:hover:not(.disabled) {
    background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  }

  .toolbar-button:active:not(.disabled) {
    background: var(--bg-active, rgba(255, 255, 255, 0.15));
    transform: scale(0.95);
  }

  .toolbar-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .toolbar-button.danger:hover:not(.disabled) {
    background: var(--danger-bg, rgba(239, 68, 68, 0.2));
    color: var(--danger-color, #ef4444);
  }

  .button-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .button-icon.text-icon {
    font-weight: 700;
    font-family: 'Georgia', serif;
  }

  .toolbar-arrow {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
  }

  .floating-toolbar.above .toolbar-arrow {
    bottom: -7px;
    border-top: 8px solid var(--bg-tertiary, #1e1e1e);
  }

  .floating-toolbar.below .toolbar-arrow {
    top: -7px;
    border-bottom: 8px solid var(--bg-tertiary, #1e1e1e);
  }

  .selection-preview {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    background: var(--bg-secondary, #252525);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
    white-space: nowrap;
    max-width: calc(var(--max-width) - 20px);
    overflow: hidden;
  }

  .floating-toolbar.below .selection-preview {
    top: auto;
    bottom: calc(100% + 8px);
  }

  .preview-text {
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-primary, #e0e0e0);
  }

  .preview-count {
    flex-shrink: 0;
    padding: 2px 6px;
    background: var(--bg-tertiary, #333);
    border-radius: 4px;
    font-size: 10px;
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: light) {
    .toolbar-content {
      background: var(--bg-tertiary, #ffffff);
      border-color: var(--border-color, #ddd);
      box-shadow: 
        0 4px 12px rgba(0, 0, 0, 0.15),
        0 0 1px rgba(0, 0, 0, 0.1) inset;
    }

    .toolbar-button {
      color: var(--text-primary, #1a1a1a);
    }

    .floating-toolbar.above .toolbar-arrow {
      border-top-color: var(--bg-tertiary, #ffffff);
    }

    .floating-toolbar.below .toolbar-arrow {
      border-bottom-color: var(--bg-tertiary, #ffffff);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .toolbar-button {
      transition: none;
    }
  }
</style>
