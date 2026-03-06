import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreviewType = 'image' | 'video' | 'audio' | 'text' | 'code' | 'pdf' | 'archive' | 'unknown';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ArchiveEntryInfo {
  name: string;
  path: string;
  size: number;
  compressedSize: number;
  isDirectory: boolean;
}

export interface FilePreviewInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  previewType: PreviewType;
  dimensions: ImageDimensions | null;
  duration: number | null;
  lineCount: number | null;
  entries: ArchiveEntryInfo[] | null;
}

export interface ThumbnailData {
  base64: string;
  width: number;
  height: number;
  format: string;
}

export interface TextPreviewContent {
  content: string;
  lineCount: number;
  truncated: boolean;
  encoding: string;
}

export interface FileMetadataInfo {
  filePath: string;
  fileName: string;
  fileSize: number;
  created: string | null;
  modified: string | null;
  accessed: string | null;
  isReadonly: boolean;
  isHidden: boolean;
  mimeType: string;
  previewType: PreviewType;
  extra: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function createFilePreviewStore() {
  const currentPreview = writable<FilePreviewInfo | null>(null);
  const thumbnailData = writable<ThumbnailData | null>(null);
  const textContent = writable<TextPreviewContent | null>(null);
  const metadata = writable<FileMetadataInfo | null>(null);
  const loading = writable<boolean>(false);
  const error = writable<string | null>(null);

  async function previewFile(path: string) {
    loading.set(true);
    error.set(null);
    currentPreview.set(null);
    thumbnailData.set(null);
    textContent.set(null);
    metadata.set(null);

    try {
      // Load file info
      const info = await invoke<FilePreviewInfo>('preview_get_info', { path });
      currentPreview.set(info);

      // Load metadata
      try {
        const meta = await invoke<FileMetadataInfo>('preview_extract_metadata', { path });
        metadata.set(meta);
      } catch (e) {
        console.error('Failed to extract metadata:', e);
      }

      // Load type-specific data in parallel
      if (info.previewType === 'image') {
        try {
          const thumb = await invoke<ThumbnailData>('preview_get_thumbnail', { path });
          thumbnailData.set(thumb);
        } catch (e) {
          console.error('Failed to get thumbnail:', e);
        }
      }

      if (info.previewType === 'text' || info.previewType === 'code') {
        try {
          const text = await invoke<TextPreviewContent>('preview_read_text', { path });
          textContent.set(text);
        } catch (e) {
          console.error('Failed to read text content:', e);
        }
      }
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error).message ?? 'Failed to preview file';
      error.set(msg);
      console.error('Failed to preview file:', e);
    } finally {
      loading.set(false);
    }
  }

  function clearPreview() {
    currentPreview.set(null);
    thumbnailData.set(null);
    textContent.set(null);
    metadata.set(null);
    loading.set(false);
    error.set(null);
  }

  return {
    currentPreview: { subscribe: currentPreview.subscribe },
    thumbnailData: { subscribe: thumbnailData.subscribe },
    textContent: { subscribe: textContent.subscribe },
    metadata: { subscribe: metadata.subscribe },
    loading: { subscribe: loading.subscribe },
    error: { subscribe: error.subscribe },

    init() {
      // No persistent state to load on init; ready immediately
    },

    cleanup() {
      clearPreview();
    },

    previewFile,
    clearPreview,
  };
}

export const filePreview = createFilePreviewStore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileTypeColor(previewType: PreviewType): string {
  switch (previewType) {
    case 'image': return '#5865f2';   // blue
    case 'video': return '#ed4245';   // red
    case 'audio': return '#57f287';   // green
    case 'text': return '#fee75c';    // yellow
    case 'code': return '#eb459e';    // pink
    case 'pdf': return '#ed4245';     // red
    case 'archive': return '#5865f2'; // blue
    default: return '#949ba4';        // gray
  }
}

export function fileTypeLabel(previewType: PreviewType): string {
  switch (previewType) {
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'text': return 'Text';
    case 'code': return 'Code';
    case 'pdf': return 'PDF';
    case 'archive': return 'Archive';
    default: return 'File';
  }
}
