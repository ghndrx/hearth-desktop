import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

// Window Control Functions
export async function minimizeWindow(): Promise<void> {
  return invoke("minimize_window");
}

export async function toggleMaximize(): Promise<void> {
  return invoke("toggle_maximize");
}

export async function closeWindow(): Promise<void> {
  return invoke("close_window");
}

export async function hideWindow(): Promise<void> {
  return invoke("hide_window");
}

export async function showWindow(): Promise<void> {
  return invoke("show_window");
}

export async function isWindowVisible(): Promise<boolean> {
  return invoke("is_window_visible");
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  return invoke("set_always_on_top", { alwaysOnTop });
}

export async function toggleFullscreen(): Promise<void> {
  return invoke("toggle_fullscreen");
}

// App Information
export async function getAppVersion(): Promise<string> {
  return invoke("get_app_version");
}

// Notifications
export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  return invoke("show_notification", { title, body });
}

export async function sendNativeNotification(
  title: string,
  body: string,
): Promise<void> {
  sendNotification({ title, body });
}

// Badge Count (macOS)
export async function setBadgeCount(count: number): Promise<void> {
  return invoke("set_badge_count", { count });
}

// Auto-start
export async function isAutoStartEnabled(): Promise<boolean> {
  return invoke("is_auto_start_enabled");
}

export async function enableAutoStart(): Promise<void> {
  return invoke("enable_auto_start");
}

export async function disableAutoStart(): Promise<void> {
  return invoke("disable_auto_start");
}

// Event Listeners
export function onMenuEvent(
  callback: (event: string, payload?: unknown) => void,
) {
  const events = [
    "new_chat",
    "new_room",
    "settings",
    "toggle_sidebar",
    "check_updates",
    "about",
  ];

  const unlisteners: (() => void)[] = [];

  events.forEach((event) => {
    listen(`menu:${event}`, (e) => {
      callback(event, e.payload);
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });
  });

  return () => {
    unlisteners.forEach((unlisten) => unlisten());
  };
}

// Deep link handling
export function onDeepLink(callback: (url: string) => void) {
  return listen<string>("deep-link", (event) => {
    callback(event.payload);
  });
}

// Combined window API
export const window = {
  minimize: minimizeWindow,
  maximize: toggleMaximize,
  close: closeWindow,
  hide: hideWindow,
  show: showWindow,
  isVisible: isWindowVisible,
  setAlwaysOnTop,
  toggleFullscreen,
};

// Combined notification API
export const notification = {
  show: showNotification,
  send: sendNativeNotification,
  setBadgeCount,
};

// Combined auto-start API
export const autoStart = {
  isEnabled: isAutoStartEnabled,
  enable: enableAutoStart,
  disable: disableAutoStart,
};

// Combined app API
export const app = {
  getVersion: getAppVersion,
};

// Default export
export default {
  window,
  notification,
  autoStart,
  app,
  onMenuEvent,
  onDeepLink,
};
