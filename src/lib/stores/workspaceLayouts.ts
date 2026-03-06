import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface PanelConfig {
	panel_type: string;
	width: number;
	is_pinned: boolean;
}

export interface WorkspaceLayout {
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

export interface LayoutPreset {
	id: string;
	name: string;
	category: string;
	layout: WorkspaceLayout;
}

export const workspaceLayouts = writable<WorkspaceLayout[]>([]);
export const activeLayout = writable<WorkspaceLayout | null>(null);
export const layoutPresets = writable<LayoutPreset[]>([]);
export const layoutCount = derived(workspaceLayouts, ($layouts) => $layouts.length);

export async function saveLayout(layout: Omit<WorkspaceLayout, 'id' | 'created_at' | 'updated_at'>): Promise<WorkspaceLayout> {
	const saved = await invoke<WorkspaceLayout>('layout_save', { layout });
	workspaceLayouts.update((layouts) => {
		const idx = layouts.findIndex((l) => l.id === saved.id);
		if (idx >= 0) {
			layouts[idx] = saved;
			return [...layouts];
		}
		return [saved, ...layouts];
	});
	return saved;
}

export async function loadLayout(id: string): Promise<WorkspaceLayout> {
	const layout = await invoke<WorkspaceLayout>('layout_load', { id });
	activeLayout.set(layout);
	return layout;
}

export async function deleteLayout(id: string): Promise<void> {
	await invoke('layout_delete', { id });
	workspaceLayouts.update((layouts) => layouts.filter((l) => l.id !== id));
	activeLayout.update((current) => (current?.id === id ? null : current));
}

export async function renameLayout(id: string, name: string): Promise<void> {
	await invoke('layout_rename', { id, name });
	workspaceLayouts.update((layouts) =>
		layouts.map((l) => (l.id === id ? { ...l, name } : l))
	);
}

export async function getAllLayouts(): Promise<void> {
	const layouts = await invoke<WorkspaceLayout[]>('layout_get_all');
	workspaceLayouts.set(layouts);
}

export async function getActiveLayout(): Promise<WorkspaceLayout | null> {
	const layout = await invoke<WorkspaceLayout | null>('layout_get_active');
	activeLayout.set(layout);
	return layout;
}

export async function setDefaultLayout(id: string): Promise<void> {
	await invoke('layout_set_default', { id });
	workspaceLayouts.update((layouts) =>
		layouts.map((l) => ({ ...l, is_default: l.id === id }))
	);
}

export async function getPresets(): Promise<LayoutPreset[]> {
	const presets = await invoke<LayoutPreset[]>('layout_get_presets');
	layoutPresets.set(presets);
	return presets;
}

export async function applyPreset(presetId: string): Promise<WorkspaceLayout> {
	const layout = await invoke<WorkspaceLayout>('layout_apply_preset', { presetId });
	activeLayout.set(layout);
	workspaceLayouts.update((layouts) => [layout, ...layouts]);
	return layout;
}

export async function exportLayout(id: string): Promise<string> {
	return invoke<string>('layout_export', { id });
}

export async function importLayout(json: string): Promise<WorkspaceLayout> {
	const layout = await invoke<WorkspaceLayout>('layout_import', { json });
	workspaceLayouts.update((layouts) => [layout, ...layouts]);
	return layout;
}

export async function duplicateLayout(id: string): Promise<WorkspaceLayout> {
	const layout = await invoke<WorkspaceLayout>('layout_duplicate', { id });
	workspaceLayouts.update((layouts) => [layout, ...layouts]);
	return layout;
}
