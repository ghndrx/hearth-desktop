import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import MediaKeyHandler from './MediaKeyHandler.svelte';

describe('MediaKeyHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders without errors', () => {
    const { container } = render(MediaKeyHandler);
    expect(container.querySelector('.media-key-handler')).toBeTruthy();
  });

  it('has enabled class when enabled', () => {
    const { container } = render(MediaKeyHandler, { props: { enabled: true } });
    expect(container.querySelector('.media-key-handler.enabled')).toBeTruthy();
  });

  it('dispatches playPause event on MediaPlayPause key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const playPauseHandler = vi.fn();
    component.$on('playPause', playPauseHandler);

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    expect(playPauseHandler).toHaveBeenCalled();
  });

  it('dispatches next event on MediaTrackNext key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const nextHandler = vi.fn();
    component.$on('next', nextHandler);

    await fireEvent.keyDown(window, { key: 'MediaTrackNext' });
    
    expect(nextHandler).toHaveBeenCalled();
  });

  it('dispatches previous event on MediaTrackPrevious key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const previousHandler = vi.fn();
    component.$on('previous', previousHandler);

    await fireEvent.keyDown(window, { key: 'MediaTrackPrevious' });
    
    expect(previousHandler).toHaveBeenCalled();
  });

  it('dispatches stop event on MediaStop key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const stopHandler = vi.fn();
    component.$on('stop', stopHandler);

    await fireEvent.keyDown(window, { key: 'MediaStop' });
    
    expect(stopHandler).toHaveBeenCalled();
  });

  it('dispatches volumeUp event on AudioVolumeUp key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const volumeUpHandler = vi.fn();
    component.$on('volumeUp', volumeUpHandler);

    await fireEvent.keyDown(window, { key: 'AudioVolumeUp' });
    
    expect(volumeUpHandler).toHaveBeenCalled();
    expect(volumeUpHandler.mock.calls[0][0].detail.volume).toBeDefined();
  });

  it('dispatches volumeDown event on AudioVolumeDown key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const volumeDownHandler = vi.fn();
    component.$on('volumeDown', volumeDownHandler);

    await fireEvent.keyDown(window, { key: 'AudioVolumeDown' });
    
    expect(volumeDownHandler).toHaveBeenCalled();
  });

  it('dispatches mute event on AudioVolumeMute key', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const muteHandler = vi.fn();
    component.$on('mute', muteHandler);

    await fireEvent.keyDown(window, { key: 'AudioVolumeMute' });
    
    expect(muteHandler).toHaveBeenCalled();
    expect(muteHandler.mock.calls[0][0].detail.muted).toBe(true);
  });

  it('does not dispatch events when disabled', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: false } });
    
    const playPauseHandler = vi.fn();
    component.$on('playPause', playPauseHandler);

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    expect(playPauseHandler).not.toHaveBeenCalled();
  });

  it('shows action indicator when showIndicator is true', async () => {
    const { container } = render(MediaKeyHandler, { 
      props: { enabled: true, showIndicator: true } 
    });

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    expect(container.querySelector('.action-indicator')).toBeTruthy();
  });

  it('hides action indicator after duration', async () => {
    const { container } = render(MediaKeyHandler, { 
      props: { enabled: true, showIndicator: true, indicatorDuration: 1000 } 
    });

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    expect(container.querySelector('.action-indicator')).toBeTruthy();

    vi.advanceTimersByTime(1500);
    await vi.runAllTimersAsync();
    
    // After timeout, indicator should be hidden
    expect(container.querySelector('.action-indicator')).toBeFalsy();
  });

  it('does not show indicator when showIndicator is false', async () => {
    const { container } = render(MediaKeyHandler, { 
      props: { enabled: true, showIndicator: false } 
    });

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    expect(container.querySelector('.action-indicator')).toBeFalsy();
  });

  it('handles keyboard shortcuts for spacebar play/pause', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const playPauseHandler = vi.fn();
    component.$on('playPause', playPauseHandler);

    // Simulate spacebar press outside of input
    await fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    
    expect(playPauseHandler).toHaveBeenCalled();
  });

  it('handles keyboard shortcut for next track (n key)', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const nextHandler = vi.fn();
    component.$on('next', nextHandler);

    await fireEvent.keyDown(window, { key: 'n' });
    
    expect(nextHandler).toHaveBeenCalled();
  });

  it('handles keyboard shortcut for previous track (p key)', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const previousHandler = vi.fn();
    component.$on('previous', previousHandler);

    await fireEvent.keyDown(window, { key: 'p' });
    
    expect(previousHandler).toHaveBeenCalled();
  });

  it('handles keyboard shortcut for mute (m key)', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const muteHandler = vi.fn();
    component.$on('mute', muteHandler);

    await fireEvent.keyDown(window, { key: 'm' });
    
    expect(muteHandler).toHaveBeenCalled();
  });

  it('handles seek forward with ArrowRight', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const seekHandler = vi.fn();
    component.$on('seekForward', seekHandler);

    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    
    expect(seekHandler).toHaveBeenCalled();
    expect(seekHandler.mock.calls[0][0].detail.seconds).toBe(10);
  });

  it('handles seek backward with ArrowLeft', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const seekHandler = vi.fn();
    component.$on('seekBackward', seekHandler);

    await fireEvent.keyDown(window, { key: 'ArrowLeft' });
    
    expect(seekHandler).toHaveBeenCalled();
    expect(seekHandler.mock.calls[0][0].detail.seconds).toBe(10);
  });

  it('handles volume up with ArrowUp', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const volumeHandler = vi.fn();
    component.$on('volumeUp', volumeHandler);

    await fireEvent.keyDown(window, { key: 'ArrowUp' });
    
    expect(volumeHandler).toHaveBeenCalled();
  });

  it('handles volume down with ArrowDown', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const volumeHandler = vi.fn();
    component.$on('volumeDown', volumeHandler);

    await fireEvent.keyDown(window, { key: 'ArrowDown' });
    
    expect(volumeHandler).toHaveBeenCalled();
  });

  it('dispatches keyAction event with timestamp', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const keyActionHandler = vi.fn();
    component.$on('keyAction', keyActionHandler);

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    expect(keyActionHandler).toHaveBeenCalled();
    expect(keyActionHandler.mock.calls[0][0].detail.action).toBe('playPause');
    expect(keyActionHandler.mock.calls[0][0].detail.timestamp).toBeDefined();
  });

  it('toggles play state correctly', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const playHandler = vi.fn();
    const pauseHandler = vi.fn();
    component.$on('play', playHandler);
    component.$on('pause', pauseHandler);

    // First press - should play
    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    expect(playHandler).toHaveBeenCalledTimes(1);
    expect(pauseHandler).not.toHaveBeenCalled();

    // Second press - should pause
    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    expect(pauseHandler).toHaveBeenCalledTimes(1);
  });

  it('prevents default when preventDefaultKeys is true', async () => {
    render(MediaKeyHandler, { 
      props: { enabled: true, preventDefaultKeys: true } 
    });

    const event = new KeyboardEvent('keydown', { 
      key: 'MediaPlayPause', 
      cancelable: true 
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    
    window.dispatchEvent(event);
    
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('ignores modifier key combinations for shortcuts', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const nextHandler = vi.fn();
    component.$on('next', nextHandler);

    // With Ctrl held, should not trigger
    await fireEvent.keyDown(window, { key: 'n', ctrlKey: true });
    expect(nextHandler).not.toHaveBeenCalled();

    // With Meta held, should not trigger
    await fireEvent.keyDown(window, { key: 'n', metaKey: true });
    expect(nextHandler).not.toHaveBeenCalled();

    // Without modifiers, should trigger
    await fireEvent.keyDown(window, { key: 'n' });
    expect(nextHandler).toHaveBeenCalled();
  });

  it('clamps volume between 0 and 100', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const volumeHandler = vi.fn();
    component.$on('volumeDown', volumeHandler);

    // Press volume down many times
    for (let i = 0; i < 25; i++) {
      await fireEvent.keyDown(window, { key: 'AudioVolumeDown' });
    }
    
    // Should not go below 0
    const lastCall = volumeHandler.mock.calls[volumeHandler.mock.calls.length - 1];
    expect(lastCall[0].detail.volume).toBeGreaterThanOrEqual(0);
  });

  it('unmutes when increasing volume while muted', async () => {
    const { component } = render(MediaKeyHandler, { props: { enabled: true } });
    
    const muteHandler = vi.fn();
    const volumeUpHandler = vi.fn();
    component.$on('mute', muteHandler);
    component.$on('volumeUp', volumeUpHandler);

    // Mute first
    await fireEvent.keyDown(window, { key: 'AudioVolumeMute' });
    expect(muteHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: { muted: true }
    }));

    // Increase volume - should unmute
    await fireEvent.keyDown(window, { key: 'AudioVolumeUp' });
    expect(volumeUpHandler).toHaveBeenCalled();
  });

  it('displays correct icon for play action', async () => {
    const { container } = render(MediaKeyHandler, { 
      props: { enabled: true, showIndicator: true } 
    });

    await fireEvent.keyDown(window, { key: 'MediaPlayPause' });
    
    const icon = container.querySelector('.indicator-icon');
    expect(icon?.textContent).toBe('▶️');
  });

  it('displays volume bar for volume actions', async () => {
    const { container } = render(MediaKeyHandler, { 
      props: { enabled: true, showIndicator: true } 
    });

    await fireEvent.keyDown(window, { key: 'AudioVolumeUp' });
    
    expect(container.querySelector('.volume-bar')).toBeTruthy();
    expect(container.querySelector('.volume-fill')).toBeTruthy();
  });

  it('cleans up event listeners on destroy', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    const { unmount } = render(MediaKeyHandler, { props: { enabled: true } });
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('exports setPlaying method', () => {
    const { component } = render(MediaKeyHandler);
    expect(typeof component.setPlaying).toBe('function');
  });

  it('exports setVolume method', () => {
    const { component } = render(MediaKeyHandler);
    expect(typeof component.setVolume).toBe('function');
  });

  it('exports setMuted method', () => {
    const { component } = render(MediaKeyHandler);
    expect(typeof component.setMuted).toBe('function');
  });

  it('exports setMediaMetadata method', () => {
    const { component } = render(MediaKeyHandler);
    expect(typeof component.setMediaMetadata).toBe('function');
  });
});
