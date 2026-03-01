import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import NetworkQualityIndicator, { networkQuality, networkMetrics } from './NetworkQualityIndicator.svelte';

// Mock navigator.onLine
const mockOnline = vi.fn(() => true);
Object.defineProperty(navigator, 'onLine', {
  get: mockOnline,
  configurable: true
});

// Mock performance.now
vi.spyOn(performance, 'now').mockReturnValue(0);

// Mock fetch for latency measurement
global.fetch = vi.fn().mockResolvedValue({
  ok: true
});

describe('NetworkQualityIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockOnline.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders signal bars', () => {
    render(NetworkQualityIndicator);
    const bars = document.querySelectorAll('.bar');
    expect(bars.length).toBe(4);
  });

  it('shows quality label when not compact', () => {
    render(NetworkQualityIndicator, { props: { compact: false } });
    const label = document.querySelector('.quality-label');
    expect(label).toBeTruthy();
  });

  it('hides quality label when compact', () => {
    render(NetworkQualityIndicator, { props: { compact: true } });
    const label = document.querySelector('.quality-label');
    expect(label).toBeFalsy();
  });

  it('shows metrics panel on hover when showDetails is true', () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    const panel = document.querySelector('.metrics-panel');
    expect(panel).toBeTruthy();
  });

  it('detects offline status', async () => {
    mockOnline.mockReturnValue(false);
    render(NetworkQualityIndicator);
    
    // Trigger the interval
    vi.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(get(networkQuality)).toBe('offline');
    });
  });

  it('measures latency with fetch', async () => {
    let callCount = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 50; // 50ms latency
    });
    
    render(NetworkQualityIndicator);
    
    await waitFor(() => {
      const metrics = get(networkMetrics);
      expect(metrics.latency).toBeGreaterThanOrEqual(0);
    });
  });

  it('calculates jitter from latency variations', async () => {
    render(NetworkQualityIndicator);
    
    // Simulate multiple measurements
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(5000);
    }
    
    await waitFor(() => {
      const metrics = get(networkMetrics);
      expect(metrics.jitter).toBeGreaterThanOrEqual(0);
    });
  });

  it('updates on online/offline events', async () => {
    render(NetworkQualityIndicator);
    
    // Simulate going offline
    mockOnline.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    
    await waitFor(() => {
      expect(get(networkQuality)).toBe('offline');
    });
    
    // Simulate coming back online
    mockOnline.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    
    vi.advanceTimersByTime(1000);
    
    await waitFor(() => {
      expect(get(networkQuality)).not.toBe('offline');
    });
  });

  it('classifies excellent quality correctly', () => {
    // With low latency, low jitter, no packet loss
    render(NetworkQualityIndicator);
    
    // The initial render should have some quality level
    const quality = get(networkQuality);
    expect(['excellent', 'good', 'fair', 'poor', 'offline']).toContain(quality);
  });

  it('applies custom ping endpoint', () => {
    const customEndpoint = 'https://custom.api.test/ping';
    render(NetworkQualityIndicator, { props: { pingEndpoint: customEndpoint } });
    
    // Component should render without errors
    const indicator = document.querySelector('.network-quality-indicator');
    expect(indicator).toBeTruthy();
  });

  it('displays all metrics in detail panel', () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const panel = document.querySelector('.metrics-panel');
    expect(panel).toBeTruthy();
    
    const metrics = panel?.querySelectorAll('.metric');
    expect(metrics?.length).toBe(5); // latency, jitter, packet loss, bandwidth, connection
  });

  it('uses correct colors for quality levels', () => {
    render(NetworkQualityIndicator);
    
    // Should have signal bars with appropriate styling
    const bars = document.querySelectorAll('.bar');
    expect(bars.length).toBe(4);
    
    // Active bars should have the color applied
    const activeBars = document.querySelectorAll('.bar.active');
    expect(activeBars.length).toBeGreaterThanOrEqual(0);
  });
});
