import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatRelativeTime,
  formatMessageTime,
  formatMessageDate,
  formatFileSize,
  truncate
} from '../utils/format';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for times less than 60 seconds ago', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');

    const thirtySecsAgo = new Date(now.getTime() - 30 * 1000);
    expect(formatRelativeTime(thirtySecsAgo)).toBe('just now');
  });

  it('should return minutes ago for times less than 60 minutes', () => {
    const now = new Date();
    
    const oneMinAgo = new Date(now.getTime() - 60 * 1000);
    expect(formatRelativeTime(oneMinAgo)).toBe('1m ago');

    const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatRelativeTime(thirtyMinsAgo)).toBe('30m ago');

    const fiftyNineMinsAgo = new Date(now.getTime() - 59 * 60 * 1000);
    expect(formatRelativeTime(fiftyNineMinsAgo)).toBe('59m ago');
  });

  it('should return hours ago for times less than 24 hours', () => {
    const now = new Date();
    
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');

    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    expect(formatRelativeTime(twelveHoursAgo)).toBe('12h ago');
  });

  it('should return "yesterday" for times 1 day ago', () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(oneDayAgo)).toBe('yesterday');
  });

  it('should return days ago for times less than 7 days', () => {
    const now = new Date();
    
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');

    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
  });

  it('should return formatted date for times 7 or more days ago', () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(sevenDaysAgo);
    // Should be a date string
    expect(result).toMatch(/\d/);
  });

  it('should handle string date input', () => {
    const now = new Date();
    const isoString = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString)).toBe('5m ago');
  });
});

describe('formatMessageTime', () => {
  it('should format time as HH:MM', () => {
    const date = new Date('2025-02-14T14:30:00Z');
    const result = formatMessageTime(date);
    // Result depends on locale, but should include hours and minutes
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('should handle string date input', () => {
    const result = formatMessageTime('2025-02-14T09:15:00Z');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatMessageDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Today" for today\'s date', () => {
    const today = new Date('2025-02-14T08:00:00Z');
    expect(formatMessageDate(today)).toBe('Today');
  });

  it('should return "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date('2025-02-13T15:00:00Z');
    expect(formatMessageDate(yesterday)).toBe('Yesterday');
  });

  it('should return formatted date for older dates', () => {
    const oldDate = new Date('2025-02-10T12:00:00Z');
    const result = formatMessageDate(oldDate);
    // Should contain month and day info
    expect(result).toBeTruthy();
    expect(result).not.toBe('Today');
    expect(result).not.toBe('Yesterday');
  });

  it('should handle string date input', () => {
    const result = formatMessageDate('2025-02-14T12:00:00Z');
    expect(result).toBe('Today');
  });
});

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(100)).toBe('100 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
    expect(formatFileSize(1024 * 1024 - 1)).toMatch(/KB$/);
  });

  it('should format megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });
});

describe('truncate', () => {
  it('should not truncate text shorter than maxLength', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('should truncate text longer than maxLength', () => {
    expect(truncate('Hello World', 8)).toBe('Hello...');
    expect(truncate('This is a long message', 10)).toBe('This is...');
  });

  it('should handle empty strings', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('should handle maxLength shorter than ellipsis', () => {
    // Edge case: maxLength of 3 or less
    expect(truncate('Hello', 3)).toBe('...');
    expect(truncate('Hello', 4)).toBe('H...');
  });

  it('should handle exact length', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
    expect(truncate('Hello!', 6)).toBe('Hello!');
  });
});
