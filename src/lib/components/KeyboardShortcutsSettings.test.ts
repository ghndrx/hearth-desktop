/**
 * Tests for KeyboardShortcutsSettings component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import KeyboardShortcutsSettings from './KeyboardShortcutsSettings.svelte';
import { shortcutsStore } from '../stores/shortcuts';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('KeyboardShortcutsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('renders the component with header', () => {
    render(KeyboardShortcutsSettings);
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    expect(screen.getByText(/Customize your keyboard shortcuts/)).toBeTruthy();
  });

  it('displays all shortcut categories', () => {
    render(KeyboardShortcutsSettings);
    
    expect(screen.getByText('Navigation')).toBeTruthy();
    expect(screen.getByText('Messaging')).toBeTruthy();
    expect(screen.getByText('Voice & Video')).toBeTruthy();
    expect(screen.getByText('Media')).toBeTruthy();
    expect(screen.getByText('Window')).toBeTruthy();
    expect(screen.getByText('Accessibility')).toBeTruthy();
  });

  it('has search input', () => {
    render(KeyboardShortcutsSettings);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    expect(searchInput).toBeTruthy();
  });

  it('filters shortcuts by search query', async () => {
    render(KeyboardShortcutsSettings);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    await fireEvent.input(searchInput, { target: { value: 'mute' } });
    
    // Should show Toggle Mute shortcut
    expect(screen.getByText('Toggle Mute')).toBeTruthy();
  });

  it('has filter checkboxes', () => {
    render(KeyboardShortcutsSettings);
    
    expect(screen.getByText('Global shortcuts only')).toBeTruthy();
    expect(screen.getByText(/Show conflicts/)).toBeTruthy();
  });

  it('has reset all button', () => {
    render(KeyboardShortcutsSettings);
    
    const resetBtn = screen.getByText('Reset All to Defaults');
    expect(resetBtn).toBeTruthy();
  });

  it('can collapse and expand categories', async () => {
    render(KeyboardShortcutsSettings);
    
    // Categories start expanded
    const navigationHeader = screen.getByText('Navigation');
    expect(screen.getByText('Quick Switcher')).toBeTruthy();
    
    // Click to collapse
    await fireEvent.click(navigationHeader);
    
    // Quick Switcher should no longer be visible
    expect(screen.queryByText('Quick Switcher')).toBeFalsy();
    
    // Click to expand
    await fireEvent.click(navigationHeader);
    
    // Quick Switcher should be visible again
    expect(screen.getByText('Quick Switcher')).toBeTruthy();
  });

  it('shows global badge for global shortcuts', () => {
    render(KeyboardShortcutsSettings);
    
    // Toggle Mute is a global shortcut
    const globalBadges = screen.getAllByText('Global');
    expect(globalBadges.length).toBeGreaterThan(0);
  });

  it('displays shortcut keybinds', () => {
    render(KeyboardShortcutsSettings);
    
    // Quick Switcher has Ctrl + K
    expect(screen.getByText('Ctrl + K')).toBeTruthy();
  });

  it('starts recording when clicking keybind button', async () => {
    render(KeyboardShortcutsSettings);
    
    // Click on a keybind button
    const keybindBtns = screen.getAllByText('Ctrl + K');
    await fireEvent.click(keybindBtns[0]);
    
    // Recording modal should appear
    expect(screen.getByText('Recording Shortcut')).toBeTruthy();
    expect(screen.getByText('Press a key combination...')).toBeTruthy();
  });

  it('shows cancel and confirm buttons in recording modal', async () => {
    render(KeyboardShortcutsSettings);
    
    // Start recording
    const keybindBtns = screen.getAllByText('Ctrl + K');
    await fireEvent.click(keybindBtns[0]);
    
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('cancels recording when clicking cancel', async () => {
    render(KeyboardShortcutsSettings);
    
    // Start recording
    const keybindBtns = screen.getAllByText('Ctrl + K');
    await fireEvent.click(keybindBtns[0]);
    
    // Cancel
    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);
    
    // Modal should close
    expect(screen.queryByText('Recording Shortcut')).toBeFalsy();
  });

  it('cancels recording on Escape key', async () => {
    render(KeyboardShortcutsSettings);
    
    // Start recording
    const keybindBtns = screen.getAllByText('Ctrl + K');
    await fireEvent.click(keybindBtns[0]);
    
    // Press Escape
    await fireEvent.keyDown(window, { key: 'Escape' });
    
    // Modal should close
    expect(screen.queryByText('Recording Shortcut')).toBeFalsy();
  });

  it('has toggle switches for enabling/disabling shortcuts', () => {
    render(KeyboardShortcutsSettings);
    
    // Should have many toggle switches
    const toggles = document.querySelectorAll('.toggle-switch');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('shows no results message when search has no matches', async () => {
    render(KeyboardShortcutsSettings);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    await fireEvent.input(searchInput, { target: { value: 'xyznonexistent' } });
    
    expect(screen.getByText('No shortcuts found matching your search.')).toBeTruthy();
  });

  it('filters to show only global shortcuts', async () => {
    render(KeyboardShortcutsSettings);
    
    // Check the global shortcuts only checkbox
    const globalCheckbox = screen.getByText('Global shortcuts only');
    await fireEvent.click(globalCheckbox);
    
    // Non-global shortcuts should be hidden
    // Quick Switcher is not global
    expect(screen.queryByText('Quick Switcher')).toBeFalsy();
    
    // Toggle Mute is global and should still be visible
    expect(screen.getByText('Toggle Mute')).toBeTruthy();
  });

  it('resets all shortcuts when clicking reset all', async () => {
    render(KeyboardShortcutsSettings);
    
    const resetAllBtn = screen.getByText('Reset All to Defaults');
    await fireEvent.click(resetAllBtn);
    
    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

describe('Shortcuts Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('starts with default shortcuts', () => {
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.shortcuts.length).toBeGreaterThan(0);
    expect(state.isRecording).toBe(false);
    expect(state.recordingId).toBeNull();
    
    unsubscribe();
  });

  it('can start recording', () => {
    shortcutsStore.startRecording('quick-switcher');
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.isRecording).toBe(true);
    expect(state.recordingId).toBe('quick-switcher');
    
    unsubscribe();
    shortcutsStore.cancelRecording();
  });

  it('can cancel recording', () => {
    shortcutsStore.startRecording('quick-switcher');
    shortcutsStore.cancelRecording();
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.isRecording).toBe(false);
    expect(state.recordingId).toBeNull();
    
    unsubscribe();
  });

  it('can add recorded keys', () => {
    shortcutsStore.startRecording('quick-switcher');
    shortcutsStore.addRecordedKey('Ctrl');
    shortcutsStore.addRecordedKey('J');
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.recordedKeys).toEqual(['Ctrl', 'J']);
    
    unsubscribe();
    shortcutsStore.cancelRecording();
  });

  it('prevents duplicate keys', () => {
    shortcutsStore.startRecording('quick-switcher');
    shortcutsStore.addRecordedKey('Ctrl');
    shortcutsStore.addRecordedKey('Ctrl');
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.recordedKeys).toEqual(['Ctrl']);
    
    unsubscribe();
    shortcutsStore.cancelRecording();
  });

  it('limits to 4 keys max', () => {
    shortcutsStore.startRecording('quick-switcher');
    shortcutsStore.addRecordedKey('Ctrl');
    shortcutsStore.addRecordedKey('Alt');
    shortcutsStore.addRecordedKey('Shift');
    shortcutsStore.addRecordedKey('K');
    shortcutsStore.addRecordedKey('J'); // Should be ignored
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    expect(state.recordedKeys.length).toBe(4);
    
    unsubscribe();
    shortcutsStore.cancelRecording();
  });

  it('can toggle shortcut enabled state', () => {
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    const quickSwitcher = state.shortcuts.find((s: any) => s.id === 'quick-switcher');
    const initialEnabled = quickSwitcher.enabled;
    
    shortcutsStore.toggleShortcut('quick-switcher');
    
    const updated = state.shortcuts.find((s: any) => s.id === 'quick-switcher');
    expect(updated.enabled).toBe(!initialEnabled);
    
    unsubscribe();
  });

  it('can clear shortcut', () => {
    shortcutsStore.clearShortcut('quick-switcher');
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    const quickSwitcher = state.shortcuts.find((s: any) => s.id === 'quick-switcher');
    expect(quickSwitcher.currentKeys).toEqual([]);
    expect(quickSwitcher.enabled).toBe(false);
    
    unsubscribe();
  });

  it('can reset single shortcut', () => {
    // First clear it
    shortcutsStore.clearShortcut('quick-switcher');
    
    // Then reset
    shortcutsStore.resetShortcut('quick-switcher');
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    const quickSwitcher = state.shortcuts.find((s: any) => s.id === 'quick-switcher');
    expect(quickSwitcher.currentKeys).toEqual(['Ctrl', 'K']);
    
    unsubscribe();
  });

  it('can reset all shortcuts', () => {
    // Clear a shortcut first
    shortcutsStore.clearShortcut('quick-switcher');
    shortcutsStore.clearShortcut('toggle-mute');
    
    // Reset all
    shortcutsStore.resetAllShortcuts();
    
    let state: any;
    const unsubscribe = shortcutsStore.subscribe(s => state = s);
    
    const quickSwitcher = state.shortcuts.find((s: any) => s.id === 'quick-switcher');
    const toggleMute = state.shortcuts.find((s: any) => s.id === 'toggle-mute');
    
    expect(quickSwitcher.currentKeys).toEqual(['Ctrl', 'K']);
    expect(toggleMute.currentKeys).toEqual(['Ctrl', 'Shift', 'M']);
    
    unsubscribe();
  });
});
