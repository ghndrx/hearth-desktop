<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived } from 'svelte/store';

  const dispatch = createEventDispatcher<{
    timerStart: { duration: number; action: SleepAction };
    timerStop: void;
    timerComplete: { action: SleepAction };
    actionExecuted: { action: SleepAction; success: boolean };
  }>();

  // Types
  type SleepAction = 'pause_media' | 'lock_screen' | 'minimize_app' | 'enable_dnd' | 'quit_app' | 'custom';

  interface SleepTimerPreset {
    id: string;
    name: string;
    duration: number; // minutes
    action: SleepAction;
    customCommand?: string;
  }

  interface TimerState {
    isActive: boolean;
    remainingSeconds: number;
    totalSeconds: number;
    selectedAction: SleepAction;
    customCommand: string;
  }

  // Props
  export let showPresets: boolean = true;
  export let allowCustomDuration: boolean = true;
  export let defaultAction: SleepAction = 'pause_media';
  export let warningThreshold: number = 60; // seconds before completion to show warning
  export let enableSoundWarning: boolean = true;
  export let compact: boolean = false;

  // Stores
  const timerState = writable<TimerState>({
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0,
    selectedAction: defaultAction,
    customCommand: ''
  });

  const presets = writable<SleepTimerPreset[]>([
    { id: 'preset-15', name: '15 minutes', duration: 15, action: 'pause_media' },
    { id: 'preset-30', name: '30 minutes', duration: 30, action: 'pause_media' },
    { id: 'preset-45', name: '45 minutes', duration: 45, action: 'pause_media' },
    { id: 'preset-60', name: '1 hour', duration: 60, action: 'pause_media' },
    { id: 'preset-90', name: '1.5 hours', duration: 90, action: 'pause_media' },
    { id: 'preset-120', name: '2 hours', duration: 120, action: 'pause_media' }
  ]);

  // Derived stores
  const progress = derived(timerState, ($state) => {
    if ($state.totalSeconds === 0) return 0;
    return (($state.totalSeconds - $state.remainingSeconds) / $state.totalSeconds) * 100;
  });

  const isWarning = derived(timerState, ($state) => {
    return $state.isActive && $state.remainingSeconds <= warningThreshold && $state.remainingSeconds > 0;
  });

  const formattedTime = derived(timerState, ($state) => {
    const hours = Math.floor($state.remainingSeconds / 3600);
    const minutes = Math.floor(($state.remainingSeconds % 3600) / 60);
    const seconds = $state.remainingSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  // State
  let intervalId: number | null = null;
  let customMinutes: number = 30;
  let showCustomInput: boolean = false;
  let showActionPicker: boolean = false;

  // Action labels
  const actionLabels: Record<SleepAction, { label: string; icon: string; description: string }> = {
    pause_media: { label: 'Pause Media', icon: '⏸️', description: 'Pause any playing media' },
    lock_screen: { label: 'Lock Screen', icon: '🔒', description: 'Lock the screen' },
    minimize_app: { label: 'Minimize', icon: '➖', description: 'Minimize the application' },
    enable_dnd: { label: 'Do Not Disturb', icon: '🔕', description: 'Enable Do Not Disturb mode' },
    quit_app: { label: 'Quit App', icon: '❌', description: 'Close the application' },
    custom: { label: 'Custom', icon: '⚙️', description: 'Run a custom command' }
  };

  // Functions
  function startTimer(durationMinutes: number, action?: SleepAction) {
    const totalSeconds = durationMinutes * 60;
    const selectedAction = action || $timerState.selectedAction;

    timerState.update((state) => ({
      ...state,
      isActive: true,
      remainingSeconds: totalSeconds,
      totalSeconds: totalSeconds,
      selectedAction
    }));

    dispatch('timerStart', { duration: durationMinutes, action: selectedAction });

    intervalId = window.setInterval(() => {
      timerState.update((state) => {
        const newRemaining = state.remainingSeconds - 1;

        if (newRemaining <= 0) {
          executeAction(state.selectedAction, state.customCommand);
          return { ...state, isActive: false, remainingSeconds: 0 };
        }

        // Play warning sound
        if (enableSoundWarning && newRemaining === warningThreshold) {
          playWarningSound();
        }

        return { ...state, remainingSeconds: newRemaining };
      });
    }, 1000);
  }

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    timerState.update((state) => ({
      ...state,
      isActive: false,
      remainingSeconds: 0
    }));

    dispatch('timerStop');
  }

  function extendTimer(minutes: number) {
    timerState.update((state) => ({
      ...state,
      remainingSeconds: state.remainingSeconds + minutes * 60,
      totalSeconds: state.totalSeconds + minutes * 60
    }));
  }

  async function executeAction(action: SleepAction, customCommand?: string) {
    dispatch('timerComplete', { action });

    let success = true;
    try {
      switch (action) {
        case 'pause_media':
          await invoke('sleep_timer_pause_media');
          break;
        case 'lock_screen':
          await invoke('sleep_timer_lock_screen');
          break;
        case 'minimize_app':
          await invoke('sleep_timer_minimize_app');
          break;
        case 'enable_dnd':
          await invoke('sleep_timer_enable_dnd');
          break;
        case 'quit_app':
          await invoke('sleep_timer_quit_app');
          break;
        case 'custom':
          if (customCommand) {
            await invoke('sleep_timer_run_custom', { command: customCommand });
          }
          break;
      }
    } catch (error) {
      console.error('Sleep timer action failed:', error);
      success = false;
    }

    dispatch('actionExecuted', { action, success });

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function playWarningSound() {
    try {
      invoke('play_notification_sound', { sound: 'timer_warning' }).catch(() => {
        // Fallback: use Web Audio API
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
      });
    } catch {
      // Ignore audio errors
    }
  }

  function handlePresetClick(preset: SleepTimerPreset) {
    if ($timerState.isActive) {
      stopTimer();
    }
    startTimer(preset.duration, preset.action);
  }

  function handleCustomStart() {
    if (customMinutes > 0) {
      startTimer(customMinutes);
      showCustomInput = false;
    }
  }

  function setAction(action: SleepAction) {
    timerState.update((state) => ({ ...state, selectedAction: action }));
    showActionPicker = false;
  }

  function setCustomCommand(command: string) {
    timerState.update((state) => ({ ...state, customCommand: command }));
  }

  // Lifecycle
  onMount(() => {
    // Load saved presets from storage
    invoke<SleepTimerPreset[]>('get_sleep_timer_presets')
      .then((saved) => {
        if (saved && saved.length > 0) {
          presets.set(saved);
        }
      })
      .catch(() => {
        // Use default presets
      });
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
</script>

<div class="sleep-timer-manager" class:compact class:warning={$isWarning}>
  {#if $timerState.isActive}
    <!-- Active Timer Display -->
    <div class="timer-active">
      <div class="timer-display">
        <div class="timer-ring">
          <svg viewBox="0 0 100 100" class="progress-ring">
            <circle
              class="progress-ring-bg"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              stroke-width="6"
            />
            <circle
              class="progress-ring-fill"
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              stroke-width="6"
              stroke-dasharray={2 * Math.PI * 45}
              stroke-dashoffset={2 * Math.PI * 45 * (1 - $progress / 100)}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div class="timer-time">
            <span class="time-value">{$formattedTime}</span>
            <span class="action-icon">{actionLabels[$timerState.selectedAction].icon}</span>
          </div>
        </div>
      </div>

      <div class="timer-info">
        <span class="action-label">
          {actionLabels[$timerState.selectedAction].label}
        </span>
        {#if $isWarning}
          <span class="warning-badge">⚠️ Almost done!</span>
        {/if}
      </div>

      <div class="timer-controls">
        <button class="extend-btn" on:click={() => extendTimer(5)} title="Add 5 minutes">
          +5m
        </button>
        <button class="extend-btn" on:click={() => extendTimer(15)} title="Add 15 minutes">
          +15m
        </button>
        <button class="stop-btn" on:click={stopTimer} title="Cancel timer">
          ✕ Cancel
        </button>
      </div>
    </div>
  {:else}
    <!-- Timer Setup -->
    <div class="timer-setup">
      <div class="setup-header">
        <h3 class="setup-title">💤 Sleep Timer</h3>
        <p class="setup-subtitle">Set a timer to automatically {actionLabels[defaultAction].description.toLowerCase()}</p>
      </div>

      <!-- Action Selector -->
      <div class="action-selector">
        <button
          class="action-toggle"
          on:click={() => (showActionPicker = !showActionPicker)}
        >
          <span class="action-current">
            {actionLabels[$timerState.selectedAction].icon}
            {actionLabels[$timerState.selectedAction].label}
          </span>
          <span class="toggle-arrow">{showActionPicker ? '▲' : '▼'}</span>
        </button>

        {#if showActionPicker}
          <div class="action-dropdown">
            {#each Object.entries(actionLabels) as [key, value]}
              <button
                class="action-option"
                class:selected={$timerState.selectedAction === key}
                on:click={() => setAction(key as SleepAction)}
              >
                <span class="action-icon">{value.icon}</span>
                <div class="action-text">
                  <span class="action-name">{value.label}</span>
                  <span class="action-desc">{value.description}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}

        {#if $timerState.selectedAction === 'custom'}
          <input
            type="text"
            class="custom-command-input"
            placeholder="Enter command to run..."
            value={$timerState.customCommand}
            on:input={(e) => setCustomCommand(e.currentTarget.value)}
          />
        {/if}
      </div>

      <!-- Presets -->
      {#if showPresets}
        <div class="presets-grid">
          {#each $presets as preset (preset.id)}
            <button
              class="preset-btn"
              on:click={() => handlePresetClick(preset)}
            >
              <span class="preset-duration">{preset.name}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Custom Duration -->
      {#if allowCustomDuration}
        <div class="custom-duration">
          {#if showCustomInput}
            <div class="custom-input-row">
              <input
                type="number"
                class="duration-input"
                min="1"
                max="480"
                bind:value={customMinutes}
                placeholder="Minutes"
              />
              <span class="duration-label">minutes</span>
              <button class="start-custom-btn" on:click={handleCustomStart}>
                Start
              </button>
              <button class="cancel-btn" on:click={() => (showCustomInput = false)}>
                ✕
              </button>
            </div>
          {:else}
            <button class="show-custom-btn" on:click={() => (showCustomInput = true)}>
              ⏱️ Custom duration...
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sleep-timer-manager {
    --timer-primary: #6366f1;
    --timer-warning: #f59e0b;
    --timer-danger: #ef4444;
    --timer-bg: #1f2937;
    --timer-surface: #374151;
    --timer-text: #f3f4f6;
    --timer-text-muted: #9ca3af;
    --timer-border: #4b5563;

    background: var(--timer-bg);
    border-radius: 12px;
    padding: 1.5rem;
    color: var(--timer-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .sleep-timer-manager.compact {
    padding: 1rem;
  }

  .sleep-timer-manager.warning {
    animation: warning-pulse 1s ease-in-out infinite;
  }

  @keyframes warning-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
  }

  /* Active Timer */
  .timer-active {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .timer-display {
    position: relative;
  }

  .timer-ring {
    position: relative;
    width: 160px;
    height: 160px;
  }

  .compact .timer-ring {
    width: 100px;
    height: 100px;
  }

  .progress-ring {
    width: 100%;
    height: 100%;
  }

  .progress-ring-bg {
    opacity: 0.2;
  }

  .progress-ring-fill {
    color: var(--timer-primary);
    transition: stroke-dashoffset 0.5s ease;
  }

  .warning .progress-ring-fill {
    color: var(--timer-warning);
  }

  .timer-time {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }

  .time-value {
    display: block;
    font-size: 1.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .compact .time-value {
    font-size: 1.25rem;
  }

  .action-icon {
    font-size: 1.25rem;
  }

  .timer-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-label {
    color: var(--timer-text-muted);
    font-size: 0.875rem;
  }

  .warning-badge {
    background: var(--timer-warning);
    color: #000;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    animation: bounce 0.5s ease infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px); }
  }

  .timer-controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .extend-btn,
  .stop-btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .extend-btn {
    background: var(--timer-surface);
    color: var(--timer-text);
  }

  .extend-btn:hover {
    background: #4b5563;
  }

  .stop-btn {
    background: var(--timer-danger);
    color: white;
  }

  .stop-btn:hover {
    background: #dc2626;
  }

  /* Setup View */
  .timer-setup {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .setup-header {
    text-align: center;
  }

  .setup-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .setup-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--timer-text-muted);
  }

  .compact .setup-header {
    display: none;
  }

  /* Action Selector */
  .action-selector {
    position: relative;
  }

  .action-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--timer-surface);
    border: 1px solid var(--timer-border);
    border-radius: 8px;
    color: var(--timer-text);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-toggle:hover {
    border-color: var(--timer-primary);
  }

  .action-current {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle-arrow {
    font-size: 0.75rem;
    color: var(--timer-text-muted);
  }

  .action-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: var(--timer-surface);
    border: 1px solid var(--timer-border);
    border-radius: 8px;
    z-index: 10;
    overflow: hidden;
  }

  .action-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: var(--timer-text);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .action-option:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .action-option.selected {
    background: rgba(99, 102, 241, 0.2);
  }

  .action-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .action-name {
    font-weight: 500;
  }

  .action-desc {
    font-size: 0.75rem;
    color: var(--timer-text-muted);
  }

  .custom-command-input {
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--timer-surface);
    border: 1px solid var(--timer-border);
    border-radius: 8px;
    color: var(--timer-text);
    font-size: 0.875rem;
  }

  .custom-command-input:focus {
    outline: none;
    border-color: var(--timer-primary);
  }

  /* Presets Grid */
  .presets-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .compact .presets-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .preset-btn {
    padding: 0.75rem 0.5rem;
    background: var(--timer-surface);
    border: 1px solid var(--timer-border);
    border-radius: 8px;
    color: var(--timer-text);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.875rem;
  }

  .preset-btn:hover {
    background: var(--timer-primary);
    border-color: var(--timer-primary);
  }

  /* Custom Duration */
  .custom-duration {
    margin-top: 0.5rem;
  }

  .show-custom-btn {
    width: 100%;
    padding: 0.75rem;
    background: transparent;
    border: 1px dashed var(--timer-border);
    border-radius: 8px;
    color: var(--timer-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.875rem;
  }

  .show-custom-btn:hover {
    border-color: var(--timer-primary);
    color: var(--timer-text);
  }

  .custom-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .duration-input {
    width: 80px;
    padding: 0.5rem 0.75rem;
    background: var(--timer-surface);
    border: 1px solid var(--timer-border);
    border-radius: 6px;
    color: var(--timer-text);
    font-size: 0.875rem;
    text-align: center;
  }

  .duration-input:focus {
    outline: none;
    border-color: var(--timer-primary);
  }

  .duration-label {
    color: var(--timer-text-muted);
    font-size: 0.875rem;
  }

  .start-custom-btn {
    padding: 0.5rem 1rem;
    background: var(--timer-primary);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .start-custom-btn:hover {
    background: #4f46e5;
  }

  .cancel-btn {
    padding: 0.5rem;
    background: transparent;
    border: 1px solid var(--timer-border);
    border-radius: 6px;
    color: var(--timer-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn:hover {
    background: var(--timer-danger);
    border-color: var(--timer-danger);
    color: white;
  }

  /* Responsive */
  @media (max-width: 360px) {
    .presets-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .custom-input-row {
      flex-wrap: wrap;
    }
  }
</style>
