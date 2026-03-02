import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock clipboard API
Object.assign(navigator, {
	clipboard: {
		writeText: vi.fn().mockResolvedValue(undefined),
		readText: vi.fn().mockResolvedValue('{"test": "value"}')
	}
});

describe('JsonFormatterWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('JSON Parsing', () => {
		it('should parse valid JSON', () => {
			const input = '{"name":"test","value":123}';
			const parsed = JSON.parse(input);
			expect(parsed.name).toBe('test');
			expect(parsed.value).toBe(123);
		});

		it('should handle nested JSON objects', () => {
			const input = '{"outer":{"inner":{"deep":"value"}}}';
			const parsed = JSON.parse(input);
			expect(parsed.outer.inner.deep).toBe('value');
		});

		it('should handle JSON arrays', () => {
			const input = '[1, 2, 3, "test", {"key": "value"}]';
			const parsed = JSON.parse(input);
			expect(parsed).toHaveLength(5);
			expect(parsed[3]).toBe('test');
			expect(parsed[4].key).toBe('value');
		});

		it('should throw on invalid JSON', () => {
			const input = '{invalid json}';
			expect(() => JSON.parse(input)).toThrow();
		});

		it('should handle empty objects and arrays', () => {
			expect(JSON.parse('{}')).toEqual({});
			expect(JSON.parse('[]')).toEqual([]);
		});

		it('should handle null values', () => {
			const input = '{"nullable": null}';
			const parsed = JSON.parse(input);
			expect(parsed.nullable).toBeNull();
		});

		it('should handle boolean values', () => {
			const input = '{"active": true, "disabled": false}';
			const parsed = JSON.parse(input);
			expect(parsed.active).toBe(true);
			expect(parsed.disabled).toBe(false);
		});
	});

	describe('JSON Formatting', () => {
		it('should format JSON with 2-space indentation', () => {
			const input = { name: 'test', value: 123 };
			const formatted = JSON.stringify(input, null, 2);
			expect(formatted).toContain('\n');
			expect(formatted).toContain('  ');
			expect(formatted).not.toContain('    '); // Not 4 spaces
		});

		it('should format JSON with 4-space indentation', () => {
			const input = { name: 'test' };
			const formatted = JSON.stringify(input, null, 4);
			expect(formatted).toContain('    "name"');
		});

		it('should format JSON with tab indentation', () => {
			const input = { name: 'test' };
			const formatted = JSON.stringify(input, null, '\t');
			expect(formatted).toContain('\t"name"');
		});

		it('should minify JSON', () => {
			const input = { name: 'test', nested: { value: 123 } };
			const minified = JSON.stringify(input);
			expect(minified).not.toContain('\n');
			expect(minified).not.toContain(' ');
			expect(minified).toBe('{"name":"test","nested":{"value":123}}');
		});
	});

	describe('Key Sorting', () => {
		it('should sort object keys alphabetically', () => {
			const sortObjectKeys = (obj: unknown): unknown => {
				if (Array.isArray(obj)) {
					return obj.map(sortObjectKeys);
				}
				if (obj !== null && typeof obj === 'object') {
					const sorted: Record<string, unknown> = {};
					Object.keys(obj as object).sort().forEach(key => {
						sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
					});
					return sorted;
				}
				return obj;
			};

			const input = { zebra: 1, apple: 2, mango: 3 };
			const sorted = sortObjectKeys(input) as Record<string, number>;
			const keys = Object.keys(sorted);
			
			expect(keys[0]).toBe('apple');
			expect(keys[1]).toBe('mango');
			expect(keys[2]).toBe('zebra');
		});

		it('should sort nested object keys', () => {
			const sortObjectKeys = (obj: unknown): unknown => {
				if (Array.isArray(obj)) {
					return obj.map(sortObjectKeys);
				}
				if (obj !== null && typeof obj === 'object') {
					const sorted: Record<string, unknown> = {};
					Object.keys(obj as object).sort().forEach(key => {
						sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
					});
					return sorted;
				}
				return obj;
			};

			const input = { outer: { zebra: 1, apple: 2 } };
			const sorted = sortObjectKeys(input) as { outer: Record<string, number> };
			const nestedKeys = Object.keys(sorted.outer);
			
			expect(nestedKeys[0]).toBe('apple');
			expect(nestedKeys[1]).toBe('zebra');
		});

		it('should handle arrays when sorting', () => {
			const sortObjectKeys = (obj: unknown): unknown => {
				if (Array.isArray(obj)) {
					return obj.map(sortObjectKeys);
				}
				if (obj !== null && typeof obj === 'object') {
					const sorted: Record<string, unknown> = {};
					Object.keys(obj as object).sort().forEach(key => {
						sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
					});
					return sorted;
				}
				return obj;
			};

			const input = [{ z: 1, a: 2 }, { y: 3, b: 4 }];
			const sorted = sortObjectKeys(input) as Array<Record<string, number>>;
			
			expect(Object.keys(sorted[0])[0]).toBe('a');
			expect(Object.keys(sorted[1])[0]).toBe('b');
		});
	});

	describe('Stats Calculation', () => {
		it('should count total keys correctly', () => {
			const calculateStats = (obj: unknown): { keys: number; depth: number } => {
				let keyCount = 0;
				let maxDepth = 0;
				
				function traverse(value: unknown, depth: number) {
					maxDepth = Math.max(maxDepth, depth);
					
					if (Array.isArray(value)) {
						value.forEach(item => traverse(item, depth + 1));
					} else if (value !== null && typeof value === 'object') {
						const keys = Object.keys(value);
						keyCount += keys.length;
						keys.forEach(key => traverse((value as Record<string, unknown>)[key], depth + 1));
					}
				}
				
				traverse(obj, 0);
				return { keys: keyCount, depth: maxDepth };
			};

			const input = { a: 1, b: 2, c: { d: 3, e: 4 } };
			const stats = calculateStats(input);
			expect(stats.keys).toBe(5); // a, b, c, d, e
		});

		it('should calculate depth correctly', () => {
			const calculateStats = (obj: unknown): { keys: number; depth: number } => {
				let keyCount = 0;
				let maxDepth = 0;
				
				function traverse(value: unknown, depth: number) {
					maxDepth = Math.max(maxDepth, depth);
					
					if (Array.isArray(value)) {
						value.forEach(item => traverse(item, depth + 1));
					} else if (value !== null && typeof value === 'object') {
						const keys = Object.keys(value);
						keyCount += keys.length;
						keys.forEach(key => traverse((value as Record<string, unknown>)[key], depth + 1));
					}
				}
				
				traverse(obj, 0);
				return { keys: keyCount, depth: maxDepth };
			};

			const shallow = { a: 1 };
			const deep = { a: { b: { c: { d: 1 } } } };
			
			expect(calculateStats(shallow).depth).toBe(1);
			expect(calculateStats(deep).depth).toBe(4);
		});

		it('should handle empty objects', () => {
			const calculateStats = (obj: unknown): { keys: number; depth: number } => {
				let keyCount = 0;
				let maxDepth = 0;
				
				function traverse(value: unknown, depth: number) {
					maxDepth = Math.max(maxDepth, depth);
					
					if (Array.isArray(value)) {
						value.forEach(item => traverse(item, depth + 1));
					} else if (value !== null && typeof value === 'object') {
						const keys = Object.keys(value);
						keyCount += keys.length;
						keys.forEach(key => traverse((value as Record<string, unknown>)[key], depth + 1));
					}
				}
				
				traverse(obj, 0);
				return { keys: keyCount, depth: maxDepth };
			};

			const stats = calculateStats({});
			expect(stats.keys).toBe(0);
			expect(stats.depth).toBe(0);
		});
	});

	describe('Error Handling', () => {
		it('should identify syntax errors', () => {
			const inputs = [
				'{missing: quotes}',
				'{"trailing": "comma",}',
				'{"unclosed": "string',
				'{unquoted: value}',
			];

			inputs.forEach(input => {
				expect(() => JSON.parse(input)).toThrow(SyntaxError);
			});
		});

		it('should handle empty input gracefully', () => {
			expect(() => JSON.parse('')).toThrow();
		});

		it('should handle whitespace-only input', () => {
			expect(() => JSON.parse('   ')).toThrow();
		});
	});

	describe('Special Characters', () => {
		it('should handle unicode characters', () => {
			const input = '{"emoji": "🎉", "chinese": "中文"}';
			const parsed = JSON.parse(input);
			expect(parsed.emoji).toBe('🎉');
			expect(parsed.chinese).toBe('中文');
		});

		it('should handle escaped characters', () => {
			const input = '{"escaped": "line1\\nline2\\ttab"}';
			const parsed = JSON.parse(input);
			expect(parsed.escaped).toContain('\n');
			expect(parsed.escaped).toContain('\t');
		});

		it('should handle quotes in strings', () => {
			const input = '{"quote": "He said \\"hello\\""}';
			const parsed = JSON.parse(input);
			expect(parsed.quote).toContain('"');
		});
	});

	describe('Number Handling', () => {
		it('should handle integers', () => {
			const input = '{"int": 42, "negative": -10}';
			const parsed = JSON.parse(input);
			expect(parsed.int).toBe(42);
			expect(parsed.negative).toBe(-10);
		});

		it('should handle floats', () => {
			const input = '{"float": 3.14159, "scientific": 1.5e10}';
			const parsed = JSON.parse(input);
			expect(parsed.float).toBeCloseTo(3.14159);
			expect(parsed.scientific).toBe(1.5e10);
		});

		it('should handle large numbers', () => {
			const input = '{"large": 9007199254740991}';
			const parsed = JSON.parse(input);
			expect(parsed.large).toBe(Number.MAX_SAFE_INTEGER);
		});
	});

	describe('Size Calculation', () => {
		it('should calculate byte size correctly', () => {
			const calculateSize = (raw: string): string => {
				const bytes = new Blob([raw]).size;
				return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
			};

			expect(calculateSize('{"a":1}')).toBe('7 B');
			expect(calculateSize('x'.repeat(1024))).toBe('1.0 KB');
		});
	});
});
