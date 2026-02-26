<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWindow, type Window } from '@tauri-apps/api/window';
  
  export let enabled = true;
  export let snapThreshold = 20;
  export let showSnapPreview = true;
  export let snapZones: SnapZone[] = [];
  export let quickTileShortcuts = true;
  
  const dispatch = createEventDispatcher<{
    snap: { zone: SnapZone; window: WindowState };
    unsnap: { window: WindowState };
    zoneHover: { zone: SnapZone | null };
    settingsChange: { settings: SnapSettings };
    error: { message: string; code: string };
  }>();
  
  type SnapPosition = 
    | 'left-half' | 'right-half' | 'top-half' | 'bottom-half'
    | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    | 'center' | 'maximize' | 'custom';
  
  interface SnapZone {
    id: string;
    name: string;
    position: SnapPosition;
    bounds: { x: number; y: number; width: number; height: number };
    shortcut?: string;
    color?: string;
  }
  
  interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isMinimized: boolean;
    isSnapped: boolean;
    snapPosition?: SnapPosition;
  }
  
  interface SnapSettings {
    enabled: boolean;
    snapThreshold: number;
    showSnapPreview: boolean;
    quickTileShortcuts: boolean;
    snapZones: SnapZone[];
    animations: boolean;
    magneticEdges: boolean;
    rememberLastPosition: boolean;
  }
  
  interface ScreenInfo {
    width: number;
    height: number;
    availableWidth: number;
    availableHeight: number;
    scaleFactor: number;
  }
  
  let currentWindow: Window | null = null;
  let windowState: WindowState = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    isMaximized: false,
    isMinimized: false,
    isSnapped: false
  };
  let screenInfo: ScreenInfo | null = null;
  let preSnapState: WindowState | null = null;
  let hoveredZone: SnapZone | null = null;
  let isDragging = false;
  let showZoneOverlay = false;
  let unlisteners: UnlistenFn[] = [];
  
  const defaultSnapZones: SnapZone[] = [
    { id: 'left-half', name: 'Left Half', position: 'left-half', bounds: { x: 0, y: 0, width: 0.5, height: 1 }, shortcut: 'Super+Left', color: '#3b82f6' },
    { id: 'right-half', name: 'Right Half', position: 'right-half', bounds: { x: 0.5, y: 0, width: 0.5, height: 1 }, shortcut: 'Super+Right', color: '#3b82f6' },
    { id: 'top-half', name: 'Top Half', position: 'top-half', bounds: { x: 0, y: 0, width: 1, height: 0.5 }, shortcut: 'Super+Up', color: '#10b981' },
    { id: 'bottom-half', name: 'Bottom Half', position: 'bottom-half', bounds: { x: 0, y: 0.5, width: 1, height: 0.5 }, shortcut: 'Super+Down', color: '#10b981' },
    { id: 'top-left', name: 'Top Left', position: 'top-left', bounds: { x: 0, y: 0, width: 0.5, height: 0.5 }, shortcut: 'Super+Home', color: '#f59e0b' },
    { id: 'top-right', name: 'Top Right', position: 'top-right', bounds: { x: 0.5, y: 0, width: 0.5, height: 0.5 }, shortcut: 'Super+PageUp', color: '#f59e0b' },
    { id: 'bottom-left', name: 'Bottom Left', position: 'bottom-left', bounds: { x: 0, y: 0.5, width: 0.5, height: 0.5 }, shortcut: 'Super+End', color: '#f59e0b' },
    { id: 'bottom-right', name: 'Bottom Right', position: 'bottom-right', bounds: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, shortcut: 'Super+PageDown', color: '#f59e0b' },
    { id: 'maximize', name: 'Maximize', position: 'maximize', bounds: { x: 0, y: 0, width: 1, height: 1 }, shortcut: 'Super+M', color: '#8b5cf6' },
    { id: 'center', name: 'Center', position: 'center', bounds: { x: 0.15, y: 0.1, width: 0.7, height: 0.8 }, shortcut: 'Super+C', color: '#ec4899' }
  ];
  
  onMount(async () => {
    try {
      currentWindow = getCurrentWindow();
      await loadSettings();
      await loadScreenInfo();
      await updateWindowState();
      await setupEventListeners();
      
      if (snapZones.length === 0) {
        snapZones = defaultSnapZones;
      }
    } catch (err) {
      dispatch('error', { message: `Failed to initialize: ${err}`, code: 'INIT_ERROR' });
    }
  });
  
  onDestroy(() => {
    unlisteners.forEach(unlisten => unlisten());
  });
  
  async function loadSettings(): Promise<void> {
    try {
      const settings = await invoke<SnapSettings>('get_snap_settings');
      enabled = settings.enabled;
      snapThreshold = settings.snapThreshold;
      showSnapPreview = settings.showSnapPreview;
      quickTileShortcuts = settings.quickTileShortcuts;
      if (settings.snapZones.length > 0) {
        snapZones = settings.snapZones;
      }
    } catch {
      // Use defaults if settings not available
    }
  }
  
  async function loadScreenInfo(): Promise<void> {
    try {
      screenInfo = await invoke<ScreenInfo>('get_screen_info');
    } catch {
      // Fallback to window dimensions
      screenInfo = {
        width: window.screen.width,
        height: window.screen.height,
        availableWidth: window.screen.availWidth,
        availableHeight: window.screen.availHeight,
        scaleFactor: window.devicePixelRatio
      };
    }
  }
  
  async function updateWindowState(): Promise<void> {
    if (!currentWindow) return;
    
    try {
      const [position, size, isMaximized, isMinimized] = await Promise.all([
        currentWindow.outerPosition(),
        currentWindow.outerSize(),
        currentWindow.isMaximized(),
        currentWindow.isMinimized()
      ]);
      
      windowState = {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        isMaximized,
        isMinimized,
        isSnapped: windowState.isSnapped,
        snapPosition: windowState.snapPosition
      };
    } catch (err) {
      console.error('Failed to update window state:', err);
    }
  }
  
  async function setupEventListeners(): Promise<void> {
    const moveUnlisten = await listen('tauri://move', async () => {
      await updateWindowState();
      if (isDragging && enabled) {
        checkSnapZones();
      }
    });
    unlisteners.push(moveUnlisten);
    
    const resizeUnlisten = await listen('tauri://resize', async () => {
      await updateWindowState();
    });
    unlisteners.push(resizeUnlisten);
    
    const dragStartUnlisten = await listen('window-drag-start', () => {
      isDragging = true;
      if (windowState.isSnapped) {
        preSnapState = { ...windowState };
      }
      if (enabled && showSnapPreview) {
        showZoneOverlay = true;
      }
    });
    unlisteners.push(dragStartUnlisten);
    
    const dragEndUnlisten = await listen('window-drag-end', async () => {
      isDragging = false;
      showZoneOverlay = false;
      if (hoveredZone && enabled) {
        await snapToZone(hoveredZone);
      }
      hoveredZone = null;
    });
    unlisteners.push(dragEndUnlisten);
    
    if (quickTileShortcuts) {
      const shortcutUnlisten = await listen<{ shortcut: string }>('global-shortcut', async (event) => {
        const zone = snapZones.find(z => z.shortcut === event.payload.shortcut);
        if (zone) {
          await snapToZone(zone);
        }
      });
      unlisteners.push(shortcutUnlisten);
    }
  }
  
  function checkSnapZones(): void {
    if (!screenInfo || !enabled) return;
    
    const cursorX = windowState.x;
    const cursorY = windowState.y;
    
    // Check edges for snap zones
    let newHoveredZone: SnapZone | null = null;
    
    // Left edge
    if (cursorX <= snapThreshold) {
      if (cursorY <= snapThreshold) {
        newHoveredZone = snapZones.find(z => z.position === 'top-left') || null;
      } else if (cursorY >= screenInfo.availableHeight - snapThreshold) {
        newHoveredZone = snapZones.find(z => z.position === 'bottom-left') || null;
      } else {
        newHoveredZone = snapZones.find(z => z.position === 'left-half') || null;
      }
    }
    // Right edge
    else if (cursorX >= screenInfo.availableWidth - snapThreshold) {
      if (cursorY <= snapThreshold) {
        newHoveredZone = snapZones.find(z => z.position === 'top-right') || null;
      } else if (cursorY >= screenInfo.availableHeight - snapThreshold) {
        newHoveredZone = snapZones.find(z => z.position === 'bottom-right') || null;
      } else {
        newHoveredZone = snapZones.find(z => z.position === 'right-half') || null;
      }
    }
    // Top edge
    else if (cursorY <= snapThreshold) {
      newHoveredZone = snapZones.find(z => z.position === 'maximize') || null;
    }
    // Bottom edge
    else if (cursorY >= screenInfo.availableHeight - snapThreshold) {
      newHoveredZone = snapZones.find(z => z.position === 'bottom-half') || null;
    }
    
    if (newHoveredZone !== hoveredZone) {
      hoveredZone = newHoveredZone;
      dispatch('zoneHover', { zone: hoveredZone });
    }
  }
  
  async function snapToZone(zone: SnapZone): Promise<void> {
    if (!currentWindow || !screenInfo) return;
    
    try {
      // Save pre-snap state for restoration
      if (!windowState.isSnapped) {
        preSnapState = { ...windowState };
      }
      
      const targetBounds = calculateAbsoluteBounds(zone.bounds);
      
      // Handle maximize specially
      if (zone.position === 'maximize') {
        await currentWindow.maximize();
      } else {
        await currentWindow.unmaximize();
        await currentWindow.setPosition({ type: 'Physical', x: targetBounds.x, y: targetBounds.y });
        await currentWindow.setSize({ type: 'Physical', width: targetBounds.width, height: targetBounds.height });
      }
      
      windowState.isSnapped = true;
      windowState.snapPosition = zone.position;
      
      await updateWindowState();
      dispatch('snap', { zone, window: windowState });
      
      // Save snap state
      await invoke('save_snap_state', {
        windowId: currentWindow.label,
        snapPosition: zone.position,
        preSnapState
      });
    } catch (err) {
      dispatch('error', { message: `Failed to snap window: ${err}`, code: 'SNAP_ERROR' });
    }
  }
  
  function calculateAbsoluteBounds(relativeBounds: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
    if (!screenInfo) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }
    
    return {
      x: Math.round(relativeBounds.x * screenInfo.availableWidth),
      y: Math.round(relativeBounds.y * screenInfo.availableHeight),
      width: Math.round(relativeBounds.width * screenInfo.availableWidth),
      height: Math.round(relativeBounds.height * screenInfo.availableHeight)
    };
  }
  
  export async function unsnap(): Promise<void> {
    if (!currentWindow || !preSnapState) return;
    
    try {
      if (windowState.isMaximized) {
        await currentWindow.unmaximize();
      }
      
      await currentWindow.setPosition({ type: 'Physical', x: preSnapState.x, y: preSnapState.y });
      await currentWindow.setSize({ type: 'Physical', width: preSnapState.width, height: preSnapState.height });
      
      windowState.isSnapped = false;
      windowState.snapPosition = undefined;
      
      dispatch('unsnap', { window: windowState });
      
      await invoke('clear_snap_state', { windowId: currentWindow.label });
      preSnapState = null;
    } catch (err) {
      dispatch('error', { message: `Failed to unsnap window: ${err}`, code: 'UNSNAP_ERROR' });
    }
  }
  
  export async function snapTo(position: SnapPosition): Promise<void> {
    const zone = snapZones.find(z => z.position === position);
    if (zone) {
      await snapToZone(zone);
    }
  }
  
  export async function cycleSnapPosition(direction: 'next' | 'prev'): Promise<void> {
    const positions: SnapPosition[] = ['left-half', 'right-half', 'top-half', 'bottom-half', 'maximize', 'center'];
    const currentIndex = windowState.snapPosition 
      ? positions.indexOf(windowState.snapPosition)
      : -1;
    
    let newIndex: number;
    if (direction === 'next') {
      newIndex = currentIndex < positions.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : positions.length - 1;
    }
    
    await snapTo(positions[newIndex]);
  }
  
  export async function saveSettings(): Promise<void> {
    const settings: SnapSettings = {
      enabled,
      snapThreshold,
      showSnapPreview,
      quickTileShortcuts,
      snapZones,
      animations: true,
      magneticEdges: true,
      rememberLastPosition: true
    };
    
    try {
      await invoke('save_snap_settings', { settings });
      dispatch('settingsChange', { settings });
    } catch (err) {
      dispatch('error', { message: `Failed to save settings: ${err}`, code: 'SETTINGS_ERROR' });
    }
  }
  
  export function addCustomZone(zone: Omit<SnapZone, 'id'>): void {
    const newZone: SnapZone = {
      ...zone,
      id: `custom-${Date.now()}`
    };
    snapZones = [...snapZones, newZone];
  }
  
  export function removeCustomZone(zoneId: string): void {
    if (zoneId.startsWith('custom-')) {
      snapZones = snapZones.filter(z => z.id !== zoneId);
    }
  }
  
  export function getWindowState(): WindowState {
    return { ...windowState };
  }
  
  export function getSnapZones(): SnapZone[] {
    return [...snapZones];
  }
</script>

{#if showZoneOverlay && showSnapPreview}
  <div class="snap-zone-overlay">
    {#each snapZones as zone}
      {@const bounds = calculateAbsoluteBounds(zone.bounds)}
      <div
        class="snap-zone"
        class:hovered={hoveredZone?.id === zone.id}
        style="
          left: {bounds.x}px;
          top: {bounds.y}px;
          width: {bounds.width}px;
          height: {bounds.height}px;
          --zone-color: {zone.color || '#3b82f6'};
        "
      >
        <span class="zone-label">{zone.name}</span>
      </div>
    {/each}
  </div>
{/if}

<div class="snap-indicator" class:visible={windowState.isSnapped}>
  {#if windowState.isSnapped && windowState.snapPosition}
    <span class="snap-badge">
      📌 {snapZones.find(z => z.position === windowState.snapPosition)?.name || windowState.snapPosition}
    </span>
  {/if}
</div>

<style>
  .snap-zone-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 9999;
  }
  
  .snap-zone {
    position: absolute;
    border: 2px dashed var(--zone-color);
    background: color-mix(in srgb, var(--zone-color) 10%, transparent);
    border-radius: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .snap-zone.hovered {
    border-style: solid;
    border-width: 3px;
    background: color-mix(in srgb, var(--zone-color) 25%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--zone-color) 40%, transparent);
  }
  
  .zone-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--zone-color);
    background: rgba(0, 0, 0, 0.7);
    padding: 4px 12px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .snap-zone.hovered .zone-label {
    opacity: 1;
  }
  
  .snap-indicator {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .snap-indicator.visible {
    opacity: 1;
  }
  
  .snap-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 12px;
    border-radius: 4px;
    backdrop-filter: blur(4px);
  }
</style>
