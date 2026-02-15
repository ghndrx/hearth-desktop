<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ui } from '$lib/stores/ui';

  function handleKeydown(e: KeyboardEvent) {
    // Don't intercept if user is typing in an input/textarea
    const target = e.target as HTMLElement;
    const isEditing = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

    // Ctrl+K / Cmd+K - Open search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      ui.toggleSearch();
      return;
    }

    // Ctrl+/ / Cmd+/ - Open help
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      ui.toggleHelp();
      return;
    }

    // Escape - Close modals (only when not editing)
    if (e.key === 'Escape' && !isEditing) {
      // Check if any modal is open and close it
      // The individual Modal components handle their own Escape,
      // but this catches global UI modals like search/help
      ui.closeAllModals();
      return;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>
