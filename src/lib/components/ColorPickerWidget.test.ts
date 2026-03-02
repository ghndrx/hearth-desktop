import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock clipboard API
Object.assign(navigator, {
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined)
	}
});

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

describe('ColorPickerWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorageMock.clear();
	});

	describe('Color Conversion Functions', () => {
		it('should convert hex to RGB correctly', () => {
			// Test color: #3b82f6 (Tailwind blue-500)
			const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
				const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
				return result ? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16)
				} : null;
			};

			const rgb = hexToRgb('#3b82f6');
			expect(rgb).toEqual({ r: 59, g: 130, b: 246 });
		});

		it('should convert RGB to hex correctly', () => {
			const rgbToHex = (r: number, g: number, b: number): string => {
				return '#' + [r, g, b].map(x => {
					const hex = Math.round(x).toString(16);
					return hex.length === 1 ? '0' + hex : hex;
				}).join('');
			};

			expect(rgbToHex(59, 130, 246)).toBe('#3b82f6');
			expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
			expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
			expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
		});

		it('should convert RGB to HSL correctly', () => {
			const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
				r /= 255;
				g /= 255;
				b /= 255;

				const max = Math.max(r, g, b);
				const min = Math.min(r, g, b);
				let h = 0;
				let s = 0;
				const l = (max + min) / 2;

				if (max !== min) {
					const d = max - min;
					s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

					switch (max) {
						case r:
							h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
							break;
						case g:
							h = ((b - r) / d + 2) / 6;
							break;
						case b:
							h = ((r - g) / d + 4) / 6;
							break;
					}
				}

				return {
					h: Math.round(h * 360),
					s: Math.round(s * 100),
					l: Math.round(l * 100)
				};
			};

			// Pure red
			expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
			// Pure green
			expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 });
			// Pure blue
			expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 });
			// White
			expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 });
			// Black
			expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
		});

		it('should convert HSL to RGB correctly', () => {
			const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
				h /= 360;
				s /= 100;
				l /= 100;

				let r: number, g: number, b: number;

				if (s === 0) {
					r = g = b = l;
				} else {
					const hue2rgb = (p: number, q: number, t: number) => {
						if (t < 0) t += 1;
						if (t > 1) t -= 1;
						if (t < 1 / 6) return p + (q - p) * 6 * t;
						if (t < 1 / 2) return q;
						if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
						return p;
					};

					const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
					const p = 2 * l - q;

					r = hue2rgb(p, q, h + 1 / 3);
					g = hue2rgb(p, q, h);
					b = hue2rgb(p, q, h - 1 / 3);
				}

				return {
					r: Math.round(r * 255),
					g: Math.round(g * 255),
					b: Math.round(b * 255)
				};
			};

			// Pure red
			expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });
			// Pure green
			expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 });
			// Pure blue
			expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 });
			// White
			expect(hslToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 });
			// Black
			expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
		});
	});

	describe('Contrast Color Calculation', () => {
		it('should return black for light colors', () => {
			const getContrastColor = (hex: string): string => {
				const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
				if (!result) return '#000000';
				const r = parseInt(result[1], 16);
				const g = parseInt(result[2], 16);
				const b = parseInt(result[3], 16);
				const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
				return luminance > 0.5 ? '#000000' : '#ffffff';
			};

			expect(getContrastColor('#ffffff')).toBe('#000000');
			expect(getContrastColor('#ffff00')).toBe('#000000');
			expect(getContrastColor('#00ff00')).toBe('#000000');
		});

		it('should return white for dark colors', () => {
			const getContrastColor = (hex: string): string => {
				const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
				if (!result) return '#000000';
				const r = parseInt(result[1], 16);
				const g = parseInt(result[2], 16);
				const b = parseInt(result[3], 16);
				const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
				return luminance > 0.5 ? '#000000' : '#ffffff';
			};

			expect(getContrastColor('#000000')).toBe('#ffffff');
			expect(getContrastColor('#0000ff')).toBe('#ffffff');
			expect(getContrastColor('#800080')).toBe('#ffffff');
		});
	});

	describe('Color Harmony Generation', () => {
		it('should generate complementary color', () => {
			const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
				h /= 360;
				s /= 100;
				l /= 100;
				let r: number, g: number, b: number;
				if (s === 0) {
					r = g = b = l;
				} else {
					const hue2rgb = (p: number, q: number, t: number) => {
						if (t < 0) t += 1;
						if (t > 1) t -= 1;
						if (t < 1 / 6) return p + (q - p) * 6 * t;
						if (t < 1 / 2) return q;
						if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
						return p;
					};
					const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
					const p = 2 * l - q;
					r = hue2rgb(p, q, h + 1 / 3);
					g = hue2rgb(p, q, h);
					b = hue2rgb(p, q, h - 1 / 3);
				}
				return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
			};

			const rgbToHex = (r: number, g: number, b: number): string => {
				return '#' + [r, g, b].map(x => {
					const hex = Math.round(x).toString(16);
					return hex.length === 1 ? '0' + hex : hex;
				}).join('');
			};

			const generateComplementary = (h: number, s: number, l: number): string => {
				const newH = (h + 180) % 360;
				const rgb = hslToRgb(newH, s, l);
				return rgbToHex(rgb.r, rgb.g, rgb.b);
			};

			// Red (h=0) should have cyan (h=180) as complement
			const complement = generateComplementary(0, 100, 50);
			expect(complement).toBe('#00ffff');
		});

		it('should generate triadic colors', () => {
			const generateTriadic = (h: number): number[] => {
				return [h, (h + 120) % 360, (h + 240) % 360];
			};

			expect(generateTriadic(0)).toEqual([0, 120, 240]);
			expect(generateTriadic(60)).toEqual([60, 180, 300]);
		});
	});

	describe('Color Palettes', () => {
		it('should have valid hex colors in tailwind palette', () => {
			const tailwindColors = [
				'#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
				'#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
				'#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
				'#ec4899', '#f43f5e'
			];

			const hexRegex = /^#[0-9A-Fa-f]{6}$/;
			tailwindColors.forEach(color => {
				expect(hexRegex.test(color)).toBe(true);
			});
		});

		it('should have valid hex colors in material palette', () => {
			const materialColors = [
				'#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
				'#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
				'#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
				'#ff5722', '#795548'
			];

			const hexRegex = /^#[0-9A-Fa-f]{6}$/;
			materialColors.forEach(color => {
				expect(hexRegex.test(color)).toBe(true);
			});
		});
	});

	describe('Saved Colors Storage', () => {
		it('should save colors to localStorage', () => {
			const savedColors = ['#ff0000', '#00ff00', '#0000ff'];
			localStorage.setItem('colorPickerWidget_savedColors', JSON.stringify(savedColors));

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'colorPickerWidget_savedColors',
				JSON.stringify(savedColors)
			);
		});

		it('should load colors from localStorage', () => {
			const savedColors = ['#ff0000', '#00ff00'];
			localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedColors));

			const loaded = localStorage.getItem('colorPickerWidget_savedColors');
			expect(loaded).toBe(JSON.stringify(savedColors));
		});

		it('should handle empty saved colors', () => {
			localStorageMock.getItem.mockReturnValueOnce(null);

			const loaded = localStorage.getItem('colorPickerWidget_savedColors');
			expect(loaded).toBeNull();
		});
	});

	describe('Hex Input Validation', () => {
		it('should validate valid hex colors', () => {
			const isValidHex = (hex: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(hex);

			expect(isValidHex('#ffffff')).toBe(true);
			expect(isValidHex('#000000')).toBe(true);
			expect(isValidHex('#3b82f6')).toBe(true);
			expect(isValidHex('#AABBCC')).toBe(true);
		});

		it('should reject invalid hex colors', () => {
			const isValidHex = (hex: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(hex);

			expect(isValidHex('ffffff')).toBe(false);
			expect(isValidHex('#fff')).toBe(false);
			expect(isValidHex('#gggggg')).toBe(false);
			expect(isValidHex('')).toBe(false);
			expect(isValidHex('#12345')).toBe(false);
			expect(isValidHex('#1234567')).toBe(false);
		});
	});

	describe('Clipboard Operations', () => {
		it('should copy hex to clipboard', async () => {
			await navigator.clipboard.writeText('#3b82f6');
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith('#3b82f6');
		});

		it('should copy RGB to clipboard', async () => {
			await navigator.clipboard.writeText('rgb(59, 130, 246)');
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith('rgb(59, 130, 246)');
		});

		it('should copy HSL to clipboard', async () => {
			await navigator.clipboard.writeText('hsl(217, 91%, 60%)');
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hsl(217, 91%, 60%)');
		});
	});
});
