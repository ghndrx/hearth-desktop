<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived, get } from 'svelte/store';

  const dispatch = createEventDispatcher();

  // Props
  export let autoSaveInterval = 30000; // Save every 30 seconds
  export let autoRestoreOnMount = true;
  export let maxOpenChannels = 20;
  export let showRestorePrompt = true;

  // Types
  interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
    fullscreen: boolean;
    monitor: string | null;
  }

  interface ChannelState {
    channel_id: string;
    server_id: string | null;
    scroll_position: number;
    draft_content: string | null;
    pinned: boolean;
  }

  interface SidebarState {
    collapsed_categories: string[];
    collapsed_servers: string[];
    width: number;
  }

  interface SessionState {
    version: number;
    timestamp: number;
    active_channel_id: string | null;
    active_server_id: string | null;
    open_channels: ChannelState[];
    window_state: WindowState;
    sidebar_state: SidebarState;
    split_view_enabled: boolean;
    split_view_channels: string[];
    theme: string | null;
    zoom_level: number;
    custom_data: Record<string, string>;
  }

  interface SessionInfo {
    has_session: boolean;
    has_backup: boolean;
    last_saved?: number;
    size_bytes?: number;
  }

  // State
  const sessionState = writable<SessionState | null>(null);
  const sessionInfo = writable<SessionInfo | null>(null);
  const isRestoring = writable(false);
  const isSaving = writable(false);
  const lastSaveTime = writable<Date | null>(null);
  const showPrompt = writable(false);
  const pendingRestore = writable<SessionState | null>(null);
  const saveError = writable<string | null>(null);
  const restoreError = writable<string | null>(null);

  // Derived
  const hasUnsavedChanges = derived(
    [sessionState, lastSaveTime],
    ([$state, $lastSave]) => {
      if (!$state || !$lastSave) return false;
      return $state.timestamp * 1000 > $lastSave.getTime();
    }
  );

  const sessionAge = derived(sessionInfo, ($info) => {
    if (!$info?.last_saved) return null;
    const now = Date.now();
    const saved = $info.last_saved * 1000;
    return Math.floor((now - saved) / 1000 / 60); // minutes
  });

  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;
  let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  // Public API functions
  export async function saveSession(): Promise<void> {
    if (get(isSaving)) return;
    
    isSaving.set(true);
    saveError.set(null);

    try {
      const state = await captureCurrentState();
      await invoke('save_session_state', { state });
      sessionState.set(state);
      lastSaveTime.set(new Date());
      dispatch('saved', { state });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      saveError.set(error);
      dispatch('error', { type: 'save', error });
    } finally {
      isSaving.set(false);
    }
  }

  export async function loadSession(): Promise<SessionState | null> {
    try {
      const state = await invoke<SessionState | null>('load_session_state');
      if (state) {
        sessionState.set(state);
        dispatch('loaded', { state });
      }
      return state;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      restoreError.set(error);
      dispatch('error', { type: 'load', error });
      return null;
    }
  }

  export async function restoreSession(state?: SessionState): Promise<void> {
    const stateToRestore = state || get(pendingRestore) || get(sessionState);
    if (!stateToRestore) return;

    isRestoring.set(true);
    restoreError.set(null);

    try {
      // Restore window state first
      if (stateToRestore.window_state) {
        await invoke('restore_window_state', { state: stateToRestore.window_state });
      }

      // Emit events for UI components to restore their state
      dispatch('restore', {
        activeChannelId: stateToRestore.active_channel_id,
        activeServerId: stateToRestore.active_server_id,
        openChannels: stateToRestore.open_channels,
        sidebarState: stateToRestore.sidebar_state,
        splitViewEnabled: stateToRestore.split_view_enabled,
        splitViewChannels: stateToRestore.split_view_channels,
        theme: stateToRestore.theme,
        zoomLevel: stateToRestore.zoom_level,
        customData: stateToRestore.custom_data,
      });

      pendingRestore.set(null);
      showPrompt.set(false);
      dispatch('restored', { state: stateToRestore });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      restoreError.set(error);
      dispatch('error', { type: 'restore', error });
    } finally {
      isRestoring.set(false);
    }
  }

  export async function clearSession(): Promise<void> {
    try {
      await invoke('clear_session_state');
      sessionState.set(null);
      sessionInfo.set(null);
      dispatch('cleared');
    } catch (e) {
      dispatch('error', { type: 'clear', error: e instanceof Error ? e.message : String(e) });
    }
  }

  export async function restoreFromBackup(): Promise<void> {
    try {
      const state = await invoke<SessionState | null>('restore_from_backup');
      if (state) {
        await restoreSession(state);
        dispatch('backup-restored', { state });
      }
    } catch (e) {
      dispatch('error', { type: 'backup', error: e instanceof Error ? e.message : String(e) });
    }
  }

  export function dismissRestorePrompt(): void {
    showPrompt.set(false);
    pendingRestore.set(null);
    dispatch('prompt-dismissed');
  }

  export function setCustomData(key: string, value: string): void {
    sessionState.update((state) => {
      if (!state) return state;
      return {
        ...state,
        custom_data: { ...state.custom_data, [key]: value },
      };
    });
  }

  // Internal functions
  async function captureCurrentState(): Promise<SessionState> {
    // Get window state from Tauri
    const windowState = await invoke<WindowState>('capture_window_state');

    // Create session state - UI components should emit their state via events
    const currentState = get(sessionState);

    return {
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: currentState?.active_channel_id || null,
      active_server_id: currentState?.active_server_id || null,
      open_channels: (currentState?.open_channels || []).slice(0, maxOpenChannels),
      window_state: windowState,
      sidebar_state: currentState?.sidebar_state || {
        collapsed_categories: [],
        collapsed_servers: [],
        width: 240,
      },
      split_view_enabled: currentState?.split_view_enabled || false,
      split_view_channels: currentState?.split_view_channels || [],
      theme: currentState?.theme || null,
      zoom_level: currentState?.zoom_level || 1.0,
      custom_data: currentState?.custom_data || {},
    };
  }

  async function loadSessionInfo(): Promise<void> {
    try {
      const info = await invoke<SessionInfo>('get_session_info');
      sessionInfo.set(info);
    } catch {
      // Ignore errors
    }
  }

  async function handleVisibilityChange(): Promise<void> {
    if (document.visibilityState === 'hidden') {
      await saveSession();
    }
  }

  function handleBeforeUnload(e: BeforeUnloadEvent): void {
    // Trigger sync save
    if (get(hasUnsavedChanges)) {
      saveSession();
    }
  }

  function startAutoSave(): void {
    if (autoSaveTimer) return;
    autoSaveTimer = setInterval(saveSession, autoSaveInterval);
  }

  function stopAutoSave(): void {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  // Update state when UI emits changes
  export function updateActiveChannel(channelId: string | null, serverId: string | null = null): void {
    sessionState.update((state) => ({
      ...state!,
      active_channel_id: channelId,
      active_server_id: serverId,
    }));
  }

  export function updateOpenChannels(channels: ChannelState[]): void {
    sessionState.update((state) => ({
      ...state!,
      open_channels: channels.slice(0, maxOpenChannels),
    }));
  }

  export function updateSidebarState(sidebar: Partial<SidebarState>): void {
    sessionState.update((state) => ({
      ...state!,
      sidebar_state: { ...state!.sidebar_state, ...sidebar },
    }));
  }

  export function updateSplitView(enabled: boolean, channels: string[] = []): void {
    sessionState.update((state) => ({
      ...state!,
      split_view_enabled: enabled,
      split_view_channels: channels,
    }));
  }

  export function updateZoomLevel(level: number): void {
    sessionState.update((state) => ({
      ...state!,
      zoom_level: level,
    }));
  }

  // Lifecycle
  onMount(async () => {
    // Initialize with empty state
    sessionState.set({
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      active_channel_id: null,
      active_server_id: null,
      open_channels: [],
      window_state: { x: 0, y: 0, width: 1200, height: 800, maximized: false, fullscreen: false, monitor: null },
      sidebar_state: { collapsed_categories: [], collapsed_servers: [], width: 240 },
      split_view_enabled: false,
      split_view_channels: [],
      theme: null,
      zoom_level: 1.0,
      custom_data: {},
    });

    await loadSessionInfo();

    // Check for existing session to restore
    if (autoRestoreOnMount) {
      const existingState = await loadSession();
      if (existingState && showRestorePrompt) {
        pendingRestore.set(existingState);
        showPrompt.set(true);
      } else if (existingState) {
        await restoreSession(existingState);
      }
    }

    // Set up auto-save
    startAutoSave();

    // Save on visibility change (tab hidden)
    visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);

    // Save before unload
    beforeUnloadHandler = handleBeforeUnload;
    window.addEventListener('beforeunload', beforeUnloadHandler);

    dispatch('ready');
  });

  onDestroy(() => {
    stopAutoSave();
    
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
    
    if (beforeUnloadHandler) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    }

    // Final save
    saveSession();
  });

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString();
  }
</script>

{#if $showPrompt && $pendingRestore}
  <div class="restore-prompt-overlay">
    <div class="restore-prompt">
      <div class="prompt-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
      
      <h2 class="prompt-title">Restore Previous Session?</h2>
      
      <p class="prompt-description">
        Your previous session from {formatTimestamp($pendingRestore.timestamp)} is available.
        Would you like to restore your open channels and window layout?
      </p>

      <div class="prompt-details">
        {#if $pendingRestore.active_channel_id}
          <div class="detail-item">
            <span class="detail-label">Last Channel:</span>
            <span class="detail-value">#{$pendingRestore.active_channel_id}</span>
          </div>
        {/if}
        
        {#if $pendingRestore.open_channels.length > 0}
          <div class="detail-item">
            <span class="detail-label">Open Tabs:</span>
            <span class="detail-value">{$pendingRestore.open_channels.length} channels</span>
          </div>
        {/if}
      </div>

      <div class="prompt-actions">
        <button class="btn btn-primary" on:click={() => restoreSession()} disabled={$isRestoring}>
          {#if $isRestoring}
            <span class="spinner"></span>
            Restoring...
          {:else}
            Restore Session
          {/if}
        </button>
        
        <button class="btn btn-secondary" on:click={dismissRestorePrompt}>
          Start Fresh
        </button>
      </div>
    </div>
  </div>
{/if}

{#if $saveError || $restoreError}
  <div class="error-toast" class:visible={$saveError || $restoreError}>
    <span class="error-icon">⚠️</span>
    <span class="error-message">{$saveError || $restoreError}</span>
    <button class="error-dismiss" on:click={() => { saveError.set(null); restoreError.set(null); }}>
      ×
    </button>
  </div>
{/if}

<slot 
  saving={$isSaving}
  restoring={$isRestoring}
  lastSave={$lastSaveTime}
  sessionAge={$sessionAge}
  hasSession={$sessionInfo?.has_session}
  {saveSession}
  {restoreSession}
  {clearSession}
/>

<style>
  .restore-prompt-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .restore-prompt {
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 12px;
    padding: 32px;
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .prompt-icon {
    color: var(--color-primary, #5865f2);
    margin-bottom: 16px;
  }

  .prompt-title {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .prompt-description {
    margin: 0 0 20px;
    color: var(--text-secondary, #b9bbbe);
    font-size: 14px;
    line-height: 1.5;
  }

  .prompt-details {
    background: var(--bg-tertiary, #1a1a1a);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 24px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }

  .detail-label {
    color: var(--text-muted, #72767d);
    font-size: 13px;
  }

  .detail-value {
    color: var(--text-primary, #fff);
    font-size: 13px;
    font-weight: 500;
  }

  .prompt-actions {
    display: flex;
    gap: 12px;
  }

  .btn {
    flex: 1;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--color-primary, #5865f2);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #4752c4);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #1a1a1a);
    color: var(--text-primary, #fff);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-modifier-hover, #2f2f2f);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--color-danger, #ed4245);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 10001;
  }

  .error-toast.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .error-icon {
    font-size: 18px;
  }

  .error-message {
    font-size: 14px;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.7;
  }

  .error-dismiss:hover {
    opacity: 1;
  }
</style>
