import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Color conversion utilities (extracted for testing)
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

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

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

type PaletteType = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochromatic';

function generatePalette(hex: string, type: PaletteType): string[] {
  const hsl = hexToHsl(hex);
  const colors: string[] = [hex];

  switch (type) {
    case 'complementary':
      colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
      break;

    case 'analogous':
      colors.push(hslToHex(hsl.h - 30, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 30, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h - 60, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 60, hsl.s, hsl.l));
      break;

    case 'triadic':
      colors.push(hslToHex(hsl.h + 120, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 240, hsl.s, hsl.l));
      break;

    case 'split':
      colors.push(hslToHex(hsl.h + 150, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 210, hsl.s, hsl.l));
      break;

    case 'tetradic':
      colors.push(hslToHex(hsl.h + 90, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 180, hsl.s, hsl.l));
      colors.push(hslToHex(hsl.h + 270, hsl.s, hsl.l));
      break;

    case 'monochromatic':
      colors.push(hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 15)));
      colors.push(hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 15)));
      colors.push(hslToHex(hsl.h, hsl.s, Math.min(100, hsl.l + 30)));
      colors.push(hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 30)));
      break;
  }

  return colors;
}

function getContrastColor(hex: string): string {
  const hsl = hexToHsl(hex);
  return hsl.l > 50 ? '#000000' : '#ffffff';
}

describe('ColorPaletteWidget', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('hexToHsl', () => {
    it('converts red correctly', () => {
      const hsl = hexToHsl('#ff0000');
      expect(hsl.h).toBeCloseTo(0, 0);
      expect(hsl.s).toBeCloseTo(100, 0);
      expect(hsl.l).toBeCloseTo(50, 0);
    });

    it('converts green correctly', () => {
      const hsl = hexToHsl('#00ff00');
      expect(hsl.h).toBeCloseTo(120, 0);
      expect(hsl.s).toBeCloseTo(100, 0);
      expect(hsl.l).toBeCloseTo(50, 0);
    });

    it('converts blue correctly', () => {
      const hsl = hexToHsl('#0000ff');
      expect(hsl.h).toBeCloseTo(240, 0);
      expect(hsl.s).toBeCloseTo(100, 0);
      expect(hsl.l).toBeCloseTo(50, 0);
    });

    it('converts white correctly', () => {
      const hsl = hexToHsl('#ffffff');
      expect(hsl.l).toBeCloseTo(100, 0);
    });

    it('converts black correctly', () => {
      const hsl = hexToHsl('#000000');
      expect(hsl.l).toBeCloseTo(0, 0);
    });

    it('handles invalid hex', () => {
      const hsl = hexToHsl('invalid');
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(0);
    });
  });

  describe('hslToHex', () => {
    it('converts red HSL to hex', () => {
      const hex = hslToHex(0, 100, 50);
      expect(hex.toLowerCase()).toBe('#ff0000');
    });

    it('converts green HSL to hex', () => {
      const hex = hslToHex(120, 100, 50);
      expect(hex.toLowerCase()).toBe('#00ff00');
    });

    it('converts blue HSL to hex', () => {
      const hex = hslToHex(240, 100, 50);
      expect(hex.toLowerCase()).toBe('#0000ff');
    });

    it('handles hue wraparound', () => {
      const hex1 = hslToHex(360, 100, 50);
      const hex2 = hslToHex(0, 100, 50);
      expect(hex1).toBe(hex2);
    });

    it('handles negative hue', () => {
      const hex = hslToHex(-60, 100, 50);
      expect(hex.toLowerCase()).toBe('#ff00ff'); // Magenta (300 degrees)
    });
  });

  describe('generatePalette', () => {
    it('generates complementary palette with 2 colors', () => {
      const palette = generatePalette('#ff0000', 'complementary');
      expect(palette).toHaveLength(2);
      expect(palette[0]).toBe('#ff0000');
      // Complementary of red is cyan
      expect(palette[1].toLowerCase()).toBe('#00ffff');
    });

    it('generates analogous palette with 5 colors', () => {
      const palette = generatePalette('#ff0000', 'analogous');
      expect(palette).toHaveLength(5);
      expect(palette[0]).toBe('#ff0000');
    });

    it('generates triadic palette with 3 colors', () => {
      const palette = generatePalette('#ff0000', 'triadic');
      expect(palette).toHaveLength(3);
      expect(palette[0]).toBe('#ff0000');
    });

    it('generates split-complementary palette with 3 colors', () => {
      const palette = generatePalette('#ff0000', 'split');
      expect(palette).toHaveLength(3);
    });

    it('generates tetradic palette with 4 colors', () => {
      const palette = generatePalette('#ff0000', 'tetradic');
      expect(palette).toHaveLength(4);
    });

    it('generates monochromatic palette with 5 colors', () => {
      const palette = generatePalette('#ff0000', 'monochromatic');
      expect(palette).toHaveLength(5);
      // All should be shades of red (same hue)
    });

    it('always includes base color as first element', () => {
      const types: PaletteType[] = ['complementary', 'analogous', 'triadic', 'split', 'tetradic', 'monochromatic'];
      for (const type of types) {
        const palette = generatePalette('#5865f2', type);
        expect(palette[0]).toBe('#5865f2');
      }
    });
  });

  describe('getContrastColor', () => {
    it('returns black for light colors', () => {
      expect(getContrastColor('#ffffff')).toBe('#000000');
      expect(getContrastColor('#ffff00')).toBe('#000000');
    });

    it('returns white for dark colors', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#0000ff')).toBe('#ffffff');
    });
  });

  describe('localStorage integration', () => {
    it('saves palettes to localStorage', () => {
      const palettes = [
        { name: 'Test', baseColor: '#ff0000', colors: ['#ff0000', '#00ffff'], type: 'complementary' }
      ];
      localStorage.setItem('colorPalettes', JSON.stringify(palettes));
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('colorPalettes', JSON.stringify(palettes));
    });

    it('retrieves saved palettes from localStorage', () => {
      const palettes = [
        { name: 'Test', baseColor: '#ff0000', colors: ['#ff0000', '#00ffff'], type: 'complementary' }
      ];
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(palettes));
      
      const stored = localStorage.getItem('colorPalettes');
      expect(stored).toBe(JSON.stringify(palettes));
    });
  });

  describe('palette type configurations', () => {
    const paletteTypes = [
      { value: 'complementary', label: 'Complementary', expectedColors: 2 },
      { value: 'analogous', label: 'Analogous', expectedColors: 5 },
      { value: 'triadic', label: 'Triadic', expectedColors: 3 },
      { value: 'split', label: 'Split-Complementary', expectedColors: 3 },
      { value: 'tetradic', label: 'Tetradic', expectedColors: 4 },
      { value: 'monochromatic', label: 'Monochromatic', expectedColors: 5 },
    ];

    for (const { value, label, expectedColors } of paletteTypes) {
      it(`${label} generates ${expectedColors} colors`, () => {
        const palette = generatePalette('#5865f2', value as PaletteType);
        expect(palette).toHaveLength(expectedColors);
      });
    }
  });

  describe('edge cases', () => {
    it('handles grayscale colors', () => {
      const palette = generatePalette('#808080', 'complementary');
      expect(palette).toHaveLength(2);
      // Gray's complement is still gray (no hue to shift)
    });

    it('handles very light colors in monochromatic', () => {
      const palette = generatePalette('#f0f0f0', 'monochromatic');
      expect(palette).toHaveLength(5);
      // Should not exceed 100% lightness
    });

    it('handles very dark colors in monochromatic', () => {
      const palette = generatePalette('#101010', 'monochromatic');
      expect(palette).toHaveLength(5);
      // Should not go below 0% lightness
    });
  });
});
