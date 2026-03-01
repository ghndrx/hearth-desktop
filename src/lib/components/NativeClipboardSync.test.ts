import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NativeClipboardSync from './NativeClipboardSync.svelte';

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn().mockResolvedValue(''),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

describe('NativeClipboardSync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the toggle button', () => {
    render(NativeClipboardSync);
    expect(screen.getByTitle(/Clipboard Sync/i)).toBeTruthy();
  });

  it('opens panel when clicked', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('Clipboard Sync')).toBeTruthy();
  });

  it('shows three tabs', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('Clipboard')).toBeTruthy();
    expect(screen.getByText('Devices')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows empty clipboard state', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('No clipboard entries')).toBeTruthy();
  });

  it('shows this device in devices tab', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    await fireEvent.click(screen.getByText('Devices'));
    expect(screen.getByText('This Device')).toBeTruthy();
  });

  it('shows settings with sync options', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Auto-sync clipboard')).toBeTruthy();
    expect(screen.getByText('Encrypt clipboard data')).toBeTruthy();
  });

  it('shows filter options', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByPlaceholderText(/Search clipboard/i)).toBeTruthy();
  });

  it('has a clear button', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('Clear')).toBeTruthy();
  });

  it('shows keyboard shortcut in settings', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Toggle Clipboard Sync')).toBeTruthy();
  });

  it('loads saved entries from localStorage', async () => {
    const savedEntries = [{
      id: 'test-1',
      content: 'saved text',
      type: 'text',
      source: 'local',
      deviceName: 'Test Device',
      timestamp: new Date().toISOString(),
      pinned: false,
      size: 10,
    }];
    localStorage.setItem('hearth-clipboard-sync', JSON.stringify(savedEntries));

    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('saved text')).toBeTruthy();
  });

  it('has sync toggle in header', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    expect(screen.getByText('Sync')).toBeTruthy();
  });

  it('shows storage settings', async () => {
    render(NativeClipboardSync);
    await fireEvent.click(screen.getByTitle(/Clipboard Sync/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Storage')).toBeTruthy();
    expect(screen.getByText('Max clipboard entries')).toBeTruthy();
  });
});
