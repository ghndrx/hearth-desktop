/**
 * Tests for clipboard utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasClipboardText,
  readClipboardText,
  writeClipboardText,
  hasClipboardImage,
  readClipboardImage,
  writeClipboardImage,
  clearClipboard,
  clipboardImageToFile,
  clipboardImageToDataUrl,
  getClipboardContentType,
  type ClipboardImageData,
} from './clipboard';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

describe('Clipboard utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasClipboardText', () => {
    it('returns true when clipboard has text', async () => {
      mockInvoke.mockResolvedValueOnce(true);
      const result = await hasClipboardText();
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_has_text');
    });

    it('returns false when clipboard is empty', async () => {
      mockInvoke.mockResolvedValueOnce(false);
      const result = await hasClipboardText();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));
      const result = await hasClipboardText();
      expect(result).toBe(false);
    });
  });

  describe('readClipboardText', () => {
    it('reads text from clipboard', async () => {
      mockInvoke.mockResolvedValueOnce('Hello, World!');
      const result = await readClipboardText();
      expect(result).toBe('Hello, World!');
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_read_text');
    });

    it('returns null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('No text'));
      const result = await readClipboardText();
      expect(result).toBeNull();
    });
  });

  describe('writeClipboardText', () => {
    it('writes text to clipboard', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const result = await writeClipboardText('Test text');
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_write_text', { text: 'Test text' });
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Write failed'));
      const result = await writeClipboardText('Test');
      expect(result).toBe(false);
    });
  });

  describe('hasClipboardImage', () => {
    it('returns true when clipboard has image', async () => {
      mockInvoke.mockResolvedValueOnce(true);
      const result = await hasClipboardImage();
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_has_image');
    });

    it('returns false when no image', async () => {
      mockInvoke.mockResolvedValueOnce(false);
      const result = await hasClipboardImage();
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));
      const result = await hasClipboardImage();
      expect(result).toBe(false);
    });
  });

  describe('readClipboardImage', () => {
    it('reads image from clipboard', async () => {
      const mockImage = {
        data: 'iVBORw0KGgo=',
        width: 100,
        height: 100,
        mime_type: 'image/png',
      };
      mockInvoke.mockResolvedValueOnce(mockImage);

      const result = await readClipboardImage();
      expect(result).toEqual({
        data: 'iVBORw0KGgo=',
        width: 100,
        height: 100,
        mimeType: 'image/png',
      });
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_read_image');
    });

    it('returns null when no image', async () => {
      mockInvoke.mockResolvedValueOnce(null);
      const result = await readClipboardImage();
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));
      const result = await readClipboardImage();
      expect(result).toBeNull();
    });
  });

  describe('writeClipboardImage', () => {
    it('writes image to clipboard', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const result = await writeClipboardImage('base64data', 100, 100);
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_write_image', {
        data: 'base64data',
        width: 100,
        height: 100,
      });
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Write failed'));
      const result = await writeClipboardImage('data', 50, 50);
      expect(result).toBe(false);
    });
  });

  describe('clearClipboard', () => {
    it('clears the clipboard', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const result = await clearClipboard();
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('clipboard_clear');
    });

    it('returns false on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Failed'));
      const result = await clearClipboard();
      expect(result).toBe(false);
    });
  });

  describe('clipboardImageToFile', () => {
    it('converts clipboard image to File', () => {
      const imageData: ClipboardImageData = {
        data: 'SGVsbG8=', // "Hello" in base64
        width: 100,
        height: 100,
        mimeType: 'image/png',
      };

      const file = clipboardImageToFile(imageData);
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('clipboard-image.png');
      expect(file.type).toBe('image/png');
    });

    it('uses custom filename', () => {
      const imageData: ClipboardImageData = {
        data: 'SGVsbG8=',
        width: 100,
        height: 100,
        mimeType: 'image/png',
      };

      const file = clipboardImageToFile(imageData, 'screenshot.png');
      expect(file.name).toBe('screenshot.png');
    });
  });

  describe('clipboardImageToDataUrl', () => {
    it('converts clipboard image to data URL', () => {
      const imageData: ClipboardImageData = {
        data: 'iVBORw0KGgo=',
        width: 100,
        height: 100,
        mimeType: 'image/png',
      };

      const dataUrl = clipboardImageToDataUrl(imageData);
      expect(dataUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
    });
  });

  describe('getClipboardContentType', () => {
    it('returns "image" when clipboard has image', async () => {
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'clipboard_has_text') return false;
        if (cmd === 'clipboard_has_image') return true;
        return false;
      });

      const result = await getClipboardContentType();
      expect(result).toBe('image');
    });

    it('returns "text" when clipboard has text only', async () => {
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'clipboard_has_text') return true;
        if (cmd === 'clipboard_has_image') return false;
        return false;
      });

      const result = await getClipboardContentType();
      expect(result).toBe('text');
    });

    it('returns "empty" when clipboard is empty', async () => {
      mockInvoke.mockImplementation(async () => false);

      const result = await getClipboardContentType();
      expect(result).toBe('empty');
    });

    it('prioritizes image over text', async () => {
      mockInvoke.mockImplementation(async () => true);

      const result = await getClipboardContentType();
      expect(result).toBe('image');
    });
  });
});
