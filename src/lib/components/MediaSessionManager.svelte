<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  // Props
  export let enabled: boolean = true;
  export let title: string = '';
  export let artist: string = '';
  export let album: string = '';
  export let artwork: string = '';
  export let isPlaying: boolean = false;
  export let duration: number = 0;
  export let position: number = 0;

  // Events
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    play: void;
    pause: void;
    stop: void;
    next: void;
    previous: void;
    seek: { position: number };
  }>();

  // State
  let isRegistered = false;
  let unlistenMediaAction: UnlistenFn | null = null;
  let unlistenMediaSeek: UnlistenFn | null = null;

  interface MediaMetadata {
    title: string;
    artist: string;
    album: string;
    artwork?: string;
    duration?: number;
  }

  interface MediaPlaybackState {
    isPlaying: boolean;
    position?: number;
  }

  // Register with the native media session
  async function registerMediaSession(): Promise<void> {
    if (!enabled || isRegistered) return;

    try {
      await invoke('media_session_register');
      isRegistered = true;
      await updateMetadata();
      await updatePlaybackState();
    } catch (error) {
      console.warn('MediaSessionManager: Failed to register media session:', error);
    }
  }

  // Unregister from the native media session
  async function unregisterMediaSession(): Promise<void> {
    if (!isRegistered) return;

    try {
      await invoke('media_session_unregister');
      isRegistered = false;
    } catch (error) {
      console.warn('MediaSessionManager: Failed to unregister media session:', error);
    }
  }

  // Update media metadata (title, artist, artwork)
  async function updateMetadata(): Promise<void> {
    if (!isRegistered) return;

    const metadata: MediaMetadata = {
      title: title || 'Unknown',
      artist: artist || '',
      album: album || '',
      artwork: artwork || undefined,
      duration: duration > 0 ? duration : undefined
    };

    try {
      await invoke('media_session_set_metadata', { metadata });
    } catch (error) {
      console.warn('MediaSessionManager: Failed to update metadata:', error);
    }
  }

  // Update playback state (playing/paused, position)
  async function updatePlaybackState(): Promise<void> {
    if (!isRegistered) return;

    const state: MediaPlaybackState = {
      isPlaying,
      position: position > 0 ? position : undefined
    };

    try {
      await invoke('media_session_set_playback_state', { state });
    } catch (error) {
      console.warn('MediaSessionManager: Failed to update playback state:', error);
    }
  }

  // Handle media actions from the OS
  async function handleMediaAction(action: string): Promise<void> {
    switch (action) {
      case 'play':
        dispatch('play');
        break;
      case 'pause':
        dispatch('pause');
        break;
      case 'stop':
        dispatch('stop');
        break;
      case 'next':
        dispatch('next');
        break;
      case 'previous':
        dispatch('previous');
        break;
      default:
        console.log('MediaSessionManager: Unknown action:', action);
    }
  }

  // Handle seek requests from the OS
  async function handleSeekRequest(newPosition: number): Promise<void> {
    dispatch('seek', { position: newPosition });
  }

  // Set up event listeners for media actions
  async function setupEventListeners(): Promise<void> {
    try {
      unlistenMediaAction = await listen<string>('media-session-action', (event) => {
        handleMediaAction(event.payload);
      });

      unlistenMediaSeek = await listen<number>('media-session-seek', (event) => {
        handleSeekRequest(event.payload);
      });
    } catch (error) {
      console.warn('MediaSessionManager: Failed to set up event listeners:', error);
    }
  }

  // Clean up event listeners
  function cleanupEventListeners(): void {
    if (unlistenMediaAction) {
      unlistenMediaAction();
      unlistenMediaAction = null;
    }
    if (unlistenMediaSeek) {
      unlistenMediaSeek();
      unlistenMediaSeek = null;
    }
  }

  // Reactive statements to update native session when props change
  $: if (isRegistered && (title || artist || album || artwork || duration)) {
    updateMetadata();
  }

  $: if (isRegistered) {
    updatePlaybackState();
  }

  $: if (enabled && !isRegistered) {
    registerMediaSession();
  } else if (!enabled && isRegistered) {
    unregisterMediaSession();
  }

  onMount(async () => {
    await setupEventListeners();
    if (enabled) {
      await registerMediaSession();
    }
  });

  onDestroy(() => {
    cleanupEventListeners();
    unregisterMediaSession();
  });

  // Expose methods for external control
  export function play(): void {
    isPlaying = true;
    updatePlaybackState();
  }

  export function pause(): void {
    isPlaying = false;
    updatePlaybackState();
  }

  export function setPosition(newPosition: number): void {
    position = newPosition;
    updatePlaybackState();
  }

  export function setMetadata(meta: Partial<MediaMetadata>): void {
    if (meta.title !== undefined) title = meta.title;
    if (meta.artist !== undefined) artist = meta.artist;
    if (meta.album !== undefined) album = meta.album;
    if (meta.artwork !== undefined) artwork = meta.artwork;
    if (meta.duration !== undefined) duration = meta.duration;
    updateMetadata();
  }
</script>

<!-- MediaSessionManager is headless - no DOM elements needed -->
<slot />
