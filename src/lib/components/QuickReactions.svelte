<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let visible = false;
  
  const dispatch = createEventDispatcher<{
    react: { emoji: string };
  }>();
  
  // Common quick reactions
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
  
  function handleReact(emoji: string) {
    dispatch('react', { emoji });
  }
</script>

{#if visible}
  <div 
    class="quick-reactions"
    on:mouseenter
    on:mouseleave
  >
    {#each quickEmojis as emoji}
      <button
        class="reaction-btn"
        on:click={() => handleReact(emoji)}
        title="React with {emoji}"
        type="button"
      >
        {emoji}
      </button>
    {/each}
  </div>
{/if}

<style>
  .quick-reactions {
    display: flex;
    gap: 2px;
    background: var(--bg-secondary, #313338);
    border: 1px solid var(--bg-modifier-accent, #1e1f22);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.1s ease-out;
  }
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  .reaction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    font-size: 18px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .reaction-btn:hover {
    background: var(--bg-modifier-hover, #383a40);
    transform: scale(1.15);
  }
  
  .reaction-btn:active {
    transform: scale(0.95);
  }
</style>
