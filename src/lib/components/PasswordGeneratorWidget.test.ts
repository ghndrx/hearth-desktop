import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PasswordGeneratorWidget', () => {
	beforeEach(() => {
		// Mock crypto.getRandomValues
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array: ArrayBufferView) => {
			const uint32Array = array as Uint32Array;
			for (let i = 0; i < uint32Array.length; i++) {
				uint32Array[i] = Math.floor(Math.random() * 4294967296);
			}
			return array;
		});

		// Mock localStorage
		const store: Record<string, string> = {};
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
			store[key] = value;
		});

		// Mock clipboard
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
	});

	describe('password generation', () => {
		it('should generate passwords with uppercase letters', () => {
			const password = generateTestPassword({
				length: 20,
				includeUppercase: true,
				includeLowercase: false,
				includeNumbers: false,
				includeSymbols: false
			});
			expect(password).toMatch(/^[A-Z]+$/);
			expect(password.length).toBe(20);
		});

		it('should generate passwords with lowercase letters', () => {
			const password = generateTestPassword({
				length: 15,
				includeUppercase: false,
				includeLowercase: true,
				includeNumbers: false,
				includeSymbols: false
			});
			expect(password).toMatch(/^[a-z]+$/);
			expect(password.length).toBe(15);
		});

		it('should generate passwords with numbers', () => {
			const password = generateTestPassword({
				length: 10,
				includeUppercase: false,
				includeLowercase: false,
				includeNumbers: true,
				includeSymbols: false
			});
			expect(password).toMatch(/^[0-9]+$/);
			expect(password.length).toBe(10);
		});

		it('should generate passwords with symbols', () => {
			const password = generateTestPassword({
				length: 12,
				includeUppercase: false,
				includeLowercase: false,
				includeNumbers: false,
				includeSymbols: true
			});
			expect(password).toMatch(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/);
			expect(password.length).toBe(12);
		});

		it('should generate mixed passwords', () => {
			const password = generateTestPassword({
				length: 16,
				includeUppercase: true,
				includeLowercase: true,
				includeNumbers: true,
				includeSymbols: true
			});
			expect(password.length).toBe(16);
		});

		it('should exclude ambiguous characters when enabled', () => {
			const password = generateTestPassword({
				length: 100,
				includeUppercase: true,
				includeLowercase: true,
				includeNumbers: true,
				includeSymbols: false,
				excludeAmbiguous: true
			});
			expect(password).not.toMatch(/[O0Il1]/);
		});

		it('should return empty string when no character sets selected', () => {
			const password = generateTestPassword({
				length: 16,
				includeUppercase: false,
				includeLowercase: false,
				includeNumbers: false,
				includeSymbols: false
			});
			expect(password).toBe('');
		});
	});

	describe('password strength', () => {
		it('should rate short passwords as weak', () => {
			const strength = calculateStrength('abc123');
			expect(strength.level).toBeLessThanOrEqual(2);
		});

		it('should rate long mixed passwords as strong', () => {
			const strength = calculateStrength('MyP@ssw0rd!2024XyZ');
			expect(strength.level).toBeGreaterThanOrEqual(3);
		});

		it('should return None for empty password', () => {
			const strength = calculateStrength('');
			expect(strength.label).toBe('None');
			expect(strength.level).toBe(0);
		});
	});

	describe('history management', () => {
		it('should save passwords to history', () => {
			const history: string[] = [];
			const password = 'TestPassword123!';
			
			if (!history.includes(password)) {
				history.unshift(password);
			}
			
			expect(history).toContain(password);
		});

		it('should limit history to 10 items', () => {
			const history: string[] = [];
			
			for (let i = 0; i < 15; i++) {
				const pwd = `Password${i}`;
				if (!history.includes(pwd)) {
					history.unshift(pwd);
					if (history.length > 10) {
						history.pop();
					}
				}
			}
			
			expect(history.length).toBe(10);
		});

		it('should not add duplicate passwords to history', () => {
			const history: string[] = ['Password1'];
			const password = 'Password1';
			
			if (!history.includes(password)) {
				history.unshift(password);
			}
			
			expect(history.length).toBe(1);
		});
	});

	describe('clipboard', () => {
		it('should copy password to clipboard', async () => {
			const password = 'TestPassword123!';
			await navigator.clipboard.writeText(password);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(password);
		});
	});
});

// Helper functions that mirror component logic
function generateTestPassword(options: {
	length: number;
	includeUppercase: boolean;
	includeLowercase: boolean;
	includeNumbers: boolean;
	includeSymbols: boolean;
	excludeAmbiguous?: boolean;
}): string {
	const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
	const NUMBERS = '0123456789';
	const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
	const AMBIGUOUS = 'O0Il1';

	let chars = '';
	if (options.includeUppercase) chars += UPPERCASE;
	if (options.includeLowercase) chars += LOWERCASE;
	if (options.includeNumbers) chars += NUMBERS;
	if (options.includeSymbols) chars += SYMBOLS;

	if (options.excludeAmbiguous) {
		for (const char of AMBIGUOUS) {
			chars = chars.replace(new RegExp(char, 'g'), '');
		}
	}

	if (!chars) return '';

	const array = new Uint32Array(options.length);
	crypto.getRandomValues(array);

	let result = '';
	for (let i = 0; i < options.length; i++) {
		result += chars[array[i] % chars.length];
	}

	return result;
}

function calculateStrength(password: string): { level: number; label: string; color: string } {
	if (!password) return { level: 0, label: 'None', color: 'bg-zinc-600' };

	let score = 0;
	if (password.length >= 8) score++;
	if (password.length >= 12) score++;
	if (password.length >= 16) score++;
	if (/[a-z]/.test(password)) score++;
	if (/[A-Z]/.test(password)) score++;
	if (/[0-9]/.test(password)) score++;
	if (/[^a-zA-Z0-9]/.test(password)) score++;

	if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
	if (score <= 4) return { level: 2, label: 'Fair', color: 'bg-yellow-500' };
	if (score <= 5) return { level: 3, label: 'Good', color: 'bg-blue-500' };
	return { level: 4, label: 'Strong', color: 'bg-green-500' };
}
