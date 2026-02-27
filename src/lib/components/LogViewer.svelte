<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived } from 'svelte/store';

  // Props
  export let maxLines = 1000;
  export let autoScroll = true;
  export let showTimestamps = true;
  export let showLogLevel = true;

  // Types
  interface LogEntry {
    id: string;
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    source: string;
    message: string;
    metadata?: Record<string, unknown>;
  }

  interface LogFilter {
    levels: Set<LogEntry['level']>;
    sources: Set<string>;
    searchQuery: string;
  }

  // State
  const logs = writable<LogEntry[]>([]);
  const filter = writable<LogFilter>({
    levels: new Set(['debug', 'info', 'warn', 'error']),
    sources: new Set(),
    searchQuery: ''
  });
  const isPaused = writable(false);
  const selectedEntry = writable<LogEntry | null>(null);

  // Derived stores
  const availableSources = derived(logs, ($logs) => {
    const sources = new Set<string>();
    $logs.forEach(log => sources.add(log.source));
    return Array.from(sources).sort();
  });

  const filteredLogs = derived([logs, filter], ([$logs, $filter]) => {
    return $logs.filter(log => {
      // Level filter
      if (!$filter.levels.has(log.level)) return false;
      
      // Source filter (empty means all)
      if ($filter.sources.size > 0 && !$filter.sources.has(log.source)) return false;
      
      // Search filter
      if ($filter.searchQuery) {
        const query = $filter.searchQuery.toLowerCase();
        const matchesMessage = log.message.toLowerCase().includes(query);
        const matchesSource = log.source.toLowerCase().includes(query);
        const matchesMetadata = log.metadata 
          ? JSON.stringify(log.metadata).toLowerCase().includes(query)
          : false;
        if (!matchesMessage && !matchesSource && !matchesMetadata) return false;
      }
      
      return true;
    });
  });

  const logStats = derived(logs, ($logs) => {
    const stats = { debug: 0, info: 0, warn: 0, error: 0 };
    $logs.forEach(log => stats[log.level]++);
    return stats;
  });

  // Refs
  let logContainer: HTMLDivElement;
  let unlisten: UnlistenFn | null = null;

  // Level colors
  const levelColors: Record<LogEntry['level'], string> = {
    debug: 'text-gray-400',
    info: 'text-blue-400',
    warn: 'text-yellow-400',
    error: 'text-red-400'
  };

  const levelBgColors: Record<LogEntry['level'], string> = {
    debug: 'bg-gray-500/20',
    info: 'bg-blue-500/20',
    warn: 'bg-yellow-500/20',
    error: 'bg-red-500/20'
  };

  // Functions
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function addLogEntry(entry: Omit<LogEntry, 'id'>) {
    if ($isPaused) return;
    
    logs.update(current => {
      const newLogs = [...current, { ...entry, id: generateId() }];
      // Trim to max lines
      if (newLogs.length > maxLines) {
        return newLogs.slice(-maxLines);
      }
      return newLogs;
    });

    // Auto-scroll
    if (autoScroll && logContainer) {
      requestAnimationFrame(() => {
        logContainer.scrollTop = logContainer.scrollHeight;
      });
    }
  }

  function clearLogs() {
    logs.set([]);
    selectedEntry.set(null);
  }

  function toggleLevel(level: LogEntry['level']) {
    filter.update(f => {
      const newLevels = new Set(f.levels);
      if (newLevels.has(level)) {
        newLevels.delete(level);
      } else {
        newLevels.add(level);
      }
      return { ...f, levels: newLevels };
    });
  }

  function toggleSource(source: string) {
    filter.update(f => {
      const newSources = new Set(f.sources);
      if (newSources.has(source)) {
        newSources.delete(source);
      } else {
        newSources.add(source);
      }
      return { ...f, sources: newSources };
    });
  }

  function setSearchQuery(query: string) {
    filter.update(f => ({ ...f, searchQuery: query }));
  }

  function selectEntry(entry: LogEntry) {
    selectedEntry.set(entry);
  }

  function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  async function exportLogs() {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const path = await save({
        defaultPath: `hearth-logs-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      
      if (path) {
        const exportData = {
          exportedAt: new Date().toISOString(),
          totalEntries: $filteredLogs.length,
          entries: $filteredLogs.map(log => ({
            ...log,
            timestamp: log.timestamp.toISOString()
          }))
        };
        await writeTextFile(path, JSON.stringify(exportData, null, 2));
      }
    } catch (err) {
      console.error('Failed to export logs:', err);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
    } catch (err) {
      // Fallback to browser API
      await navigator.clipboard.writeText(text);
    }
  }

  // Lifecycle
  onMount(async () => {
    // Listen for log events from Tauri backend
    try {
      unlisten = await listen<{
        level: LogEntry['level'];
        source: string;
        message: string;
        metadata?: Record<string, unknown>;
      }>('app-log', (event) => {
        addLogEntry({
          timestamp: new Date(),
          level: event.payload.level,
          source: event.payload.source,
          message: event.payload.message,
          metadata: event.payload.metadata
        });
      });

      // Fetch initial logs
      const initialLogs = await invoke<Array<{
        timestamp: string;
        level: LogEntry['level'];
        source: string;
        message: string;
        metadata?: Record<string, unknown>;
      }>>('get_recent_logs').catch(() => []);

      initialLogs.forEach(log => {
        addLogEntry({
          timestamp: new Date(log.timestamp),
          level: log.level,
          source: log.source,
          message: log.message,
          metadata: log.metadata
        });
      });

      // Add startup log
      addLogEntry({
        timestamp: new Date(),
        level: 'info',
        source: 'LogViewer',
        message: 'Log viewer initialized'
      });
    } catch (err) {
      // Running in browser mode, add demo logs
      addLogEntry({
        timestamp: new Date(),
        level: 'info',
        source: 'LogViewer',
        message: 'Running in development mode - showing demo logs'
      });
    }

    // Intercept console methods
    const originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    console.debug = (...args) => {
      originalConsole.debug(...args);
      addLogEntry({
        timestamp: new Date(),
        level: 'debug',
        source: 'console',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      });
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLogEntry({
        timestamp: new Date(),
        level: 'info',
        source: 'console',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      });
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLogEntry({
        timestamp: new Date(),
        level: 'warn',
        source: 'console',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      });
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLogEntry({
        timestamp: new Date(),
        level: 'error',
        source: 'console',
        message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      });
    };
  });

  onDestroy(() => {
    unlisten?.();
  });
</script>

<div class="log-viewer flex flex-col h-full bg-gray-900 text-gray-100 font-mono text-sm">
  <!-- Toolbar -->
  <div class="toolbar flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
    <!-- Level filters -->
    <div class="flex items-center gap-1">
      {#each ['debug', 'info', 'warn', 'error'] as level}
        <button
          class="level-btn px-2 py-1 rounded text-xs font-medium transition-colors {$filter.levels.has(level) ? levelBgColors[level] + ' ' + levelColors[level] : 'bg-gray-700 text-gray-500'}"
          on:click={() => toggleLevel(level)}
          title="Toggle {level} logs"
        >
          {level.toUpperCase()}
          <span class="ml-1 opacity-70">({$logStats[level]})</span>
        </button>
      {/each}
    </div>

    <div class="h-4 w-px bg-gray-700" />

    <!-- Search -->
    <div class="flex-1 max-w-xs">
      <input
        type="text"
        placeholder="Search logs..."
        class="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        value={$filter.searchQuery}
        on:input={(e) => setSearchQuery(e.currentTarget.value)}
      />
    </div>

    <div class="h-4 w-px bg-gray-700" />

    <!-- Controls -->
    <button
      class="control-btn px-2 py-1 rounded text-xs transition-colors {$isPaused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
      on:click={() => isPaused.update(p => !p)}
      title={$isPaused ? 'Resume logging' : 'Pause logging'}
    >
      {$isPaused ? '▶ Resume' : '⏸ Pause'}
    </button>

    <button
      class="control-btn px-2 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded text-xs transition-colors"
      on:click={() => autoScroll = !autoScroll}
      title="Toggle auto-scroll"
    >
      {autoScroll ? '📍 Auto' : '📍 Manual'}
    </button>

    <button
      class="control-btn px-2 py-1 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded text-xs transition-colors"
      on:click={exportLogs}
      title="Export logs"
    >
      📤 Export
    </button>

    <button
      class="control-btn px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors"
      on:click={clearLogs}
      title="Clear all logs"
    >
      🗑 Clear
    </button>

    <!-- Stats -->
    <span class="text-xs text-gray-500">
      {$filteredLogs.length} / {$logs.length} entries
    </span>
  </div>

  <!-- Source filters (collapsible) -->
  {#if $availableSources.length > 0}
    <div class="source-filters flex items-center gap-1 p-2 bg-gray-850 border-b border-gray-700 overflow-x-auto">
      <span class="text-xs text-gray-500 mr-2">Sources:</span>
      {#each $availableSources as source}
        <button
          class="source-btn px-2 py-0.5 rounded text-xs transition-colors {$filter.sources.size === 0 || $filter.sources.has(source) ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-500'}"
          on:click={() => toggleSource(source)}
        >
          {source}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Log entries -->
  <div
    bind:this={logContainer}
    class="log-entries flex-1 overflow-y-auto p-2 space-y-0.5"
  >
    {#each $filteredLogs as entry (entry.id)}
      <div
        class="log-entry flex items-start gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-800/50 {$selectedEntry?.id === entry.id ? 'bg-gray-800' : ''}"
        on:click={() => selectEntry(entry)}
        on:keydown={(e) => e.key === 'Enter' && selectEntry(entry)}
        role="button"
        tabindex="0"
      >
        {#if showTimestamps}
          <span class="timestamp text-gray-500 whitespace-nowrap">
            {formatTimestamp(entry.timestamp)}
          </span>
        {/if}
        
        {#if showLogLevel}
          <span class="level {levelColors[entry.level]} font-bold w-12 text-center">
            [{entry.level.toUpperCase().slice(0, 4)}]
          </span>
        {/if}

        <span class="source text-purple-400 whitespace-nowrap">
          [{entry.source}]
        </span>

        <span class="message flex-1 break-words {levelColors[entry.level]}">
          {entry.message}
        </span>

        {#if entry.metadata}
          <span class="metadata text-gray-500 text-xs">
            📎
          </span>
        {/if}
      </div>
    {/each}

    {#if $filteredLogs.length === 0}
      <div class="empty-state flex flex-col items-center justify-center h-full text-gray-500">
        <span class="text-4xl mb-2">📋</span>
        <span>No logs to display</span>
        {#if $filter.searchQuery || $filter.sources.size > 0 || $filter.levels.size < 4}
          <span class="text-xs mt-1">Try adjusting filters</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Detail panel -->
  {#if $selectedEntry}
    <div class="detail-panel border-t border-gray-700 bg-gray-850 p-3 max-h-48 overflow-y-auto">
      <div class="flex items-start justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-300">Log Details</h3>
        <button
          class="text-gray-500 hover:text-gray-300"
          on:click={() => selectedEntry.set(null)}
        >
          ✕
        </button>
      </div>
      
      <div class="space-y-2 text-xs">
        <div class="flex gap-4">
          <span class="text-gray-500">Timestamp:</span>
          <span class="text-gray-300">{formatDate($selectedEntry.timestamp)}</span>
        </div>
        
        <div class="flex gap-4">
          <span class="text-gray-500">Level:</span>
          <span class="{levelColors[$selectedEntry.level]}">{$selectedEntry.level.toUpperCase()}</span>
        </div>
        
        <div class="flex gap-4">
          <span class="text-gray-500">Source:</span>
          <span class="text-purple-400">{$selectedEntry.source}</span>
        </div>
        
        <div>
          <span class="text-gray-500">Message:</span>
          <pre class="mt-1 p-2 bg-gray-900 rounded text-gray-300 whitespace-pre-wrap break-words">{$selectedEntry.message}</pre>
        </div>

        {#if $selectedEntry.metadata}
          <div>
            <span class="text-gray-500">Metadata:</span>
            <pre class="mt-1 p-2 bg-gray-900 rounded text-gray-300 whitespace-pre-wrap">{JSON.stringify($selectedEntry.metadata, null, 2)}</pre>
          </div>
        {/if}

        <button
          class="mt-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
          on:click={() => copyToClipboard(JSON.stringify($selectedEntry, null, 2))}
        >
          📋 Copy as JSON
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .log-viewer {
    min-height: 300px;
  }

  .bg-gray-850 {
    background-color: rgb(30, 32, 36);
  }

  .log-entry {
    font-size: 0.8125rem;
    line-height: 1.4;
  }

  .log-entries::-webkit-scrollbar {
    width: 8px;
  }

  .log-entries::-webkit-scrollbar-track {
    background: transparent;
  }

  .log-entries::-webkit-scrollbar-thumb {
    background-color: rgba(107, 114, 128, 0.5);
    border-radius: 4px;
  }

  .log-entries::-webkit-scrollbar-thumb:hover {
    background-color: rgba(107, 114, 128, 0.7);
  }
</style>
