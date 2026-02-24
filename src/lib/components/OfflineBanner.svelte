<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { onlineStatus, checkConnectivity, clearWasOffline } from '$lib/stores/onlineStatus';
  import { syncStatus } from '$lib/stores/syncStatus';
  
  // Props
  export let position: 'top' | 'bottom' = 'top';
  export let persistent: boolean = false;
  export let showRetryButton: boolean = true;
  export let showPendingCount: boolean = true;
  export let autoDismissOnReconnect: boolean = true;
  export let dismissDelay: number = 3000;
  
  // State
  let visible = false;
  let reconnecting = false;
  let showReconnected = false;
  let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  let retryInterval: ReturnType<typeof setInterval> | null = null;
  
  // Reactive
  $: isOffline = !$onlineStatus.isOnline;
  $: wasOffline = $onlineStatus.wasOffline;
  $: pendingCount = $syncStatus.pendingCount;
  
  // Show banner when offline
  $: {
    if (isOffline) {
      visible = true;
      showReconnected = false;
      
      // Clear any dismiss timeout
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
      }
    } else if (wasOffline && autoDismissOnReconnect) {
      showReconnected = true;
      
      // Auto-dismiss after delay
      dismissTimeout = setTimeout(() => {
        visible = false;
        showReconnected = false;
        clearWasOffline();
      }, dismissDelay);
    } else if (!persistent) {
      visible = false;
    }
  }
  
  async function handleRetry() {
    reconnecting = true;
    
    try {
      const isOnline = await checkConnectivity();
      
      if (!isOnline) {
        // Still offline - show feedback
        reconnecting = false;
      }
    } catch {
      reconnecting = false;
    }
  }
  
  function handleDismiss() {
    visible = false;
    showReconnected = false;
    clearWasOffline();
  }
  
  // Auto-retry connectivity check when offline
  onMount(() => {
    if (isOffline) {
      retryInterval = setInterval(() => {
        if (isOffline) {
          checkConnectivity();
        }
      }, 30000); // Check every 30 seconds
    }
  });
  
  onDestroy(() => {
    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
    }
    if (retryInterval) {
      clearInterval(retryInterval);
    }
  });
  
  // Position classes
  $: positionClass = position === 'top' ? 'top-0' : 'bottom-0';
</script>

{#if visible}
  <div 
    class="fixed left-0 right-0 z-40 {positionClass}"
    transition:slide={{ duration: 200 }}
  >
    <div 
      class="mx-auto max-w-screen-xl px-4"
      class:pt-2={position === 'top'}
      class:pb-2={position === 'bottom'}
    >
      <div 
        class="flex items-center justify-between gap-4 rounded-lg px-4 py-3 shadow-lg transition-colors duration-300"
        class:bg-yellow-500={isOffline}
        class:bg-green-500={showReconnected}
      >
        <!-- Icon -->
        <div class="flex items-center gap-3">
          {#if isOffline}
            <!-- Offline icon -->
            <svg class="w-5 h-5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a5 5 0 000-7.072M13 12a1 1 0 11-2 0 1 1 0 012 0zm-5.657 5.657a9 9 0 010-12.728m3.536 3.536a5 5 0 000 7.072" />
            </svg>
          {:else}
            <!-- Online icon -->
            <svg class="w-5 h-5 text-green-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
          
          <!-- Message -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span 
              class="text-sm font-medium"
              class:text-yellow-900={isOffline}
              class:text-green-900={showReconnected}
            >
              {#if isOffline}
                You're offline
              {:else if showReconnected}
                Back online!
              {/if}
            </span>
            
            {#if isOffline}
              <span class="text-xs text-yellow-800">
                Changes will be saved locally and synced when you reconnect.
              </span>
            {:else if showReconnected && pendingCount > 0}
              <span class="text-xs text-green-800">
                Syncing {pendingCount} pending item{pendingCount === 1 ? '' : 's'}...
              </span>
            {:else if showReconnected}
              <span class="text-xs text-green-800">
                All changes have been synced.
              </span>
            {/if}
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex items-center gap-2">
          <!-- Pending count badge -->
          {#if showPendingCount && pendingCount > 0 && isOffline}
            <span class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-semibold text-yellow-600 bg-yellow-100 rounded-full">
              {pendingCount} pending
            </span>
          {/if}
          
          <!-- Retry button -->
          {#if showRetryButton && isOffline}
            <button 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-900 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={handleRetry}
              disabled={reconnecting}
            >
              {#if reconnecting}
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              {/if}
            </button>
          {/if}
          
          <!-- Dismiss button (for reconnected state) -->
          {#if showReconnected}
            <button 
              class="p-1 text-green-900 hover:text-green-700 transition-colors"
              on:click={handleDismiss}
              aria-label="Dismiss"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-spin {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
