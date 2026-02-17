<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export let maxFileSize = 25 * 1024 * 1024; // 25MB default
	export let maxFiles = 10;
	export let acceptedTypes = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar';
	export let disabled = false;

	const dispatch = createEventDispatcher<{
		files: { files: File[]; errors: string[] };
	}>();

	let isDragging = false;
	let dragCounter = 0;

	const allowedExtensions = new Set([
		// Images
		'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
		// Videos
		'.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v',
		// Audio
		'.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac',
		// Documents
		'.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt',
		// Archives
		'.zip', '.rar', '.7z', '.tar', '.gz',
		// Code
		'.json', '.xml', '.csv', '.md'
	]);

	const blockedExtensions = new Set([
		'.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.ps1', '.sh', '.bash', '.jar'
	]);

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function validateFile(file: File): { valid: boolean; error?: string } {
		// Check file size
		if (file.size > maxFileSize) {
			return {
				valid: false,
				error: `${file.name} is too large (${formatFileSize(file.size)}). Max size: ${formatFileSize(maxFileSize)}`
			};
		}

		// Check extension
		const ext = '.' + file.name.split('.').pop()?.toLowerCase();
		if (blockedExtensions.has(ext)) {
			return {
				valid: false,
				error: `${file.name}: File type not allowed for security reasons`
			};
		}

		return { valid: true };
	}

	function processFiles(fileList: FileList | File[]) {
		const files: File[] = [];
		const errors: string[] = [];

		const fileArray = Array.from(fileList);
		
		if (fileArray.length > maxFiles) {
			errors.push(`Too many files. Maximum ${maxFiles} files allowed.`);
			fileArray.splice(maxFiles);
		}

		for (const file of fileArray) {
			const validation = validateFile(file);
			if (validation.valid) {
				files.push(file);
			} else if (validation.error) {
				errors.push(validation.error);
			}
		}

		if (files.length > 0 || errors.length > 0) {
			dispatch('files', { files, errors });
		}
	}

	function handleDragEnter(e: DragEvent) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		
		if (e.dataTransfer?.types.includes('Files')) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		
		if (dragCounter === 0) {
			isDragging = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDrop(e: DragEvent) {
		if (disabled) return;
		e.preventDefault();
		e.stopPropagation();
		
		isDragging = false;
		dragCounter = 0;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			processFiles(files);
		}
	}
</script>

<svelte:window
	on:dragenter={handleDragEnter}
	on:dragleave={handleDragLeave}
	on:dragover={handleDragOver}
	on:drop={handleDrop}
/>

{#if isDragging}
	<div
		class="upload-overlay"
		transition:fade={{ duration: 150 }}
		role="region"
		aria-label="Drop files to upload"
	>
		<div class="upload-zone" transition:scale={{ duration: 150, start: 0.95 }}>
			<div class="upload-icon">
				<svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<polyline points="17 8 12 3 7 8" />
					<line x1="12" y1="3" x2="12" y2="15" />
				</svg>
			</div>
			<h2>Upload to Channel</h2>
			<p class="subtitle">Drop files here to upload</p>
			<p class="limits">
				Max {maxFiles} files • {formatFileSize(maxFileSize)} each
			</p>
		</div>
	</div>
{/if}

<style>
	.upload-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		pointer-events: all;
	}

	.upload-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 64px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px dashed var(--blurple, #5865f2);
		border-radius: 16px;
		text-align: center;
	}

	.upload-icon {
		color: var(--blurple, #5865f2);
		margin-bottom: 16px;
		animation: bounce 1s ease-in-out infinite;
	}

	@keyframes bounce {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	h2 {
		color: var(--text-primary, #f2f3f5);
		font-size: 24px;
		font-weight: 600;
		margin: 0 0 8px;
	}

	.subtitle {
		color: var(--text-secondary, #b5bac1);
		font-size: 16px;
		margin: 0 0 16px;
	}

	.limits {
		color: var(--text-muted, #949ba4);
		font-size: 13px;
		margin: 0;
	}
</style>
