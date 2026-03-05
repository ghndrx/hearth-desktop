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

// Window Opacity
export async function setWindowOpacity(opacity: number): Promise<void> {
  return invoke("set_window_opacity", { opacity });
}

export async function getWindowOpacity(): Promise<number> {
  return invoke("get_window_opacity");
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
// Clipboard History Functions
// ============================================================================

export type ClipboardContentType = 
  | { type: 'Text'; data: string }
  | { type: 'Html'; data: { html: string; plain: string | null } }
  | { type: 'Image'; data: { base64: string; width: number; height: number; format: string } }
  | { type: 'Files'; data: string[] }
  | { type: 'Empty' };

export interface ClipboardEntry {
  id: string;
  content: ClipboardContentType;
  timestamp: number;
  source: string | null;
}

export async function clipboardCopyText(
  text: string,
  trackHistory?: boolean,
): Promise<ClipboardEntry> {
  return invoke("clipboard_copy_text", { text, trackHistory });
}

export async function clipboardCopyHtml(
  html: string,
  plainText?: string,
  trackHistory?: boolean,
): Promise<ClipboardEntry> {
  return invoke("clipboard_copy_html", { html, plainText, trackHistory });
}

export async function clipboardCopyImage(
  base64Data: string,
  trackHistory?: boolean,
): Promise<ClipboardEntry> {
  return invoke("clipboard_copy_image", { base64Data, trackHistory });
}

export async function clipboardReadContent(): Promise<ClipboardContentType> {
  return invoke("clipboard_read");
}

export async function clipboardGetHistory(limit?: number): Promise<ClipboardEntry[]> {
  return invoke("clipboard_get_history", { limit });
}

export async function clipboardClearHistory(): Promise<void> {
  return invoke("clipboard_clear_history");
}

export async function clipboardRemoveEntry(id: string): Promise<boolean> {
  return invoke("clipboard_remove_entry", { id });
}

export async function clipboardPasteEntry(id: string): Promise<ClipboardContentType> {
  return invoke("clipboard_paste_entry", { id });
}

// Combined clipboard history API
export const clipboardHistory = {
  copyText: clipboardCopyText,
  copyHtml: clipboardCopyHtml,
  copyImage: clipboardCopyImage,
  read: clipboardReadContent,
  getHistory: clipboardGetHistory,
  clearHistory: clipboardClearHistory,
  removeEntry: clipboardRemoveEntry,
  pasteEntry: clipboardPasteEntry,
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

// ============================================================================
// Native File Drop Functions
// ============================================================================

export interface DroppedFile {
  path: string;
  name: string;
  size: number;
  extension: string | null;
  mime_type: string | null;
  is_image: boolean;
  is_video: boolean;
  is_audio: boolean;
  is_document: boolean;
  modified: number | null;
  thumbnail: string | null;
}

export interface FileDropEvent {
  event_type: "hover" | "drop" | "cancel";
  files: DroppedFile[];
  position: [number, number] | null;
}

export interface FileValidationResult {
  valid_files: DroppedFile[];
  errors: string[];
}

/**
 * Read a file as base64 data URL
 * @param path Path to the file
 * @param maxSizeMb Maximum file size in MB (default: 10)
 * @returns Base64 data URL (e.g., "data:image/png;base64,...")
 */
export async function readFileAsBase64(
  path: string,
  maxSizeMb = 10
): Promise<string> {
  return invoke("read_file_as_base64", { path, maxSizeMb });
}

/**
 * Get a thumbnail for an image file
 * @param path Path to the image file
 * @returns Base64 data URL or null if not available
 */
export async function getFileThumbnail(path: string): Promise<string | null> {
  return invoke("get_file_thumbnail", { path });
}

/**
 * Validate dropped files against criteria
 * @param paths Array of file paths to validate
 * @param maxFileSize Maximum file size in bytes
 * @param maxFiles Maximum number of files
 * @param allowedTypes Optional array of allowed extensions (e.g., ["png", "jpg"])
 * @returns Validation result with valid files and errors
 */
export async function validateDroppedFiles(
  paths: string[],
  maxFileSize?: number,
  maxFiles?: number,
  allowedTypes?: string[]
): Promise<FileValidationResult> {
  return invoke("validate_dropped_files", {
    paths,
    maxFileSize,
    maxFiles,
    allowedTypes,
  });
}

/**
 * Listen for native file drop events
 * @param callback Called when files are dragged over, dropped, or drag is cancelled
 * @returns Unlisten function
 */
export function onNativeFileDrop(
  callback: (event: FileDropEvent) => void
): Promise<UnlistenFn> {
  return listen<FileDropEvent>("native-file-drop", (event) => {
    callback(event.payload);
  });
}

// Combined native file drop API
export const fileDrop = {
  readAsBase64: readFileAsBase64,
  getThumbnail: getFileThumbnail,
  validate: validateDroppedFiles,
  onDrop: onNativeFileDrop,
};

// ============================================================================
// Idle Detection Functions
// ============================================================================

export interface IdleStatus {
  idle_seconds: number;
  is_idle: boolean;
  screen_locked: boolean;
}

/**
 * Get current idle status with default threshold (5 minutes)
 */
export async function getIdleStatus(): Promise<IdleStatus> {
  return invoke("get_idle_status");
}

/**
 * Get idle status with custom threshold
 * @param thresholdSeconds Seconds of inactivity to consider user idle
 */
export async function getIdleStatusWithThreshold(
  thresholdSeconds: number
): Promise<IdleStatus> {
  return invoke("get_idle_status_with_threshold", {
    threshold_seconds: thresholdSeconds,
  });
}

// Combined idle detection API
export const idle = {
  getStatus: getIdleStatus,
  getStatusWithThreshold: getIdleStatusWithThreshold,
};

// ============================================================================
// Spell Check Functions
// ============================================================================

export interface SpellCheckResult {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export interface SpellCheckLanguage {
  code: string;
  name: string;
}

export async function checkSpelling(
  text: string,
  language?: string,
): Promise<SpellCheckResult[]> {
  return invoke("check_spelling", { text, language });
}

export async function getSpellingSuggestions(
  word: string,
  language?: string,
): Promise<string[]> {
  return invoke("get_spelling_suggestions", { word, language });
}

export async function addToDictionary(word: string): Promise<void> {
  return invoke("add_to_dictionary", { word });
}

export async function removeFromDictionary(word: string): Promise<void> {
  return invoke("remove_from_dictionary", { word });
}

export async function getCustomDictionary(): Promise<string[]> {
  return invoke("get_custom_dictionary");
}

export async function getSpellCheckLanguages(): Promise<SpellCheckLanguage[]> {
  return invoke("get_spell_check_languages");
}

// Combined spell check API
export const spellCheck = {
  check: checkSpelling,
  getSuggestions: getSpellingSuggestions,
  addToDictionary,
  removeFromDictionary,
  getCustomDictionary,
  getLanguages: getSpellCheckLanguages,
};

// ============================================================================
// File Association Functions
// ============================================================================

export interface AssociatedFile {
  path: string;
  name: string;
  extension: string | null;
  mime_type: string | null;
  size: number;
}

export interface FileAssociation {
  extension: string;
  mime_type: string;
  description: string;
  registered: boolean;
}

export interface ChatExportInfo {
  path: string;
  channel_name: string;
  server_name: string | null;
  message_count: number;
  exported_at: string;
}

export async function getSupportedFileAssociations(): Promise<
  FileAssociation[]
> {
  return invoke("get_supported_file_associations");
}

export async function handleAssociatedFile(
  path: string,
): Promise<AssociatedFile> {
  return invoke("handle_associated_file", { path });
}

export async function importChatExport(
  path: string,
): Promise<ChatExportInfo> {
  return invoke("import_chat_export", { path });
}

export function onFileAssociationOpen(
  callback: (file: AssociatedFile) => void,
): Promise<UnlistenFn> {
  return listen<AssociatedFile>("file-association-open", (event) => {
    callback(event.payload);
  });
}

// Combined file association API
export const fileAssociation = {
  getSupportedTypes: getSupportedFileAssociations,
  handleFile: handleAssociatedFile,
  importExport: importChatExport,
  onOpen: onFileAssociationOpen,
};

// ============================================================================
// Storage Management Functions
// ============================================================================

export interface StorageStats {
  path: string;
  name: string;
  size_bytes: number;
  size_formatted: string;
  file_count: number;
  exists: boolean;
}

export interface StorageInfo {
  app_data: StorageStats;
  app_cache: StorageStats;
  app_config: StorageStats;
  app_log: StorageStats;
  total_size_bytes: number;
  total_size_formatted: string;
  total_files: number;
}

export interface CleanupResult {
  success: boolean;
  freed_bytes: number;
  freed_formatted: string;
  deleted_files: number;
  errors: string[];
}

export type StorageCategory = "cache" | "logs" | "temp_files" | "all";

export async function getStorageInfo(): Promise<StorageInfo> {
  return invoke("get_storage_info");
}

export async function clearStorage(category: StorageCategory): Promise<CleanupResult> {
  return invoke("clear_storage", { category });
}

export async function getStoragePath(category: StorageCategory): Promise<string> {
  return invoke("get_storage_path", { category });
}

export async function openStorageLocation(category: StorageCategory): Promise<void> {
  return invoke("open_storage_location", { category });
}

// Combined storage API
export const storage = {
  getInfo: getStorageInfo,
  clear: clearStorage,
  getPath: getStoragePath,
  openLocation: openStorageLocation,
};

// ============================================================================
// Notification Snooze Functions
// ============================================================================

export type SnoozeDuration =
  | "fifteen_minutes"
  | "thirty_minutes"
  | "one_hour"
  | "two_hours"
  | "four_hours"
  | "until_tomorrow"
  | { custom: number };

export interface SnoozeStatus {
  active: boolean;
  until_timestamp: number | null;
  until_formatted: string | null;
  label: string | null;
  remaining_minutes: number | null;
}

export async function snoozeNotifications(duration: SnoozeDuration): Promise<SnoozeStatus> {
  return invoke("snooze_notifications", { duration });
}

export async function snoozeNotificationsCustom(minutes: number): Promise<SnoozeStatus> {
  return invoke("snooze_notifications_custom", { minutes });
}

export async function unsnoozeNotifications(): Promise<SnoozeStatus> {
  return invoke("unsnooze_notifications");
}

export async function getSnoozeStatus(): Promise<SnoozeStatus> {
  return invoke("get_notification_snooze_status");
}

export async function areNotificationsSnoozed(): Promise<boolean> {
  return invoke("are_notifications_snoozed");
}

export function onSnoozeStarted(callback: (status: SnoozeStatus) => void): Promise<UnlistenFn> {
  return listen<SnoozeStatus>("snooze-started", (event) => {
    callback(event.payload);
  });
}

export function onSnoozeEnded(callback: (status: SnoozeStatus) => void): Promise<UnlistenFn> {
  return listen<SnoozeStatus>("snooze-ended", (event) => {
    callback(event.payload);
  });
}

// Combined snooze API
export const snooze = {
  start: snoozeNotifications,
  startCustom: snoozeNotificationsCustom,
  end: unsnoozeNotifications,
  getStatus: getSnoozeStatus,
  isActive: areNotificationsSnoozed,
  onStarted: onSnoozeStarted,
  onEnded: onSnoozeEnded,
};

// ============================================================================
// Window State Persistence
// ============================================================================

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullscreen: boolean;
}

const WINDOW_STATE_KEY = 'hearth_window_state';

/**
 * Get current window position and size
 */
export async function getWindowState(): Promise<WindowState> {
  const { getCurrentWindow, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  
  const [position, size, isMaximized, isFullscreen] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    win.isMaximized(),
    win.isFullscreen(),
  ]);
  
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    isMaximized,
    isFullscreen,
  };
}

/**
 * Save window state to local storage
 */
export async function saveWindowState(): Promise<void> {
  try {
    const state = await getWindowState();
    // Don't save state if maximized or fullscreen - we'll restore the pre-maximized state
    if (!state.isMaximized && !state.isFullscreen) {
      localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
    }
  } catch (error) {
    console.error('Failed to save window state:', error);
  }
}

/**
 * Load saved window state from local storage
 */
export function loadSavedWindowState(): WindowState | null {
  try {
    const stored = localStorage.getItem(WINDOW_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the stored state
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.width === 'number' &&
        typeof parsed.height === 'number' &&
        parsed.width > 0 &&
        parsed.height > 0
      ) {
        return {
          x: parsed.x,
          y: parsed.y,
          width: parsed.width,
          height: parsed.height,
          isMaximized: parsed.isMaximized ?? false,
          isFullscreen: parsed.isFullscreen ?? false,
        };
      }
    }
  } catch (error) {
    console.error('Failed to load window state:', error);
  }
  return null;
}

/**
 * Restore window to saved state
 */
export async function restoreWindowState(): Promise<boolean> {
  const savedState = loadSavedWindowState();
  if (!savedState) return false;
  
  try {
    const { getCurrentWindow, LogicalPosition, LogicalSize } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    
    // Check if the saved position is within visible screen bounds
    const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
    const monitors = await availableMonitors();
    
    let isOnScreen = false;
    for (const monitor of monitors) {
      const pos = monitor.position;
      const size = monitor.size;
      // Check if the window's top-left corner would be visible on this monitor
      if (
        savedState.x >= pos.x &&
        savedState.x < pos.x + size.width &&
        savedState.y >= pos.y &&
        savedState.y < pos.y + size.height
      ) {
        isOnScreen = true;
        break;
      }
    }
    
    if (!isOnScreen) {
      console.warn('Saved window position is off-screen, not restoring position');
      // Still restore size even if position is invalid
      await win.setSize(new LogicalSize(savedState.width, savedState.height));
      return true;
    }
    
    // Restore position and size
    await win.setPosition(new LogicalPosition(savedState.x, savedState.y));
    await win.setSize(new LogicalSize(savedState.width, savedState.height));
    
    // Restore maximized state if it was saved
    if (savedState.isMaximized) {
      await win.maximize();
    }
    
    return true;
  } catch (error) {
    console.error('Failed to restore window state:', error);
    return false;
  }
}

/**
 * Clear saved window state
 */
export function clearWindowState(): void {
  localStorage.removeItem(WINDOW_STATE_KEY);
}

/**
 * Listen for window move events
 */
export async function onWindowMove(callback: () => void): Promise<UnlistenFn> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  return win.onMoved(() => callback());
}

/**
 * Listen for window resize events
 */
export async function onWindowResize(callback: () => void): Promise<UnlistenFn> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  return win.onResized(() => callback());
}

// Combined window state API
export const windowState = {
  get: getWindowState,
  save: saveWindowState,
  load: loadSavedWindowState,
  restore: restoreWindowState,
  clear: clearWindowState,
  onMove: onWindowMove,
  onResize: onWindowResize,
};

// ============================================================================
// Bluetooth Device Management
// ============================================================================

export interface BluetoothDevice {
  name: string;
  address: string;
  device_type: string;
  connected: boolean;
  paired: boolean;
  battery_level: number | null;
  signal_strength: number | null;
}

export interface BluetoothStatus {
  available: boolean;
  enabled: boolean;
  discovering: boolean;
  devices: BluetoothDevice[];
}

export async function bluetoothGetStatus(): Promise<BluetoothStatus> {
  return invoke("bluetooth_get_status");
}

export async function bluetoothGetDevices(): Promise<BluetoothDevice[]> {
  return invoke("bluetooth_get_devices");
}

export async function bluetoothGetAudioDevices(): Promise<BluetoothDevice[]> {
  return invoke("bluetooth_get_audio_devices");
}

export async function bluetoothIsAvailable(): Promise<boolean> {
  return invoke("bluetooth_is_available");
}

export async function bluetoothStartMonitor(intervalSecs?: number): Promise<void> {
  return invoke("bluetooth_start_monitor", { intervalSecs });
}

export async function bluetoothStopMonitor(): Promise<void> {
  return invoke("bluetooth_stop_monitor");
}

export async function bluetoothIsMonitoring(): Promise<boolean> {
  return invoke("bluetooth_is_monitoring");
}

export function onBluetoothConnected(callback: (device: BluetoothDevice) => void): Promise<UnlistenFn> {
  return listen<BluetoothDevice>("bluetooth:connected", (event) => callback(event.payload));
}

export function onBluetoothDisconnected(callback: (device: BluetoothDevice) => void): Promise<UnlistenFn> {
  return listen<BluetoothDevice>("bluetooth:disconnected", (event) => callback(event.payload));
}

export function onBluetoothStatusChanged(callback: (status: BluetoothStatus) => void): Promise<UnlistenFn> {
  return listen<BluetoothStatus>("bluetooth:status", (event) => callback(event.payload));
}

export const bluetooth = {
  getStatus: bluetoothGetStatus,
  getDevices: bluetoothGetDevices,
  getAudioDevices: bluetoothGetAudioDevices,
  isAvailable: bluetoothIsAvailable,
  startMonitor: bluetoothStartMonitor,
  stopMonitor: bluetoothStopMonitor,
  isMonitoring: bluetoothIsMonitoring,
  onConnected: onBluetoothConnected,
  onDisconnected: onBluetoothDisconnected,
  onStatusChanged: onBluetoothStatusChanged,
};

// ============================================================================
// Process Manager
// ============================================================================

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_bytes: number;
  status: string;
  start_time: number;
  parent_pid: number | null;
}

export interface ProcessSummary {
  total_processes: number;
  total_threads: number;
  total_cpu_usage: number;
  total_memory_bytes: number;
  top_cpu: ProcessInfo[];
  top_memory: ProcessInfo[];
  timestamp: number;
}

export interface AppDetectionResult {
  app_name: string;
  running: boolean;
  pid: number | null;
  cpu_usage: number | null;
  memory_bytes: number | null;
}

export async function processGetSummary(topCount?: number): Promise<ProcessSummary> {
  return invoke("process_get_summary", { topCount });
}

export async function processFindByName(name: string): Promise<ProcessInfo[]> {
  return invoke("process_find_by_name", { name });
}

export async function processDetectApps(appNames: string[]): Promise<AppDetectionResult[]> {
  return invoke("process_detect_apps", { appNames });
}

export async function processGetCount(): Promise<number> {
  return invoke("process_get_count");
}

export async function processIsRunning(name: string): Promise<boolean> {
  return invoke("process_is_running", { name });
}

export async function processDetectCommunicationApps(): Promise<AppDetectionResult[]> {
  return invoke("process_detect_communication_apps");
}

export async function processDetectGamingApps(): Promise<AppDetectionResult[]> {
  return invoke("process_detect_gaming_apps");
}

export const processManager = {
  getSummary: processGetSummary,
  findByName: processFindByName,
  detectApps: processDetectApps,
  getCount: processGetCount,
  isRunning: processIsRunning,
  detectCommunicationApps: processDetectCommunicationApps,
  detectGamingApps: processDetectGamingApps,
};

// ============================================================================
// OS DND Sync
// ============================================================================

export interface OsDndStatus {
  active: boolean;
  mode_name: string | null;
  sync_enabled: boolean;
  platform: string;
  supported: boolean;
}

export async function dndSyncGetOsStatus(): Promise<OsDndStatus> {
  return invoke("dndsync_get_os_status");
}

export async function dndSyncIsOsDndActive(): Promise<boolean> {
  return invoke("dndsync_is_os_dnd_active");
}

export async function dndSyncIsSupported(): Promise<boolean> {
  return invoke("dndsync_is_supported");
}

export async function dndSyncStartSync(intervalSecs?: number): Promise<void> {
  return invoke("dndsync_start_sync", { intervalSecs });
}

export async function dndSyncStopSync(): Promise<void> {
  return invoke("dndsync_stop_sync");
}

export async function dndSyncIsSyncRunning(): Promise<boolean> {
  return invoke("dndsync_is_sync_running");
}

export function onOsDndActivated(callback: (status: OsDndStatus) => void): Promise<UnlistenFn> {
  return listen<OsDndStatus>("dndsync:os-dnd-activated", (event) => callback(event.payload));
}

export function onOsDndDeactivated(callback: (status: OsDndStatus) => void): Promise<UnlistenFn> {
  return listen<OsDndStatus>("dndsync:os-dnd-deactivated", (event) => callback(event.payload));
}

export const dndSync = {
  getOsStatus: dndSyncGetOsStatus,
  isOsDndActive: dndSyncIsOsDndActive,
  isSupported: dndSyncIsSupported,
  startSync: dndSyncStartSync,
  stopSync: dndSyncStopSync,
  isSyncRunning: dndSyncIsSyncRunning,
  onActivated: onOsDndActivated,
  onDeactivated: onOsDndDeactivated,
};

// ============================================================================
// Do Not Disturb (DND) Functions
// ============================================================================

export interface DndSchedule {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days: number[];
  allow_mentions: boolean;
  allow_dms: boolean;
  custom_message: string | null;
}

export interface DndStatus {
  active: boolean;
  schedule_enabled: boolean;
  manual_override: boolean;
  until: string | null;
  reason: string;
}

export interface NotificationDecision {
  allowed: boolean;
  reason: string;
  queued: boolean;
}

export interface DndPreset {
  id: string;
  label: string;
  duration_minutes: number | null;
  until_time: string | null;
}

export async function getDndStatus(): Promise<DndStatus> {
  return invoke("get_dnd_status");
}

export async function toggleDnd(): Promise<boolean> {
  return invoke("toggle_dnd");
}

export async function setDnd(active: boolean): Promise<boolean> {
  return invoke("set_dnd", { active });
}

export async function setDndUntil(until: string): Promise<DndStatus> {
  return invoke("set_dnd_until", { until });
}

export async function isDndActive(): Promise<boolean> {
  return invoke("is_dnd_active");
}

export async function getDndSchedule(): Promise<DndSchedule> {
  return invoke("get_dnd_schedule");
}

export async function setDndSchedule(schedule: DndSchedule): Promise<void> {
  return invoke("set_dnd_schedule", { schedule });
}

export async function setDndScheduleEnabled(enabled: boolean): Promise<void> {
  return invoke("set_dnd_schedule_enabled", { enabled });
}

export async function shouldAllowNotification(isMention: boolean, isDm: boolean): Promise<boolean> {
  return invoke("should_allow_notification", { isMention, isDm });
}

export async function checkNotificationAllowed(isMention: boolean, isDm: boolean, isUrgent: boolean): Promise<NotificationDecision> {
  return invoke("check_notification_allowed", { isMention, isDm, isUrgent });
}

export async function getDndPresets(): Promise<DndPreset[]> {
  return invoke("get_dnd_presets");
}

export async function applyDndPreset(presetId: string): Promise<DndStatus> {
  return invoke("apply_dnd_preset", { presetId });
}

// Combined DND API
export const dnd = {
  getStatus: getDndStatus,
  toggle: toggleDnd,
  set: setDnd,
  setUntil: setDndUntil,
  isActive: isDndActive,
  getSchedule: getDndSchedule,
  setSchedule: setDndSchedule,
  setScheduleEnabled: setDndScheduleEnabled,
  shouldAllowNotification,
  checkNotificationAllowed,
  getPresets: getDndPresets,
  applyPreset: applyDndPreset,
};

// ============================================================================
// Notification Center Functions
// ============================================================================

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationAction {
  id: string;
  label: string;
  destructive: boolean;
}

export interface NotificationConfig {
  id: string;
  title: string;
  body?: string;
  group?: string;
  priority?: NotificationPriority;
  actions?: NotificationAction[];
  silent?: boolean;
  schedule_ms?: number;
  data?: unknown;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body?: string;
  group?: string;
  priority: NotificationPriority;
  timestamp: number;
  read: boolean;
  data?: unknown;
}

export async function sendNotificationCenter(config: NotificationConfig): Promise<string> {
  return invoke("send_notification", { config });
}

export async function scheduleNotification(config: NotificationConfig): Promise<string> {
  return invoke("schedule_notification", { config });
}

export async function cancelScheduledNotification(id: string): Promise<boolean> {
  return invoke("cancel_scheduled_notification", { id });
}

export async function getScheduledNotifications(): Promise<NotificationConfig[]> {
  return invoke("get_scheduled_notifications");
}

export async function getNotificationHistory(limit?: number): Promise<NotificationRecord[]> {
  return invoke("get_notification_history", { limit });
}

export async function markNotificationRead(id: string): Promise<boolean> {
  return invoke("mark_notification_read", { id });
}

export async function markAllNotificationsRead(): Promise<number> {
  return invoke("mark_all_notifications_read");
}

export async function clearNotificationHistory(): Promise<number> {
  return invoke("clear_notification_history");
}

export async function getUnreadNotificationCount(): Promise<number> {
  return invoke("get_unread_notification_count");
}

export async function setNotificationDnd(active: boolean): Promise<boolean> {
  return invoke("set_notification_dnd", { active });
}

export async function getGroupedNotifications(): Promise<Record<string, NotificationRecord[]>> {
  return invoke("get_grouped_notifications");
}

// Combined notification center API
export const notificationCenter = {
  send: sendNotificationCenter,
  schedule: scheduleNotification,
  cancelScheduled: cancelScheduledNotification,
  getScheduled: getScheduledNotifications,
  getHistory: getNotificationHistory,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
  clearHistory: clearNotificationHistory,
  getUnreadCount: getUnreadNotificationCount,
  setDnd: setNotificationDnd,
  getGrouped: getGroupedNotifications,
};

// ============================================================================
// System Theme Functions
// ============================================================================

export type SystemTheme = "light" | "dark";

export interface ThemeInfo {
  theme: SystemTheme;
  is_dark: boolean;
  accent_color?: string;
  high_contrast: boolean;
  reduced_motion: boolean;
  reduced_transparency: boolean;
}

export async function getSystemTheme(): Promise<SystemTheme> {
  return invoke("get_system_theme");
}

export async function getThemeInfo(): Promise<ThemeInfo> {
  return invoke("get_theme_info");
}

export async function isDarkMode(): Promise<boolean> {
  return invoke("is_dark_mode");
}

// Combined system theme API
export const systemTheme = {
  get: getSystemTheme,
  getInfo: getThemeInfo,
  isDark: isDarkMode,
};

// ============================================================================
// Performance Monitoring Functions
// ============================================================================

export interface PerformanceMetrics {
  memory_bytes: number;
  memory_formatted: string;
  rss_bytes: number;
  rss_formatted: string;
  virtual_bytes: number;
  virtual_formatted: string;
  uptime_seconds: number;
  uptime_formatted: string;
  cpu_percent: number;
  thread_count: number;
  timestamp: number;
}

export interface MemoryInfoPerf {
  heap_bytes: number;
  rss_bytes: number;
  virtual_bytes: number;
  peak_bytes: number;
}

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  return invoke("get_performance_metrics");
}

export async function getMemoryInfoPerf(): Promise<MemoryInfoPerf> {
  return invoke("get_memory_info");
}

export async function getAppUptime(): Promise<[number, string]> {
  return invoke("get_app_uptime");
}

// Combined performance monitoring API
export const performance = {
  getMetrics: getPerformanceMetrics,
  getMemoryInfo: getMemoryInfoPerf,
  getUptime: getAppUptime,
};

// ============================================================================
// Global Shortcuts Functions
// ============================================================================

export interface RegisteredShortcut {
  id: string;
  accelerator: string;
  label: string;
  active: boolean;
}

export async function registerGlobalShortcut(id: string, keys: string[], label: string): Promise<RegisteredShortcut> {
  return invoke("register_global_shortcut", { id, keys, label });
}

export async function unregisterGlobalShortcut(id: string): Promise<void> {
  return invoke("unregister_global_shortcut", { id });
}

export async function unregisterAllGlobalShortcuts(): Promise<void> {
  return invoke("unregister_all_global_shortcuts");
}

export async function listGlobalShortcuts(): Promise<RegisteredShortcut[]> {
  return invoke("list_global_shortcuts");
}

export async function isGlobalShortcutRegistered(keys: string[]): Promise<boolean> {
  return invoke("is_global_shortcut_registered", { keys });
}

// Combined global shortcuts API
export const globalShortcuts = {
  register: registerGlobalShortcut,
  unregister: unregisterGlobalShortcut,
  unregisterAll: unregisterAllGlobalShortcuts,
  list: listGlobalShortcuts,
  isRegistered: isGlobalShortcutRegistered,
};

// ============================================================================
// Mini Mode / PiP Functions
// ============================================================================

export interface MiniModeState {
  is_active: boolean;
  previous_x: number;
  previous_y: number;
  previous_width: number;
  previous_height: number;
  previous_always_on_top: boolean;
  mini_width: number;
  mini_height: number;
  corner: string;
}

export async function enterMiniMode(corner?: string): Promise<MiniModeState> {
  return invoke("enter_mini_mode", { corner });
}

export async function exitMiniMode(): Promise<MiniModeState> {
  return invoke("exit_mini_mode");
}

export async function toggleMiniMode(corner?: string): Promise<MiniModeState> {
  return invoke("toggle_mini_mode", { corner });
}

export async function getMiniModeState(): Promise<MiniModeState> {
  return invoke("get_mini_mode_state");
}

export async function setMiniModeSize(width: number, height: number): Promise<void> {
  return invoke("set_mini_mode_size", { width, height });
}

export async function moveMiniModeCorner(corner: string): Promise<MiniModeState> {
  return invoke("move_mini_mode_corner", { corner });
}

// Combined mini mode API
export const miniMode = {
  enter: enterMiniMode,
  exit: exitMiniMode,
  toggle: toggleMiniMode,
  getState: getMiniModeState,
  setSize: setMiniModeSize,
  moveCorner: moveMiniModeCorner,
};

// ============================================================================
// Privacy Mode Functions
// ============================================================================

export async function isPrivacyModeActive(): Promise<boolean> {
  return invoke("is_privacy_mode_active");
}

export async function setPrivacyMode(active: boolean): Promise<void> {
  return invoke("set_privacy_mode", { active });
}

export async function togglePrivacyMode(): Promise<boolean> {
  return invoke("toggle_privacy_mode");
}

// Combined privacy mode API
export const privacyMode = {
  isActive: isPrivacyModeActive,
  set: setPrivacyMode,
  toggle: togglePrivacyMode,
};

// ============================================================================
// Accessibility Functions
// ============================================================================

export type ColorBlindMode = "none" | "protanopia" | "deuteranopia" | "tritanopia";

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: number;
  screenReaderEnabled: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  colorBlindMode: ColorBlindMode;
  captionsEnabled: boolean;
  autoPlayMedia: boolean;
  animationSpeed: number;
}

export interface SystemA11yState {
  reducedMotion: boolean;
  highContrast: boolean;
  screenReaderActive: boolean;
}

export async function getAccessibilitySettings(): Promise<AccessibilitySettings | null> {
  return invoke("get_accessibility_settings");
}

export async function saveAccessibilitySettings(settings: AccessibilitySettings): Promise<void> {
  return invoke("save_accessibility_settings", { settings });
}

export async function getSystemAccessibilityState(): Promise<SystemA11yState> {
  return invoke("get_system_accessibility_state");
}

// Combined accessibility API
export const accessibility = {
  getSettings: getAccessibilitySettings,
  saveSettings: saveAccessibilitySettings,
  getSystemState: getSystemAccessibilityState,
};

// ============================================================================
// File Watcher Functions
// ============================================================================

export interface FileChangeEvent {
  watcher_id: number;
  path: string;
  change_type: string;
  file_name: string;
  size: number;
  timestamp: number;
}

export interface WatcherInfo {
  id: number;
  path: string;
  active: boolean;
}

export async function watchDirectory(path: string, recursive?: boolean): Promise<number> {
  return invoke("watch_directory", { path, recursive });
}

export async function unwatchDirectory(watcherId: number): Promise<void> {
  return invoke("unwatch_directory", { watcherId });
}

export async function unwatchAll(): Promise<number> {
  return invoke("unwatch_all");
}

export async function listWatchers(): Promise<WatcherInfo[]> {
  return invoke("list_watchers");
}

export function onFileChange(callback: (event: FileChangeEvent) => void): Promise<UnlistenFn> {
  return listen<FileChangeEvent>("file-watcher:change", (event) => {
    callback(event.payload);
  });
}

// Combined file watcher API
export const fileWatcher = {
  watch: watchDirectory,
  unwatch: unwatchDirectory,
  unwatchAll,
  list: listWatchers,
  onChange: onFileChange,
};

// ============================================================================
// Session Lock Functions
// ============================================================================

export interface SessionLockStatus {
  is_locked: boolean;
  locked_since: number;
  locked_duration_secs: number;
}

export interface SessionLockEvent {
  locked: boolean;
  lock_duration_secs?: number;
  timestamp: number;
}

export async function getSessionLockStatus(): Promise<SessionLockStatus> {
  return invoke("get_session_lock_status");
}

export async function isSessionLocked(): Promise<boolean> {
  return invoke("is_session_locked");
}

export async function startSessionLockMonitor(): Promise<void> {
  return invoke("start_session_lock_monitor");
}

export async function stopSessionLockMonitor(): Promise<void> {
  return invoke("stop_session_lock_monitor");
}

export function onSessionLockChanged(callback: (event: SessionLockEvent) => void): Promise<UnlistenFn> {
  return listen<SessionLockEvent>("session-lock:changed", (event) => {
    callback(event.payload);
  });
}

// Combined session lock API
export const sessionLock = {
  getStatus: getSessionLockStatus,
  isLocked: isSessionLocked,
  startMonitor: startSessionLockMonitor,
  stopMonitor: stopSessionLockMonitor,
  onChanged: onSessionLockChanged,
};

// ============================================================================
// Quick Reply Functions
// ============================================================================

export async function quickreplyLoad(): Promise<string> {
  return invoke("quickreply_load");
}

export async function quickreplySave(data: string): Promise<void> {
  return invoke("quickreply_save", { data });
}

export async function quickreplyStats(): Promise<string> {
  return invoke("quickreply_stats");
}

export async function quickreplyClear(): Promise<void> {
  return invoke("quickreply_clear");
}

export async function quickreplyExport(exportPath: string): Promise<void> {
  return invoke("quickreply_export", { exportPath });
}

export async function quickreplyImport(importPath: string): Promise<string> {
  return invoke("quickreply_import", { importPath });
}

// Combined quick reply API
export const quickReply = {
  load: quickreplyLoad,
  save: quickreplySave,
  stats: quickreplyStats,
  clear: quickreplyClear,
  export: quickreplyExport,
  import: quickreplyImport,
};

// ============================================================================
// Auto-Away Functions
// ============================================================================

export type PresenceTier = "active" | "idle" | "away";

export interface AutoAwayState {
  tier: PresenceTier;
  idle_seconds: number;
  idle_threshold: number;
  away_threshold: number;
  monitor_active: boolean;
  screen_locked: boolean;
}

export interface AutoAwayConfig {
  idle_threshold: number;
  away_threshold: number;
}

export async function getAutoAwayState(): Promise<AutoAwayState> {
  return invoke("get_auto_away_state");
}

export async function getAutoAwayConfig(): Promise<AutoAwayConfig> {
  return invoke("get_auto_away_config");
}

export async function setAutoAwayConfig(idleThreshold: number, awayThreshold: number): Promise<AutoAwayConfig> {
  return invoke("set_auto_away_config", { idleThreshold, awayThreshold });
}

export async function startAutoAwayMonitor(): Promise<void> {
  return invoke("start_auto_away_monitor");
}

export async function stopAutoAwayMonitor(): Promise<void> {
  return invoke("stop_auto_away_monitor");
}

export function onAutoAwayChanged(callback: (state: AutoAwayState) => void): Promise<UnlistenFn> {
  return listen<AutoAwayState>("auto-away:changed", (event) => {
    callback(event.payload);
  });
}

// Combined auto-away API
export const autoAway = {
  getState: getAutoAwayState,
  getConfig: getAutoAwayConfig,
  setConfig: setAutoAwayConfig,
  startMonitor: startAutoAwayMonitor,
  stopMonitor: stopAutoAwayMonitor,
  onChanged: onAutoAwayChanged,
};

// ============================================================================
// Link Preview Functions
// ============================================================================

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  favicon?: string;
  content_type?: string;
  theme_color?: string;
  video_url?: string;
  author?: string;
  published?: string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  return invoke("fetch_link_preview", { url });
}

export async function fetchLinkPreviews(urls: string[]): Promise<LinkPreview[]> {
  return invoke("fetch_link_previews", { urls });
}

export async function clearLinkPreviewCache(): Promise<void> {
  return invoke("clear_link_preview_cache");
}

// Combined link preview API
export const linkPreview = {
  fetch: fetchLinkPreview,
  fetchMultiple: fetchLinkPreviews,
  clearCache: clearLinkPreviewCache,
};

// ============================================================================
// Locale Functions
// ============================================================================

export interface LocaleInfo {
  locale: string;
  language: string;
  region: string;
  display_name: string;
}

export async function getSystemLocale(): Promise<LocaleInfo> {
  return invoke("get_system_locale");
}

// Combined locale API
export const locale = {
  getSystem: getSystemLocale,
};

// ============================================================================
// System Health Monitor Functions
// ============================================================================

export interface SystemHealthSnapshot {
  cpu_usage: number;
  cpu_per_core: number[];
  cpu_cores: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  swap_total: number;
  swap_used: number;
  disk_available: number;
  disk_total: number;
  disk_percent: number;
  load_average: [number, number, number];
  system_uptime: number;
  timestamp: number;
}

export async function getSystemHealth(): Promise<SystemHealthSnapshot> {
  return invoke("get_system_health");
}

export async function startSystemMonitor(intervalSecs?: number): Promise<void> {
  return invoke("start_system_monitor", { intervalSecs });
}

export async function stopSystemMonitor(): Promise<void> {
  return invoke("stop_system_monitor");
}

export async function isSystemMonitorRunning(): Promise<boolean> {
  return invoke("is_system_monitor_running");
}

export function onSystemHealthUpdate(callback: (snapshot: SystemHealthSnapshot) => void): Promise<UnlistenFn> {
  return listen<SystemHealthSnapshot>("system-health:update", (event) => {
    callback(event.payload);
  });
}

// Combined system health API
export const systemHealth = {
  get: getSystemHealth,
  startMonitor: startSystemMonitor,
  stopMonitor: stopSystemMonitor,
  isMonitorRunning: isSystemMonitorRunning,
  onUpdate: onSystemHealthUpdate,
};

// ============================================================================
// Session Restore Functions
// ============================================================================

export interface SessionWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
  monitor?: string;
}

export interface ChannelState {
  channel_id: string;
  server_id?: string;
  scroll_position: number;
  draft_content?: string;
  pinned: boolean;
}

export interface SidebarState {
  collapsed_categories: string[];
  collapsed_servers: string[];
  width: number;
}

export interface SessionState {
  version: number;
  timestamp: number;
  active_channel_id?: string;
  active_server_id?: string;
  open_channels: ChannelState[];
  window_state: SessionWindowState;
  sidebar_state: SidebarState;
  split_view_enabled: boolean;
  split_view_channels: string[];
  theme?: string;
  zoom_level: number;
  custom_data: Record<string, string>;
}

export async function saveSessionState(state: SessionState): Promise<void> {
  return invoke("save_session_state", { state });
}

export async function loadSessionState(): Promise<SessionState | null> {
  return invoke("load_session_state");
}

export async function clearSessionState(): Promise<void> {
  return invoke("clear_session_state");
}

export async function restoreFromBackup(): Promise<SessionState | null> {
  return invoke("restore_from_backup");
}

export async function getSessionInfo(): Promise<Record<string, unknown>> {
  return invoke("get_session_info");
}

export async function captureSessionWindowState(): Promise<SessionWindowState> {
  return invoke("capture_window_state");
}

export async function restoreSessionWindowState(state: SessionWindowState): Promise<void> {
  return invoke("restore_window_state", { state });
}

// Combined session restore API
export const sessionRestore = {
  save: saveSessionState,
  load: loadSessionState,
  clear: clearSessionState,
  restoreFromBackup,
  getInfo: getSessionInfo,
  captureWindow: captureSessionWindowState,
  restoreWindow: restoreSessionWindowState,
};

// ============================================================================
// Local Search (FTS5) Functions
// ============================================================================

export interface SearchResult {
  message_id: string;
  channel_id: string;
  server_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  snippet: string;
  timestamp: number;
  relevance: number;
  has_attachments: boolean;
  has_embeds: boolean;
  is_pinned: boolean;
}

export interface IndexableMessage {
  message_id: string;
  channel_id: string;
  server_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  timestamp: number;
  has_attachments: boolean;
  has_embeds: boolean;
  is_pinned: boolean;
  is_edited: boolean;
}

export interface SearchOptions {
  query: string;
  channel_ids?: string[];
  server_ids?: string[];
  author_ids?: string[];
  from_date?: number;
  to_date?: number;
  has_attachments?: boolean;
  has_embeds?: boolean;
  is_pinned?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface IndexStats {
  total_messages: number;
  total_channels: number;
  total_servers: number;
  index_size_bytes: number;
  last_indexed_at?: number;
  oldest_message?: number;
  newest_message?: number;
}

export async function searchMessages(options: SearchOptions): Promise<SearchResult[]> {
  return invoke("search_messages", { options });
}

export async function indexMessage(message: IndexableMessage): Promise<void> {
  return invoke("index_message", { message });
}

export async function indexMessagesBatch(messages: IndexableMessage[]): Promise<number> {
  return invoke("index_messages_batch", { messages });
}

export async function deleteIndexedMessage(messageId: string): Promise<void> {
  return invoke("delete_indexed_message", { messageId });
}

export async function getSearchStats(): Promise<IndexStats> {
  return invoke("get_search_stats");
}

export async function optimizeSearchIndex(): Promise<void> {
  return invoke("optimize_search_index");
}

export async function clearSearchIndex(): Promise<void> {
  return invoke("clear_search_index");
}

// Combined local search API
export const localSearch = {
  search: searchMessages,
  index: indexMessage,
  indexBatch: indexMessagesBatch,
  delete: deleteIndexedMessage,
  getStats: getSearchStats,
  optimize: optimizeSearchIndex,
  clear: clearSearchIndex,
};

// ============================================================================
// Backup & Restore Functions
// ============================================================================

export interface BackupMetadata {
  version: string;
  created_at: string;
  app_version: string;
  platform: string;
  categories: string[];
}

export interface ScheduledBackup {
  enabled: boolean;
  frequency: string;
  last_backup?: string;
  next_backup?: string;
  keep_count: number;
}

export async function getBackupHistory(): Promise<BackupMetadata[]> {
  return invoke("get_backup_history");
}

export async function getBackupSchedule(): Promise<ScheduledBackup> {
  return invoke("get_backup_schedule");
}

export async function setBackupSchedule(schedule: ScheduledBackup): Promise<void> {
  return invoke("set_backup_schedule", { schedule });
}

export async function registerBackup(metadata: BackupMetadata): Promise<void> {
  return invoke("register_backup", { metadata });
}

export async function deleteBackup(createdAt: string): Promise<void> {
  return invoke("delete_backup", { createdAt });
}

export async function exportSettings(): Promise<unknown> {
  return invoke("export_settings");
}

export async function importSettings(data: unknown): Promise<void> {
  return invoke("import_settings", { data });
}

export async function exportThemes(): Promise<unknown> {
  return invoke("export_themes");
}

export async function importThemes(data: unknown): Promise<void> {
  return invoke("import_themes", { data });
}

export async function exportShortcuts(): Promise<unknown> {
  return invoke("export_shortcuts");
}

export async function importShortcuts(data: unknown): Promise<void> {
  return invoke("import_shortcuts", { data });
}

export async function exportLayouts(): Promise<unknown> {
  return invoke("export_layouts");
}

export async function importLayouts(data: unknown): Promise<void> {
  return invoke("import_layouts", { data });
}

export async function runScheduledBackup(): Promise<void> {
  return invoke("run_scheduled_backup");
}

// Combined backup API
export const backup = {
  getHistory: getBackupHistory,
  getSchedule: getBackupSchedule,
  setSchedule: setBackupSchedule,
  register: registerBackup,
  delete: deleteBackup,
  exportSettings,
  importSettings,
  exportThemes,
  importThemes,
  exportShortcuts,
  importShortcuts,
  exportLayouts,
  importLayouts,
  runScheduled: runScheduledBackup,
};

// ============================================================================
// Text-to-Speech Functions
// ============================================================================

export enum TTSPriority {
  Low = 0,
  Normal = 1,
  High = 2,
  Urgent = 3,
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  local: boolean;
}

export interface TTSSettings {
  enabled: boolean;
  voice_id?: string;
  rate: number;
  pitch: number;
  volume: number;
  auto_read_messages: boolean;
  auto_read_notifications: boolean;
  announce_user_join_leave: boolean;
  read_usernames: boolean;
  read_timestamps: boolean;
}

export interface TTSQueueItem {
  id: string;
  text: string;
  priority: TTSPriority;
  voice_id?: string;
}

export interface TTSStatus {
  is_speaking: boolean;
  current_item_id?: string;
  queue_length: number;
}

export async function ttsInit(): Promise<boolean> {
  return invoke("tts_init");
}

export async function ttsGetVoices(): Promise<TTSVoice[]> {
  return invoke("tts_get_voices");
}

export async function ttsGetSettings(): Promise<TTSSettings> {
  return invoke("tts_get_settings");
}

export async function ttsSetSettings(settings: TTSSettings): Promise<void> {
  return invoke("tts_set_settings", { settings });
}

export async function ttsSpeak(text: string, priority?: TTSPriority): Promise<string> {
  return invoke("tts_speak", { text, priority });
}

export async function ttsStop(): Promise<void> {
  return invoke("tts_stop");
}

export async function ttsPause(): Promise<void> {
  return invoke("tts_pause");
}

export async function ttsResume(): Promise<void> {
  return invoke("tts_resume");
}

export async function ttsGetStatus(): Promise<TTSStatus> {
  return invoke("tts_get_status");
}

export async function ttsSkip(): Promise<void> {
  return invoke("tts_skip");
}

export async function ttsRemoveFromQueue(itemId: string): Promise<boolean> {
  return invoke("tts_remove_from_queue", { itemId });
}

export async function ttsGetQueue(): Promise<TTSQueueItem[]> {
  return invoke("tts_get_queue");
}

// Combined TTS API
export const tts = {
  init: ttsInit,
  getVoices: ttsGetVoices,
  getSettings: ttsGetSettings,
  setSettings: ttsSetSettings,
  speak: ttsSpeak,
  stop: ttsStop,
  pause: ttsPause,
  resume: ttsResume,
  getStatus: ttsGetStatus,
  skip: ttsSkip,
  removeFromQueue: ttsRemoveFromQueue,
  getQueue: ttsGetQueue,
};

// ============================================================================
// Workspace Profiles Functions
// ============================================================================

export interface WorkspaceWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
  fullscreen: boolean;
}

export interface WorkspaceConfig {
  windowState: WorkspaceWindowState;
  theme: string;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  activePanels: string[];
  pinnedChannels: string[];
  focusModeEnabled: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  zoomLevel: number;
  fontSize: string;
  compactMode: boolean;
  customCss?: string;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  config: WorkspaceConfig;
}

export interface ProfilesState {
  profiles: WorkspaceProfile[];
  activeProfileId?: string;
  lastSwitched?: string;
}

export async function loadWorkspaceProfiles(): Promise<ProfilesState> {
  return invoke("load_workspace_profiles");
}

export async function saveWorkspaceProfile(profile: WorkspaceProfile): Promise<void> {
  return invoke("save_workspace_profile", { profile });
}

export async function deleteWorkspaceProfile(profileId: string): Promise<void> {
  return invoke("delete_workspace_profile", { profileId });
}

export async function setActiveProfileId(profileId: string): Promise<void> {
  return invoke("set_active_profile_id", { profileId });
}

export async function captureWorkspaceState(): Promise<WorkspaceConfig> {
  return invoke("capture_workspace_state");
}

export async function applyWorkspaceProfile(profile: WorkspaceProfile): Promise<void> {
  return invoke("apply_workspace_profile", { profile });
}

export async function exportWorkspaceProfile(profile: WorkspaceProfile): Promise<string> {
  return invoke("export_workspace_profile", { profile });
}

export async function importWorkspaceProfile(json: string): Promise<WorkspaceProfile> {
  return invoke("import_workspace_profile", { json });
}

export async function getWorkspaceProfileStats(): Promise<Record<string, unknown>> {
  return invoke("get_workspace_profile_stats");
}

// Combined workspace profiles API
export const workspaceProfiles = {
  load: loadWorkspaceProfiles,
  save: saveWorkspaceProfile,
  delete: deleteWorkspaceProfile,
  setActiveId: setActiveProfileId,
  captureState: captureWorkspaceState,
  apply: applyWorkspaceProfile,
  export: exportWorkspaceProfile,
  import: importWorkspaceProfile,
  getStats: getWorkspaceProfileStats,
};

// ============================================================================
// Window Tabs Functions
// ============================================================================

export interface WindowTab {
  id: string;
  title: string;
  icon?: string;
  route: string;
  isPinned: boolean;
  isModified: boolean;
  createdAt: number;
  lastAccessedAt: number;
}

export interface TabGroup {
  id: string;
  name: string;
  color: string;
  tabIds: string[];
  isCollapsed: boolean;
}

export async function getWindowTabs(): Promise<WindowTab[]> {
  return invoke("get_window_tabs");
}

export async function getTabGroups(): Promise<TabGroup[]> {
  return invoke("get_tab_groups");
}

export async function getActiveTabId(): Promise<string | null> {
  return invoke("get_active_tab_id");
}

export async function saveWindowTabs(tabs: WindowTab[], activeTabId?: string): Promise<void> {
  return invoke("save_window_tabs", { tabs, activeTabId });
}

export async function saveTabGroups(groups: TabGroup[]): Promise<void> {
  return invoke("save_tab_groups", { groups });
}

export async function confirmCloseTab(title: string, message: string): Promise<boolean> {
  return invoke("confirm_close_tab", { title, message });
}

export async function createWindowTab(route: string, title: string): Promise<WindowTab> {
  return invoke("create_window_tab", { route, title });
}

export async function closeWindowTab(tabId: string): Promise<void> {
  return invoke("close_window_tab", { tabId });
}

export async function toggleTabPinned(tabId: string): Promise<boolean> {
  return invoke("toggle_tab_pinned", { tabId });
}

export async function setTabModified(tabId: string, isModified: boolean): Promise<void> {
  return invoke("set_tab_modified", { tabId, isModified });
}

export async function reorderTabs(fromIndex: number, toIndex: number): Promise<void> {
  return invoke("reorder_tabs", { fromIndex, toIndex });
}

export async function createTabGroup(name: string, color: string): Promise<TabGroup> {
  return invoke("create_tab_group", { name, color });
}

export async function addTabToGroup(tabId: string, groupId: string): Promise<void> {
  return invoke("add_tab_to_group", { tabId, groupId });
}

export async function removeTabFromGroups(tabId: string): Promise<void> {
  return invoke("remove_tab_from_groups", { tabId });
}

export async function deleteTabGroup(groupId: string): Promise<void> {
  return invoke("delete_tab_group", { groupId });
}

export async function toggleGroupCollapsed(groupId: string): Promise<boolean> {
  return invoke("toggle_group_collapsed", { groupId });
}

// Combined window tabs API
export const windowTabs = {
  getTabs: getWindowTabs,
  getGroups: getTabGroups,
  getActiveTabId,
  saveTabs: saveWindowTabs,
  saveGroups: saveTabGroups,
  confirmClose: confirmCloseTab,
  create: createWindowTab,
  close: closeWindowTab,
  togglePinned: toggleTabPinned,
  setModified: setTabModified,
  reorder: reorderTabs,
  createGroup: createTabGroup,
  addToGroup: addTabToGroup,
  removeFromGroups: removeTabFromGroups,
  deleteGroup: deleteTabGroup,
  toggleGroupCollapsed,
};

// ============================================================================
// Message Drafts Functions
// ============================================================================

export interface Draft {
  channel_id: string;
  content: string;
  reply_to?: string;
  attachments: string[];
  updated_at: number;
  created_at: number;
}

export async function saveDraft(
  channelId: string,
  content: string,
  replyTo?: string,
  attachments?: string[],
): Promise<Draft> {
  return invoke("save_draft", { channelId, content, replyTo, attachments });
}

export async function getDraft(channelId: string): Promise<Draft | null> {
  return invoke("get_draft", { channelId });
}

export async function deleteDraft(channelId: string): Promise<boolean> {
  return invoke("delete_draft", { channelId });
}

export async function getAllDrafts(): Promise<Draft[]> {
  return invoke("get_all_drafts");
}

export async function getDraftCount(): Promise<number> {
  return invoke("get_draft_count");
}

export async function clearAllDrafts(): Promise<number> {
  return invoke("clear_all_drafts");
}

export async function cleanupStaleDrafts(maxAgeMs: number): Promise<number> {
  return invoke("cleanup_stale_drafts", { maxAgeMs });
}

export async function loadDrafts(draftsData: Draft[]): Promise<number> {
  return invoke("load_drafts", { draftsData });
}

// Combined drafts API
export const drafts = {
  save: saveDraft,
  get: getDraft,
  delete: deleteDraft,
  getAll: getAllDrafts,
  getCount: getDraftCount,
  clearAll: clearAllDrafts,
  cleanupStale: cleanupStaleDrafts,
  load: loadDrafts,
};

// ============================================================================
// Quick Capture Functions
// ============================================================================

export interface QuickCaptureConfig {
  width: number;
  height: number;
  always_on_top: boolean;
  center_on_screen: boolean;
  remember_position: boolean;
}

export interface QuickCaptureState {
  is_visible: boolean;
  last_x?: number;
  last_y?: number;
}

export async function quickCaptureShow(): Promise<void> {
  return invoke("quick_capture_show");
}

export async function quickCaptureHide(): Promise<void> {
  return invoke("quick_capture_hide");
}

export async function quickCaptureToggle(): Promise<void> {
  return invoke("quick_capture_toggle");
}

export async function quickCaptureGetConfig(): Promise<QuickCaptureConfig> {
  return invoke("quick_capture_get_config");
}

export async function quickCaptureSetConfig(config: QuickCaptureConfig): Promise<void> {
  return invoke("quick_capture_set_config", { config });
}

export async function quickCaptureGetState(): Promise<QuickCaptureState> {
  return invoke("quick_capture_get_state");
}

export async function quickCaptureIsVisible(): Promise<boolean> {
  return invoke("quick_capture_is_visible");
}

// Combined quick capture API
export const quickCapture = {
  show: quickCaptureShow,
  hide: quickCaptureHide,
  toggle: quickCaptureToggle,
  getConfig: quickCaptureGetConfig,
  setConfig: quickCaptureSetConfig,
  getState: quickCaptureGetState,
  isVisible: quickCaptureIsVisible,
};

// ============================================================================
// Smart Status Detection Functions
// ============================================================================

export async function detectMeeting(): Promise<boolean> {
  return invoke("detect_meeting");
}

export async function detectScreenShare(): Promise<boolean> {
  return invoke("detect_screen_share");
}

export async function detectMusicPlaying(): Promise<boolean> {
  return invoke("detect_music_playing");
}

export async function detectGaming(): Promise<boolean> {
  return invoke("detect_gaming");
}

export async function getIdleTime(): Promise<number> {
  return invoke("get_idle_time");
}

export async function setUserStatus(
  status: string,
  message?: string,
  emoji?: string,
): Promise<void> {
  return invoke("set_user_status", { status, message, emoji });
}

// Combined smart status API
export const smartStatus = {
  detectMeeting,
  detectScreenShare,
  detectMusicPlaying,
  detectGaming,
  getIdleTime,
  setUserStatus,
};

// ============================================================================
// Network Monitor Functions
// ============================================================================

export interface NetworkInterface {
  name: string;
  is_up: boolean;
  ip_addresses: string[];
}

export interface NetworkStatus {
  is_online: boolean;
  network_type: string;
  interfaces: NetworkInterface[];
}

export interface LatencyResult {
  host: string;
  latency_ms?: number;
  reachable: boolean;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  return invoke("get_network_status");
}

export async function isOnline(): Promise<boolean> {
  return invoke("is_online");
}

export async function measureLatency(host: string): Promise<LatencyResult> {
  return invoke("measure_latency", { host });
}

export async function startNetworkMonitor(): Promise<void> {
  return invoke("start_network_monitor");
}

export async function stopNetworkMonitor(): Promise<void> {
  return invoke("stop_network_monitor");
}

// Combined network monitor API
export const networkMonitor = {
  getStatus: getNetworkStatus,
  isOnline,
  measureLatency,
  startMonitor: startNetworkMonitor,
  stopMonitor: stopNetworkMonitor,
};

// ============================================================================
// Bandwidth Monitor Functions
// ============================================================================

export interface BandwidthStats {
  bytes_sent: number;
  bytes_received: number;
  session_start: number;
  peak_download_rate: number;
  peak_upload_rate: number;
  current_download_rate: number;
  current_upload_rate: number;
}

export async function bandwidthRecordSent(bytes: number): Promise<void> {
  return invoke("bandwidth_record_sent", { bytes });
}

export async function bandwidthRecordReceived(bytes: number): Promise<void> {
  return invoke("bandwidth_record_received", { bytes });
}

export async function bandwidthGetStats(): Promise<BandwidthStats> {
  return invoke("bandwidth_get_stats");
}

export async function bandwidthReset(): Promise<void> {
  return invoke("bandwidth_reset");
}

export async function bandwidthStartMonitor(): Promise<void> {
  return invoke("bandwidth_start_monitor");
}

export async function bandwidthStopMonitor(): Promise<void> {
  return invoke("bandwidth_stop_monitor");
}

// Combined bandwidth API
export const bandwidth = {
  recordSent: bandwidthRecordSent,
  recordReceived: bandwidthRecordReceived,
  getStats: bandwidthGetStats,
  reset: bandwidthReset,
  startMonitor: bandwidthStartMonitor,
  stopMonitor: bandwidthStopMonitor,
};

// ============================================================================
// Calendar Integration Functions
// ============================================================================

export interface CalendarEvent {
  title: string;
  start_time: number;
  end_time: number;
  is_all_day: boolean;
  location?: string;
  calendar_name?: string;
}

export async function calendarCheckInMeeting(): Promise<boolean> {
  return invoke("calendar_check_in_meeting");
}

export async function calendarGetNextEvent(): Promise<CalendarEvent | null> {
  return invoke("calendar_get_next_event");
}

export async function calendarGetCurrentEvents(): Promise<CalendarEvent[]> {
  return invoke("calendar_get_current_events");
}

export async function calendarGetUpcomingEvents(lookaheadSecs: number): Promise<CalendarEvent[]> {
  return invoke("calendar_get_upcoming_events", { lookaheadSecs });
}

// Combined calendar API
export const calendar = {
  checkInMeeting: calendarCheckInMeeting,
  getNextEvent: calendarGetNextEvent,
  getCurrentEvents: calendarGetCurrentEvents,
  getUpcomingEvents: calendarGetUpcomingEvents,
};

// ============================================================================
// Native Auth / Keychain Functions
// ============================================================================

export interface KeychainEntry {
  service: string;
  account: string;
  label?: string;
}

export interface BiometricCapabilities {
  available: boolean;
  methods: string[];
}

export async function keychainSet(key: string, value: string): Promise<void> {
  return invoke("keychain_set", { key, value });
}

export async function keychainGet(key: string): Promise<string | null> {
  return invoke("keychain_get", { key });
}

export async function keychainDelete(key: string): Promise<void> {
  return invoke("keychain_delete", { key });
}

export async function keychainBiometricAvailable(): Promise<BiometricCapabilities> {
  return invoke("keychain_biometric_available");
}

export async function keychainList(): Promise<KeychainEntry[]> {
  return invoke("keychain_list");
}

// Combined keychain API
export const keychain = {
  set: keychainSet,
  get: keychainGet,
  delete: keychainDelete,
  biometricAvailable: keychainBiometricAvailable,
  list: keychainList,
};

// ============================================================================
// QR Code Functions
// ============================================================================

export type QrContent =
  | { type: "Text"; data: string }
  | { type: "Wifi"; data: { ssid: string; password: string; encryption: string } }
  | { type: "Contact"; data: { name: string; phone?: string; email?: string } }
  | { type: "ServerInvite"; data: { code: string; server_name?: string } }
  | { type: "VoiceInvite"; data: { channel_id: string; server_id: string } };

export interface QrOptions {
  size?: number;
  error_correction?: string;
  fg_color?: string;
  bg_color?: string;
  quiet_zone?: boolean;
}

export interface QrResult {
  image_base64: string;
  width: number;
  height: number;
  content: string;
}

export interface ScanResult {
  content: string;
  content_type: QrContent;
  confidence: number;
}

export interface QrHistoryEntry {
  id: string;
  content: QrContent;
  action: string;
  timestamp: number;
  image_base64?: string;
}

export async function qrGenerate(content: QrContent, options?: QrOptions): Promise<QrResult> {
  return invoke("qr_generate", { content, options });
}

export async function qrScan(imageBase64: string): Promise<ScanResult> {
  return invoke("qr_scan", { imageBase64 });
}

export async function qrGetHistory(limit?: number): Promise<QrHistoryEntry[]> {
  return invoke("qr_get_history", { limit });
}

export async function qrClearHistory(): Promise<void> {
  return invoke("qr_clear_history");
}

export async function qrGenerateInvite(inviteCode: string, serverName?: string, options?: QrOptions): Promise<QrResult> {
  return invoke("qr_generate_invite", { inviteCode, serverName, options });
}

export async function qrGenerateWifi(ssid: string, password: string, encryption?: string, options?: QrOptions): Promise<QrResult> {
  return invoke("qr_generate_wifi", { ssid, password, encryption, options });
}

// Combined QR code API
export const qrCode = {
  generate: qrGenerate,
  scan: qrScan,
  getHistory: qrGetHistory,
  clearHistory: qrClearHistory,
  generateInvite: qrGenerateInvite,
  generateWifi: qrGenerateWifi,
};

// ============================================================================
// Message Scheduler Functions
// ============================================================================

export type MessageStatus = "pending" | "sent" | "failed" | "cancelled";

export interface ScheduledMessage {
  id: string;
  channel_id: string;
  content: string;
  scheduled_at: number;
  created_at: number;
  status: MessageStatus;
  attachments: string[];
  reply_to?: string;
}

export interface ScheduleMessageRequest {
  channel_id: string;
  content: string;
  scheduled_at: number;
  attachments?: string[];
  reply_to?: string;
}

export interface UpdateScheduledRequest {
  id: string;
  content?: string;
  scheduled_at?: number;
}

export async function scheduleMessage(request: ScheduleMessageRequest): Promise<ScheduledMessage> {
  return invoke("schedule_message", { request });
}

export async function cancelScheduledMessage(id: string): Promise<ScheduledMessage> {
  return invoke("cancel_scheduled_message", { id });
}

export async function updateScheduledMessage(request: UpdateScheduledRequest): Promise<ScheduledMessage> {
  return invoke("update_scheduled_message", { request });
}

export async function getScheduledMessages(): Promise<ScheduledMessage[]> {
  return invoke("get_scheduled_messages");
}

export async function getChannelScheduledMessages(channelId: string): Promise<ScheduledMessage[]> {
  return invoke("get_channel_scheduled_messages", { channelId });
}

export async function markScheduledSent(id: string): Promise<void> {
  return invoke("mark_scheduled_sent", { id });
}

export async function markScheduledFailed(id: string, reason: string): Promise<void> {
  return invoke("mark_scheduled_failed", { id, reason });
}

// Combined message scheduler API
export const messageScheduler = {
  schedule: scheduleMessage,
  cancel: cancelScheduledMessage,
  update: updateScheduledMessage,
  getAll: getScheduledMessages,
  getByChannel: getChannelScheduledMessages,
  markSent: markScheduledSent,
  markFailed: markScheduledFailed,
};

// ============================================================================
// Voice Recorder Functions
// ============================================================================

export interface RecordingConfig {
  device: string;
  quality: string;
  format: string;
  noise_reduction: boolean;
}

export interface RecordingResult {
  filePath: string;
  duration: number;
}

export interface RecorderAudioDevice {
  id: string;
  name: string;
}

export async function startVoiceRecording(config: RecordingConfig): Promise<unknown> {
  return invoke("start_voice_recording", { config });
}

export async function stopVoiceRecording(): Promise<RecordingResult> {
  return invoke("stop_voice_recording");
}

export async function pauseVoiceRecording(): Promise<void> {
  return invoke("pause_voice_recording");
}

export async function resumeVoiceRecording(): Promise<void> {
  return invoke("resume_voice_recording");
}

export async function cancelVoiceRecording(): Promise<void> {
  return invoke("cancel_voice_recording");
}

export async function getAudioLevel(): Promise<number> {
  return invoke("get_audio_level");
}

export async function listAudioInputDevices(): Promise<RecorderAudioDevice[]> {
  return invoke("list_audio_input_devices");
}

// Combined voice recorder API
export const voiceRecorder = {
  start: startVoiceRecording,
  stop: stopVoiceRecording,
  pause: pauseVoiceRecording,
  resume: resumeVoiceRecording,
  cancel: cancelVoiceRecording,
  getAudioLevel,
  listDevices: listAudioInputDevices,
};

// ============================================================================
// Dictation / Speech-to-Text Functions
// ============================================================================

export interface DictationConfig {
  language: string;
  continuousMode: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  profanityFilter: boolean;
}

export interface SpeechAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives: SpeechAlternative[];
}

export interface SupportedLanguage {
  code: string;
  name: string;
  native_name: string;
}

export interface DictationStatus {
  isListening: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  currentTranscript: string;
}

export async function checkDictationAvailable(): Promise<boolean> {
  return invoke("check_dictation_available");
}

export async function requestDictationPermission(): Promise<boolean> {
  return invoke("request_dictation_permission");
}

export async function getSupportedLanguages(): Promise<SupportedLanguage[]> {
  return invoke("get_supported_languages");
}

export async function startDictation(config: DictationConfig): Promise<void> {
  return invoke("start_dictation", { config });
}

export async function stopDictation(): Promise<SpeechResult> {
  return invoke("stop_dictation");
}

export async function pauseDictation(): Promise<void> {
  return invoke("pause_dictation");
}

export async function resumeDictation(): Promise<void> {
  return invoke("resume_dictation");
}

export async function cancelDictation(): Promise<void> {
  return invoke("cancel_dictation");
}

export async function getDictationStatus(): Promise<DictationStatus> {
  return invoke("get_dictation_status");
}

export async function getDictationAudioLevel(): Promise<number> {
  return invoke("get_dictation_audio_level");
}

export async function updateDictationTranscript(transcript: string): Promise<void> {
  return invoke("update_dictation_transcript", { transcript });
}

export async function addPunctuation(punctuation: string): Promise<string> {
  return invoke("add_punctuation", { punctuation });
}

// Combined dictation API
export const dictation = {
  checkAvailable: checkDictationAvailable,
  requestPermission: requestDictationPermission,
  getSupportedLanguages,
  start: startDictation,
  stop: stopDictation,
  pause: pauseDictation,
  resume: resumeDictation,
  cancel: cancelDictation,
  getStatus: getDictationStatus,
  getAudioLevel: getDictationAudioLevel,
  updateTranscript: updateDictationTranscript,
  addPunctuation,
};

// ============================================================================
// Hot Corners Functions
// ============================================================================

export type ScreenCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type HotCornerAction =
  | "none"
  | "show-notification-center"
  | "toggle-focus-mode"
  | "show-quick-actions"
  | "lock-screen"
  | "show-desktop"
  | "launch-quick-note"
  | "toggle-mute"
  | "start-screen-recording"
  | "show-command-palette"
  | "toggle-do-not-disturb"
  | "show-calendar"
  | { Custom: string };

export interface HotCornerConfig {
  corner: ScreenCorner;
  action: HotCornerAction;
  activation_delay_ms: number;
  enabled: boolean;
  modifier_required?: string;
}

export interface HotCornersSettings {
  enabled: boolean;
  corner_size_px: number;
  corners: Record<string, HotCornerConfig>;
  show_visual_feedback: boolean;
  sound_feedback: boolean;
  disabled_in_fullscreen: boolean;
}

export async function hotcornersGetSettings(): Promise<HotCornersSettings> {
  return invoke("hotcorners_get_settings");
}

export async function hotcornersUpdateSettings(settings: HotCornersSettings): Promise<void> {
  return invoke("hotcorners_update_settings", { settings });
}

export async function hotcornersCheckPosition(x: number, y: number): Promise<HotCornerAction | null> {
  return invoke("hotcorners_check_position", { x, y });
}

export async function hotcornersSetScreenDimensions(width: number, height: number): Promise<void> {
  return invoke("hotcorners_set_screen_dimensions", { width, height });
}

export async function hotcornersSetCornerAction(corner: ScreenCorner, action: HotCornerAction): Promise<void> {
  return invoke("hotcorners_set_corner_action", { corner, action });
}

export async function hotcornersSetCornerEnabled(corner: ScreenCorner, enabled: boolean): Promise<void> {
  return invoke("hotcorners_set_corner_enabled", { corner, enabled });
}

export async function hotcornersResetTracking(): Promise<void> {
  return invoke("hotcorners_reset_tracking");
}

export async function hotcornersGetAvailableActions(): Promise<[string, string][]> {
  return invoke("hotcorners_get_available_actions");
}

// Combined hot corners API
export const hotCorners = {
  getSettings: hotcornersGetSettings,
  updateSettings: hotcornersUpdateSettings,
  checkPosition: hotcornersCheckPosition,
  setScreenDimensions: hotcornersSetScreenDimensions,
  setCornerAction: hotcornersSetCornerAction,
  setCornerEnabled: hotcornersSetCornerEnabled,
  resetTracking: hotcornersResetTracking,
  getAvailableActions: hotcornersGetAvailableActions,
};

// ============================================================================
// App Log Functions
// ============================================================================

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: unknown;
}

export interface LogFilter {
  minLevel?: string;
  module?: string;
  search?: string;
  since?: string;
  limit?: number;
}

export interface LogStats {
  totalEntries: number;
  traceCount: number;
  debugCount: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  oldestEntry?: string;
  newestEntry?: string;
  modules: string[];
}

export async function applogGetEntries(filter: LogFilter): Promise<LogEntry[]> {
  return invoke("applog_get_entries", { filter });
}

export async function applogGetStats(): Promise<LogStats> {
  return invoke("applog_get_stats");
}

export async function applogClear(): Promise<void> {
  return invoke("applog_clear");
}

export async function applogExport(format: string): Promise<string> {
  return invoke("applog_export", { format });
}

export async function applogLog(level: string, module: string, message: string, context?: unknown): Promise<void> {
  return invoke("applog_log", { level, module, message, context });
}

// Combined app log API
export const appLog = {
  getEntries: applogGetEntries,
  getStats: applogGetStats,
  clear: applogClear,
  export: applogExport,
  log: applogLog,
};

// ============================================================================
// Diagnostics Functions
// ============================================================================

export type DiagnosticStatus = "pass" | "warn" | "fail" | "skip";

export interface DiagnosticResult {
  name: string;
  category: string;
  status: DiagnosticStatus;
  message: string;
  details?: string;
  latency_ms?: number;
  fix_suggestion?: string;
}

export interface DiagnosticSummary {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  skipped: number;
  overall_health: string;
}

export interface DiagnosticReport {
  timestamp: string;
  platform: string;
  app_version: string;
  results: DiagnosticResult[];
  summary: DiagnosticSummary;
}

export async function runDiagnostics(): Promise<DiagnosticReport> {
  return invoke("run_diagnostics");
}

export async function runSingleDiagnostic(checkName: string): Promise<DiagnosticResult> {
  return invoke("run_single_diagnostic", { checkName });
}

export async function exportDiagnosticReport(report: DiagnosticReport, path: string): Promise<string> {
  return invoke("export_diagnostic_report", { report, path });
}

// Combined diagnostics API
export const diagnostics = {
  run: runDiagnostics,
  runSingle: runSingleDiagnostic,
  exportReport: exportDiagnosticReport,
};

// ============================================================================
// Native Share Functions
// ============================================================================

export interface ShareItem {
  title?: string;
  text?: string;
  url?: string;
  file_paths?: string[];
}

export interface ShareResult {
  success: boolean;
  error?: string;
  shared_to?: string;
}

export interface ShareTarget {
  id: string;
  name: string;
  icon?: string;
}

export async function getShareTargets(): Promise<ShareTarget[]> {
  return invoke("get_share_targets");
}

export async function shareContent(item: ShareItem, targetId?: string): Promise<ShareResult> {
  return invoke("share_content", { item, targetId });
}

export async function isShareAvailable(): Promise<boolean> {
  return invoke("is_share_available");
}

export async function getShareIcon(): Promise<string> {
  return invoke("get_share_icon");
}

// Combined native share API
export const nativeShare = {
  getTargets: getShareTargets,
  share: shareContent,
  isAvailable: isShareAvailable,
  getIcon: getShareIcon,
};

// ============================================================================
// Translation Functions
// ============================================================================

export interface TranslationResult {
  translated_text: string;
  source_language: string;
  target_language: string;
  confidence: number;
  provider: string;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  return invoke("detect_language", { text });
}

export async function translateText(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
  return invoke("translate_text", { text, sourceLang, targetLang });
}

export async function getTranslationSupportedLanguages(): Promise<Record<string, string>[]> {
  return invoke("get_supported_languages");
}

// Combined translation API
export const translation = {
  detect: detectLanguage,
  translate: translateText,
  getSupportedLanguages: getTranslationSupportedLanguages,
};

// ============================================================================
// Night Light Functions
// ============================================================================

export type NightLightMode = "off" | "manual" | "scheduled" | "sunset-to-sunrise";

export interface NightLightSchedule {
  startTime: string;
  endTime: string;
  transitionMinutes: number;
}

export interface NightLightSettings {
  mode: NightLightMode;
  temperature: number;
  intensity: number;
  isActive: boolean;
  schedule: NightLightSchedule;
  latitude?: number;
  longitude?: number;
}

export interface NightLightStatus {
  settings: NightLightSettings;
  effectiveTemperature: number;
  cssFilter: string;
  nextChange?: string;
  statusText: string;
}

export async function nightlightGetStatus(): Promise<NightLightStatus> {
  return invoke("nightlight_get_status");
}

export async function nightlightGetSettings(): Promise<NightLightSettings> {
  return invoke("nightlight_get_settings");
}

export async function nightlightSetSettings(settings: NightLightSettings): Promise<NightLightStatus> {
  return invoke("nightlight_set_settings", { settings });
}

export async function nightlightToggle(): Promise<NightLightStatus> {
  return invoke("nightlight_toggle");
}

export async function nightlightSetTemperature(temperature: number): Promise<NightLightStatus> {
  return invoke("nightlight_set_temperature", { temperature });
}

export async function nightlightSetMode(mode: NightLightMode): Promise<NightLightStatus> {
  return invoke("nightlight_set_mode", { mode });
}

export async function nightlightSetSchedule(startTime: string, endTime: string, transitionMinutes?: number): Promise<NightLightStatus> {
  return invoke("nightlight_set_schedule", { startTime, endTime, transitionMinutes });
}

export async function nightlightGetPresets(): Promise<[string, number][]> {
  return invoke("nightlight_get_presets");
}

// Combined night light API
export const nightLight = {
  getStatus: nightlightGetStatus,
  getSettings: nightlightGetSettings,
  setSettings: nightlightSetSettings,
  toggle: nightlightToggle,
  setTemperature: nightlightSetTemperature,
  setMode: nightlightSetMode,
  setSchedule: nightlightSetSchedule,
  getPresets: nightlightGetPresets,
};

// ============================================================================
// Widget Functions
// ============================================================================

export interface WidgetSystemStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  diskUsage: number;
}

export interface WidgetWeatherData {
  temp: number;
  condition: string;
  icon: string;
  location: string;
}

export async function getWidgetSystemStats(): Promise<WidgetSystemStats> {
  return invoke("get_widget_system_stats");
}

export async function getWidgetWeather(): Promise<WidgetWeatherData> {
  return invoke("get_widget_weather");
}

// Combined widget API
export const widgets = {
  getSystemStats: getWidgetSystemStats,
  getWeather: getWidgetWeather,
};

// ============================================================================
// Color Picker Functions
// ============================================================================

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export interface ColorValue {
  hex: string;
  rgb: RgbColor;
  hsl: HslColor;
  hsv: HsvColor;
  timestamp: number;
  label?: string;
}

export async function pickColorAtCursor(): Promise<ColorValue> {
  return invoke("pick_color_at_cursor");
}

export async function parseColor(input: string): Promise<ColorValue> {
  return invoke("parse_color", { input });
}

export async function getColorHistory(): Promise<ColorValue[]> {
  return invoke("get_color_history");
}

export async function clearColorHistory(): Promise<void> {
  return invoke("clear_color_history");
}

export async function addColorToFavorites(color: ColorValue): Promise<void> {
  return invoke("add_color_to_favorites", { color });
}

export async function removeColorFromFavorites(hex: string): Promise<void> {
  return invoke("remove_color_from_favorites", { hex });
}

export async function getFavoriteColors(): Promise<ColorValue[]> {
  return invoke("get_favorite_colors");
}

export async function copyColorToClipboard(color: ColorValue, format: string): Promise<void> {
  return invoke("copy_color_to_clipboard", { color, format });
}

export async function generateColorPalette(hex: string, paletteType: string): Promise<ColorValue[]> {
  return invoke("generate_color_palette", { hex, paletteType });
}

// Combined color picker API
export const colorPicker = {
  pickAtCursor: pickColorAtCursor,
  parse: parseColor,
  getHistory: getColorHistory,
  clearHistory: clearColorHistory,
  addToFavorites: addColorToFavorites,
  removeFromFavorites: removeColorFromFavorites,
  getFavorites: getFavoriteColors,
  copyToClipboard: copyColorToClipboard,
  generatePalette: generateColorPalette,
};

// ============================================================================
// Badge (Advanced) Functions
// ============================================================================

export interface BadgeConfig {
  enabled: boolean;
  show_on_muted: boolean;
  max_display_count: number;
}

export async function badgeSetCount(count: number, text?: string, urgent: boolean = false): Promise<void> {
  return invoke("set_badge_count", { count, text, urgent });
}

export async function badgeClear(): Promise<void> {
  return invoke("clear_badge");
}

export async function badgeSetMuted(muted: boolean): Promise<void> {
  return invoke("set_badge_muted", { muted });
}

export async function badgeRequestAttention(critical: boolean): Promise<void> {
  return invoke("request_attention", { critical });
}

export async function badgeIsSupported(): Promise<boolean> {
  return invoke("is_badge_supported");
}

export async function badgeGetCount(): Promise<number> {
  return invoke("get_badge_count");
}

// Combined advanced badge API
export const advancedBadge = {
  setCount: badgeSetCount,
  clear: badgeClear,
  setMuted: badgeSetMuted,
  requestAttention: badgeRequestAttention,
  isSupported: badgeIsSupported,
  getCount: badgeGetCount,
};

// ============================================================================
// Taskbar Progress Functions
// ============================================================================

export type ProgressMode = "none" | "indeterminate" | "normal" | "paused" | "error";

export interface ProgressState {
  active: boolean;
  progress: number;
  mode: ProgressMode;
  label?: string;
}

export interface SetProgressOptions {
  progress?: number;
  mode?: ProgressMode;
  label?: string;
}

export interface OperationProgress {
  id: string;
  label: string;
  total: number;
  completed: number;
  started_at: number;
}

export async function setTaskbarProgress(options: SetProgressOptions): Promise<ProgressState> {
  return invoke("set_taskbar_progress", { options });
}

export async function clearTaskbarProgress(): Promise<void> {
  return invoke("clear_taskbar_progress");
}

export async function getTaskbarProgress(): Promise<ProgressState> {
  return invoke("get_taskbar_progress");
}

export async function startOperation(id: string, label: string, total: number): Promise<OperationProgress> {
  return invoke("start_operation", { id, label, total });
}

export async function updateOperation(id: string, completed: number): Promise<OperationProgress | null> {
  return invoke("update_operation", { id, completed });
}

export async function completeOperation(id: string): Promise<void> {
  return invoke("complete_operation", { id });
}

export async function getOperations(): Promise<OperationProgress[]> {
  return invoke("get_operations");
}

// Combined taskbar progress API
export const taskbarProgress = {
  set: setTaskbarProgress,
  clear: clearTaskbarProgress,
  get: getTaskbarProgress,
  startOperation,
  updateOperation,
  completeOperation,
  getOperations,
};

// ============================================================================
// Media Session Functions
// ============================================================================

export interface MediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork?: string;
  duration?: number;
}

export interface MediaPlaybackState {
  isPlaying: boolean;
  position?: number;
}

export async function mediaSessionRegister(): Promise<void> {
  return invoke("media_session_register");
}

export async function mediaSessionUnregister(): Promise<void> {
  return invoke("media_session_unregister");
}

export async function mediaSessionSetMetadata(metadata: MediaMetadata): Promise<void> {
  return invoke("media_session_set_metadata", { metadata });
}

export async function mediaSessionSetPlaybackState(stateUpdate: MediaPlaybackState): Promise<void> {
  return invoke("media_session_set_playback_state", { stateUpdate });
}

export async function mediaSessionGetState(): Promise<[MediaMetadata, MediaPlaybackState, boolean]> {
  return invoke("media_session_get_state");
}

export async function mediaSessionSimulateAction(action: string): Promise<void> {
  return invoke("media_session_simulate_action", { action });
}

// Combined media session API
export const mediaSession = {
  register: mediaSessionRegister,
  unregister: mediaSessionUnregister,
  setMetadata: mediaSessionSetMetadata,
  setPlaybackState: mediaSessionSetPlaybackState,
  getState: mediaSessionGetState,
  simulateAction: mediaSessionSimulateAction,
};

// ============================================================================
// System Info Functions
// ============================================================================

export interface CpuInfo {
  name: string;
  physicalCores: number;
  logicalCores: number;
  frequencyMhz: number;
  usagePercent: number;
}

export interface SysMemoryInfo {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
  swapTotalBytes: number;
  swapUsedBytes: number;
}

export interface OsInfo {
  name: string;
  version: string;
  kernelVersion: string;
  hostname: string;
  arch: string;
  uptimeSeconds: number;
}

export interface RuntimeInfo {
  tauriVersion: string;
  appVersion: string;
  targetTriple: string;
  buildType: string;
}

export interface SystemInfoFull {
  os: OsInfo;
  cpu: CpuInfo;
  memory: SysMemoryInfo;
  runtime: RuntimeInfo;
}

export async function getSystemInfo(): Promise<SystemInfoFull> {
  return invoke("get_system_info");
}

export async function getOsInfo(): Promise<OsInfo> {
  return invoke("get_os_info");
}

export async function getCpuInfo(): Promise<CpuInfo> {
  return invoke("get_cpu_info");
}

export async function sysinfoGetMemoryInfo(): Promise<SysMemoryInfo> {
  return invoke("get_memory_info");
}

export async function getRuntimeInfo(): Promise<RuntimeInfo> {
  return invoke("get_runtime_info");
}

// Combined system info API
export const systemInfo = {
  getFull: getSystemInfo,
  getOs: getOsInfo,
  getCpu: getCpuInfo,
  getMemory: sysinfoGetMemoryInfo,
  getRuntime: getRuntimeInfo,
};

// ============================================================================
// Activity Detection Functions
// ============================================================================

export interface DetectedActivity {
  name: string;
  process_name: string;
  activity_type: number;
  window_title?: string;
  started_at: number;
}

export async function getRunningActivities(): Promise<DetectedActivity[]> {
  return invoke("get_running_activities");
}

// Combined activity detection API
export const activityDetection = {
  getRunning: getRunningActivities,
};

// ============================================================================
// Extended Window Manager Functions
// ============================================================================

export interface CursorPosition {
  x: number;
  y: number;
}

export interface MonitorInfo {
  name?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  scale_factor: number;
}

export async function getCursorPosition(): Promise<CursorPosition> {
  return invoke("get_cursor_position");
}

export async function getMonitors(): Promise<MonitorInfo[]> {
  return invoke("get_monitors");
}

export async function getAlwaysOnTop(): Promise<boolean> {
  return invoke("get_always_on_top");
}

export async function minimizeToTray(): Promise<void> {
  return invoke("minimize_to_tray");
}

export async function setWindowSize(width: number, height: number): Promise<void> {
  return invoke("set_window_size", { width, height });
}

export async function setWindowPosition(x: number, y: number): Promise<void> {
  return invoke("set_window_position", { x, y });
}

export async function centerWindow(): Promise<void> {
  return invoke("center_window");
}

export async function toggleDecorations(): Promise<boolean> {
  return invoke("toggle_decorations");
}

// Combined extended window manager API
export const extendedWindowManager = {
  getCursorPosition,
  getMonitors,
  getAlwaysOnTop,
  minimizeToTray,
  setSize: setWindowSize,
  setPosition: setWindowPosition,
  center: centerWindow,
  toggleDecorations,
};

// ============================================================================
// Tray Settings Functions
// ============================================================================

export interface TraySettings {
  minimizeToTray: boolean;
  closeToTray: boolean;
  showUnreadBadge: boolean;
  animateBadge: boolean;
  startMinimized: boolean;
  showInDock: boolean;
  singleClickAction: string;
  customTooltip: boolean;
  tooltipTemplate: string;
}

export async function getTraySettings(): Promise<TraySettings> {
  return invoke("get_tray_settings");
}

export async function setTraySettings(settings: TraySettings): Promise<void> {
  return invoke("set_tray_settings", { settings });
}

export async function loadTraySettings(): Promise<TraySettings> {
  return invoke("load_tray_settings");
}

export async function testTrayNotification(): Promise<void> {
  return invoke("test_tray_notification");
}

export async function shouldMinimizeToTray(): Promise<boolean> {
  return invoke("should_minimize_to_tray");
}

export async function shouldCloseToTray(): Promise<boolean> {
  return invoke("should_close_to_tray");
}

// Combined tray settings API
export const traySettings = {
  get: getTraySettings,
  set: setTraySettings,
  load: loadTraySettings,
  testNotification: testTrayNotification,
  shouldMinimize: shouldMinimizeToTray,
  shouldClose: shouldCloseToTray,
};

// ============================================================================
// Version Tracking Functions
// ============================================================================

export async function getLastSeenVersion(): Promise<string> {
  return invoke("get_last_seen_version");
}

export async function setLastSeenVersion(version: string): Promise<void> {
  return invoke("set_last_seen_version", { version });
}

// Combined version tracking API
export const versionTracking = {
  getLastSeen: getLastSeenVersion,
  setLastSeen: setLastSeenVersion,
};

// ============================================================================
// Page HTML Functions
// ============================================================================

export async function fetchPageHtml(url: string): Promise<string> {
  return invoke("fetch_page_html", { url });
}

// Combined page HTML API
export const pageHtml = {
  fetch: fetchPageHtml,
};

// ============================================================================
// Proxy Settings Functions
// ============================================================================

export interface ProxyConfig {
  enabled: boolean;
  proxy_type: string;
  host: string;
  port: number;
  username: string | null;
  requires_auth: boolean;
  bypass_list: string[];
  auto_detect: boolean;
  pac_url: string | null;
}

export interface ProxyTestResult {
  success: boolean;
  latency_ms: number | null;
  error: string | null;
  ip_address: string | null;
}

export async function getProxyConfig(): Promise<ProxyConfig> {
  return invoke("proxy_get_config");
}

export async function setProxyConfig(config: ProxyConfig): Promise<void> {
  return invoke("proxy_set_config", { config });
}

export async function getProxyUrl(): Promise<string | null> {
  return invoke("proxy_get_url");
}

export async function testProxyConnection(): Promise<ProxyTestResult> {
  return invoke("proxy_test_connection");
}

export async function isProxyEnabled(): Promise<boolean> {
  return invoke("proxy_is_enabled");
}

export async function toggleProxy(): Promise<boolean> {
  return invoke("proxy_toggle");
}

export async function addProxyBypass(host: string): Promise<string[]> {
  return invoke("proxy_add_bypass", { host });
}

export async function removeProxyBypass(host: string): Promise<string[]> {
  return invoke("proxy_remove_bypass", { host });
}

export const proxy = {
  getConfig: getProxyConfig,
  setConfig: setProxyConfig,
  getUrl: getProxyUrl,
  testConnection: testProxyConnection,
  isEnabled: isProxyEnabled,
  toggle: toggleProxy,
  addBypass: addProxyBypass,
  removeBypass: removeProxyBypass,
};

// ============================================================================
// Font Manager Functions
// ============================================================================

export interface FontInfo {
  family: string;
  style: string;
  path: string | null;
  is_monospace: boolean;
  is_system: boolean;
}

export interface FontPreferences {
  chat_font: string;
  code_font: string;
  ui_font: string;
  chat_font_size: number;
  code_font_size: number;
  ui_font_size: number;
  line_height: number;
  letter_spacing: number;
  custom_css: string | null;
}

export interface FontCategory {
  name: string;
  fonts: FontInfo[];
}

export async function listSystemFonts(): Promise<FontInfo[]> {
  return invoke("font_list_system");
}

export async function listMonospaceFonts(): Promise<FontInfo[]> {
  return invoke("font_list_monospace");
}

export async function getFontCategories(): Promise<FontCategory[]> {
  return invoke("font_get_categories");
}

export async function getFontPreferences(): Promise<FontPreferences> {
  return invoke("font_get_preferences");
}

export async function setFontPreferences(
  preferences: FontPreferences,
): Promise<void> {
  return invoke("font_set_preferences", { preferences });
}

export async function getFontCSS(): Promise<string> {
  return invoke("font_get_css");
}

export async function refreshFontCache(): Promise<number> {
  return invoke("font_refresh_cache");
}

export async function searchFonts(query: string): Promise<FontInfo[]> {
  return invoke("font_search", { query });
}

export const fontManager = {
  listSystem: listSystemFonts,
  listMonospace: listMonospaceFonts,
  getCategories: getFontCategories,
  getPreferences: getFontPreferences,
  setPreferences: setFontPreferences,
  getCSS: getFontCSS,
  refreshCache: refreshFontCache,
  search: searchFonts,
};

// ============================================================================
// Usage Analytics Functions
// ============================================================================

export interface DailyStats {
  date: string;
  messages_sent: number;
  messages_received: number;
  reactions_sent: number;
  voice_minutes: number;
  active_minutes: number;
  servers_visited: number;
  channels_visited: number;
}

export interface UsageSummary {
  total_messages_sent: number;
  total_messages_received: number;
  total_reactions: number;
  total_voice_minutes: number;
  total_active_hours: number;
  member_since: string | null;
  current_streak_days: number;
  longest_streak_days: number;
  hourly_activity: { hour: number; count: number }[];
  favorite_time: string;
}

export interface WeeklyReport {
  week_start: string;
  week_end: string;
  total_messages: number;
  total_voice_minutes: number;
  total_active_minutes: number;
  most_active_day: string;
  most_active_hour: number;
  top_servers: [string, number][];
  top_channels: [string, number][];
  daily_breakdown: DailyStats[];
}

export async function recordAnalyticsEvent(
  eventType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  return invoke("analytics_record_event", {
    eventType,
    metadata: metadata || null,
  });
}

export async function recordVoiceTime(minutes: number): Promise<void> {
  return invoke("analytics_record_voice_time", { minutes });
}

export async function recordActiveTime(minutes: number): Promise<void> {
  return invoke("analytics_record_active_time", { minutes });
}

export async function getAnalyticsToday(): Promise<DailyStats> {
  return invoke("analytics_get_today");
}

export async function getAnalyticsDaily(date: string): Promise<DailyStats> {
  return invoke("analytics_get_daily", { date });
}

export async function getAnalyticsRange(days: number): Promise<DailyStats[]> {
  return invoke("analytics_get_range", { days });
}

export async function getAnalyticsSummary(): Promise<UsageSummary> {
  return invoke("analytics_get_summary");
}

export async function getWeeklyReport(): Promise<WeeklyReport> {
  return invoke("analytics_get_weekly_report");
}

export async function resetAnalytics(): Promise<void> {
  return invoke("analytics_reset");
}

export const analytics = {
  recordEvent: recordAnalyticsEvent,
  recordVoiceTime,
  recordActiveTime,
  getToday: getAnalyticsToday,
  getDaily: getAnalyticsDaily,
  getRange: getAnalyticsRange,
  getSummary: getAnalyticsSummary,
  getWeeklyReport,
  reset: resetAnalytics,
};

// Default export
export default {
  window,
  windowState,
  notification,
  autoStart,
  app,
  updater,
  clipboard,
  clipboardHistory,
  focusMode,
  mute,
  snooze,
  file,
  fileDrop,
  windowAttention,
  trayBadge,
  power,
  screenshot,
  audio,
  idle,
  spellCheck,
  fileAssociation,
  storage,
  bluetooth,
  processManager,
  dndSync,
  dnd,
  notificationCenter,
  systemTheme,
  performance,
  globalShortcuts,
  miniMode,
  privacyMode,
  accessibility,
  fileWatcher,
  sessionLock,
  quickReply,
  autoAway,
  linkPreview,
  locale,
  systemHealth,
  sessionRestore,
  localSearch,
  backup,
  tts,
  workspaceProfiles,
  windowTabs,
  drafts,
  quickCapture,
  smartStatus,
  networkMonitor,
  bandwidth,
  calendar,
  keychain,
  qrCode,
  messageScheduler,
  voiceRecorder,
  dictation,
  hotCorners,
  appLog,
  diagnostics,
  nativeShare,
  translation,
  nightLight,
  widgets,
  colorPicker,
  advancedBadge,
  taskbarProgress,
  mediaSession,
  systemInfo,
  activityDetection,
  extendedWindowManager,
  traySettings,
  versionTracking,
  pageHtml,
  onMenuEvent,
  onDeepLink,
  proxy,
  fontManager,
  analytics,
};
