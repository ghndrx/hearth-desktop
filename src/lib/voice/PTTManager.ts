import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { get } from 'svelte/store';
import { voiceActions, voiceState } from '$lib/stores/voice';

export class PTTManager {
	private unlisten: UnlistenFn | null = null;
	private currentHotkey: string | null = null;

	async init(): Promise<void> {
		// Load saved PTT settings
		voiceActions.loadPttSettings();

		// Set up PTT event listener
		await this.setupEventListener();

		// Register current hotkey if PTT is enabled
		const state = get(voiceState);
		if (state.ptt.enabled && state.ptt.hotkey) {
			await this.registerHotkey(state.ptt.hotkey);
		}
	}

	async destroy(): Promise<void> {
		if (this.unlisten) {
			this.unlisten();
			this.unlisten = null;
		}

		if (this.currentHotkey) {
			await this.unregisterHotkey(this.currentHotkey);
		}
	}

	private async setupEventListener(): Promise<void> {
		// Listen for PTT press events from Tauri backend
		this.unlisten = await listen('ptt-pressed', () => {
			const state = get(voiceState);

			// Toggle PTT state - if currently pressed, release it; if released, press it
			const newPressed = !state.ptt.isPressed;
			voiceActions.setPttPressed(newPressed);
		});
	}

	async enablePTT(enabled: boolean): Promise<void> {
		const state = get(voiceState);

		if (enabled && state.ptt.hotkey) {
			// Register the hotkey
			await this.registerHotkey(state.ptt.hotkey);
		} else if (!enabled && this.currentHotkey) {
			// Unregister current hotkey and release PTT if pressed
			await this.unregisterHotkey(this.currentHotkey);
			voiceActions.setPttPressed(false);
		}

		voiceActions.setPttEnabled(enabled);
		voiceActions.savePttSettings();
	}

	async setHotkey(newHotkey: string): Promise<void> {
		const state = get(voiceState);

		// Unregister old hotkey if it exists
		if (this.currentHotkey) {
			await this.unregisterHotkey(this.currentHotkey);
		}

		// Register new hotkey if PTT is enabled
		if (state.ptt.enabled) {
			await this.registerHotkey(newHotkey);
		}

		voiceActions.setPttHotkey(newHotkey);
		voiceActions.savePttSettings();
	}

	private async registerHotkey(hotkey: string): Promise<void> {
		try {
			await invoke('register_ptt_shortcut', { accelerator: hotkey });
			this.currentHotkey = hotkey;
			console.log(`[PTT] Registered hotkey: ${hotkey}`);
		} catch (error) {
			console.error(`[PTT] Failed to register hotkey '${hotkey}':`, error);
			throw new Error(`Failed to register PTT hotkey '${hotkey}': ${error}`);
		}
	}

	private async unregisterHotkey(hotkey: string): Promise<void> {
		try {
			await invoke('unregister_global_shortcut', { accelerator: hotkey });
			this.currentHotkey = null;
			console.log(`[PTT] Unregistered hotkey: ${hotkey}`);
		} catch (error) {
			console.error(`[PTT] Failed to unregister hotkey '${hotkey}':`, error);
		}
	}

	async isHotkeyAvailable(hotkey: string): Promise<boolean> {
		try {
			const isRegistered = await invoke<boolean>('is_global_shortcut_registered', {
				accelerator: hotkey
			});
			return !isRegistered;
		} catch (error) {
			console.error(`[PTT] Failed to check hotkey availability for '${hotkey}':`, error);
			return false;
		}
	}

	async testHotkey(hotkey: string): Promise<boolean> {
		try {
			// Try to register temporarily
			await invoke('register_ptt_shortcut', { accelerator: hotkey });
			// Immediately unregister
			await invoke('unregister_global_shortcut', { accelerator: hotkey });
			return true;
		} catch (error) {
			console.error(`[PTT] Hotkey test failed for '${hotkey}':`, error);
			return false;
		}
	}

	// Manual PTT control for testing or alternative input methods
	pressPTT(): void {
		voiceActions.setPttPressed(true);
	}

	releasePTT(): void {
		voiceActions.setPttPressed(false);
	}
}

// Singleton instance
export const pttManager = new PTTManager();