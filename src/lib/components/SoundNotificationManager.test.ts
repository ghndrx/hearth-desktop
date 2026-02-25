import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import SoundNotificationManager, {
  soundSettings,
  playSound,
  playNotificationSound,
  previewSound,
} from './SoundNotificationManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(false),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    gain: { value: 1 },
    connect: vi.fn(),
  }),
  decodeAudioData: vi.fn().mockResolvedValue({}),
  destination: {},
};

// @ts-ignore
global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

// Mock fetch for loading sounds
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
});

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SoundNotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset settings store to defaults
    soundSettings.set({
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
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders with sound notifications enabled', () => {
      render(SoundNotificationManager);
      expect(screen.getByText('Sound Notifications')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Message Sound')).toBeInTheDocument();
    });

    it('shows volume percentage', () => {
      render(SoundNotificationManager);
      expect(screen.getByText('70%')).toBeInTheDocument();
    });

    it('hides settings when disabled', async () => {
      soundSettings.update((s) => ({ ...s, enabled: false }));
      render(SoundNotificationManager);
      
      expect(screen.getByText('Sound Notifications')).toBeInTheDocument();
      expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    });

    it('displays all sound selection dropdowns', () => {
      render(SoundNotificationManager);
      
      expect(screen.getByText('Message Sound')).toBeInTheDocument();
      expect(screen.getByText('Mention Sound')).toBeInTheDocument();
      expect(screen.getByText('Direct Message Sound')).toBeInTheDocument();
      expect(screen.getByText('User Joined Voice')).toBeInTheDocument();
      expect(screen.getByText('User Left Voice')).toBeInTheDocument();
    });

    it('displays DND and Focus Mode options', () => {
      render(SoundNotificationManager);
      
      expect(screen.getByText('Mute sounds during Do Not Disturb')).toBeInTheDocument();
      expect(screen.getByText('Mute sounds during Focus Mode')).toBeInTheDocument();
    });
  });

  describe('Settings Persistence', () => {
    it('saves settings to localStorage on change', async () => {
      render(SoundNotificationManager);
      
      // Wait for initial render
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
      
      const calls = localStorageMock.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('hearth-sound-settings');
    });

    it('loads settings from localStorage on mount', async () => {
      const savedSettings = JSON.stringify({
        enabled: false,
        volume: 0.5,
        messageSound: 'bell',
      });
      localStorageMock.store['hearth-sound-settings'] = savedSettings;
      localStorageMock.getItem.mockReturnValue(savedSettings);

      render(SoundNotificationManager);
      
      // Settings should be loaded (component hides options when disabled)
      await waitFor(() => {
        expect(screen.queryByText('Volume')).not.toBeInTheDocument();
      });
    });
  });

  describe('Toggle Functionality', () => {
    it('toggles sound notifications on/off', async () => {
      render(SoundNotificationManager);
      
      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeChecked();
      
      await fireEvent.click(toggle);
      expect(toggle).not.toBeChecked();
      
      // Volume control should be hidden
      expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    });

    it('toggles DND mute option', async () => {
      render(SoundNotificationManager);
      
      const checkboxes = screen.getAllByRole('checkbox');
      const dndCheckbox = checkboxes.find((cb) =>
        cb.parentElement?.textContent?.includes('Do Not Disturb')
      );
      
      expect(dndCheckbox).toBeChecked();
      await fireEvent.click(dndCheckbox!);
      expect(dndCheckbox).not.toBeChecked();
    });

    it('toggles Focus Mode mute option', async () => {
      render(SoundNotificationManager);
      
      const checkboxes = screen.getAllByRole('checkbox');
      const focusCheckbox = checkboxes.find((cb) =>
        cb.parentElement?.textContent?.includes('Focus Mode')
      );
      
      expect(focusCheckbox).toBeChecked();
      await fireEvent.click(focusCheckbox!);
      expect(focusCheckbox).not.toBeChecked();
    });
  });

  describe('Volume Control', () => {
    it('updates volume when slider is changed', async () => {
      render(SoundNotificationManager);
      
      const slider = screen.getByRole('slider');
      await fireEvent.input(slider, { target: { value: '0.5' } });
      
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Sound Selection', () => {
    it('has correct default sound selections', () => {
      render(SoundNotificationManager);
      
      const selects = screen.getAllByRole('combobox');
      
      expect(selects[0]).toHaveValue('pop'); // Message
      expect(selects[1]).toHaveValue('ping'); // Mention
      expect(selects[2]).toHaveValue('chime'); // DM
      expect(selects[3]).toHaveValue('join'); // Join
      expect(selects[4]).toHaveValue('leave'); // Leave
    });

    it('changes sound selection', async () => {
      render(SoundNotificationManager);
      
      const selects = screen.getAllByRole('combobox');
      await fireEvent.change(selects[0], { target: { value: 'bell' } });
      
      expect(selects[0]).toHaveValue('bell');
    });
  });

  describe('Test Sound Buttons', () => {
    it('renders test buttons for each sound type', () => {
      render(SoundNotificationManager);
      
      const testButtons = screen.getAllByTitle('Test sound');
      expect(testButtons).toHaveLength(5);
    });

    it('disables test button when sound is set to none', async () => {
      render(SoundNotificationManager);
      
      const selects = screen.getAllByRole('combobox');
      await fireEvent.change(selects[0], { target: { value: 'none' } });
      
      const testButtons = screen.getAllByTitle('Test sound');
      expect(testButtons[0]).toBeDisabled();
    });
  });

  describe('Sound Playback Functions', () => {
    it('playSound does nothing when disabled', async () => {
      soundSettings.update((s) => ({ ...s, enabled: false }));
      
      await playSound('pop');
      
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });

    it('playSound does nothing for "none" sound', async () => {
      await playSound('none');
      
      expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();
    });

    it('playNotificationSound plays correct sound for message type', async () => {
      soundSettings.update((s) => ({ ...s, messageSound: 'bell' }));
      
      await playNotificationSound('message');
      
      expect(global.fetch).toHaveBeenCalledWith('/sounds/bell.mp3');
    });

    it('playNotificationSound plays correct sound for mention type', async () => {
      soundSettings.update((s) => ({ ...s, mentionSound: 'ding' }));
      
      await playNotificationSound('mention');
      
      expect(global.fetch).toHaveBeenCalledWith('/sounds/ding.mp3');
    });

    it('previewSound plays regardless of enabled state', async () => {
      soundSettings.update((s) => ({ ...s, enabled: false }));
      
      await previewSound('pop');
      
      // previewSound should still attempt to play
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('DND Integration', () => {
    it('respects DND status when muteInDnd is true', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce(true); // DND active
      
      await playSound('pop');
      
      expect(invoke).toHaveBeenCalledWith('is_dnd_active');
    });
  });

  describe('Accessibility', () => {
    it('has accessible volume slider', () => {
      render(SoundNotificationManager);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '0');
      expect(slider).toHaveAttribute('max', '1');
    });

    it('test buttons have accessible title', () => {
      render(SoundNotificationManager);
      
      const testButtons = screen.getAllByTitle('Test sound');
      testButtons.forEach((button) => {
        expect(button).toHaveAttribute('title', 'Test sound');
      });
    });
  });
});
