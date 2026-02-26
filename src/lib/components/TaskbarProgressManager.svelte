<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { writable, derived, type Readable } from 'svelte/store';

  // Types
  export type ProgressMode = 'none' | 'indeterminate' | 'normal' | 'paused' | 'error';

  export interface ProgressState {
    active: boolean;
    progress: number;
    mode: ProgressMode;
    label: string | null;
  }

  export interface Operation {
    id: string;
    label: string;
    total: number;
    completed: number;
    started_at: number;
  }

  export interface ProgressUpdateEvent {
    total: number;
    completed: number;
    operations: number;
    progress: number;
  }

  // Props
  export let showIndicator = true;
  export let position: 'top-right' | 'bottom-right' | 'bottom-left' | 'top-left' = 'bottom-right';

  // State
  const progressState = writable<ProgressState>({
    active: false,
    progress: 0,
    mode: 'none',
    label: null,
  });

  const operations = writable<Operation[]>([]);
  
  let unlisten: UnlistenFn | null = null;
  let pollInterval: number | null = null;

  // Derived stores
  const aggregateProgress: Readable<number> = derived(operations, ($ops) => {
    if ($ops.length === 0) return 0;
    const total = $ops.reduce((sum, op) => sum + op.total, 0);
    const completed = $ops.reduce((sum, op) => sum + op.completed, 0);
    return total > 0 ? completed / total : 0;
  });

  const activeOperationCount: Readable<number> = derived(operations, ($ops) => $ops.length);

  const isActive: Readable<boolean> = derived(operations, ($ops) => $ops.length > 0);

  // API functions
  export async function setProgress(
    progress: number,
    mode: ProgressMode = 'normal',
    label?: string
  ): Promise<ProgressState> {
    try {
      const state = await invoke<ProgressState>('set_taskbar_progress', {
        options: {
          progress,
          mode,
          label: label ?? null,
        },
      });
      progressState.set(state);
      return state;
    } catch (error) {
      console.error('Failed to set taskbar progress:', error);
      throw error;
    }
  }

  export async function clearProgress(): Promise<void> {
    try {
      await invoke('clear_taskbar_progress');
      progressState.set({
        active: false,
        progress: 0,
        mode: 'none',
        label: null,
      });
    } catch (error) {
      console.error('Failed to clear taskbar progress:', error);
      throw error;
    }
  }

  export async function startOperation(
    id: string,
    label: string,
    total: number
  ): Promise<Operation> {
    try {
      const op = await invoke<Operation>('start_operation', { id, label, total });
      await refreshOperations();
      return op;
    } catch (error) {
      console.error('Failed to start operation:', error);
      throw error;
    }
  }

  export async function updateOperation(id: string, completed: number): Promise<Operation | null> {
    try {
      const op = await invoke<Operation | null>('update_operation', { id, completed });
      await refreshOperations();
      return op;
    } catch (error) {
      console.error('Failed to update operation:', error);
      throw error;
    }
  }

  export async function completeOperation(id: string): Promise<void> {
    try {
      await invoke('complete_operation', { id });
      await refreshOperations();
    } catch (error) {
      console.error('Failed to complete operation:', error);
      throw error;
    }
  }

  async function refreshOperations(): Promise<void> {
    try {
      const ops = await invoke<Operation[]>('get_operations');
      operations.set(ops);
    } catch (error) {
      console.error('Failed to get operations:', error);
    }
  }

  async function getProgress(): Promise<ProgressState> {
    try {
      const state = await invoke<ProgressState>('get_taskbar_progress');
      progressState.set(state);
      return state;
    } catch (error) {
      console.error('Failed to get taskbar progress:', error);
      throw error;
    }
  }

  // Helpers
  function formatProgress(progress: number): string {
    return `${Math.round(progress * 100)}%`;
  }

  function formatTime(startedAt: number): string {
    const elapsed = Date.now() - startedAt;
    const seconds = Math.floor(elapsed / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  function getOperationProgress(op: Operation): number {
    return op.total > 0 ? op.completed / op.total : 0;
  }

  // Position styles
  const positionStyles = {
    'top-right': 'top: 1rem; right: 1rem;',
    'bottom-right': 'bottom: 1rem; right: 1rem;',
    'bottom-left': 'bottom: 1rem; left: 1rem;',
    'top-left': 'top: 1rem; left: 1rem;',
  };

  onMount(async () => {
    // Load initial state
    await getProgress();
    await refreshOperations();

    // Listen for progress updates
    unlisten = await listen<ProgressUpdateEvent>('taskbar-progress-update', (event) => {
      refreshOperations();
    });

    // Poll for updates every 2 seconds (backup for missed events)
    pollInterval = window.setInterval(() => {
      refreshOperations();
    }, 2000);
  });

  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });

  // Export stores for external use
  export { progressState, operations, aggregateProgress, activeOperationCount, isActive };
</script>

{#if showIndicator && $isActive}
  <div
    class="taskbar-progress-indicator"
    style={positionStyles[position]}
    role="status"
    aria-live="polite"
    aria-label="Operation progress"
  >
    <div class="progress-header">
      <span class="progress-title">
        {$activeOperationCount} operation{$activeOperationCount !== 1 ? 's' : ''}
      </span>
      <span class="progress-percent">{formatProgress($aggregateProgress)}</span>
    </div>

    <div class="progress-bar-container">
      <div
        class="progress-bar"
        style="width: {$aggregateProgress * 100}%"
        class:indeterminate={$progressState.mode === 'indeterminate'}
        class:paused={$progressState.mode === 'paused'}
        class:error={$progressState.mode === 'error'}
      />
    </div>

    {#if $operations.length > 0}
      <div class="operations-list">
        {#each $operations as op (op.id)}
          <div class="operation-item">
            <span class="operation-label">{op.label}</span>
            <div class="operation-meta">
              <span class="operation-progress">{formatProgress(getOperationProgress(op))}</span>
              <span class="operation-time">{formatTime(op.started_at)}</span>
            </div>
            <div class="operation-bar">
              <div class="operation-bar-fill" style="width: {getOperationProgress(op) * 100}%" />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .taskbar-progress-indicator {
    position: fixed;
    z-index: 9999;
    background: var(--bg-primary, #1a1a1a);
    border: 1px solid var(--border-color, #333);
    border-radius: 8px;
    padding: 12px;
    min-width: 240px;
    max-width: 320px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    font-size: 13px;
    color: var(--text-primary, #fff);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .progress-title {
    font-weight: 600;
    color: var(--text-secondary, #aaa);
  }

  .progress-percent {
    font-weight: 700;
    color: var(--accent-color, #7289da);
  }

  .progress-bar-container {
    height: 6px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--accent-color, #7289da);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-bar.indeterminate {
    width: 100% !important;
    background: linear-gradient(
      90deg,
      transparent 0%,
      var(--accent-color, #7289da) 50%,
      transparent 100%
    );
    animation: indeterminate 1.5s infinite linear;
  }

  .progress-bar.paused {
    background: var(--warning-color, #faa61a);
  }

  .progress-bar.error {
    background: var(--error-color, #f04747);
  }

  @keyframes indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .operations-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }

  .operation-item {
    padding: 8px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 4px;
  }

  .operation-label {
    display: block;
    font-size: 12px;
    color: var(--text-primary, #fff);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .operation-meta {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-muted, #666);
    margin-bottom: 4px;
  }

  .operation-progress {
    color: var(--accent-color, #7289da);
    font-weight: 600;
  }

  .operation-time {
    opacity: 0.7;
  }

  .operation-bar {
    height: 3px;
    background: var(--bg-tertiary, #333);
    border-radius: 2px;
    overflow: hidden;
  }

  .operation-bar-fill {
    height: 100%;
    background: var(--accent-color, #7289da);
    transition: width 0.2s ease;
  }

  /* Scrollbar styles */
  .operations-list::-webkit-scrollbar {
    width: 4px;
  }

  .operations-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .operations-list::-webkit-scrollbar-thumb {
    background: var(--border-color, #333);
    border-radius: 2px;
  }
</style>
