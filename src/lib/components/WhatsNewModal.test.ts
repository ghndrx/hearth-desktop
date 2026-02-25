import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WhatsNewModal from './WhatsNewModal.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === 'get_last_seen_version') {
      return Promise.resolve('0.8.0');
    }
    if (cmd === 'set_last_seen_version') {
      return Promise.resolve();
    }
    return Promise.resolve();
  }),
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: vi.fn().mockResolvedValue('0.9.0'),
}));

describe('WhatsNewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when show is true', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    // Wait for mount
    await vi.waitFor(() => {
      expect(screen.getByText("What's New in Hearth")).toBeInTheDocument();
    });
  });

  it('displays version list', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('v0.9.0')).toBeInTheDocument();
      expect(screen.getByText('v0.8.0')).toBeInTheDocument();
      expect(screen.getByText('v0.7.0')).toBeInTheDocument();
    });
  });

  it('shows NEW badge for unseen versions', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      const newBadges = screen.getAllByText('NEW');
      expect(newBadges.length).toBeGreaterThan(0);
    });
  });

  it('displays highlights section', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('✨ Highlights')).toBeInTheDocument();
    });
  });

  it('displays features section', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('🚀 New Features')).toBeInTheDocument();
    });
  });

  it('displays bug fixes section', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('🐛 Bug Fixes')).toBeInTheDocument();
    });
  });

  it('has Got It button when there are unseen updates', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Got It!')).toBeInTheDocument();
    });
  });

  it('has Maybe Later button', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Maybe Later')).toBeInTheDocument();
    });
  });

  it('switches version when clicking on version item', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('v0.8.0')).toBeInTheDocument();
    });
    
    const v08Button = screen.getByText('v0.8.0').closest('button');
    if (v08Button) {
      await fireEvent.click(v08Button);
    }
    
    // Should show v0.8.0 content
    await vi.waitFor(() => {
      expect(screen.getByText('Version 0.8.0')).toBeInTheDocument();
    });
  });

  it('calls set_last_seen_version on acknowledge', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Got It!')).toBeInTheDocument();
    });
    
    const gotItButton = screen.getByText('Got It!');
    await fireEvent.click(gotItButton);
    
    expect(invoke).toHaveBeenCalledWith('set_last_seen_version', { version: '0.9.0' });
  });

  it('dispatches close event on Maybe Later', async () => {
    const { component } = render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    let closeCalled = false;
    component.$on('close', () => {
      closeCalled = true;
    });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Maybe Later')).toBeInTheDocument();
    });
    
    const maybeLaterButton = screen.getByText('Maybe Later');
    await fireEvent.click(maybeLaterButton);
    
    expect(closeCalled).toBe(true);
  });

  it('does not render when show is false', () => {
    render(WhatsNewModal, { props: { show: false } });
    
    expect(screen.queryByText("What's New in Hearth")).not.toBeInTheDocument();
  });

  it('displays current version in header', async () => {
    render(WhatsNewModal, { props: { show: true, forceShow: true } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('Version 0.9.0')).toBeInTheDocument();
    });
  });
});
