import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NetworkQualityIndicator from './NetworkQualityIndicator.svelte';

// Mock navigator
const mockNavigator = {
  onLine: true,
  connection: {
    type: 'wifi',
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true
});

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({});

// Mock performance.now
let mockTime = 0;
vi.spyOn(performance, 'now').mockImplementation(() => {
  mockTime += 30; // Simulate 30ms latency
  return mockTime;
});

describe('NetworkQualityIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockTime = 0;
    mockNavigator.onLine = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders quality badge', () => {
    render(NetworkQualityIndicator);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows quality label in non-compact mode', () => {
    render(NetworkQualityIndicator, { props: { compact: false } });
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies compact styling when compact prop is true', () => {
    const { container } = render(NetworkQualityIndicator, { props: { compact: true } });
    expect(container.querySelector('.network-quality-indicator.compact')).toBeInTheDocument();
  });

  it('shows details panel when showDetails is true and clicked', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Latency')).toBeInTheDocument();
      expect(screen.getByText('Jitter')).toBeInTheDocument();
      expect(screen.getByText('Packet Loss')).toBeInTheDocument();
    });
  });

  it('does not show details panel when showDetails is false', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: false } });
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    expect(screen.queryByText('Latency')).not.toBeInTheDocument();
  });

  it('shows offline status when navigator.onLine is false', async () => {
    mockNavigator.onLine = false;
    render(NetworkQualityIndicator);
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Offline')
      );
    });
  });

  it('calls onQualityChange when quality changes', async () => {
    const onQualityChange = vi.fn();
    render(NetworkQualityIndicator, { props: { onQualityChange } });
    
    await waitFor(() => {
      expect(onQualityChange).toHaveBeenCalled();
    });
  });

  it('displays connection type when available', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Connection')).toBeInTheDocument();
      expect(screen.getByText('4G')).toBeInTheDocument();
    });
  });

  it('displays bandwidth when available', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Bandwidth')).toBeInTheDocument();
    });
  });

  it('shows latency history graph in details panel', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Last 10 pings')).toBeInTheDocument();
    });
  });

  it('handles online event', async () => {
    mockNavigator.onLine = false;
    render(NetworkQualityIndicator);
    
    mockNavigator.onLine = true;
    window.dispatchEvent(new Event('online'));
    
    await waitFor(() => {
      expect(screen.getByRole('status')).not.toHaveAttribute(
        'aria-label',
        expect.stringContaining('Offline')
      );
    });
  });

  it('handles offline event', async () => {
    render(NetworkQualityIndicator);
    
    mockNavigator.onLine = false;
    window.dispatchEvent(new Event('offline'));
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Offline')
      );
    });
  });

  it('has proper accessibility attributes', () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('title');
  });

  it('uses custom ping interval', () => {
    render(NetworkQualityIndicator, { props: { pingInterval: 10000 } });
    // Component should accept custom interval without errors
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('toggles expanded state on click', async () => {
    render(NetworkQualityIndicator, { props: { showDetails: true } });
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    
    await fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
