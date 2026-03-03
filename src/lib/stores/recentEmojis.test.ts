import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { recentEmojis } from './recentEmojis';

describe('recentEmojis', () => {
	const mockLocalStorage = new Map<string, string>();

	beforeEach(() => {
		mockLocalStorage.clear();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => mockLocalStorage.get(key) ?? null,
			setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
			removeItem: (key: string) => mockLocalStorage.delete(key)
		});

		recentEmojis.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should have empty initial state when no stored emojis', () => {
		const emojis = get(recentEmojis);
		expect(emojis).toEqual([]);
	});

	it('should load stored emojis on initialization', () => {
		const emojis = get(recentEmojis);
		expect(Array.isArray(emojis)).toBe(true);
	});

	it('should add emoji to the beginning', () => {
		recentEmojis.add('😀');
		recentEmojis.add('🎉');

		const emojis = get(recentEmojis);
		expect(emojis).toHaveLength(2);
		expect(emojis[0].emoji).toBe('🎉');
		expect(emojis[1].emoji).toBe('😀');
	});

	it('should remove duplicate emoji and add to front', () => {
		recentEmojis.add('😀');
		recentEmojis.add('🎉');
		recentEmojis.add('😀');

		const emojis = get(recentEmojis);
		expect(emojis).toHaveLength(2);
		expect(emojis[0].emoji).toBe('😀');
		expect(emojis[1].emoji).toBe('🎉');
	});

	it('should respect MAX_RECENT limit', () => {
		for (let i = 0; i < 30; i++) {
			recentEmojis.add(`emoji${i}`);
		}

		const emojis = get(recentEmojis);
		expect(emojis).toHaveLength(24);
		expect(emojis[0].emoji).toBe('emoji29');
		expect(emojis[23].emoji).toBe('emoji6');
	});

	it('should add emoji with skin tone', () => {
		recentEmojis.add('👍', 'medium');

		const emojis = get(recentEmojis);
		expect(emojis).toHaveLength(1);
		expect(emojis[0].emoji).toBe('👍');
		expect(emojis[0].skinTone).toBe('medium');
	});

	it('should remove emoji', () => {
		recentEmojis.add('😀');
		recentEmojis.add('🎉');
		recentEmojis.remove('😀');

		const emojis = get(recentEmojis);
		expect(emojis).toHaveLength(1);
		expect(emojis[0].emoji).toBe('🎉');
	});

	it('should clear all emojis', () => {
		recentEmojis.add('😀');
		recentEmojis.add('🎉');
		recentEmojis.clear();

		const emojis = get(recentEmojis);
		expect(emojis).toEqual([]);
	});

	it('should persist to localStorage', () => {
		recentEmojis.add('😀');
		recentEmojis.add('🎉');

		const stored = JSON.parse(mockLocalStorage.get('hearth_recent_emojis') || '[]');
		expect(stored).toHaveLength(2);
		expect(stored[0].emoji).toBe('🎉');
	});
});
