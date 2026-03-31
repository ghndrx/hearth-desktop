import { describe, it, expect } from 'vitest';
import { formatIdleTime } from './idle';

describe('idle utilities', () => {
    describe('formatIdleTime', () => {
        it('formats seconds only', () => {
            expect(formatIdleTime(30)).toBe('30s');
            expect(formatIdleTime(45)).toBe('45s');
        });

        it('formats minutes and seconds', () => {
            expect(formatIdleTime(90)).toBe('1m 30s');
            expect(formatIdleTime(125)).toBe('2m 5s');
            expect(formatIdleTime(180)).toBe('3m');
        });

        it('formats hours, minutes and seconds', () => {
            expect(formatIdleTime(3661)).toBe('1h 1m 1s');
            expect(formatIdleTime(3600)).toBe('1h');
            expect(formatIdleTime(3660)).toBe('1h 1m');
            expect(formatIdleTime(7325)).toBe('2h 2m 5s');
        });

        it('handles edge cases', () => {
            expect(formatIdleTime(0)).toBe('0s');
            expect(formatIdleTime(1)).toBe('1s');
            expect(formatIdleTime(60)).toBe('1m');
        });
    });
});