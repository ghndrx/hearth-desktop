<script lang="ts">
	import { tabsStore, tabs, activeTabId, type Tab } from '$lib/stores/tabs';
	import { flip } from 'svelte/animate';

	// Drag state
	let dragIndex: number | null = null;
	let dragOverIndex: number | null = null;

	function handleActivate(tab: Tab) {
		tabsStore.activateTab(tab.channelId);
	}

	function handleClose(e: MouseEvent | KeyboardEvent, tab: Tab) {
		e.stopPropagation();
		tabsStore.closeTab(tab.channelId);
	}

	function handleMouseDown(e: MouseEvent, tab: Tab) {
		// Middle-click to close
		if (e.button === 1) {
			e.preventDefault();
			tabsStore.closeTab(tab.channelId);
		}
	}

	function handleAuxClick(e: MouseEvent, tab: Tab) {
		// Prevent default middle-click behavior (e.g., scroll)
		if (e.button === 1) {
			e.preventDefault();
		}
	}

	// Drag-and-drop handlers
	function handleDragStart(e: DragEvent, index: number) {
		dragIndex = index;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', String(index));
		}
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		if (dragIndex !== null && dragIndex !== toIndex) {
			tabsStore.reorderTabs(dragIndex, toIndex);
		}
		dragIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		dragIndex = null;
		dragOverIndex = null;
	}

	// Context menu
	function handleContextMenu(e: MouseEvent, tab: Tab) {
		e.preventDefault();
		// Could add a custom context menu here in the future
		// For now, just provide close-others via double-purpose
	}

	// Channel type prefix
	function tabIcon(type: number): string {
		switch (type) {
			case 0: return '#';
			case 1: return '@';
			case 2: return '🔊';
			case 3: return '@';
			default: return '#';
		}
	}
</script>

{#if $tabs.length > 0}
	<div class="tab-bar" role="tablist" aria-label="Open channels">
		{#each $tabs as tab, index (tab.channelId)}
			<div
				animate:flip={{ duration: 200 }}
				class="tab"
				class:active={$activeTabId === tab.channelId}
				class:drag-over={dragOverIndex === index && dragIndex !== index}
				class:dragging={dragIndex === index}
				role="tab"
				tabindex="0"
				aria-selected={$activeTabId === tab.channelId}
				aria-label="{tab.name} channel tab"
				draggable="true"
				on:click={() => handleActivate(tab)}
				on:mousedown={(e) => handleMouseDown(e, tab)}
				on:auxclick={(e) => handleAuxClick(e, tab)}
				on:contextmenu={(e) => handleContextMenu(e, tab)}
				on:dragstart={(e) => handleDragStart(e, index)}
				on:dragover={(e) => handleDragOver(e, index)}
				on:dragleave={handleDragLeave}
				on:drop={(e) => handleDrop(e, index)}
				on:dragend={handleDragEnd}
				on:keydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleActivate(tab);
					}
				}}
			>
				<span class="tab-icon">{tabIcon(tab.type)}</span>
				<span class="tab-name">{tab.name}</span>
				<button
					class="tab-close"
					aria-label="Close {tab.name} tab"
					on:click={(e) => handleClose(e, tab)}
					on:mousedown|stopPropagation={() => {}}
					tabindex="-1"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
						<path d="M9.354 3.354a.5.5 0 00-.708-.708L6 5.293 3.354 2.646a.5.5 0 10-.708.708L5.293 6 2.646 8.646a.5.5 0 00.708.708L6 6.707l2.646 2.647a.5.5 0 00.708-.708L6.707 6l2.647-2.646z"/>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		background: #1e1f22;
		height: 36px;
		min-height: 36px;
		overflow-x: auto;
		overflow-y: hidden;
		border-bottom: 1px solid #1a1b1e;
		scrollbar-width: thin;
		scrollbar-color: #383a40 transparent;
	}

	.tab-bar::-webkit-scrollbar {
		height: 2px;
	}

	.tab-bar::-webkit-scrollbar-thumb {
		background: #383a40;
		border-radius: 1px;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 8px;
		min-width: 0;
		max-width: 200px;
		height: 100%;
		cursor: pointer;
		user-select: none;
		border-right: 1px solid #1a1b1e;
		background: #1e1f22;
		color: #949ba4;
		font-size: 13px;
		position: relative;
		transition: background 0.1s;
	}

	.tab:hover {
		background: #2b2d31;
		color: #dbdee1;
	}

	.tab.active {
		background: #313338;
		color: #f2f3f5;
	}

	.tab.active::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: #5865f2;
	}

	.tab.dragging {
		opacity: 0.4;
	}

	.tab.drag-over {
		background: #35373c;
		box-shadow: inset 2px 0 0 #5865f2;
	}

	.tab-icon {
		flex-shrink: 0;
		font-size: 14px;
		opacity: 0.7;
		width: 14px;
		text-align: center;
	}

	.tab-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	.tab-close {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border: none;
		background: none;
		color: #949ba4;
		border-radius: 3px;
		cursor: pointer;
		padding: 0;
		opacity: 0;
		transition: opacity 0.1s, background 0.1s;
	}

	.tab:hover .tab-close,
	.tab.active .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		background: #383a40;
		color: #dbdee1;
	}
</style>
