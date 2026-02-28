import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import PomodoroWidget from './PomodoroWidget.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null)
}));

describe('PomodoroWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders with default work session', () => {
      render(PomodoroWidget);
      
      expect(screen.getByText('🍅 Pomodoro')).toBeInTheDocument();
      expect(screen.getByText('25:00')).toBeInTheDocument();
      expect(screen.getByText('Focus Time')).toBeInTheDocument();
    });

    it('renders session tabs', () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('tab', { name: 'Focus' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Short Break' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Long Break' })).toBeInTheDocument();
    });

    it('renders control buttons', () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('renders stats section', () => {
      render(PomodoroWidget);
      
      expect(screen.getByText('/ 4')).toBeInTheDocument();
      expect(screen.getByText('today')).toBeInTheDocument();
    });
  });

  describe('timer controls', () => {
    it('starts timer when play button is clicked', async () => {
      render(PomodoroWidget);
      
      const startButton = screen.getByRole('button', { name: 'Start' });
      await fireEvent.click(startButton);
      
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    });

    it('pauses timer when pause button is clicked', async () => {
      render(PomodoroWidget);
      
      // Start timer
      await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      
      // Pause timer
      await fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });

    it('decrements time when running', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      
      // Advance 5 seconds
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        expect(screen.getByText('24:55')).toBeInTheDocument();
      });
    });

    it('resets timer to session duration', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      vi.advanceTimersByTime(60000); // 1 minute
      
      await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      
      expect(screen.getByText('25:00')).toBeInTheDocument();
    });
  });

  describe('session switching', () => {
    it('switches to short break session', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('tab', { name: 'Short Break' }));
      
      expect(screen.getByText('05:00')).toBeInTheDocument();
      expect(screen.getByText('Short Break')).toBeInTheDocument();
    });

    it('switches to long break session', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('tab', { name: 'Long Break' }));
      
      expect(screen.getByText('15:00')).toBeInTheDocument();
      expect(screen.getByText('Long Break')).toBeInTheDocument();
    });

    it('stops timer when switching sessions', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      await fireEvent.click(screen.getByRole('tab', { name: 'Short Break' }));
      
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    });
  });

  describe('custom durations', () => {
    it('uses custom work duration', () => {
      render(PomodoroWidget, { props: { workDuration: 30 } });
      
      expect(screen.getByText('30:00')).toBeInTheDocument();
    });

    it('uses custom short break duration', async () => {
      render(PomodoroWidget, { props: { shortBreakDuration: 10 } });
      
      await fireEvent.click(screen.getByRole('tab', { name: 'Short Break' }));
      
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('uses custom long break duration', async () => {
      render(PomodoroWidget, { props: { longBreakDuration: 20 } });
      
      await fireEvent.click(screen.getByRole('tab', { name: 'Long Break' }));
      
      expect(screen.getByText('20:00')).toBeInTheDocument();
    });
  });

  describe('minimized mode', () => {
    it('renders minimized view when minimized prop is true', () => {
      render(PomodoroWidget, { props: { minimized: true } });
      
      expect(screen.queryByText('🍅 Pomodoro')).not.toBeInTheDocument();
      expect(screen.getByText('25:00')).toBeInTheDocument();
    });

    it('toggles to minimized mode when minimize button is clicked', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
      
      expect(screen.queryByText('🍅 Pomodoro')).not.toBeInTheDocument();
    });

    it('expands from minimized mode when clicked', async () => {
      render(PomodoroWidget, { props: { minimized: true } });
      
      await fireEvent.click(screen.getByText('25:00'));
      
      expect(screen.getByText('🍅 Pomodoro')).toBeInTheDocument();
    });
  });

  describe('skip session', () => {
    it('skips to break after work session', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      
      expect(screen.getByText('Short Break')).toBeInTheDocument();
    });

    it('skips to work after break session', async () => {
      render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('tab', { name: 'Short Break' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      
      expect(screen.getByText('Focus Time')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper role for timer', () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });

    it('has aria-label for timer', () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Pomodoro Timer');
    });

    it('has proper aria-selected for tabs', async () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('tab', { name: 'Focus' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Short Break' })).toHaveAttribute('aria-selected', 'false');
    });

    it('control buttons have aria-labels', () => {
      render(PomodoroWidget);
      
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
  });

  describe('progress ring', () => {
    it('starts with 0% progress', () => {
      const { container } = render(PomodoroWidget);
      
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toHaveAttribute('stroke-dashoffset', '339.292');
    });

    it('updates progress as timer runs', async () => {
      const { container } = render(PomodoroWidget);
      
      await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      vi.advanceTimersByTime(750000); // 12.5 minutes = 50%
      
      await waitFor(() => {
        const progressBar = container.querySelector('.progress-bar');
        const offset = parseFloat(progressBar?.getAttribute('stroke-dashoffset') || '0');
        expect(offset).toBeLessThan(339.292);
      });
    });
  });
});
