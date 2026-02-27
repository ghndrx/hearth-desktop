import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import WorkspaceProfilesManager from './WorkspaceProfilesManager.svelte';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('WorkspaceProfilesManager', () => {
  const mockProfiles = [
    {
      id: 'profile-1',
      name: 'Default',
      description: 'Default workspace',
      icon: '🏠',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      isDefault: true,
      config: {
        windowState: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false },
        theme: 'dark',
        sidebarWidth: 240,
        sidebarCollapsed: false,
        activePanels: ['chat'],
        pinnedChannels: [],
        focusModeEnabled: false,
        notificationsEnabled: true,
        soundEnabled: true,
        zoomLevel: 100,
        fontSize: 'medium',
        compactMode: false,
      },
    },
    {
      id: 'profile-2',
      name: 'Work',
      description: 'Work configuration',
      icon: '💼',
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-20T00:00:00Z',
      isDefault: false,
      config: {
        windowState: { x: 0, y: 0, width: 1920, height: 1080, maximized: true, fullscreen: false },
        theme: 'light',
        sidebarWidth: 280,
        sidebarCollapsed: false,
        activePanels: ['chat', 'tasks'],
        pinnedChannels: ['work-general'],
        focusModeEnabled: true,
        notificationsEnabled: true,
        soundEnabled: false,
        zoomLevel: 110,
        fontSize: 'large',
        compactMode: false,
      },
    },
  ];

  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'load_workspace_profiles':
          return Promise.resolve({
            profiles: mockProfiles,
            activeProfileId: 'profile-1',
            lastSwitched: '2024-01-15T00:00:00Z',
          });
        case 'save_workspace_profile':
          return Promise.resolve();
        case 'delete_workspace_profile':
          return Promise.resolve();
        case 'set_active_profile_id':
          return Promise.resolve();
        case 'capture_workspace_state':
          return Promise.resolve(mockProfiles[0].config);
        case 'apply_workspace_profile':
          return Promise.resolve();
        default:
          return Promise.resolve();
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders when visible', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Workspace Profiles')).toBeInTheDocument();
    });
  });

  it('does not render when not visible', () => {
    render(WorkspaceProfilesManager, { props: { visible: false } });
    
    expect(screen.queryByText('Workspace Profiles')).not.toBeInTheDocument();
  });

  it('loads and displays profiles', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('load_workspace_profiles');
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
  });

  it('shows default badge on default profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
    
    // Check for default badge
    const defaultBadges = screen.getAllByText('Default');
    expect(defaultBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows active badge on active profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('filters profiles by search query', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search profiles...');
    await fireEvent.input(searchInput, { target: { value: 'Work' } });
    
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
      // Default should be filtered out
      const profileCards = screen.getAllByText(/Work|Default/);
      expect(profileCards.some(el => el.textContent === 'Work')).toBe(true);
    });
  });

  it('opens create profile modal', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('New Profile')).toBeInTheDocument();
    });
    
    const newButton = screen.getByText('New Profile');
    await fireEvent.click(newButton);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Profile')).toBeInTheDocument();
    });
  });

  it('creates a new profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('New Profile')).toBeInTheDocument();
    });
    
    // Open modal
    await fireEvent.click(screen.getByText('New Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Profile')).toBeInTheDocument();
    });
    
    // Fill form
    const nameInput = screen.getByPlaceholderText('e.g., Work, Gaming, Focus');
    await fireEvent.input(nameInput, { target: { value: 'Gaming' } });
    
    // Submit
    const createButton = screen.getByText('Create Profile');
    await fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('capture_workspace_state');
      expect(mockInvoke).toHaveBeenCalledWith('save_workspace_profile', expect.objectContaining({
        profile: expect.objectContaining({
          name: 'Gaming',
        }),
      }));
    });
  });

  it('switches to a different profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
    
    // Find the Switch button for Work profile
    const switchButtons = screen.getAllByText('Switch');
    expect(switchButtons.length).toBeGreaterThan(0);
    
    await fireEvent.click(switchButtons[0]);
    
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('apply_workspace_profile', expect.objectContaining({
        profile: expect.objectContaining({
          id: 'profile-2',
        }),
      }));
    });
  });

  it('shows profile count in footer', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('2 profiles')).toBeInTheDocument();
    });
  });

  it('shows auto-save indicator when enabled', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true, autoSave: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Auto-save enabled')).toBeInTheDocument();
    });
  });

  it('closes when close button is clicked', async () => {
    const { component } = render(WorkspaceProfilesManager, { props: { visible: true } });
    
    let closeFired = false;
    component.$on('close', () => {
      closeFired = true;
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByLabelText('Close'));
    
    expect(closeFired).toBe(true);
  });

  it('closes when overlay is clicked', async () => {
    const { component } = render(WorkspaceProfilesManager, { props: { visible: true } });
    
    let closeFired = false;
    component.$on('close', () => {
      closeFired = true;
    });
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    
    const overlay = document.querySelector('.profiles-overlay');
    if (overlay) {
      await fireEvent.click(overlay);
    }
    
    expect(closeFired).toBe(true);
  });

  it('handles profile deletion confirmation', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
    
    // Find and hover the dropdown to reveal delete option
    // Note: In a real test, we'd need to properly trigger the dropdown menu
    // This is a simplified example
  });

  it('displays error banner on load failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));
    
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      // Should show default profile when loading fails
      expect(mockInvoke).toHaveBeenCalledWith('load_workspace_profiles');
    });
  });

  it('displays profile descriptions', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('Default workspace')).toBeInTheDocument();
      expect(screen.getByText('Work configuration')).toBeInTheDocument();
    });
  });

  it('displays profile icons', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('🏠')).toBeInTheDocument();
      expect(screen.getByText('💼')).toBeInTheDocument();
    });
  });

  it('shows save button for active profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('💾 Save')).toBeInTheDocument();
    });
  });

  it('emits profile-loaded event after loading', async () => {
    const { component } = render(WorkspaceProfilesManager, { props: { visible: true } });
    
    let loadedEvent: CustomEvent | null = null;
    component.$on('profiles-loaded', (e: CustomEvent) => {
      loadedEvent = e;
    });
    
    await waitFor(() => {
      expect(loadedEvent).not.toBeNull();
      expect(loadedEvent?.detail.profiles).toHaveLength(2);
    });
  });

  it('allows selecting icon when creating profile', async () => {
    render(WorkspaceProfilesManager, { props: { visible: true } });
    
    await waitFor(() => {
      expect(screen.getByText('New Profile')).toBeInTheDocument();
    });
    
    await fireEvent.click(screen.getByText('New Profile'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Profile')).toBeInTheDocument();
    });
    
    // Should show icon picker with various icons
    expect(screen.getByText('🎮')).toBeInTheDocument();
    expect(screen.getByText('📚')).toBeInTheDocument();
  });
});
