import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import DeepLinkHandler from './DeepLinkHandler.svelte';

// Mock Tauri APIs
const mockListen = vi.fn();
const mockGoto = vi.fn();

vi.mock('@tauri-apps/api/event', () => ({
	listen: (...args: unknown[]) => mockListen(...args)
}));

vi.mock('$app/navigation', () => ({
	goto: (...args: unknown[]) => mockGoto(...args)
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock stores
const mockServers = writable([
	{
		id: 'server-1',
		name: 'Test Server',
		channels: [{ id: 'chan-1', name: 'general' }]
	}
]);
const mockCurrentChannel = writable(null);
const mockSetActiveChannel = vi.fn();
const mockToasts = {
	info: vi.fn(),
	error: vi.fn(),
	success: vi.fn()
};

vi.mock('$lib/stores/servers', () => ({
	servers: mockServers
}));

vi.mock('$lib/stores/channels', () => ({
	currentChannel: mockCurrentChannel,
	setActiveChannel: (...args: unknown[]) => mockSetActiveChannel(...args)
}));

vi.mock('$lib/stores/toasts', () => ({
	toasts: mockToasts
}));

describe('DeepLinkHandler', () => {
	let mockUnlisten: ReturnType<typeof vi.fn>;
	let capturedListener: ((event: { payload: unknown }) => void) | null = null;

	beforeEach(() => {
		vi.clearAllMocks();
		mockUnlisten = vi.fn();
		capturedListener = null;

		mockListen.mockImplementation((event: string, callback: (event: { payload: unknown }) => void) => {
			if (event === 'deeplink') {
				capturedListener = callback;
			}
			return Promise.resolve(mockUnlisten);
		});

		mockGoto.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
	});

	it('should render without visible UI', () => {
		const { container } = render(DeepLinkHandler);
		expect(container.innerHTML).toBe('<!---->');
	});

	it('should set up deep link listener on mount', async () => {
		render(DeepLinkHandler);

		await vi.waitFor(() => {
			expect(mockListen).toHaveBeenCalledWith('deeplink', expect.any(Function));
		});
	});

	it('should clean up listener on destroy', async () => {
		const { unmount } = render(DeepLinkHandler);

		await vi.waitFor(() => {
			expect(mockListen).toHaveBeenCalled();
		});

		unmount();
		expect(mockUnlisten).toHaveBeenCalled();
	});

	describe('Chat links', () => {
		it('should navigate to DM on chat link', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user123',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/channels/@me/user123');
			});
		});

		it('should show toast on chat navigation', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user456',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockToasts.info).toHaveBeenCalledWith('Opening conversation...');
			});
		});
	});

	describe('Server links', () => {
		it('should navigate to server default channel', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'server',
					target: 'server-456',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/channels/server-456');
			});
		});

		it('should navigate to server with specific channel', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'server',
					target: 'server-456',
					params: { channel: 'chan-789' }
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/channels/server-456/chan-789');
			});
		});
	});

	describe('Invite links', () => {
		it('should navigate to invite page', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'invite',
					target: 'ABCD1234',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/invite/ABCD1234');
			});
		});

		it('should pass query params on invite link', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'invite',
					target: 'XYZ789',
					params: { server: 'server-123', ref: 'email' }
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith(
					expect.stringContaining('/invite/XYZ789')
				);
				expect(mockGoto).toHaveBeenCalledWith(
					expect.stringContaining('server=server-123')
				);
			});
		});
	});

	describe('Settings links', () => {
		it('should navigate to settings root', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'settings',
					target: null,
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/settings');
			});
		});

		it('should navigate to settings section', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'settings',
					target: 'notifications',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/settings/notifications');
			});
		});
	});

	describe('Call links', () => {
		it('should navigate to call', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'call',
					target: 'call-abc-123',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/call/call-abc-123');
			});
		});
	});

	describe('Props', () => {
		it('should not navigate when autoNavigate is false', async () => {
			render(DeepLinkHandler, { props: { autoNavigate: false } });

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user123',
					params: {}
				}
			});

			// Give it time to potentially navigate
			await new Promise((r) => setTimeout(r, 100));

			expect(mockGoto).not.toHaveBeenCalled();
		});

		it('should not show toasts when showToasts is false', async () => {
			render(DeepLinkHandler, { props: { showToasts: false } });

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user123',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalled();
			});

			expect(mockToasts.info).not.toHaveBeenCalled();
		});

		it('should not handle links when disabled', async () => {
			render(DeepLinkHandler, { props: { enabled: false } });

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user123',
					params: {}
				}
			});

			// Give it time to potentially navigate
			await new Promise((r) => setTimeout(r, 100));

			expect(mockGoto).not.toHaveBeenCalled();
		});
	});

	describe('Duplicate handling', () => {
		it('should ignore duplicate links within threshold', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			const payload = {
				payload: {
					action: 'chat',
					target: 'user123',
					params: {}
				}
			};

			// First call
			capturedListener!(payload);

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledTimes(1);
			});

			// Immediate duplicate
			capturedListener!(payload);

			// Give it time
			await new Promise((r) => setTimeout(r, 100));

			// Should still only have been called once
			expect(mockGoto).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error handling', () => {
		it('should handle missing target in chat link', async () => {
			const mockDispatch = vi.fn();
			const { component } = render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			capturedListener!({
				payload: {
					action: 'chat',
					target: null,
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(mockToasts.error).toHaveBeenCalledWith(
					expect.stringContaining('Failed to handle link')
				);
			});
		});

		it('should handle unknown action', async () => {
			render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			// Unknown action should not throw
			expect(() => {
				capturedListener!({
					payload: {
						action: 'unknown_action',
						target: 'something',
						params: {}
					}
				});
			}).not.toThrow();
		});
	});

	describe('triggerDeepLink', () => {
		it('should parse and handle manual deep link trigger', async () => {
			const { component } = render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(mockListen).toHaveBeenCalled();
			});

			component.triggerDeepLink('hearth://chat/manual-user');

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith('/channels/@me/manual-user');
			});
		});

		it('should handle query parameters in manual trigger', async () => {
			const { component } = render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(mockListen).toHaveBeenCalled();
			});

			component.triggerDeepLink('hearth://invite/ABC123?server=srv-1&ref=test');

			await vi.waitFor(() => {
				expect(mockGoto).toHaveBeenCalledWith(
					expect.stringContaining('/invite/ABC123')
				);
			});
		});

		it('should reject invalid URLs', async () => {
			const { component } = render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(mockListen).toHaveBeenCalled();
			});

			// Invalid URL should not navigate
			component.triggerDeepLink('https://example.com/chat/user');

			// Give it time
			await new Promise((r) => setTimeout(r, 100));

			expect(mockGoto).not.toHaveBeenCalled();
		});
	});

	describe('getRecentLinks', () => {
		it('should return recent links', async () => {
			const { component } = render(DeepLinkHandler);

			await vi.waitFor(() => {
				expect(capturedListener).not.toBeNull();
			});

			// Empty initially
			expect(component.getRecentLinks()).toHaveLength(0);

			// Add a link
			capturedListener!({
				payload: {
					action: 'chat',
					target: 'user1',
					params: {}
				}
			});

			await vi.waitFor(() => {
				expect(component.getRecentLinks()).toHaveLength(1);
			});
		});
	});
});
