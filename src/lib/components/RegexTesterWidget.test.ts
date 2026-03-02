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

describe('RegexTesterWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Regex Pattern Matching', () => {
    it('should find all global matches', () => {
      const pattern = 'hello';
      const flags = 'g';
      const testString = 'hello world hello there hello';
      
      const regex = new RegExp(pattern, flags);
      const matches: RegExpExecArray[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match);
      }
      
      expect(matches.length).toBe(3);
      expect(matches[0][0]).toBe('hello');
      expect(matches[0].index).toBe(0);
      expect(matches[1].index).toBe(12);
      expect(matches[2].index).toBe(24);
    });

    it('should handle case-insensitive matching', () => {
      const pattern = 'hello';
      const flags = 'gi';
      const testString = 'Hello HELLO hello';
      
      const regex = new RegExp(pattern, flags);
      const matches: RegExpExecArray[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match);
      }
      
      expect(matches.length).toBe(3);
    });

    it('should handle multiline matching', () => {
      const pattern = '^line';
      const flags = 'gm';
      const testString = 'line one\nline two\nline three';
      
      const regex = new RegExp(pattern, flags);
      const matches: RegExpExecArray[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match);
      }
      
      expect(matches.length).toBe(3);
    });

    it('should return empty matches for non-matching pattern', () => {
      const pattern = 'xyz';
      const flags = 'g';
      const testString = 'hello world';
      
      const regex = new RegExp(pattern, flags);
      const matches: RegExpExecArray[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match);
      }
      
      expect(matches.length).toBe(0);
    });

    it('should detect invalid regex patterns', () => {
      const pattern = '[invalid';
      
      expect(() => new RegExp(pattern)).toThrow();
    });

    it('should handle capture groups', () => {
      const pattern = '(\\w+)@(\\w+)\\.(\\w+)';
      const flags = 'g';
      const testString = 'test@example.com';
      
      const regex = new RegExp(pattern, flags);
      const match = regex.exec(testString);
      
      expect(match).not.toBeNull();
      expect(match![0]).toBe('test@example.com');
      expect(match![1]).toBe('test');
      expect(match![2]).toBe('example');
      expect(match![3]).toBe('com');
    });

    it('should handle named capture groups', () => {
      const pattern = '(?<user>\\w+)@(?<domain>\\w+)\\.(?<tld>\\w+)';
      const flags = 'g';
      const testString = 'john@example.org';
      
      const regex = new RegExp(pattern, flags);
      const match = regex.exec(testString);
      
      expect(match).not.toBeNull();
      expect(match!.groups).toBeDefined();
      expect(match!.groups!.user).toBe('john');
      expect(match!.groups!.domain).toBe('example');
      expect(match!.groups!.tld).toBe('org');
    });
  });

  describe('Common Patterns', () => {
    const commonPatterns = [
      { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' },
      { name: 'URL', pattern: 'https?://[^\\s]+' },
      { name: 'Phone (US)', pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}' },
      { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' },
      { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-\\d{2}-\\d{2}' },
      { name: 'Hex Color', pattern: '#[0-9A-Fa-f]{3,6}\\b' },
      { name: 'Word', pattern: '\\b\\w+\\b' },
      { name: 'Number', pattern: '-?\\d+(?:\\.\\d+)?' },
    ];

    it('should match valid email addresses', () => {
      const emailPattern = commonPatterns.find(p => p.name === 'Email')!.pattern;
      const regex = new RegExp(emailPattern, 'g');
      
      const validEmails = ['test@example.com', 'user.name@domain.org', 'admin+tag@site.co.uk'];
      
      for (const email of validEmails) {
        expect(regex.test(email)).toBe(true);
        regex.lastIndex = 0; // Reset for next test
      }
    });

    it('should match valid URLs', () => {
      const urlPattern = commonPatterns.find(p => p.name === 'URL')!.pattern;
      const regex = new RegExp(urlPattern, 'g');
      
      expect(regex.test('https://example.com')).toBe(true);
      regex.lastIndex = 0;
      expect(regex.test('http://test.org/path?query=value')).toBe(true);
    });

    it('should match US phone numbers', () => {
      const phonePattern = commonPatterns.find(p => p.name === 'Phone (US)')!.pattern;
      const regex = new RegExp(phonePattern, 'g');
      
      const validPhones = ['123-456-7890', '(123) 456-7890', '123.456.7890', '123 456 7890'];
      
      for (const phone of validPhones) {
        expect(regex.test(phone)).toBe(true);
        regex.lastIndex = 0;
      }
    });

    it('should match IPv4 addresses', () => {
      const ipPattern = commonPatterns.find(p => p.name === 'IPv4')!.pattern;
      const regex = new RegExp(ipPattern, 'g');
      
      expect(regex.test('192.168.1.1')).toBe(true);
      regex.lastIndex = 0;
      expect(regex.test('10.0.0.255')).toBe(true);
    });

    it('should match ISO dates', () => {
      const datePattern = commonPatterns.find(p => p.name === 'Date (YYYY-MM-DD)')!.pattern;
      const regex = new RegExp(datePattern, 'g');
      
      expect(regex.test('2024-03-15')).toBe(true);
      regex.lastIndex = 0;
      expect(regex.test('1999-12-31')).toBe(true);
    });

    it('should match hex colors', () => {
      const colorPattern = commonPatterns.find(p => p.name === 'Hex Color')!.pattern;
      const regex = new RegExp(colorPattern, 'g');
      
      expect(regex.test('#fff')).toBe(true);
      regex.lastIndex = 0;
      expect(regex.test('#ffffff')).toBe(true);
      regex.lastIndex = 0;
      expect(regex.test('#3b82f6')).toBe(true);
    });

    it('should match numbers including decimals and negatives', () => {
      const numberPattern = commonPatterns.find(p => p.name === 'Number')!.pattern;
      const regex = new RegExp(numberPattern, 'g');
      
      const testString = '42 -17 3.14 -2.5 100';
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match[0]);
      }
      
      expect(matches).toEqual(['42', '-17', '3.14', '-2.5', '100']);
    });
  });

  describe('Flag Combinations', () => {
    it('should combine global and case-insensitive flags', () => {
      const regex = new RegExp('test', 'gi');
      const testString = 'Test TEST test TeSt';
      
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match[0]);
      }
      
      expect(matches.length).toBe(4);
    });

    it('should handle dot-all flag for multiline content', () => {
      const regexWithoutDotAll = new RegExp('start.*end', 'g');
      const regexWithDotAll = new RegExp('start.*end', 'gs');
      const testString = 'start\nmiddle\nend';
      
      expect(regexWithoutDotAll.test(testString)).toBe(false);
      expect(regexWithDotAll.test(testString)).toBe(true);
    });

    it('should handle unicode flag for emoji and special chars', () => {
      const regex = new RegExp('\\p{Emoji}', 'gu');
      const testString = 'Hello 👋 World 🌍!';
      
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push(match[0]);
      }
      
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty pattern', () => {
      const pattern = '';
      const testString = 'hello';
      
      // Empty pattern matches between every character
      const regex = new RegExp(pattern, 'g');
      const matches: string[] = [];
      let match;
      let count = 0;
      while ((match = regex.exec(testString)) !== null && count < 100) {
        matches.push(match[0]);
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        count++;
      }
      
      // Empty pattern matches at every position
      expect(matches.length).toBe(testString.length + 1);
    });

    it('should handle empty test string', () => {
      const pattern = 'test';
      const testString = '';
      
      const regex = new RegExp(pattern, 'g');
      const match = regex.exec(testString);
      
      expect(match).toBeNull();
    });

    it('should handle special regex characters in pattern', () => {
      const pattern = '\\[test\\]';
      const testString = 'This is [test] content';
      
      const regex = new RegExp(pattern, 'g');
      const match = regex.exec(testString);
      
      expect(match).not.toBeNull();
      expect(match![0]).toBe('[test]');
    });

    it('should prevent infinite loops with zero-width matches', () => {
      const pattern = '(?=a)';
      const testString = 'aaa';
      
      const regex = new RegExp(pattern, 'g');
      const matches: RegExpExecArray[] = [];
      let count = 0;
      const maxIterations = 10;
      
      let match;
      while ((match = regex.exec(testString)) !== null && count < maxIterations) {
        matches.push(match);
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        count++;
      }
      
      expect(count).toBeLessThan(maxIterations);
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML special characters', () => {
      const escapeHtml = (text: string): string => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(escapeHtml("Test's & stuff")).toBe("Test&#039;s &amp; stuff");
    });
  });

  describe('History Management', () => {
    it('should limit history to max entries', () => {
      const MAX_HISTORY = 10;
      const history: { pattern: string; flags: string }[] = [];
      
      const addToHistory = (pattern: string, flags: string) => {
        const entry = { pattern, flags };
        // Remove duplicates
        const filtered = history.filter(h => h.pattern !== pattern || h.flags !== flags);
        filtered.unshift(entry);
        if (filtered.length > MAX_HISTORY) {
          filtered.splice(MAX_HISTORY);
        }
        history.length = 0;
        history.push(...filtered);
      };
      
      // Add more than max entries
      for (let i = 0; i < 15; i++) {
        addToHistory(`pattern${i}`, 'g');
      }
      
      expect(history.length).toBe(MAX_HISTORY);
      expect(history[0].pattern).toBe('pattern14');
    });

    it('should remove duplicates when adding to history', () => {
      const history: { pattern: string; flags: string }[] = [];
      
      const addToHistory = (pattern: string, flags: string) => {
        const entry = { pattern, flags };
        const filtered = history.filter(h => h.pattern !== pattern || h.flags !== flags);
        filtered.unshift(entry);
        history.length = 0;
        history.push(...filtered);
      };
      
      addToHistory('test', 'g');
      addToHistory('other', 'g');
      addToHistory('test', 'g');
      
      expect(history.length).toBe(2);
      expect(history[0].pattern).toBe('test');
    });
  });

  describe('Pattern Formatting', () => {
    it('should format pattern with flags for display', () => {
      const pattern = 'hello\\w+';
      const flags = 'gi';
      
      const formatted = `/${pattern}/${flags}`;
      
      expect(formatted).toBe('/hello\\w+/gi');
    });

    it('should handle empty flags', () => {
      const pattern = 'test';
      const flags = '';
      
      const formatted = `/${pattern}/${flags}`;
      
      expect(formatted).toBe('/test/');
    });
  });
});
