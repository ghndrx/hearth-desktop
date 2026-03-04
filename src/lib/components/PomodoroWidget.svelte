<!--
  PomodoroWidget - Productivity timer with native Tauri backend integration
  
  Features:
  - Native timer with system notifications
  - Persistent state across sessions
  - System tray integration
  - Sound and notification settings
  - Session tracking and statistics
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    pomodoro, 
    pomodoroFormattedTime, 
    pomodoroProgress, 
    pomodoroSessionLabel, 
    pomodoroSessionColor 
  } from '$lib/stores/pomodoro';
  import type { PomodoroSessionType, PomodoroSettings } from '$lib/stores/pomodoro';

  // Props with defaults
  export let minimized = false;
  export let compact = false;
  export let onMinimize: (() => void) | undefined = undefined;
  export let onClose: (() => void) | undefined = undefined;

  // Local state for settings panel
  let showSettings = false;
  let settings: PomodoroSettings = {
    work_duration: 25,
    short_break_duration: 5,
    long_break_duration: 15,
    pomodoros_before_long_break: 4,
    auto_start_breaks: false,
    auto_start_work: false,
    sound_enabled: true,
    notifications_enabled: true
  };

  // Load settings from store
  $: pomodoro.settings.subscribe(s => settings = s);

  onMount(() => {
    pomodoro.init();
  });

  onDestroy(() => {
    pomodoro.save();
    pomodoro.cleanup();
  });

  function handleStart() {
    pomodoro.start();
  }

  function handlePause() {
    pomodoro.pause();
  }

  function handleReset() {
    pomodoro.reset();
  }

  function handleSkip() {
    pomodoro.skip();
  }

  function handleSessionChange(type: PomodoroSessionType) {
    pomodoro.setSessionType(type);
  }

  async function handleSettingsSave() {
    await pomodoro.updateSettings(settings);
    showSettings = false;
  }

  function toggleSettings() {
    showSettings = !showSettings;
  }
</script>

<div 
  class="pomodoro-widget"
  class:minimized
  class:compact
  style="--session-color: {$pomodoroSessionColor}"
  role="timer"
  aria-label="Pomodoro Timer"
>
  {#if minimized}
    <button class="mini-display" on:click={() => onMinimize?.()} aria-label="Expand pomodoro timer">
      <span class="mini-icon">🍅</span>
      <span class="mini-time">{$pomodoroFormattedTime}</span>
      <span class="mini-indicator" class:running={$pomodoro.is_running}></span>
    </button>
  {:else if showSettings}
    <div class="settings-panel">
      <div class="settings-header">
        <h3>⚙️ Timer Settings</h3>
        <button class="icon-btn" on:click={toggleSettings} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
      </div>
      
      <div class="settings-content">
        <div class="setting-group">
          <label>Durations (minutes)</label>
          <div class="duration-inputs">
            <div class="input-group">
              <span>Focus</span>
              <input 
                type="number" 
                min="1" 
                max="60" 
                bind:value={settings.work_duration}
              />
            </div>
            <div class="input-group">
              <span>Short Break</span>
              <input 
                type="number" 
                min="1" 
                max="30" 
                bind:value={settings.short_break_duration}
              />
            </div>
            <div class="input-group">
              <span>Long Break</span>
              <input 
                type="number" 
                min="1" 
                max="60" 
                bind:value={settings.long_break_duration}
              />
            </div>
          </div>
        </div>

        <div class="setting-group">
          <label>
            <input type="checkbox" bind:checked={settings.auto_start_breaks} />
            Auto-start breaks
          </label>
          <label>
            <input type="checkbox" bind:checked={settings.auto_start_work} />
            Auto-start work sessions
          </label>
          <label>
            <input type="checkbox" bind:checked={settings.sound_enabled} />
            Enable sound
          </label>
          <label>
            <input type="checkbox" bind:checked={settings.notifications_enabled} />
            Enable notifications
          </label>
        </div>

        <button class="save-btn" on:click={handleSettingsSave}>Save Settings</button>
      </div>
    </div>
  {:else}
    <div class="widget-header">
      <h3>🍅 Pomodoro</h3>
      <div class="header-actions">
        <button class="icon-btn" on:click={toggleSettings} aria-label="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.49l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
        </button>
        {#if onMinimize}
          <button class="icon-btn" on:click={onMinimize} aria-label="Minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
        {/if}
        {#if onClose}
          <button class="icon-btn" on:click={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="session-tabs" role="tablist">
      <button 
        class="session-tab"
        class:active={$pomodoro.session_type === 'work'}
        on:click={() => handleSessionChange('work')}
        role="tab"
        aria-selected={$pomodoro.session_type === 'work'}
      >
        Focus
      </button>
      <button 
        class="session-tab"
        class:active={$pomodoro.session_type === 'short-break'}
        on:click={() => handleSessionChange('short-break')}
        role="tab"
        aria-selected={$pomodoro.session_type === 'short-break'}
      >
        Short Break
      </button>
      <button 
        class="session-tab"
        class:active={$pomodoro.session_type === 'long-break'}
        on:click={() => handleSessionChange('long-break')}
        role="tab"
        aria-selected={$pomodoro.session_type === 'long-break'}
      >
        Long Break
      </button>
    </div>

    <div class="timer-display">
      <svg class="progress-ring" viewBox="0 0 120 120">
        <circle 
          class="progress-bg" 
          cx="60" 
          cy="60" 
          r="54"
          fill="none"
          stroke-width="6"
        />
        <circle 
          class="progress-bar" 
          cx="60" 
          cy="60" 
          r="54"
          fill="none"
          stroke-width="6"
          stroke-dasharray="339.292"
          stroke-dashoffset={339.292 - (339.292 * $pomodoroProgress / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div class="time-text">
        <span class="time">{$pomodoroFormattedTime}</span>
        <span class="session-label">{$pomodoroSessionLabel}</span>
      </div>
    </div>

    <div class="controls">
      {#if $pomodoro.is_running}
        <button class="control-btn pause" on:click={handlePause} aria-label="Pause">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
          </svg>
        </button>
      {:else}
        <button class="control-btn play" on:click={handleStart} aria-label="Start">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      {/if}
      <button class="control-btn secondary" on:click={handleReset} aria-label="Reset">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
      </button>
      <button class="control-btn secondary" on:click={handleSkip} aria-label="Skip">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-value">{$pomodoro.completed_pomodoros}</span>
        <span class="stat-label">/ {$pomodoro.settings.pomodoros_before_long_break}</span>
      </div>
      <div class="stat">
        <span class="stat-value">🍅 {$pomodoro.total_completed_today}</span>
        <span class="stat-label">today</span>
      </div>
      {#if $pomodoro.streak > 0}
        <div class="stat">
          <span class="stat-value">🔥 {$pomodoro.streak}</span>
          <span class="stat-label">streak</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pomodoro-widget {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 16px;
    padding: 16px;
    width: 280px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text-primary, #cdd6f4);
  }

  .pomodoro-widget.compact {
    width: 240px;
    padding: 12px;
  }

  .pomodoro-widget.minimized {
    width: auto;
    padding: 8px 12px;
  }

  /* Header */
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #a6adc8);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-hover, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  /* Minimized view */
  .mini-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .mini-icon {
    font-size: 14px;
  }

  .mini-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-secondary, #a6adc8);
  }

  .mini-indicator.running {
    background: var(--session-color);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Session tabs */
  .session-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }

  .session-tab {
    flex: 1;
    padding: 8px 4px;
    background: var(--bg-tertiary, #313244);
    border: none;
    border-radius: 8px;
    color: var(--text-secondary, #a6adc8);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .session-tab:hover {
    background: var(--bg-hover, #45475a);
  }

  .session-tab.active {
    background: var(--session-color);
    color: white;
  }

  /* Timer display */
  .timer-display {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 16px;
  }

  .progress-ring {
    width: 180px;
    height: 180px;
  }

  .compact .progress-ring {
    width: 140px;
    height: 140px;
  }

  .progress-bg {
    stroke: var(--bg-tertiary, #313244);
  }

  .progress-bar {
    stroke: var(--session-color);
    transition: stroke-dashoffset 0.3s ease;
  }

  .time-text {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .time {
    font-size: 36px;
    font-weight: 700;
    font-family: 'SF Mono', 'Fira Code', monospace;
    letter-spacing: 2px;
  }

  .compact .time {
    font-size: 28px;
  }

  .session-label {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-top: 4px;
  }

  /* Controls */
  .controls {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .control-btn {
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .control-btn.play,
  .control-btn.pause {
    background: var(--session-color);
    color: white;
    width: 56px;
    height: 56px;
  }

  .control-btn.play:hover,
  .control-btn.pause:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
  }

  .control-btn.secondary {
    background: var(--bg-tertiary, #313244);
    color: var(--text-secondary, #a6adc8);
  }

  .control-btn.secondary:hover {
    background: var(--bg-hover, #45475a);
    color: var(--text-primary, #cdd6f4);
  }

  /* Stats */
  .stats {
    display: flex;
    justify-content: space-around;
    padding-top: 12px;
    border-top: 1px solid var(--border, #313244);
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    margin-left: 2px;
  }

  /* Settings panel */
  .settings-panel {
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .settings-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setting-group label {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .setting-group label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--session-color);
  }

  .duration-inputs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group span {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  .input-group input {
    background: var(--bg-tertiary, #313244);
    border: 1px solid var(--border, #45475a);
    border-radius: 6px;
    padding: 8px;
    color: var(--text-primary, #cdd6f4);
    font-size: 14px;
    text-align: center;
  }

  .input-group input:focus {
    outline: none;
    border-color: var(--session-color);
  }

  .save-btn {
    background: var(--session-color);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-btn:hover {
    filter: brightness(1.1);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mini-indicator.running {
      animation: none;
    }
    
    .control-btn:hover {
      transform: none;
    }

    .progress-bar {
      transition: none;
    }
  }
</style>
