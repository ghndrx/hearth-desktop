import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	formatRelativeTime,
	formatMessageTime,
	formatMessageDate,
	formatFileSize,
	truncate
} from './format';

describe('formatRelativeTime', () => {
	let originalNow: number;

	beforeEach(() => {
		originalNow = Date.now();
		vi.useFakeTimers();
		vi.setSystemTime(originalNow);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return "just now" for times within 60 seconds', () => {
		const pastDate = new Date(originalNow - 30000); // 30 seconds ago
		expect(formatRelativeTime(pastDate)).toBe('just now');
	});

	it('should format minutes correctly', () => {
		const pastDate = new Date(originalNow - 5 * 60 * 1000); // 5 minutes ago
		expect(formatRelativeTime(pastDate)).toBe('5m ago');
	});

	it('should format hours correctly', () => {
		const pastDate = new Date(originalNow - 3 * 60 * 60 * 1000); // 3 hours ago
		expect(formatRelativeTime(pastDate)).toBe('3h ago');
	});

	it('should return "yesterday" for dates exactly 1 day ago', () => {
		const pastDate = new Date(originalNow - 24 * 60 * 60 * 1000); // 24 hours ago
		expect(formatRelativeTime(pastDate)).toBe('yesterday');
	});

	it('should format days correctly', () => {
		const pastDate = new Date(originalNow - 5 * 24 * 60 * 60 * 1000); // 5 days ago
		expect(formatRelativeTime(pastDate)).toBe('5d ago');
	});

	it('should return full date for times older than 7 days', () => {
		const pastDate = new Date(originalNow - 10 * 24 * 60 * 60 * 1000); // 10 days ago
		const result = formatRelativeTime(pastDate);
		expect(result).not.toContain('ago');
		expect(result).toMatch(/\//); // Date format contains slashes
	});

	it('should accept string dates', () => {
		const pastDate = new Date(originalNow - 5 * 60 * 1000);
		const result = formatRelativeTime(pastDate.toISOString());
		expect(result).toBe('5m ago');
	});
});

describe('formatMessageTime', () => {
	it('should format time in HH:MM format', () => {
		const date = new Date('2024-01-15T14:30:00Z');
		const result = formatMessageTime(date);
		expect(result).toMatch(/\d{1,2}:\d{2}/);
	});

	it('should handle string dates', () => {
		const result = formatMessageTime('2024-01-15T14:30:00Z');
		expect(result).toMatch(/\d{1,2}:\d{2}/);
	});

	it('should handle different times', () => {
		const morning = formatMessageTime(new Date('2024-01-15T09:05:00Z'));
		const evening = formatMessageTime(new Date('2024-01-15T21:45:00Z'));
		expect(morning).toMatch(/9:05|09:05/);
		expect(evening).toMatch(/21:45|9:45/);
	});
});

describe('formatMessageDate', () => {
	let originalNow: number;

	beforeEach(() => {
		originalNow = Date.now();
		vi.useFakeTimers();
		vi.setSystemTime(originalNow);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return "Today" for current date', () => {
		const today = new Date();
		expect(formatMessageDate(today)).toBe('Today');
	});

	it('should return "Yesterday" for previous day', () => {
		const yesterday = new Date(originalNow - 24 * 60 * 60 * 1000);
		expect(formatMessageDate(yesterday)).toBe('Yesterday');
	});

	it('should format dates with weekday and month for older dates', () => {
		const older = new Date(originalNow - 5 * 24 * 60 * 60 * 1000);
		const result = formatMessageDate(older);
		// Should contain month name
		expect(result).toMatch(/January|February|March|April|May|June|July|August|September|October|November|December/);
		// Should contain day number
		expect(result).toMatch(/\d{1,2}/);
	});

	it('should include year for previous years', () => {
		const lastYear = new Date(originalNow - 365 * 24 * 60 * 60 * 1000);
		const result = formatMessageDate(lastYear);
		expect(result).toMatch(/\d{4}/); // Should include year
	});

	it('should accept string dates', () => {
		const today = new Date();
		expect(formatMessageDate(today.toISOString())).toBe('Today');
	});
});

describe('formatFileSize', () => {
	it('should format bytes correctly', () => {
		expect(formatFileSize(512)).toBe('512 B');
		expect(formatFileSize(1023)).toBe('1023 B');
	});

	it('should format kilobytes correctly', () => {
		expect(formatFileSize(1024)).toBe('1.0 KB');
		expect(formatFileSize(1536)).toBe('1.5 KB');
		expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
	});

	it('should format megabytes correctly', () => {
		expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
		expect(formatFileSize(1024 * 1024 * 1024 - 1)).toBe('1024.0 MB');
	});

	it('should format gigabytes correctly', () => {
		expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
		expect(formatFileSize(1024 * 1024 * 1024 * 5)).toBe('5.0 GB');
	});

	it('should handle zero bytes', () => {
		expect(formatFileSize(0)).toBe('0 B');
	});

	it('should handle very large files', () => {
		expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1024.0 GB');
	});
});

describe('truncate', () => {
	it('should not truncate text shorter than maxLength', () => {
		expect(truncate('hello', 10)).toBe('hello');
		expect(truncate('hello', 5)).toBe('hello');
	});

	it('should truncate text longer than maxLength with ellipsis', () => {
		expect(truncate('hello world', 8)).toBe('hello...');
		expect(truncate('hello world', 5)).toBe('he...');
	});

	it('should handle minimum maxLength', () => {
		expect(truncate('hello', 3)).toBe('...');
		expect(truncate('hello', 4)).toBe('h...');
	});

	it('should handle edge cases', () => {
		expect(truncate('a', 1)).toBe('a'); // Length <= max, return unchanged
		expect(truncate('ab', 2)).toBe('ab'); // Length <= max, return unchanged
		expect(truncate('abc', 2)).toBe('ab...'); // Length > max, so slice(0, 2-3) + '...' = slice(0, -1) + '...' = 'ab...'
	});


	it('should work with long strings', () => {
		const longString = 'a'.repeat(100);
		const result = truncate(longString, 10);
		expect(result.length).toBe(10);
		expect(result).toBe('a'.repeat(7) + '...');
	});

	it('should preserve text before emoji when truncating', () => {
		// Emojis are multibyte, so 'hello 🎉 world' is longer than it appears
		// With maxLength=8, we get 'hello' (5 chars) + '...' (3 chars) = 8 total
		const result = truncate('hello 🎉 world', 8);
		expect(result.length).toBe(8);
		expect(result.startsWith('hello')).toBe(true);
	});
});
