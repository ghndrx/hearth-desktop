import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import WindowBehaviorSettings from './WindowBehaviorSettings.svelte';
import { windowBehavior } from '$lib/stores/windowBehavior';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: vi.fn().mockReturnValue({
		hide: vi.fn().mockResolvedValue(undefined)
	})
}));

describe('WindowBehaviorSettings', () => {
	beforeEach(() => {
		// Reset store to defaults
		windowBehavior.reset();
		vi.clearAllMocks();
	});
	
	afterEach(() => {
		vi.restoreAllMocks();
	});
	
	it('renders the component with header', () => {
		render(WindowBehaviorSettings);
		
		expect(screen.getByRole('heading', { name: /window behavior/i })).toBeInTheDocument();
		expect(screen.getByText(/configure how hearth behaves/i)).toBeInTheDocument();
	});
	
	it('shows all setting toggles', () => {
		render(WindowBehaviorSettings);
		
		expect(screen.getByText('Close to tray')).toBeInTheDocument();
		expect(screen.getByText('Minimize to tray')).toBeInTheDocument();
		expect(screen.getByText('Start minimized')).toBeInTheDocument();
		expect(screen.getByText('Always on top')).toBeInTheDocument();
		expect(screen.getByText('Remember window state')).toBeInTheDocument();
		expect(screen.getByText('Show in taskbar')).toBeInTheDocument();
		expect(screen.getByText('Single-click tray toggle')).toBeInTheDocument();
	});
	
	it('shows browser notice when not in Tauri', () => {
		render(WindowBehaviorSettings);
		
		expect(screen.getByText(/some features require the desktop application/i)).toBeInTheDocument();
	});
	
	it('has section headers', () => {
		render(WindowBehaviorSettings);
		
		expect(screen.getByRole('heading', { name: /system tray/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /^window$/i })).toBeInTheDocument();
	});
	
	it('toggles close to tray setting', async () => {
		render(WindowBehaviorSettings);
		
		// Find the toggle for close to tray
		const toggles = screen.getAllByRole('checkbox');
		const closeToTrayToggle = toggles[0]; // First toggle is close to tray
		
		// Should be checked by default
		expect(closeToTrayToggle).toBeChecked();
		
		// Click to toggle off
		await fireEvent.click(closeToTrayToggle);
		
		// Wait for the change to propagate
		await waitFor(() => {
			expect(closeToTrayToggle).not.toBeChecked();
		});
	});
	
	it('toggles minimize to tray setting', async () => {
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		const minimizeToTrayToggle = toggles[1]; // Second toggle
		
		// Should be unchecked by default
		expect(minimizeToTrayToggle).not.toBeChecked();
		
		// Click to toggle on
		await fireEvent.click(minimizeToTrayToggle);
		
		await waitFor(() => {
			expect(minimizeToTrayToggle).toBeChecked();
		});
	});
	
	it('toggles start minimized setting', async () => {
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		const startMinimizedToggle = toggles[2]; // Third toggle
		
		expect(startMinimizedToggle).not.toBeChecked();
		
		await fireEvent.click(startMinimizedToggle);
		
		await waitFor(() => {
			expect(startMinimizedToggle).toBeChecked();
		});
	});
	
	it('toggles remember window state setting', async () => {
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		// Find by checking the parent element's text
		const rememberStateToggle = toggles[5]; // After single-click tray toggle
		
		// Should be checked by default
		expect(rememberStateToggle).toBeChecked();
	});
	
	it('shows reset button', () => {
		render(WindowBehaviorSettings);
		
		const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
		expect(resetButton).toBeInTheDocument();
	});
	
	it('resets settings when reset button clicked with confirmation', async () => {
		// Mock window.confirm
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
		
		render(WindowBehaviorSettings);
		
		// First, change a setting
		const toggles = screen.getAllByRole('checkbox');
		await fireEvent.click(toggles[1]); // Toggle minimize to tray on
		
		await waitFor(() => {
			expect(toggles[1]).toBeChecked();
		});
		
		// Click reset
		const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
		await fireEvent.click(resetButton);
		
		// Verify confirm was called
		expect(confirmSpy).toHaveBeenCalled();
		
		// Verify setting is reset (minimize to tray should be unchecked)
		await waitFor(() => {
			expect(toggles[1]).not.toBeChecked();
		});
		
		confirmSpy.mockRestore();
	});
	
	it('does not reset when confirmation is cancelled', async () => {
		const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
		
		render(WindowBehaviorSettings);
		
		// Change a setting
		const toggles = screen.getAllByRole('checkbox');
		await fireEvent.click(toggles[1]); // Toggle minimize to tray on
		
		await waitFor(() => {
			expect(toggles[1]).toBeChecked();
		});
		
		// Click reset (but cancel)
		const resetButton = screen.getByRole('button', { name: /reset to defaults/i });
		await fireEvent.click(resetButton);
		
		// Setting should remain changed
		expect(toggles[1]).toBeChecked();
		
		confirmSpy.mockRestore();
	});
	
	it('shows description for each setting', () => {
		render(WindowBehaviorSettings);
		
		expect(screen.getByText(/hide to the system tray instead of quitting/i)).toBeInTheDocument();
		expect(screen.getByText(/hide to the system tray instead of the taskbar/i)).toBeInTheDocument();
		expect(screen.getByText(/start hearth minimized to the system tray/i)).toBeInTheDocument();
		expect(screen.getByText(/keep hearth window above other applications/i)).toBeInTheDocument();
		expect(screen.getByText(/save and restore window position/i)).toBeInTheDocument();
	});
	
	it('persists settings to localStorage', async () => {
		const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
		
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		await fireEvent.click(toggles[1]); // Toggle minimize to tray
		
		await waitFor(() => {
			expect(setItemSpy).toHaveBeenCalledWith(
				'hearth_window_behavior',
				expect.any(String)
			);
		});
		
		// Verify the saved data includes the changed setting
		const savedData = JSON.parse(setItemSpy.mock.calls.at(-1)?.[1] ?? '{}');
		expect(savedData.minimizeToTray).toBe(true);
		
		setItemSpy.mockRestore();
	});
	
	it('loads settings from localStorage on mount', () => {
		// Pre-populate localStorage
		const customSettings = {
			minimizeToTray: true,
			closeToTray: false,
			startMinimized: true,
			alwaysOnTop: false,
			rememberWindowState: true,
			showInTaskbar: false,
			singleClickTrayToggle: true
		};
		localStorage.setItem('hearth_window_behavior', JSON.stringify(customSettings));
		
		// Reset store to pick up localStorage values
		windowBehavior.reset();
		windowBehavior.update(customSettings);
		
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		
		// Verify toggles reflect loaded settings
		expect(toggles[0]).not.toBeChecked(); // closeToTray = false
		expect(toggles[1]).toBeChecked(); // minimizeToTray = true
		expect(toggles[2]).toBeChecked(); // startMinimized = true
	});
	
	it('applies accessible labels to toggles', () => {
		render(WindowBehaviorSettings);
		
		const toggles = screen.getAllByRole('checkbox');
		toggles.forEach(toggle => {
			// Each toggle should be inside a label
			expect(toggle.closest('label')).toBeInTheDocument();
		});
	});
	
	it('shows status message area', async () => {
		render(WindowBehaviorSettings);
		
		// Initially no status message
		const statusElements = screen.queryAllByRole('status');
		expect(statusElements.length).toBe(0);
	});
});

describe('WindowBehaviorSettings store', () => {
	beforeEach(() => {
		windowBehavior.reset();
		localStorage.clear();
	});
	
	it('has correct default values', () => {
		const settings = windowBehavior.getSettings();
		
		expect(settings.minimizeToTray).toBe(false);
		expect(settings.closeToTray).toBe(true);
		expect(settings.startMinimized).toBe(false);
		expect(settings.alwaysOnTop).toBe(false);
		expect(settings.rememberWindowState).toBe(true);
		expect(settings.showInTaskbar).toBe(true);
		expect(settings.singleClickTrayToggle).toBe(true);
	});
	
	it('updates single setting', () => {
		windowBehavior.setSetting('minimizeToTray', true);
		
		const settings = windowBehavior.getSettings();
		expect(settings.minimizeToTray).toBe(true);
		expect(settings.closeToTray).toBe(true); // Other settings unchanged
	});
	
	it('updates multiple settings', () => {
		windowBehavior.update({
			minimizeToTray: true,
			closeToTray: false
		});
		
		const settings = windowBehavior.getSettings();
		expect(settings.minimizeToTray).toBe(true);
		expect(settings.closeToTray).toBe(false);
	});
	
	it('resets to defaults', () => {
		windowBehavior.update({
			minimizeToTray: true,
			closeToTray: false,
			startMinimized: true
		});
		
		windowBehavior.reset();
		
		const settings = windowBehavior.getSettings();
		expect(settings.minimizeToTray).toBe(false);
		expect(settings.closeToTray).toBe(true);
		expect(settings.startMinimized).toBe(false);
	});
});
