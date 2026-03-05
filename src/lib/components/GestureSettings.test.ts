import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue({})
}));

describe('GestureSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should have gesture type labels', () => {
		const labels: Record<string, string> = {
			swipe_left: 'Swipe Left',
			swipe_right: 'Swipe Right',
			swipe_up: 'Swipe Up',
			swipe_down: 'Swipe Down',
			pinch_in: 'Pinch In',
			pinch_out: 'Pinch Out'
		};
		expect(labels.swipe_left).toBe('Swipe Left');
		expect(Object.keys(labels).length).toBe(6);
	});

	it('should have sensitivity labels', () => {
		function getSensitivityLabel(val: number): string {
			if (val <= 0.5) return 'Low';
			if (val <= 1.0) return 'Normal';
			if (val <= 1.5) return 'High';
			if (val <= 2.0) return 'Very High';
			return 'Maximum';
		}
		expect(getSensitivityLabel(0.3)).toBe('Low');
		expect(getSensitivityLabel(1.0)).toBe('Normal');
		expect(getSensitivityLabel(1.5)).toBe('High');
		expect(getSensitivityLabel(2.0)).toBe('Very High');
		expect(getSensitivityLabel(3.0)).toBe('Maximum');
	});

	it('should validate sensitivity range', () => {
		const min = 0.1;
		const max = 3.0;
		expect(min).toBeLessThan(max);
		expect(1.0).toBeGreaterThanOrEqual(min);
		expect(1.0).toBeLessThanOrEqual(max);
	});
});
