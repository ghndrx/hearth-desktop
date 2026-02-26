<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { fade, blur } from 'svelte/transition';

  // Privacy mode state
  let isActive = $state(false);
  let unlisten: UnlistenFn | null = null;

  // Keyboard shortcut: Ctrl/Cmd + Shift + L (Lock/hide screen)
  function handleKeydown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? event.metaKey : event.ctrlKey;
    
    if (modifier && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      togglePrivacyMode();
    }
    
    // Also allow Escape to exit privacy mode
    if (event.key === 'Escape' && isActive) {
      deactivate();
    }
  }

  async function togglePrivacyMode() {
    isActive = !isActive;
    
    // Notify Rust side for any native integrations
    try {
      await invoke('set_privacy_mode', { active: isActive });
    } catch (e) {
      // Command might not exist yet, that's okay
      console.debug('Privacy mode command not available:', e);
    }
  }

  function activate() {
    isActive = true;
  }

  function deactivate() {
    isActive = false;
  }

  onMount(async () => {
    // Listen for keyboard events
    window.addEventListener('keydown', handleKeydown);
    
    // Listen for events from tray menu or other sources
    try {
      unlisten = await listen('privacy-mode-toggle', () => {
        togglePrivacyMode();
      });
    } catch (e) {
      console.debug('Could not set up privacy mode listener:', e);
    }
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (unlisten) {
      unlisten();
    }
  });
</script>

{#if isActive}
  <div 
    class="privacy-overlay"
    transition:fade={{ duration: 150 }}
    onclick={deactivate}
    onkeydown={(e) => e.key === 'Enter' && deactivate()}
    role="button"
    tabindex="0"
    aria-label="Privacy screen active. Click or press Escape to dismiss."
  >
    <div class="privacy-content" transition:blur={{ amount: 10, duration: 200 }}>
      <div class="privacy-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
          <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="privacy-title">Privacy Mode Active</h2>
      <p class="privacy-hint">Click anywhere or press <kbd>Esc</kbd> to return</p>
      <p class="privacy-shortcut">
        <kbd>{navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'}</kbd> + 
        <kbd>Shift</kbd> + 
        <kbd>L</kbd> to toggle
      </p>
    </div>
  </div>
{/if}

<style>
  .privacy-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: var(--bg-primary, #1e1e1e);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }

  .privacy-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: var(--text-muted, #72767d);
    text-align: center;
    padding: 2rem;
  }

  .privacy-icon {
    opacity: 0.3;
    margin-bottom: 1rem;
  }

  .privacy-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #dcddde);
    margin: 0;
  }

  .privacy-hint {
    font-size: 0.875rem;
    margin: 0;
  }

  .privacy-shortcut {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.5rem;
  }

  kbd {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    font-family: inherit;
    font-size: 0.75rem;
    background: var(--bg-tertiary, #2f3136);
    border: 1px solid var(--bg-modifier-accent, #40444b);
    border-radius: 4px;
    box-shadow: 0 1px 0 var(--bg-modifier-accent, #40444b);
  }
</style>
