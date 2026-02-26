/**
 * Secure Keychain Store
 *
 * Wraps the OS keychain/credential manager via Tauri for secure
 * storage of authentication tokens, E2EE keys, and other secrets.
 * Falls back to localStorage when Tauri is not available.
 */
import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

export interface KeychainEntry {
	key: string;
	service: string;
	stored_at: number;
}

export interface KeychainState {
	available: boolean;
	entries: KeychainEntry[];
	loading: boolean;
	error: string | null;
}

const SERVICE_NAME = 'com.hearth.desktop';

const initialState: KeychainState = {
	available: false,
	entries: [],
	loading: false,
	error: null
};

async function invokeKeychain<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	const { invoke } = await import('@tauri-apps/api/core');
	return invoke<T>(command, args);
}

function createKeychainStore() {
	const { subscribe, set, update } = writable<KeychainState>(initialState);

	return {
		subscribe,

		async init() {
			if (!browser) return;

			try {
				const available = await invokeKeychain<boolean>('keychain_available');
				update(s => ({ ...s, available }));
			} catch {
				// Tauri not available - fall back to localStorage
				update(s => ({ ...s, available: false }));
			}
		},

		async store(key: string, value: string): Promise<boolean> {
			let state: KeychainState = initialState;
			subscribe(s => state = s)();

			if (state.available) {
				try {
					await invokeKeychain('keychain_store', {
						service: SERVICE_NAME,
						key,
						value
					});
					update(s => ({
						...s,
						entries: [
							...s.entries.filter(e => e.key !== key),
							{ key, service: SERVICE_NAME, stored_at: Date.now() }
						]
					}));
					return true;
				} catch (err) {
					console.error('[Keychain] Store failed:', err);
				}
			}

			// Fallback to localStorage
			if (browser) {
				try {
					localStorage.setItem(`${SERVICE_NAME}.${key}`, value);
					return true;
				} catch {
					return false;
				}
			}
			return false;
		},

		async retrieve(key: string): Promise<string | null> {
			let state: KeychainState = initialState;
			subscribe(s => state = s)();

			if (state.available) {
				try {
					return await invokeKeychain<string | null>('keychain_retrieve', {
						service: SERVICE_NAME,
						key
					});
				} catch {
					// Fall through to localStorage
				}
			}

			if (browser) {
				return localStorage.getItem(`${SERVICE_NAME}.${key}`);
			}
			return null;
		},

		async remove(key: string): Promise<boolean> {
			let state: KeychainState = initialState;
			subscribe(s => state = s)();

			if (state.available) {
				try {
					await invokeKeychain('keychain_remove', {
						service: SERVICE_NAME,
						key
					});
					update(s => ({
						...s,
						entries: s.entries.filter(e => e.key !== key)
					}));
					return true;
				} catch {
					// Fall through
				}
			}

			if (browser) {
				localStorage.removeItem(`${SERVICE_NAME}.${key}`);
				return true;
			}
			return false;
		},

		async storeAuthTokens(accessToken: string, refreshToken: string) {
			await this.store('auth_access_token', accessToken);
			await this.store('auth_refresh_token', refreshToken);
		},

		async getAuthTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
			const [accessToken, refreshToken] = await Promise.all([
				this.retrieve('auth_access_token'),
				this.retrieve('auth_refresh_token')
			]);
			return { accessToken, refreshToken };
		},

		async clearAuthTokens() {
			await Promise.all([
				this.remove('auth_access_token'),
				this.remove('auth_refresh_token')
			]);
		},

		reset() {
			set(initialState);
		}
	};
}

export const secureKeychain = createKeychainStore();
export const keychainAvailable = derived(secureKeychain, $s => $s.available);
export const keychainLoading = derived(secureKeychain, $s => $s.loading);
