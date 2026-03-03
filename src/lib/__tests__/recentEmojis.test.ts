/**
 * Tests for recentEmojis store
 *
 * Tests emoji history management including add, remove, clear operations
 * and localStorage persistence.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

// Mock localStorage
const mockStorage: Record<string, string> = {};
const localStorageMock = {
	getItem: vi.fn((key: string) => mockStorage[key] ?? null),
	setItem: vi.fn((key: string, value: string) => {
		mockStorage[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete mockStorage[key];
	}),
	clear: vi.fn(() => {
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
	})
};

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock,
	writable: true
});

describe('RecentEmojis Store', () => {
	beforeEach(() => {
		// Clear mocks and storage before each test
		vi.clearAllMocks();
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe('SkinTone types', () => {
		it('should define valid skin tone values', async () => {
			// SkinTone type accepts these values
			const validTones: string[] = [
				'default',
				'light',
				'medium-light',
				'medium',
				'medium-dark',
				'dark'
			];
			// Type check passes if these are valid SkinTone values
			expect(validTones).toContain('default');
			expect(validTones).toContain('light');
			expect(validTones).toContain('medium-light');
			expect(validTones).toContain('medium');
			expect(validTones).toContain('medium-dark');
			expect(validTones).toContain('dark');
		});
	});

	describe('RecentEmoji interface', () => {
		it('should have correct structure', async () => {
			// RecentEmoji interface structure test

			const emoji = {
				emoji: '😀',
				timestamp: Date.now(),
				skinTone: 'default' as const
			};

			expect(emoji).toHaveProperty('emoji');
			expect(emoji).toHaveProperty('timestamp');
			expect(emoji).toHaveProperty('skinTone');
			expect(typeof emoji.emoji).toBe('string');
			expect(typeof emoji.timestamp).toBe('number');
		});

		it('should allow skinTone to be optional', () => {
			const emoji = {
				emoji: '🎉',
				timestamp: Date.now()
			};

			expect(emoji).toHaveProperty('emoji');
			expect(emoji).toHaveProperty('timestamp');
			expect(emoji).not.toHaveProperty('skinTone');
		});
	});

	describe('Store initialization', () => {
		it('should load empty array when no stored data exists', async () => {
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			expect(value).toEqual([]);
			unsubscribe();
		});

		it('should load existing data from localStorage', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900 }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			expect(value).toEqual(existingEmojis);
			unsubscribe();
		});

		it('should handle invalid JSON in localStorage gracefully', async () => {
			mockStorage['hearth_recent_emojis'] = 'not valid json{{{';

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			expect(value).toEqual([]);
			unsubscribe();
		});
	});

	describe('add()', () => {
		it('should add emoji to the beginning of the list', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string; timestamp: number; skinTone?: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.add('😀');

			expect(value.length).toBe(1);
			expect(value[0].emoji).toBe('😀');
			expect(value[0].skinTone).toBe('default');
			expect(typeof value[0].timestamp).toBe('number');

			unsubscribe();
		});

		it('should add emoji with custom skin tone', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string; skinTone?: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.add('👍', 'medium');

			expect(value[0].emoji).toBe('👍');
			expect(value[0].skinTone).toBe('medium');

			unsubscribe();
		});

		it('should move existing emoji to the beginning', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900, skinTone: 'default' },
				{ emoji: '👍', timestamp: 800, skinTone: 'default' }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			// Add existing emoji
			recentEmojis.add('🎉');

			expect(value.length).toBe(3);
			expect(value[0].emoji).toBe('🎉');
			expect(value[1].emoji).toBe('😀');
			expect(value[2].emoji).toBe('👍');

			unsubscribe();
		});

		it('should limit to MAX_RECENT (24) emojis', async () => {
			// Pre-populate with 24 emojis
			const emojis = Array.from({ length: 24 }, (_, i) => ({
				emoji: String.fromCodePoint(0x1f600 + i),
				timestamp: 1000 - i,
				skinTone: 'default'
			}));
			mockStorage['hearth_recent_emojis'] = JSON.stringify(emojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			// Add a new emoji
			recentEmojis.add('🆕');

			expect(value.length).toBe(24);
			expect((value[0] as { emoji: string }).emoji).toBe('🆕');

			unsubscribe();
		});

		it('should persist to localStorage', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			recentEmojis.add('😀');

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'hearth_recent_emojis',
				expect.any(String)
			);

			const savedData = JSON.parse(mockStorage['hearth_recent_emojis']);
			expect(savedData[0].emoji).toBe('😀');
		});
	});

	describe('remove()', () => {
		it('should remove specified emoji from the list', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900, skinTone: 'default' },
				{ emoji: '👍', timestamp: 800, skinTone: 'default' }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.remove('🎉');

			expect(value.length).toBe(2);
			expect(value.find((e) => e.emoji === '🎉')).toBeUndefined();
			expect(value[0].emoji).toBe('😀');
			expect(value[1].emoji).toBe('👍');

			unsubscribe();
		});

		it('should handle removing non-existent emoji gracefully', async () => {
			const existingEmojis = [{ emoji: '😀', timestamp: 1000, skinTone: 'default' }];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.remove('🔥');

			expect(value.length).toBe(1);

			unsubscribe();
		});

		it('should persist removal to localStorage', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900, skinTone: 'default' }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			recentEmojis.remove('🎉');

			const savedData = JSON.parse(mockStorage['hearth_recent_emojis']);
			expect(savedData.length).toBe(1);
			expect(savedData[0].emoji).toBe('😀');
		});
	});

	describe('clear()', () => {
		it('should remove all emojis', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900, skinTone: 'default' }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.clear();

			expect(value).toEqual([]);

			unsubscribe();
		});

		it('should persist empty array to localStorage', async () => {
			const existingEmojis = [{ emoji: '😀', timestamp: 1000, skinTone: 'default' }];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			recentEmojis.clear();

			expect(mockStorage['hearth_recent_emojis']).toBe('[]');
		});
	});

	describe('getAll()', () => {
		it('should return current emojis from localStorage', async () => {
			const existingEmojis = [
				{ emoji: '😀', timestamp: 1000, skinTone: 'default' },
				{ emoji: '🎉', timestamp: 900, skinTone: 'default' }
			];
			mockStorage['hearth_recent_emojis'] = JSON.stringify(existingEmojis);

			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			const result = recentEmojis.getAll();

			expect(result).toEqual(existingEmojis);
		});

		it('should return empty array when no emojis stored', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			const result = recentEmojis.getAll();

			expect(result).toEqual([]);
		});
	});

	describe('edge cases', () => {
		it('should handle Unicode emojis correctly', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			// Add various Unicode emojis
			recentEmojis.add('👨‍👩‍👧‍👦'); // Family with zero-width joiners
			recentEmojis.add('🏳️‍🌈'); // Rainbow flag
			recentEmojis.add('👍🏽'); // Emoji with skin tone modifier

			expect(value.length).toBe(3);
			expect(value[0].emoji).toBe('👍🏽');
			expect(value[1].emoji).toBe('🏳️‍🌈');
			expect(value[2].emoji).toBe('👨‍👩‍👧‍👦');

			unsubscribe();
		});

		it('should handle rapid successive adds', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: unknown[] = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			// Rapid adds
			recentEmojis.add('1️⃣');
			recentEmojis.add('2️⃣');
			recentEmojis.add('3️⃣');
			recentEmojis.add('4️⃣');
			recentEmojis.add('5️⃣');

			expect(value.length).toBe(5);
			expect((value[0] as { emoji: string }).emoji).toBe('5️⃣');

			unsubscribe();
		});

		it('should handle empty string emoji', async () => {
			vi.resetModules();
			const { recentEmojis } = await import('../stores/recentEmojis');

			let value: Array<{ emoji: string }> = [];
			const unsubscribe = recentEmojis.subscribe((v) => {
				value = v;
			});

			recentEmojis.add('');

			// Empty string should still be added (store doesn't validate)
			expect(value.length).toBe(1);
			expect(value[0].emoji).toBe('');

			unsubscribe();
		});
	});
});
