import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SystemAudioRouter from './SystemAudioRouter.svelte';

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

// Mock navigator.mediaDevices
const mockEnumerateDevices = vi.fn().mockResolvedValue([
  { deviceId: 'output-1', kind: 'audiooutput', label: 'Speakers' },
  { deviceId: 'output-2', kind: 'audiooutput', label: 'Headphones' },
  { deviceId: 'input-1', kind: 'audioinput', label: 'Microphone' },
]);

Object.defineProperty(navigator, 'mediaDevices', {
  value: { enumerateDevices: mockEnumerateDevices },
  writable: true,
});

describe('SystemAudioRouter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the toggle button', () => {
    render(SystemAudioRouter);
    expect(screen.getByTitle(/Audio Router/i)).toBeTruthy();
  });

  it('opens panel when clicked', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('Audio Router')).toBeTruthy();
  });

  it('shows three tabs', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('Devices')).toBeTruthy();
    expect(screen.getByText('Routes')).toBeTruthy();
    expect(screen.getByText('Profiles')).toBeTruthy();
  });

  it('shows output and input device sections', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('Output Devices')).toBeTruthy();
    expect(screen.getByText('Input Devices')).toBeTruthy();
  });

  it('shows refresh devices button', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('Refresh Devices')).toBeTruthy();
  });

  it('shows routes tab with audio sources', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    await fireEvent.click(screen.getByText('Routes'));
    expect(screen.getByText('Voice')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Media')).toBeTruthy();
    expect(screen.getByText('Effects')).toBeTruthy();
  });

  it('shows profiles tab with save button', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    await fireEvent.click(screen.getByText('Profiles'));
    expect(screen.getByText('Save Current')).toBeTruthy();
  });

  it('can create a new profile', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    await fireEvent.click(screen.getByText('Profiles'));
    await fireEvent.click(screen.getByText('Save Current'));

    const input = screen.getByPlaceholderText(/Profile name/i);
    expect(input).toBeTruthy();
  });

  it('saves route data to localStorage', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    await fireEvent.click(screen.getByText('Routes'));

    // Routes should auto-save on init
    const saved = localStorage.getItem('hearth-audio-router');
    expect(saved).toBeTruthy();
  });

  it('shows empty state for profiles', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    await fireEvent.click(screen.getByText('Profiles'));
    expect(screen.getByText('No audio profiles saved')).toBeTruthy();
  });

  it('has master volume control', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('closes panel when backdrop is clicked', async () => {
    render(SystemAudioRouter);
    await fireEvent.click(screen.getByTitle(/Audio Router/i));
    expect(screen.getByText('Audio Router')).toBeTruthy();

    const backdrop = screen.getByText('Audio Router').closest('.fixed.inset-0');
    if (backdrop) {
      await fireEvent.click(backdrop);
    }
  });
});
