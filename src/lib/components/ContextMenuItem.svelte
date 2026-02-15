<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let label: string;
  export let icon: string | null = null;
  export let disabled = false;
  export let danger = false;
  export let shortcut: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function handleClick() {
    if (!disabled) {
      dispatch('click');
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="context-menu-item"
  class:disabled
  class:danger
  role="menuitem"
  tabindex={disabled ? -1 : 0}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  {#if icon}
    <span class="icon">{icon}</span>
  {/if}
  <span class="label">{label}</span>
  {#if shortcut}
    <span class="shortcut">{shortcut}</span>
  {/if}
</button>

<style>
  .context-menu-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 2px;
    background: transparent;
    color: var(--text-normal, #dcddde);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: background-color 0.1s;
  }
  
  .context-menu-item:hover:not(.disabled) {
    background-color: var(--brand-primary, #5865f2);
    color: white;
  }
  
  .context-menu-item:focus-visible {
    outline: 2px solid var(--brand-primary, #5865f2);
    outline-offset: -2px;
  }
  
  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .danger {
    color: var(--status-danger, #ed4245);
  }
  
  .danger:hover:not(.disabled) {
    background-color: var(--status-danger, #ed4245);
    color: white;
  }
  
  .icon {
    margin-right: 8px;
    width: 18px;
    text-align: center;
  }
  
  .label {
    flex: 1;
  }
  
  .shortcut {
    margin-left: auto;
    padding-left: 16px;
    color: var(--text-muted, #72767d);
    font-size: 12px;
  }
  
  .context-menu-item:hover .shortcut {
    color: inherit;
    opacity: 0.8;
  }
</style>
