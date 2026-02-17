<script lang="ts">
	/**
	 * ImageCropModal Component
	 * 
	 * A modal for cropping images before upload:
	 * - Supports circular (avatar) and rectangular (banner) crops
	 * - Pan and zoom controls
	 * - Preview of cropped result
	 */
	
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import Modal from './Modal.svelte';
	
	export let file: File;
	export let aspectRatio = 1; // Width / Height
	export let circular = false;
	export let minWidth = 128;
	export let maxWidth = 1024;
	
	const dispatch = createEventDispatcher<{
		crop: { croppedImage: string; blob: Blob };
		close: void;
	}>();
	
	let imageUrl: string;
	let canvas: HTMLCanvasElement;
	let previewCanvas: HTMLCanvasElement;
	let img: HTMLImageElement;
	let containerRef: HTMLDivElement;
	
	// Crop state
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let initialOffsetX = 0;
	let initialOffsetY = 0;
	
	// Image dimensions
	let imgWidth = 0;
	let imgHeight = 0;
	let cropAreaWidth = 300;
	let cropAreaHeight = 300;
	
	$: cropAreaHeight = cropAreaWidth / aspectRatio;
	$: minScale = Math.max(cropAreaWidth / imgWidth, cropAreaHeight / imgHeight) || 1;
	$: maxScale = Math.min(maxWidth / cropAreaWidth, 4);
	
	function handleImageLoad() {
		imgWidth = img.naturalWidth;
		imgHeight = img.naturalHeight;
		
		// Calculate initial scale to fit image in crop area
		scale = Math.max(
			cropAreaWidth / imgWidth,
			cropAreaHeight / imgHeight
		) * 1.1;
		
		// Center the image
		centerImage();
		updatePreview();
	}
	
	function centerImage() {
		offsetX = (cropAreaWidth - imgWidth * scale) / 2;
		offsetY = (cropAreaHeight - imgHeight * scale) / 2;
	}
	
	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		initialOffsetX = offsetX;
		initialOffsetY = offsetY;
	}
	
	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		
		offsetX = initialOffsetX + dx;
		offsetY = initialOffsetY + dy;
		
		constrainOffset();
		updatePreview();
	}
	
	function handleMouseUp() {
		isDragging = false;
	}
	
	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		
		const delta = e.deltaY > 0 ? 0.95 : 1.05;
		const newScale = Math.max(minScale, Math.min(maxScale, scale * delta));
		
		if (newScale !== scale) {
			// Zoom towards mouse position
			const rect = containerRef.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;
			
			const ratio = newScale / scale;
			offsetX = mouseX - (mouseX - offsetX) * ratio;
			offsetY = mouseY - (mouseY - offsetY) * ratio;
			
			scale = newScale;
			constrainOffset();
			updatePreview();
		}
	}
	
	function handleTouchStart(e: TouchEvent) {
		if (e.touches.length === 1) {
			isDragging = true;
			dragStartX = e.touches[0].clientX;
			dragStartY = e.touches[0].clientY;
			initialOffsetX = offsetX;
			initialOffsetY = offsetY;
		}
	}
	
	function handleTouchMove(e: TouchEvent) {
		if (!isDragging || e.touches.length !== 1) return;
		e.preventDefault();
		
		const dx = e.touches[0].clientX - dragStartX;
		const dy = e.touches[0].clientY - dragStartY;
		
		offsetX = initialOffsetX + dx;
		offsetY = initialOffsetY + dy;
		
		constrainOffset();
		updatePreview();
	}
	
	function handleTouchEnd() {
		isDragging = false;
	}
	
	function constrainOffset() {
		// Ensure image covers the crop area
		const scaledWidth = imgWidth * scale;
		const scaledHeight = imgHeight * scale;
		
		const maxOffsetX = 0;
		const minOffsetX = cropAreaWidth - scaledWidth;
		const maxOffsetY = 0;
		const minOffsetY = cropAreaHeight - scaledHeight;
		
		offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, offsetX));
		offsetY = Math.max(minOffsetY, Math.min(maxOffsetY, offsetY));
	}
	
	function handleZoomChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const newScale = parseFloat(input.value);
		
		// Zoom towards center
		const centerX = cropAreaWidth / 2;
		const centerY = cropAreaHeight / 2;
		
		const ratio = newScale / scale;
		offsetX = centerX - (centerX - offsetX) * ratio;
		offsetY = centerY - (centerY - offsetY) * ratio;
		
		scale = newScale;
		constrainOffset();
		updatePreview();
	}
	
	function updatePreview() {
		if (!previewCanvas || !img) return;
		
		const ctx = previewCanvas.getContext('2d');
		if (!ctx) return;
		
		const outputSize = Math.min(cropAreaWidth, 256);
		previewCanvas.width = circular ? outputSize : cropAreaWidth;
		previewCanvas.height = circular ? outputSize : cropAreaHeight;
		
		// Calculate source rect in original image coordinates
		const srcX = -offsetX / scale;
		const srcY = -offsetY / scale;
		const srcWidth = cropAreaWidth / scale;
		const srcHeight = cropAreaHeight / scale;
		
		// Clear and draw
		ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		
		if (circular) {
			ctx.beginPath();
			ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
		}
		
		ctx.drawImage(
			img,
			srcX, srcY, srcWidth, srcHeight,
			0, 0, previewCanvas.width, previewCanvas.height
		);
	}
	
	async function handleCrop() {
		if (!canvas || !img) return;
		
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		
		// Output size
		const outputWidth = Math.min(cropAreaWidth * 2, maxWidth);
		const outputHeight = circular ? outputWidth : outputWidth / aspectRatio;
		
		canvas.width = outputWidth;
		canvas.height = outputHeight;
		
		// Calculate source rect
		const srcX = -offsetX / scale;
		const srcY = -offsetY / scale;
		const srcWidth = cropAreaWidth / scale;
		const srcHeight = cropAreaHeight / scale;
		
		// Clear and draw
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		if (circular) {
			ctx.beginPath();
			ctx.arc(outputWidth / 2, outputHeight / 2, outputWidth / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
		}
		
		ctx.drawImage(
			img,
			srcX, srcY, srcWidth, srcHeight,
			0, 0, canvas.width, canvas.height
		);
		
		// Convert to blob
		const dataUrl = canvas.toDataURL('image/png');
		const blob = await new Promise<Blob>((resolve) => {
			canvas.toBlob((b) => resolve(b!), 'image/png', 0.95);
		});
		
		dispatch('crop', { croppedImage: dataUrl, blob });
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			dispatch('close');
		}
	}
	
	onMount(() => {
		imageUrl = URL.createObjectURL(file);
		img = new Image();
		img.onload = handleImageLoad;
		img.src = imageUrl;
		
		document.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		if (imageUrl) URL.revokeObjectURL(imageUrl);
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

<Modal on:close={() => dispatch('close')} maxWidth="500px">
	<div class="crop-modal">
		<h2 class="title">Edit Image</h2>
		
		<!-- Crop Area -->
		<div 
			class="crop-container"
			bind:this={containerRef}
			style="width: {cropAreaWidth}px; height: {cropAreaHeight}px;"
			on:mousedown={handleMouseDown}
			on:wheel={handleWheel}
			on:touchstart={handleTouchStart}
			on:touchmove={handleTouchMove}
			on:touchend={handleTouchEnd}
			role="application"
			aria-label="Drag to position image"
		>
			<div 
				class="image-wrapper"
				style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: 0 0;"
			>
				{#if imageUrl}
					<img src={imageUrl} alt="Preview" draggable="false" />
				{/if}
			</div>
			
			<!-- Crop overlay -->
			<div class="crop-overlay" class:circular>
				<div class="crop-border" class:circular></div>
			</div>
		</div>
		
		<!-- Zoom Slider -->
		<div class="zoom-control">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="zoom-icon">
				<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/>
			</svg>
			<input 
				type="range"
				min={minScale}
				max={maxScale}
				step="0.01"
				value={scale}
				on:input={handleZoomChange}
				class="zoom-slider"
			/>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="zoom-icon">
				<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
			</svg>
		</div>
		
		<!-- Preview -->
		<div class="preview-section">
			<span class="preview-label">Preview</span>
			<div class="preview-row">
				<canvas 
					bind:this={previewCanvas} 
					class="preview-canvas"
					class:circular
				></canvas>
			</div>
		</div>
		
		<!-- Hidden canvas for output -->
		<canvas bind:this={canvas} style="display: none;"></canvas>
		
		<!-- Actions -->
		<div class="actions">
			<button class="btn-cancel" on:click={() => dispatch('close')}>
				Cancel
			</button>
			<button class="btn-apply" on:click={handleCrop}>
				Apply
			</button>
		</div>
	</div>
</Modal>

<svelte:window 
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
/>

<style>
	.crop-modal {
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	
	.title {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary, #f2f3f5);
		margin: 0;
	}
	
	/* Crop Container */
	.crop-container {
		position: relative;
		margin: 0 auto;
		overflow: hidden;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		cursor: grab;
		touch-action: none;
	}
	
	.crop-container:active {
		cursor: grabbing;
	}
	
	.image-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		will-change: transform;
	}
	
	.image-wrapper img {
		display: block;
		max-width: none;
		pointer-events: none;
		user-select: none;
	}
	
	/* Crop Overlay */
	.crop-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
	}
	
	.crop-overlay.circular {
		border-radius: 50%;
	}
	
	.crop-border {
		position: absolute;
		inset: 0;
		border: 2px solid white;
		border-radius: inherit;
	}
	
	.crop-border.circular {
		border-radius: 50%;
	}
	
	/* Zoom Control */
	.zoom-control {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 0 16px;
	}
	
	.zoom-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}
	
	.zoom-slider {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 2px;
		outline: none;
	}
	
	.zoom-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--brand-primary, #5865f2);
		cursor: pointer;
		transition: transform 0.1s ease;
	}
	
	.zoom-slider::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}
	
	.zoom-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--brand-primary, #5865f2);
		cursor: pointer;
		border: none;
	}
	
	/* Preview */
	.preview-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	
	.preview-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		text-transform: uppercase;
	}
	
	.preview-row {
		display: flex;
		justify-content: center;
	}
	
	.preview-canvas {
		border: 2px solid var(--bg-modifier-accent, #3f4147);
	}
	
	.preview-canvas.circular {
		border-radius: 50%;
	}
	
	/* Actions */
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 8px;
	}
	
	.btn-cancel {
		padding: 10px 20px;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}
	
	.btn-cancel:hover {
		text-decoration: underline;
	}
	
	.btn-apply {
		padding: 10px 24px;
		background: var(--brand-primary, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.btn-apply:hover {
		background: var(--brand-hover, #4752c4);
	}
</style>
