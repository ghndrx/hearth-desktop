<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, get } from 'svelte/store';

  // Types
  interface Monitor {
    id: string;
    name: string;
    width: number;
    height: number;
    x: number;
    y: number;
    scaleFactor: number;
    isPrimary: boolean;
    isActive: boolean;
    refreshRate?: number;
    colorDepth?: number;
  }

  interface WindowPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    monitorId: string;
  }

  interface MonitorPreference {
    monitorId: string;
    windowBehavior: 'remember' | 'center' | 'primary';
    lastPosition?: WindowPosition;
  }

  // Props
  export let autoDetect: boolean = true;
  export let rememberWindowPosition: boolean = true;
  export let moveWindowOnMonitorChange: boolean = true;
  export let preferredMonitor: string | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    monitorsChanged: { monitors: Monitor[]; added: Monitor[]; removed: Monitor[] };
    primaryChanged: { monitor: Monitor };
    windowMoved: { position: WindowPosition; monitor: Monitor };
    error: { message: string; code: string };
  }>();

  // Stores
  const monitors = writable<Monitor[]>([]);
  const primaryMonitor = derived(monitors, $monitors => 
    $monitors.find(m => m.isPrimary) || $monitors[0]
  );
  const currentMonitor = writable<Monitor | null>(null);
  const windowPosition = writable<WindowPosition | null>(null);
  const preferences = writable<Map<string, MonitorPreference>>(new Map());
  const isDetecting = writable(false);
  const lastError = writable<string | null>(null);

  // State
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let previousMonitorIds: Set<string> = new Set();
  let isTauri = false;
  let tauriWindow: any = null;
  let tauriMonitor: any = null;

  // Initialize Tauri APIs
  async function initTauri(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const tauri = (window as any).__TAURI__;
        tauriWindow = tauri.window;
        tauriMonitor = tauri.monitor || tauri.window;
        isTauri = true;
        return true;
      }
    } catch (err) {
      console.warn('Tauri API not available:', err);
    }
    return false;
  }

  // Get all available monitors
  async function detectMonitors(): Promise<Monitor[]> {
    isDetecting.set(true);
    lastError.set(null);
    
    try {
      if (isTauri && tauriMonitor) {
        // Use Tauri's monitor API
        const availableMonitors = await tauriMonitor.availableMonitors?.() || [];
        const primary = await tauriMonitor.primaryMonitor?.();
        
        const detectedMonitors: Monitor[] = availableMonitors.map((m: any, index: number) => ({
          id: m.name || `monitor-${index}`,
          name: m.name || `Display ${index + 1}`,
          width: m.size?.width || m.width || 1920,
          height: m.size?.height || m.height || 1080,
          x: m.position?.x || 0,
          y: m.position?.y || 0,
          scaleFactor: m.scaleFactor || 1,
          isPrimary: primary ? (m.name === primary.name) : index === 0,
          isActive: true,
          refreshRate: m.refreshRate,
          colorDepth: m.colorDepth
        }));

        return detectedMonitors;
      } else {
        // Fallback to Web API
        return detectMonitorsWeb();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to detect monitors';
      lastError.set(message);
      dispatch('error', { message, code: 'DETECT_FAILED' });
      return [];
    } finally {
      isDetecting.set(false);
    }
  }

  // Web API fallback for monitor detection
  function detectMonitorsWeb(): Monitor[] {
    const detected: Monitor[] = [];
    
    // Primary screen info from window.screen
    if (typeof window !== 'undefined' && window.screen) {
      detected.push({
        id: 'primary',
        name: 'Primary Display',
        width: window.screen.width,
        height: window.screen.height,
        x: window.screenX || 0,
        y: window.screenY || 0,
        scaleFactor: window.devicePixelRatio || 1,
        isPrimary: true,
        isActive: true,
        colorDepth: window.screen.colorDepth
      });
    }

    // Attempt to use Screen Enumeration API if available
    if ('getScreenDetails' in window) {
      // Note: This requires user permission
      (window as any).getScreenDetails?.().then((details: any) => {
        if (details?.screens) {
          const webMonitors: Monitor[] = details.screens.map((screen: any, i: number) => ({
            id: screen.label || `screen-${i}`,
            name: screen.label || `Display ${i + 1}`,
            width: screen.width,
            height: screen.height,
            x: screen.left || 0,
            y: screen.top || 0,
            scaleFactor: screen.devicePixelRatio || 1,
            isPrimary: screen.isPrimary || false,
            isActive: true,
            colorDepth: screen.colorDepth
          }));
          monitors.set(webMonitors);
        }
      }).catch(() => {
        // Permission denied or API not available
      });
    }

    return detected;
  }

  // Get current window position
  async function getWindowPosition(): Promise<WindowPosition | null> {
    try {
      if (isTauri && tauriWindow) {
        const appWindow = tauriWindow.getCurrentWindow?.() || tauriWindow.appWindow;
        if (appWindow) {
          const pos = await appWindow.outerPosition();
          const size = await appWindow.outerSize();
          const monitor = await appWindow.currentMonitor?.();
          
          return {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            monitorId: monitor?.name || 'primary'
          };
        }
      } else if (typeof window !== 'undefined') {
        return {
          x: window.screenX,
          y: window.screenY,
          width: window.outerWidth,
          height: window.outerHeight,
          monitorId: 'primary'
        };
      }
    } catch (err) {
      console.warn('Failed to get window position:', err);
    }
    return null;
  }

  // Move window to specific monitor
  async function moveToMonitor(monitorId: string, center: boolean = true): Promise<boolean> {
    try {
      const allMonitors = get(monitors);
      const target = allMonitors.find(m => m.id === monitorId);
      
      if (!target) {
        throw new Error(`Monitor ${monitorId} not found`);
      }

      if (isTauri && tauriWindow) {
        const appWindow = tauriWindow.getCurrentWindow?.() || tauriWindow.appWindow;
        if (appWindow) {
          const size = await appWindow.outerSize();
          
          let newX: number, newY: number;
          if (center) {
            newX = target.x + Math.floor((target.width - size.width) / 2);
            newY = target.y + Math.floor((target.height - size.height) / 2);
          } else {
            newX = target.x + 50;
            newY = target.y + 50;
          }

          await appWindow.setPosition({ type: 'Physical', x: newX, y: newY });
          
          const newPosition: WindowPosition = {
            x: newX,
            y: newY,
            width: size.width,
            height: size.height,
            monitorId: target.id
          };
          
          windowPosition.set(newPosition);
          currentMonitor.set(target);
          dispatch('windowMoved', { position: newPosition, monitor: target });
          
          return true;
        }
      }
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move window';
      lastError.set(message);
      dispatch('error', { message, code: 'MOVE_FAILED' });
      return false;
    }
  }

  // Move window to primary monitor
  async function moveToPrimary(center: boolean = true): Promise<boolean> {
    const primary = get(primaryMonitor);
    if (primary) {
      return moveToMonitor(primary.id, center);
    }
    return false;
  }

  // Save window position for current monitor
  async function saveWindowPosition(): Promise<void> {
    const position = await getWindowPosition();
    if (position) {
      windowPosition.set(position);
      
      if (rememberWindowPosition) {
        const prefs = get(preferences);
        prefs.set(position.monitorId, {
          monitorId: position.monitorId,
          windowBehavior: 'remember',
          lastPosition: position
        });
        preferences.set(prefs);
        
        // Persist to storage
        try {
          localStorage.setItem('hearth-monitor-prefs', JSON.stringify(Array.from(prefs.entries())));
        } catch {}
      }
    }
  }

  // Restore window position for monitor
  async function restoreWindowPosition(monitorId: string): Promise<boolean> {
    const prefs = get(preferences);
    const pref = prefs.get(monitorId);
    
    if (pref?.lastPosition && isTauri && tauriWindow) {
      try {
        const appWindow = tauriWindow.getCurrentWindow?.() || tauriWindow.appWindow;
        if (appWindow) {
          await appWindow.setPosition({
            type: 'Physical',
            x: pref.lastPosition.x,
            y: pref.lastPosition.y
          });
          await appWindow.setSize({
            type: 'Physical',
            width: pref.lastPosition.width,
            height: pref.lastPosition.height
          });
          return true;
        }
      } catch (err) {
        console.warn('Failed to restore position:', err);
      }
    }
    return false;
  }

  // Handle monitor changes
  function handleMonitorChanges(newMonitors: Monitor[]): void {
    const currentIds = new Set(newMonitors.map(m => m.id));
    const added = newMonitors.filter(m => !previousMonitorIds.has(m.id));
    const removed = Array.from(previousMonitorIds)
      .filter(id => !currentIds.has(id))
      .map(id => ({ id, name: id, width: 0, height: 0, x: 0, y: 0, scaleFactor: 1, isPrimary: false, isActive: false }));

    if (added.length > 0 || removed.length > 0) {
      dispatch('monitorsChanged', { monitors: newMonitors, added, removed });
      
      // Check if primary changed
      const newPrimary = newMonitors.find(m => m.isPrimary);
      const oldPrimary = get(primaryMonitor);
      if (newPrimary && oldPrimary && newPrimary.id !== oldPrimary.id) {
        dispatch('primaryChanged', { monitor: newPrimary });
      }

      // Handle window if current monitor was removed
      if (moveWindowOnMonitorChange) {
        const current = get(currentMonitor);
        if (current && removed.some(m => m.id === current.id)) {
          moveToPrimary(true);
        }
      }
    }

    previousMonitorIds = currentIds;
  }

  // Poll for monitor changes
  async function pollMonitors(): Promise<void> {
    const newMonitors = await detectMonitors();
    if (newMonitors.length > 0) {
      handleMonitorChanges(newMonitors);
      monitors.set(newMonitors);
      
      // Update current monitor
      const position = await getWindowPosition();
      if (position) {
        const current = newMonitors.find(m => m.id === position.monitorId);
        if (current) {
          currentMonitor.set(current);
        }
      }
    }
  }

  // Load saved preferences
  function loadPreferences(): void {
    try {
      const saved = localStorage.getItem('hearth-monitor-prefs');
      if (saved) {
        const entries = JSON.parse(saved);
        preferences.set(new Map(entries));
      }
    } catch {}
  }

  // Start monitoring
  function startMonitoring(intervalMs: number = 2000): void {
    stopMonitoring();
    pollMonitors();
    pollInterval = setInterval(pollMonitors, intervalMs);
  }

  // Stop monitoring
  function stopMonitoring(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Get monitor at specific coordinates
  function getMonitorAtPoint(x: number, y: number): Monitor | null {
    const allMonitors = get(monitors);
    return allMonitors.find(m => 
      x >= m.x && x < m.x + m.width &&
      y >= m.y && y < m.y + m.height
    ) || null;
  }

  // Get total desktop bounds (spanning all monitors)
  function getDesktopBounds(): { x: number; y: number; width: number; height: number } {
    const allMonitors = get(monitors);
    if (allMonitors.length === 0) {
      return { x: 0, y: 0, width: 1920, height: 1080 };
    }

    const minX = Math.min(...allMonitors.map(m => m.x));
    const minY = Math.min(...allMonitors.map(m => m.y));
    const maxX = Math.max(...allMonitors.map(m => m.x + m.width));
    const maxY = Math.max(...allMonitors.map(m => m.y + m.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  // Lifecycle
  onMount(async () => {
    await initTauri();
    loadPreferences();
    
    if (autoDetect) {
      await pollMonitors();
      startMonitoring();
    }

    // Handle preferred monitor
    if (preferredMonitor) {
      await moveToMonitor(preferredMonitor, true);
    }

    // Listen for visibility changes to save position
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          saveWindowPosition();
        }
      });
    }
  });

  onDestroy(() => {
    stopMonitoring();
    saveWindowPosition();
  });

  // Expose API
  export const api = {
    detectMonitors,
    moveToMonitor,
    moveToPrimary,
    saveWindowPosition,
    restoreWindowPosition,
    startMonitoring,
    stopMonitoring,
    getMonitorAtPoint,
    getDesktopBounds,
    getWindowPosition
  };
</script>

<div class="multi-monitor-manager" data-testid="multi-monitor-manager">
  {#if $isDetecting}
    <div class="detecting-indicator" aria-live="polite">
      <span class="spinner"></span>
      <span>Detecting monitors...</span>
    </div>
  {/if}

  {#if $lastError}
    <div class="error-message" role="alert">
      <span class="error-icon">⚠️</span>
      <span>{$lastError}</span>
    </div>
  {/if}

  <div class="monitors-list" role="list" aria-label="Connected monitors">
    {#each $monitors as monitor (monitor.id)}
      <button 
        type="button"
        class="monitor-item"
        class:primary={monitor.isPrimary}
        class:current={$currentMonitor?.id === monitor.id}
        on:click={() => moveToMonitor(monitor.id)}
      >
        <div class="monitor-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          {#if monitor.isPrimary}
            <span class="primary-badge" title="Primary display">★</span>
          {/if}
        </div>
        <div class="monitor-info">
          <span class="monitor-name">{monitor.name}</span>
          <span class="monitor-resolution">
            {monitor.width}×{monitor.height}
            {#if monitor.scaleFactor !== 1}
              @ {Math.round(monitor.scaleFactor * 100)}%
            {/if}
          </span>
        </div>
        {#if $currentMonitor?.id === monitor.id}
          <span class="current-badge" title="Current window location">●</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if $monitors.length === 0 && !$isDetecting}
    <div class="no-monitors">
      <span>No monitors detected</span>
      <button on:click={() => pollMonitors()}>Refresh</button>
    </div>
  {/if}

  <slot 
    monitors={$monitors} 
    currentMonitor={$currentMonitor} 
    primaryMonitor={$primaryMonitor}
    windowPosition={$windowPosition}
    {api}
  />
</div>

<style>
  .multi-monitor-manager {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    font-family: var(--font-sans, system-ui, sans-serif);
  }

  .detecting-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    color: var(--text-muted, #949ba4);
    font-size: 0.875rem;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: var(--accent, #5865f2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--error-bg, rgba(237, 66, 69, 0.1));
    border: 1px solid var(--error, #ed4245);
    border-radius: 4px;
    color: var(--error, #ed4245);
    font-size: 0.875rem;
  }

  .monitors-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .monitor-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    width: 100%;
    background: var(--bg-tertiary, #232428);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s ease, transform 0.1s ease;
    outline: none;
    text-align: left;
  }

  .monitor-item:hover {
    background: var(--bg-modifier-hover, #393c41);
  }

  .monitor-item:focus-visible {
    box-shadow: 0 0 0 2px var(--accent, #5865f2);
  }

  .monitor-item:active {
    transform: scale(0.98);
  }

  .monitor-item.current {
    border-left: 3px solid var(--accent, #5865f2);
    padding-left: calc(0.75rem - 3px);
  }

  .monitor-item.primary .monitor-icon {
    color: var(--accent, #5865f2);
  }

  .monitor-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted, #949ba4);
  }

  .primary-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    font-size: 0.625rem;
    color: var(--warning, #faa61a);
  }

  .monitor-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .monitor-name {
    color: var(--text-primary, #f2f3f5);
    font-size: 0.9375rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .monitor-resolution {
    color: var(--text-muted, #949ba4);
    font-size: 0.75rem;
  }

  .current-badge {
    color: var(--success, #3ba55c);
    font-size: 0.75rem;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .no-monitors {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    color: var(--text-muted, #949ba4);
    text-align: center;
  }

  .no-monitors button {
    padding: 0.5rem 1rem;
    background: var(--accent, #5865f2);
    border: none;
    border-radius: 4px;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .no-monitors button:hover {
    background: var(--accent-hover, #4752c4);
  }
</style>
