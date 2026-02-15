import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'hearth_recent_emojis';
const MAX_RECENT = 24;

export type SkinTone = 'default' | 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';

export interface RecentEmoji {
	emoji: string;
	timestamp: number;
	skinTone?: SkinTone;
}

function loadRecentEmojis(): RecentEmoji[] {
	if (!browser) return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Ignore parse errors
	}
	return [];
}

function saveRecentEmojis(emojis: RecentEmoji[]) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(emojis));
}

function createRecentEmojisStore() {
	const { subscribe, set, update } = writable<RecentEmoji[]>(loadRecentEmojis());

	return {
		subscribe,

		add(emoji: string, skinTone: SkinTone = 'default') {
			update((emojis) => {
				// Remove if already exists
				const filtered = emojis.filter((e) => e.emoji !== emoji);

				// Add to beginning
				const updated = [{ emoji, timestamp: Date.now(), skinTone }, ...filtered].slice(
					0,
					MAX_RECENT
				);

				saveRecentEmojis(updated);
				return updated;
			});
		},

		remove(emoji: string) {
			update((emojis) => {
				const updated = emojis.filter((e) => e.emoji !== emoji);
				saveRecentEmojis(updated);
				return updated;
			});
		},

		clear() {
			saveRecentEmojis([]);
			set([]);
		},

		getAll(): RecentEmoji[] {
			if (!browser) return [];
			return loadRecentEmojis();
		}
	};
}

export const recentEmojis = createRecentEmojisStore();
