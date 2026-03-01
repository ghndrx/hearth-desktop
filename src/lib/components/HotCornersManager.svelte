<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  type ScreenCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  
  type HotCornerAction =
    | 'none'
    | 'show-notification-center'
    | 'toggle-focus-mode'
    | 'show-quick-actions'
    | 'lock-screen'
    | 'show-desktop'
    | 'launch-quick-note'
    | 'toggle-mute'
    | 'start-screen-recording'
    | 'show-command-palette'
    | 'toggle-do-not-disturb'
    | 'show-calendar'
    | { custom: string };

  interface HotCornerConfig {
    corner: ScreenCorner;
    action: HotCornerAction;
    activation_delay_ms: number;
    enabled: boolean;
    modifier_required: string | null;
  }

  interface HotCornersSettings {
    enabled: boolean;
    corner_size_px: number;
    corners: Record<string, HotCornerConfig>;
    show_visual_feedback: boolean;
    sound_feedback: boolean;
    disabled_in_fullscreen: boolean;
  }

  interface AvailableAction {
    id: string;
    label: string;
  }

  const dispatch = createEventDispatcher<{
    action: { corner: ScreenCorner; action: HotCornerAction };
    settingsChanged: HotCornersSettings;
  }>();

  // Props
  export let showSettings = false;

  // State
  let settings: HotCornersSettings = {
    enabled: true,
    corner_size_px: 5,
    corners: {},
    show_visual_feedback: true,
    sound_feedback: false,
    disabled_in_fullscreen: true
  };
  
  let availableActions: AvailableAction[] = [];
  let activeCorner: ScreenCorner | null = null;
  let cornerProgress: Record<ScreenCorner, number> = {
    'top-left': 0,
    'top-right': 0,
    'bottom-left': 0,
    'bottom-right': 0
  };
  let isFullscreen = false;
  let trackingInterval: ReturnType<typeof setInterval> | null = null;
  let unlistenMouseMove: UnlistenFn | null = null;

  const cornerLabels: Record<ScreenCorner, string> = {
    'top-left': 'Top Left',
    'top-right': 'Top Right',
    'bottom-left': 'Bottom Left',
    'bottom-right': 'Bottom Right'
  };

  const cornerIcons: Record<ScreenCorner, string> = {
    'top-left': '↖️',
    'top-right': '↗️',
    'bottom-left': '↙️',
    'bottom-right': '↘️'
  };

  onMount(async () => {
    await loadSettings();
    await loadAvailableActions();
    await updateScreenDimensions();
    startTracking();
    
    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  });

  onDestroy(() => {
    stopTracking();
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    
    if (unlistenMouseMove) {
      unlistenMouseMove();
    }
  });

  async function loadSettings() {
    try {
      settings = await invoke<HotCornersSettings>('hotcorners_get_settings');
    } catch (error) {
      console.error('Failed to load hot corners settings:', error);
    }
  }

  async function loadAvailableActions() {
    try {
      const actions = await invoke<[string, string][]>('hotcorners_get_available_actions');
      availableActions = actions.map(([id, label]) => ({ id, label }));
    } catch (error) {
      console.error('Failed to load available actions:', error);
      availableActions = [
        { id: 'none', label: 'No Action' },
        { id: 'show-notification-center', label: 'Show Notification Center' },
        { id: 'toggle-focus-mode', label: 'Toggle Focus Mode' },
        { id: 'show-quick-actions', label: 'Show Quick Actions' },
        { id: 'lock-screen', label: 'Lock Screen' },
        { id: 'show-desktop', label: 'Show Desktop' },
        { id: 'launch-quick-note', label: 'Launch Quick Note' },
        { id: 'toggle-mute', label: 'Toggle Mute' },
        { id: 'start-screen-recording', label: 'Start Screen Recording' },
        { id: 'show-command-palette', label: 'Show Command Palette' },
        { id: 'toggle-do-not-disturb', label: 'Toggle Do Not Disturb' },
        { id: 'show-calendar', label: 'Show Calendar' }
      ];
    }
  }

  async function updateScreenDimensions() {
    try {
      await invoke('hotcorners_set_screen_dimensions', {
        width: window.screen.width,
        height: window.screen.height
      });
    } catch (error) {
      console.error('Failed to update screen dimensions:', error);
    }
  }

  function handleResize() {
    updateScreenDimensions();
  }

  function handleFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
    if (isFullscreen && settings.disabled_in_fullscreen) {
      resetAllProgress();
    }
  }

  function startTracking() {
    if (trackingInterval) return;

    // Poll cursor position relative to screen
    trackingInterval = setInterval(async () => {
      if (!settings.enabled) return;
      if (isFullscreen && settings.disabled_in_fullscreen) return;

      try {
        // Use mouse position from the window
        const x = (window as any).__lastMouseX ?? -1;
        const y = (window as any).__lastMouseY ?? -1;
        
        if (x >= 0 && y >= 0) {
          const action = await invoke<HotCornerAction | null>('hotcorners_check_position', { x, y });
          
          if (action && action !== 'none') {
            const corner = detectCornerFromPosition(x, y);
            if (corner) {
              handleCornerAction(corner, action);
            }
          }
        }
      } catch (error) {
        // Silent fail for tracking
      }
    }, 50);

    // Track mouse position
    document.addEventListener('mousemove', trackMousePosition);
  }

  function trackMousePosition(event: MouseEvent) {
    (window as any).__lastMouseX = event.screenX;
    (window as any).__lastMouseY = event.screenY;

    // Update visual feedback
    if (settings.show_visual_feedback) {
      const corner = detectCornerFromPosition(event.screenX, event.screenY);
      updateCornerFeedback(corner);
    }
  }

  function detectCornerFromPosition(x: number, y: number): ScreenCorner | null {
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const size = settings.corner_size_px;

    const inLeft = x < size;
    const inRight = x >= screenWidth - size;
    const inTop = y < size;
    const inBottom = y >= screenHeight - size;

    if (inLeft && inTop) return 'top-left';
    if (inRight && inTop) return 'top-right';
    if (inLeft && inBottom) return 'bottom-left';
    if (inRight && inBottom) return 'bottom-right';
    
    return null;
  }

  function updateCornerFeedback(corner: ScreenCorner | null) {
    if (corner !== activeCorner) {
      resetAllProgress();
      activeCorner = corner;
    }

    if (corner && settings.corners[corner]?.enabled) {
      const config = settings.corners[corner];
      const maxDelay = config.activation_delay_ms;
      
      cornerProgress[corner] = Math.min(100, cornerProgress[corner] + (50 / maxDelay) * 100);
    }
  }

  function resetAllProgress() {
    cornerProgress = {
      'top-left': 0,
      'top-right': 0,
      'bottom-left': 0,
      'bottom-right': 0
    };
    activeCorner = null;
  }

  function stopTracking() {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    document.removeEventListener('mousemove', trackMousePosition);
    resetAllProgress();
  }

  async function handleCornerAction(corner: ScreenCorner, action: HotCornerAction) {
    if (settings.sound_feedback) {
      playFeedbackSound();
    }

    resetAllProgress();
    dispatch('action', { corner, action });
  }

  function playFeedbackSound() {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch {
      // Audio not available
    }
  }

  async function updateSettings() {
    try {
      await invoke('hotcorners_update_settings', { settings });
      dispatch('settingsChanged', settings);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }

  async function setCornerAction(corner: ScreenCorner, actionId: string) {
    try {
      const action: HotCornerAction = actionId as HotCornerAction;
      await invoke('hotcorners_set_corner_action', { corner, action });
      
      if (settings.corners[corner]) {
        settings.corners[corner].action = action;
      }
      
      dispatch('settingsChanged', settings);
    } catch (error) {
      console.error('Failed to set corner action:', error);
    }
  }

  async function toggleCornerEnabled(corner: ScreenCorner) {
    const newEnabled = !settings.corners[corner]?.enabled;
    
    try {
      await invoke('hotcorners_set_corner_enabled', { corner, enabled: newEnabled });
      
      if (settings.corners[corner]) {
        settings.corners[corner].enabled = newEnabled;
      }
      
      dispatch('settingsChanged', settings);
    } catch (error) {
      console.error('Failed to toggle corner:', error);
    }
  }

  function getActionLabel(action: HotCornerAction): string {
    if (typeof action === 'object' && 'custom' in action) {
      return `Custom: ${action.custom}`;
    }
    
    const found = availableActions.find(a => a.id === action);
    return found?.label ?? String(action);
  }

  function getActionId(action: HotCornerAction): string {
    if (typeof action === 'object' && 'custom' in action) {
      return `custom:${action.custom}`;
    }
    return action;
  }

  $: corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as ScreenCorner[];
</script>

<!-- Visual Corner Indicators (when enabled) -->
{#if settings.enabled && settings.show_visual_feedback}
  {#each corners as corner}
    {#if settings.corners[corner]?.enabled && cornerProgress[corner] > 0}
      <div
        class="corner-indicator {corner}"
        style="--progress: {cornerProgress[corner]}%"
      >
        <div class="progress-arc"></div>
        <span class="corner-icon">{cornerIcons[corner]}</span>
      </div>
    {/if}
  {/each}
{/if}

<!-- Settings Panel -->
{#if showSettings}
  <div class="hot-corners-settings">
    <div class="settings-header">
      <h3>🔲 Hot Corners</h3>
      <label class="toggle-switch">
        <input
          type="checkbox"
          bind:checked={settings.enabled}
          on:change={updateSettings}
        />
        <span class="slider"></span>
      </label>
    </div>

    <p class="settings-description">
      Trigger actions by moving your cursor to screen corners
    </p>

    <!-- Corner Grid Preview -->
    <div class="corner-grid">
      {#each corners as corner}
        {@const config = settings.corners[corner]}
        <div
          class="corner-config {corner}"
          class:enabled={config?.enabled}
          class:disabled={!settings.enabled}
        >
          <div class="corner-header">
            <span class="corner-icon">{cornerIcons[corner]}</span>
            <span class="corner-name">{cornerLabels[corner]}</span>
            <button
              class="toggle-btn"
              class:active={config?.enabled}
              on:click={() => toggleCornerEnabled(corner)}
              disabled={!settings.enabled}
            >
              {config?.enabled ? 'On' : 'Off'}
            </button>
          </div>

          {#if config?.enabled}
            <div class="corner-action">
              <select
                value={getActionId(config.action)}
                on:change={(e) => setCornerAction(corner, e.currentTarget.value)}
                disabled={!settings.enabled}
              >
                {#each availableActions as action}
                  <option value={action.id}>{action.label}</option>
                {/each}
              </select>
            </div>

            <div class="corner-delay">
              <label>
                Delay: {config.activation_delay_ms}ms
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  bind:value={config.activation_delay_ms}
                  on:change={updateSettings}
                  disabled={!settings.enabled}
                />
              </label>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Additional Options -->
    <div class="additional-options">
      <label class="option">
        <input
          type="checkbox"
          bind:checked={settings.show_visual_feedback}
          on:change={updateSettings}
          disabled={!settings.enabled}
        />
        Show visual feedback
      </label>

      <label class="option">
        <input
          type="checkbox"
          bind:checked={settings.sound_feedback}
          on:change={updateSettings}
          disabled={!settings.enabled}
        />
        Play sound on activation
      </label>

      <label class="option">
        <input
          type="checkbox"
          bind:checked={settings.disabled_in_fullscreen}
          on:change={updateSettings}
          disabled={!settings.enabled}
        />
        Disable in fullscreen
      </label>

      <div class="corner-size-option">
        <label>
          Corner activation area: {settings.corner_size_px}px
          <input
            type="range"
            min="3"
            max="20"
            bind:value={settings.corner_size_px}
            on:change={updateSettings}
            disabled={!settings.enabled}
          />
        </label>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Corner Indicators */
  .corner-indicator {
    position: fixed;
    width: 48px;
    height: 48px;
    pointer-events: none;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .corner-indicator.top-left { top: 8px; left: 8px; }
  .corner-indicator.top-right { top: 8px; right: 8px; }
  .corner-indicator.bottom-left { bottom: 8px; left: 8px; }
  .corner-indicator.bottom-right { bottom: 8px; right: 8px; }

  .progress-arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      var(--accent-color, #6366f1) var(--progress),
      transparent var(--progress)
    );
    opacity: 0.8;
    animation: pulse 0.3s ease-out;
  }

  .corner-icon {
    font-size: 20px;
    z-index: 1;
  }

  @keyframes pulse {
    from { transform: scale(0.8); opacity: 0.5; }
    to { transform: scale(1); opacity: 0.8; }
  }

  /* Settings Panel */
  .hot-corners-settings {
    padding: 16px;
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 12px;
    color: var(--text-primary, #cdd6f4);
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .settings-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .settings-description {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--text-secondary, #a6adc8);
  }

  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: var(--bg-tertiary, #313244);
    border-radius: 24px;
    transition: 0.3s;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.3s;
  }

  .toggle-switch input:checked + .slider {
    background-color: var(--accent-color, #6366f1);
  }

  .toggle-switch input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* Corner Grid */
  .corner-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  .corner-config {
    padding: 12px;
    background: var(--bg-tertiary, #313244);
    border-radius: 8px;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .corner-config.enabled {
    border-color: var(--accent-color, #6366f1);
  }

  .corner-config.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .corner-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .corner-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
  }

  .toggle-btn {
    padding: 4px 8px;
    font-size: 11px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: var(--bg-secondary, #1e1e2e);
    color: var(--text-secondary, #a6adc8);
    transition: all 0.2s;
  }

  .toggle-btn.active {
    background: var(--accent-color, #6366f1);
    color: white;
  }

  .corner-action {
    margin-bottom: 8px;
  }

  .corner-action select {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid var(--border-color, #45475a);
    border-radius: 4px;
    background: var(--bg-secondary, #1e1e2e);
    color: var(--text-primary, #cdd6f4);
    cursor: pointer;
  }

  .corner-delay {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .corner-delay label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .corner-delay input[type="range"] {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--bg-secondary, #1e1e2e);
    cursor: pointer;
  }

  /* Additional Options */
  .additional-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #45475a);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  .option input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color, #6366f1);
    cursor: pointer;
  }

  .corner-size-option {
    margin-top: 4px;
  }

  .corner-size-option label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
  }

  .corner-size-option input[type="range"] {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    cursor: pointer;
  }
</style>
