<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { fade, fly } from 'svelte/transition';

	const dispatch = createEventDispatcher<{
		close: void;
		navigate: { direction: 'prev' | 'next' };
	}>();

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	export let filePath: string = '';
	export let files: string[] = [];
	export let visible: boolean = false;

	// ---------------------------------------------------------------------------
	// Types
	// ---------------------------------------------------------------------------
	interface ImageDimensions {
		width: number;
		height: number;
	}

	interface ArchiveEntryInfo {
		name: string;
		path: string;
		size: number;
		compressedSize: number;
		isDirectory: boolean;
	}

	interface PreviewInfo {
		filePath: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		previewType: string;
		dimensions: ImageDimensions | null;
		duration: number | null;
		lineCount: number | null;
		entries: ArchiveEntryInfo[] | null;
	}

	interface TextContent {
		content: string;
		lineCount: number;
		truncated: boolean;
		encoding: string;
	}

	interface ImageDataResult {
		base64: string;
		width: number;
		height: number;
		originalWidth: number;
		originalHeight: number;
		format: string;
	}

	interface ThumbnailResult {
		base64: string;
		width: number;
		height: number;
		format: string;
	}

	interface HexDumpResult {
		offset: number;
		length: number;
		hexLines: { offset: string; hex: string; ascii: string }[];
		totalSize: number;
	}

	interface FileMetadata {
		filePath: string;
		fileName: string;
		fileSize: number;
		created: string | null;
		modified: string | null;
		accessed: string | null;
		isReadonly: boolean;
		isHidden: boolean;
		mimeType: string;
		previewType: string;
		extra: Record<string, string>;
	}

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let previewInfo: PreviewInfo | null = null;
	let textContent: TextContent | null = null;
	let imageData: ImageDataResult | null = null;
	let archiveEntries: ArchiveEntryInfo[] = [];
	let hexDump: HexDumpResult | null = null;
	let metadata: FileMetadata | null = null;
	let thumbnails: Map<string, ThumbnailResult> = new Map();

	let loading = false;
	let error: string | null = null;
	let activeTab: 'preview' | 'metadata' | 'hex' = 'preview';

	// Image viewer state
	let zoom = 1;
	let fitMode: 'fit' | 'fill' | 'actual' = 'fit';
	let imagePosition = { x: 0, y: 0 };
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };

	// Audio state
	let audioElement: HTMLAudioElement | null = null;
	let audioPlaying = false;
	let audioCurrentTime = 0;
	let audioDuration = 0;

	// Hex dump state
	let hexOffset = 0;
	let hexLength = 256;

	// Text state
	let textMaxLines = 500;

	// Navigation
	let currentFileIndex = -1;

	$: if (filePath && visible) {
		loadPreview(filePath);
	}

	$: currentFileIndex = files.indexOf(filePath);
	$: canGoPrev = currentFileIndex > 0;
	$: canGoNext = currentFileIndex >= 0 && currentFileIndex < files.length - 1;

	// ---------------------------------------------------------------------------
	// Loading
	// ---------------------------------------------------------------------------
	async function loadPreview(path: string) {
		loading = true;
		error = null;
		previewInfo = null;
		textContent = null;
		imageData = null;
		archiveEntries = [];
		hexDump = null;
		metadata = null;
		activeTab = 'preview';
		resetImageView();

		try {
			previewInfo = await invoke<PreviewInfo>('preview_get_info', { path });

			if (previewInfo.previewType === 'image') {
				await loadImageData(path);
			} else if (
				previewInfo.previewType === 'text' ||
				previewInfo.previewType === 'code'
			) {
				await loadTextContent(path);
			} else if (previewInfo.previewType === 'archive') {
				await loadArchiveEntries(path);
			} else if (previewInfo.previewType === 'audio') {
				// Audio uses native HTML element with file path
			}

			metadata = await invoke<FileMetadata>('preview_extract_metadata', { path });
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function loadImageData(path: string) {
		try {
			imageData = await invoke<ImageDataResult>('preview_get_image_data', {
				path,
				maxWidth: 1920,
				maxHeight: 1080
			});
		} catch (e) {
			error = `Failed to load image: ${e}`;
		}
	}

	async function loadTextContent(path: string) {
		try {
			textContent = await invoke<TextContent>('preview_read_text', {
				path,
				maxLines: textMaxLines
			});
		} catch (e) {
			error = `Failed to read text: ${e}`;
		}
	}

	async function loadArchiveEntries(path: string) {
		try {
			archiveEntries = await invoke<ArchiveEntryInfo[]>('preview_list_archive', {
				path
			});
		} catch (e) {
			error = `Failed to list archive: ${e}`;
		}
	}

	async function loadHexDump() {
		if (!filePath) return;
		try {
			hexDump = await invoke<HexDumpResult>('preview_get_hex_dump', {
				path: filePath,
				offset: hexOffset,
				length: hexLength
			});
		} catch (e) {
			error = `Failed to load hex dump: ${e}`;
		}
	}

	async function loadThumbnail(path: string): Promise<ThumbnailResult | null> {
		if (thumbnails.has(path)) {
			return thumbnails.get(path) || null;
		}
		try {
			const thumb = await invoke<ThumbnailResult>('preview_get_thumbnail', {
				path,
				size: 128
			});
			thumbnails.set(path, thumb);
			thumbnails = thumbnails; // trigger reactivity
			return thumb;
		} catch {
			return null;
		}
	}

	// ---------------------------------------------------------------------------
	// Image Controls
	// ---------------------------------------------------------------------------
	function resetImageView() {
		zoom = 1;
		fitMode = 'fit';
		imagePosition = { x: 0, y: 0 };
	}

	function zoomIn() {
		zoom = Math.min(zoom * 1.25, 10);
		fitMode = 'actual';
	}

	function zoomOut() {
		zoom = Math.max(zoom / 1.25, 0.1);
		fitMode = 'actual';
	}

	function setFitMode(mode: 'fit' | 'fill' | 'actual') {
		fitMode = mode;
		if (mode === 'actual') {
			zoom = 1;
		}
		imagePosition = { x: 0, y: 0 };
	}

	function handleImageWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY < 0) {
			zoomIn();
		} else {
			zoomOut();
		}
	}

	function handleImageMouseDown(e: MouseEvent) {
		if (fitMode === 'actual' || zoom !== 1) {
			isDragging = true;
			dragStart = { x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y };
		}
	}

	function handleImageMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		imagePosition = {
			x: e.clientX - dragStart.x,
			y: e.clientY - dragStart.y
		};
	}

	function handleImageMouseUp() {
		isDragging = false;
	}

	// ---------------------------------------------------------------------------
	// Audio Controls
	// ---------------------------------------------------------------------------
	function toggleAudioPlayback() {
		if (!audioElement) return;
		if (audioPlaying) {
			audioElement.pause();
		} else {
			audioElement.play();
		}
		audioPlaying = !audioPlaying;
	}

	function seekAudio(e: Event) {
		if (!audioElement) return;
		const input = e.target as HTMLInputElement;
		audioElement.currentTime = parseFloat(input.value);
	}

	function onAudioTimeUpdate() {
		if (!audioElement) return;
		audioCurrentTime = audioElement.currentTime;
		audioDuration = audioElement.duration || 0;
	}

	// ---------------------------------------------------------------------------
	// Navigation
	// ---------------------------------------------------------------------------
	function goToPrevFile() {
		if (canGoPrev) {
			filePath = files[currentFileIndex - 1];
			dispatch('navigate', { direction: 'prev' });
		}
	}

	function goToNextFile() {
		if (canGoNext) {
			filePath = files[currentFileIndex + 1];
			dispatch('navigate', { direction: 'next' });
		}
	}

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------
	async function copyFilePath() {
		if (!filePath) return;
		try {
			await navigator.clipboard.writeText(filePath);
		} catch {
			// Fallback: ignored
		}
	}

	async function openInSystemViewer() {
		if (!filePath) return;
		try {
			await invoke('open_file_external', { path: filePath });
		} catch {
			// Fallback: try shell open
			window.open(filePath, '_blank');
		}
	}

	function close() {
		visible = false;
		if (audioElement) {
			audioElement.pause();
			audioPlaying = false;
		}
		dispatch('close');
	}

	// ---------------------------------------------------------------------------
	// Formatting
	// ---------------------------------------------------------------------------
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
	}

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function formatDate(isoString: string | null): string {
		if (!isoString) return 'Unknown';
		try {
			return new Date(isoString).toLocaleString();
		} catch {
			return isoString;
		}
	}

	function getLanguageFromExt(fileName: string): string {
		const ext = fileName.split('.').pop()?.toLowerCase() || '';
		const map: Record<string, string> = {
			rs: 'rust',
			js: 'javascript',
			ts: 'typescript',
			py: 'python',
			html: 'html',
			css: 'css',
			svelte: 'svelte',
			json: 'json',
			yaml: 'yaml',
			yml: 'yaml',
			toml: 'toml',
			xml: 'xml',
			md: 'markdown',
			csv: 'csv',
			txt: 'text'
		};
		return map[ext] || 'text';
	}

	function getPreviewTypeIcon(type: string): string {
		switch (type) {
			case 'image':
				return 'IMG';
			case 'video':
				return 'VID';
			case 'audio':
				return 'AUD';
			case 'text':
				return 'TXT';
			case 'code':
				return 'COD';
			case 'pdf':
				return 'PDF';
			case 'archive':
				return 'ZIP';
			default:
				return 'BIN';
		}
	}

	// ---------------------------------------------------------------------------
	// Keyboard
	// ---------------------------------------------------------------------------
	function handleKeydown(e: KeyboardEvent) {
		if (!visible) return;

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				goToPrevFile();
				break;
			case 'ArrowRight':
				e.preventDefault();
				goToNextFile();
				break;
			case '+':
			case '=':
				if (previewInfo?.previewType === 'image') {
					e.preventDefault();
					zoomIn();
				}
				break;
			case '-':
				if (previewInfo?.previewType === 'image') {
					e.preventDefault();
					zoomOut();
				}
				break;
			case '0':
				if (previewInfo?.previewType === 'image') {
					e.preventDefault();
					resetImageView();
				}
				break;
		}
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------
	let unlistenFns: (() => void)[] = [];

	onMount(async () => {
		window.addEventListener('keydown', handleKeydown);

		// Load thumbnails for file list
		for (const file of files) {
			const supported = await invoke<boolean>('preview_is_supported', { path: file });
			if (supported) {
				loadThumbnail(file);
			}
		}
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		unlistenFns.forEach((fn) => fn());
		if (audioElement) {
			audioElement.pause();
		}
	});
</script>

{#if visible}
	<div
		class="file-preview-overlay"
		transition:fade={{ duration: 150 }}
		on:click|self={close}
		role="dialog"
		aria-label="File Preview"
	>
		<div class="file-preview-panel" transition:fly={{ x: 300, duration: 200 }}>
			<!-- Header -->
			<div class="preview-header">
				<div class="header-left">
					{#if previewInfo}
						<span class="preview-type-badge">{getPreviewTypeIcon(previewInfo.previewType)}</span>
						<span class="file-name" title={previewInfo.fileName}>{previewInfo.fileName}</span>
						<span class="file-size">{formatFileSize(previewInfo.fileSize)}</span>
					{:else if loading}
						<span class="file-name">Loading...</span>
					{/if}
				</div>
				<div class="header-actions">
					<button class="action-btn" on:click={copyFilePath} title="Copy file path">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M4 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm8 0H6v8h6V2zM2 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1H8v1H2V6h1V4H2z"/>
						</svg>
					</button>
					<button class="action-btn" on:click={openInSystemViewer} title="Open in system viewer">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
							<path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
						</svg>
					</button>
					<button class="close-btn" on:click={close} title="Close (Esc)">
						<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
							<path d="M4.646 4.646a.5.5 0 0 1 .708 0L9 8.293l3.646-3.647a.5.5 0 0 1 .708.708L9.707 9l3.647 3.646a.5.5 0 0 1-.708.708L9 9.707l-3.646 3.647a.5.5 0 0 1-.708-.708L8.293 9 4.646 5.354a.5.5 0 0 1 0-.708z"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Tabs -->
			<div class="preview-tabs">
				<button
					class="tab"
					class:active={activeTab === 'preview'}
					on:click={() => (activeTab = 'preview')}
				>
					Preview
				</button>
				<button
					class="tab"
					class:active={activeTab === 'metadata'}
					on:click={() => (activeTab = 'metadata')}
				>
					Metadata
				</button>
				<button
					class="tab"
					class:active={activeTab === 'hex'}
					on:click={() => {
						activeTab = 'hex';
						if (!hexDump) loadHexDump();
					}}
				>
					Hex
				</button>
			</div>

			<!-- Content -->
			<div class="preview-content">
				{#if loading}
					<div class="loading-state">
						<div class="spinner"></div>
						<span>Loading preview...</span>
					</div>
				{:else if error}
					<div class="error-state">
						<span class="error-icon">!</span>
						<span class="error-text">{error}</span>
					</div>
				{:else if activeTab === 'preview'}
					<!-- Preview Tab -->
					{#if previewInfo}
						{#if previewInfo.previewType === 'image' && imageData}
							<!-- Image Preview -->
							<div class="image-controls">
								<button class="ctrl-btn" on:click={zoomOut} title="Zoom out (-)">-</button>
								<span class="zoom-level">{Math.round(zoom * 100)}%</span>
								<button class="ctrl-btn" on:click={zoomIn} title="Zoom in (+)">+</button>
								<div class="ctrl-separator"></div>
								<button
									class="ctrl-btn"
									class:active={fitMode === 'fit'}
									on:click={() => setFitMode('fit')}
									title="Fit to view"
								>Fit</button>
								<button
									class="ctrl-btn"
									class:active={fitMode === 'fill'}
									on:click={() => setFitMode('fill')}
									title="Fill view"
								>Fill</button>
								<button
									class="ctrl-btn"
									class:active={fitMode === 'actual'}
									on:click={() => setFitMode('actual')}
									title="Actual size (0)"
								>1:1</button>
								<div class="ctrl-separator"></div>
								<span class="image-dims">
									{imageData.originalWidth} x {imageData.originalHeight}
								</span>
							</div>
							<div
								class="image-viewport"
								on:wheel={handleImageWheel}
								on:mousedown={handleImageMouseDown}
								on:mousemove={handleImageMouseMove}
								on:mouseup={handleImageMouseUp}
								on:mouseleave={handleImageMouseUp}
								role="img"
								aria-label={previewInfo.fileName}
							>
								<img
									src="data:image/png;base64,{imageData.base64}"
									alt={previewInfo.fileName}
									class="preview-image"
									class:fit={fitMode === 'fit'}
									class:fill={fitMode === 'fill'}
									style={fitMode === 'actual' ? `transform: scale(${zoom}) translate(${imagePosition.x / zoom}px, ${imagePosition.y / zoom}px)` : ''}
									draggable="false"
								/>
							</div>

						{:else if previewInfo.previewType === 'text' || previewInfo.previewType === 'code'}
							<!-- Text/Code Preview -->
							{#if textContent}
								<div class="text-header">
									<span class="text-language">{getLanguageFromExt(previewInfo.fileName)}</span>
									<span class="text-info">
										{textContent.lineCount} lines
										{#if textContent.truncated}
											(showing first {textMaxLines})
										{/if}
									</span>
								</div>
								<div class="text-viewport">
									<div class="line-numbers">
										{#each textContent.content.split('\n') as _, i}
											<span class="line-num">{i + 1}</span>
										{/each}
									</div>
									<pre class="text-content"><code>{textContent.content}</code></pre>
								</div>
							{/if}

						{:else if previewInfo.previewType === 'audio'}
							<!-- Audio Preview -->
							<div class="audio-preview">
								<div class="audio-icon">
									<svg width="64" height="64" viewBox="0 0 24 24" fill="#5865f2">
										<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
									</svg>
								</div>
								<div class="audio-name">{previewInfo.fileName}</div>
								<div class="audio-size">{formatFileSize(previewInfo.fileSize)}</div>
								<div class="audio-controls">
									<button class="play-btn" on:click={toggleAudioPlayback}>
										{#if audioPlaying}
											<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
												<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
											</svg>
										{:else}
											<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
												<path d="M8 5v14l11-7z"/>
											</svg>
										{/if}
									</button>
									<span class="audio-time">{formatDuration(audioCurrentTime)}</span>
									<input
										type="range"
										class="audio-seek"
										min="0"
										max={audioDuration || 100}
										value={audioCurrentTime}
										on:input={seekAudio}
									/>
									<span class="audio-time">{formatDuration(audioDuration)}</span>
								</div>
								<audio
									bind:this={audioElement}
									src={filePath}
									on:timeupdate={onAudioTimeUpdate}
									on:ended={() => (audioPlaying = false)}
									preload="metadata"
								/>
							</div>

						{:else if previewInfo.previewType === 'video'}
							<!-- Video Preview (metadata display) -->
							<div class="video-preview">
								<div class="video-icon">
									<svg width="64" height="64" viewBox="0 0 24 24" fill="#5865f2">
										<path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
									</svg>
								</div>
								<div class="video-name">{previewInfo.fileName}</div>
								<div class="video-size">{formatFileSize(previewInfo.fileSize)}</div>
								<div class="video-meta">
									<span class="meta-label">Type:</span>
									<span class="meta-value">{previewInfo.mimeType}</span>
								</div>
								<button class="open-external-btn" on:click={openInSystemViewer}>
									Open in System Player
								</button>
							</div>

						{:else if previewInfo.previewType === 'archive'}
							<!-- Archive Preview -->
							<div class="archive-preview">
								<div class="archive-header">
									<span class="archive-count">
										{archiveEntries.filter((e) => !e.isDirectory).length} files,
										{archiveEntries.filter((e) => e.isDirectory).length} directories
									</span>
									<span class="archive-total-size">
										Total: {formatFileSize(archiveEntries.reduce((sum, e) => sum + e.size, 0))}
									</span>
								</div>
								<div class="archive-list">
									{#each archiveEntries as entry}
										<div class="archive-entry" class:is-dir={entry.isDirectory}>
											<span class="entry-icon">
												{entry.isDirectory ? '📁' : '📄'}
											</span>
											<span class="entry-path" title={entry.path}>{entry.path}</span>
											<span class="entry-size">
												{entry.isDirectory ? '' : formatFileSize(entry.size)}
											</span>
										</div>
									{/each}
									{#if archiveEntries.length === 0}
										<div class="empty-archive">No entries found</div>
									{/if}
								</div>
							</div>

						{:else if previewInfo.previewType === 'pdf'}
							<!-- PDF Preview -->
							<div class="pdf-preview">
								<div class="pdf-icon">
									<svg width="64" height="64" viewBox="0 0 24 24" fill="#ed4245">
										<path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
									</svg>
								</div>
								<div class="pdf-name">{previewInfo.fileName}</div>
								<div class="pdf-size">{formatFileSize(previewInfo.fileSize)}</div>
								<button class="open-external-btn" on:click={openInSystemViewer}>
									Open in PDF Viewer
								</button>
							</div>

						{:else}
							<!-- Unknown Type -->
							<div class="unknown-preview">
								<div class="unknown-icon">
									<svg width="64" height="64" viewBox="0 0 24 24" fill="#949ba4">
										<path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
									</svg>
								</div>
								<div class="unknown-name">{previewInfo.fileName}</div>
								<div class="unknown-size">{formatFileSize(previewInfo.fileSize)}</div>
								<div class="unknown-type">{previewInfo.mimeType}</div>
							</div>
						{/if}
					{/if}

				{:else if activeTab === 'metadata'}
					<!-- Metadata Tab -->
					{#if metadata}
						<div class="metadata-view">
							<div class="meta-section">
								<h3 class="meta-section-title">File Information</h3>
								<div class="meta-row">
									<span class="meta-label">Name</span>
									<span class="meta-value">{metadata.fileName}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Path</span>
									<span class="meta-value path-value" title={metadata.filePath}>{metadata.filePath}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Size</span>
									<span class="meta-value">{formatFileSize(metadata.fileSize)} ({metadata.fileSize.toLocaleString()} bytes)</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Type</span>
									<span class="meta-value">{metadata.mimeType}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Category</span>
									<span class="meta-value capitalize">{metadata.previewType}</span>
								</div>
							</div>
							<div class="meta-section">
								<h3 class="meta-section-title">Dates</h3>
								<div class="meta-row">
									<span class="meta-label">Created</span>
									<span class="meta-value">{formatDate(metadata.created)}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Modified</span>
									<span class="meta-value">{formatDate(metadata.modified)}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Accessed</span>
									<span class="meta-value">{formatDate(metadata.accessed)}</span>
								</div>
							</div>
							<div class="meta-section">
								<h3 class="meta-section-title">Attributes</h3>
								<div class="meta-row">
									<span class="meta-label">Read-only</span>
									<span class="meta-value">{metadata.isReadonly ? 'Yes' : 'No'}</span>
								</div>
								<div class="meta-row">
									<span class="meta-label">Hidden</span>
									<span class="meta-value">{metadata.isHidden ? 'Yes' : 'No'}</span>
								</div>
							</div>
							{#if Object.keys(metadata.extra).length > 0}
								<div class="meta-section">
									<h3 class="meta-section-title">Additional Properties</h3>
									{#each Object.entries(metadata.extra) as [key, value]}
										<div class="meta-row">
											<span class="meta-label">{key}</span>
											<span class="meta-value">{value}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

				{:else if activeTab === 'hex'}
					<!-- Hex Dump Tab -->
					{#if hexDump}
						<div class="hex-controls">
							<button
								class="ctrl-btn"
								disabled={hexOffset === 0}
								on:click={() => {
									hexOffset = Math.max(0, hexOffset - hexLength);
									loadHexDump();
								}}
							>Prev</button>
							<span class="hex-offset-display">
								Offset: 0x{hexOffset.toString(16).toUpperCase().padStart(8, '0')}
								({hexOffset} / {hexDump.totalSize})
							</span>
							<button
								class="ctrl-btn"
								disabled={hexOffset + hexLength >= hexDump.totalSize}
								on:click={() => {
									hexOffset = Math.min(hexDump?.totalSize ?? 0, hexOffset + hexLength);
									loadHexDump();
								}}
							>Next</button>
						</div>
						<div class="hex-viewport">
							<table class="hex-table">
								<thead>
									<tr>
										<th class="hex-col-offset">Offset</th>
										<th class="hex-col-hex">Hex</th>
										<th class="hex-col-ascii">ASCII</th>
									</tr>
								</thead>
								<tbody>
									{#each hexDump.hexLines as line}
										<tr>
											<td class="hex-offset">{line.offset}</td>
											<td class="hex-bytes">{line.hex}</td>
											<td class="hex-ascii">{line.ascii}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="loading-state">
							<div class="spinner"></div>
							<span>Loading hex dump...</span>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Navigation Footer -->
			{#if files.length > 1}
				<div class="preview-footer">
					<button class="nav-btn" disabled={!canGoPrev} on:click={goToPrevFile}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
						</svg>
					</button>
					<span class="nav-info">
						{currentFileIndex + 1} / {files.length}
					</span>
					<button class="nav-btn" disabled={!canGoNext} on:click={goToNextFile}>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
						</svg>
					</button>
				</div>
			{/if}

			<!-- Thumbnail Grid -->
			{#if files.length > 1}
				<div class="thumbnail-grid">
					{#each files as file, i}
						<button
							class="thumb-item"
							class:active={file === filePath}
							on:click={() => (filePath = file)}
							title={file.split('/').pop() || file}
						>
							{#if thumbnails.has(file)}
								<img
									src="data:image/png;base64,{thumbnails.get(file)?.base64}"
									alt=""
									class="thumb-img"
								/>
							{:else}
								<span class="thumb-placeholder">{(file.split('.').pop() || '?').toUpperCase().slice(0, 3)}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.file-preview-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 9999;
		display: flex;
		justify-content: flex-end;
		align-items: stretch;
	}

	.file-preview-panel {
		width: 680px;
		max-width: 90vw;
		background: #1e1f22;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-left: 1px solid #2b2d31;
	}

	/* Header */
	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
		min-height: 48px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		overflow: hidden;
		flex: 1;
	}

	.preview-type-badge {
		background: #5865f2;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.file-name {
		color: #f2f3f5;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.file-size {
		color: #949ba4;
		font-size: 12px;
		flex-shrink: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.action-btn,
	.close-btn {
		background: none;
		border: none;
		color: #b5bac1;
		cursor: pointer;
		padding: 6px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-btn:hover,
	.close-btn:hover {
		background: #313338;
		color: #f2f3f5;
	}

	/* Tabs */
	.preview-tabs {
		display: flex;
		padding: 0 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
	}

	.tab {
		background: none;
		border: none;
		color: #949ba4;
		font-size: 13px;
		padding: 8px 16px;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}

	.tab:hover {
		color: #f2f3f5;
	}

	.tab.active {
		color: #f2f3f5;
		border-bottom-color: #5865f2;
	}

	/* Content */
	.preview-content {
		flex: 1;
		overflow: auto;
		position: relative;
	}

	/* Loading / Error States */
	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		color: #949ba4;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #313338;
		border-top-color: #5865f2;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-icon {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #ed4245;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 20px;
	}

	.error-text {
		color: #ed4245;
		font-size: 13px;
		text-align: center;
		max-width: 400px;
	}

	/* Image Preview */
	.image-controls {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
	}

	.ctrl-btn {
		background: #313338;
		border: none;
		color: #b5bac1;
		font-size: 12px;
		padding: 4px 10px;
		border-radius: 3px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.ctrl-btn:hover {
		background: #3f4147;
		color: #f2f3f5;
	}

	.ctrl-btn.active {
		background: #5865f2;
		color: #fff;
	}

	.ctrl-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ctrl-separator {
		width: 1px;
		height: 20px;
		background: #3f4147;
	}

	.zoom-level {
		color: #949ba4;
		font-size: 12px;
		min-width: 40px;
		text-align: center;
	}

	.image-dims {
		color: #949ba4;
		font-size: 12px;
		margin-left: auto;
	}

	.image-viewport {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		cursor: grab;
		min-height: 300px;
		background: #111214;
	}

	.image-viewport:active {
		cursor: grabbing;
	}

	.preview-image {
		max-width: none;
		user-select: none;
		-webkit-user-drag: none;
	}

	.preview-image.fit {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.preview-image.fill {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Text/Code Preview */
	.text-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
	}

	.text-language {
		color: #5865f2;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.text-info {
		color: #949ba4;
		font-size: 12px;
	}

	.text-viewport {
		display: flex;
		overflow: auto;
		flex: 1;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 13px;
		line-height: 1.6;
	}

	.line-numbers {
		display: flex;
		flex-direction: column;
		padding: 12px 12px 12px 16px;
		background: #2b2d31;
		color: #5c6370;
		text-align: right;
		user-select: none;
		flex-shrink: 0;
		border-right: 1px solid #313338;
	}

	.line-num {
		font-size: 13px;
		line-height: 1.6;
	}

	.text-content {
		margin: 0;
		padding: 12px 16px;
		background: #1e1f22;
		color: #d4d4d4;
		overflow-x: auto;
		flex: 1;
		white-space: pre;
		tab-size: 4;
	}

	.text-content code {
		font-family: inherit;
	}

	/* Audio Preview */
	.audio-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		gap: 12px;
	}

	.audio-name {
		color: #f2f3f5;
		font-size: 18px;
		font-weight: 600;
	}

	.audio-size {
		color: #949ba4;
		font-size: 13px;
	}

	.audio-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
		width: 100%;
		max-width: 400px;
	}

	.play-btn {
		background: #5865f2;
		border: none;
		color: #fff;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: background 0.15s;
	}

	.play-btn:hover {
		background: #4752c4;
	}

	.audio-seek {
		flex: 1;
		accent-color: #5865f2;
		height: 4px;
	}

	.audio-time {
		color: #949ba4;
		font-size: 12px;
		min-width: 36px;
		font-variant-numeric: tabular-nums;
	}

	/* Video Preview */
	.video-preview,
	.pdf-preview,
	.unknown-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		gap: 12px;
	}

	.video-name,
	.pdf-name,
	.unknown-name {
		color: #f2f3f5;
		font-size: 18px;
		font-weight: 600;
	}

	.video-size,
	.pdf-size,
	.unknown-size {
		color: #949ba4;
		font-size: 13px;
	}

	.video-meta {
		display: flex;
		gap: 8px;
		color: #949ba4;
		font-size: 13px;
	}

	.unknown-type {
		color: #949ba4;
		font-size: 13px;
	}

	.open-external-btn {
		margin-top: 16px;
		background: #5865f2;
		border: none;
		color: #fff;
		padding: 10px 24px;
		border-radius: 4px;
		font-size: 14px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.open-external-btn:hover {
		background: #4752c4;
	}

	/* Archive Preview */
	.archive-preview {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.archive-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
	}

	.archive-count,
	.archive-total-size {
		color: #949ba4;
		font-size: 12px;
	}

	.archive-list {
		flex: 1;
		overflow: auto;
		padding: 4px 0;
	}

	.archive-entry {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		font-size: 13px;
		transition: background 0.1s;
	}

	.archive-entry:hover {
		background: #2b2d31;
	}

	.archive-entry.is-dir {
		color: #5865f2;
	}

	.entry-icon {
		flex-shrink: 0;
		font-size: 14px;
	}

	.entry-path {
		color: #d4d4d4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.entry-size {
		color: #949ba4;
		font-size: 12px;
		flex-shrink: 0;
	}

	.empty-archive {
		text-align: center;
		padding: 24px;
		color: #949ba4;
	}

	/* Metadata View */
	.metadata-view {
		padding: 16px;
	}

	.meta-section {
		margin-bottom: 20px;
	}

	.meta-section-title {
		color: #949ba4;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0 0 10px 0;
		padding-bottom: 6px;
		border-bottom: 1px solid #313338;
	}

	.meta-row {
		display: flex;
		padding: 4px 0;
		font-size: 13px;
		gap: 12px;
	}

	.meta-label {
		color: #949ba4;
		min-width: 100px;
		flex-shrink: 0;
	}

	.meta-value {
		color: #d4d4d4;
		word-break: break-all;
	}

	.meta-value.capitalize {
		text-transform: capitalize;
	}

	.path-value {
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 12px;
	}

	/* Hex Dump */
	.hex-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: #2b2d31;
		border-bottom: 1px solid #1e1f22;
	}

	.hex-offset-display {
		color: #949ba4;
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
	}

	.hex-viewport {
		overflow: auto;
		flex: 1;
	}

	.hex-table {
		width: 100%;
		border-collapse: collapse;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 12px;
	}

	.hex-table thead th {
		position: sticky;
		top: 0;
		background: #2b2d31;
		color: #949ba4;
		font-weight: 600;
		text-align: left;
		padding: 6px 12px;
		border-bottom: 1px solid #313338;
	}

	.hex-table tbody tr:hover {
		background: #2b2d31;
	}

	.hex-offset {
		color: #5865f2;
		padding: 3px 12px;
		white-space: nowrap;
	}

	.hex-bytes {
		color: #d4d4d4;
		padding: 3px 12px;
		white-space: nowrap;
	}

	.hex-ascii {
		color: #87c38a;
		padding: 3px 12px;
		white-space: pre;
	}

	/* Navigation Footer */
	.preview-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 8px 16px;
		background: #2b2d31;
		border-top: 1px solid #1e1f22;
	}

	.nav-btn {
		background: #313338;
		border: none;
		color: #b5bac1;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}

	.nav-btn:hover:not(:disabled) {
		background: #3f4147;
		color: #f2f3f5;
	}

	.nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.nav-info {
		color: #949ba4;
		font-size: 13px;
	}

	/* Thumbnail Grid */
	.thumbnail-grid {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
		background: #1e1f22;
		border-top: 1px solid #2b2d31;
		overflow-x: auto;
		flex-shrink: 0;
	}

	.thumb-item {
		width: 48px;
		height: 48px;
		border-radius: 4px;
		border: 2px solid transparent;
		background: #313338;
		cursor: pointer;
		overflow: hidden;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s;
		padding: 0;
	}

	.thumb-item:hover {
		border-color: #3f4147;
	}

	.thumb-item.active {
		border-color: #5865f2;
	}

	.thumb-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumb-placeholder {
		color: #949ba4;
		font-size: 10px;
		font-weight: 700;
	}
</style>
