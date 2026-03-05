import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ClipboardMediaEntry {
	id: string;
	contentType: string;
	thumbnailBase64: string | null;
	width: number | null;
	height: number | null;
	sizeBytes: number;
	format: string | null;
	textPreview: string | null;
	timestamp: string;
	isPinned: boolean;
}

export interface ClipboardPreviewState {
	entries: ClipboardMediaEntry[];
	maxEntries: number;
	thumbnailSize: number;
	isMonitoring: boolean;
	totalCaptured: number;
}

export const clipboardPreviewState = writable<ClipboardPreviewState>({
	entries: [],
	maxEntries: 50,
	thumbnailSize: 128,
	isMonitoring: false,
	totalCaptured: 0
});

export const clipboardEntries = derived(clipboardPreviewState, ($s) => $s.entries);
export const pinnedEntries = derived(clipboardPreviewState, ($s) =>
	$s.entries.filter((e) => e.isPinned)
);
export const imageEntries = derived(clipboardPreviewState, ($s) =>
	$s.entries.filter((e) => e.contentType === 'image')
);
export const textEntries = derived(clipboardPreviewState, ($s) =>
	$s.entries.filter((e) => e.contentType === 'text')
);

export async function addClipboardImage(imageBase64: string): Promise<ClipboardMediaEntry> {
	const entry = await invoke<ClipboardMediaEntry>('clipboard_preview_add_image', { imageBase64 });
	await loadClipboardPreviewState();
	return entry;
}

export async function addClipboardText(text: string): Promise<ClipboardMediaEntry> {
	const entry = await invoke<ClipboardMediaEntry>('clipboard_preview_add_text', { text });
	await loadClipboardPreviewState();
	return entry;
}

export async function loadClipboardPreviewState(): Promise<void> {
	const state = await invoke<ClipboardPreviewState>('clipboard_preview_get_state');
	clipboardPreviewState.set(state);
}

export async function getClipboardEntries(
	limit?: number,
	contentType?: string
): Promise<ClipboardMediaEntry[]> {
	return invoke<ClipboardMediaEntry[]>('clipboard_preview_get_entries', { limit, contentType });
}

export async function pinClipboardEntry(id: string): Promise<boolean> {
	const pinned = await invoke<boolean>('clipboard_preview_pin', { id });
	await loadClipboardPreviewState();
	return pinned;
}

export async function deleteClipboardEntry(id: string): Promise<boolean> {
	const removed = await invoke<boolean>('clipboard_preview_delete', { id });
	await loadClipboardPreviewState();
	return removed;
}

export async function clearClipboardPreview(keepPinned?: boolean): Promise<number> {
	const count = await invoke<number>('clipboard_preview_clear', { keepPinned });
	await loadClipboardPreviewState();
	return count;
}

export async function setClipboardMaxEntries(maxEntries: number): Promise<void> {
	await invoke('clipboard_preview_set_max', { maxEntries });
	clipboardPreviewState.update((s) => ({ ...s, maxEntries }));
}

export async function setThumbnailSize(size: number): Promise<void> {
	await invoke('clipboard_preview_set_thumbnail_size', { size });
	clipboardPreviewState.update((s) => ({ ...s, thumbnailSize: size }));
}

export async function searchClipboard(query: string): Promise<ClipboardMediaEntry[]> {
	return invoke<ClipboardMediaEntry[]>('clipboard_preview_search', { query });
}

export function listenToClipboardPreviewEvents() {
	listen<ClipboardMediaEntry>('clipboard-image-captured', () => {
		loadClipboardPreviewState();
	});
	listen<ClipboardMediaEntry>('clipboard-text-captured', () => {
		loadClipboardPreviewState();
	});
}
