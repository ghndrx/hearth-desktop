import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Bookmark {
	id: string;
	message_id: string;
	channel_id: string;
	server_id: string | null;
	author_name: string;
	author_avatar: string | null;
	content: string;
	note: string | null;
	tags: string[];
	created_at: number;
}

export interface CreateBookmarkParams {
	message_id: string;
	channel_id: string;
	server_id?: string;
	author_name: string;
	author_avatar?: string;
	content: string;
	note?: string;
	tags?: string[];
}

export const bookmarkItems = writable<Bookmark[]>([]);
export const bookmarkCount = derived(bookmarkItems, ($items) => $items.length);

export async function loadBookmarks(limit?: number, offset?: number): Promise<void> {
	const items = await invoke<Bookmark[]>('bookmark_get_all', { limit: limit ?? 50, offset: offset ?? 0 });
	bookmarkItems.set(items);
}

export async function addBookmark(data: CreateBookmarkParams): Promise<Bookmark> {
	const bookmark = await invoke<Bookmark>('bookmark_add', { data });
	bookmarkItems.update((items) => [bookmark, ...items]);
	return bookmark;
}

export async function removeBookmark(id: string): Promise<void> {
	await invoke<boolean>('bookmark_remove', { id });
	bookmarkItems.update((items) => items.filter((b) => b.id !== id));
}

export async function removeBookmarkByMessage(messageId: string): Promise<void> {
	await invoke<boolean>('bookmark_remove_by_message', { messageId });
	bookmarkItems.update((items) => items.filter((b) => b.message_id !== messageId));
}

export async function searchBookmarks(query: string): Promise<Bookmark[]> {
	return invoke<Bookmark[]>('bookmark_search', { query });
}

export async function updateBookmarkNote(id: string, note: string | null): Promise<void> {
	await invoke<boolean>('bookmark_update_note', { id, note });
	bookmarkItems.update((items) =>
		items.map((b) => (b.id === id ? { ...b, note } : b))
	);
}

export async function updateBookmarkTags(id: string, tags: string[]): Promise<void> {
	await invoke<boolean>('bookmark_update_tags', { id, tags });
	bookmarkItems.update((items) =>
		items.map((b) => (b.id === id ? { ...b, tags } : b))
	);
}

export async function isBookmarked(messageId: string): Promise<boolean> {
	return invoke<boolean>('bookmark_is_bookmarked', { messageId });
}

export async function getBookmarkCount(): Promise<number> {
	return invoke<number>('bookmark_get_count');
}

export async function clearAllBookmarks(): Promise<number> {
	const count = await invoke<number>('bookmark_clear_all');
	bookmarkItems.set([]);
	return count;
}
