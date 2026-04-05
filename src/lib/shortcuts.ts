import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * Configuration for Hearth-specific global shortcuts
 */
export interface ShortcutConfig {
  /** Push-to-talk shortcut (default: Ctrl+Space) */
  push_to_talk?: string;
  /** Toggle mute shortcut (default: Ctrl+M) */
  toggle_mute?: string;
  /** Show/hide window shortcut (default: Ctrl+Shift+H) */
  toggle_window?: string;
  /** Quick screenshot shortcut (default: Ctrl+Shift+S) */
  quick_screenshot?: string;
  /** Set status to away (default: Ctrl+Alt+A) */
  status_away?: string;
  /** Set status to available (default: Ctrl+Alt+O) */
  status_available?: string;
}

/**
 * Event types emitted by global shortcuts
 */
export type ShortcutEvent =
  | 'push-to-talk-start'
  | 'push-to-talk-end'
  | 'toggle-mute'
  | 'take-screenshot'
  | 'set-status';

/**
 * Manager for Hearth global shortcuts
 */
export class ShortcutManager {
  private eventListeners = new Map<ShortcutEvent, Array<(payload?: any) => void>>();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Get current shortcut configuration
   */
  async getConfig(): Promise<ShortcutConfig> {
    return await invoke('get_shortcut_config');
  }

  /**
   * Update shortcut configuration
   */
  async updateConfig(config: ShortcutConfig): Promise<void> {
    return await invoke('update_shortcut_config', { newConfig: config });
  }

  /**
   * Validate a shortcut string
   */
  async validateShortcut(shortcut: string): Promise<boolean> {
    try {
      return await invoke('validate_shortcut', { shortcut });
    } catch (error) {
      console.warn('Invalid shortcut:', error);
      return false;
    }
  }

  /**
   * Listen for a specific shortcut event
   */
  on(event: ShortcutEvent, callback: (payload?: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Remove a specific event listener
   */
  off(event: ShortcutEvent, callback: (payload?: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Set up event listeners for all shortcut events
   */
  private async setupEventListeners() {
    // Push-to-talk events
    await listen('push-to-talk-start', () => {
      this.emit('push-to-talk-start');
    });

    await listen('push-to-talk-end', () => {
      this.emit('push-to-talk-end');
    });

    // Toggle mute event
    await listen('toggle-mute', () => {
      this.emit('toggle-mute');
    });

    // Screenshot event
    await listen('take-screenshot', () => {
      this.emit('take-screenshot');
    });

    // Status change events
    await listen('set-status', (event) => {
      this.emit('set-status', event.payload);
    });
  }

  /**
   * Emit event to all registered listeners
   */
  private emit(event: ShortcutEvent, payload?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(payload));
    }
  }
}

/**
 * Default shortcut configuration
 */
export const defaultShortcutConfig: ShortcutConfig = {
  push_to_talk: 'Ctrl+Space',
  toggle_mute: 'Ctrl+M',
  toggle_window: 'Ctrl+Shift+H',
  quick_screenshot: 'Ctrl+Shift+S',
  status_away: 'Ctrl+Alt+A',
  status_available: 'Ctrl+Alt+O',
};

/**
 * Global shortcut manager instance
 */
export const shortcutManager = new ShortcutManager();