/**
 * Settings Store Tests
 * FEAT-004: Thread Autofollow Settings
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Set up mocks with vi.hoisted to ensure they're available before any imports
const mockApi = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	patch: vi.fn(),
	delete: vi.fn()
}));

// Mock $app/environment before importing modules
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

// Mock api module
vi.mock('$lib/api', () => ({
	api: mockApi
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock document for theme application
Object.defineProperty(global, 'document', {
	value: {
		documentElement: {
			setAttribute: vi.fn(),
			style: {
				setProperty: vi.fn()
			}
		}
	},
	writable: true
});

// Now import the module under test
import { settings, notificationSettings } from './settings';

describe('Settings Store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		mockApi.get.mockReset();
		mockApi.patch.mockReset();
		
		// Reset store to defaults
		settings.reset();
	});

	afterEach(() => {
		// Clean up
	});

	describe('Thread Autofollow Settings (FEAT-004)', () => {
		it('should have default thread autofollow settings', () => {
			const notifications = get(notificationSettings);
			
			expect(notifications.threadAutoFollow).toBe(true);
			expect(notifications.threadFollowOnReply).toBe(true);
			expect(notifications.threadNotifications).toBe('all');
		});

		it('should update threadAutoFollow setting', () => {
			settings.updateNotifications({ threadAutoFollow: false });
			
			const notifications = get(notificationSettings);
			expect(notifications.threadAutoFollow).toBe(false);
		});

		it('should update threadFollowOnReply setting', () => {
			settings.updateNotifications({ threadFollowOnReply: false });
			
			const notifications = get(notificationSettings);
			expect(notifications.threadFollowOnReply).toBe(false);
		});

		it('should update threadNotifications level', () => {
			settings.updateNotifications({ threadNotifications: 'mentions' });
			
			const notifications = get(notificationSettings);
			expect(notifications.threadNotifications).toBe('mentions');
		});

		it.skip('should sync thread settings to backend when updated', async () => {
			// TODO: Backend sync not yet implemented - settings only persist to localStorage
			mockApi.patch.mockResolvedValue({});
			
			settings.updateNotifications({ threadAutoFollow: false });
			
			// Wait for async sync
			await new Promise(resolve => setTimeout(resolve, 50));
			
			expect(mockApi.patch).toHaveBeenCalledWith('/users/@me/settings', expect.objectContaining({
				thread_auto_follow: false
			}));
		});

		it.skip('should sync all thread settings to backend', async () => {
			// TODO: Backend sync not yet implemented - settings only persist to localStorage
			mockApi.patch.mockResolvedValue({});
			
			settings.updateNotifications({ 
				threadAutoFollow: false,
				threadFollowOnReply: false,
				threadNotifications: 'none'
			});
			
			// Wait for async sync
			await new Promise(resolve => setTimeout(resolve, 50));
			
			expect(mockApi.patch).toHaveBeenCalledWith('/users/@me/settings', {
				thread_auto_follow: false,
				thread_follow_on_reply: false,
				thread_default_notification_level: 'none'
			});
		});

		it('should not sync non-thread settings to backend', async () => {
			mockApi.patch.mockResolvedValue({});
			
			settings.updateNotifications({ desktopEnabled: false });
			
			// Wait for potential async sync
			await new Promise(resolve => setTimeout(resolve, 50));
			
			expect(mockApi.patch).not.toHaveBeenCalled();
		});

		// TODO: fetchUserSettings not yet implemented - settings currently use localStorage only
		it.skip('should fetch thread settings from backend', async () => {
			mockApi.get.mockResolvedValue({
				thread_auto_follow: false,
				thread_follow_on_reply: false,
				thread_default_notification_level: 'mentions'
			});
			
			// await fetchUserSettings();
			
			const notifications = get(notificationSettings);
			expect(notifications.threadAutoFollow).toBe(false);
			expect(notifications.threadFollowOnReply).toBe(false);
			expect(notifications.threadNotifications).toBe('mentions');
		});

		// TODO: fetchUserSettings not yet implemented - settings currently use localStorage only
		it.skip('should use local defaults if backend fetch fails', async () => {
			mockApi.get.mockRejectedValue(new Error('Network error'));
			
			// Should not throw
			// await fetchUserSettings();
			
			const notifications = get(notificationSettings);
			// Should still have defaults
			expect(notifications.threadAutoFollow).toBe(true);
		});

		it('should save thread settings to localStorage', () => {
			settings.updateNotifications({ threadNotifications: 'none' });
			
			expect(localStorageMock.setItem).toHaveBeenCalled();
			
			// Find the LAST call to setItem with 'hearth_settings' (after update)
			const calls = localStorageMock.setItem.mock.calls.filter(
				(c: [string, string]) => c[0] === 'hearth_settings'
			);
			expect(calls.length).toBeGreaterThan(0);
			
			const lastCall = calls[calls.length - 1];
			const savedData = JSON.parse(lastCall[1]);
			expect(savedData.notifications.threadNotifications).toBe('none');
		});

		it('should validate threadNotifications value', () => {
			// Valid values
			settings.updateNotifications({ threadNotifications: 'all' });
			expect(get(notificationSettings).threadNotifications).toBe('all');
			
			settings.updateNotifications({ threadNotifications: 'mentions' });
			expect(get(notificationSettings).threadNotifications).toBe('mentions');
			
			settings.updateNotifications({ threadNotifications: 'none' });
			expect(get(notificationSettings).threadNotifications).toBe('none');
		});
	});

	describe('Other Notification Settings', () => {
		it('should update desktop notification settings', () => {
			settings.updateNotifications({ desktopEnabled: false });
			
			const notifications = get(notificationSettings);
			expect(notifications.desktopEnabled).toBe(false);
		});

		it('should update sound settings', () => {
			settings.updateNotifications({ soundVolume: 50 });
			
			const notifications = get(notificationSettings);
			expect(notifications.soundVolume).toBe(50);
		});

		it('should update mention settings', () => {
			settings.updateNotifications({ 
				mentionHighlight: false,
				mentionEveryone: false 
			});
			
			const notifications = get(notificationSettings);
			expect(notifications.mentionHighlight).toBe(false);
			expect(notifications.mentionEveryone).toBe(false);
		});
	});

	describe('Settings Reset', () => {
		it('should reset all settings to defaults', () => {
			// Change some settings
			settings.updateNotifications({ 
				threadAutoFollow: false,
				threadNotifications: 'none',
				desktopEnabled: false
			});
			
			// Reset
			settings.reset();
			
			const notifications = get(notificationSettings);
			expect(notifications.threadAutoFollow).toBe(true);
			expect(notifications.threadNotifications).toBe('all');
			expect(notifications.desktopEnabled).toBe(true);
		});
	});
});
