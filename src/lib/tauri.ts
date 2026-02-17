import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  sendNotification,
  requestPermission as requestNotificationPermission,
  isPermissionGranted,
} from "@tauri-apps/plugin-notification";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

// Update Types
export interface UpdateInfo {
  version: string;
  current_version: string;
  body: string | null;
  date: string | null;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
  percent: number | null;
}

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

// ============================================================================
// Auto-Update Functions
// ============================================================================

/**
 * Check for available updates
 * @returns UpdateInfo if an update is available, null otherwise
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  return invoke("check_for_updates");
}

/**
 * Download and install the available update
 * This will restart the application after installation
 */
export async function downloadAndInstallUpdate(): Promise<void> {
  return invoke("download_and_install_update");
}

/**
 * Listen for update available events (emitted on startup if update found)
 */
export function onUpdateAvailable(
  callback: (info: UpdateInfo) => void,
): Promise<UnlistenFn> {
  return listen<UpdateInfo>("update:available", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for update download progress
 */
export function onUpdateProgress(
  callback: (progress: UpdateProgress) => void,
): Promise<UnlistenFn> {
  return listen<UpdateProgress>("update:progress", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for update installation starting
 */
export function onUpdateInstalling(callback: () => void): Promise<UnlistenFn> {
  return listen("update:installing", () => {
    callback();
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

// Combined updater API
export const updater = {
  check: checkForUpdates,
  downloadAndInstall: downloadAndInstallUpdate,
  onAvailable: onUpdateAvailable,
  onProgress: onUpdateProgress,
  onInstalling: onUpdateInstalling,
};

// ============================================================================
// Clipboard Functions
// ============================================================================

export async function clipboardReadText(): Promise<string> {
  return readText();
}

export async function clipboardWriteText(text: string): Promise<void> {
  return writeText(text);
}

export async function clipboardHasText(): Promise<boolean> {
  try {
    const text = await readText();
    return text.length > 0;
  } catch {
    return false;
  }
}

export async function clipboardClear(): Promise<void> {
  return writeText("");
}

// Combined clipboard API
export const clipboard = {
  readText: clipboardReadText,
  writeText: clipboardWriteText,
  hasText: clipboardHasText,
  clear: clipboardClear,
};

// ============================================================================
// Focus Mode Functions
// ============================================================================

export async function toggleFocusMode(): Promise<boolean> {
  return invoke("toggle_focus_mode");
}

export async function isFocusModeActive(): Promise<boolean> {
  return invoke("is_focus_mode_active");
}

export async function setFocusMode(active: boolean): Promise<boolean> {
  return invoke("set_focus_mode", { active });
}

export function onFocusModeChanged(
  callback: (event: { active: boolean; message: string }) => void,
): Promise<UnlistenFn> {
  return listen("focus-mode-changed", (event) => {
    callback(event.payload as { active: boolean; message: string });
  });
}

// Combined focus mode API
export const focusMode = {
  toggle: toggleFocusMode,
  isActive: isFocusModeActive,
  set: setFocusMode,
  onChanged: onFocusModeChanged,
};

// ============================================================================
// Quick Mute Functions
// ============================================================================

export async function toggleMute(): Promise<boolean> {
  return invoke("toggle_mute");
}

export async function isMuted(): Promise<boolean> {
  return invoke("is_muted");
}

export async function setMute(muted: boolean): Promise<boolean> {
  return invoke("set_mute", { muted });
}

export function onMuteStateChanged(
  callback: (event: { muted: boolean; message: string }) => void,
): Promise<UnlistenFn> {
  return listen("mute-state-changed", (event) => {
    callback(event.payload as { muted: boolean; message: string });
  });
}

// Combined mute API
export const mute = {
  toggle: toggleMute,
  isMuted,
  set: setMute,
  onChanged: onMuteStateChanged,
};

// ============================================================================
// File Functions
// ============================================================================

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  extension: string | null;
  isFile: boolean;
  isDir: boolean;
  created: number | null;
  modified: number | null;
}

export async function openFile(filepath: string): Promise<void> {
  return invoke("open_file", { filepath });
}

export async function revealInFolder(filepath: string): Promise<void> {
  return invoke("reveal_in_folder", { filepath });
}

export async function fileExists(filepath: string): Promise<boolean> {
  return invoke("file_exists", { filepath });
}

export async function getFileInfo(filepath: string): Promise<FileInfo> {
  return invoke("get_file_info", { filepath });
}

// Combined file API
export const file = {
  open: openFile,
  revealInFolder,
  exists: fileExists,
  getInfo: getFileInfo,
};

// ============================================================================
// Window Attention Functions
// ============================================================================

export async function requestWindowAttention(): Promise<void> {
  return invoke("request_window_attention");
}

export async function requestUrgentAttention(): Promise<void> {
  return invoke("request_urgent_attention");
}

export async function cancelWindowAttention(): Promise<void> {
  return invoke("cancel_window_attention");
}

// Combined window attention API
export const windowAttention = {
  request: requestWindowAttention,
  requestUrgent: requestUrgentAttention,
  cancel: cancelWindowAttention,
};

// ============================================================================
// Tray Badge Functions
// ============================================================================

export async function updateTrayBadge(count: number): Promise<void> {
  return invoke("update_tray_badge", { count });
}

export async function getTrayBadge(): Promise<number> {
  return invoke("get_tray_badge");
}

// Combined tray badge API
export const trayBadge = {
  update: updateTrayBadge,
  get: getTrayBadge,
};

// ============================================================================
// Native Notification Permission
// ============================================================================

export async function requestNativeNotificationPermission(): Promise<boolean> {
  const granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestNotificationPermission();
    return permission === "granted";
  }
  return true;
}

// ============================================================================
// Power Management Functions
// ============================================================================

export interface PowerStatus {
  isAcPower: boolean;
  isCharging: boolean;
  batteryPercentage: number | null;
  timeRemaining: string | null;
  isPowerSaveMode: boolean;
}

export async function preventSleep(): Promise<void> {
  return invoke("prevent_sleep");
}

export async function allowSleep(): Promise<void> {
  return invoke("allow_sleep");
}

export async function isSleepPrevented(): Promise<boolean> {
  return invoke("is_sleep_prevented");
}

export async function getPowerStatus(): Promise<PowerStatus> {
  return invoke("get_power_status");
}

// Combined power API
export const power = {
  preventSleep,
  allowSleep,
  isSleepPrevented,
  getStatus: getPowerStatus,
};

// ============================================================================
// Screenshot Functions
// ============================================================================

export interface ScreenshotInfo {
  filename: string;
  path: string;
  size: number;
  createdAt: number;
}

export async function captureScreenshot(): Promise<string> {
  return invoke("capture_screenshot");
}

export async function captureWindowScreenshot(
  windowId: number,
): Promise<string> {
  return invoke("capture_window_screenshot", { windowId });
}

export async function captureRegionScreenshot(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string> {
  return invoke("capture_region_screenshot", { x, y, width, height });
}

export async function getScreenshotsDir(): Promise<string> {
  return invoke("get_screenshots_dir");
}

export async function listScreenshots(): Promise<ScreenshotInfo[]> {
  return invoke("list_screenshots");
}

export async function deleteScreenshot(path: string): Promise<void> {
  return invoke("delete_screenshot", { path });
}

// Combined screenshot API
export const screenshot = {
  capture: captureScreenshot,
  captureWindow: captureWindowScreenshot,
  captureRegion: captureRegionScreenshot,
  getDir: getScreenshotsDir,
  list: listScreenshots,
  delete: deleteScreenshot,
};

// ============================================================================
// Audio Functions
// ============================================================================

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
  deviceType: "Input" | "Output";
}

export async function getAudioInputDevices(): Promise<AudioDevice[]> {
  return invoke("get_audio_input_devices");
}

export async function getAudioOutputDevices(): Promise<AudioDevice[]> {
  return invoke("get_audio_output_devices");
}

export async function setAudioInputDevice(deviceId: string): Promise<void> {
  return invoke("set_audio_input_device", { deviceId });
}

export async function setAudioOutputDevice(deviceId: string): Promise<void> {
  return invoke("set_audio_output_device", { deviceId });
}

export async function getInputVolume(): Promise<number> {
  return invoke("get_input_volume");
}

export async function setInputVolume(volume: number): Promise<void> {
  return invoke("set_input_volume", { volume });
}

export async function getOutputVolume(): Promise<number> {
  return invoke("get_output_volume");
}

export async function setOutputVolume(volume: number): Promise<void> {
  return invoke("set_output_volume", { volume });
}

export async function isOutputMuted(): Promise<boolean> {
  return invoke("is_output_muted");
}

export async function toggleOutputMute(): Promise<boolean> {
  return invoke("toggle_output_mute");
}

// Combined audio API
export const audio = {
  getInputDevices: getAudioInputDevices,
  getOutputDevices: getAudioOutputDevices,
  setInputDevice: setAudioInputDevice,
  setOutputDevice: setAudioOutputDevice,
  getInputVolume,
  setInputVolume,
  getOutputVolume,
  setOutputVolume,
  isOutputMuted,
  toggleOutputMute,
};

// Default export
export default {
  window,
  notification,
  autoStart,
  app,
  updater,
  clipboard,
  focusMode,
  mute,
  file,
  windowAttention,
  trayBadge,
  power,
  screenshot,
  audio,
  onMenuEvent,
  onDeepLink,
};
