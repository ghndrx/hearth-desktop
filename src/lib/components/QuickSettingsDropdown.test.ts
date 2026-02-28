import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import QuickSettingsDropdown from './QuickSettingsDropdown.svelte';

describe('QuickSettingsDropdown', () => {
  let mockAnchor: HTMLElement;

  beforeEach(() => {
    mockAnchor = document.createElement('button');
    mockAnchor.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 100,
      bottom: 140,
      right: 200,
      width: 100,
      height: 40,
      x: 100,
      y: 100,
      toJSON: () => ({})
    }));
    document.body.appendChild(mockAnchor);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.removeChild(mockAnchor);
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Quick Settings')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: false, anchorElement: mockAnchor }
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays all setting groups', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Audio & Notifications')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('displays all settings items', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
    expect(screen.getByText('Auto Away')).toBeInTheDocument();
    expect(screen.getByText('Streamer Mode')).toBeInTheDocument();
    expect(screen.getByText('Sounds')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('Compact Mode')).toBeInTheDocument();
  });

  it('toggles settings on click', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const changeHandler = vi.fn();
    component.$on('change', changeHandler);

    const dndButton = screen.getByText('Do Not Disturb').closest('button');
    expect(dndButton).toBeInTheDocument();
    
    await fireEvent.click(dndButton!);

    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { key: 'doNotDisturb', value: true }
      })
    );
  });

  it('persists settings to localStorage', async () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const dndButton = screen.getByText('Do Not Disturb').closest('button');
    await fireEvent.click(dndButton!);

    const saved = JSON.parse(localStorage.getItem('hearth-quick-settings') || '{}');
    expect(saved.doNotDisturb).toBe(true);
  });

  it('displays volume slider', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByLabelText('Volume')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('emits volumeChange on slider input', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const volumeHandler = vi.fn();
    component.$on('volumeChange', volumeHandler);

    const slider = screen.getByLabelText('Volume');
    await fireEvent.input(slider, { target: { value: '50' } });

    expect(volumeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { volume: 50 }
      })
    );
  });

  it('toggles mic mute', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const micHandler = vi.fn();
    component.$on('micToggle', micHandler);

    const micButton = screen.getByLabelText('Mute microphone');
    await fireEvent.click(micButton);

    expect(micHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { muted: true }
      })
    );
  });

  it('toggles speaker mute', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const speakerHandler = vi.fn();
    component.$on('speakerToggle', speakerHandler);

    const speakerButton = screen.getByLabelText('Mute speaker');
    await fireEvent.click(speakerButton);

    expect(speakerHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { muted: true }
      })
    );
  });

  it('emits close event on close button click', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const closeHandler = vi.fn();
    component.$on('close', closeHandler);

    const closeButton = screen.getByLabelText('Close');
    await fireEvent.click(closeButton);

    expect(closeHandler).toHaveBeenCalled();
  });

  it('shows all settings button', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    expect(screen.getByText('All Settings')).toBeInTheDocument();
  });

  it('emits openSettings event on all settings click', async () => {
    const { component } = render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const settingsHandler = vi.fn();
    component.$on('openSettings', settingsHandler);

    const allSettingsBtn = screen.getByText('All Settings').closest('button');
    await fireEvent.click(allSettingsBtn!);

    expect(settingsHandler).toHaveBeenCalled();
  });

  it('loads saved settings from localStorage', async () => {
    localStorage.setItem('hearth-quick-settings', JSON.stringify({
      doNotDisturb: true,
      compactMode: true
    }));

    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    // Settings should reflect saved state via aria-pressed
    const dndButton = screen.getByText('Do Not Disturb').closest('button');
    expect(dndButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('hearth-quick-settings', 'invalid-json');

    expect(() => {
      render(QuickSettingsDropdown, {
        props: { isOpen: true, anchorElement: mockAnchor }
      });
    }).not.toThrow();
  });

  it('has proper accessibility attributes', () => {
    render(QuickSettingsDropdown, {
      props: { isOpen: true, anchorElement: mockAnchor }
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Quick Settings');

    // Check toggle buttons have aria-pressed
    const toggleButtons = screen.getAllByRole('button', { pressed: false });
    expect(toggleButtons.length).toBeGreaterThan(0);
  });
});
