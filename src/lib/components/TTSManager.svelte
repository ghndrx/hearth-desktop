<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  interface TTSVoice {
    id: string;
    name: string;
    language: string;
    gender: string | null;
    local: boolean;
  }

  interface TTSSettings {
    enabled: boolean;
    voice_id: string | null;
    rate: number;
    pitch: number;
    volume: number;
    auto_read_messages: boolean;
    auto_read_notifications: boolean;
    announce_user_join_leave: boolean;
    read_usernames: boolean;
    read_timestamps: boolean;
  }

  interface TTSQueueItem {
    id: string;
    text: string;
    priority: 'Low' | 'Normal' | 'High' | 'Urgent';
    voice_id: string | null;
  }

  interface TTSStatus {
    is_speaking: boolean;
    current_item_id: string | null;
    queue_length: number;
  }

  const dispatch = createEventDispatcher<{
    'settings-change': TTSSettings;
    'speaking': TTSQueueItem;
    'stopped': void;
    'error': string;
  }>();

  // State
  let settings: TTSSettings = {
    enabled: false,
    voice_id: null,
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    auto_read_messages: false,
    auto_read_notifications: true,
    announce_user_join_leave: false,
    read_usernames: true,
    read_timestamps: false,
  };
  let voices: TTSVoice[] = [];
  let status: TTSStatus = {
    is_speaking: false,
    current_item_id: null,
    queue_length: 0,
  };
  let queue: TTSQueueItem[] = [];
  let loading = true;
  let error: string | null = null;
  let testText = 'Hello! This is a test of the text-to-speech system.';
  let showAdvanced = false;

  // Event listeners
  let unlistenFns: UnlistenFn[] = [];

  onMount(async () => {
    try {
      // Initialize TTS system
      await invoke('tts_init');
      
      // Load voices and settings
      voices = await invoke<TTSVoice[]>('tts_get_voices');
      settings = await invoke<TTSSettings>('tts_get_settings');
      status = await invoke<TTSStatus>('tts_get_status');
      queue = await invoke<TTSQueueItem[]>('tts_get_queue');
      
      // Set up event listeners
      unlistenFns.push(
        await listen<TTSSettings>('tts-settings-changed', (event) => {
          settings = event.payload;
          dispatch('settings-change', settings);
        }),
        await listen<TTSQueueItem>('tts-speaking', (event) => {
          status.is_speaking = true;
          status.current_item_id = event.payload.id;
          dispatch('speaking', event.payload);
        }),
        await listen<string>('tts-item-complete', () => {
          refreshStatus();
        }),
        await listen('tts-stopped', () => {
          status.is_speaking = false;
          status.current_item_id = null;
          status.queue_length = 0;
          dispatch('stopped');
        }),
        await listen('tts-queue-empty', () => {
          status.is_speaking = false;
          status.queue_length = 0;
          queue = [];
        }),
        await listen('tts-paused', () => {
          // Could track paused state if needed
        }),
        await listen('tts-resumed', () => {
          // Could track resumed state if needed
        })
      );
      
      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      loading = false;
    }
  });

  onDestroy(() => {
    unlistenFns.forEach(fn => fn());
  });

  async function refreshStatus() {
    try {
      status = await invoke<TTSStatus>('tts_get_status');
      queue = await invoke<TTSQueueItem[]>('tts_get_queue');
    } catch (err) {
      console.error('Failed to refresh TTS status:', err);
    }
  }

  async function saveSettings() {
    try {
      await invoke('tts_set_settings', { settings });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', error);
    }
  }

  async function toggleEnabled() {
    settings.enabled = !settings.enabled;
    await saveSettings();
  }

  async function speak(text: string, priority: 'Low' | 'Normal' | 'High' | 'Urgent' = 'Normal') {
    try {
      error = null;
      await invoke('tts_speak', { text, priority });
      await refreshStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      dispatch('error', error);
    }
  }

  async function stop() {
    try {
      await invoke('tts_stop');
      await refreshStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function pause() {
    try {
      await invoke('tts_pause');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function resume() {
    try {
      await invoke('tts_resume');
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function skip() {
    try {
      await invoke('tts_skip');
      await refreshStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function removeFromQueue(itemId: string) {
    try {
      await invoke('tts_remove_from_queue', { itemId });
      await refreshStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function testVoice() {
    speak(testText, 'High');
  }

  function getVoiceLabel(voice: TTSVoice): string {
    let label = voice.name;
    if (voice.language) {
      label += ` (${voice.language})`;
    }
    if (voice.gender) {
      label += ` - ${voice.gender}`;
    }
    return label;
  }

  // Export public API
  export { speak, stop, pause, resume, skip, settings, status };
</script>

<div class="tts-manager">
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <span>Initializing text-to-speech...</span>
    </div>
  {:else}
    {#if error}
      <div class="error-banner">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{error}</span>
        <button class="dismiss" on:click={() => error = null}>×</button>
      </div>
    {/if}

    <div class="section">
      <div class="section-header">
        <h3>Text-to-Speech</h3>
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            on:change={toggleEnabled}
          />
          <span class="slider"></span>
        </label>
      </div>
      <p class="description">
        Enable screen reader support with native text-to-speech synthesis.
      </p>
    </div>

    {#if settings.enabled}
      <div class="section">
        <h4>Voice Settings</h4>
        
        <div class="form-group">
          <label for="voice-select">Voice</label>
          <select
            id="voice-select"
            bind:value={settings.voice_id}
            on:change={saveSettings}
          >
            <option value={null}>System Default</option>
            {#each voices as voice}
              <option value={voice.id}>{getVoiceLabel(voice)}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="rate-slider">
            Speed: {settings.rate.toFixed(1)}x
          </label>
          <input
            id="rate-slider"
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            bind:value={settings.rate}
            on:change={saveSettings}
          />
          <div class="range-labels">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>

        <div class="form-group">
          <label for="volume-slider">
            Volume: {Math.round(settings.volume * 100)}%
          </label>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={settings.volume}
            on:change={saveSettings}
          />
        </div>

        <button class="btn-secondary" on:click={() => showAdvanced = !showAdvanced}>
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          <svg class="icon chevron" class:rotated={showAdvanced} viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {#if showAdvanced}
          <div class="advanced-settings">
            <div class="form-group">
              <label for="pitch-slider">
                Pitch: {settings.pitch.toFixed(1)}
              </label>
              <input
                id="pitch-slider"
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                bind:value={settings.pitch}
                on:change={saveSettings}
              />
            </div>
          </div>
        {/if}

        <div class="test-section">
          <input
            type="text"
            bind:value={testText}
            placeholder="Enter text to test..."
            class="test-input"
          />
          <button class="btn-primary" on:click={testVoice} disabled={!testText}>
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Test Voice
          </button>
        </div>
      </div>

      <div class="section">
        <h4>Auto-Read Options</h4>
        
        <label class="checkbox-option">
          <input
            type="checkbox"
            bind:checked={settings.auto_read_messages}
            on:change={saveSettings}
          />
          <span class="checkmark"></span>
          <div class="option-content">
            <span class="option-label">Auto-read new messages</span>
            <span class="option-desc">Automatically read incoming chat messages</span>
          </div>
        </label>

        <label class="checkbox-option">
          <input
            type="checkbox"
            bind:checked={settings.auto_read_notifications}
            on:change={saveSettings}
          />
          <span class="checkmark"></span>
          <div class="option-content">
            <span class="option-label">Read notifications</span>
            <span class="option-desc">Speak notification content aloud</span>
          </div>
        </label>

        <label class="checkbox-option">
          <input
            type="checkbox"
            bind:checked={settings.announce_user_join_leave}
            on:change={saveSettings}
          />
          <span class="checkmark"></span>
          <div class="option-content">
            <span class="option-label">Announce user activity</span>
            <span class="option-desc">Announce when users join or leave voice channels</span>
          </div>
        </label>

        <label class="checkbox-option">
          <input
            type="checkbox"
            bind:checked={settings.read_usernames}
            on:change={saveSettings}
          />
          <span class="checkmark"></span>
          <div class="option-content">
            <span class="option-label">Include usernames</span>
            <span class="option-desc">Read the sender's name before each message</span>
          </div>
        </label>

        <label class="checkbox-option">
          <input
            type="checkbox"
            bind:checked={settings.read_timestamps}
            on:change={saveSettings}
          />
          <span class="checkmark"></span>
          <div class="option-content">
            <span class="option-label">Include timestamps</span>
            <span class="option-desc">Read the time when messages were sent</span>
          </div>
        </label>
      </div>

      {#if status.is_speaking || queue.length > 0}
        <div class="section playback-section">
          <h4>Now Playing</h4>
          
          <div class="playback-controls">
            <button class="control-btn" on:click={pause} title="Pause">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>
            <button class="control-btn" on:click={resume} title="Resume">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
            <button class="control-btn" on:click={skip} title="Skip">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4"/>
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
            <button class="control-btn stop" on:click={stop} title="Stop All">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12"/>
              </svg>
            </button>
          </div>

          {#if queue.length > 0}
            <div class="queue">
              <h5>Queue ({queue.length})</h5>
              <ul>
                {#each queue as item (item.id)}
                  <li class="queue-item">
                    <span class="queue-text">{item.text.slice(0, 50)}{item.text.length > 50 ? '...' : ''}</span>
                    <span class="queue-priority priority-{item.priority.toLowerCase()}">{item.priority}</span>
                    <button class="remove-btn" on:click={() => removeFromQueue(item.id)} title="Remove">
                      ×
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .tts-manager {
    padding: 1rem;
    max-width: 600px;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    justify-content: center;
    color: var(--text-muted, #888);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--bg-tertiary, #333);
    border-top-color: var(--accent, #5865f2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--error-bg, #f04747);
    color: white;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .error-banner .icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .error-banner .dismiss {
    margin-left: auto;
    background: none;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 0.25rem;
    opacity: 0.8;
  }

  .error-banner .dismiss:hover {
    opacity: 1;
  }

  .section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .section:last-child {
    border-bottom: none;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  h5 {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted, #888);
  }

  .description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted, #888);
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--bg-tertiary, #333);
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }

  .toggle input:checked + .slider {
    background-color: var(--accent, #5865f2);
  }

  .toggle input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* Form elements */
  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary, #b9bbbe);
  }

  select, input[type="text"] {
    width: 100%;
    padding: 0.625rem;
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--border-color, #202225);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 0.875rem;
  }

  select:focus, input[type="text"]:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  input[type="range"] {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--bg-tertiary, #333);
    appearance: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--accent, #5865f2);
    cursor: pointer;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted, #888);
    margin-top: 0.25rem;
  }

  /* Buttons */
  .btn-primary, .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s;
  }

  .btn-primary {
    background: var(--accent, #5865f2);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary, #333);
    color: var(--text-primary, #fff);
  }

  .btn-secondary:hover {
    background: var(--bg-tertiary-hover, #444);
  }

  .btn-secondary .icon {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 2;
    fill: none;
    transition: transform 0.2s;
  }

  .btn-secondary .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Test section */
  .test-section {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .test-input {
    flex: 1;
  }

  .btn-primary .icon {
    width: 16px;
    height: 16px;
  }

  /* Advanced settings */
  .advanced-settings {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color, #333);
  }

  /* Checkbox options */
  .checkbox-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .checkbox-option:hover {
    background: var(--bg-secondary-hover, #36393f);
  }

  .checkbox-option input {
    display: none;
  }

  .checkmark {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color, #4f545c);
    border-radius: 4px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .checkbox-option input:checked + .checkmark {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
  }

  .checkbox-option input:checked + .checkmark::after {
    content: '✓';
    color: white;
    font-size: 12px;
    font-weight: bold;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .option-label {
    font-size: 0.875rem;
    color: var(--text-primary, #fff);
  }

  .option-desc {
    font-size: 0.75rem;
    color: var(--text-muted, #888);
  }

  /* Playback controls */
  .playback-section {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 1rem;
  }

  .playback-controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: var(--bg-tertiary, #333);
    color: var(--text-primary, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }

  .control-btn:hover {
    background: var(--bg-tertiary-hover, #444);
  }

  .control-btn.stop:hover {
    background: var(--error-bg, #f04747);
  }

  .control-btn svg {
    width: 18px;
    height: 18px;
  }

  /* Queue */
  .queue ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .queue-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-tertiary, #333);
    border-radius: 6px;
    margin-bottom: 0.25rem;
  }

  .queue-text {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-primary, #fff);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .queue-priority {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .priority-low {
    background: var(--bg-tertiary, #333);
    color: var(--text-muted, #888);
  }

  .priority-normal {
    background: var(--accent, #5865f2);
    color: white;
  }

  .priority-high {
    background: var(--warning, #faa61a);
    color: black;
  }

  .priority-urgent {
    background: var(--error, #f04747);
    color: white;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0 0.25rem;
    line-height: 1;
  }

  .remove-btn:hover {
    color: var(--error, #f04747);
  }
</style>
