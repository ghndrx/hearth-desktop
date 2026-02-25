<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	// Types for native file drop events
	interface DroppedFile {
		path: string;
		name: string;
		size: number;
		extension: string | null;
		mime_type: string | null;
		is_image: boolean;
		is_video: boolean;
		is_audio: boolean;
		is_document: boolean;
		modified: number | null;
		thumbnail: string | null;
	}

	interface FileDropEvent {
		event_type: 'hover' | 'drop' | 'cancel';
		files: DroppedFile[];
		position: [number, number] | null;
	}

	interface ValidationResult {
		valid_files: DroppedFile[];
		errors: string[];
	}

	// Props
	export let maxFileSize = 25 * 1024 * 1024; // 25MB default
	export let maxFiles = 10;
	export let allowedTypes: string[] | null = null; // null = all types
	export let showPreview = true;
	export let disabled = false;

	// Events
	const dispatch = createEventDispatcher<{
		files: { files: DroppedFile[]; errors: string[] };
		hover: { files: DroppedFile[]; position: [number, number] | null };
		cancel: void;
	}>();

	// State
	let isDragging = false;
	let hoverFiles: DroppedFile[] = [];
	let hoverPosition: [number, number] | null = null;
	let unlisten: UnlistenFn | null = null;

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return 'Unknown size';
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	// Get icon for file type
	function getFileTypeIcon(file: DroppedFile): string {
		if (file.is_image) return '🖼️';
		if (file.is_video) return '🎬';
		if (file.is_audio) return '🎵';
		if (file.is_document) return '📄';
		return '📎';
	}

	// Handle native file drop events from Tauri
	async function handleNativeFileDrop(event: FileDropEvent) {
		if (disabled) return;

		switch (event.event_type) {
			case 'hover':
				isDragging = true;
				hoverFiles = event.files;
				hoverPosition = event.position;
				dispatch('hover', { files: event.files, position: event.position });
				break;

			case 'drop':
				isDragging = false;
				hoverFiles = [];
				
				// Validate files through Tauri backend
				try {
					const paths = event.files.map(f => f.path);
					const result = await invoke<ValidationResult>('validate_dropped_files', {
						paths,
						maxFileSize,
						maxFiles,
						allowedTypes,
					});
					
					dispatch('files', {
						files: result.valid_files,
						errors: result.errors,
					});
				} catch (error) {
					console.error('Failed to validate dropped files:', error);
					dispatch('files', {
						files: [],
						errors: [`Failed to process dropped files: ${error}`],
					});
				}
				break;

			case 'cancel':
				isDragging = false;
				hoverFiles = [];
				hoverPosition = null;
				dispatch('cancel');
				break;
		}
	}

	// Set up event listener on mount
	onMount(async () => {
		try {
			unlisten = await listen<FileDropEvent>('native-file-drop', (event) => {
				handleNativeFileDrop(event.payload);
			});
		} catch (error) {
			console.error('Failed to set up native file drop listener:', error);
		}
	});

	// Clean up on destroy
	onDestroy(() => {
		if (unlisten) {
			unlisten();
		}
	});

	// Read file as base64 (exposed for external use)
	export async function readFileAsBase64(path: string, maxSizeMb = 10): Promise<string> {
		return invoke<string>('read_file_as_base64', { path, maxSizeMb });
	}

	// Get thumbnail for a file
	export async function getFileThumbnail(path: string): Promise<string | null> {
		return invoke<string | null>('get_file_thumbnail', { path });
	}
</script>

{#if isDragging && showPreview}
	<div
		class="native-drop-overlay"
		transition:fade={{ duration: 150 }}
		role="region"
		aria-label="Drop files to upload"
	>
		<div class="drop-zone" transition:scale={{ duration: 150, start: 0.95 }}>
			<div class="drop-icon">
				<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
			</div>
			
			<h2>Drop to Upload</h2>
			
			{#if hoverFiles.length > 0}
				<div class="file-preview-list">
					{#each hoverFiles.slice(0, 5) as file}
						<div class="file-preview-item">
							<span class="file-icon">{getFileTypeIcon(file)}</span>
							<span class="file-name" title={file.name}>
								{file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name}
							</span>
							{#if file.size > 0}
								<span class="file-size">{formatFileSize(file.size)}</span>
							{/if}
						</div>
					{/each}
					{#if hoverFiles.length > 5}
						<div class="more-files">
							+{hoverFiles.length - 5} more files
						</div>
					{/if}
				</div>
			{/if}
			
			<p class="limits">
				Max {maxFiles} files • {formatFileSize(maxFileSize)} each
			</p>
		</div>
	</div>
{/if}

<style>
	.native-drop-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(4px);
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 56px;
		background: var(--bg-secondary, #2b2d31);
		border: 3px dashed var(--blurple, #5865f2);
		border-radius: 16px;
		text-align: center;
		max-width: 480px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.drop-icon {
		color: var(--blurple, #5865f2);
		margin-bottom: 16px;
		animation: float 2s ease-in-out infinite;
	}

	@keyframes float {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	h2 {
		color: var(--text-primary, #f2f3f5);
		font-size: 22px;
		font-weight: 600;
		margin: 0 0 16px;
	}

	.file-preview-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		margin-bottom: 16px;
		padding: 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.file-preview-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 6px;
	}

	.file-icon {
		font-size: 18px;
		flex-shrink: 0;
	}

	.file-name {
		color: var(--text-primary, #f2f3f5);
		font-size: 13px;
		font-weight: 500;
		flex: 1;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-size {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		flex-shrink: 0;
	}

	.more-files {
		color: var(--text-secondary, #b5bac1);
		font-size: 13px;
		font-style: italic;
		text-align: center;
		padding: 4px;
	}

	.limits {
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		margin: 0;
	}
</style>
