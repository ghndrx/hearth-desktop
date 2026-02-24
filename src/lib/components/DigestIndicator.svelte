<script lang="ts">
  /**
   * DigestIndicator.svelte
   * Shows a small badge/indicator for channels with pending digest items
   */
  export let count: number = 0;
  export let hasMentions: boolean = false;
  export let size: 'sm' | 'md' = 'sm';
  export let tooltip: string = '';
</script>

{#if count > 0}
  <div 
    class="digest-indicator flex items-center gap-0.5"
    class:digest-sm={size === 'sm'}
    class:digest-md={size === 'md'}
    title={tooltip || `${count} pending digest message${count > 1 ? 's' : ''}`}
  >
    <!-- Digest icon -->
    <svg 
      class="digest-icon" 
      viewBox="0 0 24 24" 
      fill="currentColor"
      class:text-[var(--status-warning)]={hasMentions}
      class:text-[var(--text-muted)]={!hasMentions}
    >
      <path d="M21 8V7l-3 2-3-2v1l3 2 3-2zm1-5H2C.9 3 0 3.9 0 5v14c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H2v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1zm8-6h-8V6h8v6z"/>
    </svg>
    
    <!-- Count badge -->
    {#if size === 'md' || count > 9}
      <span 
        class="digest-count text-xs font-medium"
        class:text-[var(--status-warning)]={hasMentions}
        class:text-[var(--text-muted)]={!hasMentions}
      >
        {count > 99 ? '99+' : count}
      </span>
    {/if}
  </div>
{/if}

<style>
  .digest-indicator {
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    padding: 2px 4px;
    background: var(--bg-secondary);
  }

  .digest-sm .digest-icon {
    width: 12px;
    height: 12px;
  }

  .digest-md .digest-icon {
    width: 16px;
    height: 16px;
  }

  .digest-sm .digest-count {
    font-size: 10px;
    margin-left: 2px;
  }

  .digest-md .digest-count {
    font-size: 12px;
    margin-left: 4px;
  }
</style>
