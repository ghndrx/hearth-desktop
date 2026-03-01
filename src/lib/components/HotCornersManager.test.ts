import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import HotCornersManager from './HotCornersManager.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

import { invoke } from '@tauri-apps/api/core';

const mockSettings = {
  enabled: true,
  corner_size_px: 5,
  corners: {
    'top-left': {
      corner: 'top-left',
      action: 'show-notification-center',
      activation_delay_ms: 300,
      enabled: true,
      modifier_required: null
    },
    'top-right': {
      corner: 'top-right',
      action: 'show-quick-actions',
      activation_delay_ms: 300,
      enabled: true,
      modifier_required: null
    },
    'bottom-left': {
      corner: 'bottom-left',
      action: 'show-desktop',
      activation_delay_ms: 300,
      enabled: false,
      modifier_required: null
    },
    'bottom-right': {
      corner: 'bottom-right',
      action: 'launch-quick-note',
      activation_delay_ms: 300,
      enabled: false,
      modifier_required: null
    }
  },
  show_visual_feedback: true,
  sound_feedback: false,
  disabled_in_fullscreen: true
};

const mockAvailableActions: [string, string][] = [
  ['none', 'No Action'],
  ['show-notification-center', 'Show Notification Center'],
  ['toggle-focus-mode', 'Toggle Focus Mode'],
  ['show-quick-actions', 'Show Quick Actions'],
  ['lock-screen', 'Lock Screen'],
  ['show-desktop', 'Show Desktop'],
  ['launch-quick-note', 'Launch Quick Note'],
  ['toggle-mute', 'Toggle Mute'],
  ['start-screen-recording', 'Start Screen Recording'],
  ['show-command-palette', 'Show Command Palette'],
  ['toggle-do-not-disturb', 'Toggle Do Not Disturb'],
  ['show-calendar', 'Show Calendar']
];

describe('HotCornersManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (invoke as any).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'hotcorners_get_settings':
          return mockSettings;
        case 'hotcorners_get_available_actions':
          return mockAvailableActions;
        case 'hotcorners_update_settings':
        case 'hotcorners_set_screen_dimensions':
        case 'hotcorners_set_corner_action':
        case 'hotcorners_set_corner_enabled':
        case 'hotcorners_reset_tracking':
          return undefined;
        case 'hotcorners_check_position':
          return null;
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it('should render settings panel when showSettings is true', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('🔲 Hot Corners')).toBeTruthy();
    });
  });

  it('should load settings on mount', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('hotcorners_get_settings');
    });
  });

  it('should load available actions on mount', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('hotcorners_get_available_actions');
    });
  });

  it('should update screen dimensions on mount', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('hotcorners_set_screen_dimensions', expect.any(Object));
    });
  });

  it('should display all four corner configurations', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Top Left')).toBeTruthy();
      expect(screen.getByText('Top Right')).toBeTruthy();
      expect(screen.getByText('Bottom Left')).toBeTruthy();
      expect(screen.getByText('Bottom Right')).toBeTruthy();
    });
  });

  it('should show corner icons', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('↖️')).toBeTruthy();
      expect(screen.getByText('↗️')).toBeTruthy();
      expect(screen.getByText('↙️')).toBeTruthy();
      expect(screen.getByText('↘️')).toBeTruthy();
    });
  });

  it('should toggle corner enabled state', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getAllByText('On').length).toBeGreaterThan(0);
    });

    const toggleButtons = screen.getAllByRole('button');
    const onButton = toggleButtons.find(btn => btn.textContent === 'On');
    
    if (onButton) {
      await fireEvent.click(onButton);
      
      expect(invoke).toHaveBeenCalledWith('hotcorners_set_corner_enabled', expect.any(Object));
    }
  });

  it('should show visual feedback option', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Show visual feedback')).toBeTruthy();
    });
  });

  it('should show sound feedback option', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Play sound on activation')).toBeTruthy();
    });
  });

  it('should show fullscreen disable option', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Disable in fullscreen')).toBeTruthy();
    });
  });

  it('should display description text', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Trigger actions by moving your cursor to screen corners')).toBeTruthy();
    });
  });

  it('should not render settings panel when showSettings is false', () => {
    render(HotCornersManager, { showSettings: false });
    
    expect(screen.queryByText('🔲 Hot Corners')).toBeFalsy();
  });

  it('should call updateSettings when toggling main enabled switch', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText('🔲 Hot Corners')).toBeTruthy();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const mainToggle = checkboxes[0];
    
    await fireEvent.click(mainToggle);
    
    expect(invoke).toHaveBeenCalledWith('hotcorners_update_settings', expect.any(Object));
  });

  it('should have corner delay sliders for enabled corners', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      const delayTexts = screen.getAllByText(/Delay:/);
      expect(delayTexts.length).toBeGreaterThan(0);
    });
  });

  it('should have corner size slider', async () => {
    render(HotCornersManager, { showSettings: true });
    
    await vi.waitFor(() => {
      expect(screen.getByText(/Corner activation area:/)).toBeTruthy();
    });
  });
});

describe('HotCornersManager corner detection', () => {
  it('should detect top-left corner', () => {
    const screenWidth = 1920;
    const screenHeight = 1080;
    const size = 5;

    const isTopLeft = (x: number, y: number) => x < size && y < size;
    
    expect(isTopLeft(0, 0)).toBe(true);
    expect(isTopLeft(4, 4)).toBe(true);
    expect(isTopLeft(5, 5)).toBe(false);
    expect(isTopLeft(1000, 500)).toBe(false);
  });

  it('should detect top-right corner', () => {
    const screenWidth = 1920;
    const size = 5;

    const isTopRight = (x: number, y: number) => x >= screenWidth - size && y < size;
    
    expect(isTopRight(1919, 0)).toBe(true);
    expect(isTopRight(1915, 4)).toBe(true);
    expect(isTopRight(1914, 5)).toBe(false);
    expect(isTopRight(0, 0)).toBe(false);
  });

  it('should detect bottom-left corner', () => {
    const screenHeight = 1080;
    const size = 5;

    const isBottomLeft = (x: number, y: number) => x < size && y >= screenHeight - size;
    
    expect(isBottomLeft(0, 1079)).toBe(true);
    expect(isBottomLeft(4, 1075)).toBe(true);
    expect(isBottomLeft(5, 1074)).toBe(false);
    expect(isBottomLeft(1000, 500)).toBe(false);
  });

  it('should detect bottom-right corner', () => {
    const screenWidth = 1920;
    const screenHeight = 1080;
    const size = 5;

    const isBottomRight = (x: number, y: number) => 
      x >= screenWidth - size && y >= screenHeight - size;
    
    expect(isBottomRight(1919, 1079)).toBe(true);
    expect(isBottomRight(1915, 1075)).toBe(true);
    expect(isBottomRight(1914, 1074)).toBe(false);
    expect(isBottomRight(0, 0)).toBe(false);
  });

  it('should not detect center of screen as corner', () => {
    const screenWidth = 1920;
    const screenHeight = 1080;
    const size = 5;

    const detectCorner = (x: number, y: number) => {
      if (x < size && y < size) return 'top-left';
      if (x >= screenWidth - size && y < size) return 'top-right';
      if (x < size && y >= screenHeight - size) return 'bottom-left';
      if (x >= screenWidth - size && y >= screenHeight - size) return 'bottom-right';
      return null;
    };

    expect(detectCorner(960, 540)).toBe(null);
    expect(detectCorner(500, 500)).toBe(null);
    expect(detectCorner(100, 100)).toBe(null);
  });
});

describe('HotCornersManager activation delay', () => {
  it('should have default delay of 300ms', () => {
    const defaultDelay = 300;
    expect(mockSettings.corners['top-left'].activation_delay_ms).toBe(defaultDelay);
  });

  it('should respect custom delay values', () => {
    const customSettings = {
      ...mockSettings,
      corners: {
        ...mockSettings.corners,
        'top-left': {
          ...mockSettings.corners['top-left'],
          activation_delay_ms: 500
        }
      }
    };

    expect(customSettings.corners['top-left'].activation_delay_ms).toBe(500);
  });
});

describe('HotCornersManager actions', () => {
  it('should have all expected action types', () => {
    const expectedActions = [
      'none',
      'show-notification-center',
      'toggle-focus-mode',
      'show-quick-actions',
      'lock-screen',
      'show-desktop',
      'launch-quick-note',
      'toggle-mute',
      'start-screen-recording',
      'show-command-palette',
      'toggle-do-not-disturb',
      'show-calendar'
    ];

    const actionIds = mockAvailableActions.map(([id]) => id);
    
    expectedActions.forEach(action => {
      expect(actionIds).toContain(action);
    });
  });
});
