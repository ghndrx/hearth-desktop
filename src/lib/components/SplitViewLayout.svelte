<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import {
		pinnedPanels,
		splitViewEnabled,
		activePanels,
		focusedPanelId,
		type PinnedPanel
	} from '$lib/stores/pinnedPanels';
	import ResizablePane from './ResizablePane.svelte';
	import SplitPanelView from './SplitPanelView.svelte';

	interface Props {
		/** Breakpoint for collapsing to tabs (in pixels) */
		collapseBreakpoint?: number;
		/** Main content snippet */
		main?: Snippet;
		/** Children fallback */
		children?: Snippet;
	}

	let { collapseBreakpoint = 768, main, children }: Props = $props();

	let containerWidth = $state(0);
	let isCollapsed = $state(false);
	let containerEl: HTMLDivElement;
	let resizeObserver: ResizeObserver | null = null;

	// Calculate if we should collapse based on width
	$effect(() => {
		const shouldCollapse = containerWidth > 0 && containerWidth < collapseBreakpoint;
		if (shouldCollapse !== isCollapsed) {
			isCollapsed = shouldCollapse;
			if (shouldCollapse) {
				pinnedPanels.collapseAll();
			} else {
				pinnedPanels.expandAll();
			}
		}
	});

	onMount(() => {
		if (containerEl) {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					containerWidth = entry.contentRect.width;
				}
			});
			resizeObserver.observe(containerEl);
		}
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
	});

	function handlePanelResize(panel: PinnedPanel, width: number) {
		pinnedPanels.setPanelWidth(panel.id, width);
	}

	function handleUnpin(panel: PinnedPanel) {
		pinnedPanels.unpinPanel(panel.id);
	}

	function handleFocus(panel: PinnedPanel) {
		pinnedPanels.focusPanel(panel.id);
	}

	function handleFocusMain() {
		pinnedPanels.focusPanel(null);
	}

	// Calculate main panel width
	function getMainPanelWidth(): string {
		if (!$splitViewEnabled || $activePanels.length === 0) {
			return '100%';
		}
		const totalPinnedWidth = $activePanels.reduce((sum, p) => sum + p.width, 0);
		return `calc(100% - ${totalPinnedWidth}px)`;
	}
</script>

<div
	bind:this={containerEl}
	class="split-view-container"
	class:split-active={$splitViewEnabled && $activePanels.length > 0}
	class:collapsed={isCollapsed}
>
	<!-- Main content area -->
	<div
		class="main-panel"
		class:focused={$focusedPanelId === null}
		style="width: {getMainPanelWidth()}; min-width: 400px;"
		role="region"
		aria-label="Main chat view"
		onclick={handleFocusMain}
		onkeydown={(e) => e.key === 'Enter' && handleFocusMain()}
	>
		{#if main}
			{@render main()}
		{:else if children}
			{@render children()}
		{/if}
	</div>

	<!-- Pinned panels -->
	{#if $splitViewEnabled && $activePanels.length > 0}
		{#if isCollapsed}
			<!-- Collapsed view: tabs at bottom -->
			<div class="collapsed-tabs">
				{#each $activePanels as panel (panel.id)}
					<button
						class="collapsed-tab"
						class:active={$focusedPanelId === panel.id}
						onclick={() => handleFocus(panel)}
						title={panel.title}
					>
						<span class="tab-icon">
							{#if panel.type === 'dm'}
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
									<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
								</svg>
							{:else if panel.type === 'thread'}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
									/>
								</svg>
							{:else}
								<span class="text-sm">#</span>
							{/if}
						</span>
						<span class="tab-title">{panel.title}</span>
						<button
							class="tab-close"
							onclick={(e) => {
								e.stopPropagation();
								handleUnpin(panel);
							}}
							title="Unpin"
						>
							×
						</button>
					</button>
				{/each}
			</div>

			<!-- Active panel content (overlay on mobile) -->
			{#if $focusedPanelId}
				{@const activePanel = $activePanels.find((p) => p.id === $focusedPanelId)}
				{#if activePanel}
					<div class="collapsed-panel-overlay">
						<div class="overlay-header">
							<button class="back-button" onclick={handleFocusMain}>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 19l-7-7 7-7"
									/>
								</svg>
								Back
							</button>
							<span class="overlay-title">{activePanel.title}</span>
							<button class="unpin-button" onclick={() => handleUnpin(activePanel)}>
								Unpin
							</button>
						</div>
						<div class="overlay-content">
							<SplitPanelView panel={activePanel} />
						</div>
					</div>
				{/if}
			{/if}
		{:else}
			<!-- Expanded view: side-by-side panels -->
			{#each $activePanels as panel (panel.id)}
				<ResizablePane
					width={panel.width}
					minWidth={panel.minWidth}
					maxWidth={600}
					handlePosition="left"
					on:resize={(e) => handlePanelResize(panel, e.detail.width)}
				>
					<div
						class="pinned-panel"
						class:focused={$focusedPanelId === panel.id}
						role="region"
						aria-label="Pinned {panel.type}: {panel.title}"
						onclick={() => handleFocus(panel)}
						onkeydown={(e) => e.key === 'Enter' && handleFocus(panel)}
					>
						<!-- Panel header -->
						<div class="panel-header">
							<div class="panel-header-info">
								<span class="panel-type-icon">
									{#if panel.type === 'dm'}
										<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
											<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
										</svg>
									{:else if panel.type === 'thread'}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
											/>
										</svg>
									{:else}
										<span class="text-lg text-gray-400">#</span>
									{/if}
								</span>
								<span class="panel-title">{panel.title}</span>
							</div>
							<div class="panel-actions">
								<button
									class="panel-action-btn"
									onclick={() => handleUnpin(panel)}
									title="Unpin panel"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						</div>

						<!-- Panel content -->
						<div class="panel-content">
							<SplitPanelView {panel} />
						</div>
					</div>
				</ResizablePane>
			{/each}
		{/if}
	{/if}
</div>

<style>
	.split-view-container {
		display: flex;
		flex: 1;
		height: 100%;
		overflow: hidden;
		background: var(--bg-primary, #313338);
	}

	.main-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 400px;
		overflow: hidden;
		transition: border-color 0.15s ease;
	}

	.main-panel.focused {
		/* Subtle focus indicator */
	}

	.split-active .main-panel {
		border-right: 1px solid var(--bg-tertiary, #1e1f22);
	}

	/* Pinned panel styles */
	.pinned-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-secondary, #2b2d31);
		overflow: hidden;
	}

	.pinned-panel.focused {
		/* Focus ring or indicator */
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 12px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
		flex-shrink: 0;
	}

	.panel-header-info {
		display: flex;
		align-items: center;
		gap: 8px;
		overflow: hidden;
	}

	.panel-type-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.panel-title {
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.panel-actions {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}

	.panel-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--text-muted, #949ba4);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.panel-action-btn:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-primary, #f2f3f5);
	}

	.panel-content {
		flex: 1;
		overflow: hidden;
	}

	/* Collapsed (mobile) styles */
	.collapsed .main-panel {
		width: 100% !important;
		min-width: 0;
	}

	.collapsed-tabs {
		position: fixed;
		bottom: 0;
		left: 72px; /* Account for server sidebar */
		right: 0;
		display: flex;
		gap: 4px;
		padding: 8px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid var(--bg-tertiary, #1e1f22);
		z-index: 50;
		overflow-x: auto;
	}

	.collapsed-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 8px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.collapsed-tab:hover,
	.collapsed-tab.active {
		background: var(--brand-primary, #ef4444);
		color: white;
	}

	.tab-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tab-title {
		font-size: 14px;
		font-weight: 500;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tab-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border: none;
		background: transparent;
		color: inherit;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		opacity: 0.7;
	}

	.tab-close:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.2);
	}

	/* Overlay for collapsed panel */
	.collapsed-panel-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--bg-primary, #313338);
		z-index: 100;
		display: flex;
		flex-direction: column;
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 48px;
		padding: 0 12px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid var(--bg-tertiary, #1e1f22);
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		background: transparent;
		border: none;
		color: var(--text-primary, #f2f3f5);
		cursor: pointer;
		border-radius: 4px;
	}

	.back-button:hover {
		background: var(--bg-modifier-hover, #35373c);
	}

	.overlay-title {
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
	}

	.unpin-button {
		padding: 6px 12px;
		background: transparent;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		border-radius: 4px;
		font-size: 14px;
	}

	.unpin-button:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-primary, #f2f3f5);
	}

	.overlay-content {
		flex: 1;
		overflow: hidden;
	}
</style>
