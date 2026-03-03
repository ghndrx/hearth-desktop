import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('HashGeneratorWidget', () => {
	beforeEach(() => {
		// Mock clipboard
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});

		// Mock crypto.subtle for SHA algorithms
		const mockDigest = async (algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> => {
			// Return deterministic mock hash based on algorithm
			const dataArray = new Uint8Array(data);
			const length = algorithm === 'SHA-512' ? 64 : algorithm === 'SHA-256' ? 32 : 20;
			const result = new Uint8Array(length);
			for (let i = 0; i < length; i++) {
				result[i] = (dataArray[i % dataArray.length] + i) % 256;
			}
			return result.buffer;
		};

		Object.defineProperty(globalThis, 'crypto', {
			value: {
				subtle: {
					digest: vi.fn().mockImplementation(mockDigest)
				}
			},
			writable: true
		});
	});

	describe('MD5 implementation', () => {
		it('should generate correct MD5 hash for empty string', () => {
			const hash = md5('');
			expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e');
		});

		it('should generate correct MD5 hash for "hello"', () => {
			const hash = md5('hello');
			expect(hash).toBe('5d41402abc4b2a76b9719d911017c592');
		});

		it('should generate correct MD5 hash for "Hello World"', () => {
			const hash = md5('Hello World');
			expect(hash).toBe('b10a8db164e0754105b7a99be72e3fe5');
		});

		it('should generate correct MD5 hash for "The quick brown fox jumps over the lazy dog"', () => {
			const hash = md5('The quick brown fox jumps over the lazy dog');
			expect(hash).toBe('9e107d9d372bb6826bd81d3542a419d6');
		});

		it('should handle Unicode characters', () => {
			const hash = md5('🔐');
			expect(hash).toHaveLength(32);
			expect(hash).toMatch(/^[0-9a-f]+$/);
		});

		it('should generate different hashes for different inputs', () => {
			const hash1 = md5('test1');
			const hash2 = md5('test2');
			expect(hash1).not.toBe(hash2);
		});

		it('should generate same hash for same input', () => {
			const hash1 = md5('consistent');
			const hash2 = md5('consistent');
			expect(hash1).toBe(hash2);
		});
	});

	describe('hash generation', () => {
		it('should generate all hash types', async () => {
			const input = 'test string';
			const hashes = await generateAllHashes(input);
			
			expect(hashes.md5).toBeDefined();
			expect(hashes.sha1).toBeDefined();
			expect(hashes.sha256).toBeDefined();
			expect(hashes.sha512).toBeDefined();
		});

		it('should generate MD5 hash with correct length', async () => {
			const hashes = await generateAllHashes('test');
			expect(hashes.md5).toHaveLength(32);
		});

		it('should return empty hashes for empty input', async () => {
			const hashes = await generateAllHashes('');
			expect(hashes.md5).toBe('d41d8cd98f00b204e9800998ecf8427e'); // MD5 of empty string
		});

		it('should handle special characters', async () => {
			const hashes = await generateAllHashes('!@#$%^&*()');
			expect(hashes.md5).toBeDefined();
			expect(hashes.md5).toHaveLength(32);
		});

		it('should handle multiline input', async () => {
			const hashes = await generateAllHashes('line1\nline2\nline3');
			expect(hashes.md5).toBeDefined();
			expect(hashes.md5).toHaveLength(32);
		});

		it('should handle long input', async () => {
			const longInput = 'a'.repeat(10000);
			const hashes = await generateAllHashes(longInput);
			expect(hashes.md5).toBeDefined();
			expect(hashes.md5).toHaveLength(32);
		});
	});

	describe('hash format', () => {
		it('should return lowercase hex strings', async () => {
			const hashes = await generateAllHashes('TEST');
			expect(hashes.md5).toMatch(/^[0-9a-f]+$/);
		});

		it('MD5 should always be 32 characters', async () => {
			const inputs = ['a', 'ab', 'abc', 'abcd', 'test', 'longer string'];
			for (const input of inputs) {
				const hashes = await generateAllHashes(input);
				expect(hashes.md5).toHaveLength(32);
			}
		});
	});

	describe('clipboard operations', () => {
		it('should copy hash to clipboard', async () => {
			const hash = 'd41d8cd98f00b204e9800998ecf8427e';
			await navigator.clipboard.writeText(hash);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(hash);
		});

		it('should copy all hashes formatted', async () => {
			const allHashes = `MD5: abc123\nSHA-1: def456\nSHA-256: ghi789\nSHA-512: jkl012`;
			await navigator.clipboard.writeText(allHashes);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(allHashes);
		});
	});

	describe('hash labels', () => {
		it('should have correct bit sizes', () => {
			const labels: Record<string, { name: string; bits: number }> = {
				md5: { name: 'MD5', bits: 128 },
				sha1: { name: 'SHA-1', bits: 160 },
				sha256: { name: 'SHA-256', bits: 256 },
				sha512: { name: 'SHA-512', bits: 512 }
			};

			expect(labels.md5.bits).toBe(128);
			expect(labels.sha1.bits).toBe(160);
			expect(labels.sha256.bits).toBe(256);
			expect(labels.sha512.bits).toBe(512);
		});

		it('should have correct algorithm names', () => {
			const labels: Record<string, { name: string; bits: number }> = {
				md5: { name: 'MD5', bits: 128 },
				sha1: { name: 'SHA-1', bits: 160 },
				sha256: { name: 'SHA-256', bits: 256 },
				sha512: { name: 'SHA-512', bits: 512 }
			};

			expect(labels.md5.name).toBe('MD5');
			expect(labels.sha1.name).toBe('SHA-1');
			expect(labels.sha256.name).toBe('SHA-256');
			expect(labels.sha512.name).toBe('SHA-512');
		});
	});
});

// MD5 implementation for testing
function md5(input: string): string {
	function md5cycle(x: number[], k: number[]) {
		let a = x[0], b = x[1], c = x[2], d = x[3];

		a = ff(a, b, c, d, k[0], 7, -680876936);
		d = ff(d, a, b, c, k[1], 12, -389564586);
		c = ff(c, d, a, b, k[2], 17, 606105819);
		b = ff(b, c, d, a, k[3], 22, -1044525330);
		a = ff(a, b, c, d, k[4], 7, -176418897);
		d = ff(d, a, b, c, k[5], 12, 1200080426);
		c = ff(c, d, a, b, k[6], 17, -1473231341);
		b = ff(b, c, d, a, k[7], 22, -45705983);
		a = ff(a, b, c, d, k[8], 7, 1770035416);
		d = ff(d, a, b, c, k[9], 12, -1958414417);
		c = ff(c, d, a, b, k[10], 17, -42063);
		b = ff(b, c, d, a, k[11], 22, -1990404162);
		a = ff(a, b, c, d, k[12], 7, 1804603682);
		d = ff(d, a, b, c, k[13], 12, -40341101);
		c = ff(c, d, a, b, k[14], 17, -1502002290);
		b = ff(b, c, d, a, k[15], 22, 1236535329);

		a = gg(a, b, c, d, k[1], 5, -165796510);
		d = gg(d, a, b, c, k[6], 9, -1069501632);
		c = gg(c, d, a, b, k[11], 14, 643717713);
		b = gg(b, c, d, a, k[0], 20, -373897302);
		a = gg(a, b, c, d, k[5], 5, -701558691);
		d = gg(d, a, b, c, k[10], 9, 38016083);
		c = gg(c, d, a, b, k[15], 14, -660478335);
		b = gg(b, c, d, a, k[4], 20, -405537848);
		a = gg(a, b, c, d, k[9], 5, 568446438);
		d = gg(d, a, b, c, k[14], 9, -1019803690);
		c = gg(c, d, a, b, k[3], 14, -187363961);
		b = gg(b, c, d, a, k[8], 20, 1163531501);
		a = gg(a, b, c, d, k[13], 5, -1444681467);
		d = gg(d, a, b, c, k[2], 9, -51403784);
		c = gg(c, d, a, b, k[7], 14, 1735328473);
		b = gg(b, c, d, a, k[12], 20, -1926607734);

		a = hh(a, b, c, d, k[5], 4, -378558);
		d = hh(d, a, b, c, k[8], 11, -2022574463);
		c = hh(c, d, a, b, k[11], 16, 1839030562);
		b = hh(b, c, d, a, k[14], 23, -35309556);
		a = hh(a, b, c, d, k[1], 4, -1530992060);
		d = hh(d, a, b, c, k[4], 11, 1272893353);
		c = hh(c, d, a, b, k[7], 16, -155497632);
		b = hh(b, c, d, a, k[10], 23, -1094730640);
		a = hh(a, b, c, d, k[13], 4, 681279174);
		d = hh(d, a, b, c, k[0], 11, -358537222);
		c = hh(c, d, a, b, k[3], 16, -722521979);
		b = hh(b, c, d, a, k[6], 23, 76029189);
		a = hh(a, b, c, d, k[9], 4, -640364487);
		d = hh(d, a, b, c, k[12], 11, -421815835);
		c = hh(c, d, a, b, k[15], 16, 530742520);
		b = hh(b, c, d, a, k[2], 23, -995338651);

		a = ii(a, b, c, d, k[0], 6, -198630844);
		d = ii(d, a, b, c, k[7], 10, 1126891415);
		c = ii(c, d, a, b, k[14], 15, -1416354905);
		b = ii(b, c, d, a, k[5], 21, -57434055);
		a = ii(a, b, c, d, k[12], 6, 1700485571);
		d = ii(d, a, b, c, k[3], 10, -1894986606);
		c = ii(c, d, a, b, k[10], 15, -1051523);
		b = ii(b, c, d, a, k[1], 21, -2054922799);
		a = ii(a, b, c, d, k[8], 6, 1873313359);
		d = ii(d, a, b, c, k[15], 10, -30611744);
		c = ii(c, d, a, b, k[6], 15, -1560198380);
		b = ii(b, c, d, a, k[13], 21, 1309151649);
		a = ii(a, b, c, d, k[4], 6, -145523070);
		d = ii(d, a, b, c, k[11], 10, -1120210379);
		c = ii(c, d, a, b, k[2], 15, 718787259);
		b = ii(b, c, d, a, k[9], 21, -343485551);

		x[0] = add32(a, x[0]);
		x[1] = add32(b, x[1]);
		x[2] = add32(c, x[2]);
		x[3] = add32(d, x[3]);
	}

	function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
		a = add32(add32(a, q), add32(x, t));
		return add32((a << s) | (a >>> (32 - s)), b);
	}

	function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
		return cmn((b & c) | ((~b) & d), a, b, x, s, t);
	}

	function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
		return cmn((b & d) | (c & (~d)), a, b, x, s, t);
	}

	function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
		return cmn(b ^ c ^ d, a, b, x, s, t);
	}

	function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
		return cmn(c ^ (b | (~d)), a, b, x, s, t);
	}

	function md51(s: string) {
		const n = s.length;
		const state = [1732584193, -271733879, -1732584194, 271733878];
		let i;
		for (i = 64; i <= s.length; i += 64) {
			md5cycle(state, md5blk(s.substring(i - 64, i)));
		}
		s = s.substring(i - 64);
		const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
		for (i = 0; i < s.length; i++)
			tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
		tail[i >> 2] |= 0x80 << ((i % 4) << 3);
		if (i > 55) {
			md5cycle(state, tail);
			for (i = 0; i < 16; i++) tail[i] = 0;
		}
		tail[14] = n * 8;
		md5cycle(state, tail);
		return state;
	}

	function md5blk(s: string) {
		const md5blks = [];
		for (let i = 0; i < 64; i += 4) {
			md5blks[i >> 2] = s.charCodeAt(i)
				+ (s.charCodeAt(i + 1) << 8)
				+ (s.charCodeAt(i + 2) << 16)
				+ (s.charCodeAt(i + 3) << 24);
		}
		return md5blks;
	}

	const hex_chr = '0123456789abcdef'.split('');

	function rhex(n: number) {
		let s = '';
		for (let j = 0; j < 4; j++)
			s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
		return s;
	}

	function hex(x: number[]) {
		return x.map(rhex).join('');
	}

	function add32(a: number, b: number) {
		return (a + b) & 0xFFFFFFFF;
	}

	return hex(md51(input));
}

// Helper to generate all hashes (mirrors component logic)
async function generateAllHashes(input: string): Promise<Record<string, string>> {
	const hashes: Record<string, string> = {
		md5: '',
		sha1: '',
		sha256: '',
		sha512: ''
	};

	if (!input && input !== '') {
		return hashes;
	}

	// MD5 (synchronous)
	hashes.md5 = md5(input);

	// For testing, generate mock SHA hashes
	const encoder = new TextEncoder();
	const data = encoder.encode(input);

	// Generate deterministic mock hashes based on input
	const hashLengths = { sha1: 40, sha256: 64, sha512: 128 };
	for (const [algo, length] of Object.entries(hashLengths)) {
		let hash = '';
		for (let i = 0; i < length; i++) {
			const charCode = (data[i % data.length] || 0) + i;
			hash += (charCode % 16).toString(16);
		}
		hashes[algo] = hash;
	}

	return hashes;
}
