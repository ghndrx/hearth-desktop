<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import type { UnlistenFn } from '@tauri-apps/api/event';

  // Types matching the Rust backend
  type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing';
  type OutputFormat = 'mp4' | 'webm' | 'gif';
  type RecordingQuality = 'low' | 'medium' | 'high' | 'ultra';
  type CaptureArea = 'fullscreen' | 'window' | 'region';

  interface RecordingStateSnapshot {
    status: RecordingStatus;
    elapsedSeconds: number;
    filePath: string | null;
  }

  interface ScreenRecordSettings {
    format: OutputFormat;
    quality: RecordingQuality;
    fps: number;
    captureAudio: boolean;
    captureMicrophone: boolean;
    captureArea: CaptureArea;
    maxDurationSeconds: number;
  }

  interface RecordingInfo {
    path: string;
    fileName: string;
    fileSize: number;
    format: string;
    duration: number;
    createdAt: string;
  }

  // Component state
  let recordingStatus: RecordingStatus = 'idle';
  let elapsedSeconds = 0;
  let filePath: string | null = null;

  let settings: ScreenRecordSettings = {
    format: 'mp4',
    quality: 'high',
    fps: 30,
    captureAudio: true,
    captureMicrophone: false,
    captureArea: 'fullscreen',
    maxDurationSeconds: 300
  };

  let recordings: RecordingInfo[] = [];
  let showSettings = false;
  let showRecordingsList = false;
  let timerInterval: number | null = null;
  let unlisten: UnlistenFn | null = null;

  // Format seconds to HH:MM:SS or MM:SS
  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Format file size to human readable
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  // Start the elapsed timer
  function startTimer() {
    stopTimer();
    timerInterval = window.setInterval(() => {
      elapsedSeconds += 0.1;
      // Auto-stop at max duration
      if (elapsedSeconds >= settings.maxDurationSeconds) {
        stopRecording();
      }
    }, 100);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Backend interactions
  async function startRecording() {
    try {
      await invoke('screenrecord_start', {
        config: {
          format: settings.format,
          quality: settings.quality,
          fps: settings.fps,
          captureAudio: settings.captureAudio,
          captureMicrophone: settings.captureMicrophone,
          captureArea: settings.captureArea,
          maxDurationSeconds: settings.maxDurationSeconds
        }
      });
      recordingStatus = 'recording';
      elapsedSeconds = 0;
      startTimer();
    } catch (error) {
      console.error('Failed to start screen recording:', error);
    }
  }

  async function stopRecording() {
    try {
      recordingStatus = 'processing';
      stopTimer();
      const result = await invoke<{ filePath: string; duration: number }>('screenrecord_stop');
      filePath = result.filePath;
      recordingStatus = 'idle';
      elapsedSeconds = 0;
      await loadRecordings();
    } catch (error) {
      console.error('Failed to stop screen recording:', error);
      recordingStatus = 'idle';
    }
  }

  async function pauseRecording() {
    try {
      await invoke('screenrecord_pause');
      recordingStatus = 'paused';
      stopTimer();
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  }

  async function resumeRecording() {
    try {
      await invoke('screenrecord_resume');
      recordingStatus = 'recording';
      startTimer();
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  }

  async function cancelRecording() {
    try {
      await invoke('screenrecord_cancel');
      recordingStatus = 'idle';
      elapsedSeconds = 0;
      stopTimer();
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }

  async function loadSettings() {
    try {
      settings = await invoke<ScreenRecordSettings>('screenrecord_get_settings');
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings() {
    try {
      await invoke('screenrecord_update_settings', { settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  async function loadRecordings() {
    try {
      recordings = await invoke<RecordingInfo[]>('screenrecord_list_recordings');
    } catch (error) {
      console.error('Failed to load recordings:', error);
      recordings = [];
    }
  }

  async function deleteRecording(path: string) {
    try {
      await invoke('screenrecord_delete_recording', { path });
      await loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  }

  async function refreshState() {
    try {
      const snap = await invoke<RecordingStateSnapshot>('screenrecord_get_state');
      recordingStatus = snap.status;
      elapsedSeconds = snap.elapsedSeconds;
      filePath = snap.filePath;
    } catch (error) {
      console.error('Failed to get recording state:', error);
    }
  }

  // Handle state change events from backend
  function handleStateChanged(event: { payload: RecordingStateSnapshot }) {
    const snap = event.payload;
    recordingStatus = snap.status;
    elapsedSeconds = snap.elapsedSeconds;
    filePath = snap.filePath;

    if (snap.status === 'recording') {
      startTimer();
    } else {
      stopTimer();
    }
  }

  onMount(async () => {
    await loadSettings();
    await refreshState();
    await loadRecordings();

    unlisten = await listen<RecordingStateSnapshot>('screenrecord-state-changed', handleStateChanged);
  });

  onDestroy(() => {
    stopTimer();
    if (unlisten) {
      unlisten();
    }
  });
</script>

<div class="screen-record-manager">
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      {#if recordingStatus === 'recording'}
        <span class="recording-dot"></span>
      {:else if recordingStatus === 'paused'}
        <span class="paused-dot"></span>
      {:else if recordingStatus === 'processing'}
        <span class="processing-dot"></span>
      {/if}
      <h3>Screen Recorder</h3>
    </div>
    <div class="header-actions">
      <button
        class="icon-btn"
        class:active={showRecordingsList}
        on:click={() => { showRecordingsList = !showRecordingsList; showSettings = false; }}
        title="Saved recordings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button
        class="icon-btn"
        class:active={showSettings}
        on:click={() => { showSettings = !showSettings; showRecordingsList = false; }}
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="settings-panel">
      <div class="setting-group">
        <label>
          <span class="setting-label">Format</span>
          <select bind:value={settings.format} on:change={saveSettings}>
            <option value="mp4">MP4 (recommended)</option>
            <option value="webm">WebM</option>
            <option value="gif">GIF (no audio)</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          <span class="setting-label">Quality</span>
          <select bind:value={settings.quality} on:change={saveSettings}>
            <option value="low">Low (smaller file)</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra (best quality)</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          <span class="setting-label">Frame Rate</span>
          <select bind:value={settings.fps} on:change={saveSettings}>
            <option value={15}>15 FPS</option>
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          <span class="setting-label">Capture Area</span>
          <select bind:value={settings.captureArea} on:change={saveSettings}>
            <option value="fullscreen">Full Screen</option>
            <option value="window">Window</option>
            <option value="region">Region</option>
          </select>
        </label>
      </div>

      <div class="setting-group">
        <label>
          <span class="setting-label">Max Duration (seconds)</span>
          <input
            type="number"
            bind:value={settings.maxDurationSeconds}
            on:change={saveSettings}
            min="1"
            max="3600"
          />
        </label>
      </div>

      <div class="setting-group toggles">
        <label class="toggle-label">
          <input
            type="checkbox"
            bind:checked={settings.captureAudio}
            on:change={saveSettings}
          />
          <span>Capture system audio</span>
        </label>
        <label class="toggle-label">
          <input
            type="checkbox"
            bind:checked={settings.captureMicrophone}
            on:change={saveSettings}
          />
          <span>Capture microphone</span>
        </label>
      </div>
    </div>
  {/if}

  <!-- Recording Display -->
  <div class="recording-display">
    <!-- Timer -->
    <div class="timer-container">
      <div
        class="timer"
        class:recording={recordingStatus === 'recording'}
        class:paused={recordingStatus === 'paused'}
        class:processing={recordingStatus === 'processing'}
      >
        {formatTime(elapsedSeconds)}
      </div>
      {#if recordingStatus !== 'idle'}
        <div class="timer-max">/ {formatTime(settings.maxDurationSeconds)}</div>
      {/if}
      {#if recordingStatus === 'processing'}
        <div class="processing-label">Processing...</div>
      {/if}
    </div>

    <!-- Progress bar for max duration -->
    {#if recordingStatus === 'recording' || recordingStatus === 'paused'}
      <div class="duration-progress">
        <div
          class="duration-bar"
          style="width: {Math.min((elapsedSeconds / settings.maxDurationSeconds) * 100, 100)}%"
        ></div>
      </div>
    {/if}

    <!-- Recording indicator with status labels -->
    {#if recordingStatus === 'recording'}
      <div class="status-badge recording-badge">
        <span class="rec-dot"></span>
        REC
      </div>
    {:else if recordingStatus === 'paused'}
      <div class="status-badge paused-badge">
        PAUSED
      </div>
    {/if}
  </div>

  <!-- Controls -->
  <div class="controls">
    {#if recordingStatus === 'idle'}
      <button class="btn btn-record" on:click={startRecording} title="Start recording">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>Start Recording</span>
      </button>
    {:else if recordingStatus === 'recording'}
      <button class="btn btn-cancel" on:click={cancelRecording} title="Cancel recording">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="btn btn-pause" on:click={pauseRecording} title="Pause recording">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
      <button class="btn btn-stop" on:click={stopRecording} title="Stop recording">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
        <span>Stop</span>
      </button>
    {:else if recordingStatus === 'paused'}
      <button class="btn btn-cancel" on:click={cancelRecording} title="Cancel recording">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="btn btn-resume" on:click={resumeRecording} title="Resume recording">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Resume</span>
      </button>
      <button class="btn btn-stop" on:click={stopRecording} title="Stop recording">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
        <span>Stop</span>
      </button>
    {:else if recordingStatus === 'processing'}
      <div class="processing-spinner"></div>
    {/if}
  </div>

  <!-- Recordings List -->
  {#if showRecordingsList}
    <div class="recordings-list">
      <div class="recordings-header">
        <span>Saved Recordings ({recordings.length})</span>
        <button class="icon-btn small" on:click={loadRecordings} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {#if recordings.length === 0}
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
            <line x1="7" y1="2" x2="7" y2="22"/>
            <line x1="17" y1="2" x2="17" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="7" x2="7" y2="7"/>
            <line x1="2" y1="17" x2="7" y2="17"/>
            <line x1="17" y1="7" x2="22" y2="7"/>
            <line x1="17" y1="17" x2="22" y2="17"/>
          </svg>
          <p>No recordings yet</p>
        </div>
      {:else}
        {#each recordings as recording}
          <div class="recording-item">
            <div class="recording-thumbnail">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <div class="recording-details">
              <div class="recording-name" title={recording.fileName}>{recording.fileName}</div>
              <div class="recording-meta">
                <span>{formatFileSize(recording.fileSize)}</span>
                <span class="meta-dot"></span>
                <span>{formatTime(recording.duration)}</span>
                <span class="meta-dot"></span>
                <span>{recording.format.toUpperCase()}</span>
              </div>
              <div class="recording-date">{recording.createdAt}</div>
            </div>
            <button
              class="icon-btn delete-btn"
              on:click={() => deleteRecording(recording.path)}
              title="Delete recording"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .screen-record-manager {
    width: 340px;
    background: #1e1f22;
    border: 1px solid #3f4147;
    border-radius: 12px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #dbdee1;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #3f4147;
    background: #2b2d31;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #f2f3f5;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #b5bac1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }

  .icon-btn:hover {
    background: #313338;
    color: #f2f3f5;
  }

  .icon-btn.active {
    background: #5865f2;
    color: #fff;
  }

  .icon-btn.small {
    width: 24px;
    height: 24px;
  }

  /* Recording dot indicators in header */
  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ed4245;
    animation: pulse-dot 1s ease-in-out infinite;
  }

  .paused-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fee75c;
    animation: blink 1s ease-in-out infinite;
  }

  .processing-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #5865f2;
    animation: pulse-dot 0.6s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* Settings Panel */
  .settings-panel {
    padding: 12px 16px;
    background: #2b2d31;
    border-bottom: 1px solid #3f4147;
  }

  .setting-group {
    margin-bottom: 12px;
  }

  .setting-group:last-child {
    margin-bottom: 0;
  }

  .setting-group label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 500;
    color: #b5bac1;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .settings-panel select,
  .settings-panel input[type="number"] {
    width: 100%;
    padding: 8px 10px;
    background: #1e1f22;
    border: 1px solid #3f4147;
    border-radius: 6px;
    color: #dbdee1;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
    -webkit-appearance: none;
    appearance: none;
  }

  .settings-panel select:focus,
  .settings-panel input[type="number"]:focus {
    border-color: #5865f2;
  }

  .setting-group.toggles {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toggle-label {
    display: flex;
    flex-direction: row !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: #dbdee1;
  }

  .toggle-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #5865f2;
    cursor: pointer;
  }

  /* Recording Display */
  .recording-display {
    padding: 20px 16px 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .timer-container {
    text-align: center;
  }

  .timer {
    font-size: 36px;
    font-weight: 700;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    color: #f2f3f5;
    letter-spacing: 2px;
    transition: color 0.2s;
  }

  .timer.recording {
    color: #ed4245;
  }

  .timer.paused {
    color: #fee75c;
    animation: blink 1s ease-in-out infinite;
  }

  .timer.processing {
    color: #5865f2;
  }

  .timer-max {
    font-size: 13px;
    color: #6d6f78;
    font-family: 'SF Mono', 'Fira Code', monospace;
    margin-top: 2px;
  }

  .processing-label {
    font-size: 12px;
    color: #5865f2;
    margin-top: 4px;
    animation: blink 1s ease-in-out infinite;
  }

  /* Duration progress bar */
  .duration-progress {
    width: 100%;
    height: 4px;
    background: #313338;
    border-radius: 2px;
    overflow: hidden;
  }

  .duration-bar {
    height: 100%;
    background: linear-gradient(90deg, #5865f2, #ed4245);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  /* Status badge */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
  }

  .recording-badge {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }

  .paused-badge {
    background: rgba(254, 231, 92, 0.15);
    color: #fee75c;
  }

  .rec-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ed4245;
    animation: pulse-dot 1s ease-in-out infinite;
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px 16px;
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 0.15s, transform 0.1s;
  }

  .btn:active {
    transform: scale(0.96);
  }

  .btn-record {
    padding: 10px 24px;
    background: #ed4245;
    color: #fff;
    border-radius: 24px;
  }

  .btn-record:hover {
    background: #d83c3f;
  }

  .btn-stop {
    padding: 10px 20px;
    background: #ed4245;
    color: #fff;
    border-radius: 20px;
  }

  .btn-stop:hover {
    background: #d83c3f;
  }

  .btn-pause {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #313338;
    color: #f2f3f5;
  }

  .btn-pause:hover {
    background: #3f4147;
  }

  .btn-resume {
    padding: 10px 20px;
    background: #57f287;
    color: #1e1f22;
    border-radius: 20px;
  }

  .btn-resume:hover {
    background: #49d677;
  }

  .btn-cancel {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(237, 66, 69, 0.15);
    color: #ed4245;
  }

  .btn-cancel:hover {
    background: rgba(237, 66, 69, 0.25);
  }

  /* Processing spinner */
  .processing-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #313338;
    border-top-color: #5865f2;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Recordings List */
  .recordings-list {
    border-top: 1px solid #3f4147;
    max-height: 300px;
    overflow-y: auto;
  }

  .recordings-list::-webkit-scrollbar {
    width: 6px;
  }

  .recordings-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .recordings-list::-webkit-scrollbar-thumb {
    background: #3f4147;
    border-radius: 3px;
  }

  .recordings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    color: #b5bac1;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    background: #2b2d31;
    border-bottom: 1px solid #3f4147;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: #6d6f78;
  }

  .empty-state svg {
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 13px;
  }

  .recording-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(63, 65, 71, 0.5);
    transition: background 0.1s;
  }

  .recording-item:hover {
    background: #2b2d31;
  }

  .recording-item:last-child {
    border-bottom: none;
  }

  .recording-thumbnail {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    background: #313338;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #b5bac1;
    flex-shrink: 0;
  }

  .recording-details {
    flex: 1;
    min-width: 0;
  }

  .recording-name {
    font-size: 13px;
    font-weight: 500;
    color: #f2f3f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recording-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #b5bac1;
    margin-top: 2px;
  }

  .meta-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: #6d6f78;
  }

  .recording-date {
    font-size: 11px;
    color: #6d6f78;
    margin-top: 1px;
  }

  .delete-btn {
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .recording-item:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: rgba(237, 66, 69, 0.2) !important;
    color: #ed4245 !important;
  }
</style>
