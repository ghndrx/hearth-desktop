import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TTSManager from './TTSManager.svelte';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();
const mockUnlisten = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

const mockVoices = [
  {
    id: 'voice-1',
    name: 'Test Voice',
    language: 'en-US',
    gender: 'female',
    local: true,
  },
  {
    id: 'voice-2',
    name: 'Another Voice',
    language: 'en-GB',
    gender: 'male',
    local: true,
  },
];

const mockSettings = {
  enabled: true,
  voice_id: null,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  auto_read_messages: false,
  auto_read_notifications: true,
  announce_user_join_leave: false,
  read_usernames: true,
  read_timestamps: false,
};

const mockStatus = {
  is_speaking: false,
  current_item_id: null,
  queue_length: 0,
};

describe('TTSManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return { ...mockSettings };
        case 'tts_get_status':
          return { ...mockStatus };
        case 'tts_get_queue':
          return [];
        default:
          return undefined;
      }
    });
    
    mockListen.mockResolvedValue(mockUnlisten);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(TTSManager);
    expect(screen.getByText('Initializing text-to-speech...')).toBeInTheDocument();
  });

  it('loads and displays TTS settings after initialization', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Text-to-Speech')).toBeInTheDocument();
    });
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_init');
    expect(mockInvoke).toHaveBeenCalledWith('tts_get_voices');
    expect(mockInvoke).toHaveBeenCalledWith('tts_get_settings');
  });

  it('displays voice selection when TTS is enabled', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const voiceSelect = screen.getByLabelText('Voice');
    expect(voiceSelect).toBeInTheDocument();
  });

  it('displays available voices in dropdown', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const voiceSelect = screen.getByLabelText('Voice') as HTMLSelectElement;
    expect(voiceSelect.options.length).toBe(3); // System Default + 2 voices
    expect(screen.getByText('Test Voice (en-US) - female')).toBeInTheDocument();
    expect(screen.getByText('Another Voice (en-GB) - male')).toBeInTheDocument();
  });

  it('toggles TTS enabled state', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Text-to-Speech')).toBeInTheDocument();
    });
    
    const toggle = screen.getByRole('checkbox');
    await fireEvent.click(toggle);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_set_settings', expect.any(Object));
  });

  it('updates speech rate setting', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const rateSlider = screen.getByLabelText(/Speed:/);
    await fireEvent.change(rateSlider, { target: { value: '1.5' } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('tts_set_settings', expect.objectContaining({
        settings: expect.objectContaining({ rate: 1.5 }),
      }));
    });
  });

  it('updates volume setting', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const volumeSlider = screen.getByLabelText(/Volume:/);
    await fireEvent.change(volumeSlider, { target: { value: '0.75' } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('tts_set_settings', expect.objectContaining({
        settings: expect.objectContaining({ volume: 0.75 }),
      }));
    });
  });

  it('shows advanced settings when toggled', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const advancedButton = screen.getByText('Show Advanced Settings');
    await fireEvent.click(advancedButton);
    
    expect(screen.getByText('Hide Advanced Settings')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pitch:/)).toBeInTheDocument();
  });

  it('tests voice with custom text', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    const testInput = screen.getByPlaceholderText('Enter text to test...');
    await fireEvent.change(testInput, { target: { value: 'Custom test message' } });
    
    const testButton = screen.getByText('Test Voice');
    await fireEvent.click(testButton);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_speak', {
      text: 'Custom test message',
      priority: 'High',
    });
  });

  it('displays auto-read options', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Auto-Read Options')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Auto-read new messages')).toBeInTheDocument();
    expect(screen.getByText('Read notifications')).toBeInTheDocument();
    expect(screen.getByText('Announce user activity')).toBeInTheDocument();
    expect(screen.getByText('Include usernames')).toBeInTheDocument();
    expect(screen.getByText('Include timestamps')).toBeInTheDocument();
  });

  it('toggles auto-read messages option', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Auto-Read Options')).toBeInTheDocument();
    });
    
    const autoReadOption = screen.getByText('Auto-read new messages')
      .closest('label')!
      .querySelector('input')!;
    
    await fireEvent.click(autoReadOption);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_set_settings', expect.objectContaining({
      settings: expect.objectContaining({ auto_read_messages: true }),
    }));
  });

  it('displays playback controls when speaking', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 2 };
        case 'tts_get_queue':
          return [
            { id: 'item-2', text: 'Queued message', priority: 'Normal', voice_id: null },
          ];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });
    
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
    expect(screen.getByTitle('Resume')).toBeInTheDocument();
    expect(screen.getByTitle('Skip')).toBeInTheDocument();
    expect(screen.getByTitle('Stop All')).toBeInTheDocument();
  });

  it('displays queue items', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 2 };
        case 'tts_get_queue':
          return [
            { id: 'item-2', text: 'First queued message', priority: 'Normal', voice_id: null },
            { id: 'item-3', text: 'Second urgent message', priority: 'Urgent', voice_id: null },
          ];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Queue (2)')).toBeInTheDocument();
    });
    
    expect(screen.getByText('First queued message')).toBeInTheDocument();
    expect(screen.getByText('Second urgent message')).toBeInTheDocument();
  });

  it('stops speech when stop button clicked', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 0 };
        case 'tts_get_queue':
          return [];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });
    
    const stopButton = screen.getByTitle('Stop All');
    await fireEvent.click(stopButton);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_stop');
  });

  it('skips current speech when skip button clicked', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 1 };
        case 'tts_get_queue':
          return [{ id: 'item-2', text: 'Next message', priority: 'Normal', voice_id: null }];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Now Playing')).toBeInTheDocument();
    });
    
    const skipButton = screen.getByTitle('Skip');
    await fireEvent.click(skipButton);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_skip');
  });

  it('removes item from queue', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 1 };
        case 'tts_get_queue':
          return [{ id: 'item-2', text: 'Removable message', priority: 'Normal', voice_id: null }];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Removable message')).toBeInTheDocument();
    });
    
    const removeButton = screen.getByTitle('Remove');
    await fireEvent.click(removeButton);
    
    expect(mockInvoke).toHaveBeenCalledWith('tts_remove_from_queue', { itemId: 'item-2' });
  });

  it('displays error banner on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('TTS initialization failed'));
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('TTS initialization failed')).toBeInTheDocument();
    });
  });

  it('dismisses error banner when clicked', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Test error'));
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByText('×');
    await fireEvent.click(dismissButton);
    
    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
  });

  it('sets up event listeners on mount', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Text-to-Speech')).toBeInTheDocument();
    });
    
    expect(mockListen).toHaveBeenCalledWith('tts-settings-changed', expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith('tts-speaking', expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith('tts-item-complete', expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith('tts-stopped', expect.any(Function));
    expect(mockListen).toHaveBeenCalledWith('tts-queue-empty', expect.any(Function));
  });

  it('hides voice settings when TTS is disabled', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return { ...mockSettings, enabled: false };
        case 'tts_get_status':
          return mockStatus;
        case 'tts_get_queue':
          return [];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Text-to-Speech')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Voice Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Auto-Read Options')).not.toBeInTheDocument();
  });

  it('shows voice label with language and gender', async () => {
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('Voice Settings')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Test Voice (en-US) - female')).toBeInTheDocument();
    expect(screen.getByText('Another Voice (en-GB) - male')).toBeInTheDocument();
  });

  it('truncates long queue item text', async () => {
    const longText = 'A'.repeat(100);
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'tts_init':
          return true;
        case 'tts_get_voices':
          return mockVoices;
        case 'tts_get_settings':
          return mockSettings;
        case 'tts_get_status':
          return { is_speaking: true, current_item_id: 'item-1', queue_length: 1 };
        case 'tts_get_queue':
          return [{ id: 'item-2', text: longText, priority: 'Normal', voice_id: null }];
        default:
          return undefined;
      }
    });
    
    render(TTSManager);
    
    await waitFor(() => {
      expect(screen.getByText('A'.repeat(50) + '...')).toBeInTheDocument();
    });
  });
});
