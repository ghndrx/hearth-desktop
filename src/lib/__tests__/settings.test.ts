/**
 * Tests for settings store
 * 
 * Tests application settings management including themes, message display,
 * font sizes, and localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  })
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock document
const mockSetAttribute = vi.fn();
const mockSetProperty = vi.fn();
Object.defineProperty(global, 'document', {
  value: {
    documentElement: {
      setAttribute: mockSetAttribute,
      style: {
        setProperty: mockSetProperty
      }
    }
  },
  writable: true
});

describe('Settings Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    mockSetAttribute.mockClear();
    mockSetProperty.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Theme types', () => {
    it('should support dark, light, and midnight themes', async () => {
      const validThemes = ['dark', 'light', 'midnight'];
      expect(validThemes).toContain('dark');
      expect(validThemes).toContain('light');
      expect(validThemes).toContain('midnight');
    });
  });

  describe('MessageDisplay types', () => {
    it('should support cozy and compact modes', async () => {
      const validModes = ['cozy', 'compact'];
      expect(validModes).toContain('cozy');
      expect(validModes).toContain('compact');
    });
  });

  describe('AppSettings interface', () => {
    it('should have all required properties', () => {
      const settings = {
        theme: 'dark' as const,
        messageDisplay: 'cozy' as const,
        compactMode: false,
        showSendButton: false,
        enableAnimations: true,
        enableSounds: true,
        notificationsEnabled: true,
        fontSize: 16,
        developerMode: false
      };
      
      expect(settings).toHaveProperty('theme');
      expect(settings).toHaveProperty('messageDisplay');
      expect(settings).toHaveProperty('compactMode');
      expect(settings).toHaveProperty('showSendButton');
      expect(settings).toHaveProperty('enableAnimations');
      expect(settings).toHaveProperty('enableSounds');
      expect(settings).toHaveProperty('notificationsEnabled');
      expect(settings).toHaveProperty('fontSize');
      expect(settings).toHaveProperty('developerMode');
    });
  });

  describe('Store initialization', () => {
    it('should initialize with default settings', async () => {
      const { settings } = await import('../stores/settings');
      
      const value = get(settings);
      
      expect(value.isOpen).toBe(false);
      expect(value.isServerSettingsOpen).toBe(false);
      expect(value.activeSection).toBe('account');
      expect(value.app.theme).toBe('dark');
      expect(value.app.messageDisplay).toBe('cozy');
      expect(value.app.compactMode).toBe(false);
      expect(value.app.showSendButton).toBe(false);
      expect(value.app.enableAnimations).toBe(true);
      expect(value.app.enableSounds).toBe(true);
      expect(value.app.notificationsEnabled).toBe(true);
      expect(value.app.fontSize).toBe(16);
      expect(value.app.developerMode).toBe(false);
    });

    it('should load existing settings from localStorage', async () => {
      const customSettings = {
        theme: 'midnight',
        messageDisplay: 'compact',
        compactMode: true,
        showSendButton: true,
        enableAnimations: false,
        enableSounds: false,
        notificationsEnabled: false,
        fontSize: 18,
        developerMode: true
      };
      mockStorage['hearth_settings'] = JSON.stringify(customSettings);
      
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      const value = get(settings);
      
      expect(value.app.theme).toBe('midnight');
      expect(value.app.messageDisplay).toBe('compact');
      expect(value.app.compactMode).toBe(true);
      expect(value.app.showSendButton).toBe(true);
      expect(value.app.enableAnimations).toBe(false);
      expect(value.app.enableSounds).toBe(false);
      expect(value.app.notificationsEnabled).toBe(false);
      expect(value.app.fontSize).toBe(18);
      expect(value.app.developerMode).toBe(true);
    });

    it('should merge partial settings with defaults', async () => {
      const partialSettings = {
        theme: 'light',
        fontSize: 20
      };
      mockStorage['hearth_settings'] = JSON.stringify(partialSettings);
      
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      const value = get(settings);
      
      // Saved values
      expect(value.app.theme).toBe('light');
      expect(value.app.fontSize).toBe(20);
      
      // Default values
      expect(value.app.messageDisplay).toBe('cozy');
      expect(value.app.enableAnimations).toBe(true);
    });

    it('should handle invalid JSON in localStorage gracefully', async () => {
      mockStorage['hearth_settings'] = 'invalid json {{{}';
      
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      const value = get(settings);
      
      expect(value.app.theme).toBe('dark');
      expect(value.app.fontSize).toBe(16);
    });

    it('should apply theme on initialization', async () => {
      mockSetAttribute.mockClear();
      
      vi.resetModules();
      await import('../stores/settings');
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', '');
    });
  });

  describe('open()', () => {
    it('should open settings with default section', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.open();
      
      const value = get(settings);
      expect(value.isOpen).toBe(true);
      expect(value.activeSection).toBe('account');
    });

    it('should open settings with specified section', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.open('appearance');
      
      const value = get(settings);
      expect(value.isOpen).toBe(true);
      expect(value.activeSection).toBe('appearance');
    });
  });

  describe('close()', () => {
    it('should close settings', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.open();
      settings.close();
      
      const value = get(settings);
      expect(value.isOpen).toBe(false);
    });
  });

  describe('openServerSettings()', () => {
    it('should open server settings', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.openServerSettings();
      
      const value = get(settings);
      expect(value.isServerSettingsOpen).toBe(true);
    });
  });

  describe('closeServerSettings()', () => {
    it('should close server settings', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.openServerSettings();
      settings.closeServerSettings();
      
      const value = get(settings);
      expect(value.isServerSettingsOpen).toBe(false);
    });
  });

  describe('setSection()', () => {
    it('should change active section', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.setSection('privacy');
      
      const value = get(settings);
      expect(value.activeSection).toBe('privacy');
    });
  });

  describe('updateApp()', () => {
    it('should update single setting', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 20 });
      
      const value = get(settings);
      expect(value.app.fontSize).toBe(20);
    });

    it('should update multiple settings', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({
        fontSize: 18,
        enableSounds: false,
        developerMode: true
      });
      
      const value = get(settings);
      expect(value.app.fontSize).toBe(18);
      expect(value.app.enableSounds).toBe(false);
      expect(value.app.developerMode).toBe(true);
    });

    it('should persist settings to localStorage', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 22 });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hearth_settings',
        expect.any(String)
      );
      
      const savedData = JSON.parse(mockStorage['hearth_settings']);
      expect(savedData.fontSize).toBe(22);
    });

    it('should apply theme change immediately', async () => {
      vi.resetModules();
      mockSetAttribute.mockClear();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ theme: 'midnight' });
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'midnight');
    });

    it('should set data-theme to empty string for dark theme', async () => {
      mockStorage['hearth_settings'] = JSON.stringify({ theme: 'light' });
      
      vi.resetModules();
      mockSetAttribute.mockClear();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ theme: 'dark' });
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', '');
    });

    it('should apply font size change to CSS variable', async () => {
      vi.resetModules();
      mockSetProperty.mockClear();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 18 });
      
      expect(mockSetProperty).toHaveBeenCalledWith('--message-font-size', '18px');
    });
  });

  describe('reset()', () => {
    it('should reset all settings to defaults', async () => {
      const customSettings = {
        theme: 'midnight',
        fontSize: 22,
        developerMode: true
      };
      mockStorage['hearth_settings'] = JSON.stringify(customSettings);
      
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.reset();
      
      const value = get(settings);
      expect(value.app.theme).toBe('dark');
      expect(value.app.fontSize).toBe(16);
      expect(value.app.developerMode).toBe(false);
      expect(value.app.enableAnimations).toBe(true);
    });

    it('should persist defaults to localStorage', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 22 });
      settings.reset();
      
      const savedData = JSON.parse(mockStorage['hearth_settings']);
      expect(savedData.fontSize).toBe(16);
    });

    it('should apply default theme', async () => {
      mockStorage['hearth_settings'] = JSON.stringify({ theme: 'midnight' });
      
      vi.resetModules();
      mockSetAttribute.mockClear();
      const { settings } = await import('../stores/settings');
      
      settings.reset();
      
      // Should apply 'dark' theme (empty string for data-theme)
      expect(mockSetAttribute).toHaveBeenLastCalledWith('data-theme', '');
    });
  });

  describe('derived stores', () => {
    it('isSettingsOpen should reflect settings open state', async () => {
      vi.resetModules();
      const { settings, isSettingsOpen } = await import('../stores/settings');
      
      expect(get(isSettingsOpen)).toBe(false);
      
      settings.open();
      expect(get(isSettingsOpen)).toBe(true);
      
      settings.close();
      expect(get(isSettingsOpen)).toBe(false);
    });

    it('isServerSettingsOpen should reflect server settings open state', async () => {
      vi.resetModules();
      const { settings, isServerSettingsOpen } = await import('../stores/settings');
      
      expect(get(isServerSettingsOpen)).toBe(false);
      
      settings.openServerSettings();
      expect(get(isServerSettingsOpen)).toBe(true);
      
      settings.closeServerSettings();
      expect(get(isServerSettingsOpen)).toBe(false);
    });

    it('activeSection should reflect current section', async () => {
      vi.resetModules();
      const { settings, activeSection } = await import('../stores/settings');
      
      expect(get(activeSection)).toBe('account');
      
      settings.setSection('notifications');
      expect(get(activeSection)).toBe('notifications');
    });

    it('appSettings should reflect app settings object', async () => {
      vi.resetModules();
      const { settings, appSettings } = await import('../stores/settings');
      
      const initialAppSettings = get(appSettings);
      expect(initialAppSettings.theme).toBe('dark');
      expect(initialAppSettings.fontSize).toBe(16);
      
      settings.updateApp({ fontSize: 20 });
      
      const updatedAppSettings = get(appSettings);
      expect(updatedAppSettings.fontSize).toBe(20);
    });

    it('currentTheme should reflect current theme', async () => {
      vi.resetModules();
      const { settings, currentTheme } = await import('../stores/settings');
      
      expect(get(currentTheme)).toBe('dark');
      
      settings.updateApp({ theme: 'light' });
      expect(get(currentTheme)).toBe('light');
      
      settings.updateApp({ theme: 'midnight' });
      expect(get(currentTheme)).toBe('midnight');
    });
  });

  describe('edge cases', () => {
    it('should handle updating same value multiple times', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 18 });
      settings.updateApp({ fontSize: 18 });
      settings.updateApp({ fontSize: 18 });
      
      const value = get(settings);
      expect(value.app.fontSize).toBe(18);
    });

    it('should preserve other settings when updating one', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({
        fontSize: 20,
        enableSounds: false,
        theme: 'light'
      });
      
      settings.updateApp({ fontSize: 22 });
      
      const value = get(settings);
      expect(value.app.fontSize).toBe(22);
      expect(value.app.enableSounds).toBe(false);
      expect(value.app.theme).toBe('light');
    });

    it('should handle extreme font sizes', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.updateApp({ fontSize: 8 });
      expect(get(settings).app.fontSize).toBe(8);
      
      settings.updateApp({ fontSize: 72 });
      expect(get(settings).app.fontSize).toBe(72);
    });

    it('should handle empty update object', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      const before = get(settings);
      settings.updateApp({});
      const after = get(settings);
      
      expect(before.app).toEqual(after.app);
    });

    it('should handle rapid state changes', async () => {
      vi.resetModules();
      const { settings } = await import('../stores/settings');
      
      settings.open('account');
      settings.setSection('appearance');
      settings.open('privacy');
      settings.close();
      settings.openServerSettings();
      settings.closeServerSettings();
      
      const value = get(settings);
      expect(value.isOpen).toBe(false);
      expect(value.isServerSettingsOpen).toBe(false);
      expect(value.activeSection).toBe('privacy');
    });
  });
});
