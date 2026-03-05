import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface OptimizeResult {
	originalSize: number;
	optimizedSize: number;
	compressionRatio: number;
	width: number;
	height: number;
	format: string;
	outputPath: string | null;
	base64Data: string | null;
}

export interface OptimizeOptions {
	quality?: number;
	maxWidth?: number;
	maxHeight?: number;
	format?: string;
	outputPath?: string;
	returnBase64?: boolean;
}

export interface ImageInfo {
	path: string;
	width: number;
	height: number;
	format: string;
	sizeBytes: number;
	colorType: string;
}

export interface BatchResult {
	total: number;
	succeeded: number;
	failed: number;
	totalOriginalSize: number;
	totalOptimizedSize: number;
	results: BatchItemResult[];
}

export interface BatchItemResult {
	path: string;
	success: boolean;
	result: OptimizeResult | null;
	error: string | null;
}

export interface OptimizerState {
	totalOptimized: number;
	totalBytesSaved: number;
	defaultQuality: number;
	defaultMaxWidth: number;
	defaultMaxHeight: number;
	preferredFormat: string;
}

export const optimizerState = writable<OptimizerState>({
	totalOptimized: 0,
	totalBytesSaved: 0,
	defaultQuality: 85,
	defaultMaxWidth: 1920,
	defaultMaxHeight: 1080,
	preferredFormat: 'jpeg'
});

export const totalBytesSaved = derived(optimizerState, ($s) => $s.totalBytesSaved);

export async function getImageInfo(path: string): Promise<ImageInfo> {
	return invoke<ImageInfo>('image_get_info', { path });
}

export async function optimizeImage(
	path: string,
	options?: OptimizeOptions
): Promise<OptimizeResult> {
	const result = await invoke<OptimizeResult>('image_optimize', { path, options });
	await loadOptimizerStats();
	return result;
}

export async function optimizeImageBatch(
	paths: string[],
	options?: OptimizeOptions
): Promise<BatchResult> {
	const result = await invoke<BatchResult>('image_optimize_batch', { paths, options });
	await loadOptimizerStats();
	return result;
}

export async function estimateImageSize(
	path: string,
	quality?: number,
	maxWidth?: number,
	maxHeight?: number,
	format?: string
): Promise<OptimizeResult> {
	return invoke<OptimizeResult>('image_estimate_size', {
		path,
		quality,
		maxWidth,
		maxHeight,
		format
	});
}

export async function loadOptimizerStats(): Promise<void> {
	const state = await invoke<OptimizerState>('image_get_optimizer_stats');
	optimizerState.set(state);
}

export async function setOptimizerDefaults(options: {
	quality?: number;
	maxWidth?: number;
	maxHeight?: number;
	format?: string;
}): Promise<void> {
	const state = await invoke<OptimizerState>('image_set_defaults', options);
	optimizerState.set(state);
}
