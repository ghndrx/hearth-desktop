import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface GestureBinding {
	gesture_type: string;
	action: string;
	fingers: number;
	enabled: boolean;
	description: string;
}

export interface GestureConfig {
	enabled: boolean;
	sensitivity: number;
	gestures: GestureBinding[];
	inertia_enabled: boolean;
	visual_feedback: boolean;
}

export interface GestureEvent {
	gesture_type: string;
	fingers: number;
	delta_x: number;
	delta_y: number;
	scale: number;
	rotation: number;
	velocity: number;
	timestamp: number;
}

export interface GestureStats {
	total_gestures: number;
	gestures_by_type: Record<string, number>;
	most_used_action: string | null;
	session_start: number;
}

export interface GestureActionInfo {
	id: string;
	label: string;
	category: string;
}

function createGestureManagerStore() {
	const config = writable<GestureConfig>({
		enabled: true,
		sensitivity: 1.0,
		gestures: [],
		inertia_enabled: true,
		visual_feedback: true
	});

	const stats = writable<GestureStats>({
		total_gestures: 0,
		gestures_by_type: {},
		most_used_action: null,
		session_start: Date.now()
	});

	const lastAction = writable<string | null>(null);
	const isEnabled = derived(config, ($c) => $c.enabled);

	return {
		config,
		stats,
		lastAction,
		isEnabled,

		async loadConfig() {
			try {
				const c = await invoke<GestureConfig>('gesture_get_config');
				config.set(c);
			} catch {
				// Use defaults
			}
		},

		async updateConfig(newConfig: GestureConfig) {
			const c = await invoke<GestureConfig>('gesture_update_config', { config: newConfig });
			config.set(c);
			return c;
		},

		async setEnabled(enabled: boolean) {
			await invoke('gesture_set_enabled', { enabled });
			config.update((c) => ({ ...c, enabled }));
		},

		async setSensitivity(sensitivity: number) {
			await invoke('gesture_set_sensitivity', { sensitivity });
			config.update((c) => ({ ...c, sensitivity }));
		},

		async resolveAction(event: GestureEvent): Promise<string | null> {
			const action = await invoke<string | null>('gesture_resolve_action', { event });
			if (action) {
				lastAction.set(typeof action === 'string' ? action : JSON.stringify(action));
			}
			return action;
		},

		async getAvailableActions(): Promise<GestureActionInfo[]> {
			return invoke<GestureActionInfo[]>('gesture_get_available_actions');
		},

		async loadStats() {
			const s = await invoke<GestureStats>('gesture_get_stats');
			stats.set(s);
		},

		async resetStats() {
			await invoke('gesture_reset_stats');
			stats.set({
				total_gestures: 0,
				gestures_by_type: {},
				most_used_action: null,
				session_start: Date.now()
			});
		},

		async resetConfig() {
			const c = await invoke<GestureConfig>('gesture_reset_config');
			config.set(c);
			return c;
		}
	};
}

export const gestureManager = createGestureManagerStore();
