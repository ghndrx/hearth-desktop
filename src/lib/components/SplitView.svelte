<script lang="ts">
	/**
	 * SplitView.svelte
	 * FEAT-003: Split View (Desktop)
	 * 
	 * Main split view component using Svelte 5 runes.
	 * Provides a responsive multi-panel layout for pinning DMs, threads, and channels.
	 * 
	 * Features:
	 * - Draggable resize handles between panes
	 * - Keyboard resize support (Arrow keys)
	 * - Responsive: auto-disables on narrow viewports
	 * - Panel state persists to localStorage
	 */
	import { onMount } from 'svelte';
	import { 
		splitViewStore, 
		splitViewPanels, 
		splitViewEnabled, 
		splitViewResizing,
		splitViewConfig
	} from '$lib/stores/splitView';
	import PinnedPanel from './PinnedPanel.svelte';
	import type { Snippet } from 'svelte';

	// Props using Svelte 5 runes
	interface Props {
		children?: Snippet;
		desktopBreakpoint?: number;
	}

	let { children, desktopBreakpoint = 1024 }: Props = $props();

	// Local state using Svelte 5 runes
	let containerEl: HTMLDivElement | undefined = $state();
	let isDesktop = $state(true);
	let resizeObserver: ResizeObserver | null = $state(null);

	// Derived state
	let panels = $derived($splitViewPanels);
	let enabled = $derived($splitViewEnabled);
	let resizing = $derived($splitViewResizing);
	let config = $derived($splitViewConfig);
	let showSplitView = $derived(isDesktop && enabled && panels.length > 0);
	let mainMinWidth = $derived(config.mainPanelMinWidth);

	// Handle mouse move during resize
	function handleMouseMove(e: MouseEvent) {
		if (resizing.isResizing) {
			e.preventDefault();
			splitViewStore.resize(e.clientX);
		}
	}

	// Handle mouse up to end resize
	function handleMouseUp() {
		if (resizing.isResizing) {
			splitViewStore.endResize();
		}
	}

	// Handle keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		// Alt+Shift+C to clear all panels
		if (e.altKey && e.shiftKey && e.key === 'C') {
			e.preventDefault();
			splitViewStore.clearAll();
		}
		
		// Alt+Shift+T to toggle split view
		if (e.altKey && e.shiftKey && e.key === 'T') {
			e.preventDefault();
			splitViewStore.toggle();
		}
	}

	// Check if viewport is desktop size
	function checkDesktop() {
		isDesktop = typeof window !== 'undefined' && window.innerWidth >= desktopBreakpoint;
	}

	// Panel event handlers
	function handlePanelClose(panelId: string) {
		splitViewStore.unpin(panelId);
	}

	function handlePanelCollapse(panelId: string) {
		splitViewStore.toggleCollapse(panelId);
	}

	function handlePanelResizeStart(panelId: string, clientX: number) {
		splitViewStore.startResize(panelId, clientX);
	}

	onMount(() => {
		checkDesktop();
		
		// Watch for resize
		if (typeof window !== 'undefined') {
			window.addEventListener('resize', checkDesktop);
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);
			window.addEventListener('keydown', handleKeydown);
		}

		// Use ResizeObserver for more accurate container width tracking
		if (containerEl && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				checkDesktop();
			});
			resizeObserver.observe(containerEl);
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', checkDesktop);
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
				window.removeEventListener('keydown', handleKeydown);
			}
			
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
		};
	});
</script>

<div 
	class="split-view"
	class:split-view--resizing={resizing.isResizing}
	bind:this={containerEl}
	style:--main-min-width="{mainMinWidth}px"
>
	<!-- Main content area -->
	<div class="split-view__main">
		{#if children}{@render children()}{/if}
	</div>

	<!-- Pinned panels (right side) -->
	{#if showSplitView}
		<div class="split-view__panels" role="complementary" aria-label="Pinned conversations">
			{#each panels as panel, index (panel.id)}
				<PinnedPanel 
					{panel} 
					{index}
					onclose={() => handlePanelClose(panel.id)}
					oncollapse={() => handlePanelCollapse(panel.id)}
					onresizestart={(clientX) => handlePanelResizeStart(panel.id, clientX)}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.split-view {
		display: flex;
		flex-direction: row;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.split-view--resizing {
		cursor: col-resize;
		user-select: none;
	}

	.split-view__main {
		flex: 1 1 0%;
		min-width: var(--main-min-width, 400px);
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.split-view__panels {
		display: flex;
		flex-direction: row;
		flex-shrink: 0;
		height: 100%;
		overflow: hidden;
	}

	/* Responsive: hide panels on mobile */
	@media (max-width: 1023px) {
		.split-view__panels {
			display: none;
		}
	}
</style>
