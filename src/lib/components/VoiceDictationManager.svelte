<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut, elasticOut } from 'svelte/easing';

  interface DictationConfig {
    language: string;
    continuousMode: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    profanityFilter: boolean;
  }

  interface SupportedLanguage {
    code: string;
    name: string;
    native_name: string;
  }

  interface SpeechResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
    alternatives: { transcript: string; confidence: number }[];
  }

  export let isOpen = false;
  export let targetInput: HTMLInputElement | HTMLTextAreaElement | null = null;
  export let defaultLanguage = 'en-US';
  export let hotkey = 'Ctrl+Shift+D';
  export let showFloatingButton = true;
  export let position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right';

  const dispatch = createEventDispatcher<{
    result: { transcript: string; confidence: number };
    interim: { transcript: string };
    start: void;
    stop: void;
    error: { message: string };
    insert: { text: string };
  }>();

  // State
  let isAvailable = false;
  let hasPermission = false;
  let isListening = false;
  let isPaused = false;
  let showSettings = false;
  let showLanguageSelector = false;
  let audioLevel = 0;
  let currentTranscript = '';
  let interimTranscript = '';
  let confidence = 0;
  let duration = 0;
  let error = '';

  // Settings
  let config: DictationConfig = {
    language: defaultLanguage,
    continuousMode: true,
    interimResults: true,
    maxAlternatives: 3,
    profanityFilter: false,
  };

  let languages: SupportedLanguage[] = [];
  let selectedLanguage: SupportedLanguage | null = null;

  // Event listeners
  let unlisteners: UnlistenFn[] = [];
  let audioLevelInterval: ReturnType<typeof setInterval>;
  let durationInterval: ReturnType<typeof setInterval>;

  // UI state
  let pulseAnimation = false;
  let showVoiceCommands = false;

  // Voice commands for punctuation
  const voiceCommands = [
    { command: 'Period', action: '.', description: 'Add period' },
    { command: 'Comma', action: ',', description: 'Add comma' },
    { command: 'Question mark', action: '?', description: 'Add question mark' },
    { command: 'Exclamation mark', action: '!', description: 'Add exclamation' },
    { command: 'New line', action: '↵', description: 'Insert line break' },
    { command: 'New paragraph', action: '¶', description: 'Insert paragraph' },
  ];

  $: positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  }[position];

  async function initialize() {
    try {
      // Check if dictation is available
      isAvailable = await invoke<boolean>('check_dictation_available');
      
      if (!isAvailable) {
        error = 'Speech recognition is not available on this device';
        return;
      }

      // Get supported languages
      languages = await invoke<SupportedLanguage[]>('get_supported_languages');
      selectedLanguage = languages.find(l => l.code === config.language) || languages[0];

      // Set up event listeners
      unlisteners.push(
        await listen('dictation:interim', (event: any) => {
          const data = event.payload;
          interimTranscript = data.transcript || '';
          confidence = data.confidence || 0;
          dispatch('interim', { transcript: interimTranscript });
        }),
        await listen('dictation:result', (event: any) => {
          const data = event.payload;
          currentTranscript = data.transcript || '';
          confidence = data.confidence || 0;
          if (data.isFinal) {
            dispatch('result', { transcript: currentTranscript, confidence });
          }
        }),
        await listen('dictation:started', () => {
          isListening = true;
          pulseAnimation = true;
          dispatch('start');
        }),
        await listen('dictation:stopped', (event: any) => {
          isListening = false;
          isPaused = false;
          pulseAnimation = false;
          const data = event.payload;
          if (data.transcript) {
            currentTranscript = data.transcript;
          }
          dispatch('stop');
        }),
        await listen('dictation:paused', () => {
          isPaused = true;
          pulseAnimation = false;
        }),
        await listen('dictation:resumed', () => {
          isPaused = false;
          pulseAnimation = true;
        }),
        await listen('dictation:cancelled', () => {
          isListening = false;
          isPaused = false;
          pulseAnimation = false;
          currentTranscript = '';
          interimTranscript = '';
        }),
        await listen('dictation:punctuation', (event: any) => {
          currentTranscript = event.payload.transcript || '';
        }),
        await listen('dictation:error', (event: any) => {
          error = event.payload.message || 'An error occurred';
          dispatch('error', { message: error });
        })
      );
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to initialize dictation';
      console.error('Dictation init error:', e);
    }
  }

  async function requestPermission() {
    try {
      hasPermission = await invoke<boolean>('request_dictation_permission');
      if (!hasPermission) {
        error = 'Microphone permission denied';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to request permission';
    }
  }

  async function startDictation() {
    if (!isAvailable) {
      error = 'Speech recognition not available';
      return;
    }

    if (!hasPermission) {
      await requestPermission();
      if (!hasPermission) return;
    }

    try {
      error = '';
      currentTranscript = '';
      interimTranscript = '';
      duration = 0;

      await invoke('start_dictation', { config });

      // Start audio level polling
      audioLevelInterval = setInterval(async () => {
        if (isListening && !isPaused) {
          try {
            audioLevel = await invoke<number>('get_dictation_audio_level');
          } catch {
            audioLevel = 0;
          }
        }
      }, 50);

      // Start duration counter
      durationInterval = setInterval(() => {
        if (isListening && !isPaused) {
          duration += 1;
        }
      }, 1000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to start dictation';
      dispatch('error', { message: error });
    }
  }

  async function stopDictation() {
    try {
      clearInterval(audioLevelInterval);
      clearInterval(durationInterval);
      
      const result = await invoke<SpeechResult>('stop_dictation');
      currentTranscript = result.transcript;
      confidence = result.confidence;
      
      // Insert into target input if specified
      if (targetInput && currentTranscript) {
        insertText(currentTranscript);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to stop dictation';
    }
  }

  async function pauseDictation() {
    try {
      await invoke('pause_dictation');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to pause dictation';
    }
  }

  async function resumeDictation() {
    try {
      await invoke('resume_dictation');
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to resume dictation';
    }
  }

  async function cancelDictation() {
    try {
      clearInterval(audioLevelInterval);
      clearInterval(durationInterval);
      await invoke('cancel_dictation');
      currentTranscript = '';
      interimTranscript = '';
      duration = 0;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to cancel dictation';
    }
  }

  async function addPunctuation(punctuation: string) {
    try {
      currentTranscript = await invoke<string>('add_punctuation', { punctuation });
    } catch (e) {
      console.error('Failed to add punctuation:', e);
    }
  }

  function insertText(text: string) {
    if (!targetInput) return;

    const start = targetInput.selectionStart || 0;
    const end = targetInput.selectionEnd || 0;
    const currentValue = targetInput.value;

    targetInput.value = currentValue.slice(0, start) + text + currentValue.slice(end);
    targetInput.selectionStart = targetInput.selectionEnd = start + text.length;
    targetInput.focus();

    // Trigger input event for reactivity
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    dispatch('insert', { text });
  }

  function selectLanguage(lang: SupportedLanguage) {
    selectedLanguage = lang;
    config.language = lang.code;
    showLanguageSelector = false;
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Parse hotkey
    const keys = hotkey.toLowerCase().split('+');
    const requireCtrl = keys.includes('ctrl') || keys.includes('control');
    const requireShift = keys.includes('shift');
    const requireAlt = keys.includes('alt');
    const requireMeta = keys.includes('meta') || keys.includes('cmd');
    const mainKey = keys.find(k => !['ctrl', 'control', 'shift', 'alt', 'meta', 'cmd'].includes(k));

    const matches =
      event.ctrlKey === requireCtrl &&
      event.shiftKey === requireShift &&
      event.altKey === requireAlt &&
      event.metaKey === requireMeta &&
      event.key.toLowerCase() === mainKey;

    if (matches) {
      event.preventDefault();
      if (isListening) {
        stopDictation();
      } else {
        isOpen = true;
        startDictation();
      }
    }
  }

  function toggle() {
    if (isListening) {
      stopDictation();
    } else {
      isOpen = true;
      startDictation();
    }
  }

  function close() {
    if (isListening) {
      cancelDictation();
    }
    isOpen = false;
    showSettings = false;
    showLanguageSelector = false;
    showVoiceCommands = false;
  }

  onMount(async () => {
    await initialize();
    await requestPermission();
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    clearInterval(audioLevelInterval);
    clearInterval(durationInterval);
    unlisteners.forEach(fn => fn());
    if (isListening) {
      cancelDictation();
    }
  });

  // Export methods
  export { startDictation, stopDictation, cancelDictation, insertText };
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Floating trigger button -->
{#if showFloatingButton && !isOpen}
  <button
    class="floating-trigger {positionClasses}"
    on:click={toggle}
    title="Voice Dictation ({hotkey})"
    transition:scale={{ duration: 200, easing: elasticOut }}
  >
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  </button>
{/if}

<!-- Main dictation panel -->
{#if isOpen}
  <div
    class="dictation-panel {positionClasses}"
    transition:fly={{ y: 20, duration: 200, easing: quintOut }}
    role="dialog"
    aria-label="Voice Dictation"
  >
    <!-- Header -->
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-title">
          🎤 Voice Dictation
        </span>
        {#if isListening}
          <span class="status-badge listening" class:paused={isPaused}>
            {isPaused ? 'Paused' : 'Listening...'}
          </span>
        {/if}
      </div>
      <div class="header-actions">
        <button
          class="icon-btn"
          on:click={() => showVoiceCommands = !showVoiceCommands}
          title="Voice Commands"
        >
          ❓
        </button>
        <button
          class="icon-btn"
          on:click={() => showSettings = !showSettings}
          title="Settings"
        >
          ⚙️
        </button>
        <button class="icon-btn close-btn" on:click={close} title="Close">
          ✕
        </button>
      </div>
    </div>

    <!-- Error display -->
    {#if error}
      <div class="error-banner" transition:fade={{ duration: 150 }}>
        <span>⚠️ {error}</span>
        <button on:click={() => error = ''}>✕</button>
      </div>
    {/if}

    <!-- Voice commands help -->
    {#if showVoiceCommands}
      <div class="voice-commands" transition:fly={{ y: -10, duration: 150 }}>
        <h4>Voice Commands</h4>
        <div class="commands-grid">
          {#each voiceCommands as cmd}
            <button
              class="command-btn"
              on:click={() => addPunctuation(cmd.command)}
              disabled={!isListening}
            >
              <span class="command-symbol">{cmd.action}</span>
              <span class="command-name">{cmd.command}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Settings panel -->
    {#if showSettings}
      <div class="settings-panel" transition:fly={{ y: -10, duration: 150 }}>
        <!-- Language selector -->
        <div class="setting-row">
          <label>Language</label>
          <button
            class="language-selector"
            on:click={() => showLanguageSelector = !showLanguageSelector}
          >
            {selectedLanguage?.name || 'Select...'}
            <span class="chevron">▼</span>
          </button>
        </div>

        {#if showLanguageSelector}
          <div class="language-dropdown">
            {#each languages as lang}
              <button
                class="language-option"
                class:selected={lang.code === config.language}
                on:click={() => selectLanguage(lang)}
              >
                <span class="lang-name">{lang.name}</span>
                <span class="lang-native">{lang.native_name}</span>
              </button>
            {/each}
          </div>
        {/if}

        <!-- Options -->
        <div class="setting-row">
          <label for="continuous">Continuous mode</label>
          <input
            id="continuous"
            type="checkbox"
            bind:checked={config.continuousMode}
          />
        </div>

        <div class="setting-row">
          <label for="interim">Show interim results</label>
          <input
            id="interim"
            type="checkbox"
            bind:checked={config.interimResults}
          />
        </div>

        <div class="setting-row">
          <label for="profanity">Profanity filter</label>
          <input
            id="profanity"
            type="checkbox"
            bind:checked={config.profanityFilter}
          />
        </div>
      </div>
    {/if}

    <!-- Transcript display -->
    <div class="transcript-area">
      {#if currentTranscript || interimTranscript}
        <p class="transcript">
          {currentTranscript}<span class="interim">{interimTranscript}</span>
        </p>
      {:else if isListening}
        <p class="placeholder">Speak now...</p>
      {:else}
        <p class="placeholder">Press the button to start dictation</p>
      {/if}
    </div>

    <!-- Audio visualizer -->
    {#if isListening}
      <div class="audio-visualizer">
        {#each Array(12) as _, i}
          <div
            class="bar"
            class:active={!isPaused}
            style="--delay: {i * 50}ms; --height: {Math.max(15, audioLevel * 100 * (0.5 + Math.random() * 0.5))}%"
          />
        {/each}
      </div>
    {/if}

    <!-- Status bar -->
    <div class="status-bar">
      <div class="status-left">
        {#if isListening}
          <span class="duration">{formatDuration(duration)}</span>
          <span class="confidence" title="Confidence">
            {Math.round(confidence * 100)}%
          </span>
        {:else}
          <span class="hotkey-hint">Press <kbd>{hotkey}</kbd></span>
        {/if}
      </div>
      <div class="status-right">
        {#if selectedLanguage}
          <span class="language-badge">{selectedLanguage.code}</span>
        {/if}
      </div>
    </div>

    <!-- Control buttons -->
    <div class="controls">
      {#if !isListening}
        <button
          class="control-btn primary large"
          on:click={startDictation}
          disabled={!isAvailable}
        >
          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" fill="none" stroke-width="2" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2" />
          </svg>
          Start Dictation
        </button>
      {:else}
        <button
          class="control-btn secondary"
          on:click={isPaused ? resumeDictation : pauseDictation}
        >
          {#if isPaused}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Resume
          {:else}
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Pause
          {/if}
        </button>

        <button
          class="control-btn primary pulse"
          class:animating={pulseAnimation && !isPaused}
          on:click={stopDictation}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Done
        </button>

        <button class="control-btn danger" on:click={cancelDictation}>
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Cancel
        </button>
      {/if}
    </div>

    <!-- Insert button (when we have text) -->
    {#if currentTranscript && targetInput && !isListening}
      <button
        class="insert-btn"
        on:click={() => insertText(currentTranscript)}
        transition:fade={{ duration: 100 }}
      >
        Insert Text
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .floating-trigger {
    position: fixed;
    z-index: 1000;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
    transition: all 0.2s ease;
  }

  .floating-trigger:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
  }

  .dictation-panel {
    position: fixed;
    z-index: 1001;
    width: 380px;
    background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .panel-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: white;
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 3px 8px;
    border-radius: 12px;
    background: #10b981;
    color: white;
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  .status-badge.paused {
    background: #f59e0b;
    animation: none;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-size: 0.9rem;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.15);
    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    font-size: 0.85rem;
  }

  .error-banner button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 4px;
    opacity: 0.7;
  }

  .error-banner button:hover {
    opacity: 1;
  }

  .voice-commands {
    padding: 12px 16px;
    background: rgba(139, 92, 246, 0.1);
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  }

  .voice-commands h4 {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .commands-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .command-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .command-btn:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .command-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .command-symbol {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .command-name {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
  }

  .settings-panel {
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }

  .setting-row label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .setting-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #3b82f6;
  }

  .language-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .language-selector:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .chevron {
    font-size: 0.7rem;
    opacity: 0.6;
  }

  .language-dropdown {
    max-height: 200px;
    overflow-y: auto;
    margin-top: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .language-option {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .language-option:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  .language-option.selected {
    background: rgba(59, 130, 246, 0.3);
  }

  .lang-name {
    font-size: 0.85rem;
  }

  .lang-native {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .transcript-area {
    padding: 20px 16px;
    min-height: 80px;
    max-height: 150px;
    overflow-y: auto;
  }

  .transcript {
    font-size: 1rem;
    line-height: 1.5;
    color: white;
    margin: 0;
  }

  .interim {
    color: rgba(255, 255, 255, 0.5);
  }

  .placeholder {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    margin: 0;
  }

  .audio-visualizer {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 4px;
    height: 40px;
    padding: 0 16px;
  }

  .bar {
    width: 6px;
    background: linear-gradient(to top, #3b82f6, #8b5cf6);
    border-radius: 3px;
    transition: height 0.05s ease;
    height: var(--height, 15%);
  }

  .bar.active {
    animation: wave 0.6s ease-in-out infinite;
    animation-delay: var(--delay, 0ms);
  }

  @keyframes wave {
    0%, 100% { height: 15%; }
    50% { height: var(--height, 60%); }
  }

  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .status-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .duration {
    font-variant-numeric: tabular-nums;
    font-family: monospace;
  }

  .confidence {
    padding: 2px 6px;
    background: rgba(16, 185, 129, 0.2);
    border-radius: 4px;
    color: #10b981;
    font-size: 0.75rem;
  }

  .hotkey-hint kbd {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.75rem;
  }

  .language-badge {
    padding: 2px 8px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 4px;
    color: #60a5fa;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .controls {
    display: flex;
    gap: 8px;
    padding: 16px;
    justify-content: center;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-btn.large {
    padding: 16px 32px;
    font-size: 1rem;
  }

  .control-btn.primary {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
  }

  .control-btn.primary:hover {
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
    transform: translateY(-1px);
  }

  .control-btn.primary.pulse.animating {
    animation: pulse-btn 1.5s ease-in-out infinite;
  }

  @keyframes pulse-btn {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    50% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
  }

  .control-btn.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .control-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .control-btn.danger {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .control-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .insert-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 16px 16px;
    padding: 12px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .insert-btn:hover {
    background: #059669;
  }

  /* Scrollbar styling */
  .transcript-area::-webkit-scrollbar,
  .language-dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .transcript-area::-webkit-scrollbar-track,
  .language-dropdown::-webkit-scrollbar-track {
    background: transparent;
  }

  .transcript-area::-webkit-scrollbar-thumb,
  .language-dropdown::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .bar,
    .control-btn,
    .status-badge {
      animation: none;
    }
  }
</style>
