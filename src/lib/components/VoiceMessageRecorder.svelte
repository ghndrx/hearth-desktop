<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived } from 'svelte/store';

  // Recording state
  interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioLevel: number;
    filePath: string | null;
    waveformData: number[];
    maxDuration: number;
  }

  const recordingState = writable<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    filePath: null,
    waveformData: [],
    maxDuration: 300 // 5 minutes max
  });

  // Settings
  interface RecorderSettings {
    inputDevice: string;
    quality: 'low' | 'medium' | 'high';
    format: 'opus' | 'mp3' | 'wav';
    noiseReduction: boolean;
    autoStopOnSilence: boolean;
    silenceThreshold: number;
    silenceDuration: number;
    showWaveform: boolean;
    playbackPreview: boolean;
  }

  const settings = writable<RecorderSettings>({
    inputDevice: 'default',
    quality: 'high',
    format: 'opus',
    noiseReduction: true,
    autoStopOnSilence: false,
    silenceThreshold: -50,
    silenceDuration: 3,
    showWaveform: true,
    playbackPreview: true
  });

  // Available audio devices
  let audioDevices: Array<{ id: string; name: string }> = [];
  let showSettings = false;
  let isExpanded = false;
  let previewAudio: HTMLAudioElement | null = null;
  let isPlaying = false;
  let playbackProgress = 0;

  // Animation
  let animationFrame: number;
  let timerInterval: number;

  // Waveform canvas
  let waveformCanvas: HTMLCanvasElement;
  let canvasCtx: CanvasRenderingContext2D | null = null;

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get audio level color
  const getLevelColor = (level: number): string => {
    if (level > 0.8) return '#ef4444'; // Red - too loud
    if (level > 0.6) return '#f59e0b'; // Amber - good
    if (level > 0.3) return '#22c55e'; // Green - normal
    return '#6b7280'; // Gray - quiet
  };

  // Start recording
  async function startRecording() {
    try {
      const { inputDevice, quality, format, noiseReduction } = $settings;
      
      const result = await invoke<{ filePath: string }>('start_voice_recording', {
        config: {
          device: inputDevice,
          quality,
          format,
          noise_reduction: noiseReduction
        }
      });

      recordingState.update(s => ({
        ...s,
        isRecording: true,
        isPaused: false,
        duration: 0,
        filePath: result.filePath,
        waveformData: []
      }));

      startTimer();
      startLevelMonitoring();
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  // Stop recording
  async function stopRecording() {
    try {
      const result = await invoke<{ filePath: string; duration: number }>('stop_voice_recording');
      
      recordingState.update(s => ({
        ...s,
        isRecording: false,
        isPaused: false,
        filePath: result.filePath,
        duration: result.duration
      }));

      stopTimer();
      stopLevelMonitoring();

      // Show preview if enabled
      if ($settings.playbackPreview && result.filePath) {
        previewAudio = new Audio(`file://${result.filePath}`);
        previewAudio.addEventListener('ended', () => {
          isPlaying = false;
          playbackProgress = 0;
        });
        previewAudio.addEventListener('timeupdate', () => {
          if (previewAudio) {
            playbackProgress = (previewAudio.currentTime / previewAudio.duration) * 100;
          }
        });
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }

  // Pause/resume recording
  async function togglePause() {
    try {
      if ($recordingState.isPaused) {
        await invoke('resume_voice_recording');
        startTimer();
      } else {
        await invoke('pause_voice_recording');
        stopTimer();
      }
      
      recordingState.update(s => ({
        ...s,
        isPaused: !s.isPaused
      }));
    } catch (error) {
      console.error('Failed to toggle pause:', error);
    }
  }

  // Cancel recording
  async function cancelRecording() {
    try {
      await invoke('cancel_voice_recording');
      
      recordingState.update(s => ({
        ...s,
        isRecording: false,
        isPaused: false,
        duration: 0,
        filePath: null,
        waveformData: [],
        audioLevel: 0
      }));

      stopTimer();
      stopLevelMonitoring();
    } catch (error) {
      console.error('Failed to cancel recording:', error);
    }
  }

  // Send recorded voice message
  async function sendVoiceMessage() {
    if (!$recordingState.filePath) return;

    try {
      // Emit custom event for parent to handle
      const event = new CustomEvent('voiceMessageReady', {
        detail: {
          filePath: $recordingState.filePath,
          duration: $recordingState.duration,
          format: $settings.format
        }
      });
      window.dispatchEvent(event);

      // Reset state
      recordingState.update(s => ({
        ...s,
        filePath: null,
        duration: 0,
        waveformData: []
      }));
      
      previewAudio = null;
      isPlaying = false;
      playbackProgress = 0;
    } catch (error) {
      console.error('Failed to send voice message:', error);
    }
  }

  // Timer management
  function startTimer() {
    timerInterval = window.setInterval(() => {
      recordingState.update(s => {
        const newDuration = s.duration + 0.1;
        
        // Auto-stop at max duration
        if (newDuration >= s.maxDuration) {
          stopRecording();
          return s;
        }
        
        return { ...s, duration: newDuration };
      });
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  }

  // Audio level monitoring
  function startLevelMonitoring() {
    const updateLevel = async () => {
      try {
        const level = await invoke<number>('get_audio_level');
        
        recordingState.update(s => {
          const newWaveform = [...s.waveformData, level].slice(-100);
          return {
            ...s,
            audioLevel: level,
            waveformData: newWaveform
          };
        });

        // Check silence detection
        if ($settings.autoStopOnSilence) {
          checkSilence(level);
        }

        // Draw waveform
        if ($settings.showWaveform && canvasCtx) {
          drawWaveform();
        }
      } catch (error) {
        // Ignore polling errors
      }

      if ($recordingState.isRecording && !$recordingState.isPaused) {
        animationFrame = requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  }

  function stopLevelMonitoring() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  }

  // Silence detection
  let silenceStartTime: number | null = null;

  function checkSilence(level: number) {
    const db = 20 * Math.log10(level || 0.0001);
    
    if (db < $settings.silenceThreshold) {
      if (!silenceStartTime) {
        silenceStartTime = Date.now();
      } else if ((Date.now() - silenceStartTime) / 1000 >= $settings.silenceDuration) {
        stopRecording();
        silenceStartTime = null;
      }
    } else {
      silenceStartTime = null;
    }
  }

  // Draw waveform visualization
  function drawWaveform() {
    if (!canvasCtx || !waveformCanvas) return;

    const { width, height } = waveformCanvas;
    const data = $recordingState.waveformData;

    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    canvasCtx.strokeStyle = '#3b82f6';
    canvasCtx.lineWidth = 2;

    const barWidth = width / data.length;
    const centerY = height / 2;

    canvasCtx.beginPath();
    data.forEach((level, i) => {
      const barHeight = level * height * 0.8;
      const x = i * barWidth;
      const y = centerY - barHeight / 2;

      canvasCtx.fillRect(x, y, barWidth - 1, barHeight);
      
      if (i === 0) {
        canvasCtx.moveTo(x, centerY - level * centerY);
      } else {
        canvasCtx.lineTo(x, centerY - level * centerY);
      }
    });
    canvasCtx.stroke();
  }

  // Preview playback controls
  function togglePlayback() {
    if (!previewAudio) return;

    if (isPlaying) {
      previewAudio.pause();
    } else {
      previewAudio.play();
    }
    isPlaying = !isPlaying;
  }

  // Load audio devices
  async function loadAudioDevices() {
    try {
      audioDevices = await invoke<Array<{ id: string; name: string }>>('list_audio_input_devices');
    } catch (error) {
      console.error('Failed to load audio devices:', error);
      audioDevices = [{ id: 'default', name: 'Default Device' }];
    }
  }

  // Save settings
  function saveSettings(newSettings: Partial<RecorderSettings>) {
    settings.update(s => ({ ...s, ...newSettings }));
    localStorage.setItem('voiceRecorderSettings', JSON.stringify($settings));
  }

  // Load settings
  function loadSettings() {
    const saved = localStorage.getItem('voiceRecorderSettings');
    if (saved) {
      try {
        settings.set({ ...$settings, ...JSON.parse(saved) });
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }
  }

  onMount(() => {
    loadSettings();
    loadAudioDevices();
    
    if (waveformCanvas) {
      canvasCtx = waveformCanvas.getContext('2d');
    }
  });

  onDestroy(() => {
    stopTimer();
    stopLevelMonitoring();
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
  });
</script>

<div class="voice-recorder" class:expanded={isExpanded}>
  <!-- Compact Mode -->
  {#if !isExpanded && !$recordingState.isRecording}
    <button
      class="mic-button"
      on:click={() => isExpanded = true}
      title="Record voice message"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </button>
  {:else}
    <!-- Expanded Recording Interface -->
    <div class="recorder-panel">
      <div class="recorder-header">
        <h3>Voice Message</h3>
        <div class="header-actions">
          <button
            class="icon-btn"
            on:click={() => showSettings = !showSettings}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
            </svg>
          </button>
          {#if !$recordingState.isRecording}
            <button
              class="icon-btn close"
              on:click={() => isExpanded = false}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          {/if}
        </div>
      </div>

      <!-- Settings Panel -->
      {#if showSettings}
        <div class="settings-panel">
          <label>
            <span>Input Device</span>
            <select
              value={$settings.inputDevice}
              on:change={(e) => saveSettings({ inputDevice: e.currentTarget.value })}
            >
              {#each audioDevices as device}
                <option value={device.id}>{device.name}</option>
              {/each}
            </select>
          </label>

          <label>
            <span>Quality</span>
            <select
              value={$settings.quality}
              on:change={(e) => saveSettings({ quality: e.currentTarget.value as any })}
            >
              <option value="low">Low (smaller file)</option>
              <option value="medium">Medium</option>
              <option value="high">High (best quality)</option>
            </select>
          </label>

          <label>
            <span>Format</span>
            <select
              value={$settings.format}
              on:change={(e) => saveSettings({ format: e.currentTarget.value as any })}
            >
              <option value="opus">Opus (recommended)</option>
              <option value="mp3">MP3</option>
              <option value="wav">WAV (uncompressed)</option>
            </select>
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              checked={$settings.noiseReduction}
              on:change={(e) => saveSettings({ noiseReduction: e.currentTarget.checked })}
            />
            <span>Noise reduction</span>
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              checked={$settings.showWaveform}
              on:change={(e) => saveSettings({ showWaveform: e.currentTarget.checked })}
            />
            <span>Show waveform</span>
          </label>

          <label class="checkbox">
            <input
              type="checkbox"
              checked={$settings.autoStopOnSilence}
              on:change={(e) => saveSettings({ autoStopOnSilence: e.currentTarget.checked })}
            />
            <span>Auto-stop on silence ({$settings.silenceDuration}s)</span>
          </label>
        </div>
      {/if}

      <!-- Recording State -->
      <div class="recording-area">
        {#if $settings.showWaveform && $recordingState.isRecording}
          <canvas
            bind:this={waveformCanvas}
            class="waveform-canvas"
            width="280"
            height="60"
          />
        {/if}

        <!-- Audio Level Indicator -->
        {#if $recordingState.isRecording}
          <div class="level-meter">
            <div
              class="level-bar"
              style="width: {$recordingState.audioLevel * 100}%; background-color: {getLevelColor($recordingState.audioLevel)}"
            />
          </div>
        {/if}

        <!-- Timer Display -->
        <div class="timer" class:recording={$recordingState.isRecording} class:paused={$recordingState.isPaused}>
          <span class="time">{formatDuration($recordingState.duration)}</span>
          {#if $recordingState.isRecording}
            <span class="max-time">/ {formatDuration($recordingState.maxDuration)}</span>
          {/if}
        </div>

        <!-- Recording Controls -->
        <div class="controls">
          {#if !$recordingState.isRecording && !$recordingState.filePath}
            <!-- Start Recording -->
            <button class="record-btn" on:click={startRecording}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"/>
              </svg>
              <span>Record</span>
            </button>
          {:else if $recordingState.isRecording}
            <!-- Recording Controls -->
            <button class="cancel-btn" on:click={cancelRecording} title="Cancel">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <button class="pause-btn" on:click={togglePause} title={$recordingState.isPaused ? 'Resume' : 'Pause'}>
              {#if $recordingState.isPaused}
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

            <button class="stop-btn" on:click={stopRecording} title="Stop">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
            </button>
          {:else if $recordingState.filePath}
            <!-- Preview Controls -->
            <div class="preview-controls">
              <button class="play-btn" on:click={togglePlayback}>
                {#if isPlaying}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                {:else}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                {/if}
              </button>

              <div class="progress-bar">
                <div class="progress" style="width: {playbackProgress}%"/>
              </div>

              <span class="duration">{formatDuration($recordingState.duration)}</span>
            </div>

            <div class="send-controls">
              <button class="discard-btn" on:click={cancelRecording}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Discard
              </button>
              <button class="send-btn" on:click={sendVoiceMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-recorder {
    position: relative;
  }

  .mic-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .mic-button:hover {
    background: var(--accent-color, #5865f2);
    transform: scale(1.05);
  }

  .recorder-panel {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 8px;
    width: 320px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    z-index: 1000;
  }

  .recorder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #3d3d3d);
  }

  .recorder-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #999);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
  }

  .icon-btn.close:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .settings-panel {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #3d3d3d);
    background: var(--bg-secondary, #2d2d2d);
  }

  .settings-panel label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--text-secondary, #999);
  }

  .settings-panel label.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .settings-panel select {
    padding: 6px 8px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #3d3d3d);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .settings-panel input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color, #5865f2);
  }

  .recording-area {
    padding: 16px;
  }

  .waveform-canvas {
    width: 100%;
    height: 60px;
    border-radius: 8px;
    background: var(--bg-secondary, #2d2d2d);
    margin-bottom: 12px;
  }

  .level-meter {
    height: 4px;
    background: var(--bg-secondary, #2d2d2d);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .level-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 0.05s, background-color 0.1s;
  }

  .timer {
    text-align: center;
    margin-bottom: 16px;
    font-family: 'SF Mono', monospace;
  }

  .timer .time {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .timer.recording .time {
    color: #ef4444;
  }

  .timer.paused .time {
    color: #f59e0b;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    50% { opacity: 0.5; }
  }

  .timer .max-time {
    font-size: 14px;
    color: var(--text-secondary, #999);
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .record-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: #ef4444;
    border: none;
    border-radius: 24px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .record-btn:hover {
    background: #dc2626;
    transform: scale(1.02);
  }

  .cancel-btn, .pause-btn, .stop-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .cancel-btn:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  .pause-btn {
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
  }

  .pause-btn:hover {
    background: var(--bg-tertiary, #3d3d3d);
  }

  .stop-btn {
    background: #ef4444;
    color: white;
  }

  .stop-btn:hover {
    background: #dc2626;
  }

  .preview-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-bottom: 12px;
  }

  .play-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--accent-color, #5865f2);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .play-btn:hover {
    background: var(--accent-hover, #4752c4);
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: var(--bg-secondary, #2d2d2d);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: var(--accent-color, #5865f2);
    border-radius: 2px;
    transition: width 0.1s;
  }

  .duration {
    font-size: 12px;
    color: var(--text-secondary, #999);
    font-family: 'SF Mono', monospace;
  }

  .send-controls {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .discard-btn, .send-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .discard-btn {
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
  }

  .discard-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .send-btn {
    background: var(--accent-color, #5865f2);
    color: white;
  }

  .send-btn:hover {
    background: var(--accent-hover, #4752c4);
  }
</style>
</script>
