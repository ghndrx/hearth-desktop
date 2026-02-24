import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import BatteryIndicator from './BatteryIndicator.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('BatteryIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render battery percentage when available', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 75,
      time_remaining: '3:30',
      is_power_save_mode: false,
    });

    render(BatteryIndicator);
    
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  it('should show charging indicator when charging', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: true,
      is_charging: true,
      battery_percentage: 50,
      time_remaining: '1:00',
      is_power_save_mode: false,
    });

    render(BatteryIndicator);
    
    await waitFor(() => {
      const batteryIcon = screen.getByRole('img');
      expect(batteryIcon).toHaveAttribute('aria-label', expect.stringContaining('Charging'));
    });
  });

  it('should show power plug for desktop without battery', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: true,
      is_charging: false,
      battery_percentage: null,
      time_remaining: null,
      is_power_save_mode: false,
    });

    render(BatteryIndicator);
    
    await waitFor(() => {
      // Should not show percentage
      expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
    });
  });

  it('should show low battery warning when below threshold', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 15,
      time_remaining: '0:45',
      is_power_save_mode: false,
    });

    render(BatteryIndicator, { props: { lowBatteryThreshold: 20 } });
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Low Battery')).toBeInTheDocument();
    });
  });

  it('should dismiss low battery warning when clicking dismiss', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 15,
      time_remaining: '0:45',
      is_power_save_mode: false,
    });

    render(BatteryIndicator, { props: { lowBatteryThreshold: 20 } });
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Dismiss warning');
    await fireEvent.click(dismissButton);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should not show warning when charging', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: true,
      is_charging: true,
      battery_percentage: 10,
      time_remaining: '2:00',
      is_power_save_mode: false,
    });

    render(BatteryIndicator, { props: { lowBatteryThreshold: 20 } });
    
    // Wait a tick for the component to mount
    await waitFor(() => {
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    // Should not show warning because we're charging
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should hide percentage when showPercentage is false', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 80,
      time_remaining: '4:00',
      is_power_save_mode: false,
    });

    render(BatteryIndicator, { props: { showPercentage: false } });
    
    await waitFor(() => {
      // Battery icon should exist but no percentage text
      const batteryIcon = screen.getByRole('img');
      expect(batteryIcon).toBeInTheDocument();
    });

    expect(screen.queryByText('80%')).not.toBeInTheDocument();
  });

  it('should poll for power status every 60 seconds', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 90,
      time_remaining: '5:00',
      is_power_save_mode: false,
    });

    render(BatteryIndicator);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_power_status');
    });

    // Initial call
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Advance 60 seconds
    vi.advanceTimersByTime(60000);
    
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('should apply critical color for very low battery', async () => {
    mockInvoke.mockResolvedValue({
      is_ac_power: false,
      is_charging: false,
      battery_percentage: 5,
      time_remaining: '0:15',
      is_power_save_mode: false,
    });

    render(BatteryIndicator, { props: { criticalBatteryThreshold: 10 } });
    
    await waitFor(() => {
      expect(screen.getByText('5%')).toBeInTheDocument();
    });

    // Should have pulse animation for low battery
    const indicator = document.querySelector('.battery-indicator');
    expect(indicator).toHaveClass('low');
  });
});
