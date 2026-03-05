<script lang="ts">
	import { onMount } from 'svelte';
	import {
		optimizerState,
		loadOptimizerStats,
		optimizeImage,
		getImageInfo,
		estimateImageSize,
		setOptimizerDefaults,
		type OptimizeResult,
		type ImageInfo,
		type OptimizeOptions
	} from '$lib/stores/imageOptimizer';

	let selectedFile = '';
	let imageInfo: ImageInfo | null = null;
	let result: OptimizeResult | null = null;
	let estimateResult: OptimizeResult | null = null;
	let isOptimizing = false;
	let quality = 85;
	let maxWidth = 1920;
	let maxHeight = 1080;
	let format = 'jpeg';
	let returnBase64 = false;

	onMount(() => {
		loadOptimizerStats();
	});

	async function handleFileSelect(path: string) {
		selectedFile = path;
		result = null;
		estimateResult = null;
		try {
			imageInfo = await getImageInfo(path);
		} catch (e) {
			imageInfo = null;
		}
	}

	async function handleEstimate() {
		if (!selectedFile) return;
		estimateResult = await estimateImageSize(selectedFile, quality, maxWidth, maxHeight, format);
	}

	async function handleOptimize() {
		if (!selectedFile) return;
		isOptimizing = true;
		try {
			const options: OptimizeOptions = { quality, maxWidth, maxHeight, format, returnBase64 };
			result = await optimizeImage(selectedFile, options);
		} finally {
			isOptimizing = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatPercent(ratio: number): string {
		return (ratio * 100).toFixed(1) + '%';
	}
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			<h2 class="text-lg font-semibold">Image Optimizer</h2>
		</div>
		<div class="flex items-center gap-3 text-xs text-dark-300">
			<span>Optimized: {$optimizerState.totalOptimized}</span>
			<span>Saved: {formatBytes($optimizerState.totalBytesSaved)}</span>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="mb-4">
			<label class="mb-1 block text-sm text-dark-300">Image Path</label>
			<div class="flex gap-2">
				<input
					bind:value={selectedFile}
					placeholder="/path/to/image.jpg"
					class="flex-1 rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
				/>
				<button
					onclick={() => handleFileSelect(selectedFile)}
					class="rounded bg-dark-600 px-3 py-2 text-sm hover:bg-dark-500"
				>Load</button>
			</div>
		</div>

		{#if imageInfo}
			<div class="mb-4 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-2 text-sm font-medium text-dark-200">Image Info</h3>
				<div class="grid grid-cols-2 gap-2 text-sm">
					<div><span class="text-dark-400">Dimensions:</span> {imageInfo.width} x {imageInfo.height}</div>
					<div><span class="text-dark-400">Format:</span> {imageInfo.format}</div>
					<div><span class="text-dark-400">Size:</span> {formatBytes(imageInfo.sizeBytes)}</div>
					<div><span class="text-dark-400">Color:</span> {imageInfo.colorType}</div>
				</div>
			</div>
		{/if}

		<div class="mb-4 rounded-lg bg-dark-700 p-4">
			<h3 class="mb-3 text-sm font-medium text-dark-200">Optimization Settings</h3>
			<div class="flex flex-col gap-3">
				<div>
					<label class="mb-1 block text-xs text-dark-400">Quality: {quality}%</label>
					<input type="range" min="1" max="100" bind:value={quality} class="w-full" />
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-dark-400">Max Width</label>
						<input type="number" bind:value={maxWidth} class="w-full rounded bg-dark-600 px-3 py-1 text-sm" />
					</div>
					<div>
						<label class="mb-1 block text-xs text-dark-400">Max Height</label>
						<input type="number" bind:value={maxHeight} class="w-full rounded bg-dark-600 px-3 py-1 text-sm" />
					</div>
				</div>
				<div>
					<label class="mb-1 block text-xs text-dark-400">Output Format</label>
					<select bind:value={format} class="w-full rounded bg-dark-600 px-3 py-2 text-sm">
						<option value="jpeg">JPEG</option>
						<option value="png">PNG</option>
						<option value="webp">WebP</option>
					</select>
				</div>
			</div>
		</div>

		<div class="mb-4 flex gap-2">
			<button
				onclick={handleEstimate}
				disabled={!selectedFile}
				class="flex-1 rounded bg-dark-600 py-2 text-sm hover:bg-dark-500 disabled:opacity-50"
			>Estimate Size</button>
			<button
				onclick={handleOptimize}
				disabled={!selectedFile || isOptimizing}
				class="flex-1 rounded bg-hearth-500 py-2 text-sm hover:bg-hearth-600 disabled:opacity-50"
			>{isOptimizing ? 'Optimizing...' : 'Optimize'}</button>
		</div>

		{#if estimateResult && !result}
			<div class="mb-4 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-2 text-sm font-medium text-hearth-400">Estimate</h3>
				<div class="grid grid-cols-2 gap-2 text-sm">
					<div><span class="text-dark-400">Output:</span> {formatBytes(estimateResult.optimizedSize)}</div>
					<div><span class="text-dark-400">Savings:</span> {formatPercent(estimateResult.compressionRatio)}</div>
					<div><span class="text-dark-400">Size:</span> {estimateResult.width} x {estimateResult.height}</div>
				</div>
			</div>
		{/if}

		{#if result}
			<div class="rounded-lg bg-dark-700 p-4">
				<h3 class="mb-2 text-sm font-medium text-green-400">Optimization Complete</h3>
				<div class="grid grid-cols-2 gap-2 text-sm">
					<div><span class="text-dark-400">Original:</span> {formatBytes(result.originalSize)}</div>
					<div><span class="text-dark-400">Optimized:</span> {formatBytes(result.optimizedSize)}</div>
					<div><span class="text-dark-400">Savings:</span> {formatPercent(result.compressionRatio)}</div>
					<div><span class="text-dark-400">Dimensions:</span> {result.width} x {result.height}</div>
				</div>
			</div>
		{/if}
	</div>
</div>
