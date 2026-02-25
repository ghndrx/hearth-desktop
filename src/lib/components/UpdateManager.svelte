<script lang="ts">
  /**
   * UpdateManager.svelte
   * 
   * Provides a user interface for app updates. Listens for update events
   * from Tauri and displays notification banners, download progress, and
   * handles the update installation flow.
   */
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { fade, slide } from 'svelte/transition';

  // Types
  interface UpdateInfo {
    version: string;
    current_version: string;
    body: string | null;
    date: string | null;
  }

  interface UpdateProgress {
    downloaded: number;
    total: number | null;
    percent: number | null;
  }

  type UpdateState = 'idle' | 'available' | 'downloading' | 'installing' | 'error';

  // Props
  export let position: 'top' | 'bottom' = 'top';
  export let autoCheck: boolean = true;
  export let checkInterval: number = 3600000; // 1 hour in ms

  // State
  let state: UpdateState = 'idle';
  let updateInfo: UpdateInfo | null = null;
  let progress: UpdateProgress | null = null;
  let errorMessage: string | null = null;
  let dismissed: boolean = false;
  let showChangelog: boolean = false;

  // Event unsubscribers
  let unlistenAvailable: UnlistenFn | null = null;
  let unlistenProgress: UnlistenFn | null = null;
  let unlistenInstalling: UnlistenFn | null = null;
  let checkIntervalId: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    // Listen for update events from Tauri
    unlistenAvailable = await listen<UpdateInfo>('update:available', (event) => {
      updateInfo = event.payload;
      state = 'available';
      dismissed = false;
    });

    unlistenProgress = await listen<UpdateProgress>('update:progress', (event) => {
      progress = event.payload;
      state = 'downloading';
    });

    unlistenInstalling = await listen('update:installing', () => {
      state = 'installing';
      progress = null;
    });

    // Check for updates immediately if autoCheck is enabled
    if (autoCheck) {
      await checkForUpdates();
      
      // Set up periodic checks
      checkIntervalId = setInterval(async () => {
        if (state === 'idle') {
          await checkForUpdates();
        }
      }, checkInterval);
    }
  });

  onDestroy(() => {
    unlistenAvailable?.();
    unlistenProgress?.();
    unlistenInstalling?.();
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
    }
  });

  async function checkForUpdates(): Promise<void> {
    try {
      const info = await invoke<UpdateInfo | null>('check_for_updates');
      if (info) {
        updateInfo = info;
        state = 'available';
        dismissed = false;
      }
    } catch (err) {
      console.warn('Failed to check for updates:', err);
    }
  }

  async function startUpdate(): Promise<void> {
    if (!updateInfo) return;
    
    state = 'downloading';
    progress = { downloaded: 0, total: null, percent: 0 };
    errorMessage = null;

    try {
      await invoke('download_and_install_update');
      // If we reach here, the app should be restarting
    } catch (err) {
      state = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  function dismiss(): void {
    dismissed = true;
  }

  function retry(): void {
    errorMessage = null;
    state = 'available';
  }

  function toggleChangelog(): void {
    showChangelog = !showChangelog;
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatChangelog(body: string | null): string {
    if (!body) return 'No changelog available.';
    // Simple markdown-lite formatting
    return body
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  $: isVisible = state !== 'idle' && !dismissed;
  $: progressPercent = progress?.percent ?? 0;
</script>

{#if isVisible}
  <div 
    class="update-manager" 
    class:position-top={position === 'top'}
    class:position-bottom={position === 'bottom'}
    class:state-available={state === 'available'}
    class:state-downloading={state === 'downloading'}
    class:state-installing={state === 'installing'}
    class:state-error={state === 'error'}
    transition:slide={{ duration: 300 }}
  >
    <div class="update-content">
      <!-- Update Available State -->
      {#if state === 'available' && updateInfo}
        <div class="update-icon" transition:fade>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div class="update-text">
          <span class="update-title">Update Available</span>
          <span class="update-version">
            v{updateInfo.current_version} → v{updateInfo.version}
          </span>
        </div>
        <div class="update-actions">
          {#if updateInfo.body}
            <button class="btn-link" on:click={toggleChangelog}>
              {showChangelog ? 'Hide' : 'View'} Changelog
            </button>
          {/if}
          <button class="btn-secondary" on:click={dismiss}>
            Later
          </button>
          <button class="btn-primary" on:click={startUpdate}>
            Update Now
          </button>
        </div>
      {/if}

      <!-- Downloading State -->
      {#if state === 'downloading'}
        <div class="update-icon spinning" transition:fade>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
        <div class="update-text">
          <span class="update-title">Downloading Update...</span>
          {#if progress}
            <span class="update-progress-text">
              {formatBytes(progress.downloaded)}
              {#if progress.total}
                / {formatBytes(progress.total)}
              {/if}
            </span>
          {/if}
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            style="width: {progressPercent}%"
          ></div>
        </div>
      {/if}

      <!-- Installing State -->
      {#if state === 'installing'}
        <div class="update-icon spinning" transition:fade>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4"/>
            <path d="m16.2 7.8 2.9-2.9"/>
            <path d="M18 12h4"/>
            <path d="m16.2 16.2 2.9 2.9"/>
            <path d="M12 18v4"/>
            <path d="m4.9 19.1 2.9-2.9"/>
            <path d="M2 12h4"/>
            <path d="m4.9 4.9 2.9 2.9"/>
          </svg>
        </div>
        <div class="update-text">
          <span class="update-title">Installing Update...</span>
          <span class="update-subtitle">The app will restart automatically</span>
        </div>
      {/if}

      <!-- Error State -->
      {#if state === 'error'}
        <div class="update-icon error" transition:fade>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="update-text">
          <span class="update-title">Update Failed</span>
          <span class="update-error">{errorMessage || 'An unknown error occurred'}</span>
        </div>
        <div class="update-actions">
          <button class="btn-secondary" on:click={dismiss}>
            Dismiss
          </button>
          <button class="btn-primary" on:click={retry}>
            Retry
          </button>
        </div>
      {/if}
    </div>

    <!-- Changelog Dropdown -->
    {#if showChangelog && updateInfo?.body}
      <div class="changelog" transition:slide={{ duration: 200 }}>
        <div class="changelog-content">
          {@html formatChangelog(updateInfo.body)}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .update-manager {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 9999;
    background: var(--bg-secondary, #1e1e2e);
    border: 1px solid var(--border-color, #313244);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .position-top {
    top: 0;
    border-top: none;
    border-radius: 0 0 8px 8px;
  }

  .position-bottom {
    bottom: 0;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
  }

  .state-available {
    border-left: 3px solid var(--accent-color, #89b4fa);
  }

  .state-downloading {
    border-left: 3px solid var(--warning-color, #f9e2af);
  }

  .state-installing {
    border-left: 3px solid var(--success-color, #a6e3a1);
  }

  .state-error {
    border-left: 3px solid var(--error-color, #f38ba8);
  }

  .update-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
  }

  .update-icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: var(--bg-tertiary, #313244);
    color: var(--accent-color, #89b4fa);
  }

  .update-icon.spinning svg {
    animation: spin 1s linear infinite;
  }

  .update-icon.error {
    color: var(--error-color, #f38ba8);
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .update-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .update-title {
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .update-version,
  .update-subtitle,
  .update-progress-text {
    font-size: 13px;
    color: var(--text-secondary, #a6adc8);
  }

  .update-error {
    font-size: 13px;
    color: var(--error-color, #f38ba8);
  }

  .update-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary,
  .btn-secondary {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }

  .btn-primary {
    background: var(--accent-color, #89b4fa);
    color: var(--bg-primary, #1e1e2e);
  }

  .btn-primary:hover {
    filter: brightness(1.1);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .btn-secondary:hover {
    background: var(--bg-hover, #45475a);
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--accent-color, #89b4fa);
    cursor: pointer;
    font-size: 14px;
    padding: 8px;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .progress-bar {
    width: 200px;
    height: 6px;
    background: var(--bg-tertiary, #313244);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color, #89b4fa);
    transition: width 0.3s ease;
  }

  .changelog {
    border-top: 1px solid var(--border-color, #313244);
    max-height: 200px;
    overflow-y: auto;
  }

  .changelog-content {
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary, #a6adc8);
  }

  .changelog-content :global(h2),
  .changelog-content :global(h3),
  .changelog-content :global(h4) {
    color: var(--text-primary, #cdd6f4);
    margin: 12px 0 8px 0;
  }

  .changelog-content :global(li) {
    margin-left: 20px;
    list-style-type: disc;
  }

  .changelog-content :global(code) {
    background: var(--bg-tertiary, #313244);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .changelog-content :global(strong) {
    color: var(--text-primary, #cdd6f4);
  }

  /* Responsive adjustments */
  @media (max-width: 600px) {
    .update-content {
      flex-wrap: wrap;
    }

    .update-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .progress-bar {
      flex: 1;
      width: auto;
    }
  }
</style>
