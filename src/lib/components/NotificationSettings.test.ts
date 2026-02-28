/**
 * NotificationSettings Component Tests
 * FEAT-004: Thread Autofollow Settings UI
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';

// Set up mocks with vi.hoisted to ensure they're available before any imports
const mockApi = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	put: vi.fn(),
	patch: vi.fn().mockResolvedValue({}),
	delete: vi.fn()
}));

// Mock $app/environment
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

// Mock document.documentElement for theme application (don't replace entire document)
if (typeof document !== 'undefined' && document.documentElement) {
	vi.spyOn(document.documentElement, 'setAttribute').mockImplementation(() => {});
	vi.spyOn(document.documentElement.style, 'setProperty').mockImplementation(() => {});
}

// Mock Notification API
const mockNotification = {
	permission: 'granted' as NotificationPermission,
	requestPermission: vi.fn().mockResolvedValue('granted')
};

Object.defineProperty(global, 'Notification', {
	value: mockNotification,
	writable: true,
	configurable: true
});

// Mock window.Notification
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'Notification', {
		value: mockNotification,
		writable: true,
		configurable: true
	});
}

// Import after mocks
import NotificationSettings from './NotificationSettings.svelte';
import { settings, notificationSettings } from '$lib/stores/settings';

describe('NotificationSettings Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
		mockApi.patch.mockResolvedValue({});
		settings.reset();
	});

	describe('Thread Autofollow Settings UI (FEAT-004)', () => {
		it('should render thread notification section', () => {
			render(NotificationSettings);
			
			// Check for the Threads section header
			expect(screen.getByText('Threads')).toBeInTheDocument();
		});

		it('should render thread notification level options', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Thread Notification Level')).toBeInTheDocument();
			expect(screen.getByText('All Messages')).toBeInTheDocument();
			expect(screen.getByText('Only @mentions')).toBeInTheDocument();
			expect(screen.getByText('Nothing')).toBeInTheDocument();
		});

		it('should render auto-follow thread toggle', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Automatically Follow Threads')).toBeInTheDocument();
			expect(screen.getByText(/Automatically follow threads when you're mentioned or added/)).toBeInTheDocument();
		});

		it('should render follow on reply toggle', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Follow on Reply')).toBeInTheDocument();
			expect(screen.getByText(/Automatically follow threads when you reply/)).toBeInTheDocument();
		});

		it('should have thread auto-follow enabled by default', () => {
			render(NotificationSettings);
			
			const autoFollowCheckbox = screen.getAllByRole('checkbox').find(
				checkbox => checkbox.closest('div')?.textContent?.includes('Automatically Follow Threads')
			);
			
			expect(autoFollowCheckbox).toBeChecked();
		});

		it('should have follow on reply enabled by default', () => {
			render(NotificationSettings);
			
			const followOnReplyCheckbox = screen.getAllByRole('checkbox').find(
				checkbox => checkbox.closest('div')?.textContent?.includes('Follow on Reply')
			);
			
			expect(followOnReplyCheckbox).toBeChecked();
		});

		it('should have "All Messages" notification level selected by default', () => {
			render(NotificationSettings);
			
			const allMessagesRadio = screen.getByRole('radio', { name: /All Messages/i });
			expect(allMessagesRadio).toBeChecked();
		});

		it('should update store when thread auto-follow is toggled', async () => {
			render(NotificationSettings);
			
			const autoFollowCheckbox = screen.getAllByRole('checkbox').find(
				checkbox => checkbox.closest('div')?.textContent?.includes('Automatically Follow Threads')
			);
			
			expect(autoFollowCheckbox).toBeDefined();
			await fireEvent.click(autoFollowCheckbox!);
			
			const notifications = get(notificationSettings);
			expect(notifications.threadAutoFollow).toBe(false);
		});

		it('should update store when follow on reply is toggled', async () => {
			render(NotificationSettings);
			
			const followOnReplyCheckbox = screen.getAllByRole('checkbox').find(
				checkbox => checkbox.closest('div')?.textContent?.includes('Follow on Reply')
			);
			
			expect(followOnReplyCheckbox).toBeDefined();
			await fireEvent.click(followOnReplyCheckbox!);
			
			const notifications = get(notificationSettings);
			expect(notifications.threadFollowOnReply).toBe(false);
		});

		it('should update store when notification level is changed to mentions', async () => {
			render(NotificationSettings);
			
			const mentionsRadio = screen.getByRole('radio', { name: /Only @mentions/i });
			await fireEvent.click(mentionsRadio);
			
			const notifications = get(notificationSettings);
			expect(notifications.threadNotifications).toBe('mentions');
		});

		it('should update store when notification level is changed to none', async () => {
			render(NotificationSettings);
			
			const noneRadio = screen.getByRole('radio', { name: /Nothing/i });
			await fireEvent.click(noneRadio);
			
			const notifications = get(notificationSettings);
			expect(notifications.threadNotifications).toBe('none');
		});

		it.skip('should sync to backend when thread settings change', async () => {
			// TODO: Backend sync not yet implemented - settings only persist to localStorage
			render(NotificationSettings);
			
			const autoFollowCheckbox = screen.getAllByRole('checkbox').find(
				checkbox => checkbox.closest('div')?.textContent?.includes('Automatically Follow Threads')
			);
			
			await fireEvent.click(autoFollowCheckbox!);
			
			// Wait for async sync
			await new Promise(resolve => setTimeout(resolve, 50));
			
			expect(mockApi.patch).toHaveBeenCalledWith('/users/@me/settings', expect.objectContaining({
				thread_auto_follow: false
			}));
		});

		it('should display description for each notification level', () => {
			render(NotificationSettings);
			
			expect(screen.getByText(/Receive notifications for all new replies in threads you follow/)).toBeInTheDocument();
			expect(screen.getByText(/Only receive notifications when you are mentioned/)).toBeInTheDocument();
			expect(screen.getByText(/Don't receive any thread notifications by default/)).toBeInTheDocument();
		});
	});

	describe('Other Sections', () => {
		it('should render desktop notifications section', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Desktop Notifications')).toBeInTheDocument();
		});

		it('should render sounds section', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Sounds')).toBeInTheDocument();
		});

		it('should render mentions section', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Mentions')).toBeInTheDocument();
		});

		it('should render direct messages section', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Direct Messages')).toBeInTheDocument();
		});

		it('should render do not disturb section', () => {
			render(NotificationSettings);
			
			expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
		});
	});

	describe('Embedded Mode', () => {
		it('should not render title when embedded', () => {
			render(NotificationSettings, { props: { embedded: true } });
			
			// The h1 "Notifications" should not be present when embedded
			const headings = screen.queryAllByRole('heading', { level: 1 });
			const notificationsH1 = headings.find(h => h.textContent === 'Notifications');
			expect(notificationsH1).toBeUndefined();
		});

		it('should render title when not embedded', () => {
			render(NotificationSettings, { props: { embedded: false } });
			
			expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
		});
	});
});
