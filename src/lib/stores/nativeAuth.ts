import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface BiometricCapabilities {
	available: boolean;
	methods: string[];
}

export const biometricCapabilities = writable<BiometricCapabilities>({
	available: false,
	methods: []
});

export async function checkBiometrics() {
	try {
		const caps = await invoke<BiometricCapabilities>('keychain_biometric_available');
		biometricCapabilities.set(caps);
		return caps;
	} catch {
		return { available: false, methods: [] };
	}
}

export async function keychainSet(key: string, value: string): Promise<void> {
	await invoke('keychain_set', { key, value });
}

export async function keychainGet(key: string): Promise<string | null> {
	return invoke<string | null>('keychain_get', { key });
}

export async function keychainDelete(key: string): Promise<void> {
	await invoke('keychain_delete', { key });
}

export async function storeAuthToken(token: string): Promise<void> {
	await keychainSet('auth_token', token);
}

export async function getAuthToken(): Promise<string | null> {
	return keychainGet('auth_token');
}

export async function clearAuthToken(): Promise<void> {
	await keychainDelete('auth_token');
}
