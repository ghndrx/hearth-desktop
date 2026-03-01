import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import EyeCareReminder from './EyeCareReminder.svelte';

describe('EyeCareReminder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock Notification API
    global.Notification = vi.fn() as any;
    (global.Notification as any).permission = 'granted';
    (global.Notification as any).requestPermission = vi.fn().mockResolvedValue('granted');
    
    // Mock AudioContext
    const mockOscillator = {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    global.AudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: () => mockOscillator,
      createGain: () => mockGainNode,
      destination: {},
      currentTime: 0,
    })) as any;
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  it('renders with default state', () => {
    render(EyeCareReminder);
    expect(screen.getByText('Eye Care')).toBeInTheDocument();
  });
  
  it('shows timer when enabled', () => {
    render(EyeCareReminder, { props: { enabled: true } });
    expect(screen.getByText('until break')).toBeInTheDocument();
  });
  
  it('displays correct initial time based on workInterval', () => {
    render(EyeCareReminder, { props: { workInterval: 20, enabled: true } });
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });
  
  it('counts down the timer', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, enabled: true } });
    
    // Initial time
    expect(screen.getByText('1:00')).toBeInTheDocument();
    
    // Advance 10 seconds
    vi.advanceTimersByTime(10000);
    await waitFor(() => {
      expect(screen.getByText('0:50')).toBeInTheDocument();
    });
  });
  
  it('triggers break after work interval', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, breakDuration: 5, enabled: true } });
    
    // Advance past work interval
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(screen.getByText('Look Away!')).toBeInTheDocument();
    });
  });
  
  it('shows break countdown during break', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, breakDuration: 20, enabled: true } });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(screen.getByText('20s')).toBeInTheDocument();
    });
  });
  
  it('can skip break', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, breakDuration: 20, enabled: true } });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });
    
    const skipButton = screen.getByText('Skip');
    await fireEvent.click(skipButton);
    
    await waitFor(() => {
      expect(screen.getByText('until break')).toBeInTheDocument();
    });
  });
  
  it('increments session count after break completes', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, breakDuration: 5, enabled: true } });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    // Complete break
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('breaks today')).toBeInTheDocument();
    });
  });
  
  it('can pause and resume timer', async () => {
    render(EyeCareReminder, { props: { workInterval: 20, enabled: true } });
    
    // Find pause button (⏸️)
    const pauseButton = screen.getByText('⏸️');
    await fireEvent.click(pauseButton);
    
    // Should now show play button
    await waitFor(() => {
      expect(screen.getByText('▶️')).toBeInTheDocument();
    });
    
    // Time should not advance while paused
    const timeBefore = screen.getByText('20:00');
    vi.advanceTimersByTime(5000);
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });
  
  it('can reset timer', async () => {
    render(EyeCareReminder, { props: { workInterval: 20, enabled: true } });
    
    // Advance some time
    vi.advanceTimersByTime(10000);
    
    await waitFor(() => {
      expect(screen.getByText('19:50')).toBeInTheDocument();
    });
    
    // Find reset button
    const resetButton = screen.getByText('🔄');
    await fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(screen.getByText('20:00')).toBeInTheDocument();
    });
  });
  
  it('can toggle enabled state', async () => {
    render(EyeCareReminder, { props: { enabled: true } });
    
    // Find power button (green circle when active)
    const powerButton = screen.getByTitle('Disable');
    await fireEvent.click(powerButton);
    
    await waitFor(() => {
      expect(screen.getByText('Eye care reminders disabled')).toBeInTheDocument();
    });
  });
  
  it('shows settings panel when settings button clicked', async () => {
    render(EyeCareReminder, { props: { enabled: true } });
    
    const settingsButton = screen.getByTitle('Settings');
    await fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Work interval (min)')).toBeInTheDocument();
      expect(screen.getByText('Break duration (sec)')).toBeInTheDocument();
      expect(screen.getByText('Sound alerts')).toBeInTheDocument();
      expect(screen.getByText('System notifications')).toBeInTheDocument();
    });
  });
  
  it('sends notification when break starts', async () => {
    render(EyeCareReminder, { 
      props: { 
        workInterval: 1, 
        breakDuration: 5, 
        enabled: true,
        notificationEnabled: true 
      } 
    });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(global.Notification).toHaveBeenCalledWith(
        '👁️ Eye Care Reminder',
        expect.objectContaining({
          body: 'Look at something 20 feet away for 20 seconds'
        })
      );
    });
  });
  
  it('displays disabled message when not enabled', () => {
    render(EyeCareReminder, { props: { enabled: false } });
    
    expect(screen.getByText('Eye care reminders disabled')).toBeInTheDocument();
    expect(screen.getByText('Click the power button to enable')).toBeInTheDocument();
  });
  
  it('initializes with custom work interval', () => {
    render(EyeCareReminder, { props: { workInterval: 30, enabled: true } });
    expect(screen.getByText('30:00')).toBeInTheDocument();
  });
  
  it('displays break progress correctly', async () => {
    render(EyeCareReminder, { props: { workInterval: 1, breakDuration: 20, enabled: true } });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(screen.getByText('Look Away!')).toBeInTheDocument();
      expect(screen.getByText('Focus on something 20ft away')).toBeInTheDocument();
    });
  });
  
  it('plays sound when enabled', async () => {
    render(EyeCareReminder, { 
      props: { 
        workInterval: 1, 
        breakDuration: 5, 
        enabled: true,
        soundEnabled: true 
      } 
    });
    
    // Trigger break
    vi.advanceTimersByTime(60000);
    
    await waitFor(() => {
      expect(global.AudioContext).toHaveBeenCalled();
    });
  });
});
