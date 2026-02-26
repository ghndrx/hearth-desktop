import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import MediaSessionManager from './MediaSessionManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

describe('MediaSessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('registers media session on mount when enabled', async () => {
    render(MediaSessionManager, { enabled: true });
    
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_register');
    });
  });

  it('does not register when disabled', async () => {
    render(MediaSessionManager, { enabled: false });
    
    // Give it time to potentially call
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(invoke).not.toHaveBeenCalledWith('media_session_register');
  });

  it('sets up event listeners on mount', async () => {
    render(MediaSessionManager, { enabled: true });
    
    await vi.waitFor(() => {
      expect(listen).toHaveBeenCalledWith('media-session-action', expect.any(Function));
      expect(listen).toHaveBeenCalledWith('media-session-seek', expect.any(Function));
    });
  });

  it('updates metadata when props change', async () => {
    const { component } = render(MediaSessionManager, {
      enabled: true,
      title: 'Initial Title',
      artist: 'Initial Artist'
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_register');
    });

    // Update props
    await component.$set({ title: 'New Title' });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_set_metadata', {
        metadata: expect.objectContaining({
          title: 'New Title'
        })
      });
    });
  });

  it('updates playback state when isPlaying changes', async () => {
    const { component } = render(MediaSessionManager, {
      enabled: true,
      isPlaying: false
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_register');
    });

    // Start playing
    await component.$set({ isPlaying: true });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_set_playback_state', {
        state: expect.objectContaining({
          isPlaying: true
        })
      });
    });
  });

  it('dispatches play event when media action received', async () => {
    let actionCallback: ((event: { payload: string }) => void) | null = null;
    (listen as any).mockImplementation((event: string, callback: any) => {
      if (event === 'media-session-action') {
        actionCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const playHandler = vi.fn();
    const { component } = render(MediaSessionManager, { enabled: true });
    component.$on('play', playHandler);

    await vi.waitFor(() => {
      expect(actionCallback).not.toBeNull();
    });

    // Simulate media action from OS
    actionCallback!({ payload: 'play' });

    expect(playHandler).toHaveBeenCalled();
  });

  it('dispatches pause event when media action received', async () => {
    let actionCallback: ((event: { payload: string }) => void) | null = null;
    (listen as any).mockImplementation((event: string, callback: any) => {
      if (event === 'media-session-action') {
        actionCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const pauseHandler = vi.fn();
    const { component } = render(MediaSessionManager, { enabled: true });
    component.$on('pause', pauseHandler);

    await vi.waitFor(() => {
      expect(actionCallback).not.toBeNull();
    });

    actionCallback!({ payload: 'pause' });

    expect(pauseHandler).toHaveBeenCalled();
  });

  it('dispatches next event when media action received', async () => {
    let actionCallback: ((event: { payload: string }) => void) | null = null;
    (listen as any).mockImplementation((event: string, callback: any) => {
      if (event === 'media-session-action') {
        actionCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const nextHandler = vi.fn();
    const { component } = render(MediaSessionManager, { enabled: true });
    component.$on('next', nextHandler);

    await vi.waitFor(() => {
      expect(actionCallback).not.toBeNull();
    });

    actionCallback!({ payload: 'next' });

    expect(nextHandler).toHaveBeenCalled();
  });

  it('dispatches previous event when media action received', async () => {
    let actionCallback: ((event: { payload: string }) => void) | null = null;
    (listen as any).mockImplementation((event: string, callback: any) => {
      if (event === 'media-session-action') {
        actionCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const previousHandler = vi.fn();
    const { component } = render(MediaSessionManager, { enabled: true });
    component.$on('previous', previousHandler);

    await vi.waitFor(() => {
      expect(actionCallback).not.toBeNull();
    });

    actionCallback!({ payload: 'previous' });

    expect(previousHandler).toHaveBeenCalled();
  });

  it('dispatches seek event with position', async () => {
    let seekCallback: ((event: { payload: number }) => void) | null = null;
    (listen as any).mockImplementation((event: string, callback: any) => {
      if (event === 'media-session-seek') {
        seekCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const seekHandler = vi.fn();
    const { component } = render(MediaSessionManager, { enabled: true });
    component.$on('seek', seekHandler);

    await vi.waitFor(() => {
      expect(seekCallback).not.toBeNull();
    });

    seekCallback!({ payload: 120.5 });

    expect(seekHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { position: 120.5 }
      })
    );
  });

  it('unregisters on destroy', async () => {
    const { unmount } = render(MediaSessionManager, { enabled: true });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_register');
    });

    unmount();

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_unregister');
    });
  });

  it('handles registration failure gracefully', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (invoke as any).mockRejectedValueOnce(new Error('Registration failed'));

    render(MediaSessionManager, { enabled: true });

    await vi.waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith(
        'MediaSessionManager: Failed to register media session:',
        expect.any(Error)
      );
    });

    consoleWarn.mockRestore();
  });

  it('sends full metadata with all fields', async () => {
    render(MediaSessionManager, {
      enabled: true,
      title: 'Song Title',
      artist: 'Artist Name',
      album: 'Album Name',
      artwork: 'https://example.com/artwork.jpg',
      duration: 180
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_set_metadata', {
        metadata: {
          title: 'Song Title',
          artist: 'Artist Name',
          album: 'Album Name',
          artwork: 'https://example.com/artwork.jpg',
          duration: 180
        }
      });
    });
  });

  it('includes position in playback state when set', async () => {
    render(MediaSessionManager, {
      enabled: true,
      isPlaying: true,
      position: 45.5
    });

    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('media_session_set_playback_state', {
        state: {
          isPlaying: true,
          position: 45.5
        }
      });
    });
  });

  it('renders slot content', () => {
    const { container } = render(MediaSessionManager, {
      props: { enabled: true },
      slots: {
        default: '<span data-testid="slot-content">Player UI</span>'
      }
    });

    expect(container.querySelector('[data-testid="slot-content"]')).toBeTruthy();
  });
});
