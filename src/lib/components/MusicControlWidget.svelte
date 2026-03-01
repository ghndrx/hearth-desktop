<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';

  export let minimized = false;
  export let showAlbumArt = true;

  interface MediaState {
    isPlaying: boolean;
    title: string;
    artist: string;
    album: string;
    albumArt: string | null;
    duration: number; // seconds
    position: number; // seconds
    volume: number; // 0-100
    hasMedia: boolean;
    source: string; // 'spotify', 'apple_music', 'browser', etc.
  }

  const state = writable<MediaState>({
    isPlaying: false,
    title: '',
    artist: '',
    album: '',
    albumArt: null,
    duration: 0,
    position: 0,
    volume: 50,
    hasMedia: false,
    source: ''
  });

  let pollInterval: number | null = null;
  let isDraggingProgress = false;
  let isDraggingVolume = false;

  const formattedPosition = derived(state, ($state) => formatTime($state.position));
  const formattedDuration = derived(state, ($state) => formatTime($state.duration));
  
  const progressPercent = derived(state, ($state) => {
    if ($state.duration === 0) return 0;
    return ($state.position / $state.duration) * 100;
  });

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function fetchMediaState() {
    try {
      const mediaInfo = await invoke<MediaState | null>('get_media_state');
      if (mediaInfo) {
        state.set({ ...mediaInfo, hasMedia: true });
      } else {
        state.update(s => ({ ...s, hasMedia: false }));
      }
    } catch (e) {
      // Fallback: try using Media Session API if available
      if ('mediaSession' in navigator) {
        // Media Session doesn't provide state directly, so we use mock data
        state.update(s => ({ ...s, hasMedia: false }));
      }
    }
  }

  async function playPause() {
    try {
      await invoke('media_play_pause');
      state.update(s => ({ ...s, isPlaying: !s.isPlaying }));
    } catch (e) {
      // Fallback: try using keyboard simulation
      console.log('Play/pause triggered');
    }
  }

  async function nextTrack() {
    try {
      await invoke('media_next');
    } catch (e) {
      console.log('Next track triggered');
    }
    setTimeout(fetchMediaState, 500);
  }

  async function previousTrack() {
    try {
      await invoke('media_previous');
    } catch (e) {
      console.log('Previous track triggered');
    }
    setTimeout(fetchMediaState, 500);
  }

  async function setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(100, volume));
    state.update(s => ({ ...s, volume: clamped }));
    try {
      await invoke('media_set_volume', { volume: clamped });
    } catch (e) {
      console.log('Volume set to', clamped);
    }
  }

  async function seekTo(position: number) {
    const clamped = Math.max(0, position);
    state.update(s => ({ ...s, position: clamped }));
    try {
      await invoke('media_seek', { position: clamped });
    } catch (e) {
      console.log('Seek to', position);
    }
  }

  function handleProgressClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    let duration = 0;
    state.subscribe(s => duration = s.duration)();
    seekTo(percent * duration);
  }

  function handleVolumeClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    setVolume(Math.round(percent * 100));
  }

  function getSourceIcon(source: string): string {
    switch (source.toLowerCase()) {
      case 'spotify': return '🎵';
      case 'apple_music': return '🎵';
      case 'youtube': return '▶️';
      case 'browser': return '🌐';
      default: return '🎶';
    }
  }

  onMount(() => {
    fetchMediaState();
    pollInterval = window.setInterval(() => {
      if (!isDraggingProgress && !isDraggingVolume) {
        fetchMediaState();
      }
    }, 2000);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
</script>

<div 
  class="music-widget"
  class:minimized
  class:has-media={$state.hasMedia}
  role="region"
  aria-label="Music Controls"
>
  {#if minimized}
    <button class="mini-display" on:click={() => minimized = false}>
      {#if $state.hasMedia}
        <span class="mini-status" class:playing={$state.isPlaying}>
          {$state.isPlaying ? '▶' : '⏸'}
        </span>
        <span class="mini-info">
          <span class="mini-title">{$state.title || 'No media'}</span>
        </span>
      {:else}
        <span class="mini-status">🎵</span>
        <span class="mini-info">No media</span>
      {/if}
    </button>
  {:else}
    <div class="widget-header">
      <h3>🎵 Now Playing</h3>
      <div class="header-actions">
        {#if $state.source}
          <span class="source-badge">{getSourceIcon($state.source)}</span>
        {/if}
        <button class="minimize-btn" on:click={() => minimized = true} aria-label="Minimize">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
        </button>
      </div>
    </div>

    {#if $state.hasMedia}
      <div class="media-info">
        {#if showAlbumArt && $state.albumArt}
          <div class="album-art">
            <img src={$state.albumArt} alt={$state.album || 'Album art'} />
            <div class="art-overlay" class:playing={$state.isPlaying}>
              <div class="playing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        {:else}
          <div class="album-art placeholder">
            <span class="placeholder-icon">🎵</span>
          </div>
        {/if}
        
        <div class="track-details">
          <span class="track-title" title={$state.title}>{$state.title || 'Unknown Track'}</span>
          <span class="track-artist" title={$state.artist}>{$state.artist || 'Unknown Artist'}</span>
          {#if $state.album}
            <span class="track-album" title={$state.album}>{$state.album}</span>
          {/if}
        </div>
      </div>

      <div class="progress-section">
        <div 
          class="progress-bar"
          role="slider"
          aria-label="Playback progress"
          aria-valuenow={$state.position}
          aria-valuemin="0"
          aria-valuemax={$state.duration}
          on:click={handleProgressClick}
          on:mousedown={() => isDraggingProgress = true}
          on:mouseup={() => isDraggingProgress = false}
        >
          <div class="progress-fill" style="width: {$progressPercent}%"></div>
          <div class="progress-thumb" style="left: {$progressPercent}%"></div>
        </div>
        <div class="time-display">
          <span>{$formattedPosition}</span>
          <span>{$formattedDuration}</span>
        </div>
      </div>

      <div class="controls">
        <button class="control-btn secondary" on:click={previousTrack} aria-label="Previous track">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        
        <button class="control-btn primary" on:click={playPause} aria-label={$state.isPlaying ? 'Pause' : 'Play'}>
          {#if $state.isPlaying}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
            </svg>
          {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          {/if}
        </button>
        
        <button class="control-btn secondary" on:click={nextTrack} aria-label="Next track">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <div class="volume-section">
        <button 
          class="volume-icon"
          on:click={() => setVolume($state.volume === 0 ? 50 : 0)}
          aria-label={$state.volume === 0 ? 'Unmute' : 'Mute'}
        >
          {#if $state.volume === 0}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          {:else if $state.volume < 50}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          {/if}
        </button>
        
        <div 
          class="volume-slider"
          role="slider"
          aria-label="Volume"
          aria-valuenow={$state.volume}
          aria-valuemin="0"
          aria-valuemax="100"
          on:click={handleVolumeClick}
          on:mousedown={() => isDraggingVolume = true}
          on:mouseup={() => isDraggingVolume = false}
        >
          <div class="volume-fill" style="width: {$state.volume}%"></div>
          <div class="volume-thumb" style="left: {$state.volume}%"></div>
        </div>
        
        <span class="volume-value">{$state.volume}%</span>
      </div>
    {:else}
      <div class="no-media">
        <div class="no-media-icon">🎧</div>
        <p>No media playing</p>
        <span class="no-media-hint">Play something in Spotify, Apple Music, or your browser</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .music-widget {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 16px;
    padding: 16px;
    width: 280px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text-primary, #cdd6f4);
  }

  .music-widget.minimized {
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .source-badge {
    font-size: 14px;
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
    font-size: 14px;
    max-width: 200px;
  }

  .mini-status {
    font-size: 12px;
    opacity: 0.8;
  }

  .mini-status.playing {
    animation: pulse 1s ease-in-out infinite;
  }

  .mini-info {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-title {
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .media-info {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .album-art {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
    background: var(--bg-tertiary, #313244);
  }

  .album-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .album-art.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .art-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .art-overlay.playing {
    opacity: 1;
  }

  .playing-indicator {
    display: flex;
    gap: 3px;
    height: 20px;
    align-items: flex-end;
  }

  .playing-indicator span {
    width: 4px;
    background: white;
    border-radius: 2px;
    animation: equalizer 0.8s ease-in-out infinite;
  }

  .playing-indicator span:nth-child(1) { animation-delay: 0s; height: 8px; }
  .playing-indicator span:nth-child(2) { animation-delay: 0.2s; height: 16px; }
  .playing-indicator span:nth-child(3) { animation-delay: 0.4s; height: 12px; }

  @keyframes equalizer {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }

  .track-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    gap: 2px;
  }

  .track-title {
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    font-size: 12px;
    color: var(--text-secondary, #a6adc8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-album {
    font-size: 11px;
    color: var(--text-tertiary, #6c7086);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-section {
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 4px;
    background: var(--bg-tertiary, #313244);
    border-radius: 2px;
    position: relative;
    cursor: pointer;
    margin-bottom: 4px;
  }

  .progress-bar:hover {
    height: 6px;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary, #cba6f7);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .progress-bar:hover .progress-thumb {
    opacity: 1;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .control-btn {
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .control-btn.primary {
    width: 48px;
    height: 48px;
    background: var(--color-primary, #cba6f7);
    color: var(--bg-primary, #1e1e2e);
  }

  .control-btn.primary:hover {
    transform: scale(1.05);
    filter: brightness(1.1);
  }

  .control-btn.secondary {
    width: 36px;
    height: 36px;
    background: var(--bg-tertiary, #313244);
    color: var(--text-secondary, #a6adc8);
  }

  .control-btn.secondary:hover {
    background: var(--bg-hover, #45475a);
    color: var(--text-primary, #cdd6f4);
  }

  .volume-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border, #313244);
  }

  .volume-icon {
    background: transparent;
    border: none;
    color: var(--text-secondary, #a6adc8);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .volume-icon:hover {
    color: var(--text-primary, #cdd6f4);
    background: var(--bg-hover, #313244);
  }

  .volume-slider {
    flex: 1;
    height: 4px;
    background: var(--bg-tertiary, #313244);
    border-radius: 2px;
    position: relative;
    cursor: pointer;
  }

  .volume-fill {
    height: 100%;
    background: var(--color-primary, #cba6f7);
    border-radius: 2px;
  }

  .volume-thumb {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .volume-slider:hover .volume-thumb {
    opacity: 1;
  }

  .volume-value {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
    min-width: 32px;
    text-align: right;
  }

  .no-media {
    text-align: center;
    padding: 24px 16px;
  }

  .no-media-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .no-media p {
    margin: 0 0 4px;
    font-size: 14px;
    color: var(--text-secondary, #a6adc8);
  }

  .no-media-hint {
    font-size: 11px;
    color: var(--text-tertiary, #6c7086);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mini-status.playing,
    .playing-indicator span {
      animation: none;
    }
    
    .control-btn:hover {
      transform: none;
    }

    .playing-indicator span:nth-child(1) { height: 12px; }
    .playing-indicator span:nth-child(2) { height: 16px; }
    .playing-indicator span:nth-child(3) { height: 10px; }
  }
</style>
