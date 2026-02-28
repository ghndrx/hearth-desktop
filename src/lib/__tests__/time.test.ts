import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTimestamp,
  formatTime,
  formatDate,
  getRelativeTime,
  isSameDay,
  formatDuration,
  formatDiscordTimestamp,
  parseDiscordTimestamp,
  snowflakeToDate
} from '../utils/time';

describe('formatTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should format timestamp in short format for today', () => {
    const today = new Date('2025-02-14T09:30:00Z');
    const result = formatTimestamp(today, 'short');
    // Should be just the time
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).not.toContain('Today');
  });

  it('should format timestamp in short format for yesterday', () => {
    const yesterday = new Date('2025-02-13T09:30:00Z');
    const result = formatTimestamp(yesterday, 'short');
    expect(result).toContain('Yesterday');
  });

  it('should format timestamp in long format for today', () => {
    const today = new Date('2025-02-14T09:30:00Z');
    const result = formatTimestamp(today, 'long');
    expect(result).toContain('Today at');
  });

  it('should format timestamp in long format for yesterday', () => {
    const yesterday = new Date('2025-02-13T09:30:00Z');
    const result = formatTimestamp(yesterday, 'long');
    expect(result).toContain('Yesterday at');
  });

  it('should use relative format when specified', () => {
    const fiveMinutesAgo = new Date('2025-02-14T11:55:00Z');
    const result = formatTimestamp(fiveMinutesAgo, 'relative');
    expect(result).toBe('5 minutes ago');
  });

  it('should handle string date input', () => {
    const result = formatTimestamp('2025-02-14T09:30:00Z', 'short');
    expect(result).toBeTruthy();
  });
});

describe('formatTime', () => {
  it('should format time with AM/PM', () => {
    const morning = new Date('2025-02-14T09:30:00Z');
    const result = formatTime(morning);
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('should format afternoon time', () => {
    const afternoon = new Date('2025-02-14T14:45:00Z');
    const result = formatTime(afternoon);
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });
});

describe('formatDate', () => {
  it('should format date as MM/DD/YYYY', () => {
    const date = new Date('2025-02-14T12:00:00Z');
    const result = formatDate(date);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});

describe('getRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for less than 60 seconds', () => {
    const now = new Date();
    expect(getRelativeTime(now)).toBe('just now');

    const thirtySecsAgo = new Date(now.getTime() - 30 * 1000);
    expect(getRelativeTime(thirtySecsAgo)).toBe('just now');
  });

  it('should return singular minute', () => {
    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    expect(getRelativeTime(oneMinAgo)).toBe('1 minute ago');
  });

  it('should return plural minutes', () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getRelativeTime(fiveMinsAgo)).toBe('5 minutes ago');
  });

  it('should return singular hour', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(getRelativeTime(oneHourAgo)).toBe('1 hour ago');
  });

  it('should return plural hours', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(getRelativeTime(threeHoursAgo)).toBe('3 hours ago');
  });

  it('should return singular day', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(getRelativeTime(oneDayAgo)).toBe('1 day ago');
  });

  it('should return plural days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(getRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('should return weeks', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(getRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
  });

  it('should return months', () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    expect(getRelativeTime(twoMonthsAgo)).toBe('2 months ago');
  });

  it('should return years', () => {
    const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    expect(getRelativeTime(twoYearsAgo)).toBe('2 years ago');
  });
});

describe('isSameDay', () => {
  it('should return true for same day', () => {
    const date1 = new Date('2025-02-14T09:00:00Z');
    const date2 = new Date('2025-02-14T18:00:00Z');
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('should return false for different days', () => {
    const date1 = new Date('2025-02-14T09:00:00Z');
    const date2 = new Date('2025-02-15T09:00:00Z');
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('should return false for different months', () => {
    const date1 = new Date('2025-02-14T09:00:00Z');
    const date2 = new Date('2025-03-14T09:00:00Z');
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('should return false for different years', () => {
    const date1 = new Date('2025-02-14T09:00:00Z');
    const date2 = new Date('2024-02-14T09:00:00Z');
    expect(isSameDay(date1, date2)).toBe(false);
  });
});

describe('formatDuration', () => {
  it('should format seconds only', () => {
    expect(formatDuration(5000)).toBe('0:05');
    expect(formatDuration(45000)).toBe('0:45');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1:00');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(125000)).toBe('2:05');
    expect(formatDuration(599000)).toBe('9:59');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatDuration(3600000)).toBe('1:00:00');
    expect(formatDuration(3665000)).toBe('1:01:05');
    expect(formatDuration(7200000)).toBe('2:00:00');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});

describe('formatDiscordTimestamp', () => {
  it('should format relative style (R)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    expect(formatDiscordTimestamp(fiveMinutesAgo, 'R')).toBe('5 minutes ago');

    vi.useRealTimers();
  });

  it('should format short time style (t)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:00Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 't');
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('should format short date style (d)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:00Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 'd');
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });

  it('should format full time style (T)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:45Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 'T');
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('should format long date style (D)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:00Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 'D');
    expect(result).toContain('2025');
  });

  it('should format short date time style (f)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:00Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 'f');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).toContain('2025');
  });

  it('should format full date time style (F)', () => {
    const unix = Math.floor(new Date('2025-02-14T14:30:00Z').getTime() / 1000);
    const result = formatDiscordTimestamp(unix, 'F');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).toContain('2025');
  });
});

describe('parseDiscordTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should parse timestamp without style', () => {
    const unix = Math.floor(new Date('2025-02-14T09:30:00Z').getTime() / 1000);
    const content = `Message at <t:${unix}>`;
    const result = parseDiscordTimestamp(content);
    expect(result).not.toContain('<t:');
  });

  it('should parse timestamp with style', () => {
    const unix = Math.floor(new Date('2025-02-14T09:30:00Z').getTime() / 1000);
    const content = `Message at <t:${unix}:R>`;
    const result = parseDiscordTimestamp(content);
    expect(result).not.toContain('<t:');
    expect(result).toContain('ago');
  });

  it('should parse multiple timestamps', () => {
    const unix1 = Math.floor(new Date('2025-02-14T09:00:00Z').getTime() / 1000);
    const unix2 = Math.floor(new Date('2025-02-14T10:00:00Z').getTime() / 1000);
    const content = `Start: <t:${unix1}:t> End: <t:${unix2}:t>`;
    const result = parseDiscordTimestamp(content);
    expect(result).not.toContain('<t:');
    expect((result.match(/\d{1,2}:\d{2}/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('should leave non-timestamp content unchanged', () => {
    const content = 'Hello world, no timestamps here!';
    expect(parseDiscordTimestamp(content)).toBe(content);
  });
});

describe('snowflakeToDate', () => {
  it('should convert Discord snowflake to date', () => {
    // Known Discord snowflake: 175928847299117063 (Discord's ID)
    // Created around 2016-04-30
    const date = snowflakeToDate('175928847299117063');
    expect(date.getFullYear()).toBe(2016);
    expect(date.getMonth()).toBe(3); // April (0-indexed)
  });

  it('should handle recent snowflakes', () => {
    // A snowflake from 2024 would have a timestamp after 2024-01-01
    const recentSnowflake = '1199477000000000000';
    const date = snowflakeToDate(recentSnowflake);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it('should handle minimum valid snowflake', () => {
    // Snowflake 0 would be Discord epoch (2015-01-01)
    const date = snowflakeToDate('0');
    expect(date.getFullYear()).toBe(2015);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(1);
  });
});
