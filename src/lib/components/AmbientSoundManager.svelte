<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  
  interface AmbientSound {
    id: string;
    name: string;
    icon: string;
    category: 'nature' | 'urban' | 'white-noise' | 'music';
    url: string;
    volume: number;
    isPlaying: boolean;
  }
  
  interface SoundPreset {
    id: string;
    name: string;
    icon: string;
    sounds: { id: string; volume: number }[];
    createdAt: number;
  }
  
  interface AmbientSettings {
    masterVolume: number;
    fadeInDuration: number;
    fadeOutDuration: number;
    autoStopMinutes: number;
    pauseOnCall: boolean;
    resumeAfterCall: boolean;
    showInTray: boolean;
  }
  
  // Available ambient sounds
  const availableSounds: Omit<AmbientSound, 'volume' | 'isPlaying'>[] = [
    // Nature
    { id: 'rain', name: 'Rain', icon: '🌧️', category: 'nature', url: '/sounds/ambient/rain.mp3' },
    { id: 'thunder', name: 'Thunder', icon: '⛈️', category: 'nature', url: '/sounds/ambient/thunder.mp3' },
    { id: 'ocean', name: 'Ocean Waves', icon: '🌊', category: 'nature', url: '/sounds/ambient/ocean.mp3' },
    { id: 'forest', name: 'Forest', icon: '🌲', category: 'nature', url: '/sounds/ambient/forest.mp3' },
    { id: 'birds', name: 'Birds', icon: '🐦', category: 'nature', url: '/sounds/ambient/birds.mp3' },
    { id: 'wind', name: 'Wind', icon: '💨', category: 'nature', url: '/sounds/ambient/wind.mp3' },
    { id: 'fire', name: 'Fireplace', icon: '🔥', category: 'nature', url: '/sounds/ambient/fire.mp3' },
    { id: 'stream', name: 'Stream', icon: '🏞️', category: 'nature', url: '/sounds/ambient/stream.mp3' },
    // Urban
    { id: 'cafe', name: 'Coffee Shop', icon: '☕', category: 'urban', url: '/sounds/ambient/cafe.mp3' },
    { id: 'keyboard', name: 'Keyboard', icon: '⌨️', category: 'urban', url: '/sounds/ambient/keyboard.mp3' },
    { id: 'train', name: 'Train', icon: '🚂', category: 'urban', url: '/sounds/ambient/train.mp3' },
    { id: 'city', name: 'City Traffic', icon: '🏙️', category: 'urban', url: '/sounds/ambient/city.mp3' },
    // White Noise
    { id: 'white', name: 'White Noise', icon: '📻', category: 'white-noise', url: '/sounds/ambient/white.mp3' },
    { id: 'pink', name: 'Pink Noise', icon: '🎀', category: 'white-noise', url: '/sounds/ambient/pink.mp3' },
    { id: 'brown', name: 'Brown Noise', icon: '🟤', category: 'white-noise', url: '/sounds/ambient/brown.mp3' },
    { id: 'fan', name: 'Fan', icon: '🌀', category: 'white-noise', url: '/sounds/ambient/fan.mp3' },
    // Music
    { id: 'lofi', name: 'Lo-Fi Beats', icon: '🎵', category: 'music', url: '/sounds/ambient/lofi.mp3' },
    { id: 'piano', name: 'Soft Piano', icon: '🎹', category: 'music', url: '/sounds/ambient/piano.mp3' },
    { id: 'meditation', name: 'Meditation', icon: '🧘', category: 'music', url: '/sounds/ambient/meditation.mp3' },
  ];
  
  // Stores
  const sounds = writable<AmbientSound[]>(
    availableSounds.map(s => ({ ...s, volume: 50, isPlaying: false }))
  );
  
  const presets = writable<SoundPreset[]>([
    {
      id: 'focus',
      name: 'Deep Focus',
      icon: '🎯',
      sounds: [{ id: 'rain', volume: 40 }, { id: 'lofi', volume: 30 }],
      createdAt: Date.now(),
    },
    {
      id: 'relax',
      name: 'Relaxation',
      icon: '😌',
      sounds: [{ id: 'ocean', volume: 50 }, { id: 'birds', volume: 25 }],
      createdAt: Date.now(),
    },
    {
      id: 'coffee',
      name: 'Coffee Shop',
      icon: '☕',
      sounds: [{ id: 'cafe', volume: 45 }, { id: 'keyboard', volume: 20 }],
      createdAt: Date.now(),
    },
    {
      id: 'nature',
      name: 'Nature Walk',
      icon: '🌿',
      sounds: [{ id: 'forest', volume: 40 }, { id: 'stream', volume: 35 }, { id: 'birds', volume: 25 }],
      createdAt: Date.now(),
    },
  ]);
  
  const settings = writable<AmbientSettings>({
    masterVolume: 80,
    fadeInDuration: 2,
    fadeOutDuration: 2,
    autoStopMinutes: 0,
    pauseOnCall: true,
    resumeAfterCall: true,
    showInTray: true,
  });
  
  // Derived stores
  const activeSounds = derived(sounds, $sounds => 
    $sounds.filter(s => s.isPlaying)
  );
  
  const hasActiveSounds = derived(activeSounds, $active => $active.length > 0);
  
  const soundsByCategory = derived(sounds, $sounds => ({
    nature: $sounds.filter(s => s.category === 'nature'),
    urban: $sounds.filter(s => s.category === 'urban'),
    'white-noise': $sounds.filter(s => s.category === 'white-noise'),
    music: $sounds.filter(s => s.category === 'music'),
  }));
  
  // Audio management
  const audioElements = new Map<string, HTMLAudioElement>();
  let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
  
  // State
  let isOpen = false;
  let activeTab: 'sounds' | 'presets' | 'settings' = 'sounds';
  let activeCategory: 'all' | 'nature' | 'urban' | 'white-noise' | 'music' = 'all';
  let showSavePresetModal = false;
  let newPresetName = '';
  let newPresetIcon = '🎵';
  let searchQuery = '';
  let isMinimized = false;
  
  const presetIcons = ['🎯', '😌', '☕', '🌿', '🌙', '⭐', '💫', '🎵', '🎧', '📚', '💻', '🧠'];
  
  // Functions
  function getAudioElement(sound: AmbientSound): HTMLAudioElement {
    if (!audioElements.has(sound.id)) {
      const audio = new Audio(sound.url);
      audio.loop = true;
      audio.volume = 0;
      audioElements.set(sound.id, audio);
    }
    return audioElements.get(sound.id)!;
  }
  
  async function fadeVolume(audio: HTMLAudioElement, targetVolume: number, duration: number): Promise<void> {
    const startVolume = audio.volume;
    const diff = targetVolume - startVolume;
    const steps = 20;
    const stepDuration = (duration * 1000) / steps;
    
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      audio.volume = Math.max(0, Math.min(1, startVolume + (diff * i / steps)));
    }
  }
  
  async function toggleSound(soundId: string): Promise<void> {
    const currentSettings = $settings;
    
    sounds.update(list => list.map(s => {
      if (s.id === soundId) {
        const audio = getAudioElement(s);
        const newPlaying = !s.isPlaying;
        
        if (newPlaying) {
          audio.play().catch(console.error);
          const targetVol = (s.volume / 100) * (currentSettings.masterVolume / 100);
          fadeVolume(audio, targetVol, currentSettings.fadeInDuration);
        } else {
          fadeVolume(audio, 0, currentSettings.fadeOutDuration).then(() => {
            audio.pause();
          });
        }
        
        return { ...s, isPlaying: newPlaying };
      }
      return s;
    }));
    
    resetAutoStopTimer();
    updateTrayIcon();
  }
  
  function updateVolume(soundId: string, volume: number): void {
    const currentSettings = $settings;
    
    sounds.update(list => list.map(s => {
      if (s.id === soundId) {
        if (s.isPlaying) {
          const audio = getAudioElement(s);
          audio.volume = (volume / 100) * (currentSettings.masterVolume / 100);
        }
        return { ...s, volume };
      }
      return s;
    }));
  }
  
  function updateMasterVolume(volume: number): void {
    settings.update(s => ({ ...s, masterVolume: volume }));
    
    // Update all active sounds
    $sounds.forEach(sound => {
      if (sound.isPlaying) {
        const audio = getAudioElement(sound);
        audio.volume = (sound.volume / 100) * (volume / 100);
      }
    });
  }
  
  function stopAllSounds(): void {
    const currentSettings = $settings;
    
    sounds.update(list => list.map(s => {
      if (s.isPlaying) {
        const audio = getAudioElement(s);
        fadeVolume(audio, 0, currentSettings.fadeOutDuration).then(() => {
          audio.pause();
        });
      }
      return { ...s, isPlaying: false };
    }));
    
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
    
    updateTrayIcon();
  }
  
  function applyPreset(preset: SoundPreset): void {
    // Stop all current sounds first
    const currentSettings = $settings;
    
    sounds.update(list => {
      // First pass: stop sounds not in preset
      const updatedList = list.map(s => {
        const presetSound = preset.sounds.find(ps => ps.id === s.id);
        if (!presetSound && s.isPlaying) {
          const audio = getAudioElement(s);
          fadeVolume(audio, 0, currentSettings.fadeOutDuration).then(() => {
            audio.pause();
          });
          return { ...s, isPlaying: false };
        }
        return s;
      });
      
      // Second pass: start/update sounds in preset
      return updatedList.map(s => {
        const presetSound = preset.sounds.find(ps => ps.id === s.id);
        if (presetSound) {
          const audio = getAudioElement(s);
          const targetVol = (presetSound.volume / 100) * (currentSettings.masterVolume / 100);
          
          if (!s.isPlaying) {
            audio.play().catch(console.error);
            fadeVolume(audio, targetVol, currentSettings.fadeInDuration);
          } else {
            audio.volume = targetVol;
          }
          
          return { ...s, volume: presetSound.volume, isPlaying: true };
        }
        return s;
      });
    });
    
    resetAutoStopTimer();
    updateTrayIcon();
  }
  
  function saveCurrentAsPreset(): void {
    if (!newPresetName.trim()) return;
    
    const activeSoundsList = $sounds.filter(s => s.isPlaying);
    if (activeSoundsList.length === 0) return;
    
    const newPreset: SoundPreset = {
      id: `custom-${Date.now()}`,
      name: newPresetName.trim(),
      icon: newPresetIcon,
      sounds: activeSoundsList.map(s => ({ id: s.id, volume: s.volume })),
      createdAt: Date.now(),
    };
    
    presets.update(list => [...list, newPreset]);
    savePresets();
    
    newPresetName = '';
    newPresetIcon = '🎵';
    showSavePresetModal = false;
  }
  
  function deletePreset(presetId: string): void {
    presets.update(list => list.filter(p => p.id !== presetId));
    savePresets();
  }
  
  function resetAutoStopTimer(): void {
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
    
    const currentSettings = $settings;
    if (currentSettings.autoStopMinutes > 0 && $hasActiveSounds) {
      autoStopTimer = setTimeout(() => {
        stopAllSounds();
        showAutoStopNotification();
      }, currentSettings.autoStopMinutes * 60 * 1000);
    }
  }
  
  async function showAutoStopNotification(): Promise<void> {
    try {
      await invoke('show_notification', {
        title: 'Ambient Sounds',
        body: 'Ambient sounds stopped automatically',
      });
    } catch (e) {
      console.warn('Could not show notification:', e);
    }
  }
  
  async function updateTrayIcon(): Promise<void> {
    const currentSettings = $settings;
    if (!currentSettings.showInTray) return;
    
    try {
      await invoke('update_ambient_tray', {
        isPlaying: $hasActiveSounds,
        soundCount: $activeSounds.length,
      });
    } catch (e) {
      // Tray integration may not be available
    }
  }
  
  function saveSettings(): void {
    try {
      localStorage.setItem('hearth-ambient-settings', JSON.stringify($settings));
    } catch (e) {
      console.warn('Could not save settings:', e);
    }
  }
  
  function loadSettings(): void {
    try {
      const saved = localStorage.getItem('hearth-ambient-settings');
      if (saved) {
        settings.set({ ...$settings, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  }
  
  function savePresets(): void {
    try {
      localStorage.setItem('hearth-ambient-presets', JSON.stringify($presets));
    } catch (e) {
      console.warn('Could not save presets:', e);
    }
  }
  
  function loadPresets(): void {
    try {
      const saved = localStorage.getItem('hearth-ambient-presets');
      if (saved) {
        const loadedPresets = JSON.parse(saved);
        if (Array.isArray(loadedPresets) && loadedPresets.length > 0) {
          presets.set(loadedPresets);
        }
      }
    } catch (e) {
      console.warn('Could not load presets:', e);
    }
  }
  
  $: filteredSounds = (() => {
    let result = $sounds;
    
    if (activeCategory !== 'all') {
      result = result.filter(s => s.category === activeCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query)
      );
    }
    
    return result;
  })();
  
  // Lifecycle
  onMount(() => {
    loadSettings();
    loadPresets();
  });
  
  onDestroy(() => {
    // Stop all audio when component is destroyed
    audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    audioElements.clear();
    
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
    }
  });
  
  // Auto-save settings
  $: if ($settings) {
    saveSettings();
  }
</script>

<div class="ambient-sound-manager" class:minimized={isMinimized}>
  <!-- Toggle Button -->
  <button
    class="toggle-btn"
    class:active={$hasActiveSounds}
    on:click={() => isOpen = !isOpen}
    title="Ambient Sounds"
  >
    <span class="icon">🎧</span>
    {#if $hasActiveSounds}
      <span class="badge">{$activeSounds.length}</span>
    {/if}
  </button>
  
  {#if isOpen}
    <div class="panel" class:minimized={isMinimized}>
      <!-- Header -->
      <div class="panel-header">
        <div class="header-left">
          <span class="title">🎧 Ambient Sounds</span>
          {#if $hasActiveSounds}
            <span class="playing-badge">{$activeSounds.length} playing</span>
          {/if}
        </div>
        <div class="header-actions">
          {#if $hasActiveSounds}
            <button class="icon-btn" on:click={stopAllSounds} title="Stop All">
              ⏹️
            </button>
          {/if}
          <button 
            class="icon-btn" 
            on:click={() => isMinimized = !isMinimized}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '⬆️' : '⬇️'}
          </button>
          <button class="icon-btn" on:click={() => isOpen = false} title="Close">
            ✕
          </button>
        </div>
      </div>
      
      {#if !isMinimized}
        <!-- Master Volume -->
        <div class="master-volume">
          <span class="label">Master Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={$settings.masterVolume}
            on:input={(e) => updateMasterVolume(parseInt(e.currentTarget.value))}
          />
          <span class="value">{$settings.masterVolume}%</span>
        </div>
        
        <!-- Tabs -->
        <div class="tabs">
          <button 
            class:active={activeTab === 'sounds'}
            on:click={() => activeTab = 'sounds'}
          >
            Sounds
          </button>
          <button 
            class:active={activeTab === 'presets'}
            on:click={() => activeTab = 'presets'}
          >
            Presets
          </button>
          <button 
            class:active={activeTab === 'settings'}
            on:click={() => activeTab = 'settings'}
          >
            Settings
          </button>
        </div>
        
        <!-- Sounds Tab -->
        {#if activeTab === 'sounds'}
          <div class="sounds-section">
            <!-- Search -->
            <div class="search-bar">
              <input
                type="text"
                placeholder="Search sounds..."
                bind:value={searchQuery}
              />
            </div>
            
            <!-- Category Filter -->
            <div class="category-filter">
              <button 
                class:active={activeCategory === 'all'}
                on:click={() => activeCategory = 'all'}
              >
                All
              </button>
              <button 
                class:active={activeCategory === 'nature'}
                on:click={() => activeCategory = 'nature'}
              >
                🌲 Nature
              </button>
              <button 
                class:active={activeCategory === 'urban'}
                on:click={() => activeCategory = 'urban'}
              >
                🏙️ Urban
              </button>
              <button 
                class:active={activeCategory === 'white-noise'}
                on:click={() => activeCategory = 'white-noise'}
              >
                📻 Noise
              </button>
              <button 
                class:active={activeCategory === 'music'}
                on:click={() => activeCategory = 'music'}
              >
                🎵 Music
              </button>
            </div>
            
            <!-- Sound Grid -->
            <div class="sound-grid">
              {#each filteredSounds as sound (sound.id)}
                <div class="sound-card" class:playing={sound.isPlaying}>
                  <button 
                    class="sound-toggle"
                    on:click={() => toggleSound(sound.id)}
                  >
                    <span class="sound-icon">{sound.icon}</span>
                    <span class="sound-name">{sound.name}</span>
                    <span class="play-indicator">
                      {sound.isPlaying ? '⏸️' : '▶️'}
                    </span>
                  </button>
                  
                  {#if sound.isPlaying}
                    <div class="volume-control">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sound.volume}
                        on:input={(e) => updateVolume(sound.id, parseInt(e.currentTarget.value))}
                      />
                      <span class="vol-value">{sound.volume}%</span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
            
            {#if filteredSounds.length === 0}
              <div class="empty-state">
                <span>No sounds found</span>
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Presets Tab -->
        {#if activeTab === 'presets'}
          <div class="presets-section">
            <div class="preset-grid">
              {#each $presets as preset (preset.id)}
                <div class="preset-card">
                  <button 
                    class="preset-apply"
                    on:click={() => applyPreset(preset)}
                  >
                    <span class="preset-icon">{preset.icon}</span>
                    <span class="preset-name">{preset.name}</span>
                    <span class="preset-count">{preset.sounds.length} sounds</span>
                  </button>
                  {#if preset.id.startsWith('custom-')}
                    <button 
                      class="preset-delete"
                      on:click={() => deletePreset(preset.id)}
                      title="Delete preset"
                    >
                      🗑️
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
            
            {#if $hasActiveSounds}
              <button 
                class="save-preset-btn"
                on:click={() => showSavePresetModal = true}
              >
                💾 Save Current Mix as Preset
              </button>
            {/if}
          </div>
        {/if}
        
        <!-- Settings Tab -->
        {#if activeTab === 'settings'}
          <div class="settings-section">
            <div class="setting-item">
              <label>
                <span>Fade In Duration</span>
                <div class="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={$settings.fadeInDuration}
                    on:input={(e) => settings.update(s => ({ ...s, fadeInDuration: parseFloat(e.currentTarget.value) }))}
                  />
                  <span>{$settings.fadeInDuration}s</span>
                </div>
              </label>
            </div>
            
            <div class="setting-item">
              <label>
                <span>Fade Out Duration</span>
                <div class="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={$settings.fadeOutDuration}
                    on:input={(e) => settings.update(s => ({ ...s, fadeOutDuration: parseFloat(e.currentTarget.value) }))}
                  />
                  <span>{$settings.fadeOutDuration}s</span>
                </div>
              </label>
            </div>
            
            <div class="setting-item">
              <label>
                <span>Auto-Stop Timer</span>
                <div class="setting-control">
                  <select
                    value={$settings.autoStopMinutes}
                    on:change={(e) => {
                      settings.update(s => ({ ...s, autoStopMinutes: parseInt(e.currentTarget.value) }));
                      resetAutoStopTimer();
                    }}
                  >
                    <option value="0">Off</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                  </select>
                </div>
              </label>
            </div>
            
            <div class="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={$settings.pauseOnCall}
                  on:change={(e) => settings.update(s => ({ ...s, pauseOnCall: e.currentTarget.checked }))}
                />
                <span>Pause on voice/video call</span>
              </label>
            </div>
            
            <div class="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={$settings.resumeAfterCall}
                  on:change={(e) => settings.update(s => ({ ...s, resumeAfterCall: e.currentTarget.checked }))}
                />
                <span>Resume after call ends</span>
              </label>
            </div>
            
            <div class="setting-item checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={$settings.showInTray}
                  on:change={(e) => settings.update(s => ({ ...s, showInTray: e.currentTarget.checked }))}
                />
                <span>Show in system tray</span>
              </label>
            </div>
          </div>
        {/if}
      {:else}
        <!-- Minimized View -->
        <div class="minimized-view">
          {#each $activeSounds as sound (sound.id)}
            <div class="mini-sound">
              <span class="mini-icon">{sound.icon}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sound.volume}
                on:input={(e) => updateVolume(sound.id, parseInt(e.currentTarget.value))}
              />
              <button class="mini-stop" on:click={() => toggleSound(sound.id)}>
                ⏹️
              </button>
            </div>
          {/each}
          {#if !$hasActiveSounds}
            <span class="mini-empty">No sounds playing</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Save Preset Modal -->
  {#if showSavePresetModal}
    <div class="modal-overlay" on:click={() => showSavePresetModal = false}>
      <div class="modal" on:click|stopPropagation>
        <h3>Save Preset</h3>
        
        <div class="modal-field">
          <label>Name</label>
          <input
            type="text"
            placeholder="My Custom Mix"
            bind:value={newPresetName}
            on:keydown={(e) => e.key === 'Enter' && saveCurrentAsPreset()}
          />
        </div>
        
        <div class="modal-field">
          <label>Icon</label>
          <div class="icon-picker">
            {#each presetIcons as icon}
              <button
                class:selected={newPresetIcon === icon}
                on:click={() => newPresetIcon = icon}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>
        
        <div class="modal-field">
          <label>Sounds ({$activeSounds.length})</label>
          <div class="selected-sounds">
            {#each $activeSounds as sound}
              <span class="sound-chip">
                {sound.icon} {sound.name} ({sound.volume}%)
              </span>
            {/each}
          </div>
        </div>
        
        <div class="modal-actions">
          <button class="cancel" on:click={() => showSavePresetModal = false}>
            Cancel
          </button>
          <button 
            class="save" 
            on:click={saveCurrentAsPreset}
            disabled={!newPresetName.trim()}
          >
            Save Preset
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .ambient-sound-manager {
    position: relative;
    z-index: 1000;
  }
  
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .toggle-btn:hover {
    background: var(--bg-hover, #3d3d3d);
  }
  
  .toggle-btn.active {
    background: var(--accent-color, #5865f2);
    border-color: var(--accent-color, #5865f2);
  }
  
  .toggle-btn .icon {
    font-size: 18px;
  }
  
  .toggle-btn .badge {
    background: var(--accent-color, #5865f2);
    color: white;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }
  
  .toggle-btn.active .badge {
    background: white;
    color: var(--accent-color, #5865f2);
  }
  
  .panel {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
    width: 380px;
    max-height: 500px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #404040);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }
  
  .panel.minimized {
    max-height: none;
    width: 320px;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-secondary, #2d2d2d);
    border-bottom: 1px solid var(--border-color, #404040);
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  
  .playing-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--success-color, #3ba55d);
    border-radius: 10px;
  }
  
  .header-actions {
    display: flex;
    gap: 4px;
  }
  
  .icon-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .icon-btn:hover {
    opacity: 1;
    background: var(--bg-hover, #3d3d3d);
  }
  
  .master-volume {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-tertiary, #252525);
  }
  
  .master-volume .label {
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
    white-space: nowrap;
  }
  
  .master-volume input[type="range"] {
    flex: 1;
  }
  
  .master-volume .value {
    font-size: 12px;
    min-width: 36px;
    text-align: right;
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #404040);
  }
  
  .tabs button {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--text-secondary, #b9bbbe);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
  }
  
  .tabs button:hover {
    color: var(--text-primary, #fff);
    background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }
  
  .tabs button.active {
    color: var(--text-primary, #fff);
    border-bottom-color: var(--accent-color, #5865f2);
  }
  
  .sounds-section,
  .presets-section,
  .settings-section {
    padding: 12px;
    max-height: 320px;
    overflow-y: auto;
  }
  
  .search-bar {
    margin-bottom: 12px;
  }
  
  .search-bar input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }
  
  .search-bar input::placeholder {
    color: var(--text-muted, #72767d);
  }
  
  .category-filter {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  
  .category-filter button {
    padding: 6px 10px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-secondary, #b9bbbe);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .category-filter button:hover {
    background: var(--bg-hover, #3d3d3d);
  }
  
  .category-filter button.active {
    background: var(--accent-color, #5865f2);
    border-color: var(--accent-color, #5865f2);
    color: white;
  }
  
  .sound-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .sound-card {
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s;
  }
  
  .sound-card.playing {
    border-color: var(--accent-color, #5865f2);
    box-shadow: 0 0 0 1px var(--accent-color, #5865f2);
  }
  
  .sound-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    text-align: left;
  }
  
  .sound-toggle:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }
  
  .sound-icon {
    font-size: 20px;
  }
  
  .sound-name {
    flex: 1;
    font-size: 13px;
  }
  
  .play-indicator {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-tertiary, #252525);
  }
  
  .volume-control input[type="range"] {
    flex: 1;
    height: 4px;
  }
  
  .volume-control .vol-value {
    font-size: 11px;
    color: var(--text-secondary, #b9bbbe);
    min-width: 32px;
    text-align: right;
  }
  
  .empty-state {
    padding: 24px;
    text-align: center;
    color: var(--text-muted, #72767d);
  }
  
  .preset-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .preset-card {
    display: flex;
    align-items: center;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .preset-apply {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: transparent;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    text-align: left;
  }
  
  .preset-apply:hover {
    background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  }
  
  .preset-icon {
    font-size: 24px;
  }
  
  .preset-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
  }
  
  .preset-count {
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
  }
  
  .preset-delete {
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-left: 1px solid var(--border-color, #404040);
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
  }
  
  .preset-delete:hover {
    opacity: 1;
  }
  
  .save-preset-btn {
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .save-preset-btn:hover {
    background: var(--accent-color-hover, #4752c4);
  }
  
  .setting-item {
    margin-bottom: 16px;
  }
  
  .setting-item label {
    display: block;
  }
  
  .setting-item label > span:first-child {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary, #b9bbbe);
  }
  
  .setting-control {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .setting-control input[type="range"] {
    flex: 1;
  }
  
  .setting-control span {
    min-width: 40px;
    text-align: right;
    font-size: 13px;
  }
  
  .setting-control select {
    flex: 1;
    padding: 8px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 13px;
  }
  
  .setting-item.checkbox label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  
  .setting-item.checkbox label span {
    margin-bottom: 0;
  }
  
  .setting-item.checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  
  .minimized-view {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .mini-sound {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .mini-icon {
    font-size: 16px;
  }
  
  .mini-sound input[type="range"] {
    flex: 1;
  }
  
  .mini-stop {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .mini-stop:hover {
    opacity: 1;
  }
  
  .mini-empty {
    color: var(--text-muted, #72767d);
    font-size: 13px;
    text-align: center;
    padding: 8px;
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  
  .modal {
    width: 340px;
    background: var(--bg-primary, #1e1e1e);
    border: 1px solid var(--border-color, #404040);
    border-radius: 12px;
    padding: 20px;
  }
  
  .modal h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
  
  .modal-field {
    margin-bottom: 16px;
  }
  
  .modal-field label {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--text-secondary, #b9bbbe);
    text-transform: uppercase;
  }
  
  .modal-field input[type="text"] {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-secondary, #2d2d2d);
    border: 1px solid var(--border-color, #404040);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 14px;
  }
  
  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .icon-picker button {
    width: 36px;
    height: 36px;
    background: var(--bg-secondary, #2d2d2d);
    border: 2px solid transparent;
    border-radius: 6px;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .icon-picker button:hover {
    background: var(--bg-hover, #3d3d3d);
  }
  
  .icon-picker button.selected {
    border-color: var(--accent-color, #5865f2);
  }
  
  .selected-sounds {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .sound-chip {
    padding: 4px 8px;
    background: var(--bg-secondary, #2d2d2d);
    border-radius: 4px;
    font-size: 12px;
  }
  
  .modal-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }
  
  .modal-actions button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .modal-actions .cancel {
    background: var(--bg-secondary, #2d2d2d);
    color: var(--text-primary, #fff);
  }
  
  .modal-actions .save {
    background: var(--accent-color, #5865f2);
    color: white;
  }
  
  .modal-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Range input styling */
  input[type="range"] {
    -webkit-appearance: none;
    background: var(--bg-tertiary, #252525);
    border-radius: 4px;
    height: 6px;
  }
  
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: var(--accent-color, #5865f2);
    border-radius: 50%;
    cursor: pointer;
  }
  
  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: var(--accent-color, #5865f2);
    border-radius: 50%;
    border: none;
    cursor: pointer;
  }
</style>
