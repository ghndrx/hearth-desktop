import { invoke } from '@tauri-apps/api/core';

/**
 * Get the application version
 */
export async function getAppVersion(): Promise<string> {
  return await invoke('get_app_version');
}

/**
 * Show a system notification
 */
export async function showNotification(title: string, body: string): Promise<void> {
  await invoke('show_notification', { title, body });
}

/**
 * Set the dock/taskbar badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await invoke('set_badge_count', { count });
}

/**
 * Set the window to always be on top (or not)
 * @param alwaysOnTop - Whether the window should stay on top of other windows
 */
export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  await invoke('set_always_on_top', { always_on_top: alwaysOnTop });
}