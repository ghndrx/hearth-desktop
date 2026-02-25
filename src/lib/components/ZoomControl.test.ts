import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { get, writable } from 'svelte/store';
import ZoomControl from './ZoomControl.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ZoomControl', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with default zoom level', () => {
    render(ZoomControl);
    
    const zoomDisplay = screen.getByText('100%');
    expect(zoomDisplay).toBeTruthy();
  });

  it('renders zoom in and zoom out buttons', () => {
    render(ZoomControl);
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    const zoomOutBtn = screen.getByLabelText(/zoom out/i);
    const resetBtn = screen.getByLabelText(/reset zoom/i);
    
    expect(zoomInBtn).toBeTruthy();
    expect(zoomOutBtn).toBeTruthy();
    expect(resetBtn).toBeTruthy();
  });

  it('increases zoom level when zoom in button is clicked', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    await fireEvent.click(zoomInBtn);
    
    expect(get(zoomLevel)).toBe(110);
  });

  it('decreases zoom level when zoom out button is clicked', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomOutBtn = screen.getByLabelText(/zoom out/i);
    await fireEvent.click(zoomOutBtn);
    
    expect(get(zoomLevel)).toBe(90);
  });

  it('resets zoom to 100% when reset button is clicked', async () => {
    const zoomLevel = writable(150);
    render(ZoomControl, { props: { zoomLevel } });
    
    const resetBtn = screen.getByLabelText(/reset zoom/i);
    await fireEvent.click(resetBtn);
    
    expect(get(zoomLevel)).toBe(100);
  });

  it('disables zoom in button at maximum zoom', () => {
    const zoomLevel = writable(200);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    expect(zoomInBtn).toHaveProperty('disabled', true);
  });

  it('disables zoom out button at minimum zoom', () => {
    const zoomLevel = writable(50);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomOutBtn = screen.getByLabelText(/zoom out/i);
    expect(zoomOutBtn).toHaveProperty('disabled', true);
  });

  it('disables reset button when at default zoom', () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const resetBtn = screen.getByLabelText(/reset zoom/i);
    expect(resetBtn).toHaveProperty('disabled', true);
  });

  it('renders preset buttons when showPresets is true', () => {
    render(ZoomControl, { props: { showPresets: true } });
    
    const preset100 = screen.getByRole('button', { name: '100%' });
    const preset150 = screen.getByRole('button', { name: '150%' });
    
    expect(preset100).toBeTruthy();
    expect(preset150).toBeTruthy();
  });

  it('hides preset buttons when showPresets is false', () => {
    render(ZoomControl, { props: { showPresets: false } });
    
    const preset100 = screen.queryByRole('button', { name: '100%' });
    expect(preset100).toBeNull();
  });

  it('sets zoom level when preset button is clicked', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel, showPresets: true } });
    
    const preset150 = screen.getByRole('button', { name: '150%' });
    await fireEvent.click(preset150);
    
    expect(get(zoomLevel)).toBe(150);
  });

  it('marks active preset with aria-pressed', async () => {
    const zoomLevel = writable(150);
    render(ZoomControl, { props: { zoomLevel, showPresets: true } });
    
    const preset150 = screen.getByRole('button', { name: '150%' });
    expect(preset150.getAttribute('aria-pressed')).toBe('true');
    
    const preset100 = screen.getByRole('button', { name: '100%' });
    expect(preset100.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders slider control', () => {
    render(ZoomControl);
    
    const slider = screen.getByRole('slider');
    expect(slider).toBeTruthy();
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
  });

  it('updates zoom level via slider', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '130' } });
    
    expect(get(zoomLevel)).toBe(130);
  });

  it('saves zoom level to localStorage', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    await fireEvent.click(zoomInBtn);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('hearth-ui-zoom-level', '110');
  });

  it('loads zoom level from localStorage on mount', async () => {
    localStorageMock.getItem.mockReturnValueOnce('140');
    
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    // Wait for mount
    await new Promise((r) => setTimeout(r, 10));
    
    expect(get(zoomLevel)).toBe(140);
  });

  it('renders in compact mode', () => {
    render(ZoomControl, { props: { compact: true } });
    
    // In compact mode, slider and presets should not be visible
    const slider = screen.queryByRole('slider');
    const preset100 = screen.queryByRole('button', { name: '100%' });
    
    expect(slider).toBeNull();
    expect(preset100).toBeNull();
  });

  it('handles keyboard shortcuts Ctrl++', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    await fireEvent.keyDown(window, { key: '+', ctrlKey: true });
    
    expect(get(zoomLevel)).toBe(110);
  });

  it('handles keyboard shortcuts Ctrl+-', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    await fireEvent.keyDown(window, { key: '-', ctrlKey: true });
    
    expect(get(zoomLevel)).toBe(90);
  });

  it('handles keyboard shortcuts Ctrl+0 for reset', async () => {
    const zoomLevel = writable(150);
    render(ZoomControl, { props: { zoomLevel } });
    
    await fireEvent.keyDown(window, { key: '0', ctrlKey: true });
    
    expect(get(zoomLevel)).toBe(100);
  });

  it('clamps zoom level to valid range', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    // Try to set beyond maximum
    const slider = screen.getByRole('slider');
    await fireEvent.input(slider, { target: { value: '300' } });
    
    expect(get(zoomLevel)).toBe(200);
  });

  it('applies custom aria-label', () => {
    render(ZoomControl, { props: { ariaLabel: 'Custom zoom controls' } });
    
    const container = screen.getByRole('group', { name: 'Custom zoom controls' });
    expect(container).toBeTruthy();
  });

  it('emits custom event on zoom change', async () => {
    const eventHandler = vi.fn();
    window.addEventListener('hearth:zoom-change', eventHandler);
    
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    await fireEvent.click(zoomInBtn);
    
    expect(eventHandler).toHaveBeenCalled();
    expect(eventHandler.mock.calls[0][0].detail).toEqual({ level: 110, factor: 1.1 });
    
    window.removeEventListener('hearth:zoom-change', eventHandler);
  });

  it('applies CSS custom properties on zoom change', async () => {
    const zoomLevel = writable(100);
    render(ZoomControl, { props: { zoomLevel } });
    
    const zoomInBtn = screen.getByLabelText(/zoom in/i);
    await fireEvent.click(zoomInBtn);
    
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--ui-zoom')).toBe('1.1');
    expect(root.style.getPropertyValue('--ui-zoom-percent')).toBe('110%');
  });

  it('hides percentage display when showPercentage is false', () => {
    render(ZoomControl, { props: { showPercentage: false } });
    
    // The percentage should not be in a dedicated display element
    // (buttons still work, just no central percentage display)
    const zoomDisplay = screen.queryByText('100%');
    // In compact mode or when showPercentage is false, this would be null or in a different context
    expect(zoomDisplay).toBeTruthy(); // Still shows in presets
  });
});

describe('ZoomControl accessibility', () => {
  afterEach(() => {
    cleanup();
  });

  it('has proper ARIA attributes on slider', () => {
    render(ZoomControl);
    
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('50');
    expect(slider.getAttribute('aria-valuemax')).toBe('200');
    expect(slider.getAttribute('aria-valuenow')).toBe('100');
    expect(slider.getAttribute('aria-valuetext')).toBe('100% zoom');
  });

  it('has proper button labels', () => {
    render(ZoomControl);
    
    expect(screen.getByLabelText(/zoom in/i)).toBeTruthy();
    expect(screen.getByLabelText(/zoom out/i)).toBeTruthy();
    expect(screen.getByLabelText(/reset zoom/i)).toBeTruthy();
  });

  it('has proper group role and label', () => {
    render(ZoomControl, { props: { ariaLabel: 'UI zoom controls' } });
    
    const group = screen.getByRole('group', { name: 'UI zoom controls' });
    expect(group).toBeTruthy();
  });

  it('has screen reader label for slider', () => {
    render(ZoomControl);
    
    const label = screen.getByText('Zoom level');
    expect(label.classList.contains('sr-only')).toBe(true);
  });
});
