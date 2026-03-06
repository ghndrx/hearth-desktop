import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type TemplateCategory = 'greeting' | 'announcement' | 'response' | 'custom';

export interface MessageTemplate {
	id: string;
	name: string;
	content: string;
	category: TemplateCategory;
	variables: string[];
	useCount: number;
	lastUsed: string | null;
	createdAt: string;
	updatedAt: string;
}

export const templates = writable<MessageTemplate[]>([]);

export const templateCategories: TemplateCategory[] = [
	'greeting',
	'announcement',
	'response',
	'custom'
];

export const templatesByCategory = derived(templates, ($templates) => {
	const grouped: Record<string, MessageTemplate[]> = {};
	for (const cat of templateCategories) {
		grouped[cat] = [];
	}
	for (const t of $templates) {
		const cat = t.category as string;
		if (!grouped[cat]) {
			grouped[cat] = [];
		}
		grouped[cat].push(t);
	}
	return grouped;
});

export const templateCount = derived(templates, ($t) => $t.length);

export const frequentTemplates = derived(templates, ($t) =>
	[...$t].sort((a, b) => b.useCount - a.useCount).filter((t) => t.useCount > 0).slice(0, 5)
);

export async function loadTemplates(): Promise<void> {
	const items = await invoke<MessageTemplate[]>('template_get_all');
	templates.set(items);
}

export async function createTemplate(
	name: string,
	content: string,
	category?: TemplateCategory,
	variables?: string[]
): Promise<MessageTemplate> {
	const template = await invoke<MessageTemplate>('template_create', {
		name,
		content,
		category: category ?? null,
		variables: variables ?? null
	});
	templates.update((items) => [template, ...items]);
	return template;
}

export async function updateTemplate(
	id: string,
	updates: {
		name?: string;
		content?: string;
		category?: TemplateCategory;
		variables?: string[];
	}
): Promise<MessageTemplate> {
	const template = await invoke<MessageTemplate>('template_update', {
		id,
		name: updates.name ?? null,
		content: updates.content ?? null,
		category: updates.category ?? null,
		variables: updates.variables ?? null
	});
	templates.update((items) => items.map((t) => (t.id === id ? template : t)));
	return template;
}

export async function deleteTemplate(id: string): Promise<void> {
	await invoke<boolean>('template_delete', { id });
	templates.update((items) => items.filter((t) => t.id !== id));
}

export async function getTemplatesByCategory(category: TemplateCategory): Promise<MessageTemplate[]> {
	return invoke<MessageTemplate[]>('template_get_by_category', { category });
}

export async function searchTemplates(query: string): Promise<MessageTemplate[]> {
	return invoke<MessageTemplate[]>('template_search', { query });
}

export async function applyTemplate(
	id: string,
	variablesMap: Record<string, string>
): Promise<string> {
	return invoke<string>('template_apply', { id, variablesMap });
}

export async function recordTemplateUse(id: string): Promise<MessageTemplate> {
	const template = await invoke<MessageTemplate>('template_record_use', { id });
	templates.update((items) => items.map((t) => (t.id === id ? template : t)));
	return template;
}

export async function getFrequentTemplates(limit?: number): Promise<MessageTemplate[]> {
	return invoke<MessageTemplate[]>('template_get_frequent', { limit: limit ?? 10 });
}

export async function exportTemplates(): Promise<string> {
	return invoke<string>('template_export');
}

export async function importTemplates(jsonData: string): Promise<number> {
	const count = await invoke<number>('template_import', { jsonData });
	await loadTemplates();
	return count;
}
