import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface FilterCategory {
	id: string;
	name: string;
	enabled: boolean;
	severity: 'low' | 'medium' | 'high' | 'critical';
	patterns: string[];
}

export interface ContentFilterConfig {
	enabled: boolean;
	mode: 'strict' | 'moderate' | 'lenient' | 'custom';
	blocked_words: string[];
	blocked_patterns: string[];
	allowed_exceptions: string[];
	filter_categories: FilterCategory[];
	action: 'hide' | 'blur' | 'warn' | 'replace' | 'block';
	log_filtered: boolean;
	notify_on_filter: boolean;
	exempt_roles: string[];
	exempt_channels: string[];
}

export interface FilterResult {
	filtered: boolean;
	original_length: number;
	matched_categories: string[];
	matched_words: string[];
	action_taken: string;
	clean_content: string | null;
}

export interface FilterLogEntry {
	id: string;
	timestamp: string;
	channel_id: string | null;
	author_id: string | null;
	matched_rule: string;
	severity: string;
	action_taken: string;
	content_preview: string;
}

export interface FilterStats {
	total_scanned: number;
	total_filtered: number;
	by_category: Record<string, number>;
	by_severity: Record<string, number>;
	false_positives_reported: number;
}

function createContentFilterStore() {
	const config = writable<ContentFilterConfig>({
		enabled: false,
		mode: 'moderate',
		blocked_words: [],
		blocked_patterns: [],
		allowed_exceptions: [],
		filter_categories: [],
		action: 'warn',
		log_filtered: true,
		notify_on_filter: false,
		exempt_roles: [],
		exempt_channels: []
	});

	const stats = writable<FilterStats>({
		total_scanned: 0,
		total_filtered: 0,
		by_category: {},
		by_severity: {},
		false_positives_reported: 0
	});

	const log = writable<FilterLogEntry[]>([]);
	const isEnabled = derived(config, ($c) => $c.enabled);
	const filterRate = derived(stats, ($s) =>
		$s.total_scanned > 0 ? (($s.total_filtered / $s.total_scanned) * 100).toFixed(1) : '0.0'
	);

	return {
		config,
		stats,
		log,
		isEnabled,
		filterRate,

		async loadConfig() {
			try {
				const c = await invoke<ContentFilterConfig>('filter_get_config');
				config.set(c);
			} catch {
				// Use defaults
			}
		},

		async updateConfig(newConfig: ContentFilterConfig) {
			const c = await invoke<ContentFilterConfig>('filter_update_config', {
				config: newConfig
			});
			config.set(c);
			return c;
		},

		async setEnabled(enabled: boolean) {
			await invoke('filter_set_enabled', { enabled });
			config.update((c) => ({ ...c, enabled }));
		},

		async checkContent(
			content: string,
			channelId?: string,
			authorId?: string
		): Promise<FilterResult> {
			return invoke<FilterResult>('filter_check_content', {
				content,
				channelId: channelId ?? null,
				authorId: authorId ?? null
			});
		},

		async addBlockedWord(word: string) {
			const words = await invoke<string[]>('filter_add_blocked_word', { word });
			config.update((c) => ({ ...c, blocked_words: words }));
		},

		async removeBlockedWord(word: string) {
			const words = await invoke<string[]>('filter_remove_blocked_word', { word });
			config.update((c) => ({ ...c, blocked_words: words }));
		},

		async loadStats() {
			const s = await invoke<FilterStats>('filter_get_stats');
			stats.set(s);
		},

		async loadLog(limit?: number) {
			const entries = await invoke<FilterLogEntry[]>('filter_get_log', {
				limit: limit ?? 100
			});
			log.set(entries);
		},

		async clearLog() {
			await invoke('filter_clear_log');
			log.set([]);
		},

		async resetStats() {
			await invoke('filter_reset_stats');
			stats.set({
				total_scanned: 0,
				total_filtered: 0,
				by_category: {},
				by_severity: {},
				false_positives_reported: 0
			});
		},

		async reportFalsePositive(logEntryId: string) {
			await invoke('filter_report_false_positive', { logEntryId });
			log.update((l) => l.filter((e) => e.id !== logEntryId));
			stats.update((s) => ({ ...s, false_positives_reported: s.false_positives_reported + 1 }));
		},

		async testContent(content: string): Promise<FilterResult> {
			return invoke<FilterResult>('filter_test_content', { content });
		}
	};
}

export const contentFilter = createContentFilterStore();
