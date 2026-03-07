<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface TrayMenuItem {
		id: string;
		label: string;
		category: string;
		visible: boolean;
		order: number;
	}

	interface TrayCustomizerConfig {
		items: TrayMenuItem[];
		show_unread_badge: boolean;
		show_status_in_tooltip: boolean;
		compact_mode: boolean;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let config = $state<TrayCustomizerConfig | null>(null);
	let error = $state<string | null>(null);
	let filterCategory = $state('all');
	let dragItemId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	let categories = $derived<string[]>(() => {
		if (!config) return ['all'];
		const cats = [...new Set(config.items.map((i) => i.category))].sort();
		return ['all', ...cats];
	});

	let filteredItems = $derived<TrayMenuItem[]>(() => {
		if (!config) return [];
		let items = [...config.items].sort((a, b) => a.order - b.order);
		if (filterCategory !== 'all') {
			items = items.filter((i) => i.category === filterCategory);
		}
		return items;
	});

	let visibleCount = $derived(() => {
		if (!config) return 0;
		return config.items.filter((i) => i.visible).length;
	});

	let hiddenCount = $derived(() => {
		if (!config) return 0;
		return config.items.filter((i) => !i.visible).length;
	});

	onMount(() => {
		if (open) loadConfig();
	});

	$effect(() => {
		if (open) loadConfig();
	});

	async function loadConfig() {
		try {
			error = null;
			config = await invoke<TrayCustomizerConfig>('tray_customizer_get_config');
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleItemVisible(itemId: string) {
		if (!config) return;
		const item = config.items.find((i) => i.id === itemId);
		if (!item) return;
		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_set_item_visible', {
				itemId,
				visible: !item.visible
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleBadge() {
		if (!config) return;
		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_set_badge_visible', {
				visible: !config.show_unread_badge
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleStatusTooltip() {
		if (!config) return;
		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_set_status_tooltip', {
				enabled: !config.show_status_in_tooltip
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleCompactMode() {
		if (!config) return;
		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_set_compact_mode', {
				compact: !config.compact_mode
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function resetToDefaults() {
		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_reset');
		} catch (e) {
			error = String(e);
		}
	}

	function handleDragStart(itemId: string) {
		dragItemId = itemId;
	}

	function handleDragOver(itemId: string, e: DragEvent) {
		e.preventDefault();
		dragOverId = itemId;
	}

	async function handleDrop(targetId: string) {
		if (!dragItemId || !config || dragItemId === targetId) {
			dragItemId = null;
			dragOverId = null;
			return;
		}

		const ordered = [...config.items].sort((a, b) => a.order - b.order);
		const ids = ordered.map((i) => i.id);
		const fromIdx = ids.indexOf(dragItemId);
		const toIdx = ids.indexOf(targetId);
		if (fromIdx === -1 || toIdx === -1) return;

		ids.splice(fromIdx, 1);
		ids.splice(toIdx, 0, dragItemId);

		dragItemId = null;
		dragOverId = null;

		try {
			config = await invoke<TrayCustomizerConfig>('tray_customizer_reorder_items', {
				itemIds: ids
			});
		} catch (e) {
			error = String(e);
		}
	}

	function handleDragEnd() {
		dragItemId = null;
		dragOverId = null;
	}

	function handleClose() {
		open = false;
		onClose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
			e.preventDefault();
		}
	}

	function categoryIcon(category: string): string {
		switch (category) {
			case 'window':
				return 'W';
			case 'actions':
				return 'A';
			case 'status':
				return 'S';
			case 'navigation':
				return 'N';
			case 'notifications':
				return 'B';
			case 'productivity':
				return 'P';
			case 'privacy':
				return 'L';
			case 'system':
				return 'U';
			default:
				return '?';
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div
		class="panel-backdrop"
		transition:fade={{ duration: 100 }}
		onclick={handleClose}
		onkeydown={handleKeydown}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="panel"
			transition:slide={{ duration: 200, axis: 'x' }}
			onclick={(e) => e.stopPropagation()}
		>
			<div class="panel-header">
				<div class="header-left">
					<svg
						viewBox="0 0 24 24"
						width="20"
						height="20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="3" y="3" width="7" height="7" rx="1" />
						<rect x="14" y="3" width="7" height="7" rx="1" />
						<rect x="3" y="14" width="7" height="7" rx="1" />
						<rect x="14" y="14" width="7" height="7" rx="1" />
					</svg>
					<h2>Tray Customizer</h2>
				</div>
				<div class="header-actions">
					<button class="close-btn" onclick={handleClose} title="Close">
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			{#if config}
				<div class="settings-section">
					<h3 class="section-title">Tray Options</h3>
					<label class="setting-row">
						<span class="setting-label">Show unread badge</span>
						<button
							class="toggle-btn"
							class:active={config.show_unread_badge}
							onclick={toggleBadge}
						>
							{config.show_unread_badge ? 'ON' : 'OFF'}
						</button>
					</label>
					<label class="setting-row">
						<span class="setting-label">Status in tooltip</span>
						<button
							class="toggle-btn"
							class:active={config.show_status_in_tooltip}
							onclick={toggleStatusTooltip}
						>
							{config.show_status_in_tooltip ? 'ON' : 'OFF'}
						</button>
					</label>
					<label class="setting-row">
						<span class="setting-label">Compact mode</span>
						<button
							class="toggle-btn"
							class:active={config.compact_mode}
							onclick={toggleCompactMode}
						>
							{config.compact_mode ? 'ON' : 'OFF'}
						</button>
					</label>
				</div>

				<div class="category-bar">
					{#each categories() as cat}
						<button
							class="cat-chip"
							class:active={filterCategory === cat}
							onclick={() => (filterCategory = cat)}
						>
							{cat}
						</button>
					{/each}
				</div>

				<div class="item-list">
					{#each filteredItems() as item (item.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="tray-item"
							class:hidden-item={!item.visible}
							class:drag-over={dragOverId === item.id}
							draggable="true"
							ondragstart={() => handleDragStart(item.id)}
							ondragover={(e) => handleDragOver(item.id, e)}
							ondrop={() => handleDrop(item.id)}
							ondragend={handleDragEnd}
							transition:slide={{ duration: 100 }}
						>
							<div class="item-drag-handle">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
									<circle cx="9" cy="6" r="1.5" />
									<circle cx="15" cy="6" r="1.5" />
									<circle cx="9" cy="12" r="1.5" />
									<circle cx="15" cy="12" r="1.5" />
									<circle cx="9" cy="18" r="1.5" />
									<circle cx="15" cy="18" r="1.5" />
								</svg>
							</div>
							<div class="item-info">
								<span class="item-label" class:dimmed={!item.visible}>{item.label}</span>
								<span class="cat-badge">{item.category}</span>
							</div>
							<button
								class="visibility-btn"
								class:active={item.visible}
								onclick={() => toggleItemVisible(item.id)}
								title={item.visible ? 'Hide from tray' : 'Show in tray'}
							>
								{#if item.visible}
									<svg
										viewBox="0 0 24 24"
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
										<circle cx="12" cy="12" r="3" />
									</svg>
								{:else}
									<svg
										viewBox="0 0 24 24"
										width="16"
										height="16"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
										/>
										<line x1="1" y1="1" x2="23" y2="23" />
									</svg>
								{/if}
							</button>
						</div>
					{/each}

					{#if filteredItems().length === 0}
						<div class="empty-state">
							<div class="empty-icon">...</div>
							<p>No items in this category</p>
						</div>
					{/if}
				</div>

				<div class="panel-footer">
					<span class="stats">
						{visibleCount()} visible, {hiddenCount()} hidden
					</span>
					<button class="reset-btn" onclick={resetToDefaults}>Reset defaults</button>
				</div>
			{:else}
				<div class="loading">Loading...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 999;
		display: flex;
		justify-content: flex-end;
	}

	.panel {
		width: 420px;
		height: 100%;
		background: var(--bg-secondary, #2b2d31);
		display: flex;
		flex-direction: column;
		box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text-primary, #f2f3f5);
	}

	.header-left h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
	}

	.close-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.24));
	}

	.toggle-btn {
		padding: 3px 10px;
		border: none;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-muted, #949ba4);
	}

	.toggle-btn.active {
		background: var(--status-positive, #23a55a);
		color: white;
	}

	.error-bar {
		padding: 8px 16px;
		background: var(--status-danger, #f23f43);
		color: white;
		font-size: 13px;
	}

	.settings-section {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
	}

	.section-title {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted, #949ba4);
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
	}

	.setting-label {
		font-size: 13px;
		color: var(--text-secondary, #b5bac1);
	}

	.category-bar {
		display: flex;
		gap: 4px;
		padding: 8px 16px;
		overflow-x: auto;
		flex-shrink: 0;
	}

	.cat-chip {
		padding: 3px 10px;
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		color: var(--text-muted, #949ba4);
		border: none;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		text-transform: capitalize;
	}

	.cat-chip.active {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.item-list {
		flex: 1;
		overflow-y: auto;
		padding: 4px 12px;
	}

	.tray-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		margin-bottom: 2px;
		background: var(--bg-tertiary, #1e1f22);
		cursor: grab;
		transition: background 0.1s;
	}

	.tray-item:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}

	.tray-item.hidden-item {
		opacity: 0.5;
	}

	.tray-item.drag-over {
		border-top: 2px solid var(--brand-primary, #5865f2);
	}

	.item-drag-handle {
		color: var(--text-muted, #949ba4);
		opacity: 0.4;
		cursor: grab;
		flex-shrink: 0;
	}

	.tray-item:hover .item-drag-handle {
		opacity: 0.8;
	}

	.item-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.item-label {
		font-size: 13px;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-label.dimmed {
		color: var(--text-muted, #949ba4);
		text-decoration: line-through;
	}

	.cat-badge {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		padding: 1px 6px;
		border-radius: 8px;
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.visibility-btn {
		background: none;
		border: none;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		flex-shrink: 0;
	}

	.visibility-btn:hover {
		color: var(--text-primary, #f2f3f5);
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.24));
	}

	.visibility-btn.active {
		color: var(--status-positive, #23a55a);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 16px;
		color: var(--text-muted, #949ba4);
		gap: 12px;
	}

	.empty-icon {
		font-size: 36px;
		font-weight: 700;
		opacity: 0.3;
		color: var(--text-primary, #f2f3f5);
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-top: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.stats {
		font-weight: 500;
	}

	.reset-btn {
		padding: 4px 10px;
		background: transparent;
		color: var(--text-muted, #949ba4);
		border: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
	}

	.reset-btn:hover {
		color: var(--status-danger, #f23f43);
		border-color: var(--status-danger, #f23f43);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px;
		color: var(--text-muted, #949ba4);
	}

	.item-list::-webkit-scrollbar {
		width: 6px;
	}

	.item-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.item-list::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border-radius: 3px;
	}
</style>
