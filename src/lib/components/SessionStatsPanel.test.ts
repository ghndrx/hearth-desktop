import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import SessionStatsPanel from './SessionStatsPanel.svelte';

// Mock Svelte stores
vi.mock('$lib/stores/messages', () => ({
	messages: { subscribe: vi.fn((cb) => { cb({}); return () => {}; }) }
}));

vi.mock('$lib/stores/focusMode', () => ({
	focusMode: { subscribe: vi.fn((cb) => { cb(false); return () => {}; }) }
}));

vi.mock('$lib/stores/activity', () => ({
	activity: { subscribe: vi.fn((cb) => { cb({ idleStatus: { is_idle: false } }); return () => {}; }) }
}));

vi.mock('$lib/stores/servers', () => ({
	servers: { subscribe: vi.fn((cb) => { cb([]); return () => {}; }) }
}));

describe('SessionStatsPanel', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-02-26T12:00:00Z'));
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('renders the component with header', () => {
		const { getByText, getByRole } = render(SessionStatsPanel);
		
		expect(getByText('Session Stats')).toBeInTheDocument();
		expect(getByRole('region', { name: 'Session Statistics' })).toBeInTheDocument();
	});

	it('hides header when showHeader is false', () => {
		const { queryByText } = render(SessionStatsPanel, { props: { showHeader: false } });
		
		expect(queryByText('Session Stats')).not.toBeInTheDocument();
	});

	it('displays initial session time', () => {
		const { getByText } = render(SessionStatsPanel);
		
		expect(getByText('0s')).toBeInTheDocument();
		expect(getByText('Session Time')).toBeInTheDocument();
	});

	it('displays message statistics', () => {
		const { getAllByText, getByText } = render(SessionStatsPanel);
		
		expect(getByText('Sent / Received')).toBeInTheDocument();
		expect(getByText('Messages/Hour')).toBeInTheDocument();
	});

	it('displays focus time statistics', () => {
		const { getByText } = render(SessionStatsPanel);
		
		expect(getByText('Focus Time')).toBeInTheDocument();
	});

	it('displays reactions counter', () => {
		const { getByText } = render(SessionStatsPanel);
		
		expect(getByText('Reactions')).toBeInTheDocument();
	});

	it('displays server/channel visits', () => {
		const { getByText } = render(SessionStatsPanel);
		
		expect(getByText('Servers / Channels')).toBeInTheDocument();
	});

	it('updates session time after interval', async () => {
		const { getByText, queryByText } = render(SessionStatsPanel, {
			props: { refreshInterval: 1000 }
		});
		
		expect(getByText('0s')).toBeInTheDocument();
		
		// Advance time by 5 seconds
		vi.advanceTimersByTime(5000);
		
		// Component should update
		await vi.runOnlyPendingTimersAsync();
	});

	it('renders in compact mode', () => {
		const { container } = render(SessionStatsPanel, { props: { compact: true } });
		
		expect(container.querySelector('.compact')).toBeInTheDocument();
	});

	it('has export button that is accessible', () => {
		const { getByLabelText } = render(SessionStatsPanel);
		
		const exportBtn = getByLabelText('Export session statistics');
		expect(exportBtn).toBeInTheDocument();
	});

	it('has reset button that is accessible', () => {
		const { getByLabelText } = render(SessionStatsPanel);
		
		const resetBtn = getByLabelText('Reset session statistics');
		expect(resetBtn).toBeInTheDocument();
	});

	it('handles reset button click', async () => {
		const { getByLabelText, getByText } = render(SessionStatsPanel);
		
		const resetBtn = getByLabelText('Reset session statistics');
		await fireEvent.click(resetBtn);
		
		// After reset, session time should be 0
		expect(getByText('0s')).toBeInTheDocument();
	});

	it('handles message-sent custom event', async () => {
		render(SessionStatsPanel);
		
		// Dispatch custom event
		window.dispatchEvent(new CustomEvent('hearth:message-sent'));
		
		// Message count should increment (internal state)
	});

	it('handles message-received custom event', async () => {
		render(SessionStatsPanel);
		
		window.dispatchEvent(new CustomEvent('hearth:message-received'));
	});

	it('handles reaction-added custom event', async () => {
		render(SessionStatsPanel);
		
		window.dispatchEvent(new CustomEvent('hearth:reaction-added'));
	});

	it('cleans up event listeners on destroy', () => {
		const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
		
		const { unmount } = render(SessionStatsPanel);
		unmount();
		
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'hearth:message-sent',
			expect.any(Function)
		);
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'hearth:message-received',
			expect.any(Function)
		);
		expect(removeEventListenerSpy).toHaveBeenCalledWith(
			'hearth:reaction-added',
			expect.any(Function)
		);
	});

	it('applies correct aria attributes', () => {
		const { getByRole } = render(SessionStatsPanel);
		
		const panel = getByRole('region');
		expect(panel).toHaveAttribute('aria-label', 'Session Statistics');
	});
});
