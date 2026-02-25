import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

// Mock the store
const mockUnreadCount = writable(0);
const mockHasUnread = writable(false);

vi.mock('$lib/stores/notifications', () => ({
  unreadCount: mockUnreadCount,
  hasUnread: mockHasUnread
}));

// Mock store plugin
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

import BadgeManager from './BadgeManager.svelte';
import { invoke } from '@tauri-apps/api/core';

describe('BadgeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate Tauri environment
    (window as any).__TAURI_INTERNALS__ = {};
    mockUnreadCount.set(0);
    mockHasUnread.set(false);
  });

  afterEach(() => {
    cleanup();
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('renders without visible content', () => {
    const { container } = render(BadgeManager);
    // BadgeManager should not render any visible content
    expect(container.innerHTML).toBe('<!---->');
  });

  it('updates badge when unread count changes', async () => {
    render(BadgeManager);
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Change unread count
    mockUnreadCount.set(5);
    
    // Wait for debounce
    await new Promise(r => setTimeout(r, 150));
    
    expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 5 });
    expect(invoke).toHaveBeenCalledWith('update_tray_badge', { count: 5 });
  });

  it('debounces rapid updates', async () => {
    render(BadgeManager);
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Rapidly change unread count
    mockUnreadCount.set(1);
    mockUnreadCount.set(2);
    mockUnreadCount.set(3);
    mockUnreadCount.set(4);
    mockUnreadCount.set(5);
    
    // Wait for debounce
    await new Promise(r => setTimeout(r, 150));
    
    // Should only update once with final value
    const badgeCalls = (invoke as any).mock.calls.filter(
      (call: any[]) => call[0] === 'set_badge_count'
    );
    
    expect(badgeCalls.length).toBe(1);
    expect(badgeCalls[0]).toEqual(['set_badge_count', { count: 5 }]);
  });

  it('clears badge on unmount', async () => {
    const { unmount } = render(BadgeManager);
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Set some unread count
    mockUnreadCount.set(3);
    await new Promise(r => setTimeout(r, 150));
    
    vi.clearAllMocks();
    
    // Unmount
    unmount();
    
    expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 0 });
    expect(invoke).toHaveBeenCalledWith('update_tray_badge', { count: 0 });
  });

  it('flashes window when count increases and window is blurred', async () => {
    render(BadgeManager, { props: { flashOnNew: true } });
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Simulate window blur
    window.dispatchEvent(new Event('blur'));
    
    // Change unread count
    mockUnreadCount.set(5);
    
    // Wait for debounce
    await new Promise(r => setTimeout(r, 150));
    
    expect(invoke).toHaveBeenCalledWith('flash_window', { urgent: false });
  });

  it('does not flash window when focused', async () => {
    render(BadgeManager, { props: { flashOnNew: true } });
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Window is focused by default
    window.dispatchEvent(new Event('focus'));
    
    // Change unread count
    mockUnreadCount.set(5);
    
    // Wait for debounce
    await new Promise(r => setTimeout(r, 150));
    
    // flash_window should not be called
    const flashCalls = (invoke as any).mock.calls.filter(
      (call: any[]) => call[0] === 'flash_window'
    );
    expect(flashCalls.length).toBe(0);
  });

  it('does not flash when count decreases', async () => {
    render(BadgeManager, { props: { flashOnNew: true } });
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Set initial count
    mockUnreadCount.set(5);
    await new Promise(r => setTimeout(r, 150));
    
    vi.clearAllMocks();
    
    // Blur window
    window.dispatchEvent(new Event('blur'));
    
    // Decrease count
    mockUnreadCount.set(2);
    await new Promise(r => setTimeout(r, 150));
    
    // flash_window should not be called for decreasing count
    const flashCalls = (invoke as any).mock.calls.filter(
      (call: any[]) => call[0] === 'flash_window'
    );
    expect(flashCalls.length).toBe(0);
  });

  it('accepts custom debounce interval', async () => {
    render(BadgeManager, { props: { debounceMs: 50 } });
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Change unread count
    mockUnreadCount.set(5);
    
    // Wait less than default debounce (100ms)
    await new Promise(r => setTimeout(r, 75));
    
    // Should have updated already with shorter debounce
    expect(invoke).toHaveBeenCalledWith('set_badge_count', { count: 5 });
  });

  it('handles non-Tauri environment gracefully', async () => {
    delete (window as any).__TAURI_INTERNALS__;
    
    render(BadgeManager);
    
    // Wait for mount
    await new Promise(r => setTimeout(r, 0));
    
    // Change unread count
    mockUnreadCount.set(5);
    await new Promise(r => setTimeout(r, 150));
    
    // Should not call invoke in non-Tauri environment
    expect(invoke).not.toHaveBeenCalled();
  });
});
