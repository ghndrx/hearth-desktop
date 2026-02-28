<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';

  // Pomodoro settings
  export let workDuration = 25; // minutes
  export let shortBreakDuration = 5;
  export let longBreakDuration = 15;
  export let pomodorosBeforeLongBreak = 4;
  export let autoStartBreaks = false;
  export let autoStartWork = false;
  export let soundEnabled = true;
  export let showNotifications = true;
  export let minimized = false;

  type SessionType = 'work' | 'short-break' | 'long-break';

  interface PomodoroState {
    sessionType: SessionType;
    timeRemaining: number; // seconds
    isRunning: boolean;
    completedPomodoros: number;
    totalCompletedToday: number;
    streak: number;
  }

  const state = writable<PomodoroState>({
    sessionType: 'work',
    timeRemaining: workDuration * 60,
    isRunning: false,
    completedPomodoros: 0,
    totalCompletedToday: 0,
    streak: 0
  });

  let interval: number | null = null;

  const formattedTime = derived(state, ($state) => {
    const minutes = Math.floor($state.timeRemaining / 60);
    const seconds = $state.timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  const progress = derived(state, ($state) => {
    const totalSeconds = getSessionDuration($state.sessionType) * 60;
    return ((totalSeconds - $state.timeRemaining) / totalSeconds) * 100;
  });

  const sessionLabel = derived(state, ($state) => {
    switch ($state.sessionType) {
      case 'work': return 'Focus Time';
      case 'short-break': return 'Short Break';
      case 'long-break': return 'Long Break';
    }
  });

  const sessionColor = derived(state, ($state) => {
    switch ($state.sessionType) {
      case 'work': return 'var(--color-primary, #ef4444)';
      case 'short-break': return 'var(--color-success, #22c55e)';
      case 'long-break': return 'var(--color-info, #3b82f6)';
    }
  });

  function getSessionDuration(type: SessionType): number {
    switch (type) {
      case 'work': return workDuration;
      case 'short-break': return shortBreakDuration;
      case 'long-break': return longBreakDuration;
    }
  }

  function startTimer() {
    if (interval) return;
    
    state.update(s => ({ ...s, isRunning: true }));
    
    interval = window.setInterval(() => {
      state.update(s => {
        if (s.timeRemaining <= 0) {
          handleSessionComplete();
          return s;
        }
        return { ...s, timeRemaining: s.timeRemaining - 1 };
      });
    }, 1000);
  }

  function pauseTimer() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    state.update(s => ({ ...s, isRunning: false }));
  }

  function resetTimer() {
    pauseTimer();
    state.update(s => ({
      ...s,
      timeRemaining: getSessionDuration(s.sessionType) * 60
    }));
  }

  function skipSession() {
    pauseTimer();
    handleSessionComplete();
  }

  async function handleSessionComplete() {
    pauseTimer();
    
    let currentState: PomodoroState;
    state.subscribe(s => currentState = s)();
    
    if (soundEnabled) {
      await playCompletionSound();
    }
    
    if (showNotifications) {
      await showCompletionNotification(currentState!.sessionType);
    }

    state.update(s => {
      let nextType: SessionType;
      let newCompletedPomodoros = s.completedPomodoros;
      let newTotalToday = s.totalCompletedToday;

      if (s.sessionType === 'work') {
        newCompletedPomodoros += 1;
        newTotalToday += 1;
        
        if (newCompletedPomodoros >= pomodorosBeforeLongBreak) {
          nextType = 'long-break';
          newCompletedPomodoros = 0;
        } else {
          nextType = 'short-break';
        }
      } else {
        nextType = 'work';
      }

      const shouldAutoStart = 
        (nextType === 'work' && autoStartWork) ||
        (nextType !== 'work' && autoStartBreaks);

      return {
        ...s,
        sessionType: nextType,
        timeRemaining: getSessionDuration(nextType) * 60,
        completedPomodoros: newCompletedPomodoros,
        totalCompletedToday: newTotalToday,
        isRunning: false
      };
    });

    // Auto-start if enabled
    let shouldAutoStart: boolean;
    state.subscribe(s => {
      shouldAutoStart = 
        (s.sessionType === 'work' && autoStartWork) ||
        (s.sessionType !== 'work' && autoStartBreaks);
    })();
    
    if (shouldAutoStart!) {
      setTimeout(() => startTimer(), 1000);
    }
  }

  async function playCompletionSound() {
    try {
      await invoke('play_notification_sound', { soundType: 'pomodoro_complete' });
    } catch (e) {
      // Fallback to web audio
      const audio = new Audio('/sounds/bell.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }
  }

  async function showCompletionNotification(completedType: SessionType) {
    try {
      const title = completedType === 'work' ? '🍅 Pomodoro Complete!' : '⏰ Break Over!';
      const body = completedType === 'work' 
        ? 'Great work! Time for a break.'
        : 'Ready to focus again?';
      
      await invoke('show_notification', { title, body });
    } catch (e) {
      // Fallback to browser notification
      if (Notification.permission === 'granted') {
        new Notification(completedType === 'work' ? '🍅 Pomodoro Complete!' : '⏰ Break Over!');
      }
    }
  }

  function setSessionType(type: SessionType) {
    pauseTimer();
    state.update(s => ({
      ...s,
      sessionType: type,
      timeRemaining: getSessionDuration(type) * 60
    }));
  }

  onMount(() => {
    // Load saved state from storage
    loadState();
  });

  onDestroy(() => {
    if (interval) {
      clearInterval(interval);
    }
  });

  async function loadState() {
    try {
      const saved = await invoke<{ totalCompletedToday: number; streak: number } | null>('load_pomodoro_state');
      if (saved) {
        state.update(s => ({
          ...s,
          totalCompletedToday: saved.totalCompletedToday,
          streak: saved.streak
        }));
      }
    } catch (e) {
      // Use localStorage fallback
      const saved = localStorage.getItem('pomodoro_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.update(s => ({
          ...s,
          totalCompletedToday: parsed.totalCompletedToday || 0,
          streak: parsed.streak || 0
        }));
      }
    }
  }

  async function saveState() {
    let currentState: PomodoroState;
    state.subscribe(s => currentState = s)();
    
    const toSave = {
      totalCompletedToday: currentState!.totalCompletedToday,
      streak: currentState!.streak
    };
    
    try {
      await invoke('save_pomodoro_state', { state: toSave });
    } catch (e) {
      localStorage.setItem('pomodoro_state', JSON.stringify(toSave));
    }
  }

  // Save state when completed pomodoros change
  $: if ($state.totalCompletedToday > 0) {
    saveState();
  }
</script>

<div 
  class="pomodoro-widget"
  class:minimized
  style="--session-color: {$sessionColor}"
  role="timer"
  aria-label="Pomodoro Timer"
>
  {#if minimized}
    <button class="mini-display" on:click={() => minimized = false}>
      <span class="mini-time">{$formattedTime}</span>
      <span class="mini-indicator" class:running={$state.isRunning}></span>
    </button>
  {:else}
    <div class="widget-header">
      <h3>🍅 Pomodoro</h3>
      <button class="minimize-btn" on:click={() => minimized = true} aria-label="Minimize">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
    </div>

    <div class="session-tabs" role="tablist">
      <button 
        class="session-tab"
        class:active={$state.sessionType === 'work'}
        on:click={() => setSessionType('work')}
        role="tab"
        aria-selected={$state.sessionType === 'work'}
      >
        Focus
      </button>
      <button 
        class="session-tab"
        class:active={$state.sessionType === 'short-break'}
        on:click={() => setSessionType('short-break')}
        role="tab"
        aria-selected={$state.sessionType === 'short-break'}
      >
        Short Break
      </button>
      <button 
        class="session-tab"
        class:active={$state.sessionType === 'long-break'}
        on:click={() => setSessionType('long-break')}
        role="tab"
        aria-selected={$state.sessionType === 'long-break'}
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
          stroke-dashoffset={339.292 - (339.292 * $progress / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div class="time-text">
        <span class="time">{$formattedTime}</span>
        <span class="session-label">{$sessionLabel}</span>
      </div>
    </div>

    <div class="controls">
      {#if $state.isRunning}
        <button class="control-btn pause" on:click={pauseTimer} aria-label="Pause">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
          </svg>
        </button>
      {:else}
        <button class="control-btn play" on:click={startTimer} aria-label="Start">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
      {/if}
      <button class="control-btn secondary" on:click={resetTimer} aria-label="Reset">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
      </button>
      <button class="control-btn secondary" on:click={skipSession} aria-label="Skip">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
        </svg>
      </button>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-value">{$state.completedPomodoros}</span>
        <span class="stat-label">/ {pomodorosBeforeLongBreak}</span>
      </div>
      <div class="stat">
        <span class="stat-value">🍅 {$state.totalCompletedToday}</span>
        <span class="stat-label">today</span>
      </div>
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

  .pomodoro-widget.minimized {
    width: auto;
    padding: 8px 12px;
  }

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

  .minimize-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #a6adc8);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .minimize-btn:hover {
    background: var(--bg-hover, #313244);
  }

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
    font-family: monospace;
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
    font-size: 12px;
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

  .session-label {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mini-indicator.running {
      animation: none;
    }
    
    .control-btn:hover {
      transform: none;
    }
  }
</style>
