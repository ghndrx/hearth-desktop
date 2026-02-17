<script lang="ts">
	/**
	 * ResizeHandle.svelte
	 * FEAT-003: Split View (Desktop)
	 * 
	 * Reusable draggable resize handle component for split view panes.
	 * Uses Svelte 5 runes for reactive state management.
	 * 
	 * Features:
	 * - Mouse drag to resize
	 * - Keyboard resize (Arrow keys, Shift for larger steps)
	 * - ARIA attributes for accessibility
	 * - Visual feedback on hover/active states
	 */

	// Props using Svelte 5 runes
	interface Props {
		position?: 'left' | 'right';
		direction?: 'horizontal' | 'vertical';
		disabled?: boolean;
		ariaLabel?: string;
		onresizestart?: (coords: { clientX: number; clientY: number }) => void;
		onresize?: (coords: { clientX: number; clientY: number }) => void;
		onresizeend?: () => void;
	}

	let {
		position = 'left',
		direction = 'horizontal',
		disabled = false,
		ariaLabel = 'Resize panel',
		onresizestart,
		onresize,
		onresizeend
	}: Props = $props();

	// Local state
	let isResizing = $state(false);

	// Derived classes
	let cursorClass = $derived(direction === 'horizontal' ? 'cursor-col' : 'cursor-row');
	let positionClass = $derived(position === 'left' ? 'position-left' : 'position-right');
	let directionClass = $derived(direction === 'horizontal' ? 'direction-horizontal' : 'direction-vertical');

	function handleMouseDown(e: MouseEvent) {
		if (disabled) return;
		
		e.preventDefault();
		isResizing = true;
		
		onresizestart?.({ clientX: e.clientX, clientY: e.clientY });

		// Add global listeners for drag
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isResizing) return;
		
		e.preventDefault();
		onresize?.({ clientX: e.clientX, clientY: e.clientY });
	}

	function handleMouseUp(_e: MouseEvent) {
		if (!isResizing) return;
		
		isResizing = false;
		onresizeend?.();

		// Remove global listeners
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;
		
		// Allow keyboard-based resizing for accessibility
		const step = e.shiftKey ? 50 : 10;
		
		if (direction === 'horizontal') {
			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				onresize?.({ clientX: -step, clientY: 0 });
				onresizeend?.();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				onresize?.({ clientX: step, clientY: 0 });
				onresizeend?.();
			}
		} else {
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				onresize?.({ clientX: 0, clientY: -step });
				onresizeend?.();
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				onresize?.({ clientX: 0, clientY: step });
				onresizeend?.();
			}
		}
	}

	function handleTouchStart(e: TouchEvent) {
		if (disabled || e.touches.length !== 1) return;
		
		e.preventDefault();
		isResizing = true;
		
		const touch = e.touches[0];
		onresizestart?.({ clientX: touch.clientX, clientY: touch.clientY });

		window.addEventListener('touchmove', handleTouchMove, { passive: false });
		window.addEventListener('touchend', handleTouchEnd);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isResizing || e.touches.length !== 1) return;
		
		e.preventDefault();
		const touch = e.touches[0];
		onresize?.({ clientX: touch.clientX, clientY: touch.clientY });
	}

	function handleTouchEnd() {
		if (!isResizing) return;
		
		isResizing = false;
		onresizeend?.();

		window.removeEventListener('touchmove', handleTouchMove);
		window.removeEventListener('touchend', handleTouchEnd);
	}
</script>

<div 
	class="resize-handle {cursorClass} {positionClass} {directionClass}"
	class:resizing={isResizing}
	class:disabled
	onmousedown={handleMouseDown}
	onkeydown={handleKeydown}
	ontouchstart={handleTouchStart}
	role="separator"
	aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
	aria-label={ariaLabel}
	aria-valuenow={undefined}
	tabindex={disabled ? -1 : 0}
>
	<div class="handle-indicator" aria-hidden="true"></div>
</div>

<style>
	.resize-handle {
		position: absolute;
		z-index: 10;
		background: transparent;
		transition: background-color 0.15s ease;
		touch-action: none;
	}

	/* Horizontal resize (col-resize cursor) */
	.direction-horizontal {
		top: 0;
		bottom: 0;
		width: 6px;
	}

	.direction-horizontal.position-left {
		left: 0;
	}

	.direction-horizontal.position-right {
		right: 0;
	}

	/* Vertical resize (row-resize cursor) */
	.direction-vertical {
		left: 0;
		right: 0;
		height: 6px;
	}

	.direction-vertical.position-left {
		top: 0;
	}

	.direction-vertical.position-right {
		bottom: 0;
	}

	/* Cursors */
	.cursor-col {
		cursor: col-resize;
	}

	.cursor-row {
		cursor: row-resize;
	}

	/* Handle indicator line */
	.handle-indicator {
		position: absolute;
		background-color: transparent;
		transition: background-color 0.15s ease;
	}

	.direction-horizontal .handle-indicator {
		top: 0;
		bottom: 0;
		width: 2px;
		left: 50%;
		transform: translateX(-50%);
	}

	.direction-vertical .handle-indicator {
		left: 0;
		right: 0;
		height: 2px;
		top: 50%;
		transform: translateY(-50%);
	}

	/* Hover state */
	.resize-handle:hover .handle-indicator,
	.resize-handle:focus .handle-indicator {
		background-color: var(--brand-primary, #5865f2);
	}

	/* Active/resizing state */
	.resize-handle.resizing {
		background-color: rgba(88, 101, 242, 0.1);
	}

	.resize-handle.resizing .handle-indicator {
		background-color: var(--brand-primary, #5865f2);
	}

	/* Focus state for accessibility */
	.resize-handle:focus {
		outline: none;
	}

	.resize-handle:focus-visible .handle-indicator {
		background-color: var(--brand-primary, #5865f2);
		box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
	}

	/* Disabled state */
	.resize-handle.disabled {
		cursor: default;
		pointer-events: none;
	}

	.resize-handle.disabled .handle-indicator {
		background-color: transparent !important;
	}
</style>
