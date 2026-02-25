<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  
  // Sound notification settings store
  interface SoundSettings {
    enabled: boolean;
    volume: number;
    messageSound: string;
    mentionSound: string;
    dmSound: string;
    joinSound: string;
    leaveSound: string;
    muteInDnd: boolean;
    muteInFocusMode: boolean;
    customSounds: Record<string, string>;
  }
  
  const defaultSettings: SoundSettings = {
    enabled: true,
    volume: 0.7,
    messageSound: 'pop',
    mentionSound: 'ping',
    dmSound: 'chime',
    joinSound: 'join',
    leaveSound: 'leave',
    muteInDnd: true,
    muteInFocusMode: true,
    customSounds: {},
  };
  
  // Available built-in sounds
  const builtInSounds = [
    { id: 'none', name: 'None', preview: null },
    { id: 'pop', name: 'Pop', preview: '/sounds/pop.mp3' },
    { id: 'ping', name: 'Ping', preview: '/sounds/ping.mp3' },
    { id: 'chime', name: 'Chime', preview: '/sounds/chime.mp3' },
    { id: 'bell', name: 'Bell', preview: '/sounds/bell.mp3' },
    { id: 'ding', name: 'Ding', preview: '/sounds/ding.mp3' },
    { id: 'swoosh', name: 'Swoosh', preview: '/sounds/swoosh.mp3' },
    { id: 'bubble', name: 'Bubble', preview: '/sounds/bubble.mp3' },
    { id: 'join', name: 'Join', preview: '/sounds/join.mp3' },
    { id: 'leave', name: 'Leave', preview: '/sounds/leave.mp3' },
  ];
  
  // Audio context for playing sounds
  let audioContext: AudioContext | null = null;
  let audioCache: Map<string, AudioBuffer> = new Map();
  
  // Settings store with persistence
  export const soundSettings = writable<SoundSettings>(defaultSettings);
  
  // Load settings from store
  async function loadSettings(): Promise<void> {
    try {
      const stored = localStorage.getItem('hearth-sound-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        soundSettings.set({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load sound settings:', error);
    }
  }
  
  // Save settings to store
  function saveSettings(settings: SoundSettings): void {
    try {
      localStorage.setItem('hearth-sound-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save sound settings:', error);
    }
  }
  
  // Subscribe to settings changes for persistence
  soundSettings.subscribe((settings) => {
    if (typeof window !== 'undefined') {
      saveSettings(settings);
    }
  });
  
  // Initialize audio context
  function initAudioContext(): void {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
  }
  
  // Load and cache audio file
  async function loadSound(soundId: string): Promise<AudioBuffer | null> {
    if (soundId === 'none') return null;
    
    // Check cache first
    if (audioCache.has(soundId)) {
      return audioCache.get(soundId)!;
    }
    
    initAudioContext();
    if (!audioContext) return null;
    
    try {
      // Check for custom sound first
      const settings = get(soundSettings);
      const soundPath = settings.customSounds[soundId] || `/sounds/${soundId}.mp3`;
      
      const response = await fetch(soundPath);
      if (!response.ok) {
        console.warn(`Sound not found: ${soundPath}`);
        return null;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Cache the decoded audio
      audioCache.set(soundId, audioBuffer);
      
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load sound ${soundId}:`, error);
      return null;
    }
  }
  
  // Play a sound by ID
  export async function playSound(soundId: string, volumeOverride?: number): Promise<void> {
    const settings = get(soundSettings);
    
    if (!settings.enabled || soundId === 'none') return;
    
    // Check DND status
    if (settings.muteInDnd) {
      try {
        const dndActive = await invoke<boolean>('is_dnd_active');
        if (dndActive) return;
      } catch {
        // Ignore DND check errors
      }
    }
    
    // Check focus mode status
    if (settings.muteInFocusMode) {
      try {
        const focusActive = await invoke<boolean>('is_focus_mode_active');
        if (focusActive) return;
      } catch {
        // Ignore focus mode check errors
      }
    }
    
    initAudioContext();
    if (!audioContext) return;
    
    // Resume audio context if suspended (required by browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const audioBuffer = await loadSound(soundId);
    if (!audioBuffer) return;
    
    // Create and play the sound
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    gainNode.gain.value = volumeOverride ?? settings.volume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start(0);
  }
  
  // Preview a sound (ignores mute settings)
  export async function previewSound(soundId: string): Promise<void> {
    if (soundId === 'none') return;
    
    initAudioContext();
    if (!audioContext) return;
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const audioBuffer = await loadSound(soundId);
    if (!audioBuffer) return;
    
    const settings = get(soundSettings);
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    gainNode.gain.value = settings.volume;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    source.start(0);
  }
  
  // Play notification sound based on event type
  export async function playNotificationSound(
    type: 'message' | 'mention' | 'dm' | 'join' | 'leave'
  ): Promise<void> {
    const settings = get(soundSettings);
    
    let soundId: string;
    switch (type) {
      case 'message':
        soundId = settings.messageSound;
        break;
      case 'mention':
        soundId = settings.mentionSound;
        break;
      case 'dm':
        soundId = settings.dmSound;
        break;
      case 'join':
        soundId = settings.joinSound;
        break;
      case 'leave':
        soundId = settings.leaveSound;
        break;
      default:
        soundId = settings.messageSound;
    }
    
    await playSound(soundId);
  }
  
  // Helper to get current store value
  function get<T>(store: { subscribe: (fn: (value: T) => void) => void }): T {
    let value: T;
    store.subscribe((v) => (value = v))();
    return value!;
  }
  
  // Component state
  let mounted = false;
  let unlisteners: UnlistenFn[] = [];
  let testPlaying = false;
  
  // Current settings
  $: settings = $soundSettings;
  
  // Event handlers
  async function handleVolumeChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    soundSettings.update((s) => ({ ...s, volume: parseFloat(target.value) }));
  }
  
  async function handleSoundChange(
    type: 'messageSound' | 'mentionSound' | 'dmSound' | 'joinSound' | 'leaveSound',
    value: string
  ): Promise<void> {
    soundSettings.update((s) => ({ ...s, [type]: value }));
  }
  
  async function testSound(soundId: string): Promise<void> {
    if (testPlaying) return;
    testPlaying = true;
    await previewSound(soundId);
    setTimeout(() => (testPlaying = false), 500);
  }
  
  onMount(async () => {
    mounted = true;
    await loadSettings();
    
    // Listen for notification events to play sounds
    const unlistenMessage = await listen('notification:message', async () => {
      await playNotificationSound('message');
    });
    unlisteners.push(unlistenMessage);
    
    const unlistenMention = await listen('notification:mention', async () => {
      await playNotificationSound('mention');
    });
    unlisteners.push(unlistenMention);
    
    const unlistenDm = await listen('notification:dm', async () => {
      await playNotificationSound('dm');
    });
    unlisteners.push(unlistenDm);
    
    const unlistenJoin = await listen('voice:user-joined', async () => {
      await playNotificationSound('join');
    });
    unlisteners.push(unlistenJoin);
    
    const unlistenLeave = await listen('voice:user-left', async () => {
      await playNotificationSound('leave');
    });
    unlisteners.push(unlistenLeave);
  });
  
  onDestroy(() => {
    unlisteners.forEach((unlisten) => unlisten());
    if (audioContext) {
      audioContext.close();
    }
  });
</script>

<div class="sound-notification-manager">
  <div class="section-header">
    <h3>Sound Notifications</h3>
    <label class="toggle-switch">
      <input
        type="checkbox"
        checked={settings.enabled}
        on:change={(e) =>
          soundSettings.update((s) => ({
            ...s,
            enabled: (e.target as HTMLInputElement).checked,
          }))}
      />
      <span class="slider"></span>
    </label>
  </div>
  
  {#if settings.enabled}
    <div class="settings-group">
      <!-- Volume Control -->
      <div class="setting-row">
        <label class="setting-label">
          <span class="label-text">Volume</span>
          <span class="label-value">{Math.round(settings.volume * 100)}%</span>
        </label>
        <div class="volume-control">
          <svg class="volume-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            on:input={handleVolumeChange}
            class="volume-slider"
          />
        </div>
      </div>
      
      <!-- Sound Selections -->
      <div class="sound-selections">
        <div class="sound-row">
          <label class="sound-label">Message Sound</label>
          <div class="sound-select-group">
            <select
              value={settings.messageSound}
              on:change={(e) =>
                handleSoundChange('messageSound', (e.target as HTMLSelectElement).value)}
              class="sound-select"
            >
              {#each builtInSounds as sound}
                <option value={sound.id}>{sound.name}</option>
              {/each}
            </select>
            <button
              class="test-btn"
              disabled={settings.messageSound === 'none' || testPlaying}
              on:click={() => testSound(settings.messageSound)}
              title="Test sound"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="sound-row">
          <label class="sound-label">Mention Sound</label>
          <div class="sound-select-group">
            <select
              value={settings.mentionSound}
              on:change={(e) =>
                handleSoundChange('mentionSound', (e.target as HTMLSelectElement).value)}
              class="sound-select"
            >
              {#each builtInSounds as sound}
                <option value={sound.id}>{sound.name}</option>
              {/each}
            </select>
            <button
              class="test-btn"
              disabled={settings.mentionSound === 'none' || testPlaying}
              on:click={() => testSound(settings.mentionSound)}
              title="Test sound"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="sound-row">
          <label class="sound-label">Direct Message Sound</label>
          <div class="sound-select-group">
            <select
              value={settings.dmSound}
              on:change={(e) =>
                handleSoundChange('dmSound', (e.target as HTMLSelectElement).value)}
              class="sound-select"
            >
              {#each builtInSounds as sound}
                <option value={sound.id}>{sound.name}</option>
              {/each}
            </select>
            <button
              class="test-btn"
              disabled={settings.dmSound === 'none' || testPlaying}
              on:click={() => testSound(settings.dmSound)}
              title="Test sound"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="sound-row">
          <label class="sound-label">User Joined Voice</label>
          <div class="sound-select-group">
            <select
              value={settings.joinSound}
              on:change={(e) =>
                handleSoundChange('joinSound', (e.target as HTMLSelectElement).value)}
              class="sound-select"
            >
              {#each builtInSounds as sound}
                <option value={sound.id}>{sound.name}</option>
              {/each}
            </select>
            <button
              class="test-btn"
              disabled={settings.joinSound === 'none' || testPlaying}
              on:click={() => testSound(settings.joinSound)}
              title="Test sound"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="sound-row">
          <label class="sound-label">User Left Voice</label>
          <div class="sound-select-group">
            <select
              value={settings.leaveSound}
              on:change={(e) =>
                handleSoundChange('leaveSound', (e.target as HTMLSelectElement).value)}
              class="sound-select"
            >
              {#each builtInSounds as sound}
                <option value={sound.id}>{sound.name}</option>
              {/each}
            </select>
            <button
              class="test-btn"
              disabled={settings.leaveSound === 'none' || testPlaying}
              on:click={() => testSound(settings.leaveSound)}
              title="Test sound"
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Additional Options -->
      <div class="options-group">
        <label class="option-row">
          <input
            type="checkbox"
            checked={settings.muteInDnd}
            on:change={(e) =>
              soundSettings.update((s) => ({
                ...s,
                muteInDnd: (e.target as HTMLInputElement).checked,
              }))}
          />
          <span>Mute sounds during Do Not Disturb</span>
        </label>
        
        <label class="option-row">
          <input
            type="checkbox"
            checked={settings.muteInFocusMode}
            on:change={(e) =>
              soundSettings.update((s) => ({
                ...s,
                muteInFocusMode: (e.target as HTMLInputElement).checked,
              }))}
          />
          <span>Mute sounds during Focus Mode</span>
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .sound-notification-manager {
    padding: 16px;
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .section-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--header-primary, #fff);
  }
  
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background-tertiary, #202225);
    transition: 0.2s;
    border-radius: 24px;
  }
  
  .slider:before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: var(--text-normal, #dcddde);
    transition: 0.2s;
    border-radius: 50%;
  }
  
  .toggle-switch input:checked + .slider {
    background-color: var(--brand-experiment, #5865f2);
  }
  
  .toggle-switch input:checked + .slider:before {
    transform: translateX(20px);
    background-color: white;
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .setting-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .label-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal, #dcddde);
  }
  
  .label-value {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }
  
  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .volume-icon {
    width: 20px;
    height: 20px;
    color: var(--text-muted, #72767d);
    flex-shrink: 0;
  }
  
  .volume-slider {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--background-tertiary, #202225);
    appearance: none;
    cursor: pointer;
  }
  
  .volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--brand-experiment, #5865f2);
    cursor: pointer;
    transition: transform 0.1s;
  }
  
  .volume-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }
  
  .sound-selections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .sound-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  
  .sound-label {
    font-size: 14px;
    color: var(--text-normal, #dcddde);
    flex: 1;
  }
  
  .sound-select-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .sound-select {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--background-tertiary, #202225);
    border: none;
    color: var(--text-normal, #dcddde);
    font-size: 14px;
    cursor: pointer;
    min-width: 120px;
  }
  
  .sound-select:focus {
    outline: 2px solid var(--brand-experiment, #5865f2);
    outline-offset: -2px;
  }
  
  .test-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    background: var(--background-tertiary, #202225);
    border: none;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    transition: all 0.15s;
  }
  
  .test-btn:hover:not(:disabled) {
    background: var(--background-modifier-hover, #32353b);
    color: var(--text-normal, #dcddde);
  }
  
  .test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .test-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .options-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-accent, #40444b);
  }
  
  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-normal, #dcddde);
    cursor: pointer;
  }
  
  .option-row input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--brand-experiment, #5865f2);
  }
</style>
