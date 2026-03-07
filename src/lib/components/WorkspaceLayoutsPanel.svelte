<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface PanelConfig {
		panel_type: string;
		width: number;
		is_pinned: boolean;
	}

	interface WorkspaceLayout {
		id: string;
		name: string;
		description: string | null;
		window_x: number;
		window_y: number;
		window_width: number;
		window_height: number;
		is_maximized: boolean;
		is_fullscreen: boolean;
		sidebar_visible: boolean;
		sidebar_width: number;
		member_list_visible: boolean;
		member_list_width: number;
		split_view_enabled: boolean;
		split_view_panels: PanelConfig[];
		active_server_id: string | null;
		active_channel_id: string | null;
		zen_mode: boolean;
		theme_override: string | null;
		created_at: number;
		updated_at: number;
		is_default: boolean;
		keyboard_shortcut: string | null;
	}

	interface LayoutPreset {
		id: string;
		name: string;
		category: string;
		layout: WorkspaceLayout;
	}

	let layouts = $state<WorkspaceLayout[]>([]);
	let presets = $state<LayoutPreset[]>([]);
	let activeLayout = $state<WorkspaceLayout | null>(null);
	let error = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	let tab = $state<'saved' | 'presets'>('saved');

	onMount(async () => {
		await loadAll();

		const unlistenSaved = await listen('layout:saved', () => loadAll());
		const unlistenDeleted = await listen('layout:deleted', () => loadAll());
		const unlistenApplied = await listen<WorkspaceLayout>('layout:applied', (e) => {
			activeLayout = e.payload;
		});

		return () => {
			unlistenSaved();
			unlistenDeleted();
			unlistenApplied();
		};
	});

	async function loadAll() {
		try {
			[layouts, presets, activeLayout] = await Promise.all([
				invoke<WorkspaceLayout[]>('layout_get_all'),
				invoke<LayoutPreset[]>('layout_get_presets'),
				invoke<WorkspaceLayout | null>('layout_get_active'),
			]);
		} catch (e) {
			error = String(e);
		}
	}

	async function applyLayout(id: string) {
		error = null;
		try {
			activeLayout = await invoke<WorkspaceLayout>('layout_load', { id });
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteLayout(id: string) {
		error = null;
		try {
			await invoke('layout_delete', { id });
			layouts = layouts.filter(l => l.id !== id);
			if (activeLayout?.id === id) activeLayout = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function duplicateLayout(id: string) {
		error = null;
		try {
			const dup = await invoke<WorkspaceLayout>('layout_duplicate', { id });
			layouts = [...layouts, dup];
		} catch (e) {
			error = String(e);
		}
	}

	async function setDefault(id: string) {
		error = null;
		try {
			await invoke('layout_set_default', { id });
			layouts = layouts.map(l => ({ ...l, is_default: l.id === id }));
		} catch (e) {
			error = String(e);
		}
	}

	async function applyPreset(presetId: string) {
		error = null;
		try {
			const layout = await invoke<WorkspaceLayout>('layout_apply_preset', { presetId });
			activeLayout = layout;
			layouts = [...layouts, layout];
			tab = 'saved';
		} catch (e) {
			error = String(e);
		}
	}

	function startRename(layout: WorkspaceLayout) {
		renamingId = layout.id;
		renameValue = layout.name;
	}

	async function finishRename() {
		if (!renamingId || !renameValue.trim()) {
			renamingId = null;
			return;
		}
		error = null;
		try {
			await invoke('layout_rename', { id: renamingId, name: renameValue.trim() });
			layouts = layouts.map(l =>
				l.id === renamingId ? { ...l, name: renameValue.trim() } : l
			);
		} catch (e) {
			error = String(e);
		}
		renamingId = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') finishRename();
		if (e.key === 'Escape') { renamingId = null; }
	}

	function formatDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	function layoutSummary(layout: WorkspaceLayout): string {
		const parts: string[] = [];
		if (layout.zen_mode) parts.push('Zen');
		if (layout.is_maximized) parts.push('Max');
		if (layout.is_fullscreen) parts.push('Full');
		if (layout.split_view_enabled) parts.push('Split');
		if (!layout.sidebar_visible) parts.push('No sidebar');
		if (!layout.member_list_visible) parts.push('No members');
		return parts.join(' \u00B7 ') || `${Math.round(layout.window_width)}\u00D7${Math.round(layout.window_height)}`;
	}

	const presetCategories = $derived(
		[...new Set(presets.map(p => p.category))]
	);
</script>

<div class="layouts-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">{'\u{1F4D0}'}</span>
			<h3>Workspace Layouts</h3>
		</div>
	</div>

	<div class="tabs">
		<button
			class="tab"
			class:active={tab === 'saved'}
			onclick={() => tab = 'saved'}
		>
			Saved ({layouts.length})
		</button>
		<button
			class="tab"
			class:active={tab === 'presets'}
			onclick={() => tab = 'presets'}
		>
			Presets
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if tab === 'saved'}
		{#if layouts.length === 0}
			<div class="empty">
				<p class="empty-text">No saved layouts yet</p>
				<p class="empty-hint">Apply a preset to get started, or save your current layout.</p>
			</div>
		{:else}
			<div class="layout-list">
				{#each layouts as layout (layout.id)}
					<div
						class="layout-card"
						class:active={activeLayout?.id === layout.id}
					>
						<div class="card-top">
							{#if renamingId === layout.id}
								<input
									class="rename-input"
									bind:value={renameValue}
									onblur={finishRename}
									onkeydown={handleRenameKeydown}
								/>
							{:else}
								<div class="card-info">
									<span class="layout-name">
										{layout.name}
										{#if layout.is_default}
											<span class="default-badge">Default</span>
										{/if}
									</span>
									<span class="layout-meta">{layoutSummary(layout)}</span>
								</div>
							{/if}
							<div class="card-actions">
								<button
									class="action-btn apply"
									onclick={() => applyLayout(layout.id)}
									title="Apply layout"
									disabled={activeLayout?.id === layout.id}
								>
									{'\u25B6'}
								</button>
							</div>
						</div>
						<div class="card-bottom">
							<span class="updated">Updated {formatDate(layout.updated_at)}</span>
							<div class="card-secondary-actions">
								<button class="small-btn" onclick={() => startRename(layout)} title="Rename">Rename</button>
								<button class="small-btn" onclick={() => duplicateLayout(layout.id)} title="Duplicate">Dup</button>
								<button class="small-btn" onclick={() => setDefault(layout.id)} title="Set as default"
									disabled={layout.is_default}
								>
									{layout.is_default ? 'Default' : 'Set default'}
								</button>
								<button class="small-btn danger" onclick={() => deleteLayout(layout.id)} title="Delete">Del</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="presets-list">
			{#each presetCategories as category}
				<div class="preset-category">
					<span class="category-label">{category}</span>
					{#each presets.filter(p => p.category === category) as preset (preset.id)}
						<button class="preset-card" onclick={() => applyPreset(preset.id)}>
							<span class="preset-name">{preset.name}</span>
							<span class="preset-desc">{preset.layout.description ?? ''}</span>
							<span class="preset-features">{layoutSummary(preset.layout)}</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.layouts-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.tabs {
		display: flex;
		gap: 4px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		padding: 3px;
	}

	.tab {
		flex: 1;
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab.active {
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
	}

	.error {
		font-size: 12px;
		color: #ed4245;
		padding: 4px 0;
	}

	.empty {
		text-align: center;
		padding: 24px 16px;
	}

	.empty-text {
		color: var(--text-secondary, #949ba4);
		font-size: 14px;
		margin: 0 0 4px;
	}

	.empty-hint {
		color: var(--text-muted, #6d6f78);
		font-size: 12px;
		margin: 0;
	}

	.layout-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 400px;
		overflow-y: auto;
	}

	.layout-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		border: 1px solid transparent;
		transition: border-color 0.15s;
	}

	.layout-card.active {
		border-color: #5865f2;
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.card-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.layout-name {
		font-size: 13px;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.default-badge {
		font-size: 9px;
		padding: 1px 5px;
		border-radius: 3px;
		background: #5865f2;
		color: white;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.layout-meta {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	.rename-input {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid #5865f2;
		border-radius: 4px;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		outline: none;
	}

	.card-actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		transition: all 0.15s;
	}

	.action-btn.apply {
		background: #5865f2;
		color: white;
	}

	.action-btn.apply:hover:not(:disabled) { background: #4752c4; }
	.action-btn:disabled { opacity: 0.4; cursor: default; }

	.card-bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.updated {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
	}

	.card-secondary-actions {
		display: flex;
		gap: 4px;
	}

	.small-btn {
		padding: 2px 6px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--text-muted, #6d6f78);
		font-size: 10px;
		cursor: pointer;
		transition: color 0.15s;
	}

	.small-btn:hover:not(:disabled) { color: var(--text-primary, #dbdee1); }
	.small-btn:disabled { opacity: 0.4; cursor: default; }
	.small-btn.danger:hover { color: #ed4245; }

	.presets-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.preset-category {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.category-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted, #6d6f78);
		padding: 0 4px;
	}

	.preset-card {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
		color: inherit;
	}

	.preset-card:hover {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.06);
	}

	.preset-name {
		font-size: 13px;
		font-weight: 600;
	}

	.preset-desc {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.preset-features {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		margin-top: 2px;
	}
</style>
