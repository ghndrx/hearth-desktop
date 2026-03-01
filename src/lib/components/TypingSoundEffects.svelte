<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  // Typing sound effect themes
  export type SoundTheme = 
    | 'mechanical-blue'
    | 'mechanical-red'
    | 'mechanical-brown'
    | 'typewriter'
    | 'bubble'
    | 'pop'
    | 'soft'
    | 'none';

  interface SoundSet {
    name: string;
    description: string;
    keyDown: string[];
    keyUp: string[];
    space: string;
    enter: string;
    backspace: string;
  }

  // Store for global access
  export const typingSoundEnabled = writable(false);
  export const typingSoundTheme = writable<SoundTheme>('mechanical-blue');
  export const typingSoundVolume = writable(0.3);

  // Props
  export let enabled = false;
  export let theme: SoundTheme = 'mechanical-blue';
  export let volume = 0.3;
  export let targetSelector = 'textarea, input[type="text"], [contenteditable="true"]';

  // State
  let audioContext: AudioContext | null = null;
  let soundBuffers: Map<string, AudioBuffer> = new Map();
  let isInitialized = false;
  let lastKeyTime = 0;
  const MIN_KEY_INTERVAL = 30; // Minimum ms between sounds to prevent spam

  // Sound definitions (base64 encoded or URLs to sound files)
  const SOUND_THEMES: Record<SoundTheme, SoundSet> = {
    'mechanical-blue': {
      name: 'Mechanical Blue',
      description: 'Clicky mechanical keyboard with blue switches',
      keyDown: ['mech-blue-down-1', 'mech-blue-down-2', 'mech-blue-down-3'],
      keyUp: ['mech-blue-up-1', 'mech-blue-up-2'],
      space: 'mech-space',
      enter: 'mech-enter',
      backspace: 'mech-backspace'
    },
    'mechanical-red': {
      name: 'Mechanical Red',
      description: 'Smooth linear mechanical switches',
      keyDown: ['mech-red-down-1', 'mech-red-down-2'],
      keyUp: ['mech-red-up-1'],
      space: 'mech-space-soft',
      enter: 'mech-enter-soft',
      backspace: 'mech-backspace-soft'
    },
    'mechanical-brown': {
      name: 'Mechanical Brown',
      description: 'Tactile mechanical switches',
      keyDown: ['mech-brown-down-1', 'mech-brown-down-2', 'mech-brown-down-3'],
      keyUp: ['mech-brown-up-1', 'mech-brown-up-2'],
      space: 'mech-space',
      enter: 'mech-enter',
      backspace: 'mech-backspace'
    },
    'typewriter': {
      name: 'Typewriter',
      description: 'Classic vintage typewriter sounds',
      keyDown: ['typewriter-key-1', 'typewriter-key-2', 'typewriter-key-3'],
      keyUp: [],
      space: 'typewriter-space',
      enter: 'typewriter-ding',
      backspace: 'typewriter-backspace'
    },
    'bubble': {
      name: 'Bubble',
      description: 'Soft bubbly pop sounds',
      keyDown: ['bubble-1', 'bubble-2', 'bubble-3'],
      keyUp: [],
      space: 'bubble-space',
      enter: 'bubble-enter',
      backspace: 'bubble-pop'
    },
    'pop': {
      name: 'Pop',
      description: 'Satisfying pop sounds',
      keyDown: ['pop-1', 'pop-2', 'pop-3'],
      keyUp: [],
      space: 'pop-space',
      enter: 'pop-enter',
      backspace: 'pop-back'
    },
    'soft': {
      name: 'Soft Touch',
      description: 'Gentle, quiet key sounds',
      keyDown: ['soft-1', 'soft-2'],
      keyUp: [],
      space: 'soft-space',
      enter: 'soft-enter',
      backspace: 'soft-back'
    },
    'none': {
      name: 'None',
      description: 'No typing sounds',
      keyDown: [],
      keyUp: [],
      space: '',
      enter: '',
      backspace: ''
    }
  };

  // Generate simple synthesized sounds using Web Audio API
  function generateTone(
    frequency: number, 
    duration: number, 
    type: OscillatorType = 'sine',
    attack: number = 0.01,
    decay: number = 0.1
  ): AudioBuffer | null {
    if (!audioContext) return null;

    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let envelope = 1;

      // Attack phase
      if (t < attack) {
        envelope = t / attack;
      }
      // Decay phase
      else if (t < attack + decay) {
        envelope = 1 - ((t - attack) / decay) * 0.7;
      }
      // Sustain/release
      else {
        envelope = 0.3 * (1 - (t - attack - decay) / (duration - attack - decay));
      }

      // Generate waveform
      let sample = 0;
      switch (type) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * frequency * t);
          break;
        case 'square':
          sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
          break;
        case 'triangle':
          sample = Math.abs((4 * frequency * t) % 4 - 2) - 1;
          break;
        case 'sawtooth':
          sample = 2 * ((frequency * t) % 1) - 1;
          break;
      }

      // Add some noise for realism
      const noise = (Math.random() * 2 - 1) * 0.05;
      data[i] = (sample + noise) * envelope * 0.5;
    }

    return buffer;
  }

  // Generate click sound
  function generateClick(pitch: number = 1): AudioBuffer | null {
    if (!audioContext) return null;

    const sampleRate = audioContext.sampleRate;
    const duration = 0.05;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 100);
      const freq = 2000 * pitch + Math.random() * 500;
      const sample = Math.sin(2 * Math.PI * freq * t) * envelope;
      const noise = (Math.random() * 2 - 1) * envelope * 0.3;
      data[i] = (sample + noise) * 0.3;
    }

    return buffer;
  }

  // Generate space bar thump
  function generateThump(): AudioBuffer | null {
    if (!audioContext) return null;

    const sampleRate = audioContext.sampleRate;
    const duration = 0.1;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 50);
      const freq = 100 + Math.random() * 50;
      const sample = Math.sin(2 * Math.PI * freq * t) * envelope;
      const noise = (Math.random() * 2 - 1) * envelope * 0.5;
      data[i] = (sample + noise) * 0.4;
    }

    return buffer;
  }

  // Initialize audio context and generate sounds
  async function initAudio() {
    if (isInitialized) return;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Generate synthesized sounds for each theme
      const clickVariants = [0.9, 1.0, 1.1, 1.2];
      
      // Mechanical blue clicks (clicky)
      clickVariants.forEach((pitch, i) => {
        const buffer = generateClick(pitch);
        if (buffer) soundBuffers.set(`mech-blue-down-${i + 1}`, buffer);
      });
      
      // Mechanical red (linear, softer)
      [0.8, 0.9].forEach((pitch, i) => {
        const buffer = generateClick(pitch * 0.7);
        if (buffer) soundBuffers.set(`mech-red-down-${i + 1}`, buffer);
      });
      
      // Brown (tactile)
      clickVariants.forEach((pitch, i) => {
        const buffer = generateClick(pitch * 0.85);
        if (buffer) soundBuffers.set(`mech-brown-down-${i + 1}`, buffer);
      });

      // Key up sounds
      [1.2, 1.3].forEach((pitch, i) => {
        const buffer = generateClick(pitch);
        if (buffer) {
          soundBuffers.set(`mech-blue-up-${i + 1}`, buffer);
          soundBuffers.set(`mech-brown-up-${i + 1}`, buffer);
        }
      });
      soundBuffers.set('mech-red-up-1', generateClick(1.1)!);

      // Space bar
      const spaceBuffer = generateThump();
      if (spaceBuffer) {
        soundBuffers.set('mech-space', spaceBuffer);
        soundBuffers.set('mech-space-soft', spaceBuffer);
      }

      // Enter key
      const enterBuffer = generateTone(800, 0.08, 'sine', 0.005, 0.03);
      if (enterBuffer) {
        soundBuffers.set('mech-enter', enterBuffer);
        soundBuffers.set('mech-enter-soft', enterBuffer);
      }

      // Backspace
      const backspaceBuffer = generateClick(0.7);
      if (backspaceBuffer) {
        soundBuffers.set('mech-backspace', backspaceBuffer);
        soundBuffers.set('mech-backspace-soft', backspaceBuffer);
      }

      // Typewriter sounds
      clickVariants.forEach((pitch, i) => {
        const buffer = generateClick(pitch * 0.6);
        if (buffer) soundBuffers.set(`typewriter-key-${i + 1}`, buffer);
      });
      soundBuffers.set('typewriter-space', generateThump()!);
      soundBuffers.set('typewriter-ding', generateTone(2000, 0.3, 'sine', 0.01, 0.2)!);
      soundBuffers.set('typewriter-backspace', generateClick(0.5)!);

      // Bubble sounds
      [1.0, 1.1, 1.2].forEach((pitch, i) => {
        const buffer = generateTone(600 * pitch, 0.06, 'sine', 0.01, 0.04);
        if (buffer) soundBuffers.set(`bubble-${i + 1}`, buffer);
      });
      soundBuffers.set('bubble-space', generateTone(400, 0.08, 'sine', 0.01, 0.05)!);
      soundBuffers.set('bubble-enter', generateTone(800, 0.1, 'sine', 0.01, 0.06)!);
      soundBuffers.set('bubble-pop', generateTone(300, 0.05, 'sine', 0.005, 0.03)!);

      // Pop sounds
      [1.0, 1.05, 1.1].forEach((pitch, i) => {
        const buffer = generateTone(500 * pitch, 0.04, 'triangle', 0.005, 0.02);
        if (buffer) soundBuffers.set(`pop-${i + 1}`, buffer);
      });
      soundBuffers.set('pop-space', generateTone(350, 0.06, 'triangle', 0.01, 0.03)!);
      soundBuffers.set('pop-enter', generateTone(700, 0.08, 'triangle', 0.01, 0.04)!);
      soundBuffers.set('pop-back', generateTone(250, 0.03, 'triangle', 0.005, 0.02)!);

      // Soft sounds
      [1.0, 1.05].forEach((pitch, i) => {
        const buffer = generateTone(300 * pitch, 0.03, 'sine', 0.01, 0.02);
        if (buffer) soundBuffers.set(`soft-${i + 1}`, buffer);
      });
      soundBuffers.set('soft-space', generateTone(200, 0.04, 'sine', 0.01, 0.02)!);
      soundBuffers.set('soft-enter', generateTone(400, 0.05, 'sine', 0.01, 0.03)!);
      soundBuffers.set('soft-back', generateTone(150, 0.03, 'sine', 0.005, 0.02)!);

      isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize typing sounds:', e);
    }
  }

  // Play a sound
  function playSound(soundId: string, volumeMultiplier: number = 1) {
    if (!audioContext || !enabled || theme === 'none') return;

    const buffer = soundBuffers.get(soundId);
    if (!buffer) return;

    const now = performance.now();
    if (now - lastKeyTime < MIN_KEY_INTERVAL) return;
    lastKeyTime = now;

    try {
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = buffer;
      gainNode.gain.value = volume * volumeMultiplier;
      
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      source.start(0);
    } catch (e) {
      console.error('Failed to play typing sound:', e);
    }
  }

  // Get random sound from array
  function randomSound(sounds: string[]): string {
    if (sounds.length === 0) return '';
    return sounds[Math.floor(Math.random() * sounds.length)];
  }

  // Handle keydown event
  function handleKeyDown(e: KeyboardEvent) {
    if (!enabled || theme === 'none') return;

    const soundSet = SOUND_THEMES[theme];
    
    // Check if target is a text input
    const target = e.target as HTMLElement;
    if (!target.matches(targetSelector)) return;

    let soundId = '';
    
    switch (e.key) {
      case ' ':
        soundId = soundSet.space;
        break;
      case 'Enter':
        soundId = soundSet.enter;
        break;
      case 'Backspace':
        soundId = soundSet.backspace;
        break;
      default:
        if (e.key.length === 1) {
          soundId = randomSound(soundSet.keyDown);
        }
    }

    if (soundId) {
      playSound(soundId);
    }
  }

  // Handle keyup event
  function handleKeyUp(e: KeyboardEvent) {
    if (!enabled || theme === 'none') return;

    const soundSet = SOUND_THEMES[theme];
    const target = e.target as HTMLElement;
    
    if (!target.matches(targetSelector)) return;

    if (e.key.length === 1 && soundSet.keyUp.length > 0) {
      const soundId = randomSound(soundSet.keyUp);
      if (soundId) {
        playSound(soundId, 0.5);
      }
    }
  }

  // Resume audio context on user interaction
  async function resumeAudioContext() {
    if (audioContext?.state === 'suspended') {
      await audioContext.resume();
    }
  }

  onMount(async () => {
    await initAudio();
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('click', resumeAudioContext, { once: true });

    // Sync with stores
    typingSoundEnabled.set(enabled);
    typingSoundTheme.set(theme);
    typingSoundVolume.set(volume);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    
    if (audioContext) {
      audioContext.close();
    }
  });

  // Reactive updates
  $: {
    typingSoundEnabled.set(enabled);
    typingSoundTheme.set(theme);
    typingSoundVolume.set(volume);
  }

  // Public API for testing sounds
  export function testSound() {
    const soundSet = SOUND_THEMES[theme];
    if (soundSet.keyDown.length > 0) {
      playSound(randomSound(soundSet.keyDown));
    }
  }

  export function getAvailableThemes(): { id: SoundTheme; name: string; description: string }[] {
    return Object.entries(SOUND_THEMES).map(([id, set]) => ({
      id: id as SoundTheme,
      name: set.name,
      description: set.description
    }));
  }
</script>

<!-- Settings UI -->
{#if $$slots.default}
  <slot />
{:else}
  <div class="typing-sounds-settings">
    <div class="setting-header">
      <div class="setting-info">
        <h3>Typing Sound Effects</h3>
        <p>Play satisfying sounds while typing</p>
      </div>
      <label class="toggle">
        <input type="checkbox" bind:checked={enabled} />
        <span class="slider"></span>
      </label>
    </div>

    {#if enabled}
      <div class="settings-content">
        <div class="theme-selector">
          <label for="theme-select">Sound Theme</label>
          <select id="theme-select" bind:value={theme}>
            {#each Object.entries(SOUND_THEMES) as [id, set]}
              {#if id !== 'none'}
                <option value={id}>{set.name}</option>
              {/if}
            {/each}
          </select>
          <span class="theme-description">
            {SOUND_THEMES[theme]?.description || ''}
          </span>
        </div>

        <div class="volume-control">
          <label for="volume-slider">Volume</label>
          <div class="volume-slider-container">
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={volume}
            />
            <span class="volume-value">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        <button class="test-button" on:click={testSound}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          Test Sound
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .typing-sounds-settings {
    background: var(--bg-secondary, #1a1a1a);
    border-radius: 12px;
    padding: 16px;
  }

  .setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .setting-info h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .setting-info p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted, #888);
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 48px;
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

  .slider::before {
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
    background-color: var(--accent-color, #5865f2);
  }

  .toggle input:checked + .slider::before {
    transform: translateX(24px);
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  }

  .theme-selector {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .theme-selector label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .theme-selector select {
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    color: var(--text-primary, #fff);
    cursor: pointer;
  }

  .theme-selector select:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .theme-description {
    font-size: 12px;
    color: var(--text-muted, #888);
    font-style: italic;
  }

  .volume-control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .volume-control label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .volume-slider-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .volume-slider-container input[type="range"] {
    flex: 1;
    height: 4px;
    appearance: none;
    background: var(--bg-tertiary, #333);
    border-radius: 2px;
    cursor: pointer;
  }

  .volume-slider-container input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 16px;
    height: 16px;
    background: var(--accent-color, #5865f2);
    border-radius: 50%;
    cursor: pointer;
  }

  .volume-value {
    font-size: 13px;
    color: var(--text-muted, #888);
    min-width: 40px;
    text-align: right;
  }

  .test-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--bg-tertiary, #2a2a2a);
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--text-primary, #fff);
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .test-button:hover {
    background: var(--bg-hover, #333);
    border-color: var(--accent-color, #5865f2);
  }

  .test-button:active {
    transform: scale(0.98);
  }

  .test-button svg {
    opacity: 0.8;
  }
</style>
