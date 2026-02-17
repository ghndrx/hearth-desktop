<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
  import { handleListKeyboard } from '$lib/utils/keyboard';
  
  export let x = 0;
  export let y = 0;
  export let show = false;
  
  const dispatch = createEventDispatcher();
  
  let menuElement: HTMLDivElement;
  let focusedIndex = 0;
  
  function getMenuItems(): HTMLElement[] {
    if (!menuElement) return [];
    return Array.from(menuElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'));
  }
  
  function focusItem(index: number) {
    const items = getMenuItems();
    if (items[index]) {
      items[index].focus();
      focusedIndex = index;
    }
  }
  
  function handleClick(event: MouseEvent) {
    if (menuElement && !menuElement.contains(event.target as Node)) {
      close();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (!show) return;
    
    const items = getMenuItems();
    if (items.length === 0) return;
    
    const { handled, newIndex } = handleListKeyboard(event, focusedIndex, items.length, {
      wrap: true,
      onEscape: close
    });
    
    if (handled && newIndex !== focusedIndex) {
      focusItem(newIndex);
    }
  }
  
  function close() {
    show = false;
    dispatch('close');
  }
  
  onMount(() => {
    document.addEventListener('click', handleClick);
  });
  
  onDestroy(() => {
    document.removeEventListener('click', handleClick);
  });
  
  // Focus first item when menu opens
  $: if (show) {
    tick().then(() => {
      focusedIndex = 0;
      focusItem(0);
    });
  }
  
  // Adjust position to stay within viewport
  $: if (show && menuElement) {
    const rect = menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }
  }
</script>

{#if show}
  <div
    bind:this={menuElement}
    class="context-menu"
    style="left: {x}px; top: {y}px;"
    role="menu"
    aria-label="Context menu"
    on:keydown={handleKeydown}
  >
    <slot />
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 1000;
    min-width: 180px;
    max-width: 300px;
    background-color: var(--bg-floating, #18191c);
    border-radius: 4px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
    padding: 6px 8px;
    animation: fadeIn 0.1s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
