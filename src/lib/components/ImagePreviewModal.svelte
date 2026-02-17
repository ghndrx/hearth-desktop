<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { imagePreviewStore } from '$lib/stores/imagePreview';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	let imageElement: HTMLImageElement;
	let zoom = 1;
	let isDragging = false;
	let dragStart = { x: 0, y: 0 };
	let position = { x: 0, y: 0 };

	function close() {
		imagePreviewStore.close();
		dispatch('close');
		resetView();
	}

	function resetView() {
		zoom = 1;
		position = { x: 0, y: 0 };
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!$imagePreviewStore.isOpen) return;

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case '+':
			case '=':
				e.preventDefault();
				zoomIn();
				break;
			case '-':
				e.preventDefault();
				zoomOut();
				break;
			case '0':
				e.preventDefault();
				resetView();
				break;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function zoomIn() {
		zoom = Math.min(zoom * 1.25, 5);
	}

	function zoomOut() {
		zoom = Math.max(zoom / 1.25, 0.25);
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY < 0) {
			zoomIn();
		} else {
			zoomOut();
		}
	}

	function handleMouseDown(e: MouseEvent) {
		if (zoom > 1) {
			isDragging = true;
			dragStart = { x: e.clientX - position.x, y: e.clientY - position.y };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isDragging) {
			position = {
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y,
			};
		}
	}

	function handleMouseUp() {
		isDragging = false;
	}

	async function downloadImage() {
		try {
			const response = await fetch($imagePreviewStore.src);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = $imagePreviewStore.filename || 'image';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download image:', err);
			// Fallback: open in new tab
			window.open($imagePreviewStore.src, '_blank');
		}
	}

	function openInNewTab() {
		window.open($imagePreviewStore.src, '_blank');
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	});
</script>

{#if $imagePreviewStore.isOpen}
	<div
		class="modal-backdrop"
		transition:fade={{ duration: 150 }}
		on:click={handleBackdropClick}
		on:wheel={handleWheel}
		role="dialog"
		aria-modal="true"
		aria-label="Image preview"
	>
		<!-- Toolbar -->
		<div class="toolbar">
			<div class="toolbar-left">
				<span class="filename">{$imagePreviewStore.filename}</span>
			</div>
			<div class="toolbar-right">
				<button
					class="toolbar-btn"
					on:click={zoomOut}
					title="Zoom out (-)"
					aria-label="Zoom out"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M19 13H5v-2h14v2z"/>
					</svg>
				</button>
				<span class="zoom-level">{Math.round(zoom * 100)}%</span>
				<button
					class="toolbar-btn"
					on:click={zoomIn}
					title="Zoom in (+)"
					aria-label="Zoom in"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
					</svg>
				</button>
				<div class="toolbar-divider"></div>
				<button
					class="toolbar-btn"
					on:click={openInNewTab}
					title="Open in new tab"
					aria-label="Open in new tab"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
					</svg>
				</button>
				<button
					class="toolbar-btn"
					on:click={downloadImage}
					title="Download"
					aria-label="Download image"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
					</svg>
				</button>
				<div class="toolbar-divider"></div>
				<button
					class="toolbar-btn close-btn"
					on:click={close}
					title="Close (Esc)"
					aria-label="Close preview"
					type="button"
				>
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Image container -->
		<div
			class="image-container"
			class:dragging={isDragging}
			class:zoomable={zoom > 1}
			on:mousedown={handleMouseDown}
		>
			<img
				bind:this={imageElement}
				src={$imagePreviewStore.src}
				alt={$imagePreviewStore.alt || 'Image preview'}
				class="preview-image"
				style="transform: scale({zoom}) translate({position.x / zoom}px, {position.y / zoom}px);"
				transition:scale={{ duration: 200, start: 0.9 }}
				draggable="false"
			/>
		</div>

		<!-- Keyboard hints -->
		<div class="keyboard-hints">
			<span><kbd>Esc</kbd> Close</span>
			<span><kbd>+</kbd>/<kbd>-</kbd> Zoom</span>
			<span><kbd>0</kbd> Reset</span>
			<span>Scroll to zoom</span>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.toolbar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 48px;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		z-index: 1;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.filename {
		color: var(--text-normal, #f2f3f5);
		font-size: 14px;
		font-weight: 500;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 4px;
		background: transparent;
		border: none;
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: all 0.1s ease;
	}

	.toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-normal, #f2f3f5);
	}

	.toolbar-btn:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	.close-btn {
		margin-left: 8px;
	}

	.toolbar-divider {
		width: 1px;
		height: 24px;
		background: rgba(255, 255, 255, 0.1);
		margin: 0 4px;
	}

	.zoom-level {
		min-width: 48px;
		text-align: center;
		font-size: 13px;
		color: var(--text-muted, #b5bac1);
		font-family: monospace;
	}

	.image-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		cursor: default;
		width: 100%;
		padding: 48px 0;
	}

	.image-container.zoomable {
		cursor: grab;
	}

	.image-container.dragging {
		cursor: grabbing;
	}

	.preview-image {
		max-width: 90vw;
		max-height: calc(100vh - 120px);
		object-fit: contain;
		user-select: none;
		transition: transform 0.1s ease;
	}

	.keyboard-hints {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 16px;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		border-radius: 8px;
		font-size: 12px;
		color: var(--text-muted, #b5bac1);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.modal-backdrop:hover .keyboard-hints {
		opacity: 1;
	}

	kbd {
		display: inline-block;
		padding: 2px 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		font-family: inherit;
		font-size: 11px;
	}
</style>
