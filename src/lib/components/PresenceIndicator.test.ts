import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import PresenceIndicator from './PresenceIndicator.svelte';

// Mock $lib/stores/presence
const mockGetPresence = vi.fn();

vi.mock('$lib/stores/presence', () => ({
  presenceStore: {
    subscribe: vi.fn((fn: (value: unknown) => void) => {
      fn(new Map());
      return () => {};
    }),
    getPresence: (...args: unknown[]) => mockGetPresence(...args),
    setStatus: vi.fn()
  },
  getStatusColor: (status: string) => {
    const colors: Record<string, string> = {
      online: '#3ba55c',
      idle: '#faa61a',
      dnd: '#ed4245',
      offline: '#747f8d',
      invisible: '#747f8d'
    };
    return colors[status] ?? '#747f8d';
  }
}));

describe('PresenceIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresence.mockReturnValue({
      userId: 'test-user',
      status: 'offline',
      activities: []
    });
  });

  // --- Status rendering ---

  it('renders online status with no inner element', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online' } });
    const indicator = container.querySelector('.presence-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator!.children.length).toBe(0);
  });

  it('renders idle status with idle-moon element', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'idle' } });
    const moon = container.querySelector('.idle-moon');
    expect(moon).toBeInTheDocument();
  });

  it('renders dnd status with dnd-dash element', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'dnd' } });
    const dash = container.querySelector('.dnd-dash');
    expect(dash).toBeInTheDocument();
  });

  it('renders offline status with offline-ring element', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'offline' } });
    const ring = container.querySelector('.offline-ring');
    expect(ring).toBeInTheDocument();
  });

  it('renders invisible status with offline-ring element', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'invisible' } });
    const ring = container.querySelector('.offline-ring');
    expect(ring).toBeInTheDocument();
  });

  // --- Correct colors in style ---

  it('applies correct color for online status', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online' } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    expect(indicator.getAttribute('style')).toContain('--color: #3ba55c');
  });

  it('applies correct color for dnd status', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'dnd' } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    expect(indicator.getAttribute('style')).toContain('--color: #ed4245');
  });

  // --- Size prop ---

  it('renders small size with correct style values', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online', size: 'sm' } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    const style = indicator.getAttribute('style')!;
    expect(style).toContain('--size: 8px');
    expect(style).toContain('--border: 2px');
  });

  it('renders medium size with correct style values', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online', size: 'md' } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    const style = indicator.getAttribute('style')!;
    expect(style).toContain('--size: 12px');
    expect(style).toContain('--border: 3px');
  });

  it('renders large size with correct style values', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online', size: 'lg' } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    const style = indicator.getAttribute('style')!;
    expect(style).toContain('--size: 16px');
    expect(style).toContain('--border: 3px');
  });

  // --- Tooltip ---

  it('shows capitalized status as title when showTooltip is true', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online', showTooltip: true } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    expect(indicator.getAttribute('title')).toBe('Online');
  });

  it('does not show title when showTooltip is false', () => {
    const { container } = render(PresenceIndicator, { props: { status: 'online', showTooltip: false } });
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    expect(indicator.getAttribute('title')).toBeNull();
  });

  // --- userId and presenceStore integration ---

  it('uses presenceStore.getPresence when userId is provided and no status prop', () => {
    mockGetPresence.mockReturnValue({
      userId: 'user-123',
      status: 'idle',
      activities: []
    });

    const { container } = render(PresenceIndicator, { props: { userId: 'user-123' } });
    expect(mockGetPresence).toHaveBeenCalledWith('user-123');
    const moon = container.querySelector('.idle-moon');
    expect(moon).toBeInTheDocument();
  });

  // --- Default behavior ---

  it('renders as offline when no props are provided', () => {
    const { container } = render(PresenceIndicator);
    const indicator = container.querySelector('.presence-indicator') as HTMLElement;
    const ring = container.querySelector('.offline-ring');
    expect(ring).toBeInTheDocument();
    expect(indicator.getAttribute('style')).toContain('--color: #747f8d');
    expect(indicator.getAttribute('title')).toBe('Offline');
  });
});
