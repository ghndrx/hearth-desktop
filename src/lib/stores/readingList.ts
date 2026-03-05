import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type ReadingItemType = 'message' | 'link' | 'thread' | 'attachment';
export type ReadingPriority = 'low' | 'normal' | 'high';

export interface ReadingItem {
	id: string;
	itemType: ReadingItemType;
	title: string;
	content: string | null;
	url: string | null;
	previewImage: string | null;
	sourceServerId: string | null;
	sourceChannelId: string | null;
	sourceMessageId: string | null;
	authorName: string | null;
	authorAvatar: string | null;
	tags: string[];
	priority: ReadingPriority;
	isRead: boolean;
	isArchived: boolean;
	addedAt: string;
	readAt: string | null;
	estimatedReadTime: number | null;
	notes: string | null;
}

export interface ReadingListStats {
	totalItems: number;
	unreadItems: number;
	readItems: number;
	archivedItems: number;
	itemsByType: Record<string, number>;
	itemsThisWeek: number;
}

export const readingListItems = writable<ReadingItem[]>([]);
export const readingListStats = writable<ReadingListStats | null>(null);

export const unreadItems = derived(readingListItems, ($items) =>
	$items.filter((i) => !i.isRead && !i.isArchived)
);

export const unreadCount = derived(unreadItems, ($items) => $items.length);

export const itemsByPriority = derived(readingListItems, ($items) => ({
	high: $items.filter((i) => i.priority === 'high' && !i.isArchived),
	normal: $items.filter((i) => i.priority === 'normal' && !i.isArchived),
	low: $items.filter((i) => i.priority === 'low' && !i.isArchived)
}));

export async function loadReadingList(includeArchived = false): Promise<void> {
	const items = await invoke<ReadingItem[]>('reading_list_get_all', { includeArchived });
	readingListItems.set(items);
}

export async function addToReadingList(params: {
	itemType: ReadingItemType;
	title: string;
	content?: string;
	url?: string;
	sourceServerId?: string;
	sourceChannelId?: string;
	sourceMessageId?: string;
	authorName?: string;
	tags?: string[];
	priority?: ReadingPriority;
	notes?: string;
}): Promise<ReadingItem> {
	const item = await invoke<ReadingItem>('reading_list_add', {
		itemType: params.itemType,
		title: params.title,
		content: params.content ?? null,
		url: params.url ?? null,
		sourceServerId: params.sourceServerId ?? null,
		sourceChannelId: params.sourceChannelId ?? null,
		sourceMessageId: params.sourceMessageId ?? null,
		authorName: params.authorName ?? null,
		tags: params.tags ?? null,
		priority: params.priority ?? null,
		notes: params.notes ?? null
	});
	await loadReadingList();
	return item;
}

export async function removeFromReadingList(id: string): Promise<void> {
	await invoke('reading_list_remove', { id });
	readingListItems.update((items) => items.filter((i) => i.id !== id));
}

export async function markAsRead(id: string): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_mark_read', { id });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function markAsUnread(id: string): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_mark_unread', { id });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function archiveItem(id: string): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_archive', { id });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function updateItemTags(id: string, tags: string[]): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_update_tags', { id, tags });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function updateItemPriority(id: string, priority: ReadingPriority): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_update_priority', { id, priority });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function updateItemNotes(id: string, notes: string | null): Promise<void> {
	const item = await invoke<ReadingItem>('reading_list_update_notes', { id, notes: notes ?? null });
	readingListItems.update((items) => items.map((i) => (i.id === id ? item : i)));
}

export async function getUnreadItems(): Promise<void> {
	const items = await invoke<ReadingItem[]>('reading_list_get_unread');
	readingListItems.set(items);
}

export async function loadReadingListStats(): Promise<void> {
	const stats = await invoke<ReadingListStats>('reading_list_get_stats');
	readingListStats.set(stats);
}

export async function searchReadingList(query: string): Promise<ReadingItem[]> {
	return invoke<ReadingItem[]>('reading_list_search', { query });
}

export async function clearReadItems(): Promise<number> {
	const count = await invoke<number>('reading_list_clear_read');
	await loadReadingList();
	return count;
}
