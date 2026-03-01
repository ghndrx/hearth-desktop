<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  interface LogEntry {
    id: number;
    timestamp: string;
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    module: string;
    message: string;
    context?: Record<string, unknown>;
  }

  interface LogStats {
    totalEntries: number;
    traceCount: number;
    debugCount: number;
    infoCount: number;
    warnCount: number;
    errorCount: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    modules: string[];
  }

  interface LogFilter {
    minLevel?: string;
    module?: string;
    search?: string;
    since?: string;
    limit?: number;
  }

  // State
  let isOpen = false;
  let entries: LogEntry[] = [];
  let stats: LogStats | null = null;
  let loading = false;
  let autoScroll = true;
  let showStats = false;

  // Filters
  let minLevel = 'debug';
  let moduleFilter = '';
  let searchQuery = '';
  let logLimit = 200;

  // Level styling
  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
    trace: { bg: 'bg-gray-700/50', text: 'text-gray-400', border: 'border-gray-600' },
    debug: { bg: 'bg-blue-900/50', text: 'text-blue-300', border: 'border-blue-700' },
    info: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700' },
    warn: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700' },
    error: { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-700' },
  };

  const levelIcons: Record<string, string> = {
    trace: '🔍',
    debug: '🐛',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  let logContainer: HTMLDivElement;
  let unlisten: UnlistenFn | null = null;

  async function fetchLogs() {
    loading = true;
    try {
      const filter: LogFilter = {
        minLevel,
        module: moduleFilter || undefined,
        search: searchQuery || undefined,
        limit: logLimit,
      };
      entries = await invoke<LogEntry[]>('applog_get_entries', { filter });
      entries.reverse(); // Show newest at bottom
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    }
    loading = false;
    scrollToBottom();
  }

  async function fetchStats() {
    try {
      stats = await invoke<LogStats>('applog_get_stats');
    } catch (e) {
      console.error('Failed to fetch log stats:', e);
    }
  }

  async function clearLogs() {
    if (confirm('Clear all log entries? This cannot be undone.')) {
      try {
        await invoke('applog_clear');
        entries = [];
        await fetchStats();
      } catch (e) {
        console.error('Failed to clear logs:', e);
      }
    }
  }

  async function exportLogs(format: 'json' | 'txt') {
    try {
      const filepath = await invoke<string>('applog_export', { format });
      alert(`Logs exported to:\n${filepath}`);
    } catch (e) {
      console.error('Failed to export logs:', e);
      alert('Failed to export logs');
    }
  }

  function scrollToBottom() {
    if (autoScroll && logContainer) {
      setTimeout(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      }, 50);
    }
  }

  function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }

  function formatDate(ts: string): string {
    const date = new Date(ts);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    // Ctrl/Cmd+Alt+L to toggle log viewer (Alt to avoid conflict with privacy mode)
    if (event.key === 'l' && (event.metaKey || event.ctrlKey) && event.altKey) {
      event.preventDefault();
      isOpen = !isOpen;
      if (isOpen) {
        fetchLogs();
        fetchStats();
      }
    }
    // Escape to close
    if (event.key === 'Escape' && isOpen) {
      isOpen = false;
    }
  }

  onMount(async () => {
    window.addEventListener('keydown', handleKeydown);

    // Listen for real-time log entries
    unlisten = await listen<LogEntry>('applog:entry', (event) => {
      const entry = event.payload;
      // Check if entry matches current filters
      const levelOrder = ['trace', 'debug', 'info', 'warn', 'error'];
      const minLevelIndex = levelOrder.indexOf(minLevel);
      const entryLevelIndex = levelOrder.indexOf(entry.level);
      
      if (entryLevelIndex >= minLevelIndex) {
        if (!moduleFilter || entry.module.toLowerCase().includes(moduleFilter.toLowerCase())) {
          if (!searchQuery || 
              entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
              entry.module.toLowerCase().includes(searchQuery.toLowerCase())) {
            entries = [...entries, entry].slice(-logLimit);
            scrollToBottom();
          }
        }
      }
    });
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (unlisten) unlisten();
  });

  // Refetch when filters change
  $: if (isOpen && (minLevel || moduleFilter !== undefined || searchQuery !== undefined)) {
    fetchLogs();
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col border border-gray-700">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <span class="text-xl">📋</span>
          <h2 class="text-lg font-semibold text-white">App Logs</h2>
          {#if stats}
            <span class="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
              {stats.totalEntries} entries
            </span>
          {/if}
        </div>
        
        <div class="flex items-center gap-2">
          <button
            on:click={() => showStats = !showStats}
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Stats"
          >
            📊
          </button>
          <button
            on:click={() => autoScroll = !autoScroll}
            class="p-2 rounded-lg transition-colors {autoScroll ? 'text-green-400 bg-green-900/30' : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
            title="Auto-scroll: {autoScroll ? 'On' : 'Off'}"
          >
            ⬇️
          </button>
          <button
            on:click={() => isOpen = false}
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Stats Panel -->
      {#if showStats && stats}
        <div class="px-4 py-3 bg-gray-800/50 border-b border-gray-700 grid grid-cols-5 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-400">{stats.traceCount}</div>
            <div class="text-xs text-gray-500">Trace</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400">{stats.debugCount}</div>
            <div class="text-xs text-gray-500">Debug</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-400">{stats.infoCount}</div>
            <div class="text-xs text-gray-500">Info</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-yellow-400">{stats.warnCount}</div>
            <div class="text-xs text-gray-500">Warn</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-400">{stats.errorCount}</div>
            <div class="text-xs text-gray-500">Error</div>
          </div>
        </div>
      {/if}

      <!-- Filters -->
      <div class="px-4 py-3 bg-gray-800/30 border-b border-gray-700 flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-400">Level:</label>
          <select
            bind:value={minLevel}
            class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="trace">Trace+</option>
            <option value="debug">Debug+</option>
            <option value="info">Info+</option>
            <option value="warn">Warn+</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-xs text-gray-400">Module:</label>
          <input
            type="text"
            bind:value={moduleFilter}
            placeholder="Filter by module..."
            class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
          />
        </div>

        <div class="flex items-center gap-2 flex-1">
          <label class="text-xs text-gray-400">Search:</label>
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search logs..."
            class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 min-w-[150px]"
          />
        </div>

        <div class="flex items-center gap-2">
          <button
            on:click={fetchLogs}
            class="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <!-- Log Entries -->
      <div
        bind:this={logContainer}
        class="flex-1 overflow-y-auto font-mono text-sm"
      >
        {#if loading}
          <div class="flex items-center justify-center h-full text-gray-400">
            <div class="animate-spin mr-2">⏳</div>
            Loading logs...
          </div>
        {:else if entries.length === 0}
          <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <span class="text-4xl">📭</span>
            <span>No log entries found</span>
          </div>
        {:else}
          <div class="divide-y divide-gray-800">
            {#each entries as entry (entry.id)}
              {@const colors = levelColors[entry.level] || levelColors.info}
              <div class="px-4 py-2 hover:bg-gray-800/50 group {colors.bg}">
                <div class="flex items-start gap-3">
                  <span class="text-xs opacity-70 flex-shrink-0" title={entry.timestamp}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  <span
                    class="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0 {colors.text} border {colors.border}"
                  >
                    {levelIcons[entry.level]} {entry.level.toUpperCase()}
                  </span>
                  <span class="text-xs text-purple-400 flex-shrink-0 max-w-[120px] truncate" title={entry.module}>
                    [{entry.module}]
                  </span>
                  <span class="text-gray-200 break-all flex-1">{entry.message}</span>
                </div>
                {#if entry.context}
                  <div class="mt-1 ml-[140px] text-xs text-gray-500 bg-gray-800/50 rounded p-2 overflow-x-auto">
                    <pre>{JSON.stringify(entry.context, null, 2)}</pre>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-gray-700 flex items-center justify-between bg-gray-800/30">
        <div class="text-xs text-gray-400">
          Press <kbd class="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Ctrl+Alt+L</kbd> to toggle
        </div>
        <div class="flex items-center gap-2">
          <button
            on:click={() => exportLogs('txt')}
            class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            📄 Export TXT
          </button>
          <button
            on:click={() => exportLogs('json')}
            class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            📋 Export JSON
          </button>
          <button
            on:click={clearLogs}
            class="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-300 text-sm rounded transition-colors"
          >
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Floating Toggle Button -->
<button
  on:click={() => {
    isOpen = !isOpen;
    if (isOpen) {
      fetchLogs();
      fetchStats();
    }
  }}
  class="fixed bottom-4 left-4 p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full shadow-lg transition-all z-40 border border-gray-600 group"
  title="App Logs (Ctrl+Shift+L)"
>
  <span class="text-xl group-hover:scale-110 transition-transform inline-block">📋</span>
  {#if stats && stats.errorCount > 0}
    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {stats.errorCount > 99 ? '99+' : stats.errorCount}
    </span>
  {/if}
</button>
</script>

<style>
  kbd {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  }
</style>
