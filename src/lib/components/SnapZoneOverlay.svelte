<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';

	const dispatch = createEventDispatcher<{
		snap: { corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null };
	}>();

	export let isDragging = false;
	export let currentPosition = { x: 0, y: 0 };
	export let windowSize = { width: 300, height: 200 };

	let snapZones: Array<{
		corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
		x: number;
		y: number;
		width: number;
		height: number;
		active: boolean;
	}> = [];

	let screenSize = { width: 1920, height: 1080 };
	let activeSnapZone: string | null = null;

	function updateSnapZones() {
		if (!browser) return;

		// Get actual screen dimensions
		screenSize = {
			width: window.screen.availWidth,
			height: window.screen.availHeight
		};

		const snapSize = 100; // Size of snap zone detection area
		const padding = 20;

		snapZones = [
			{
				corner: 'top-left',
				x: 0,
				y: 0,
				width: snapSize,
				height: snapSize,
				active: false
			},
			{
				corner: 'top-right',
				x: screenSize.width - snapSize,
				y: 0,
				width: snapSize,
				height: snapSize,
				active: false
			},
			{
				corner: 'bottom-left',
				x: 0,
				y: screenSize.height - snapSize,
				width: snapSize,
				height: snapSize,
				active: false
			},
			{
				corner: 'bottom-right',
				x: screenSize.width - snapSize,
				y: screenSize.height - snapSize,
				width: snapSize,
				height: snapSize,
				active: false
			}
		];
	}

	function checkSnapZone(mouseX: number, mouseY: number) {
		let newActiveZone: string | null = null;

		for (const zone of snapZones) {
			const inZone = mouseX >= zone.x &&
			               mouseX <= zone.x + zone.width &&
			               mouseY >= zone.y &&
			               mouseY <= zone.y + zone.height;

			zone.active = inZone;

			if (inZone) {
				newActiveZone = zone.corner;
			}
		}

		// Only dispatch if the active zone changed
		if (newActiveZone !== activeSnapZone) {
			activeSnapZone = newActiveZone;
			dispatch('snap', { corner: newActiveZone as any });
		}

		// Force reactivity
		snapZones = [...snapZones];
	}

	function getSnapPosition(corner: string) {
		const padding = 20;

		switch (corner) {
			case 'top-left':
				return { x: padding, y: padding };
			case 'top-right':
				return { x: screenSize.width - windowSize.width - padding, y: padding };
			case 'bottom-left':
				return { x: padding, y: screenSize.height - windowSize.height - padding };
			case 'bottom-right':
				return { x: screenSize.width - windowSize.width - padding, y: screenSize.height - windowSize.height - padding };
			default:
				return null;
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		checkSnapZone(event.clientX, event.clientY);
	}

	function handleResize() {
		updateSnapZones();
	}

	onMount(() => {
		updateSnapZones();

		if (browser) {
			window.addEventListener('resize', handleResize);
			document.addEventListener('mousemove', handleMouseMove);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('mousemove', handleMouseMove);
		}
	});

	// Reset active zones when not dragging
	$: if (!isDragging) {
		activeSnapZone = null;
		snapZones = snapZones.map(zone => ({ ...zone, active: false }));
	}

	// Export helper functions for external use
	export { getSnapPosition };
</script>

{#if isDragging && browser}
	<div class="snap-overlay">
		{#each snapZones as zone (zone.corner)}
			<div
				class="snap-zone"
				class:active={zone.active}
				style="
					left: {zone.x}px;
					top: {zone.y}px;
					width: {zone.width}px;
					height: {zone.height}px;
				"
			>
				<div class="snap-zone-indicator">
					<div class="snap-zone-preview"
						style="
							width: {windowSize.width * 0.3}px;
							height: {windowSize.height * 0.3}px;
						"
					></div>
					<span class="snap-zone-label">
						{zone.corner.replace('-', ' ').toUpperCase()}
					</span>
				</div>
			</div>
		{/each}

		{#if activeSnapZone}
			{@const snapPos = getSnapPosition(activeSnapZone)}
			{#if snapPos}
				<div
					class="snap-preview"
					style="
						left: {snapPos.x}px;
						top: {snapPos.y}px;
						width: {windowSize.width}px;
						height: {windowSize.height}px;
					"
				></div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.snap-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 9999;
	}

	.snap-zone {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed transparent;
		border-radius: 8px;
		transition: all 0.2s ease;
		background: rgba(114, 137, 218, 0.1);
		backdrop-filter: blur(5px);
		opacity: 0.7;
	}

	.snap-zone.active {
		border-color: #7289da;
		background: rgba(114, 137, 218, 0.3);
		opacity: 1;
		transform: scale(1.05);
	}

	.snap-zone-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: #7289da;
	}

	.snap-zone.active .snap-zone-indicator {
		color: #ffffff;
	}

	.snap-zone-preview {
		border: 2px solid currentColor;
		border-radius: 4px;
		background: rgba(114, 137, 218, 0.2);
		transition: all 0.2s ease;
	}

	.snap-zone.active .snap-zone-preview {
		background: rgba(114, 137, 218, 0.4);
		box-shadow: 0 4px 12px rgba(114, 137, 218, 0.3);
	}

	.snap-zone-label {
		font-size: 12px;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.snap-preview {
		position: absolute;
		border: 2px solid #7289da;
		border-radius: 8px;
		background: rgba(114, 137, 218, 0.2);
		backdrop-filter: blur(5px);
		box-shadow: 0 8px 25px rgba(114, 137, 218, 0.4);
		animation: snapPreview 0.2s ease;
		pointer-events: none;
	}

	@keyframes snapPreview {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Hide snap zones when not dragging */
	.snap-zone:not(.active) {
		opacity: 0.4;
	}
</style>