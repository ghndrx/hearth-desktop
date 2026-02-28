<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  interface TrayMenuItem {
    id: string;
    label: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    checked?: boolean;
    separator?: boolean;
    submenu?: TrayMenuItem[];
  }

  interface QuickStatus {
    id: string;
    label: string;
    icon: string;
    color: string;
  }

  export let visible = false;
  export let unreadCount = 0;
  export let currentStatus: 'online' | 'away' | 'dnd' | 'invisible' = 'online';
  export let isMuted = false;
  export let isDoNotDisturb = false;

  const dispatch = createEventDispatcher<{
    statusChange: { status: string };
    toggleMute: void;
    toggleDnd: void;
    showWindow: void;
    hideWindow: void;
    openSettings: void;
    quit: void;
    menuAction: { id: string };
  }>();

  const quickStatuses: QuickStatus[] = [
    { id: 'online', label: 'Online', icon: '🟢', color: '#3ba55c' },
    { id: 'away', label: 'Away', icon: '🌙', color: '#faa61a' },
    { id: 'dnd', label: 'Do Not Disturb', icon: '⛔', color: '#ed4245' },
    { id: 'invisible', label: 'Invisible', icon: '⚫', color: '#747f8d' }
  ];

  let menuItems: TrayMenuItem[] = [];
  let unlistenTrayClick: UnlistenFn | null = null;
  let unlistenTrayMenu: UnlistenFn | null = null;

  $: menuItems = buildMenuItems();

  function buildMenuItems(): TrayMenuItem[] {
    const items: TrayMenuItem[] = [
      {
        id: 'status-header',
        label: `Status: ${quickStatuses.find(s => s.id === currentStatus)?.label || 'Online'}`,
        disabled: true
      },
      { id: 'separator-1', label: '', separator: true }
    ];

    // Quick status options
    quickStatuses.forEach(status => {
      items.push({
        id: `status-${status.id}`,
        label: `${status.icon} ${status.label}`,
        checked: currentStatus === status.id
      });
    });

    items.push({ id: 'separator-2', label: '', separator: true });

    // Notification controls
    items.push({
      id: 'toggle-mute',
      label: isMuted ? '🔇 Unmute Notifications' : '🔔 Mute Notifications',
      checked: isMuted
    });

    items.push({
      id: 'toggle-dnd',
      label: isDoNotDisturb ? '📵 Disable DND' : '🚫 Enable DND',
      checked: isDoNotDisturb
    });

    if (unreadCount > 0) {
      items.push({
        id: 'unread-count',
        label: `📬 ${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`,
        disabled: true
      });
    }

    items.push({ id: 'separator-3', label: '', separator: true });

    // Window controls
    items.push({
      id: 'show-window',
      label: '🪟 Show Hearth',
      shortcut: 'Ctrl+Shift+H'
    });

    items.push({
      id: 'hide-window',
      label: '👻 Hide to Tray',
      shortcut: 'Ctrl+Shift+M'
    });

    items.push({ id: 'separator-4', label: '', separator: true });

    // Settings and quit
    items.push({
      id: 'settings',
      label: '⚙️ Settings',
      shortcut: 'Ctrl+,'
    });

    items.push({
      id: 'quit',
      label: '🚪 Quit Hearth',
      shortcut: 'Ctrl+Q'
    });

    return items;
  }

  async function updateTrayMenu() {
    try {
      await invoke('update_tray_menu', {
        items: menuItems.map(item => ({
          id: item.id,
          label: item.label,
          shortcut: item.shortcut || null,
          disabled: item.disabled || false,
          checked: item.checked || false,
          separator: item.separator || false
        }))
      });
    } catch (err) {
      console.warn('Failed to update tray menu:', err);
    }
  }

  async function updateTrayIcon() {
    try {
      let iconState = 'default';
      if (isDoNotDisturb) {
        iconState = 'dnd';
      } else if (unreadCount > 0) {
        iconState = 'unread';
      } else if (currentStatus === 'away') {
        iconState = 'away';
      } else if (currentStatus === 'invisible') {
        iconState = 'invisible';
      }

      await invoke('set_tray_icon_state', { state: iconState });
    } catch (err) {
      console.warn('Failed to update tray icon:', err);
    }
  }

  async function updateTrayTooltip() {
    try {
      let tooltip = 'Hearth Desktop';
      const statusLabel = quickStatuses.find(s => s.id === currentStatus)?.label || 'Online';
      tooltip += ` • ${statusLabel}`;
      
      if (unreadCount > 0) {
        tooltip += ` • ${unreadCount} unread`;
      }
      
      if (isDoNotDisturb) {
        tooltip += ' • DND';
      }

      await invoke('set_tray_tooltip', { tooltip });
    } catch (err) {
      console.warn('Failed to update tray tooltip:', err);
    }
  }

  function handleMenuAction(itemId: string) {
    switch (itemId) {
      case 'status-online':
      case 'status-away':
      case 'status-dnd':
      case 'status-invisible':
        const status = itemId.replace('status-', '');
        dispatch('statusChange', { status });
        break;
      case 'toggle-mute':
        dispatch('toggleMute');
        break;
      case 'toggle-dnd':
        dispatch('toggleDnd');
        break;
      case 'show-window':
        dispatch('showWindow');
        break;
      case 'hide-window':
        dispatch('hideWindow');
        break;
      case 'settings':
        dispatch('openSettings');
        break;
      case 'quit':
        dispatch('quit');
        break;
      default:
        dispatch('menuAction', { id: itemId });
    }
  }

  onMount(async () => {
    // Listen for tray click events
    unlistenTrayClick = await listen('tray-click', (event) => {
      dispatch('showWindow');
    });

    // Listen for tray menu item clicks
    unlistenTrayMenu = await listen<{ id: string }>('tray-menu-action', (event) => {
      handleMenuAction(event.payload.id);
    });

    // Initial setup
    await updateTrayMenu();
    await updateTrayIcon();
    await updateTrayTooltip();
  });

  onDestroy(() => {
    unlistenTrayClick?.();
    unlistenTrayMenu?.();
  });

  // Reactive updates when props change
  $: if (visible) {
    updateTrayMenu();
    updateTrayIcon();
    updateTrayTooltip();
  }

  $: currentStatus, updateTrayIcon(), updateTrayMenu(), updateTrayTooltip();
  $: unreadCount, updateTrayIcon(), updateTrayMenu(), updateTrayTooltip();
  $: isMuted, updateTrayMenu();
  $: isDoNotDisturb, updateTrayIcon(), updateTrayMenu(), updateTrayTooltip();
</script>

<!-- 
  This component is headless - it manages the native system tray context menu
  through Tauri IPC. No visual rendering needed in the DOM.
-->

<slot />
