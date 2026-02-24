<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { 
    syncStatus, 
    hasPendingSync, 
    hasSyncErrors,
    formatTimeAgo,
    getSyncStatusDescription,
    type SyncStatus
  } from '$lib/stores/syncStatus';
  import { retryFailedItems, clearCompletedItems } from '$lib/sync/syncQueue';
  import { forcSync } from '$lib/sync/syncEngine';
  import { clearWasOffline } from '$lib/stores/onlineStatus';
  
  // Props
  export let position: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left' = 'bottom-right';
  export let showDetails: boolean = false;
  export let compact: boolean = false;
  export let autoDismiss: boolean = true;
  export let dismissDelay: number = 5000;
  
  // State
  let visible = false;
  let expanded = false;
  let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastState: SyncStatus['state'] | null = null;
  
  // Reactive
  $: status = $syncStatus;
  $: shouldShow = status.state !== 'idle' || showDetails;
  
  // Watch for state changes
  $: {
    if (status.state !== lastState) {
      lastState = status.state;
      visible = shouldShow;
      
      // Auto-dismiss success state
      if (autoDismiss && status.state === 'success') {
        scheduleDismiss();
      }
    }
  }
  
  function scheduleDismiss() {
    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
    }
    
    dismissTimeout = setTimeout(() => {
      visible = false;
      clearWasOffline();
    }, dismissDelay);
  }
  
  function handleRetry() {
    retryFailedItems();
    forcSync();
  }
  
  function handleDismiss() {
    visible = false;
    if (status.state === 'success') {
      clearWasOffline();
    }
  }
  
  function handleClearCompleted() {
    clearCompletedItems();
  }
  
  function toggleExpanded() {
    expanded = !expanded;
  }
  
  // Position classes
  $: positionClass = {
    'top-right': 'top-4 right-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4'
  }[position];
  
  // Status icon and colors
  $: iconPath = {
    idle: 'M5 13l4 4L19 7',
    syncing: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    offline: 'M18.364 5.636a9 9 0 010 12.728m-12.728 0a9 9 0 010-12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072',
    error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    pending: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  }[status.state];
  
  $: statusColor = {
    idle: 'bg-gray-500',
    syncing: 'bg-blue-500',
    offline: 'bg-yellow-500',
    error: 'bg-red-500',
    pending: 'bg-blue-400',
    success: 'bg-green-500'
  }[status.state];
  
  $: textColor = {
    idle: 'text-gray-600 dark:text-gray-400',
    syncing: 'text-blue-600 dark:text-blue-400',
    offline: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    pending: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400'
  }[status.state];
  
  onDestroy(() => {
    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
    }
  });
</script>

{#if visible}
  <div 
    class="fixed z-50 {positionClass}"
    in:fly={{ y: 20, duration: 200 }}
    out:fade={{ duration: 150 }}
  >
    <div 
      class="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200"
      class:max-w-xs={!expanded}
      class:max-w-sm={expanded}
    >
      <!-- Main indicator -->
      <button 
        class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        on:click={toggleExpanded}
        aria-expanded={expanded}
      >
        <!-- Status indicator dot -->
        <div class="relative flex-shrink-0">
          <span class="w-3 h-3 rounded-full {statusColor} block" />
          {#if status.state === 'syncing'}
            <span class="absolute inset-0 w-3 h-3 rounded-full {statusColor} animate-ping opacity-75" />
          {/if}
        </div>
        
        <!-- Status icon -->
        {#if !compact}
          <svg class="w-5 h-5 {textColor} flex-shrink-0" class:animate-spin={status.state === 'syncing'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPath} />
          </svg>
        {/if}
        
        <!-- Status message -->
        <span class="flex-1 text-sm text-left {textColor} truncate">
          {status.message || 'Synchronized'}
        </span>
        
        <!-- Badge for pending/failed count -->
        {#if status.pendingCount > 0 || status.failedCount > 0}
          <span class="flex-shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium text-white rounded-full {status.failedCount > 0 ? 'bg-red-500' : 'bg-blue-500'}">
            {status.failedCount || status.pendingCount}
          </span>
        {/if}
        
        <!-- Expand/collapse chevron -->
        <svg 
          class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200"
          class:rotate-180={expanded}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <!-- Expanded details -->
      {#if expanded}
        <div class="px-3 pb-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
          <!-- Description -->
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {getSyncStatusDescription(status)}
          </p>
          
          <!-- Progress bar for syncing -->
          {#if status.state === 'syncing' && status.progress !== null}
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div 
                class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                style="width: {status.progress}%"
              />
            </div>
          {/if}
          
          <!-- Stats -->
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-gray-50 dark:bg-gray-700 rounded p-2">
              <div class="text-lg font-semibold {textColor}">{status.pendingCount}</div>
              <div class="text-xs text-gray-500">Pending</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 rounded p-2">
              <div class="text-lg font-semibold text-blue-500">{status.processingCount}</div>
              <div class="text-xs text-gray-500">Syncing</div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700 rounded p-2">
              <div class="text-lg font-semibold text-red-500">{status.failedCount}</div>
              <div class="text-xs text-gray-500">Failed</div>
            </div>
          </div>
          
          <!-- Last sync time -->
          {#if status.lastSyncAt}
            <p class="text-xs text-gray-400 text-center">
              Last synced {formatTimeAgo(status.lastSyncAt)}
            </p>
          {/if}
          
          <!-- Actions -->
          <div class="flex gap-2">
            {#if status.failedCount > 0}
              <button 
                class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
                on:click={handleRetry}
              >
                Retry Failed
              </button>
            {/if}
            
            <button 
              class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              on:click={handleDismiss}
            >
              Dismiss
            </button>
          </div>
          
          <!-- Service worker update available -->
          {#if status.updateAvailable}
            <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
              <p class="text-xs text-blue-600 dark:text-blue-400 mb-1">
                App update available!
              </p>
              <button 
                class="text-xs text-blue-700 dark:text-blue-300 underline"
                on:click={() => window.location.reload()}
              >
                Refresh to update
              </button>
            </div>
          {/if}
        </div>
      {/if}
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
  
  .animate-ping {
    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  
  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }
</style>
