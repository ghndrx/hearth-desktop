import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SmartStatusManager from './SmartStatusManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockImplementation((cmd: string) => {
		switch (cmd) {
			case 'detect_meeting':
				return Promise.resolve(false);
			case 'detect_screen_share':
				return Promise.resolve(false);
			case 'detect_music_playing':
				return Promise.resolve(false);
			case 'detect_gaming':
				return Promise.resolve(false);
			case 'get_idle_time':
				return Promise.resolve(0);
			case 'set_user_status':
				return Promise.resolve();
			default:
				return Promise.resolve();
		}
	})
}));

vi.mock('@tauri-apps/plugin-store', () => ({
	Store: {
		load: vi.fn().mockResolvedValue({
			get: vi.fn().mockResolvedValue(null),
			set: vi.fn().mockResolvedValue(undefined),
			save: vi.fn().mockResolvedValue(undefined)
		})
	}
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
	isPermissionGranted: vi.fn().mockResolvedValue(true),
	sendNotification: vi.fn()
}));

describe('SmartStatusManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders the status bar', async () => {
		render(SmartStatusManager);
		
		// Should show the status indicator
		const statusBar = document.querySelector('.smart-status-manager');
		expect(statusBar).toBeTruthy();
	});

	it('shows status options when expanded', async () => {
		render(SmartStatusManager);
		
		// Click to expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		expect(toggleButton).toBeTruthy();
		
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		// Should show status options (wait for render)
		await vi.waitFor(() => {
			const onlineButton = screen.queryByText('Online');
			expect(onlineButton).toBeTruthy();
		});
	});

	it('shows all status types', async () => {
		render(SmartStatusManager);
		
		// Expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		await vi.waitFor(() => {
			expect(screen.queryByText('Online')).toBeTruthy();
			expect(screen.queryByText('Away')).toBeTruthy();
			expect(screen.queryByText('Busy')).toBeTruthy();
			expect(screen.queryByText('Do Not Disturb')).toBeTruthy();
			expect(screen.queryByText('Invisible')).toBeTruthy();
			expect(screen.queryByText('Custom')).toBeTruthy();
		});
	});

	it('has auto mode toggle', async () => {
		render(SmartStatusManager);
		
		// Expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		await vi.waitFor(() => {
			// Should have Auto Active/Off button
			const autoButton = screen.queryByText(/Auto/);
			expect(autoButton).toBeTruthy();
		});
	});

	it('has focus mode toggle', async () => {
		render(SmartStatusManager);
		
		// Expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		await vi.waitFor(() => {
			const focusButton = screen.queryByText('Focus Mode');
			expect(focusButton).toBeTruthy();
		});
	});

	it('shows rules panel when toggled', async () => {
		render(SmartStatusManager);
		
		// Expand main panel
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		await vi.waitFor(() => {
			const rulesToggle = screen.queryByText(/Status Rules/);
			expect(rulesToggle).toBeTruthy();
		});
		
		// Click rules toggle
		const rulesButton = screen.getByText(/Status Rules/);
		await fireEvent.click(rulesButton);
		
		// Should show rule items
		await vi.waitFor(() => {
			// Default rules should be visible
			expect(screen.queryByText('Auto Away (Idle)')).toBeTruthy();
			expect(screen.queryByText('In Meeting')).toBeTruthy();
		});
	});

	it('allows adding custom rules', async () => {
		render(SmartStatusManager);
		
		// Expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		// Open rules panel
		await vi.waitFor(() => {
			const rulesToggle = screen.queryByText(/Status Rules/);
			expect(rulesToggle).toBeTruthy();
		});
		
		const rulesButton = screen.getByText(/Status Rules/);
		await fireEvent.click(rulesButton);
		
		// Find add rule button
		await vi.waitFor(() => {
			const addButton = screen.queryByText('+ Add Custom Rule');
			expect(addButton).toBeTruthy();
		});
	});

	it('has correct initial status indicator', () => {
		render(SmartStatusManager);
		
		// Should have a status dot (green for online)
		const statusDot = document.querySelector('.bg-green-500');
		expect(statusDot).toBeTruthy();
	});

	it('applies correct status colors', async () => {
		render(SmartStatusManager);
		
		// Expand
		const toggleButton = document.querySelector('.smart-status-manager button');
		if (toggleButton) {
			await fireEvent.click(toggleButton);
		}
		
		await vi.waitFor(() => {
			// Check for all status color indicators
			const greenDot = document.querySelector('.bg-green-500');
			const yellowDot = document.querySelector('.bg-yellow-500');
			const orangeDot = document.querySelector('.bg-orange-500');
			const redDot = document.querySelector('.bg-red-500');
			
			expect(greenDot).toBeTruthy(); // Online
			expect(yellowDot).toBeTruthy(); // Away
			expect(orangeDot).toBeTruthy(); // Busy
			expect(redDot).toBeTruthy(); // DND
		});
	});
});
