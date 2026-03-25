import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn().mockResolvedValue(() => {})
}));

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

import {
	windows,
	windowList,
	focusedWindow,
	createWindow,
	closeWindow,
	focusWindow,
	showWindow,
	hideWindow,
	resizeWindow,
	moveWindow,
	setWindowTitle,
	listWindows,
	sendMessage,
	broadcastMessage,
	onMessage,
	onMessageChannel,
	onWindowEvent,
	openSettingsWindow,
	openPopoutWindow,
	initMultiWindow,
	destroyMultiWindow,
	type WindowState,
	type WindowConfig
} from './multiWindow';

describe('multiWindow store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		windows.set(new Map());
	});

	describe('createWindow', () => {
		it('should invoke mw_create_window and update the store', async () => {
			const mockState: WindowState = {
				label: 'test-win',
				title: 'Test',
				kind: 'custom',
				visible: true,
				focused: true,
				width: 800,
				height: 600,
				x: 0,
				y: 0
			};
			mockInvoke.mockResolvedValueOnce(mockState);

			const result = await createWindow({ label: 'test-win', title: 'Test' });

			expect(mockInvoke).toHaveBeenCalledWith('mw_create_window', {
				config: expect.objectContaining({ label: 'test-win', title: 'Test' })
			});
			expect(result).toEqual(mockState);

			const store = get(windows);
			expect(store.get('test-win')).toEqual(mockState);
		});

		it('should apply default config values', async () => {
			const mockState: WindowState = {
				label: 'win',
				title: 'Hearth',
				kind: 'custom',
				visible: true,
				focused: true,
				width: 800,
				height: 600,
				x: 0,
				y: 0
			};
			mockInvoke.mockResolvedValueOnce(mockState);

			await createWindow({ label: 'win' });

			expect(mockInvoke).toHaveBeenCalledWith('mw_create_window', {
				config: expect.objectContaining({
					label: 'win',
					title: 'Hearth',
					url: '/',
					width: 800,
					height: 600,
					resizable: true,
					decorations: true,
					transparent: false,
					alwaysOnTop: false,
					skipTaskbar: false,
					center: true,
					kind: 'custom'
				})
			});
		});
	});

	describe('closeWindow', () => {
		it('should invoke mw_close_window and remove from store', async () => {
			// Seed store
			windows.set(
				new Map([
					[
						'test-win',
						{
							label: 'test-win',
							title: 'Test',
							kind: 'custom' as const,
							visible: true,
							focused: false,
							width: 800,
							height: 600,
							x: 0,
							y: 0
						}
					]
				])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await closeWindow('test-win');

			expect(mockInvoke).toHaveBeenCalledWith('mw_close_window', { label: 'test-win' });
			expect(get(windows).has('test-win')).toBe(false);
		});
	});

	describe('focusWindow', () => {
		it('should invoke mw_focus_window and update focus state', async () => {
			windows.set(
				new Map([
					['win-a', { label: 'win-a', title: 'A', kind: 'custom' as const, visible: true, focused: true, width: 800, height: 600, x: 0, y: 0 }],
					['win-b', { label: 'win-b', title: 'B', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]
				])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await focusWindow('win-b');

			const store = get(windows);
			expect(store.get('win-a')?.focused).toBe(false);
			expect(store.get('win-b')?.focused).toBe(true);
			expect(store.get('win-b')?.visible).toBe(true);
		});
	});

	describe('showWindow / hideWindow', () => {
		it('should show a window and update store', async () => {
			windows.set(
				new Map([['w', { label: 'w', title: 'W', kind: 'custom' as const, visible: false, focused: false, width: 800, height: 600, x: 0, y: 0 }]])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await showWindow('w');
			expect(get(windows).get('w')?.visible).toBe(true);
		});

		it('should hide a window and update store', async () => {
			windows.set(
				new Map([['w', { label: 'w', title: 'W', kind: 'custom' as const, visible: true, focused: true, width: 800, height: 600, x: 0, y: 0 }]])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await hideWindow('w');
			const state = get(windows).get('w');
			expect(state?.visible).toBe(false);
			expect(state?.focused).toBe(false);
		});
	});

	describe('resizeWindow', () => {
		it('should invoke mw_resize_window and update dimensions', async () => {
			windows.set(
				new Map([['w', { label: 'w', title: 'W', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await resizeWindow('w', 1024, 768);

			expect(mockInvoke).toHaveBeenCalledWith('mw_resize_window', { label: 'w', width: 1024, height: 768 });
			const state = get(windows).get('w');
			expect(state?.width).toBe(1024);
			expect(state?.height).toBe(768);
		});
	});

	describe('moveWindow', () => {
		it('should invoke mw_move_window and update position', async () => {
			windows.set(
				new Map([['w', { label: 'w', title: 'W', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await moveWindow('w', 100, 200);

			expect(mockInvoke).toHaveBeenCalledWith('mw_move_window', { label: 'w', x: 100, y: 200 });
			const state = get(windows).get('w');
			expect(state?.x).toBe(100);
			expect(state?.y).toBe(200);
		});
	});

	describe('setWindowTitle', () => {
		it('should invoke mw_set_title and update store', async () => {
			windows.set(
				new Map([['w', { label: 'w', title: 'Old', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]])
			);
			mockInvoke.mockResolvedValueOnce(undefined);

			await setWindowTitle('w', 'New Title');

			expect(mockInvoke).toHaveBeenCalledWith('mw_set_title', { label: 'w', title: 'New Title' });
			expect(get(windows).get('w')?.title).toBe('New Title');
		});
	});

	describe('listWindows', () => {
		it('should fetch all windows and populate the store', async () => {
			const mockList: WindowState[] = [
				{ label: 'main', title: 'Hearth', kind: 'main', visible: true, focused: true, width: 1200, height: 800, x: 0, y: 0 },
				{ label: 'floating', title: 'Hearth Mini', kind: 'floating-panel', visible: false, focused: false, width: 380, height: 520, x: 0, y: 0 }
			];
			mockInvoke.mockResolvedValueOnce(mockList);

			const result = await listWindows();

			expect(result).toEqual(mockList);
			const store = get(windows);
			expect(store.size).toBe(2);
			expect(store.get('main')?.kind).toBe('main');
		});
	});

	describe('IPC messaging', () => {
		it('should send a message to a specific window', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			await sendMessage('settings', 'theme-changed', { dark: true });

			expect(mockInvoke).toHaveBeenCalledWith('mw_send_message', {
				message: expect.objectContaining({
					to: 'settings',
					channel: 'theme-changed',
					payload: { dark: true }
				})
			});
		});

		it('should broadcast a message to all windows', async () => {
			mockInvoke.mockResolvedValueOnce(undefined);

			await broadcastMessage('user-status', { status: 'online' });

			expect(mockInvoke).toHaveBeenCalledWith('mw_send_message', {
				message: expect.objectContaining({
					to: '*',
					channel: 'user-status',
					payload: { status: 'online' }
				})
			});
		});

		it('should register a message listener', async () => {
			const handler = vi.fn();
			await onMessage(handler);

			expect(mockListen).toHaveBeenCalledWith('mw:message', expect.any(Function));
		});

		it('should register a channel-specific message listener', async () => {
			const handler = vi.fn();
			await onMessageChannel('theme-changed', handler);

			expect(mockListen).toHaveBeenCalledWith('mw:message', expect.any(Function));
		});
	});

	describe('window events', () => {
		it('should register a window event listener', async () => {
			const handler = vi.fn();
			await onWindowEvent(handler);

			expect(mockListen).toHaveBeenCalledWith('mw:event', expect.any(Function));
		});
	});

	describe('derived stores', () => {
		it('windowList should return array of all windows', () => {
			windows.set(
				new Map([
					['a', { label: 'a', title: 'A', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }],
					['b', { label: 'b', title: 'B', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]
				])
			);

			const list = get(windowList);
			expect(list).toHaveLength(2);
		});

		it('focusedWindow should return the focused window', () => {
			windows.set(
				new Map([
					['a', { label: 'a', title: 'A', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }],
					['b', { label: 'b', title: 'B', kind: 'custom' as const, visible: true, focused: true, width: 800, height: 600, x: 0, y: 0 }]
				])
			);

			expect(get(focusedWindow)?.label).toBe('b');
		});

		it('focusedWindow should return null when no window is focused', () => {
			windows.set(
				new Map([
					['a', { label: 'a', title: 'A', kind: 'custom' as const, visible: true, focused: false, width: 800, height: 600, x: 0, y: 0 }]
				])
			);

			expect(get(focusedWindow)).toBeNull();
		});
	});

	describe('convenience helpers', () => {
		it('openSettingsWindow should create a settings window', async () => {
			const mockState: WindowState = {
				label: 'settings',
				title: 'Hearth Settings',
				kind: 'settings',
				visible: true,
				focused: true,
				width: 900,
				height: 700,
				x: 0,
				y: 0
			};
			mockInvoke.mockResolvedValueOnce(mockState);

			const result = await openSettingsWindow();

			expect(mockInvoke).toHaveBeenCalledWith('mw_create_window', {
				config: expect.objectContaining({
					label: 'settings',
					kind: 'settings',
					url: '/settings'
				})
			});
			expect(result.kind).toBe('settings');
		});

		it('openPopoutWindow should create a popout window with prefixed label', async () => {
			const mockState: WindowState = {
				label: 'popout-chat-123',
				title: 'Chat',
				kind: 'popout',
				visible: true,
				focused: true,
				width: 480,
				height: 640,
				x: 0,
				y: 0
			};
			mockInvoke.mockResolvedValueOnce(mockState);

			const result = await openPopoutWindow('chat-123', 'Chat', '/channels/123');

			expect(mockInvoke).toHaveBeenCalledWith('mw_create_window', {
				config: expect.objectContaining({
					label: 'popout-chat-123',
					title: 'Chat',
					url: '/channels/123',
					kind: 'popout'
				})
			});
			expect(result.label).toBe('popout-chat-123');
		});

		it('openSettingsWindow should focus existing settings window on error', async () => {
			mockInvoke
				.mockRejectedValueOnce(new Error("Window 'settings' already exists"))
				.mockResolvedValueOnce(undefined) // focusWindow
				.mockResolvedValueOnce({
					label: 'settings',
					title: 'Hearth Settings',
					kind: 'settings',
					visible: true,
					focused: true,
					width: 900,
					height: 700,
					x: 0,
					y: 0
				}); // getWindowState

			const result = await openSettingsWindow();

			expect(result.label).toBe('settings');
		});
	});

	describe('initMultiWindow / destroyMultiWindow', () => {
		it('should load windows and register event listener on init', async () => {
			const mockUnlisten = vi.fn();
			mockInvoke.mockResolvedValueOnce([]); // listWindows
			mockListen.mockResolvedValueOnce(mockUnlisten); // onWindowEvent

			await initMultiWindow();

			expect(mockInvoke).toHaveBeenCalledWith('mw_list_windows');
			expect(mockListen).toHaveBeenCalledWith('mw:event', expect.any(Function));
		});

		it('should clean up event listener on destroy', async () => {
			const mockUnlisten = vi.fn();
			mockInvoke.mockResolvedValueOnce([]); // listWindows
			mockListen.mockResolvedValueOnce(mockUnlisten);

			await initMultiWindow();
			destroyMultiWindow();

			expect(mockUnlisten).toHaveBeenCalled();
		});
	});
});
