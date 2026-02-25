import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/svelte';
import WindowStateManager from './WindowStateManager.svelte';

// Mock Tauri APIs
const mockInvoke = vi.fn();
const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
	invoke: (...args: unknown[]) => mockInvoke(...args)
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: (...args: unknown[]) => mockListen(...args)
}));

describe('WindowStateManager', () => {
	const mockWindowState = {
		x: 100,
		y: 200,
		width: 1280,
		height: 800,
		is_maximized: false,
		is_fullscreen: false
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockInvoke.mockImplementation((cmd: string) => {
			switch (cmd) {
				case 'restore_window_state':
					return Promise.resolve(true);
				case 'get_window_state':
					return Promise.resolve(mockWindowState);
				case 'save_window_state':
					return Promise.resolve(undefined);
				case 'clear_window_state':
					return Promise.resolve(undefined);
				default:
					return Promise.resolve(undefined);
			}
		});

		mockListen.mockImplementation(() => {
			const unlisten = vi.fn();
			return Promise.resolve(unlisten);
		});
	});

	afterEach(() => {
		cleanup();
	});

	it('renders without crashing', () => {
		const { container } = render(WindowStateManager);
		expect(container).toBeDefined();
	});

	it('calls restore_window_state on mount', async () => {
		render(WindowStateManager);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('restore_window_state');
		});
	});

	it('sets up event listeners on mount', async () => {
		render(WindowStateManager);

		await waitFor(() => {
			expect(mockListen).toHaveBeenCalledWith('tauri://move', expect.any(Function));
			expect(mockListen).toHaveBeenCalledWith('tauri://resize', expect.any(Function));
			expect(mockListen).toHaveBeenCalledWith('tauri://close-requested', expect.any(Function));
			expect(mockListen).toHaveBeenCalledWith('tauri://focus', expect.any(Function));
		});
	});

	it('handles restore failure gracefully', async () => {
		mockInvoke.mockRejectedValue(new Error('Restore failed'));

		// Should not throw
		const { container } = render(WindowStateManager);
		expect(container).toBeDefined();
	});

	it('skips restore when autoRestore is false', async () => {
		render(WindowStateManager, { props: { autoRestore: false } });

		// Give it time to potentially call
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(mockInvoke).not.toHaveBeenCalledWith('restore_window_state');
	});
});
