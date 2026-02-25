import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NativeNotificationManager from './NativeNotificationManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue('granted'),
  sendNotification: vi.fn()
}));

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('/mock/app/data')
}));

vi.mock('$lib/stores/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('NativeNotificationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the component', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Desktop Notifications')).toBeInTheDocument();
    });
  });

  it('shows permission status as granted when permission is granted', async () => {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    (isPermissionGranted as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Notifications enabled')).toBeInTheDocument();
    });
  });

  it('shows enable button when permission is not granted', async () => {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    (isPermissionGranted as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Notifications disabled')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });
  });

  it('requests permission when enable button is clicked', async () => {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    (isPermissionGranted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');

    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    
    expect(requestPermission).toHaveBeenCalled();
  });

  it('renders notification category toggles', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Mentions')).toBeInTheDocument();
      expect(screen.getByText('Direct Messages')).toBeInTheDocument();
      expect(screen.getByText('Reactions')).toBeInTheDocument();
      expect(screen.getByText('System Alerts')).toBeInTheDocument();
      expect(screen.getByText('App Updates')).toBeInTheDocument();
    });
  });

  it('renders quiet hours settings', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
      expect(screen.getByText('Enable quiet hours')).toBeInTheDocument();
    });
  });

  it('shows time inputs when quiet hours is enabled', async () => {
    render(NativeNotificationManager, {
      props: {
        preferences: {
          enabled: true,
          showPreview: true,
          groupByConversation: true,
          maxNotifications: 5,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          categories: {
            messages: true,
            mentions: true,
            directMessages: true,
            reactions: true,
            systemAlerts: true,
            updates: true
          },
          sound: {
            enabled: true,
            volume: 0.8,
            customSoundPath: null
          },
          badge: {
            enabled: true,
            showCount: true
          }
        }
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('To')).toBeInTheDocument();
    });
  });

  it('renders sound settings', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Sound')).toBeInTheDocument();
      expect(screen.getByText('Enable notification sound')).toBeInTheDocument();
    });
  });

  it('shows volume slider when sound is enabled', async () => {
    render(NativeNotificationManager, {
      props: {
        preferences: {
          enabled: true,
          showPreview: true,
          groupByConversation: true,
          maxNotifications: 5,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          categories: {
            messages: true,
            mentions: true,
            directMessages: true,
            reactions: true,
            systemAlerts: true,
            updates: true
          },
          sound: {
            enabled: true,
            volume: 0.8,
            customSoundPath: null
          },
          badge: {
            enabled: true,
            showCount: true
          }
        }
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  it('renders badge settings', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Badge')).toBeInTheDocument();
      expect(screen.getByText('Show badge on dock icon')).toBeInTheDocument();
      expect(screen.getByText('Show unread count')).toBeInTheDocument();
    });
  });

  it('renders action buttons', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send Test Notification/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Clear History/i })).toBeInTheDocument();
    });
  });

  it('sends test notification when button is clicked', async () => {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    const { invoke } = await import('@tauri-apps/api/core');

    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Send Test Notification/i })).toBeInTheDocument();
    });

    const testButton = screen.getByRole('button', { name: /Send Test Notification/i });
    await fireEvent.click(testButton);
    
    await waitFor(() => {
      expect(sendNotification).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Notification'
      }));
    });
  });

  it('saves preferences to localStorage when changed', async () => {
    render(NativeNotificationManager);
    
    await waitFor(() => {
      expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });

    const toggles = screen.getAllByRole('checkbox');
    const enableToggle = toggles[0];
    
    await fireEvent.click(enableToggle);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'hearth_notification_preferences',
      expect.any(String)
    );
  });

  it('loads preferences from localStorage on mount', async () => {
    const savedPrefs = {
      enabled: false,
      showPreview: false,
      categories: {
        messages: false,
        mentions: true,
        directMessages: true,
        reactions: false,
        systemAlerts: true,
        updates: false
      }
    };
    
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPrefs));
    
    render(NativeNotificationManager);
    
    expect(localStorageMock.getItem).toHaveBeenCalledWith('hearth_notification_preferences');
  });

  it('disables category toggles when notifications are disabled', async () => {
    render(NativeNotificationManager, {
      props: {
        preferences: {
          enabled: false,
          showPreview: true,
          groupByConversation: true,
          maxNotifications: 5,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          categories: {
            messages: true,
            mentions: true,
            directMessages: true,
            reactions: true,
            systemAlerts: true,
            updates: true
          },
          sound: {
            enabled: true,
            volume: 0.8,
            customSoundPath: null
          },
          badge: {
            enabled: true,
            showCount: true
          }
        }
      }
    });
    
    await waitFor(() => {
      const toggles = screen.getAllByRole('checkbox');
      // First toggle is "Enable notifications", rest should be disabled
      for (let i = 1; i < toggles.length; i++) {
        expect(toggles[i]).toBeDisabled();
      }
    });
  });

  it('dispatches permissionChanged event when permission changes', async () => {
    const { requestPermission } = await import('@tauri-apps/plugin-notification');
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    
    (isPermissionGranted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
    
    const handlePermissionChanged = vi.fn();
    
    const { component } = render(NativeNotificationManager);
    component.$on('permissionChanged', handlePermissionChanged);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    
    await waitFor(() => {
      expect(handlePermissionChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { granted: true }
        })
      );
    });
  });

  it('auto-requests permission when autoRequestPermission is true', async () => {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    
    (isPermissionGranted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    (requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('granted');
    
    render(NativeNotificationManager, {
      props: {
        autoRequestPermission: true
      }
    });
    
    await waitFor(() => {
      expect(requestPermission).toHaveBeenCalled();
    });
  });

  it('displays correct volume percentage', async () => {
    render(NativeNotificationManager, {
      props: {
        preferences: {
          enabled: true,
          showPreview: true,
          groupByConversation: true,
          maxNotifications: 5,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          categories: {
            messages: true,
            mentions: true,
            directMessages: true,
            reactions: true,
            systemAlerts: true,
            updates: true
          },
          sound: {
            enabled: true,
            volume: 0.5,
            customSoundPath: null
          },
          badge: {
            enabled: true,
            showCount: true
          }
        }
      }
    });
    
    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});
