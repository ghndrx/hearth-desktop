import { describe, it, expect } from 'vitest';
import {
	formatDigestFrequency,
	formatDigestMode,
	formatDigestStatus,
	getNextDigestText,
	TIMEZONE_OPTIONS,
	DAY_OPTIONS,
	HOUR_OPTIONS,
	type DigestPreview,
	type DigestPreferences
} from './digest';

describe('Digest Store Helpers', () => {
	describe('formatDigestFrequency', () => {
		it('formats hourly correctly', () => {
			expect(formatDigestFrequency('hourly')).toBe('Hourly');
		});

		it('formats daily correctly', () => {
			expect(formatDigestFrequency('daily')).toBe('Daily');
		});

		it('formats weekly correctly', () => {
			expect(formatDigestFrequency('weekly')).toBe('Weekly');
		});

		it('returns unknown frequency as-is', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing edge case with invalid input
			expect(formatDigestFrequency('unknown' as any)).toBe('unknown');
		});
	});

	describe('formatDigestMode', () => {
		it('formats inherit correctly', () => {
			expect(formatDigestMode('inherit')).toBe('Use global settings');
		});

		it('formats include correctly', () => {
			expect(formatDigestMode('include')).toBe('Always include in digests');
		});

		it('formats exclude correctly', () => {
			expect(formatDigestMode('exclude')).toBe('Never include in digests');
		});

		it('formats immediate correctly', () => {
			expect(formatDigestMode('immediate')).toBe('Send immediately (no batching)');
		});

		it('returns unknown mode as-is', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing edge case with invalid input
			expect(formatDigestMode('unknown' as any)).toBe('unknown');
		});
	});

	describe('formatDigestStatus', () => {
		it('formats pending correctly', () => {
			expect(formatDigestStatus('pending')).toBe('Pending');
		});

		it('formats sent correctly', () => {
			expect(formatDigestStatus('sent')).toBe('Sent');
		});

		it('formats failed correctly', () => {
			expect(formatDigestStatus('failed')).toBe('Failed');
		});

		it('formats skipped correctly', () => {
			expect(formatDigestStatus('skipped')).toBe('Skipped (no messages)');
		});

		it('returns unknown status as-is', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing edge case with invalid input
			expect(formatDigestStatus('unknown' as any)).toBe('unknown');
		});
	});

	describe('getNextDigestText', () => {
		it('returns "Not scheduled" when preview is null', () => {
			expect(getNextDigestText(null, null)).toBe('Not scheduled');
		});

		it('returns "Not scheduled" when preferences is null', () => {
			const preview: DigestPreview = {
				next_digest_at: new Date(Date.now() + 3600000).toISOString(),
				pending_count: 0,
				pending_mentions: 0,
				pending_servers: 0,
				pending_channels: 0
			};
			expect(getNextDigestText(preview, null)).toBe('Not scheduled');
		});

		it('formats time in hours and minutes', () => {
			const twoHoursFromNow = new Date(Date.now() + 2 * 3600000 + 30 * 60000);
			const preview: DigestPreview = {
				next_digest_at: twoHoursFromNow.toISOString(),
				pending_count: 0,
				pending_mentions: 0,
				pending_servers: 0,
				pending_channels: 0
			};
			const prefs = { timezone: 'UTC' } as DigestPreferences;
			const result = getNextDigestText(preview, prefs);
			expect(result).toMatch(/in \d+h \d+m/);
		});

		it('formats time in days for > 24 hours', () => {
			const twoDaysFromNow = new Date(Date.now() + 48 * 3600000);
			const preview: DigestPreview = {
				next_digest_at: twoDaysFromNow.toISOString(),
				pending_count: 0,
				pending_mentions: 0,
				pending_servers: 0,
				pending_channels: 0
			};
			const prefs = { timezone: 'UTC' } as DigestPreferences;
			const result = getNextDigestText(preview, prefs);
			expect(result).toBe('in 2 days');
		});

		it('formats minutes only for < 1 hour', () => {
			const thirtyMinsFromNow = new Date(Date.now() + 30 * 60000);
			const preview: DigestPreview = {
				next_digest_at: thirtyMinsFromNow.toISOString(),
				pending_count: 0,
				pending_mentions: 0,
				pending_servers: 0,
				pending_channels: 0
			};
			const prefs = { timezone: 'UTC' } as DigestPreferences;
			const result = getNextDigestText(preview, prefs);
			expect(result).toMatch(/in \d+m/);
		});

		it('returns "soon" for very short times', () => {
			const fiveSecsFromNow = new Date(Date.now() + 5000);
			const preview: DigestPreview = {
				next_digest_at: fiveSecsFromNow.toISOString(),
				pending_count: 0,
				pending_mentions: 0,
				pending_servers: 0,
				pending_channels: 0
			};
			const prefs = { timezone: 'UTC' } as DigestPreferences;
			const result = getNextDigestText(preview, prefs);
			expect(result).toBe('soon');
		});
	});

	describe('TIMEZONE_OPTIONS', () => {
		it('includes UTC', () => {
			const utc = TIMEZONE_OPTIONS.find(tz => tz.value === 'UTC');
			expect(utc).toBeDefined();
			expect(utc?.label).toBe('UTC');
		});

		it('includes major US timezones', () => {
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'America/New_York')).toBeDefined();
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'America/Los_Angeles')).toBeDefined();
		});

		it('includes European timezones', () => {
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'Europe/London')).toBeDefined();
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'Europe/Paris')).toBeDefined();
		});

		it('includes Asian timezones', () => {
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'Asia/Tokyo')).toBeDefined();
			expect(TIMEZONE_OPTIONS.find(tz => tz.value === 'Asia/Singapore')).toBeDefined();
		});
	});

	describe('DAY_OPTIONS', () => {
		it('includes all 7 days of the week', () => {
			expect(DAY_OPTIONS).toHaveLength(7);
		});

		it('starts with Sunday (0)', () => {
			expect(DAY_OPTIONS[0]).toEqual({ value: 0, label: 'Sunday' });
		});

		it('ends with Saturday (6)', () => {
			expect(DAY_OPTIONS[6]).toEqual({ value: 6, label: 'Saturday' });
		});
	});

	describe('HOUR_OPTIONS', () => {
		it('includes all 24 hours', () => {
			expect(HOUR_OPTIONS).toHaveLength(24);
		});

		it('starts with 00:00', () => {
			expect(HOUR_OPTIONS[0]).toEqual({ value: 0, label: '00:00' });
		});

		it('ends with 23:00', () => {
			expect(HOUR_OPTIONS[23]).toEqual({ value: 23, label: '23:00' });
		});

		it('formats hours with leading zero', () => {
			expect(HOUR_OPTIONS[5].label).toBe('05:00');
		});
	});
});
