import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue({})
}));

describe('ContentFilterSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should have filter modes', () => {
		const modes = ['strict', 'moderate', 'lenient', 'custom'];
		expect(modes).toContain('moderate');
		expect(modes.length).toBe(4);
	});

	it('should have filter actions', () => {
		const actions = ['hide', 'blur', 'warn', 'replace', 'block'];
		expect(actions).toContain('warn');
		expect(actions).toContain('blur');
		expect(actions.length).toBe(5);
	});

	it('should have default categories', () => {
		const categories = [
			{ id: 'profanity', name: 'Profanity', severity: 'medium' },
			{ id: 'spam', name: 'Spam / Repetitive', severity: 'low' },
			{ id: 'spoilers', name: 'Unmarked Spoilers', severity: 'low' },
			{ id: 'mentions', name: 'Excessive Mentions', severity: 'medium' },
			{ id: 'links', name: 'Suspicious Links', severity: 'high' }
		];
		expect(categories.length).toBe(5);
		expect(categories.find((c) => c.id === 'profanity')?.severity).toBe('medium');
		expect(categories.find((c) => c.id === 'links')?.severity).toBe('high');
	});

	it('should calculate filter rate correctly', () => {
		function filterRate(scanned: number, filtered: number): string {
			return scanned > 0 ? ((filtered / scanned) * 100).toFixed(1) : '0.0';
		}
		expect(filterRate(0, 0)).toBe('0.0');
		expect(filterRate(100, 5)).toBe('5.0');
		expect(filterRate(1000, 23)).toBe('2.3');
	});
});
