/**
 * Clipboard utilities for reading/writing images
 * Provides native clipboard image support via Tauri
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Clipboard image data structure
 */
export interface ClipboardImageData {
  /** Base64-encoded PNG image data */
  data: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** MIME type (always "image/png") */
  mimeType: string;
}

/**
 * Check if clipboard contains text
 */
export async function hasClipboardText(): Promise<boolean> {
  try {
    return await invoke<boolean>('clipboard_has_text');
  } catch {
    return false;
  }
}

/**
 * Read text from clipboard
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    return await invoke<string>('clipboard_read_text');
  } catch {
    return null;
  }
}

/**
 * Write text to clipboard
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await invoke('clipboard_write_text', { text });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if clipboard contains an image
 */
export async function hasClipboardImage(): Promise<boolean> {
  try {
    return await invoke<boolean>('clipboard_has_image');
  } catch {
    return false;
  }
}

/**
 * Read image from clipboard
 * Returns null if no image is available
 */
export async function readClipboardImage(): Promise<ClipboardImageData | null> {
  try {
    const result = await invoke<ClipboardImageData | null>('clipboard_read_image');
    if (result) {
      // Convert snake_case to camelCase
      return {
        data: result.data,
        width: result.width,
        height: result.height,
        mimeType: (result as any).mime_type || result.mimeType,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write image to clipboard
 * @param data Base64-encoded RGBA image data
 * @param width Image width in pixels
 * @param height Image height in pixels
 */
export async function writeClipboardImage(
  data: string,
  width: number,
  height: number
): Promise<boolean> {
  try {
    await invoke('clipboard_write_image', { data, width, height });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear the clipboard
 */
export async function clearClipboard(): Promise<boolean> {
  try {
    await invoke('clipboard_clear');
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert clipboard image to a File object for upload
 */
export function clipboardImageToFile(
  imageData: ClipboardImageData,
  filename = 'clipboard-image.png'
): File {
  // Decode base64 to binary
  const binaryString = atob(imageData.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create a File object
  return new File([bytes], filename, { type: imageData.mimeType });
}

/**
 * Convert clipboard image to a data URL for preview
 */
export function clipboardImageToDataUrl(imageData: ClipboardImageData): string {
  return `data:${imageData.mimeType};base64,${imageData.data}`;
}

/**
 * Get clipboard content type
 */
export async function getClipboardContentType(): Promise<'text' | 'image' | 'empty'> {
  const [hasText, hasImage] = await Promise.all([
    hasClipboardText(),
    hasClipboardImage(),
  ]);

  if (hasImage) return 'image';
  if (hasText) return 'text';
  return 'empty';
}

/**
 * Svelte store-friendly clipboard watcher
 * Usage: const clipboard = createClipboardWatcher()
 */
export function createClipboardWatcher(pollInterval = 1000) {
  let interval: ReturnType<typeof setInterval> | null = null;
  const subscribers: Set<(type: 'text' | 'image' | 'empty') => void> = new Set();
  let lastType: 'text' | 'image' | 'empty' = 'empty';

  const check = async () => {
    const type = await getClipboardContentType();
    if (type !== lastType) {
      lastType = type;
      subscribers.forEach((cb) => cb(type));
    }
  };

  return {
    subscribe(callback: (type: 'text' | 'image' | 'empty') => void) {
      subscribers.add(callback);
      
      // Start polling if this is the first subscriber
      if (subscribers.size === 1) {
        check(); // Initial check
        interval = setInterval(check, pollInterval);
      }

      // Return unsubscribe function
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && interval) {
          clearInterval(interval);
          interval = null;
        }
      };
    },
  };
}
