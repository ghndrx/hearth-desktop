import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ArchiveEntry {
	name: string;
	path: string;
	size: number;
	compressedSize: number;
	isDirectory: boolean;
}

export interface ArchiveInfo {
	path: string;
	totalFiles: number;
	totalSize: number;
	compressedSize: number;
	entries: ArchiveEntry[];
}

export interface CompressionResult {
	outputPath: string;
	totalFiles: number;
	originalSize: number;
	compressedSize: number;
	compressionRatio: number;
	durationMs: number;
}

export interface ExtractionResult {
	outputDir: string;
	totalFiles: number;
	totalSize: number;
	durationMs: number;
}

export interface CompressionState {
	totalCompressed: number;
	totalExtracted: number;
	totalBytesSaved: number;
	isBusy: boolean;
}

export const compressionState = writable<CompressionState>({
	totalCompressed: 0,
	totalExtracted: 0,
	totalBytesSaved: 0,
	isBusy: false
});

export const isBusy = derived(compressionState, ($s) => $s.isBusy);

export async function compressFiles(
	paths: string[],
	outputPath: string
): Promise<CompressionResult> {
	compressionState.update((s) => ({ ...s, isBusy: true }));
	try {
		const result = await invoke<CompressionResult>('compress_files', { paths, outputPath });
		await loadCompressionState();
		return result;
	} finally {
		compressionState.update((s) => ({ ...s, isBusy: false }));
	}
}

export async function extractArchive(
	archivePath: string,
	outputDir: string
): Promise<ExtractionResult> {
	compressionState.update((s) => ({ ...s, isBusy: true }));
	try {
		const result = await invoke<ExtractionResult>('extract_archive', { archivePath, outputDir });
		await loadCompressionState();
		return result;
	} finally {
		compressionState.update((s) => ({ ...s, isBusy: false }));
	}
}

export async function listArchive(archivePath: string): Promise<ArchiveInfo> {
	return invoke<ArchiveInfo>('list_archive', { archivePath });
}

export async function loadCompressionState(): Promise<void> {
	const state = await invoke<CompressionState>('compression_get_state');
	compressionState.set(state);
}

export function listenToCompressionEvents() {
	listen('compression-progress', (event) => {
		// Progress events for UI updates
	});
	listen('compression-complete', () => {
		loadCompressionState();
	});
	listen('extraction-complete', () => {
		loadCompressionState();
	});
}
