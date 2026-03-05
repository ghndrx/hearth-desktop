import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Snippet {
	id: string;
	title: string;
	content: string;
	category: string;
	language: string | null;
	tags: string[];
	useCount: number;
	isFavorite: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface SnippetManagerState {
	snippets: Snippet[];
	categories: string[];
	activeCategory: string | null;
	isVisible: boolean;
}

export const snippetsState = writable<SnippetManagerState>({
	snippets: [],
	categories: ['General', 'Code', 'Responses', 'Templates'],
	activeCategory: null,
	isVisible: false
});

export const activeSnippets = derived(snippetsState, ($state) => {
	if (!$state.activeCategory) return $state.snippets;
	return $state.snippets.filter((s) => s.category === $state.activeCategory);
});

export const favoriteSnippets = derived(snippetsState, ($state) =>
	$state.snippets.filter((s) => s.isFavorite)
);

export const snippetCount = derived(snippetsState, ($state) => $state.snippets.length);

export const mostUsedSnippets = derived(snippetsState, ($state) =>
	[...$state.snippets].sort((a, b) => b.useCount - a.useCount).slice(0, 5)
);

export async function loadSnippets(): Promise<void> {
	const state = await invoke<SnippetManagerState>('snippets_get_state');
	snippetsState.set(state);
}

export async function createSnippet(
	title: string,
	content: string,
	options?: {
		category?: string;
		language?: string;
		tags?: string[];
	}
): Promise<Snippet> {
	const snippet = await invoke<Snippet>('snippets_create', {
		title,
		content,
		category: options?.category ?? null,
		language: options?.language ?? null,
		tags: options?.tags ?? null
	});
	await loadSnippets();
	return snippet;
}

export async function updateSnippet(
	id: string,
	updates: {
		title?: string;
		content?: string;
		category?: string;
		language?: string;
		tags?: string[];
	}
): Promise<Snippet> {
	const snippet = await invoke<Snippet>('snippets_update', {
		id,
		title: updates.title ?? null,
		content: updates.content ?? null,
		category: updates.category ?? null,
		language: updates.language ?? null,
		tags: updates.tags ?? null
	});
	snippetsState.update((s) => ({
		...s,
		snippets: s.snippets.map((sn) => (sn.id === id ? snippet : sn))
	}));
	return snippet;
}

export async function deleteSnippet(id: string): Promise<void> {
	await invoke('snippets_delete', { id });
	await loadSnippets();
}

export async function toggleSnippetFavorite(id: string): Promise<void> {
	const snippet = await invoke<Snippet>('snippets_toggle_favorite', { id });
	snippetsState.update((s) => ({
		...s,
		snippets: s.snippets.map((sn) => (sn.id === id ? snippet : sn))
	}));
}

export async function useSnippet(id: string): Promise<Snippet> {
	const snippet = await invoke<Snippet>('snippets_record_use', { id });
	snippetsState.update((s) => ({
		...s,
		snippets: s.snippets.map((sn) => (sn.id === id ? snippet : sn))
	}));
	return snippet;
}

export async function searchSnippets(query: string): Promise<Snippet[]> {
	return invoke<Snippet[]>('snippets_search', { query });
}

export async function toggleSnippetsPanel(): Promise<void> {
	const visible = await invoke<boolean>('snippets_toggle_visible');
	snippetsState.update((s) => ({ ...s, isVisible: visible }));
}

export function setActiveCategory(category: string | null): void {
	snippetsState.update((s) => ({ ...s, activeCategory: category }));
}

export async function addCategory(category: string): Promise<void> {
	const categories = await invoke<string[]>('snippets_add_category', { category });
	snippetsState.update((s) => ({ ...s, categories }));
}

export async function removeCategory(category: string): Promise<void> {
	const categories = await invoke<string[]>('snippets_remove_category', { category });
	snippetsState.update((s) => ({ ...s, categories, activeCategory: null }));
	await loadSnippets();
}
