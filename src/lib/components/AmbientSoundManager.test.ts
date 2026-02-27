import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AmbientSoundManager from './AmbientSoundManager.svelte';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock Audio API
const mockAudioInstances: Map<string, any> = new Map();

class MockAudio {
  src: string = '';
  loop: boolean = false;
  volume: number = 1;
  paused: boolean = true;

  constructor(src?: string) {
    if (src) {
      this.src = src;
      mockAudioInstances.set(src, this);
    }
  }

  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
}

global.Audio = MockAudio as any;

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

describe('AmbientSoundManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioInstances.clear();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders toggle button', () => {
      render(AmbientSoundManager);
      expect(screen.getByTitle('Ambient Sounds')).toBeInTheDocument();
    });

    it('shows panel when toggle button is clicked', async () => {
      render(AmbientSoundManager);
      
      const toggleBtn = screen.getByTitle('Ambient Sounds');
      await fireEvent.click(toggleBtn);
      
      expect(screen.getByText('🎧 Ambient Sounds')).toBeInTheDocument();
    });

    it('shows all tabs when panel is open', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      expect(screen.getByRole('button', { name: 'Sounds' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Presets' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });
  });

  describe('sounds tab', () => {
    it('displays available sounds', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Check for some default sounds
      expect(screen.getByText('Rain')).toBeInTheDocument();
      expect(screen.getByText('Ocean Waves')).toBeInTheDocument();
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    });

    it('filters sounds by category', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Click on Nature category
      const natureBtn = screen.getByRole('button', { name: /Nature/i });
      await fireEvent.click(natureBtn);
      
      // Nature sounds should be visible
      expect(screen.getByText('Rain')).toBeInTheDocument();
      expect(screen.getByText('Forest')).toBeInTheDocument();
      
      // Urban sounds should not be visible (Coffee Shop is urban)
      expect(screen.queryByText('Coffee Shop')).not.toBeInTheDocument();
    });

    it('searches sounds by name', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      const searchInput = screen.getByPlaceholderText('Search sounds...');
      await fireEvent.input(searchInput, { target: { value: 'rain' } });
      
      expect(screen.getByText('Rain')).toBeInTheDocument();
      expect(screen.queryByText('Ocean Waves')).not.toBeInTheDocument();
    });

    it('toggles sound playback when clicked', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Find and click the Rain sound toggle
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      // Volume control should appear when sound is playing
      await waitFor(() => {
        const volumeInputs = screen.getAllByRole('slider');
        // Should have master volume + sound volume
        expect(volumeInputs.length).toBeGreaterThan(1);
      });
    });

    it('shows badge with active sound count', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      // Should show playing badge in header
      await waitFor(() => {
        expect(screen.getByText('1 playing')).toBeInTheDocument();
      });
    });
  });

  describe('presets tab', () => {
    it('displays default presets', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      
      expect(screen.getByText('Deep Focus')).toBeInTheDocument();
      expect(screen.getByText('Relaxation')).toBeInTheDocument();
      expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
      expect(screen.getByText('Nature Walk')).toBeInTheDocument();
    });

    it('applies preset when clicked', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      
      // Click on Deep Focus preset
      const presetBtn = screen.getByText('Deep Focus').closest('button');
      if (presetBtn) {
        await fireEvent.click(presetBtn);
      }
      
      // Should show playing count (Deep Focus has 2 sounds)
      await waitFor(() => {
        expect(screen.getByText('2 playing')).toBeInTheDocument();
      });
    });

    it('shows save preset button when sounds are playing', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound first
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      // Go to presets tab
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      
      expect(screen.getByText('💾 Save Current Mix as Preset')).toBeInTheDocument();
    });

    it('opens save preset modal', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      await fireEvent.click(screen.getByText('💾 Save Current Mix as Preset'));
      
      expect(screen.getByText('Save Preset')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('My Custom Mix')).toBeInTheDocument();
    });

    it('saves custom preset', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      await fireEvent.click(screen.getByText('💾 Save Current Mix as Preset'));
      
      const nameInput = screen.getByPlaceholderText('My Custom Mix');
      await fireEvent.input(nameInput, { target: { value: 'Test Preset' } });
      
      await fireEvent.click(screen.getByRole('button', { name: 'Save Preset' }));
      
      // Modal should close and new preset should appear
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('My Custom Mix')).not.toBeInTheDocument();
      });
    });
  });

  describe('settings tab', () => {
    it('displays all settings options', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      expect(screen.getByText('Fade In Duration')).toBeInTheDocument();
      expect(screen.getByText('Fade Out Duration')).toBeInTheDocument();
      expect(screen.getByText('Auto-Stop Timer')).toBeInTheDocument();
      expect(screen.getByText('Pause on voice/video call')).toBeInTheDocument();
      expect(screen.getByText('Resume after call ends')).toBeInTheDocument();
      expect(screen.getByText('Show in system tray')).toBeInTheDocument();
    });

    it('updates fade in duration', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Get the fade in slider (first range input after tab navigation)
      const sliders = screen.getAllByRole('slider');
      // First slider after settings tab is fade in
      const fadeInSlider = sliders.find(s => {
        const parent = s.closest('.setting-item');
        return parent?.textContent?.includes('Fade In');
      });
      
      if (fadeInSlider) {
        await fireEvent.input(fadeInSlider, { target: { value: '5' } });
        expect(screen.getByText('5s')).toBeInTheDocument();
      }
    });

    it('saves settings to localStorage', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Change a checkbox
      const pauseOnCallCheckbox = screen.getByText('Pause on voice/video call')
        .closest('label')
        ?.querySelector('input[type="checkbox"]');
      
      if (pauseOnCallCheckbox) {
        await fireEvent.click(pauseOnCallCheckbox);
      }
      
      // Settings should be saved
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'hearth-ambient-settings',
          expect.any(String)
        );
      });
    });
  });

  describe('master volume', () => {
    it('displays master volume slider', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      expect(screen.getByText('Master Volume')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('updates master volume', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      const sliders = screen.getAllByRole('slider');
      const masterSlider = sliders[0]; // First slider is master volume
      
      await fireEvent.input(masterSlider, { target: { value: '50' } });
      
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('minimized view', () => {
    it('toggles minimized state', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Click minimize button
      const minimizeBtn = screen.getByTitle('Minimize');
      await fireEvent.click(minimizeBtn);
      
      // Expand button should now be visible
      expect(screen.getByTitle('Expand')).toBeInTheDocument();
    });

    it('shows active sounds in minimized view', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      // Minimize
      await fireEvent.click(screen.getByTitle('Minimize'));
      
      // Should show "No sounds playing" message not visible, rain icon should be
      expect(screen.queryByText('No sounds playing')).not.toBeInTheDocument();
    });

    it('shows empty message when no sounds playing in minimized view', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByTitle('Minimize'));
      
      expect(screen.getByText('No sounds playing')).toBeInTheDocument();
    });
  });

  describe('stop all functionality', () => {
    it('shows stop all button when sounds are playing', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      // Stop all button should appear
      await waitFor(() => {
        expect(screen.getByTitle('Stop All')).toBeInTheDocument();
      });
    });

    it('stops all sounds when stop all is clicked', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Play a sound
      const rainCard = screen.getByText('Rain').closest('button');
      if (rainCard) {
        await fireEvent.click(rainCard);
      }
      
      await waitFor(() => {
        expect(screen.getByText('1 playing')).toBeInTheDocument();
      });
      
      // Click stop all
      await fireEvent.click(screen.getByTitle('Stop All'));
      
      // Playing badge should disappear
      await waitFor(() => {
        expect(screen.queryByText('1 playing')).not.toBeInTheDocument();
      });
    });
  });

  describe('close functionality', () => {
    it('closes panel when close button is clicked', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      expect(screen.getByText('🎧 Ambient Sounds')).toBeInTheDocument();
      
      await fireEvent.click(screen.getByTitle('Close'));
      
      await waitFor(() => {
        expect(screen.queryByText('🎧 Ambient Sounds')).not.toBeInTheDocument();
      });
    });
  });

  describe('persistence', () => {
    it('loads saved settings on mount', async () => {
      const savedSettings = {
        masterVolume: 60,
        fadeInDuration: 5,
        fadeOutDuration: 3,
        autoStopMinutes: 30,
        pauseOnCall: false,
        resumeAfterCall: false,
        showInTray: false,
      };
      
      localStorageMock.store['hearth-ambient-settings'] = JSON.stringify(savedSettings);
      
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      // Master volume should be loaded from settings
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('loads saved presets on mount', async () => {
      const savedPresets = [
        {
          id: 'custom-test',
          name: 'My Test Preset',
          icon: '🎯',
          sounds: [{ id: 'rain', volume: 50 }],
          createdAt: Date.now(),
        },
      ];
      
      localStorageMock.store['hearth-ambient-presets'] = JSON.stringify(savedPresets);
      
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      await fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
      
      expect(screen.getByText('My Test Preset')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper button titles', async () => {
      render(AmbientSoundManager);
      
      await fireEvent.click(screen.getByTitle('Ambient Sounds'));
      
      expect(screen.getByTitle('Minimize')).toBeInTheDocument();
      expect(screen.getByTitle('Close')).toBeInTheDocument();
    });

    it('can be navigated with keyboard', async () => {
      render(AmbientSoundManager);
      
      const toggleBtn = screen.getByTitle('Ambient Sounds');
      toggleBtn.focus();
      
      await fireEvent.keyDown(toggleBtn, { key: 'Enter' });
      
      expect(screen.getByText('🎧 Ambient Sounds')).toBeInTheDocument();
    });
  });
});
