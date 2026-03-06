import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface DashboardWidget {
	id: string;
	widget_type: string;
	title: string;
	position_x: number;
	position_y: number;
	width: number;
	height: number;
	is_visible: boolean;
	is_pinned: boolean;
	config: Record<string, unknown>;
	created_at: number;
}

export interface DashboardConfig {
	columns: number;
	row_height: number;
	gap: number;
	show_header: boolean;
	auto_refresh_interval_ms: number;
	theme: string;
}

export interface DashboardState {
	widgets: DashboardWidget[];
	config: DashboardConfig;
	is_visible: boolean;
}

export interface AvailableWidget {
	widget_type: string;
	name: string;
	description: string;
	default_width: number;
	default_height: number;
	icon: string;
}

export const dashboardState = writable<DashboardState | null>(null);
export const dashboardVisible = derived(dashboardState, ($state) => $state?.is_visible ?? false);
export const dashboardWidgets = derived(dashboardState, ($state) => $state?.widgets ?? []);
export const dashboardConfig = derived(dashboardState, ($state) => $state?.config ?? null);

export async function getDashboardState(): Promise<DashboardState> {
	const state = await invoke<DashboardState>('dashboard_get_state');
	dashboardState.set(state);
	return state;
}

export async function setDashboardVisible(visible: boolean): Promise<void> {
	const state = await invoke<DashboardState>('dashboard_set_visible', { visible });
	dashboardState.set(state);
}

export async function toggleDashboard(): Promise<void> {
	const state = await invoke<DashboardState>('dashboard_toggle_visible');
	dashboardState.set(state);
}

export async function addWidget(data: {
	widget_type: string;
	title: string;
	position_x: number;
	position_y: number;
	width?: number;
	height?: number;
	config?: Record<string, unknown>;
}): Promise<DashboardWidget> {
	const widget = await invoke<DashboardWidget>('dashboard_add_widget', { data });
	dashboardState.update((s) =>
		s ? { ...s, widgets: [...s.widgets, widget] } : s
	);
	return widget;
}

export async function removeWidget(id: string): Promise<void> {
	await invoke('dashboard_remove_widget', { id });
	dashboardState.update((s) =>
		s ? { ...s, widgets: s.widgets.filter((w) => w.id !== id) } : s
	);
}

export async function updateWidget(
	id: string,
	updates: Partial<Pick<DashboardWidget, 'title' | 'is_visible' | 'config'>>
): Promise<void> {
	await invoke('dashboard_update_widget', { id, updates });
	dashboardState.update((s) =>
		s
			? { ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)) }
			: s
	);
}

export async function moveWidget(id: string, positionX: number, positionY: number): Promise<void> {
	await invoke('dashboard_move_widget', { id, positionX, positionY });
	dashboardState.update((s) =>
		s
			? {
					...s,
					widgets: s.widgets.map((w) =>
						w.id === id ? { ...w, position_x: positionX, position_y: positionY } : w
					)
				}
			: s
	);
}

export async function resizeWidget(id: string, width: number, height: number): Promise<void> {
	await invoke('dashboard_resize_widget', { id, width, height });
	dashboardState.update((s) =>
		s
			? { ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, width, height } : w)) }
			: s
	);
}

export async function toggleWidgetPin(id: string): Promise<void> {
	await invoke('dashboard_toggle_widget_pin', { id });
	dashboardState.update((s) =>
		s
			? {
					...s,
					widgets: s.widgets.map((w) =>
						w.id === id ? { ...w, is_pinned: !w.is_pinned } : w
					)
				}
			: s
	);
}

export async function getDashboardConfig(): Promise<DashboardConfig> {
	return invoke<DashboardConfig>('dashboard_get_config');
}

export async function setDashboardConfig(config: DashboardConfig): Promise<void> {
	await invoke('dashboard_set_config', { config });
	dashboardState.update((s) => (s ? { ...s, config } : s));
}

export async function resetDashboard(): Promise<void> {
	const state = await invoke<DashboardState>('dashboard_reset');
	dashboardState.set(state);
}

export async function getAvailableWidgets(): Promise<AvailableWidget[]> {
	return invoke<AvailableWidget[]>('dashboard_get_available_widgets');
}

export async function exportDashboard(): Promise<string> {
	return invoke<string>('dashboard_export');
}

export async function importDashboard(json: string): Promise<void> {
	const state = await invoke<DashboardState>('dashboard_import', { json });
	dashboardState.set(state);
}
