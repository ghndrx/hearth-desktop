<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface FileChangeEvent {
    path: string;
    eventType: string;
    timestamp: string;
    sizeBytes: number | null;
    isDir: boolean;
  }

  interface WatcherStats {
    watching: boolean;
    watchPath: string | null;
    events: FileChangeEvent[];
    totalEvents: number;
    createdCount: number;
    modifiedCount: number;
    deletedCount: number;
  }

  let watchPath = $state('');
  let watching = $state(false);
  let events = $state<FileChangeEvent[]>([]);
  let totalEvents = $state(0);
  let createdCount = $state(0);
  let modifiedCount = $state(0);
  let deletedCount = $state(0);
  let error = $state('');
  let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

  function getEventColor(eventType: string): string {
    switch (eventType) {
      case 'created': return 'var(--success, #43b581)';
      case 'modified': return 'var(--warning, #faa61a)';
      case 'deleted': return 'var(--error, #f04747)';
      case 'existing': return 'var(--text-muted)';
      default: return 'var(--text-primary)';
    }
  }

  function getEventIcon(eventType: string): string {
    switch (eventType) {
      case 'created': return '+';
      case 'modified': return '~';
      case 'deleted': return '-';
      case 'existing': return '.';
      default: return '?';
    }
  }

  function formatPath(fullPath: string): string {
    const parts = fullPath.split('/');
    return parts[parts.length - 1] || fullPath;
  }

  function formatTimestamp(ts: string): string {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString();
    } catch {
      return ts;
    }
  }

  async function startWatching() {
    error = '';
    if (!watchPath.trim()) {
      error = 'Please enter a directory path';
      return;
    }
    try {
      const stats = await invoke<WatcherStats>('filewatchlive_set_path', { path: watchPath.trim() });
      watching = stats.watching;
      events = stats.events;
      totalEvents = stats.totalEvents;
      createdCount = stats.createdCount;
      modifiedCount = stats.modifiedCount;
      deletedCount = stats.deletedCount;
      startPolling();
    } catch (e) {
      error = String(e);
    }
  }

  async function stopWatching() {
    try {
      await invoke('filewatchlive_stop');
      watching = false;
      stopPolling();
    } catch (e) {
      error = String(e);
    }
  }

  async function poll() {
    try {
      const stats = await invoke<WatcherStats>('filewatchlive_poll');
      watching = stats.watching;
      events = stats.events;
      totalEvents = stats.totalEvents;
      createdCount = stats.createdCount;
      modifiedCount = stats.modifiedCount;
      deletedCount = stats.deletedCount;
    } catch (e) {
      error = String(e);
    }
  }

  async function clearEvents() {
    try {
      await invoke('filewatchlive_clear');
      events = [];
      totalEvents = 0;
      createdCount = 0;
      modifiedCount = 0;
      deletedCount = 0;
    } catch (e) {
      error = String(e);
    }
  }

  function startPolling() {
    stopPolling();
    pollInterval = setInterval(poll, 2000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  onMount(() => {
    return () => {
      stopPolling();
    };
  });
</script>

<div class="filewatchlive-panel">
  <div class="header">
    <h3>File Watcher Live</h3>
  </div>

  <div class="controls">
    <input
      type="text"
      class="path-input"
      placeholder="Enter directory path to watch..."
      bind:value={watchPath}
      disabled={watching}
    />
    <div class="buttons">
      {#if watching}
        <button class="btn stop-btn" onclick={stopWatching}>Stop</button>
      {:else}
        <button class="btn start-btn" onclick={startWatching}>Start</button>
      {/if}
      <button class="btn clear-btn" onclick={clearEvents}>Clear</button>
    </div>
  </div>

  {#if error}
    <div class="error-msg">{error}</div>
  {/if}

  <div class="stats-bar">
    <span class="stat">
      <span class="stat-label">Total:</span>
      <span class="stat-value">{totalEvents}</span>
    </span>
    <span class="stat">
      <span class="stat-dot" style="background: var(--success, #43b581)"></span>
      <span class="stat-label">Created:</span>
      <span class="stat-value">{createdCount}</span>
    </span>
    <span class="stat">
      <span class="stat-dot" style="background: var(--warning, #faa61a)"></span>
      <span class="stat-label">Modified:</span>
      <span class="stat-value">{modifiedCount}</span>
    </span>
    <span class="stat">
      <span class="stat-dot" style="background: var(--error, #f04747)"></span>
      <span class="stat-label">Deleted:</span>
      <span class="stat-value">{deletedCount}</span>
    </span>
    {#if watching}
      <span class="watching-indicator">Watching</span>
    {/if}
  </div>

  <div class="event-feed">
    {#if events.length === 0}
      <div class="empty-state">
        {#if watching}
          Watching for changes...
        {:else}
          Enter a directory path and click Start to begin watching.
        {/if}
      </div>
    {:else}
      {#each events as event}
        <div class="event-row">
          <span class="event-icon" style="color: {getEventColor(event.eventType)}">
            {getEventIcon(event.eventType)}
          </span>
          <span class="event-type" style="color: {getEventColor(event.eventType)}">
            {event.eventType}
          </span>
          <span class="event-path" title={event.path}>
            {#if event.isDir}[dir]{/if}
            {formatPath(event.path)}
          </span>
          {#if event.sizeBytes != null}
            <span class="event-size">{event.sizeBytes}B</span>
          {/if}
          <span class="event-time">{formatTimestamp(event.timestamp)}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .filewatchlive-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--bg-primary);
    color: var(--text-primary);
    height: 100%;
    font-family: inherit;
    font-size: 13px;
  }

  .header h3 {
    margin: 0;
    font-size: 14px;
    color: var(--text-primary);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .path-input {
    width: 100%;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--text-muted);
    border-radius: 4px;
    font-size: 12px;
    outline: none;
    box-sizing: border-box;
  }

  .path-input:focus {
    border-color: var(--accent);
  }

  .path-input:disabled {
    opacity: 0.6;
  }

  .buttons {
    display: flex;
    gap: 6px;
  }

  .btn {
    padding: 5px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }

  .start-btn {
    background: var(--success, #43b581);
    color: #fff;
  }

  .stop-btn {
    background: var(--error, #f04747);
    color: #fff;
  }

  .clear-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn:hover {
    opacity: 0.85;
  }

  .error-msg {
    color: var(--error, #f04747);
    font-size: 12px;
    padding: 4px 0;
  }

  .stats-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 6px 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 11px;
    flex-wrap: wrap;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .stat-label {
    color: var(--text-muted);
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-primary);
  }

  .watching-indicator {
    margin-left: auto;
    color: var(--success, #43b581);
    font-weight: 600;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .event-feed {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-tertiary);
    border-radius: 4px;
    padding: 4px;
    min-height: 120px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 80px;
    color: var(--text-muted);
    font-size: 12px;
  }

  .event-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-radius: 2px;
    font-size: 11px;
    font-family: monospace;
  }

  .event-row:hover {
    background: var(--bg-primary);
  }

  .event-icon {
    font-weight: bold;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
  }

  .event-type {
    width: 60px;
    flex-shrink: 0;
    font-weight: 500;
  }

  .event-path {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }

  .event-size {
    color: var(--text-muted);
    flex-shrink: 0;
    font-size: 10px;
  }

  .event-time {
    color: var(--text-muted);
    flex-shrink: 0;
    font-size: 10px;
  }
</style>
