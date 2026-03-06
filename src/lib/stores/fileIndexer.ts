import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface IndexedFile {
	id: string;
	file_name: string;
	file_path: string;
	file_type: string;
	file_size: number;
	channel_id: string;
	server_id: string | null;
	uploader_name: string;
	content_preview: string | null;
	indexed_at: number;
	tags: string[];
}

export interface FileIndexStats {
	total_files: number;
	total_size: number;
	type_counts: { file_type: string; count: number }[];
}

export const indexedFiles = writable<IndexedFile[]>([]);
export const fileIndexStats = writable<FileIndexStats | null>(null);
export const fileSearchQuery = writable('');
export const fileSearchResults = writable<IndexedFile[]>([]);
export const indexedFileCount = derived(indexedFiles, ($files) => $files.length);

export async function addToIndex(data: {
	file_name: string;
	file_path: string;
	file_type: string;
	file_size: number;
	channel_id: string;
	server_id?: string;
	uploader_name: string;
	content_preview?: string;
	tags?: string[];
}): Promise<IndexedFile> {
	const file = await invoke<IndexedFile>('file_index_add', { data });
	indexedFiles.update((files) => [file, ...files]);
	return file;
}

export async function removeFromIndex(id: string): Promise<void> {
	await invoke<boolean>('file_index_remove', { id });
	indexedFiles.update((files) => files.filter((f) => f.id !== id));
}

export async function searchFiles(query: string): Promise<IndexedFile[]> {
	const results = await invoke<IndexedFile[]>('file_index_search', { query });
	fileSearchResults.set(results);
	return results;
}

export async function getRecentFiles(limit?: number, offset?: number): Promise<void> {
	const files = await invoke<IndexedFile[]>('file_index_get_recent', {
		limit: limit ?? 50,
		offset: offset ?? 0
	});
	indexedFiles.set(files);
}

export async function getFilesByChannel(channelId: string): Promise<IndexedFile[]> {
	return invoke<IndexedFile[]>('file_index_get_by_channel', { channelId });
}

export async function getFilesByType(fileType: string): Promise<IndexedFile[]> {
	return invoke<IndexedFile[]>('file_index_get_by_type', { fileType });
}

export async function getFileIndexStats(): Promise<FileIndexStats> {
	const stats = await invoke<FileIndexStats>('file_index_get_stats');
	fileIndexStats.set(stats);
	return stats;
}

export async function clearFileIndex(): Promise<void> {
	await invoke('file_index_clear');
	indexedFiles.set([]);
	fileSearchResults.set([]);
}

export async function rebuildFileIndex(): Promise<void> {
	await invoke('file_index_rebuild');
	indexedFiles.set([]);
	fileSearchResults.set([]);
}
