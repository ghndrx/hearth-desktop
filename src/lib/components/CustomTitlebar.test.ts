import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CustomTitlebar from './CustomTitlebar.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    hide: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    isFullscreen: vi.fn().mockResolvedValue(false),
    listen: vi.fn().mockResolvedValue(() => {}),
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('$lib/stores/networkStatus', () => ({
  networkStatus: {
    subscribe: vi.fn((fn) => {
      fn({ isOnline: true, networkType: 'wifi' });
      return () => {};
    }),
    init: vi.fn(),
  },
}));

vi.mock('$lib/stores/syncStatus', () => ({
  syncStatus: {
    subscribe: vi.fn((fn) => {
      fn({ state: 'idle', pendingCount: 0 });
      return () => {};
    }),
  },
}));

vi.mock('$lib/stores/websocket', () => ({
  websocketStatus: {
    subscribe: vi.fn((fn) => {
      fn({ state: 'connected' });
      return () => {};
    }),
  },
}));

describe('CustomTitlebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders with default props', () => {
    render(CustomTitlebar);
    
    expect(screen.getByText('Hearth')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimize')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximize')).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });

  it('shows menu button by default', () => {
    render(CustomTitlebar);
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();
  });

  it('hides menu button when showMenuButton is false', () => {
    render(CustomTitlebar, { props: { showMenuButton: false } });
    expect(screen.queryByLabelText('Menu')).not.toBeInTheDocument();
  });

  it('renders app branding elements', () => {
    render(CustomTitlebar);
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('Hearth')).toBeInTheDocument();
  });

  it('has data-tauri-drag-region for draggable functionality', () => {
    render(CustomTitlebar);
    const titlebar = document.querySelector('.custom-titlebar');
    expect(titlebar).toHaveAttribute('data-tauri-drag-region', 'true');
  });

  it('applies custom class when provided', () => {
    render(CustomTitlebar, { props: { class: 'my-custom-class' } });
    const titlebar = document.querySelector('.custom-titlebar');
    expect(titlebar).toHaveClass('my-custom-class');
  });

  it('has correct window control buttons', () => {
    render(CustomTitlebar);
    
    const minimizeBtn = screen.getByLabelText('Minimize');
    const maximizeBtn = screen.getByLabelText('Maximize');
    const closeBtn = screen.getByLabelText('Close');
    
    expect(minimizeBtn).toBeInTheDocument();
    expect(maximizeBtn).toBeInTheDocument();
    expect(closeBtn).toBeInTheDocument();
  });

  it('shows connection status indicator', () => {
    render(CustomTitlebar);
    // Connection indicator should be present (title shows status)
    const connectionStatus = document.querySelector('.connection-status');
    expect(connectionStatus).toBeInTheDocument();
  });
});
