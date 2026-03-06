import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type FileCategory =
	| 'images'
	| 'documents'
	| 'videos'
	| 'audio'
	| 'archives'
	| 'code'
	| 'other';

export interface OrganizeRule {
	extension: string;
	category: FileCategory;
}

export interface OrganizedFile {
	id: string;
	originalPath: string;
	newPath: string;
	fileName: string;
	fileSize: number;
	category: FileCategory;
	organizedAt: number;
}

export interface FileOrganizerConfig {
	enabled: boolean;
	sourceDirectory: string;
	targetDirectory: string;
}

export interface CategoryStats {
	count: number;
	totalSize: number;
}

export interface OrganizerStats {
	totalOrganized: number;
	totalSize: number;
	byCategory: Record<string, CategoryStats>;
}

export const organizerConfig = writable<FileOrganizerConfig>({
	enabled: false,
	sourceDirectory: '',
	targetDirectory: ''
});

export const organizerHistory = writable<OrganizedFile[]>([]);
export const organizerStats = writable<OrganizerStats | null>(null);
export const organizerRules = writable<OrganizeRule[]>([]);
export const organizerPreview = writable<OrganizedFile[]>([]);

export async function loadOrganizerConfig(): Promise<FileOrganizerConfig> {
	const config = await invoke<FileOrganizerConfig>('organizer_get_config');
	organizerConfig.set(config);
	return config;
}

export async function saveOrganizerConfig(config: FileOrganizerConfig): Promise<FileOrganizerConfig> {
	const result = await invoke<FileOrganizerConfig>('organizer_set_config', { config });
	organizerConfig.set(result);
	return result;
}

export async function organizeFile(filePath: string, targetDir: string): Promise<OrganizedFile> {
	const result = await invoke<OrganizedFile>('organizer_organize_file', { filePath, targetDir });
	organizerHistory.update((h) => [...h, result]);
	return result;
}

export async function organizeDirectory(
	sourceDir: string,
	targetDir: string
): Promise<OrganizedFile[]> {
	const results = await invoke<OrganizedFile[]>('organizer_organize_directory', {
		sourceDir,
		targetDir
	});
	organizerHistory.update((h) => [...h, ...results]);
	return results;
}

export async function previewOrganize(sourceDir: string): Promise<OrganizedFile[]> {
	const results = await invoke<OrganizedFile[]>('organizer_preview_organize', { sourceDir });
	organizerPreview.set(results);
	return results;
}

export async function undoLast(): Promise<OrganizedFile | null> {
	const result = await invoke<OrganizedFile | null>('organizer_undo_last');
	if (result) {
		organizerHistory.update((h) => h.filter((f) => f.id !== result.id));
	}
	return result;
}

export async function loadHistory(): Promise<OrganizedFile[]> {
	const history = await invoke<OrganizedFile[]>('organizer_get_history');
	organizerHistory.set(history);
	return history;
}

export async function loadStats(): Promise<OrganizerStats> {
	const stats = await invoke<OrganizerStats>('organizer_get_stats');
	organizerStats.set(stats);
	return stats;
}

export async function addRule(extension: string, category: FileCategory): Promise<OrganizeRule> {
	const rule = await invoke<OrganizeRule>('organizer_add_rule', { extension, category });
	organizerRules.update((rules) => {
		const filtered = rules.filter((r) => r.extension !== rule.extension);
		return [...filtered, rule];
	});
	return rule;
}

export async function removeRule(extension: string): Promise<boolean> {
	const removed = await invoke<boolean>('organizer_remove_rule', { extension });
	if (removed) {
		organizerRules.update((rules) => rules.filter((r) => r.extension !== extension));
	}
	return removed;
}

export async function loadRules(): Promise<OrganizeRule[]> {
	const rules = await invoke<OrganizeRule[]>('organizer_get_rules');
	organizerRules.set(rules);
	return rules;
}

export async function setEnabled(enabled: boolean): Promise<boolean> {
	const result = await invoke<boolean>('organizer_set_enabled', { enabled });
	organizerConfig.update((c) => ({ ...c, enabled: result }));
	return result;
}

export async function categorizeFile(filePath: string): Promise<FileCategory> {
	return invoke<FileCategory>('organizer_categorize_file', { filePath });
}
