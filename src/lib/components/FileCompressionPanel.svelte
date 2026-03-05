<script lang="ts">
	import { onMount } from 'svelte';
	import {
		compressionState,
		isBusy,
		compressFiles,
		extractArchive,
		listArchive,
		loadCompressionState,
		listenToCompressionEvents,
		type ArchiveInfo,
		type CompressionResult,
		type ExtractionResult
	} from '$lib/stores/fileCompression';

	let mode: 'compress' | 'extract' = 'compress';
	let filePaths = '';
	let outputPath = '';
	let archivePath = '';
	let extractDir = '';
	let compressionResult: CompressionResult | null = null;
	let extractionResult: ExtractionResult | null = null;
	let archiveInfo: ArchiveInfo | null = null;
	let error = '';

	onMount(() => {
		loadCompressionState();
		listenToCompressionEvents();
	});

	async function handleCompress() {
		error = '';
		compressionResult = null;
		const paths = filePaths.split('\n').map((p) => p.trim()).filter(Boolean);
		if (paths.length === 0 || !outputPath.trim()) {
			error = 'Enter file paths and output path';
			return;
		}
		try {
			compressionResult = await compressFiles(paths, outputPath.trim());
		} catch (e) {
			error = String(e);
		}
	}

	async function handleExtract() {
		error = '';
		extractionResult = null;
		if (!archivePath.trim() || !extractDir.trim()) {
			error = 'Enter archive path and output directory';
			return;
		}
		try {
			extractionResult = await extractArchive(archivePath.trim(), extractDir.trim());
		} catch (e) {
			error = String(e);
		}
	}

	async function handleListArchive() {
		if (!archivePath.trim()) return;
		try {
			archiveInfo = await listArchive(archivePath.trim());
		} catch (e) {
			error = String(e);
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
			</svg>
			<h2 class="text-lg font-semibold">File Compression</h2>
		</div>
		<div class="flex items-center gap-2 text-xs text-dark-300">
			<span>Compressed: {$compressionState.totalCompressed}</span>
			<span>Saved: {formatBytes($compressionState.totalBytesSaved)}</span>
		</div>
	</div>

	<div class="flex border-b border-dark-600">
		<button
			onclick={() => { mode = 'compress'; }}
			class="flex-1 py-2 text-sm transition-colors {mode === 'compress' ? 'border-b-2 border-hearth-500 text-hearth-400' : 'text-dark-300 hover:text-gray-100'}"
		>Compress</button>
		<button
			onclick={() => { mode = 'extract'; }}
			class="flex-1 py-2 text-sm transition-colors {mode === 'extract' ? 'border-b-2 border-hearth-500 text-hearth-400' : 'text-dark-300 hover:text-gray-100'}"
		>Extract</button>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if error}
			<div class="mb-4 rounded bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</div>
		{/if}

		{#if mode === 'compress'}
			<div class="flex flex-col gap-4">
				<div>
					<label class="mb-1 block text-sm text-dark-300">Files to Compress (one per line)</label>
					<textarea
						bind:value={filePaths}
						placeholder="/path/to/file1&#10;/path/to/directory"
						rows="4"
						class="w-full rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
					></textarea>
				</div>
				<div>
					<label class="mb-1 block text-sm text-dark-300">Output ZIP Path</label>
					<input
						bind:value={outputPath}
						placeholder="/path/to/output.zip"
						class="w-full rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
					/>
				</div>
				<button
					onclick={handleCompress}
					disabled={$isBusy}
					class="rounded bg-hearth-500 py-2 text-sm font-medium hover:bg-hearth-600 disabled:opacity-50"
				>{$isBusy ? 'Compressing...' : 'Compress Files'}</button>

				{#if compressionResult}
					<div class="rounded-lg bg-dark-700 p-4">
						<h3 class="mb-2 text-sm font-medium text-green-400">Compression Complete</h3>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div><span class="text-dark-400">Files:</span> {compressionResult.totalFiles}</div>
							<div><span class="text-dark-400">Duration:</span> {compressionResult.durationMs}ms</div>
							<div><span class="text-dark-400">Original:</span> {formatBytes(compressionResult.originalSize)}</div>
							<div><span class="text-dark-400">Compressed:</span> {formatBytes(compressionResult.compressedSize)}</div>
							<div class="col-span-2"><span class="text-dark-400">Ratio:</span> {(compressionResult.compressionRatio * 100).toFixed(1)}% saved</div>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-4">
				<div>
					<label class="mb-1 block text-sm text-dark-300">Archive Path</label>
					<div class="flex gap-2">
						<input
							bind:value={archivePath}
							placeholder="/path/to/archive.zip"
							class="flex-1 rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
						/>
						<button
							onclick={handleListArchive}
							class="rounded bg-dark-600 px-3 py-2 text-sm hover:bg-dark-500"
						>Inspect</button>
					</div>
				</div>
				<div>
					<label class="mb-1 block text-sm text-dark-300">Extract To</label>
					<input
						bind:value={extractDir}
						placeholder="/path/to/extract"
						class="w-full rounded bg-dark-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
					/>
				</div>
				<button
					onclick={handleExtract}
					disabled={$isBusy}
					class="rounded bg-hearth-500 py-2 text-sm font-medium hover:bg-hearth-600 disabled:opacity-50"
				>{$isBusy ? 'Extracting...' : 'Extract Archive'}</button>

				{#if archiveInfo}
					<div class="rounded-lg bg-dark-700 p-4">
						<h3 class="mb-2 text-sm font-medium text-dark-200">Archive Contents ({archiveInfo.totalFiles} files)</h3>
						<div class="mb-2 text-xs text-dark-400">
							Total: {formatBytes(archiveInfo.totalSize)} | Compressed: {formatBytes(archiveInfo.compressedSize)}
						</div>
						<div class="max-h-48 overflow-y-auto">
							{#each archiveInfo.entries.filter((e) => !e.isDirectory) as entry}
								<div class="flex justify-between border-b border-dark-600 py-1 text-xs">
									<span class="truncate text-dark-200">{entry.path}</span>
									<span class="ml-2 text-dark-400">{formatBytes(entry.size)}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if extractionResult}
					<div class="rounded-lg bg-dark-700 p-4">
						<h3 class="mb-2 text-sm font-medium text-green-400">Extraction Complete</h3>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div><span class="text-dark-400">Files:</span> {extractionResult.totalFiles}</div>
							<div><span class="text-dark-400">Duration:</span> {extractionResult.durationMs}ms</div>
							<div class="col-span-2"><span class="text-dark-400">Total Size:</span> {formatBytes(extractionResult.totalSize)}</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
