<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { fade, scale } from 'svelte/transition';
  
  // Configurable intervals (in minutes)
  export let workInterval = 20; // minutes before reminder (20-20-20 rule)
  export let breakDuration = 20; // seconds to look away
  export let enabled = true;
  export let soundEnabled = true;
  export let notificationEnabled = true;
  
  // State stores
  const isActive = writable(false);
  const isOnBreak = writable(false);
  const timeRemaining = writable(workInterval * 60); // seconds until next break
  const breakTimeRemaining = writable(breakDuration);
  const sessionsCompleted = writable(0);
  const isPaused = writable(false);
  const showSettings = writable(false);
  
  // Computed values
  const progressPercent = derived(timeRemaining, $t => {
    const total = workInterval * 60;
    return Math.round(((total - $t) / total) * 100);
  });
  
  const formattedTime = derived(timeRemaining, $t => {
    const mins = Math.floor($t / 60);
    const secs = $t % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });
  
  const formattedBreakTime = derived(breakTimeRemaining, $t => {
    return `${$t}s`;
  });
  
  let workTimer: ReturnType<typeof setInterval> | null = null;
  let breakTimer: ReturnType<typeof setInterval> | null = null;
  
  // Audio notification
  function playNotificationSound() {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.3); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio notification failed:', e);
    }
  }
  
  // System notification
  async function showNotification(title: string, body: string) {
    if (!notificationEnabled) return;
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '👁️' });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, icon: '👁️' });
        }
      }
    } catch (e) {
      console.warn('Notification failed:', e);
    }
  }
  
  function startWorkTimer() {
    if (workTimer) clearInterval(workTimer);
    timeRemaining.set(workInterval * 60);
    isOnBreak.set(false);
    
    workTimer = setInterval(() => {
      if ($isPaused) return;
      
      timeRemaining.update(t => {
        if (t <= 1) {
          clearInterval(workTimer!);
          workTimer = null;
          triggerBreak();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }
  
  function triggerBreak() {
    isOnBreak.set(true);
    breakTimeRemaining.set(breakDuration);
    playNotificationSound();
    showNotification('👁️ Eye Care Reminder', 'Look at something 20 feet away for 20 seconds');
    
    breakTimer = setInterval(() => {
      breakTimeRemaining.update(t => {
        if (t <= 1) {
          clearInterval(breakTimer!);
          breakTimer = null;
          completeBreak();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }
  
  function completeBreak() {
    sessionsCompleted.update(n => n + 1);
    playNotificationSound();
    showNotification('✅ Break Complete', 'Great job taking care of your eyes!');
    startWorkTimer();
  }
  
  function skipBreak() {
    if (breakTimer) clearInterval(breakTimer);
    breakTimer = null;
    startWorkTimer();
  }
  
  function togglePause() {
    isPaused.update(p => !p);
  }
  
  function resetTimer() {
    if (workTimer) clearInterval(workTimer);
    if (breakTimer) clearInterval(breakTimer);
    workTimer = null;
    breakTimer = null;
    timeRemaining.set(workInterval * 60);
    breakTimeRemaining.set(breakDuration);
    isOnBreak.set(false);
    isPaused.set(false);
    if ($isActive) startWorkTimer();
  }
  
  function toggleActive() {
    isActive.update(a => {
      if (!a) {
        startWorkTimer();
        return true;
      } else {
        if (workTimer) clearInterval(workTimer);
        if (breakTimer) clearInterval(breakTimer);
        workTimer = null;
        breakTimer = null;
        isOnBreak.set(false);
        isPaused.set(false);
        return false;
      }
    });
  }
  
  function updateSettings() {
    resetTimer();
  }
  
  onMount(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    if (enabled) {
      isActive.set(true);
      startWorkTimer();
    }
  });
  
  onDestroy(() => {
    if (workTimer) clearInterval(workTimer);
    if (breakTimer) clearInterval(breakTimer);
  });
</script>

<div class="eye-care-reminder" class:on-break={$isOnBreak}>
  <div class="header">
    <div class="title">
      <span class="icon">👁️</span>
      <span>Eye Care</span>
    </div>
    <div class="controls">
      <button 
        class="control-btn settings-btn" 
        on:click={() => showSettings.update(s => !s)}
        title="Settings"
      >
        ⚙️
      </button>
      <button 
        class="control-btn power-btn" 
        class:active={$isActive}
        on:click={toggleActive}
        title={$isActive ? 'Disable' : 'Enable'}
      >
        {$isActive ? '🟢' : '⚫'}
      </button>
    </div>
  </div>
  
  {#if $showSettings}
    <div class="settings-panel" transition:fade={{ duration: 150 }}>
      <label class="setting">
        <span>Work interval (min)</span>
        <input 
          type="number" 
          bind:value={workInterval} 
          min="1" 
          max="60"
          on:change={updateSettings}
        />
      </label>
      <label class="setting">
        <span>Break duration (sec)</span>
        <input 
          type="number" 
          bind:value={breakDuration} 
          min="5" 
          max="120"
          on:change={updateSettings}
        />
      </label>
      <label class="setting checkbox">
        <input type="checkbox" bind:checked={soundEnabled} />
        <span>Sound alerts</span>
      </label>
      <label class="setting checkbox">
        <input type="checkbox" bind:checked={notificationEnabled} />
        <span>System notifications</span>
      </label>
    </div>
  {/if}
  
  {#if $isActive}
    <div class="timer-display">
      {#if $isOnBreak}
        <div class="break-overlay" transition:scale={{ duration: 200 }}>
          <div class="break-icon">👀</div>
          <div class="break-title">Look Away!</div>
          <div class="break-subtitle">Focus on something 20ft away</div>
          <div class="break-timer">{$formattedBreakTime}</div>
          <div class="break-progress">
            <div 
              class="break-progress-bar" 
              style="width: {((breakDuration - $breakTimeRemaining) / breakDuration) * 100}%"
            ></div>
          </div>
          <button class="skip-btn" on:click={skipBreak}>Skip</button>
        </div>
      {:else}
        <div class="work-timer">
          <div class="progress-ring">
            <svg viewBox="0 0 100 100">
              <circle 
                class="progress-bg" 
                cx="50" 
                cy="50" 
                r="45"
              />
              <circle 
                class="progress-fill" 
                cx="50" 
                cy="50" 
                r="45"
                style="stroke-dasharray: {2 * Math.PI * 45}; stroke-dashoffset: {2 * Math.PI * 45 * (1 - $progressPercent / 100)}"
              />
            </svg>
            <div class="timer-text">
              <span class="time">{$formattedTime}</span>
              <span class="label">until break</span>
            </div>
          </div>
          <div class="timer-controls">
            <button class="timer-btn" on:click={togglePause}>
              {$isPaused ? '▶️' : '⏸️'}
            </button>
            <button class="timer-btn" on:click={resetTimer}>
              🔄
            </button>
          </div>
        </div>
      {/if}
    </div>
    
    <div class="stats">
      <div class="stat">
        <span class="stat-value">{$sessionsCompleted}</span>
        <span class="stat-label">breaks today</span>
      </div>
    </div>
  {:else}
    <div class="disabled-message">
      <p>Eye care reminders disabled</p>
      <p class="hint">Click the power button to enable</p>
    </div>
  {/if}
</div>

<style>
  .eye-care-reminder {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 12px;
    padding: 16px;
    width: 280px;
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text-primary, #cdd6f4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
  }
  
  .eye-care-reminder.on-break {
    background: linear-gradient(135deg, #2d4a3e 0%, #1e3a2f 100%);
    box-shadow: 0 0 20px rgba(64, 224, 208, 0.2);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 16px;
  }
  
  .icon {
    font-size: 20px;
  }
  
  .controls {
    display: flex;
    gap: 8px;
  }
  
  .control-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    border-radius: 6px;
    transition: background 0.2s;
  }
  
  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .settings-panel {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  
  .setting.checkbox {
    justify-content: flex-start;
    gap: 8px;
  }
  
  .setting input[type="number"] {
    width: 60px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.3);
    color: inherit;
    text-align: center;
  }
  
  .setting input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  
  .timer-display {
    position: relative;
  }
  
  .work-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  
  .progress-ring {
    position: relative;
    width: 140px;
    height: 140px;
  }
  
  .progress-ring svg {
    transform: rotate(-90deg);
    width: 100%;
    height: 100%;
  }
  
  .progress-bg {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 8;
  }
  
  .progress-fill {
    fill: none;
    stroke: #89b4fa;
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 1s linear;
  }
  
  .timer-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
  }
  
  .timer-text .time {
    display: block;
    font-size: 28px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  
  .timer-text .label {
    display: block;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    margin-top: 2px;
  }
  
  .timer-controls {
    display: flex;
    gap: 12px;
  }
  
  .timer-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s;
  }
  
  .timer-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
  
  .break-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    text-align: center;
  }
  
  .break-icon {
    font-size: 48px;
    margin-bottom: 12px;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  
  .break-title {
    font-size: 24px;
    font-weight: 700;
    color: #40e0d0;
    margin-bottom: 4px;
  }
  
  .break-subtitle {
    font-size: 13px;
    color: var(--text-secondary, #a6adc8);
    margin-bottom: 16px;
  }
  
  .break-timer {
    font-size: 48px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #40e0d0;
    margin-bottom: 12px;
  }
  
  .break-progress {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  
  .break-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #40e0d0, #48d1cc);
    border-radius: 3px;
    transition: width 1s linear;
  }
  
  .skip-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    padding: 8px 24px;
    border-radius: 20px;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }
  
  .skip-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .stats {
    display: flex;
    justify-content: center;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #89b4fa;
  }
  
  .stat-label {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }
  
  .disabled-message {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary, #a6adc8);
  }
  
  .disabled-message p {
    margin: 0;
  }
  
  .disabled-message .hint {
    font-size: 12px;
    margin-top: 8px;
    opacity: 0.7;
  }
</style>
