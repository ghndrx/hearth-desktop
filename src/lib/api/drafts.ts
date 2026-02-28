/**
 * Message Drafts API - Auto-save and restore message drafts per channel
 *
 * Provides persistent draft storage so users never lose unsent messages:
 * - Per-channel draft persistence via Rust backend
 * - Draft metadata (timestamps, reply context, attachments)
 * - Stale draft cleanup
 * - Cross-session persistence with localStorage bridge
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/** A saved message draft */
export interface Draft {
  channel_id: string;
  content: string;
  reply_to?: string;
  attachments: string[];
  updated_at: number;
  created_at: number;
}

/** Event payloads */
export type DraftEventPayloads = {
  'draft:saved': Draft;
  'draft:deleted': string;
  'draft:all-cleared': number;
  'draft:cleanup': number;
};

const STORAGE_KEY = 'hearth-drafts';

/**
 * Save or update a draft for a channel
 */
export async function saveDraft(
  channelId: string,
  content: string,
  replyTo?: string,
  attachments?: string[]
): Promise<Draft> {
  const draft = await invoke<Draft>('save_draft', {
    channelId,
    content,
    replyTo: replyTo ?? null,
    attachments: attachments ?? null,
  });
  persistToStorage();
  return draft;
}

/**
 * Get the draft for a specific channel
 */
export async function getDraft(channelId: string): Promise<Draft | null> {
  return invoke<Draft | null>('get_draft', { channelId });
}

/**
 * Delete the draft for a specific channel (e.g., after sending a message)
 */
export async function deleteDraft(channelId: string): Promise<boolean> {
  const result = await invoke<boolean>('delete_draft', { channelId });
  persistToStorage();
  return result;
}

/**
 * Get all saved drafts, sorted by most recently updated
 */
export async function getAllDrafts(): Promise<Draft[]> {
  return invoke<Draft[]>('get_all_drafts');
}

/**
 * Get the number of saved drafts
 */
export async function getDraftCount(): Promise<number> {
  return invoke<number>('get_draft_count');
}

/**
 * Clear all drafts
 */
export async function clearAllDrafts(): Promise<number> {
  const count = await invoke<number>('clear_all_drafts');
  localStorage.removeItem(STORAGE_KEY);
  return count;
}

/**
 * Delete drafts older than a given age
 * @param maxAgeMs Maximum age in milliseconds (default: 7 days)
 */
export async function cleanupStaleDrafts(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const count = await invoke<number>('cleanup_stale_drafts', { maxAgeMs });
  persistToStorage();
  return count;
}

/**
 * Restore drafts from localStorage into the Rust backend
 * Called on app startup to restore cross-session drafts
 */
export async function restoreDraftsFromStorage(): Promise<number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;

    const drafts: Draft[] = JSON.parse(stored);
    if (!Array.isArray(drafts) || drafts.length === 0) return 0;

    return invoke<number>('load_drafts', { draftsData: drafts });
  } catch {
    return 0;
  }
}

/**
 * Persist current drafts to localStorage for cross-session recovery
 */
async function persistToStorage(): Promise<void> {
  try {
    const drafts = await getAllDrafts();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Silent fail for storage persistence
  }
}

/**
 * Listen for draft events
 */
export async function onDraftEvent<K extends keyof DraftEventPayloads>(
  event: K,
  callback: (payload: DraftEventPayloads[K]) => void
): Promise<UnlistenFn> {
  return listen<DraftEventPayloads[K]>(event, (e) => callback(e.payload));
}

/**
 * Format a draft's age as a human-readable string
 */
export function formatDraftAge(updatedAt: number): string {
  const now = Date.now();
  const diffMs = now - updatedAt;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}

export default {
  saveDraft,
  getDraft,
  deleteDraft,
  getAllDrafts,
  getDraftCount,
  clearAllDrafts,
  cleanupStaleDrafts,
  restoreDraftsFromStorage,
  onDraftEvent,
  formatDraftAge,
};
