<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    outputPath: string | null;
  }
  
  interface RecordingSettings {
    fps: number;
    quality: 'low' | 'medium' | 'high';
    audioEnabled: boolean;
    region: 'fullscreen' | 'window' | 'selection';
    showCursor: boolean;
    countdown: number;
  }
  
  let state = $state<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    outputPath: null,
  });
  
  let settings = $state<RecordingSettings>({
    fps: 30,
    quality: 'high',
    audioEnabled: true,
    region: 'fullscreen',
    showCursor: true,
    countdown: 3,
  });
  
  let isMinimized = $state(false);
  let showSettings = $state(false);
  let countdownValue = $state<number | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;
  let unlisten: UnlistenFn | null = null;
  
  const formattedDuration = $derived(() => {
    const minutes = Math.floor(state.duration / 60);
    const seconds = state.duration % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  
  const qualityOptions = [
    { value: 'low', label: 'Low (720p)', bitrate: '2.5 Mbps' },
    { value: 'medium', label: 'Medium (1080p)', bitrate: '5 Mbps' },
    { value: 'high', label: 'High (1080p+)', bitrate: '10 Mbps' },
  ];
  
  const fpsOptions = [15, 24, 30, 60];
  
  const regionOptions = [
    { value: 'fullscreen', label: 'Full Screen', icon: '🖥️' },
    { value: 'window', label: 'Window', icon: '⧉' },
    { value: 'selection', label: 'Selection', icon: '⬚' },
  ];
  
  onMount(async () => {
    unlisten = await listen('recording-status', (event) => {
      const payload = event.payload as Partial<RecordingState>;
      state = { ...state, ...payload };
    });
  });
  
  onDestroy(() => {
    if (timer) clearInterval(timer);
    if (unlisten) unlisten();
  });
  
  async function startCountdown() {
    if (settings.countdown > 0) {
      countdownValue = settings.countdown;
      for (let i = settings.countdown; i > 0; i--) {
        countdownValue = i;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      countdownValue = null;
    }
  }
  
  async function startRecording() {
    try {
      await startCountdown();
      
      await invoke('start_screen_recording', {
        settings: {
          fps: settings.fps,
          quality: settings.quality,
          audio_enabled: settings.audioEnabled,
          region: settings.region,
          show_cursor: settings.showCursor,
        },
      });
      
      state.isRecording = true;
      state.isPaused = false;
      state.duration = 0;
      
      timer = setInterval(() => {
        if (!state.isPaused) {
          state.duration++;
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }
  
  async function stopRecording() {
    try {
      const path = await invoke<string>('stop_screen_recording');
      
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      
      state = {
        isRecording: false,
        isPaused: false,
        duration: 0,
        outputPath: path,
      };
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }
  
  async function pauseRecording() {
    try {
      await invoke('pause_screen_recording');
      state.isPaused = true;
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  }
  
  async function resumeRecording() {
    try {
      await invoke('resume_screen_recording');
      state.isPaused = false;
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  }
  
  async function cancelRecording() {
    try {
      await invoke('cancel_screen_recording');
      
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      
      state = {
        isRecording: false,
        isPaused: false,
        duration: 0,
        outputPath: null,
      };
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }
  
  async function openRecording() {
    if (state.outputPath) {
      try {
        await invoke('open_path', { path: state.outputPath });
      } catch (error) {
        console.error('Failed to open recording:', error);
      }
    }
  }
  
  function clearOutput() {
    state.outputPath = null;
  }
</script>

{#if countdownValue !== null}
  <div class="countdown-overlay">
    <div class="countdown-number">{countdownValue}</div>
  </div>
{/if}

<div class="screen-record-manager" class:minimized={isMinimized} class:recording={state.isRecording}>
  {#if isMinimized}
    <button class="expand-btn" onclick={() => isMinimized = false}>
      {#if state.isRecording}
        <span class="recording-dot"></span>
        <span class="duration">{formattedDuration()}</span>
      {:else}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        </svg>
      {/if}
    </button>
  {:else}
    <div class="panel">
      <div class="panel-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
          Screen Recording
        </h3>
        <div class="header-actions">
          <button 
            class="icon-btn"
            onclick={() => showSettings = !showSettings}
            title="Settings"
            disabled={state.isRecording}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button 
            class="icon-btn"
            onclick={() => isMinimized = true}
            title="Minimize"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          </button>
        </div>
      </div>
      
      {#if showSettings && !state.isRecording}
        <div class="settings-panel">
          <div class="setting-group">
            <label>Capture Region</label>
            <div class="region-options">
              {#each regionOptions as option}
                <button
                  class="region-btn"
                  class:selected={settings.region === option.value}
                  onclick={() => settings.region = option.value as RecordingSettings['region']}
                >
                  <span class="icon">{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              {/each}
            </div>
          </div>
          
          <div class="setting-row">
            <div class="setting-group">
              <label>Quality</label>
              <select bind:value={settings.quality}>
                {#each qualityOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
            
            <div class="setting-group">
              <label>FPS</label>
              <select bind:value={settings.fps}>
                {#each fpsOptions as fps}
                  <option value={fps}>{fps} fps</option>
                {/each}
              </select>
            </div>
          </div>
          
          <div class="setting-row">
            <div class="setting-group">
              <label>Countdown</label>
              <select bind:value={settings.countdown}>
                <option value={0}>None</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
              </select>
            </div>
          </div>
          
          <div class="toggle-settings">
            <label class="toggle">
              <input type="checkbox" bind:checked={settings.audioEnabled} />
              <span class="slider"></span>
              <span>Record Audio</span>
            </label>
            
            <label class="toggle">
              <input type="checkbox" bind:checked={settings.showCursor} />
              <span class="slider"></span>
              <span>Show Cursor</span>
            </label>
          </div>
        </div>
      {:else if state.isRecording}
        <div class="recording-status">
          <div class="status-indicator" class:paused={state.isPaused}>
            {#if state.isPaused}
              <span class="paused-icon">⏸️</span>
              <span>Paused</span>
            {:else}
              <span class="recording-dot"></span>
              <span>Recording</span>
            {/if}
          </div>
          <div class="timer">{formattedDuration()}</div>
        </div>
      {:else if state.outputPath}
        <div class="output-panel">
          <div class="success-icon">✅</div>
          <p>Recording saved!</p>
          <div class="output-actions">
            <button class="action-btn primary" onclick={openRecording}>
              Open Recording
            </button>
            <button class="action-btn" onclick={clearOutput}>
              Dismiss
            </button>
          </div>
        </div>
      {:else}
        <div class="ready-panel">
          <p>Ready to record</p>
          <p class="hint">Click start to begin screen recording</p>
        </div>
      {/if}
      
      <div class="controls">
        {#if state.isRecording}
          <button class="control-btn pause" onclick={state.isPaused ? resumeRecording : pauseRecording}>
            {#if state.isPaused}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            {/if}
          </button>
          <button class="control-btn stop" onclick={stopRecording}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
          <button class="control-btn cancel" onclick={cancelRecording}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        {:else}
          <button 
            class="control-btn start"
            onclick={startRecording}
            disabled={state.outputPath !== null}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8"/>
            </svg>
            <span>Start Recording</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .screen-record-manager {
    position: fixed;
    bottom: 140px;
    right: 20px;
    z-index: 999;
  }
  
  .expand-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #2b2d31;
    border: 2px solid #3f4147;
    color: #f2f3f5;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
  }
  
  .expand-btn:hover {
    border-color: #5865f2;
    transform: scale(1.05);
  }
  
  .minimized .expand-btn {
    width: auto;
    padding: 8px 16px;
    border-radius: 24px;
  }
  
  .recording .expand-btn {
    border-color: #ed4245;
    background: rgba(237, 66, 69, 0.1);
  }
  
  .recording-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ed4245;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .duration {
    font-family: monospace;
    font-size: 14px;
    font-weight: 600;
  }
  
  .panel {
    width: 320px;
    background: #2b2d31;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid #3f4147;
  }
  
  .panel-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #f2f3f5;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: #b5bac1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  
  .icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #f2f3f5;
  }
  
  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .settings-panel {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-bottom: 1px solid #3f4147;
  }
  
  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .setting-group label {
    font-size: 12px;
    font-weight: 600;
    color: #b5bac1;
    text-transform: uppercase;
  }
  
  .setting-row {
    display: flex;
    gap: 12px;
  }
  
  .setting-row .setting-group {
    flex: 1;
  }
  
  .region-options {
    display: flex;
    gap: 8px;
  }
  
  .region-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 8px;
    background: #1e1f22;
    border: 2px solid transparent;
    border-radius: 8px;
    color: #b5bac1;
    cursor: pointer;
    transition: all 0.15s;
    font-size: 12px;
  }
  
  .region-btn:hover {
    background: #232428;
    color: #f2f3f5;
  }
  
  .region-btn.selected {
    border-color: #5865f2;
    background: rgba(88, 101, 242, 0.1);
    color: #f2f3f5;
  }
  
  .region-btn .icon {
    font-size: 24px;
  }
  
  select {
    width: 100%;
    padding: 8px 12px;
    background: #1e1f22;
    border: 1px solid #3f4147;
    border-radius: 6px;
    color: #f2f3f5;
    font-size: 14px;
    cursor: pointer;
    outline: none;
  }
  
  select:focus {
    border-color: #5865f2;
  }
  
  .toggle-settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    font-size: 14px;
    color: #f2f3f5;
  }
  
  .toggle input {
    display: none;
  }
  
  .slider {
    width: 40px;
    height: 22px;
    background: #4e5058;
    border-radius: 11px;
    position: relative;
    transition: background 0.2s;
  }
  
  .slider::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    background: #f2f3f5;
    border-radius: 50%;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
  }
  
  .toggle input:checked + .slider {
    background: #5865f2;
  }
  
  .toggle input:checked + .slider::after {
    transform: translateX(18px);
  }
  
  .recording-status {
    padding: 24px;
    text-align: center;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    color: #ed4245;
    margin-bottom: 8px;
  }
  
  .status-indicator.paused {
    color: #faa81a;
  }
  
  .paused-icon {
    font-size: 16px;
  }
  
  .timer {
    font-family: monospace;
    font-size: 48px;
    font-weight: 700;
    color: #f2f3f5;
  }
  
  .output-panel {
    padding: 24px;
    text-align: center;
  }
  
  .success-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  
  .output-panel p {
    margin: 0;
    color: #f2f3f5;
    font-size: 16px;
  }
  
  .output-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  
  .action-btn {
    flex: 1;
    padding: 10px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
    background: #4e5058;
    color: #f2f3f5;
  }
  
  .action-btn:hover {
    background: #6d6f78;
  }
  
  .action-btn.primary {
    background: #5865f2;
  }
  
  .action-btn.primary:hover {
    background: #4752c4;
  }
  
  .ready-panel {
    padding: 24px;
    text-align: center;
  }
  
  .ready-panel p {
    margin: 0;
    color: #f2f3f5;
  }
  
  .ready-panel .hint {
    font-size: 13px;
    color: #b5bac1;
    margin-top: 4px;
  }
  
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: #1e1f22;
  }
  
  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  
  .control-btn.start {
    background: #ed4245;
    color: white;
    flex: 1;
  }
  
  .control-btn.start:hover:not(:disabled) {
    background: #d93b3e;
  }
  
  .control-btn.start:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .control-btn.stop {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    padding: 0;
    background: #ed4245;
    color: white;
  }
  
  .control-btn.stop:hover {
    background: #d93b3e;
  }
  
  .control-btn.pause {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    padding: 0;
    background: #5865f2;
    color: white;
  }
  
  .control-btn.pause:hover {
    background: #4752c4;
  }
  
  .control-btn.cancel {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    padding: 0;
    background: #4e5058;
    color: #f2f3f5;
  }
  
  .control-btn.cancel:hover {
    background: #6d6f78;
  }
  
  .countdown-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  
  .countdown-number {
    font-size: 200px;
    font-weight: 700;
    color: #f2f3f5;
    animation: countdownPulse 1s ease-in-out infinite;
  }
  
  @keyframes countdownPulse {
    0% { transform: scale(0.8); opacity: 0.5; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0.5; }
  }
</style>
