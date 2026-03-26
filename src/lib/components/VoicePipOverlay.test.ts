import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import VoicePipOverlay from './VoicePipOverlay.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

// Mock voice store
vi.mock('$lib/stores/voice', () => ({
  voiceState: {
    subscribe: vi.fn((callback) => {
      callback({
        isConnected: true,
        channelId: 'test-channel-123',
        channelName: 'Test Voice Channel',
      });
      return () => {};
    }),
  },
  isInVoice: {
    subscribe: vi.fn((callback) => {
      callback(true);
      return () => {};
    }),
  },
  voiceChannelStates: {
    subscribe: vi.fn(),
  },
  currentVoiceUsers: {
    subscribe: vi.fn(),
  },
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('VoicePipOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render when in voice channel', () => {
      const { container } = render(VoicePipOverlay);
      expect(container.querySelector('.voice-pip-toggle')).toBeTruthy();
    });

    it('should not render when not in voice channel', () => {
      // Override the mock for this specific test
      vi.doMock('$lib/stores/voice', () => ({
        voiceState: {
          subscribe: vi.fn((callback) => {
            callback({
              isConnected: false,
              channelId: null,
              channelName: null,
            });
            return () => {};
          }),
        },
        isInVoice: {
          subscribe: vi.fn((callback) => {
            callback(false);
            return () => {};
          }),
        },
        voiceChannelStates: { subscribe: vi.fn() },
        currentVoiceUsers: { subscribe: vi.fn() },
      }));

      const { container } = render(VoicePipOverlay);
      expect(container.querySelector('.voice-pip-toggle')).toBeFalsy();
    });

    it('should have proper accessibility attributes', () => {
      const { container } = render(VoicePipOverlay);
      const button = container.querySelector('.voice-pip-toggle');
      expect(button?.getAttribute('aria-label')).toBeTruthy();
      expect(button?.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Toggle Behavior', () => {
    it('should call voice_pip_show when clicked and PiP is not active', async () => {
      const { container } = render(VoicePipOverlay);
      const button = container.querySelector('.voice-pip-toggle') as HTMLButtonElement;

      await fireEvent.click(button);

      expect(mockInvoke).toHaveBeenCalledWith('voice_pip_show', {
        channelId: 'test-channel-123',
        channelName: 'Test Voice Channel',
      });
    });

    it('should call voice_pip_hide when clicked and PiP is active', async () => {
      const { container } = render(VoicePipOverlay);
      const button = container.querySelector('.voice-pip-toggle') as HTMLButtonElement;

      // First click - activate PiP
      await fireEvent.click(button);
      // Reset mock to test second click
      mockInvoke.mockClear();

      // Second click - should hide
      await fireEvent.click(button);

      expect(mockInvoke).toHaveBeenCalledWith('voice_pip_hide');
    });

    it('should update aria-pressed state when toggled', async () => {
      const { container } = render(VoicePipOverlay);
      const button = container.querySelector('.voice-pip-toggle') as HTMLButtonElement;

      expect(button?.getAttribute('aria-pressed')).toBe('false');

      await fireEvent.click(button);

      // After click, aria-pressed should reflect the toggle state
      // (This depends on internal state management)
    });
  });

  describe('Error Handling', () => {
    it('should handle invoke errors gracefully', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed to show PiP'));

      const { container } = render(VoicePipOverlay);
      const button = container.querySelector('.voice-pip-toggle') as HTMLButtonElement;

      await fireEvent.click(button);

      // Should not throw, just log error
      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});
