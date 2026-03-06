import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ScreenTimeTracker from './ScreenTimeTracker.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string, args?: any) => {
    if (cmd === 'screentime_start' || cmd === 'screentime_get_state' || cmd === 'screentime_heartbeat') {
      return Promise.resolve({
        is_tracking: true,
        is_idle: false,
        current_session_start: Date.now(),
        today: {
          date: '2026-02-28',
          total_minutes: 0,
          active_minutes: 0,
          idle_minutes: 0,
          sessions: [],
          hourly_minutes: new Array(24).fill(0),
          peak_hour: 10
        },
        session_count_today: 1
      });
    }
    if (cmd === 'screentime_get_weekly') {
      return Promise.resolve({
        average_daily: 0,
        total_week: 0,
        trend: 'stable',
        most_active_day: '2026-02-28',
        most_active_hour: 10,
        days: []
      });
    }
    return Promise.resolve();
  })
}));

describe('ScreenTimeTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders full view by default', async () => {
      render(ScreenTimeTracker);

      await waitFor(() => {
        expect(screen.getByText('Screen Time')).toBeInTheDocument();
      });
    });

    it('renders compact view when compact prop is true', () => {
      render(ScreenTimeTracker, { props: { compact: true } });

      expect(screen.queryByText('Screen Time')).not.toBeInTheDocument();
    });

    it('shows weekly goal section when showWeeklyGoal is true', async () => {
      render(ScreenTimeTracker, { props: { showWeeklyGoal: true } });

      await waitFor(() => {
        expect(screen.getByText('Weekly Goal')).toBeInTheDocument();
      });
    });

    it('hides weekly goal section when showWeeklyGoal is false', () => {
      render(ScreenTimeTracker, { props: { showWeeklyGoal: false } });

      expect(screen.queryByText('Weekly Goal')).not.toBeInTheDocument();
    });
  });

  describe('time formatting', () => {
    it('displays initial time as 0m', async () => {
      render(ScreenTimeTracker);

      await waitFor(() => {
        expect(screen.getByText('0m')).toBeInTheDocument();
      });
    });

    it('shows sessions count', async () => {
      render(ScreenTimeTracker);

      await waitFor(() => {
        expect(screen.getByText('Sessions')).toBeInTheDocument();
      });
    });
  });

  describe('activity tracking', () => {
    it('records activity on mousedown', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      render(ScreenTimeTracker);

      fireEvent.mouseDown(document);

      // Activity should invoke screentime_activity (throttled)
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('screentime_activity');
      });
    });
  });

  describe('reset functionality', () => {
    it('renders reset button', async () => {
      render(ScreenTimeTracker);

      await waitFor(() => {
        expect(screen.getByText('Reset Data')).toBeInTheDocument();
      });
    });

    it('resets data when reset button clicked', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      render(ScreenTimeTracker);

      await waitFor(() => {
        expect(screen.getByText('Reset Data')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('Reset Data');
      await fireEvent.click(resetButton);

      expect(invoke).toHaveBeenCalledWith('screentime_reset');
    });
  });

  describe('compact mode', () => {
    it('shows today time in compact mode', () => {
      render(ScreenTimeTracker, { props: { compact: true } });

      expect(screen.getByText('0m')).toBeInTheDocument();
    });
  });

  describe('visibility handling', () => {
    it('handles visibility change', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      render(ScreenTimeTracker);

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      fireEvent(document, new Event('visibilitychange'));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('screentime_stop');
      });

      // Then visible again
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      fireEvent(document, new Event('visibilitychange'));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('screentime_start');
      });
    });
  });

  describe('goal callback', () => {
    it('accepts onGoalReached callback', () => {
      const onGoalReached = vi.fn();

      const { component } = render(ScreenTimeTracker, {
        props: {
          weeklyGoalMinutes: 1,
          onGoalReached
        }
      });

      expect(component).toBeTruthy();
    });
  });
});
