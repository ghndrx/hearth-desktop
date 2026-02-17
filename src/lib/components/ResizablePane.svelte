<script lang="ts">
	import { createEventDispatcher, onDestroy, type Snippet } from 'svelte';

	interface Props {
		/** Current width in pixels */
		width?: number;
		/** Minimum width */
		minWidth?: number;
		/** Maximum width */
		maxWidth?: number;
		/** Position of resize handle */
		handlePosition?: 'left' | 'right';
		/** Whether resizing is disabled */
		disabled?: boolean;
		/** Additional class names */
		class?: string;
		/** Children content */
		children?: Snippet;
	}

	let {
		width = 400,
		minWidth = 300,
		maxWidth = 800,
		handlePosition = 'left',
		disabled = false,
		class: className = '',
		children
	}: Props = $props();

	const dispatch = createEventDispatcher<{
		resize: { width: number };
		resizeStart: void;
		resizeEnd: { width: number };
	}>();

	let isResizing = $state(false);
	let startX = 0;
	let startWidth = 0;
	let containerEl: HTMLDivElement;

	function handleMouseDown(event: MouseEvent) {
		if (disabled) return;

		event.preventDefault();
		isResizing = true;
		startX = event.clientX;
		startWidth = width;

		dispatch('resizeStart');

		// Add global listeners
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isResizing) return;

		const deltaX = event.clientX - startX;
		const newWidth =
			handlePosition === 'left' ? startWidth - deltaX : startWidth + deltaX;

		const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
		width = clampedWidth;

		dispatch('resize', { width: clampedWidth });
	}

	function handleMouseUp() {
		if (!isResizing) return;

		isResizing = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';

		dispatch('resizeEnd', { width });
	}

	// Touch support
	function handleTouchStart(event: TouchEvent) {
		if (disabled || event.touches.length !== 1) return;

		event.preventDefault();
		isResizing = true;
		startX = event.touches[0].clientX;
		startWidth = width;

		dispatch('resizeStart');

		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd);
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isResizing || event.touches.length !== 1) return;

		event.preventDefault();
		const deltaX = event.touches[0].clientX - startX;
		const newWidth =
			handlePosition === 'left' ? startWidth - deltaX : startWidth + deltaX;

		const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
		width = clampedWidth;

		dispatch('resize', { width: clampedWidth });
	}

	function handleTouchEnd() {
		if (!isResizing) return;

		isResizing = false;
		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);

		dispatch('resizeEnd', { width });
	}

	// Cleanup
	onDestroy(() => {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.removeEventListener('touchmove', handleTouchMove);
		document.removeEventListener('touchend', handleTouchEnd);
	});
</script>

<div
	bind:this={containerEl}
	class="resizable-pane {className}"
	class:resizing={isResizing}
	style="width: {width}px; min-width: {minWidth}px; max-width: {maxWidth}px;"
>
	<!-- Resize handle (using button for proper accessibility) -->
	{#if !disabled}
		<button
			type="button"
			class="resize-handle"
			class:handle-left={handlePosition === 'left'}
			class:handle-right={handlePosition === 'right'}
			role="separator"
			aria-orientation="vertical"
			aria-valuenow={width}
			aria-valuemin={minWidth}
			aria-valuemax={maxWidth}
			onmousedown={handleMouseDown}
			ontouchstart={handleTouchStart}
			onkeydown={(e) => {
				if (e.key === 'ArrowLeft') {
					width = Math.max(minWidth, width - 10);
					dispatch('resize', { width });
				} else if (e.key === 'ArrowRight') {
					width = Math.min(maxWidth, width + 10);
					dispatch('resize', { width });
				}
			}}
		>
			<div class="handle-line"></div>
		</button>
	{/if}

	<!-- Content -->
	<div class="pane-content">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.resizable-pane {
		position: relative;
		display: flex;
		flex-shrink: 0;
		height: 100%;
		background: var(--bg-secondary, #2b2d31);
	}

	.resizable-pane.resizing {
		user-select: none;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: col-resize;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s ease;
	}

	.resize-handle:hover,
	.resize-handle:focus {
		background-color: var(--brand-primary, #ef4444);
	}

	.resize-handle:focus {
		outline: none;
	}

	.handle-left {
		left: 0;
	}

	.handle-right {
		right: 0;
	}

	.handle-line {
		width: 2px;
		height: 40px;
		max-height: 50%;
		background-color: var(--bg-modifier-accent, #4e5058);
		border-radius: 1px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.resize-handle:hover .handle-line,
	.resize-handle:focus .handle-line,
	.resizing .handle-line {
		opacity: 1;
		background-color: var(--brand-primary, #ef4444);
	}

	.pane-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* When handle is on left, add padding */
	.resizable-pane:has(.handle-left) .pane-content {
		margin-left: 4px;
	}

	.resizable-pane:has(.handle-right) .pane-content {
		margin-right: 4px;
	}
</style>
