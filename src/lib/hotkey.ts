import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface HotKeyEvent {
  id: string;
}

export class HotKeyManager {
  /**
   * Initialize the hotkey manager (call once at app startup)
   */
  static async init(): Promise<void> {
    await invoke('init_hotkey_manager');
  }

  /**
   * Register a global hotkey
   * @param hotkeyId - Unique identifier for the hotkey
   * @param accelerator - Key combination (e.g., 'CmdOrCtrl+Shift+H', 'Alt+Space')
   */
  static async register(hotkeyId: string, accelerator: string): Promise<void> {
    await invoke('register_hotkey', { hotkeyId, accelerator });
  }

  /**
   * Unregister a global hotkey
   * @param hotkeyId - Unique identifier for the hotkey to unregister
   */
  static async unregister(hotkeyId: string): Promise<void> {
    await invoke('unregister_hotkey', { hotkeyId });
  }

  /**
   * Check if a hotkey is currently registered
   * @param hotkeyId - Unique identifier for the hotkey to check
   */
  static async isRegistered(hotkeyId: string): Promise<boolean> {
    return await invoke('is_hotkey_registered', { hotkeyId });
  }

  /**
   * Get all currently registered hotkey IDs
   */
  static async getRegisteredHotkeys(): Promise<string[]> {
    return await invoke('get_registered_hotkeys');
  }

  /**
   * Listen for hotkey press events
   * @param callback - Function to call when a hotkey is pressed
   * @returns Unlisten function to stop listening
   */
  static async onHotkeyPressed(
    callback: (event: HotKeyEvent) => void
  ) {
    return await listen('hotkey-pressed', (event) => {
      callback(event.payload as HotKeyEvent);
    });
  }
}

// Common hotkey accelerators for cross-platform compatibility
export const COMMON_ACCELERATORS = {
  // Toggle window visibility
  TOGGLE_WINDOW: 'CmdOrCtrl+Shift+H',

  // Focus window
  FOCUS_WINDOW: 'CmdOrCtrl+Shift+F',

  // Quick action
  QUICK_ACTION: 'CmdOrCtrl+Shift+Space',

  // Voice toggle
  VOICE_TOGGLE: 'CmdOrCtrl+Shift+V',
} as const;

// Example usage function to register common hotkeys
export async function registerCommonHotkeys(): Promise<void> {
  try {
    // Initialize the hotkey manager first
    await HotKeyManager.init();

    // Register toggle window hotkey
    await HotKeyManager.register('toggle-window', COMMON_ACCELERATORS.TOGGLE_WINDOW);

    // Register focus window hotkey
    await HotKeyManager.register('focus-window', COMMON_ACCELERATORS.FOCUS_WINDOW);

    console.log('Common hotkeys registered successfully');
  } catch (error) {
    console.error('Failed to register common hotkeys:', error);
  }
}