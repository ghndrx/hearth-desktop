import { invoke } from '@tauri-apps/api/core';

export interface PiPPosition {
	x: number;
	y: number;
}

export interface PiPSize {
	width: number;
	height: number;
}

/**
 * Window management API for Picture-in-Picture functionality
 */
export class WindowAPI {
	/**
	 * Create a new picture-in-picture window
	 */
	static async createPiPWindow(position: PiPPosition, size: PiPSize): Promise<void> {
		return invoke('create_pip_window', { position, size });
	}

	/**
	 * Close the picture-in-picture window
	 */
	static async closePiPWindow(): Promise<void> {
		return invoke('close_pip_window');
	}

	/**
	 * Update the position of the PiP window
	 */
	static async updatePiPPosition(position: PiPPosition): Promise<void> {
		return invoke('update_pip_position', { position });
	}

	/**
	 * Update the size of the PiP window
	 */
	static async updatePiPSize(size: PiPSize): Promise<void> {
		return invoke('update_pip_size', { size });
	}

	/**
	 * Set the transparency of the PiP window
	 * @param alpha Transparency value between 0.5 and 1.0
	 */
	static async setPiPTransparency(alpha: number): Promise<void> {
		return invoke('set_pip_transparency', { alpha });
	}

	/**
	 * Toggle always on top for the PiP window
	 */
	static async togglePiPAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
		return invoke('toggle_pip_always_on_top', { always_on_top: alwaysOnTop });
	}

	/**
	 * Get the current screen size for snap zone calculations
	 */
	static async getScreenSize(): Promise<PiPSize> {
		return invoke('get_screen_size');
	}

	/**
	 * Show the PiP window if hidden
	 */
	static async showPiPWindow(): Promise<void> {
		return invoke('show_pip_window');
	}

	/**
	 * Hide the PiP window
	 */
	static async hidePiPWindow(): Promise<void> {
		return invoke('hide_pip_window');
	}

	/**
	 * Get the work area (available screen space excluding taskbars, docks, etc.)
	 */
	static async getWorkArea(): Promise<PiPSize> {
		return invoke('get_work_area');
	}
}

export { WindowAPI as default };