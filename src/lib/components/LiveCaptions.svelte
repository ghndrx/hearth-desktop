<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    transcriptionState,
    visibleTranscriptionEntries,
    transcriptionActions,
    type TranscriptionEntry
  } from '$lib/stores/voice';
  import { getVoiceConnectionManager } from '$lib/voice';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let className: string = '';
  export let maxHeight: string = '300px';
  export let position: 'overlay' | 'inline' = 'overlay';

  let captionsContainer: HTMLDivElement;
  let isEnabled = false;
  let isReady = false;
  let entries: TranscriptionEntry[] = [];
  let settings: any = {};
  let error: string | null = null;

  // Auto-scroll behavior
  let shouldAutoScroll = true;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  // Subscribe to transcription state
  const unsubscribeState = transcriptionState.subscribe(state => {
    isEnabled = state.isEnabled;
    isReady = state.isReady;
    settings = state.settings;
    error = state.error;
  });

  // Subscribe to visible entries
  const unsubscribeEntries = visibleTranscriptionEntries.subscribe(newEntries => {
    entries = newEntries;
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  });

  function scrollToBottom() {
    if (captionsContainer) {
      setTimeout(() => {
        captionsContainer.scrollTop = captionsContainer.scrollHeight;
      }, 10);
    }
  }

  function handleScroll() {
    if (!captionsContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = captionsContainer;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    shouldAutoScroll = isAtBottom;

    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    // Re-enable auto-scroll after 3 seconds of no manual scrolling
    if (!isAtBottom) {
      scrollTimeout = setTimeout(() => {
        shouldAutoScroll = true;
      }, 3000);
    }
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    if (confidence >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  }

  function toggleTranscription() {
    if (isEnabled) {
      const voiceManager = getVoiceConnectionManager();
      voiceManager.disableTranscription();
    } else {
      enableTranscription();
    }
  }

  async function enableTranscription() {
    try {
      const voiceManager = getVoiceConnectionManager();
      await voiceManager.enableTranscription();
    } catch (err) {
      console.error('[LiveCaptions] Failed to enable transcription:', err);
    }
  }

  function clearCaptions() {
    transcriptionActions.clearEntries();
  }

  onMount(() => {
    // Initialize transcription state
    transcriptionActions.init();
  });

  onDestroy(() => {
    unsubscribeState();
    unsubscribeEntries();
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
  });

  $: containerClasses = position === 'overlay'
    ? 'fixed bottom-4 right-4 z-50 w-96 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg'
    : 'w-full bg-gray-800 border border-gray-700 rounded-lg';

  $: captionClasses = `p-4 ${className}`;
</script>

<div class={`${containerClasses} ${captionClasses}`}>
  <!-- Header -->
  <div class="flex items-center justify-between mb-3 border-b border-gray-700 pb-2">
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full {isEnabled && isReady ? 'bg-green-400' : isEnabled ? 'bg-yellow-400' : 'bg-gray-400'}"></div>
      <h3 class="text-sm font-medium text-white">Live Captions</h3>
      {#if isEnabled && !isReady}
        <div class="animate-spin w-3 h-3 border border-gray-400 border-t-white rounded-full"></div>
      {/if}
    </div>

    <div class="flex items-center gap-1">
      {#if entries.length > 0}
        <button
          class="p-1 text-gray-400 hover:text-white transition-colors rounded"
          on:click={clearCaptions}
          title="Clear captions"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      {/if}

      <button
        class="p-1 text-gray-400 hover:text-white transition-colors rounded {isEnabled ? 'text-green-400' : ''}"
        on:click={toggleTranscription}
        title={isEnabled ? 'Disable transcription' : 'Enable transcription'}
      >
        {#if isEnabled}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path>
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        {/if}
      </button>
    </div>
  </div>

  <!-- Error State -->
  {#if error}
    <div class="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm"
         transition:fade={{ duration: 200 }}>
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>{error}</span>
      </div>
    </div>
  {/if}

  <!-- Caption Display -->
  <div
    bind:this={captionsContainer}
    class="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
    style="max-height: {maxHeight}"
    on:scroll={handleScroll}
  >
    {#if !isEnabled}
      <!-- Disabled State -->
      <div class="flex items-center justify-center py-8 text-gray-400 text-sm">
        <div class="text-center">
          <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
          </svg>
          <p>Click to enable live captions</p>
        </div>
      </div>
    {:else if !isReady}
      <!-- Loading State -->
      <div class="flex items-center justify-center py-8 text-gray-400 text-sm">
        <div class="text-center">
          <div class="animate-spin w-6 h-6 border-2 border-gray-400 border-t-white rounded-full mx-auto mb-2"></div>
          <p>Initializing transcription...</p>
        </div>
      </div>
    {:else if entries.length === 0}
      <!-- Empty State -->
      <div class="flex items-center justify-center py-8 text-gray-400 text-sm">
        <div class="text-center">
          <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
          </svg>
          <p>Listening for speech...</p>
        </div>
      </div>
    {:else}
      <!-- Caption Entries -->
      <div class="space-y-2">
        {#each entries as entry (entry.id)}
          <div
            class="p-2 rounded-lg bg-gray-800/50 border border-gray-700/50"
            transition:fly={{ y: 20, duration: 300, easing: cubicOut }}
          >
            <!-- Header with username and metadata -->
            <div class="flex items-center justify-between mb-1 text-xs">
              <span class="font-medium text-gray-300">{entry.username}</span>
              <div class="flex items-center gap-2 text-gray-500">
                {#if settings.showTimestamps}
                  <span>{formatTimestamp(entry.timestamp)}</span>
                {/if}
                {#if settings.showConfidence}
                  <span class={getConfidenceColor(entry.confidence)}>
                    {Math.round(entry.confidence * 100)}%
                  </span>
                {/if}
                {#if entry.language !== 'en'}
                  <span class="px-1 py-0.5 bg-gray-700 rounded text-xs uppercase">
                    {entry.language}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Transcribed text -->
            <p class="text-sm text-white leading-relaxed {entry.isFinal ? '' : 'italic opacity-75'}">
              {entry.text}
            </p>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Auto-scroll indicator -->
  {#if !shouldAutoScroll && entries.length > 0}
    <button
      class="absolute bottom-2 right-2 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
      on:click={scrollToBottom}
      title="Scroll to bottom"
      transition:fade={{ duration: 200 }}
    >
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
      </svg>
    </button>
  {/if}
</div>

<style>
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
    background-color: rgb(75 85 99);
    border-radius: 4px;
  }

  .scrollbar-track-gray-800::-webkit-scrollbar-track {
    background-color: rgb(31 41 55);
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
</style>