import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type UpdateStatus =
	| 'idle'
	| 'checking'
	| 'available'
	| 'downloading'
	| 'installing'
	| 'up-to-date'
	| 'error';

export interface UpdateInfo {
	version: string;
	current_version: string;
	body: string | null;
	date: string | null;
}

export interface UpdateProgress {
	downloaded: number;
	total: number | null;
	percent: number | null;
}

export interface UpdaterState {
	status: UpdateStatus;
	updateInfo: UpdateInfo | null;
	progress: UpdateProgress | null;
	error: string | null;
	lastChecked: number | null;
	dismissed: boolean;
}

const initialState: UpdaterState = {
	status: 'idle',
	updateInfo: null,
	progress: null,
	error: null,
	lastChecked: null,
	dismissed: false
};

function createUpdaterStore() {
	const { subscribe, set, update } = writable<UpdaterState>(initialState);
	let listenersSetup = false;

	async function setupListeners() {
		if (!browser || listenersSetup) return;
		listenersSetup = true;

		try {
			const { listen } = await import('@tauri-apps/api/event');

			// Listen for startup update check results
			await listen<UpdateInfo>('update:available', (event) => {
				update((s) => ({
					...s,
					status: 'available',
					updateInfo: event.payload,
					dismissed: false,
					error: null
				}));
			});

			// Listen for download progress
			await listen<UpdateProgress>('update:progress', (event) => {
				update((s) => ({
					...s,
					status: 'downloading',
					progress: event.payload
				}));
			});

			// Listen for install phase
			await listen('update:installing', () => {
				update((s) => ({
					...s,
					status: 'installing',
					progress: null
				}));
			});
		} catch {
			// Not in Tauri environment
		}
	}

	async function checkForUpdates(): Promise<UpdateInfo | null> {
		update((s) => ({ ...s, status: 'checking', error: null }));

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke<UpdateInfo | null>('check_for_updates');

			if (result) {
				update((s) => ({
					...s,
					status: 'available',
					updateInfo: result,
					lastChecked: Date.now(),
					dismissed: false,
					error: null
				}));
				return result;
			} else {
				update((s) => ({
					...s,
					status: 'up-to-date',
					updateInfo: null,
					lastChecked: Date.now(),
					error: null
				}));
				return null;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			update((s) => ({
				...s,
				status: 'error',
				error: message,
				lastChecked: Date.now()
			}));
			return null;
		}
	}

	async function downloadAndInstall(): Promise<void> {
		update((s) => ({ ...s, status: 'downloading', progress: null, error: null }));

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('download_and_install_update');
			// App will restart after install, so we won't reach here normally
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			update((s) => ({
				...s,
				status: 'error',
				error: message
			}));
		}
	}

	function dismiss() {
		update((s) => ({ ...s, dismissed: true }));
	}

	function reset() {
		set(initialState);
	}

	// Setup listeners on creation
	if (browser) {
		setupListeners();
	}

	return {
		subscribe,
		checkForUpdates,
		downloadAndInstall,
		dismiss,
		reset
	};
}

export const updater = createUpdaterStore();

export const updateStatus = derived(updater, ($u) => $u.status);
export const updateAvailable = derived(
	updater,
	($u) => $u.status === 'available' && !$u.dismissed
);
export const updateProgress = derived(updater, ($u) => $u.progress);
export const updateInfo = derived(updater, ($u) => $u.updateInfo);
