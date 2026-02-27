import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ScreenColorPicker from './ScreenColorPicker.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
});

describe('ScreenColorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (invoke as any).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the component with title', () => {
    render(ScreenColorPicker);
    expect(screen.getByText('Screen Color Picker')).toBeInTheDocument();
  });

  it('renders pick color button', () => {
    render(ScreenColorPicker);
    expect(screen.getByText('Pick Color from Screen')).toBeInTheDocument();
  });

  it('renders format selector buttons', () => {
    render(ScreenColorPicker);
    expect(screen.getByText('HEX')).toBeInTheDocument();
    expect(screen.getByText('RGB')).toBeInTheDocument();
    expect(screen.getByText('HSL')).toBeInTheDocument();
    expect(screen.getByText('HSV')).toBeInTheDocument();
  });

  it('changes format when format button is clicked', async () => {
    render(ScreenColorPicker);
    
    const rgbButton = screen.getByText('RGB');
    await fireEvent.click(rgbButton);
    
    expect(rgbButton).toHaveClass('active');
  });

  it('picks color and displays result', async () => {
    (invoke as any).mockResolvedValueOnce(true); // check_screen_capture_support
    (invoke as any).mockResolvedValueOnce({ r: 255, g: 128, b: 64 }); // pick_screen_color
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('#FF8040')).toBeInTheDocument();
    });
  });

  it('displays RGB values after picking', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 100, g: 150, b: 200 });
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('100, 150, 200')).toBeInTheDocument();
    });
  });

  it('calls onColorPicked callback when color is picked', async () => {
    const onColorPicked = vi.fn();
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 50, g: 100, b: 150 });
    
    render(ScreenColorPicker, { props: { onColorPicked } });
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(onColorPicked).toHaveBeenCalledWith(
        expect.objectContaining({
          hex: '#326496',
          rgb: { r: 50, g: 100, b: 150 }
        })
      );
    });
  });

  it('copies color to clipboard', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 255, g: 0, b: 0 });
    
    render(ScreenColorPicker);
    
    // Pick a color first
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('#FF0000')).toBeInTheDocument();
    });
    
    // Find and click copy button for HEX
    const copyButtons = screen.getAllByText('📋');
    await fireEvent.click(copyButtons[0]);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#FF0000');
  });

  it('shows copy feedback after copying', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 0, g: 255, b: 0 });
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('#00FF00')).toBeInTheDocument();
    });
    
    const copyButtons = screen.getAllByText('📋');
    await fireEvent.click(copyButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Copied:/)).toBeInTheDocument();
    });
  });

  it('saves picked colors to history', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 128, g: 128, b: 128 });
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Colors (1)')).toBeInTheDocument();
    });
  });

  it('does not show history when showHistory is false', () => {
    render(ScreenColorPicker, { props: { showHistory: false } });
    
    expect(screen.queryByText(/Recent Colors/)).not.toBeInTheDocument();
  });

  it('displays error when picking fails', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockRejectedValueOnce(new Error('Screen capture denied'));
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('Screen capture denied')).toBeInTheDocument();
    });
  });

  it('can dismiss error message', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockRejectedValueOnce(new Error('Test error'));
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByText('×');
    await fireEvent.click(dismissButton);
    
    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
  });

  it('respects maxHistory prop', async () => {
    (invoke as any).mockResolvedValue(true);
    
    render(ScreenColorPicker, { props: { maxHistory: 3 } });
    
    // Pick 4 colors
    for (let i = 0; i < 4; i++) {
      (invoke as any).mockResolvedValueOnce({ r: i * 60, g: i * 60, b: i * 60 });
      const pickButton = screen.getByText('Pick Color from Screen');
      await fireEvent.click(pickButton);
      await waitFor(() => {
        expect(screen.getByText(/Recent Colors/)).toBeInTheDocument();
      });
    }
    
    // Should only have 3 in history
    expect(screen.getByText('Recent Colors (3)')).toBeInTheDocument();
  });

  it('uses defaultFormat prop', () => {
    render(ScreenColorPicker, { props: { defaultFormat: 'rgb' } });
    
    const rgbButton = screen.getByText('RGB');
    expect(rgbButton).toHaveClass('active');
  });

  it('clears history when clear button is clicked', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 255, g: 255, b: 255 });
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Colors (1)')).toBeInTheDocument();
    });
    
    const clearButton = screen.getByText('Clear All');
    await fireEvent.click(clearButton);
    
    expect(screen.queryByText(/Recent Colors/)).not.toBeInTheDocument();
  });

  it('loads history from localStorage on mount', async () => {
    const storedHistory = [
      {
        hex: '#ff0000',
        rgb: { r: 255, g: 0, b: 0 },
        hsl: { h: 0, s: 100, l: 50 },
        hsv: { h: 0, s: 100, v: 100 },
        timestamp: Date.now()
      }
    ];
    localStorageMock.setItem('screen-color-picker-history', JSON.stringify(storedHistory));
    
    render(ScreenColorPicker);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Colors (1)')).toBeInTheDocument();
    });
  });

  it('displays picking state when pick is in progress', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    
    // Create a promise that doesn't resolve immediately
    let resolvePickColor: (value: any) => void;
    const pickColorPromise = new Promise(resolve => {
      resolvePickColor = resolve;
    });
    (invoke as any).mockImplementationOnce(() => pickColorPromise);
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    fireEvent.click(pickButton);
    
    await waitFor(() => {
      expect(screen.getByText('Click anywhere on screen...')).toBeInTheDocument();
    });
    
    // Resolve the promise
    resolvePickColor!({ r: 0, g: 0, b: 0 });
  });

  it('converts RGB to HSL correctly', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 255, g: 0, b: 0 }); // Pure red
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      // Pure red should be HSL(0, 100%, 50%)
      expect(screen.getByText('0°, 100%, 50%')).toBeInTheDocument();
    });
  });

  it('converts RGB to HSV correctly', async () => {
    (invoke as any).mockResolvedValueOnce(true);
    (invoke as any).mockResolvedValueOnce({ r: 255, g: 0, b: 0 }); // Pure red
    
    render(ScreenColorPicker);
    
    const pickButton = screen.getByText('Pick Color from Screen');
    await fireEvent.click(pickButton);
    
    await waitFor(() => {
      // Pure red should be HSV(0, 100%, 100%)
      expect(screen.getByText('0°, 100%, 100%')).toBeInTheDocument();
    });
  });
});
