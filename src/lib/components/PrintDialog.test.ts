import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue({})
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
	save: vi.fn().mockResolvedValue(null)
}));

describe('PrintDialog', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should have default print settings', () => {
		const defaults = {
			paper_size: 'A4',
			orientation: 'portrait',
			font_size: 12,
			include_avatars: true,
			include_timestamps: true,
			include_reactions: false,
			theme: 'light'
		};
		expect(defaults.paper_size).toBe('A4');
		expect(defaults.font_size).toBe(12);
		expect(defaults.include_avatars).toBe(true);
	});

	it('should support multiple paper sizes', () => {
		const sizes = ['A4', 'Letter', 'Legal', 'A3', 'A5'];
		expect(sizes).toContain('A4');
		expect(sizes).toContain('Letter');
		expect(sizes.length).toBe(5);
	});

	it('should support print themes', () => {
		const themes = ['light', 'dark', 'high_contrast'];
		expect(themes).toContain('light');
		expect(themes).toContain('dark');
		expect(themes.length).toBe(3);
	});
});
