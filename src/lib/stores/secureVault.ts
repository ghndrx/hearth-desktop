import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface VaultEntry {
	id: string;
	title: string;
	content: string;
	category: string;
	isSensitive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface VaultState {
	entries: VaultEntry[];
	categories: string[];
	isLocked: boolean;
	autoLockMinutes: number;
	lastActivity: string;
	totalEntries: number;
}

export const vaultState = writable<VaultState>({
	entries: [],
	categories: ['Passwords', 'Notes', 'API Keys', 'Recovery Codes'],
	isLocked: true,
	autoLockMinutes: 5,
	lastActivity: '',
	totalEntries: 0
});

export const vaultEntries = derived(vaultState, ($state) => $state.entries);
export const isVaultLocked = derived(vaultState, ($state) => $state.isLocked);
export const vaultCategories = derived(vaultState, ($state) => $state.categories);

export async function setupVaultPin(pin: string): Promise<boolean> {
	const result = await invoke<boolean>('vault_setup_pin', { pin });
	if (result) await loadVaultState();
	return result;
}

export async function unlockVault(pin: string): Promise<boolean> {
	const result = await invoke<boolean>('vault_unlock', { pin });
	if (result) await loadVaultState();
	return result;
}

export async function lockVault(): Promise<void> {
	await invoke('vault_lock');
	await loadVaultState();
}

export async function loadVaultState(): Promise<void> {
	const state = await invoke<VaultState>('vault_get_state');
	vaultState.set(state);
}

export async function addVaultEntry(
	title: string,
	content: string,
	options?: { category?: string; isSensitive?: boolean }
): Promise<VaultEntry> {
	const entry = await invoke<VaultEntry>('vault_add_entry', {
		title,
		content,
		category: options?.category,
		isSensitive: options?.isSensitive
	});
	await loadVaultState();
	return entry;
}

export async function updateVaultEntry(
	id: string,
	updates: { title?: string; content?: string; category?: string }
): Promise<VaultEntry> {
	const entry = await invoke<VaultEntry>('vault_update_entry', { id, ...updates });
	await loadVaultState();
	return entry;
}

export async function deleteVaultEntry(id: string): Promise<boolean> {
	const result = await invoke<boolean>('vault_delete_entry', { id });
	await loadVaultState();
	return result;
}

export async function searchVault(query: string): Promise<VaultEntry[]> {
	return invoke<VaultEntry[]>('vault_search', { query });
}

export async function setVaultAutoLock(minutes: number): Promise<void> {
	await invoke('vault_set_auto_lock', { minutes });
}

export async function addVaultCategory(name: string): Promise<string[]> {
	const categories = await invoke<string[]>('vault_add_category', { name });
	vaultState.update((s) => ({ ...s, categories }));
	return categories;
}

export async function changeVaultPin(oldPin: string, newPin: string): Promise<boolean> {
	return invoke<boolean>('vault_change_pin', { oldPin, newPin });
}

export async function exportVault(): Promise<string> {
	return invoke<string>('vault_export');
}

export async function importVault(data: string): Promise<number> {
	const count = await invoke<number>('vault_import', { data });
	await loadVaultState();
	return count;
}
