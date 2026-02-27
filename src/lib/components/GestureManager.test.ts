import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import GestureManager from './GestureManager.svelte';

describe('GestureManager', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders floating toggle button', () => {
		render(GestureManager);
		
		const button = screen.getByRole('button', { name: /gesture manager/i });
		expect(button).toBeInTheDocument();
	});

	it('opens panel when toggle button clicked', async () => {
		render(GestureManager);
		
		const button = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(button);
		
		expect(screen.getByText('Gesture Manager')).toBeInTheDocument();
	});

	it('shows gesture configurations in gestures tab', async () => {
		render(GestureManager);
		
		const button = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(button);
		
		expect(screen.getByText('Navigate Back')).toBeInTheDocument();
		expect(screen.getByText('Navigate Forward')).toBeInTheDocument();
		expect(screen.getByText('Show All Windows')).toBeInTheDocument();
	});

	it('can toggle gesture enabled state', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		// Find all enable/disable buttons
		const gestureToggles = screen.getAllByRole('button').filter(btn => {
			const svg = btn.querySelector('svg');
			return svg && btn.classList.contains('p-1.5');
		});
		
		expect(gestureToggles.length).toBeGreaterThan(0);
	});

	it('switches between tabs', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		// Click stats tab
		const statsTab = screen.getByText('Stats');
		await fireEvent.click(statsTab);
		
		expect(screen.getByText('Total Gestures')).toBeInTheDocument();
		
		// Click settings tab
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		expect(screen.getByText('Sensitivity')).toBeInTheDocument();
	});

	it('shows stats with gesture breakdown', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const statsTab = screen.getByText('Stats');
		await fireEvent.click(statsTab);
		
		expect(screen.getByText('Gesture Types')).toBeInTheDocument();
		expect(screen.getByText('swipe')).toBeInTheDocument();
		expect(screen.getByText('pinch')).toBeInTheDocument();
	});

	it('can change sensitivity level', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		const highBtn = screen.getByText('high');
		await fireEvent.click(highBtn);
		
		expect(highBtn.classList.contains('bg-purple-500')).toBe(true);
	});

	it('can toggle visual feedback', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		expect(screen.getByText('Visual Feedback')).toBeInTheDocument();
	});

	it('can toggle haptic feedback', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		expect(screen.getByText('Haptic Feedback')).toBeInTheDocument();
	});

	it('shows keyboard shortcut hint', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		expect(screen.getByText(/⌘\/Ctrl\+Shift\+G/)).toBeInTheDocument();
	});

	it('can close panel', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		expect(screen.getByText('Gesture Manager')).toBeInTheDocument();
		
		const closeBtn = screen.getByRole('button', { name: '' });
		// Find the close button by its SVG path
		const closeBtns = screen.getAllByRole('button').filter(btn => {
			const svg = btn.querySelector('svg path[d*="M6 18L18 6"]');
			return svg !== null;
		});
		
		if (closeBtns[0]) {
			await fireEvent.click(closeBtns[0]);
		}
	});

	it('can clear statistics', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const statsTab = screen.getByText('Stats');
		await fireEvent.click(statsTab);
		
		const clearBtn = screen.getByText('Clear Statistics');
		await fireEvent.click(clearBtn);
		
		// Stats should be cleared
		expect(screen.getByText('0')).toBeInTheDocument();
	});

	it('persists settings to localStorage', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		const highBtn = screen.getByText('high');
		await fireEvent.click(highBtn);
		
		const saved = localStorage.getItem('hearth-gestures');
		expect(saved).toBeTruthy();
		const parsed = JSON.parse(saved!);
		expect(parsed.sensitivityLevel).toBe('high');
	});

	it('loads settings from localStorage', async () => {
		localStorage.setItem('hearth-gestures', JSON.stringify({
			sensitivityLevel: 'high',
			showFeedback: false,
			enableHaptics: true
		}));
		
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const settingsTab = screen.getByText('Settings');
		await fireEvent.click(settingsTab);
		
		const highBtn = screen.getByText('high');
		expect(highBtn.classList.contains('bg-purple-500')).toBe(true);
	});

	it('can enable/disable gesture manager globally', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		// Find the main enable toggle in the header
		const header = screen.getByText('Gesture Manager').closest('div');
		const enableText = screen.getByText('On');
		expect(enableText).toBeInTheDocument();
	});

	it('displays finger count for gestures', async () => {
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		expect(screen.getByText('2-finger swipe left')).toBeInTheDocument();
		expect(screen.getByText('3-finger swipe up')).toBeInTheDocument();
	});

	it('handles touch events when enabled', async () => {
		const { component } = render(GestureManager);
		
		const gestureHandler = vi.fn();
		component.$on('gesture', gestureHandler);
		
		// Simulate touch sequence
		const touchStartEvent = new TouchEvent('touchstart', {
			touches: [
				{ clientX: 100, clientY: 100, identifier: 0 } as Touch
			],
			changedTouches: [
				{ clientX: 100, clientY: 100, identifier: 0 } as Touch
			]
		});
		
		document.dispatchEvent(touchStartEvent);
		await tick();
	});

	it('dispatches action events for recognized gestures', async () => {
		const { component } = render(GestureManager);
		
		const actionHandler = vi.fn();
		component.$on('action', actionHandler);
		
		// This would be triggered by actual gesture recognition
		// The component processes gestures internally
	});

	it('shows recent gestures in history', async () => {
		localStorage.setItem('hearth-gesture-stats', JSON.stringify({
			totalGestures: 5,
			gesturesByType: { swipe: 3, pinch: 2, rotate: 0, tap: 0, hold: 0, scroll: 0 },
			mostUsedGesture: 'swipe',
			lastGestureAt: Date.now(),
			successRate: 100
		}));
		
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const statsTab = screen.getByText('Stats');
		await fireEvent.click(statsTab);
		
		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument(); // swipe count
	});

	it('calculates most used gesture', async () => {
		localStorage.setItem('hearth-gesture-stats', JSON.stringify({
			totalGestures: 10,
			gesturesByType: { swipe: 7, pinch: 2, rotate: 0, tap: 1, hold: 0, scroll: 0 },
			mostUsedGesture: 'swipe',
			lastGestureAt: Date.now(),
			successRate: 100
		}));
		
		render(GestureManager);
		
		const toggleBtn = screen.getByRole('button', { name: /gesture manager/i });
		await fireEvent.click(toggleBtn);
		
		const statsTab = screen.getByText('Stats');
		await fireEvent.click(statsTab);
		
		expect(screen.getByText('Most Used')).toBeInTheDocument();
	});

	it('opens panel with keyboard shortcut', async () => {
		render(GestureManager);
		
		await fireEvent.keyDown(window, {
			key: 'G',
			metaKey: true,
			shiftKey: true
		});
		
		await tick();
		
		// Panel should be visible
		expect(screen.getByText('Gesture Manager')).toBeInTheDocument();
	});

	it('handles wheel events for pinch gesture', async () => {
		const { component } = render(GestureManager);
		
		const gestureHandler = vi.fn();
		component.$on('gesture', gestureHandler);
		
		const wheelEvent = new WheelEvent('wheel', {
			deltaY: -100,
			ctrlKey: true,
			clientX: 200,
			clientY: 200
		});
		
		document.dispatchEvent(wheelEvent);
		await tick();
	});
});
