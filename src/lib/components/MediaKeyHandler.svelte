<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, get } from 'svelte/store';

  // Props
  export let enabled = true;
  export let showIndicator = true;
  export let indicatorDuration = 1500;
  export let preventDefaultKeys = true;

  const dispatch = createEventDispatcher<{
    play: void;
    pause: void;
    playPause: void;
    next: void;
    previous: void;
    stop: void;
    volumeUp: { volume: number };
    volumeDown: { volume: number };
    mute: { muted: boolean };
    seekForward: { seconds: number };
    seekBackward: { seconds: number };
    keyAction: { action: string; timestamp: number };
  }>();

  // State stores
  const isPlaying = writable(false);
  const currentVolume = writable(100);
  const isMuted = writable(false);
  const lastAction = writable<{ action: string; timestamp: number } | null>(null);
  const mediaKeySupported = writable(false);

  // Indicator state
  const showActionIndicator = writable(false);
  const indicatorAction = writable('');
  let indicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  // Media key bindings configuration
  interface MediaKeyBinding {
    key: string;
    code?: string;
    action: string;
    handler: () => void;
  }

  const mediaKeyBindings: MediaKeyBinding[] = [
    {
      key: 'MediaPlayPause',
      action: 'playPause',
      handler: () => handlePlayPause()
    },
    {
      key: 'MediaTrackNext',
      action: 'next',
      handler: () => handleNext()
    },
    {
      key: 'MediaTrackPrevious',
      action: 'previous',
      handler: () => handlePrevious()
    },
    {
      key: 'MediaStop',
      action: 'stop',
      handler: () => handleStop()
    },
    {
      key: 'AudioVolumeUp',
      action: 'volumeUp',
      handler: () => handleVolumeUp()
    },
    {
      key: 'AudioVolumeDown',
      action: 'volumeDown',
      handler: () => handleVolumeDown()
    },
    {
      key: 'AudioVolumeMute',
      action: 'mute',
      handler: () => handleMute()
    }
  ];

  // Keyboard shortcuts for non-media key keyboards
  const keyboardShortcuts: MediaKeyBinding[] = [
    {
      key: ' ',
      code: 'Space',
      action: 'playPause',
      handler: () => handlePlayPause()
    },
    {
      key: 'ArrowRight',
      action: 'seekForward',
      handler: () => handleSeekForward()
    },
    {
      key: 'ArrowLeft',
      action: 'seekBackward',
      handler: () => handleSeekBackward()
    },
    {
      key: 'ArrowUp',
      action: 'volumeUp',
      handler: () => handleVolumeUp()
    },
    {
      key: 'ArrowDown',
      action: 'volumeDown',
      handler: () => handleVolumeDown()
    },
    {
      key: 'm',
      action: 'mute',
      handler: () => handleMute()
    },
    {
      key: 'n',
      action: 'next',
      handler: () => handleNext()
    },
    {
      key: 'p',
      action: 'previous',
      handler: () => handlePrevious()
    }
  ];

  // Action handlers
  function handlePlayPause() {
    const playing = get(isPlaying);
    isPlaying.set(!playing);
    
    if (playing) {
      dispatch('pause');
    } else {
      dispatch('play');
    }
    dispatch('playPause');
    showIndicatorFor(playing ? 'pause' : 'play');
    logAction('playPause');
  }

  function handleNext() {
    dispatch('next');
    showIndicatorFor('next');
    logAction('next');
  }

  function handlePrevious() {
    dispatch('previous');
    showIndicatorFor('previous');
    logAction('previous');
  }

  function handleStop() {
    isPlaying.set(false);
    dispatch('stop');
    showIndicatorFor('stop');
    logAction('stop');
  }

  function handleVolumeUp() {
    const current = get(currentVolume);
    const newVolume = Math.min(100, current + 5);
    currentVolume.set(newVolume);
    
    if (get(isMuted)) {
      isMuted.set(false);
    }
    
    dispatch('volumeUp', { volume: newVolume });
    showIndicatorFor('volumeUp');
    logAction('volumeUp');
  }

  function handleVolumeDown() {
    const current = get(currentVolume);
    const newVolume = Math.max(0, current - 5);
    currentVolume.set(newVolume);
    dispatch('volumeDown', { volume: newVolume });
    showIndicatorFor('volumeDown');
    logAction('volumeDown');
  }

  function handleMute() {
    const muted = get(isMuted);
    isMuted.set(!muted);
    dispatch('mute', { muted: !muted });
    showIndicatorFor(muted ? 'unmute' : 'mute');
    logAction('mute');
  }

  function handleSeekForward() {
    dispatch('seekForward', { seconds: 10 });
    showIndicatorFor('seekForward');
    logAction('seekForward');
  }

  function handleSeekBackward() {
    dispatch('seekBackward', { seconds: 10 });
    showIndicatorFor('seekBackward');
    logAction('seekBackward');
  }

  function showIndicatorFor(action: string) {
    if (!showIndicator) return;
    
    indicatorAction.set(action);
    showActionIndicator.set(true);
    
    if (indicatorTimeout) {
      clearTimeout(indicatorTimeout);
    }
    
    indicatorTimeout = setTimeout(() => {
      showActionIndicator.set(false);
    }, indicatorDuration);
  }

  function logAction(action: string) {
    const timestamp = Date.now();
    lastAction.set({ action, timestamp });
    dispatch('keyAction', { action, timestamp });
  }

  // Key event handler
  function handleKeyDown(event: KeyboardEvent) {
    if (!enabled) return;

    // Check media keys first
    const mediaBinding = mediaKeyBindings.find(
      binding => binding.key === event.key
    );

    if (mediaBinding) {
      if (preventDefaultKeys) {
        event.preventDefault();
      }
      mediaBinding.handler();
      return;
    }

    // Check keyboard shortcuts (only when not in input/textarea)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;

    if (isInput && event.key !== ' ') return;

    const shortcut = keyboardShortcuts.find(
      binding => binding.key === event.key || binding.code === event.code
    );

    if (shortcut && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Special case: spacebar requires shift when not in media context
      if (event.key === ' ' && !event.shiftKey && isInput) return;
      
      if (preventDefaultKeys) {
        event.preventDefault();
      }
      shortcut.handler();
    }
  }

  // Check for media key support
  function checkMediaKeySupport() {
    // Check if MediaSession API is available
    if ('mediaSession' in navigator) {
      mediaKeySupported.set(true);
      setupMediaSessionHandlers();
    }
  }

  // Setup MediaSession API handlers for OS-level media key integration
  function setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;

    const session = navigator.mediaSession;

    session.setActionHandler('play', () => {
      if (!enabled) return;
      isPlaying.set(true);
      dispatch('play');
      showIndicatorFor('play');
      logAction('play');
    });

    session.setActionHandler('pause', () => {
      if (!enabled) return;
      isPlaying.set(false);
      dispatch('pause');
      showIndicatorFor('pause');
      logAction('pause');
    });

    session.setActionHandler('previoustrack', () => {
      if (!enabled) return;
      handlePrevious();
    });

    session.setActionHandler('nexttrack', () => {
      if (!enabled) return;
      handleNext();
    });

    session.setActionHandler('stop', () => {
      if (!enabled) return;
      handleStop();
    });

    session.setActionHandler('seekforward', () => {
      if (!enabled) return;
      handleSeekForward();
    });

    session.setActionHandler('seekbackward', () => {
      if (!enabled) return;
      handleSeekBackward();
    });
  }

  // Get icon for action
  function getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      play: '▶️',
      pause: '⏸️',
      next: '⏭️',
      previous: '⏮️',
      stop: '⏹️',
      volumeUp: '🔊',
      volumeDown: '🔉',
      mute: '🔇',
      unmute: '🔊',
      seekForward: '⏩',
      seekBackward: '⏪'
    };
    return icons[action] || '🎵';
  }

  // Get label for action
  function getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      play: 'Play',
      pause: 'Pause',
      next: 'Next Track',
      previous: 'Previous Track',
      stop: 'Stop',
      volumeUp: 'Volume Up',
      volumeDown: 'Volume Down',
      mute: 'Muted',
      unmute: 'Unmuted',
      seekForward: 'Forward 10s',
      seekBackward: 'Back 10s'
    };
    return labels[action] || action;
  }

  // Public API methods
  export function setPlaying(playing: boolean) {
    isPlaying.set(playing);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  }

  export function setVolume(volume: number) {
    currentVolume.set(Math.max(0, Math.min(100, volume)));
  }

  export function setMuted(muted: boolean) {
    isMuted.set(muted);
  }

  export function setMediaMetadata(metadata: {
    title?: string;
    artist?: string;
    album?: string;
    artwork?: { src: string; sizes?: string; type?: string }[];
  }) {
    if (!('mediaSession' in navigator)) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title || 'Unknown Title',
      artist: metadata.artist || 'Unknown Artist',
      album: metadata.album || 'Unknown Album',
      artwork: metadata.artwork || []
    });
  }

  // Derived stores
  const volumePercent = derived(currentVolume, $vol => $vol);
  const volumeIcon = derived([currentVolume, isMuted], ([$vol, $muted]) => {
    if ($muted || $vol === 0) return '🔇';
    if ($vol < 33) return '🔈';
    if ($vol < 66) return '🔉';
    return '🔊';
  });

  onMount(() => {
    checkMediaKeySupport();
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    if (indicatorTimeout) {
      clearTimeout(indicatorTimeout);
    }
    
    // Clear media session handlers
    if ('mediaSession' in navigator) {
      const actions: MediaSessionAction[] = [
        'play', 'pause', 'previoustrack', 'nexttrack', 
        'stop', 'seekforward', 'seekbackward'
      ];
      actions.forEach(action => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Some actions may not be supported
        }
      });
    }
  });
</script>

<div class="media-key-handler" class:enabled>
  <!-- Visual feedback indicator -->
  {#if $showActionIndicator && showIndicator}
    <div class="action-indicator" role="status" aria-live="polite">
      <div class="indicator-content">
        <span class="indicator-icon">{getActionIcon($indicatorAction)}</span>
        <span class="indicator-label">{getActionLabel($indicatorAction)}</span>
        {#if $indicatorAction === 'volumeUp' || $indicatorAction === 'volumeDown'}
          <div class="volume-bar">
            <div class="volume-fill" style="width: {$volumePercent}%"></div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Status display (optional slot for customization) -->
  <slot 
    name="status" 
    isPlaying={$isPlaying} 
    volume={$currentVolume} 
    muted={$isMuted}
    volumeIcon={$volumeIcon}
    mediaKeySupported={$mediaKeySupported}
  >
    <!-- Default empty - consumers can add custom status UI -->
  </slot>

  <!-- Default slot for child content -->
  <slot />
</div>

<style>
  .media-key-handler {
    position: relative;
  }

  .action-indicator {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    pointer-events: none;
    animation: fadeInOut 1.5s ease-in-out forwards;
  }

  .indicator-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 1.5rem 2rem;
    border-radius: 1rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .indicator-icon {
    font-size: 3rem;
    line-height: 1;
  }

  .indicator-label {
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .volume-bar {
    width: 120px;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 0.5rem;
  }

  .volume-fill {
    height: 100%;
    background: linear-gradient(90deg, #4ade80, #22c55e);
    border-radius: 3px;
    transition: width 0.15s ease-out;
  }

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.8);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    85% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: light) {
    .indicator-content {
      background: rgba(255, 255, 255, 0.95);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .indicator-label {
      color: #1f2937;
    }

    .volume-bar {
      background: rgba(0, 0, 0, 0.1);
    }
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .action-indicator {
      animation: none;
      opacity: 1;
    }
  }
</style>
</script>
