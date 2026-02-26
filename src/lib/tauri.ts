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
  onMenuEvent,
  onDeepLink,
};
