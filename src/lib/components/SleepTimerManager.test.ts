import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import SleepTimerManager from './SleepTimerManager.svelte';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

describe('SleepTimerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders setup view when timer is inactive', () => {
    render(SleepTimerManager);

    expect(screen.getByText('💤 Sleep Timer')).toBeInTheDocument();
    expect(screen.getByText('15 minutes')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('1 hour')).toBeInTheDocument();
  });

  it('shows all preset options', () => {
    render(SleepTimerManager);

    expect(screen.getByText('15 minutes')).toBeInTheDocument();
    expect(screen.getByText('30 minutes')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('1 hour')).toBeInTheDocument();
    expect(screen.getByText('1.5 hours')).toBeInTheDocument();
    expect(screen.getByText('2 hours')).toBeInTheDocument();
  });

  it('starts timer when preset is clicked', async () => {
    const { component } = render(SleepTimerManager);

    const timerStartHandler = vi.fn();
    component.$on('timerStart', timerStartHandler);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    expect(timerStartHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { duration: 15, action: 'pause_media' }
      })
    );
  });

  it('displays countdown when timer is active', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    // Should show timer display
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('decrements timer correctly', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    expect(screen.getByText('15:00')).toBeInTheDocument();

    // Advance 10 seconds
    vi.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(screen.getByText('14:50')).toBeInTheDocument();
    });
  });

  it('shows cancel button when timer is active', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    expect(screen.getByText('✕ Cancel')).toBeInTheDocument();
  });

  it('stops timer when cancel is clicked', async () => {
    const { component } = render(SleepTimerManager);

    const timerStopHandler = vi.fn();
    component.$on('timerStop', timerStopHandler);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    const cancelBtn = screen.getByText('✕ Cancel');
    await fireEvent.click(cancelBtn);

    expect(timerStopHandler).toHaveBeenCalled();
    expect(screen.getByText('💤 Sleep Timer')).toBeInTheDocument();
  });

  it('extends timer when +5m is clicked', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    expect(screen.getByText('15:00')).toBeInTheDocument();

    const extendBtn = screen.getByText('+5m');
    await fireEvent.click(extendBtn);

    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('extends timer when +15m is clicked', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    const extendBtn = screen.getByText('+15m');
    await fireEvent.click(extendBtn);

    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('shows action selector', async () => {
    render(SleepTimerManager);

    const actionToggle = screen.getByText('Pause Media');
    await fireEvent.click(actionToggle);

    expect(screen.getByText('Lock Screen')).toBeInTheDocument();
    expect(screen.getByText('Minimize')).toBeInTheDocument();
    expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
    expect(screen.getByText('Quit App')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('changes action when selected', async () => {
    render(SleepTimerManager);

    // Open action selector
    let actionToggle = screen.getByText('Pause Media');
    await fireEvent.click(actionToggle);

    // Select lock screen
    const lockOption = screen.getAllByText('Lock Screen')[0];
    await fireEvent.click(lockOption);

    // Verify action changed
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });

  it('shows custom duration input when clicked', async () => {
    render(SleepTimerManager);

    const customBtn = screen.getByText('⏱️ Custom duration...');
    await fireEvent.click(customBtn);

    expect(screen.getByPlaceholderText('Minutes')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('starts custom duration timer', async () => {
    const { component } = render(SleepTimerManager);

    const timerStartHandler = vi.fn();
    component.$on('timerStart', timerStartHandler);

    // Show custom input
    const customBtn = screen.getByText('⏱️ Custom duration...');
    await fireEvent.click(customBtn);

    // Enter custom duration
    const input = screen.getByPlaceholderText('Minutes');
    await fireEvent.input(input, { target: { value: '25' } });

    // Start timer
    const startBtn = screen.getByText('Start');
    await fireEvent.click(startBtn);

    expect(timerStartHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { duration: 25, action: 'pause_media' }
      })
    );

    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('hides presets when showPresets is false', () => {
    render(SleepTimerManager, { props: { showPresets: false } });

    expect(screen.queryByText('15 minutes')).not.toBeInTheDocument();
    expect(screen.queryByText('30 minutes')).not.toBeInTheDocument();
  });

  it('hides custom duration when allowCustomDuration is false', () => {
    render(SleepTimerManager, { props: { allowCustomDuration: false } });

    expect(screen.queryByText('⏱️ Custom duration...')).not.toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    const { container } = render(SleepTimerManager, { props: { compact: true } });

    expect(container.querySelector('.compact')).toBeInTheDocument();
  });

  it('shows warning state when time is low', async () => {
    const { container } = render(SleepTimerManager, {
      props: { warningThreshold: 60 }
    });

    // Start a 1 minute timer (it will be in warning immediately after 0 seconds)
    const customBtn = screen.getByText('⏱️ Custom duration...');
    await fireEvent.click(customBtn);

    const input = screen.getByPlaceholderText('Minutes');
    await fireEvent.input(input, { target: { value: '1' } });

    const startBtn = screen.getByText('Start');
    await fireEvent.click(startBtn);

    // Should show warning immediately since 60 seconds <= 60 second threshold
    await waitFor(() => {
      expect(container.querySelector('.warning')).toBeInTheDocument();
    });
  });

  it('shows custom command input when custom action is selected', async () => {
    render(SleepTimerManager);

    // Open action selector
    const actionToggle = screen.getByText('Pause Media');
    await fireEvent.click(actionToggle);

    // Select custom
    const customOption = screen.getByText('Custom');
    await fireEvent.click(customOption);

    // Should show command input
    expect(screen.getByPlaceholderText('Enter command to run...')).toBeInTheDocument();
  });

  it('formats hours correctly', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('2 hours');
    await fireEvent.click(preset);

    expect(screen.getByText('2:00:00')).toBeInTheDocument();
  });

  it('emits timerComplete when timer finishes', async () => {
    const { component } = render(SleepTimerManager);

    const timerCompleteHandler = vi.fn();
    component.$on('timerComplete', timerCompleteHandler);

    // Start a very short timer by using custom input
    const customBtn = screen.getByText('⏱️ Custom duration...');
    await fireEvent.click(customBtn);

    const input = screen.getByPlaceholderText('Minutes');
    await fireEvent.input(input, { target: { value: '1' } });

    const startBtn = screen.getByText('Start');
    await fireEvent.click(startBtn);

    // Advance to end of timer
    vi.advanceTimersByTime(60000);

    await waitFor(() => {
      expect(timerCompleteHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { action: 'pause_media' }
        })
      );
    });
  });

  it('displays action icon during active timer', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    // Should show pause media icon
    expect(screen.getByText('⏸️')).toBeInTheDocument();
  });

  it('displays action label during active timer', async () => {
    render(SleepTimerManager);

    const preset = screen.getByText('15 minutes');
    await fireEvent.click(preset);

    // Should show action label in timer info
    expect(screen.getByText('Pause Media')).toBeInTheDocument();
  });
});
