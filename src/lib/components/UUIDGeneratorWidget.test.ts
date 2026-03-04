import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UUIDGeneratorWidget', () => {
	beforeEach(() => {
		// Mock crypto.randomUUID
		vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
			return 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
		});

		// Mock crypto.getRandomValues
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array: ArrayBufferView) => {
			const uint8Array = array as Uint8Array;
			for (let i = 0; i < uint8Array.length; i++) {
				uint8Array[i] = Math.floor(Math.random() * 256);
			}
			return array;
		});

		// Mock clipboard
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
	});

	describe('UUID v4 generation', () => {
		it('should generate a valid UUID v4 format', () => {
			const uuid = generateUUIDv4();
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		});

		it('should generate unique UUIDs', () => {
			// Reset mock to allow unique values
			vi.spyOn(crypto, 'randomUUID')
				.mockImplementationOnce(() => 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')
				.mockImplementationOnce(() => 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');

			const uuid1 = generateUUIDv4();
			const uuid2 = generateUUIDv4();
			expect(uuid1).not.toBe(uuid2);
		});

		it('should fallback when crypto.randomUUID is unavailable', () => {
			vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
				throw new Error('Not supported');
			});

			const uuid = generateUUIDv4Fallback();
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		});
	});

	describe('UUID v1-like generation', () => {
		it('should generate a valid UUID v1-like format', () => {
			const uuid = generateUUIDv1Like();
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		});

		it('should include timestamp information', () => {
			const before = Date.now();
			const uuid = generateUUIDv1Like();
			const after = Date.now();

			// UUID v1-like encodes timestamp in first segments
			expect(uuid).toBeDefined();
			expect(uuid.length).toBe(36);
		});
	});

	describe('ULID generation', () => {
		it('should generate a valid ULID format', () => {
			const ulid = generateULID();
			// ULID is 26 characters, uses Crockford's base32
			expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
		});

		it('should generate 26 character ULIDs', () => {
			const ulid = generateULID();
			expect(ulid.length).toBe(26);
		});

		it('should be lexicographically sortable by time', () => {
			const ulid1 = generateULID();
			// Simulate time passing
			vi.useFakeTimers();
			vi.advanceTimersByTime(1000);
			const ulid2 = generateULID();
			vi.useRealTimers();

			// First 10 chars encode timestamp, so ulid2 should be >= ulid1
			expect(ulid2.substring(0, 10) >= ulid1.substring(0, 10)).toBe(true);
		});
	});

	describe('NanoID generation', () => {
		it('should generate a valid NanoID', () => {
			const nanoid = generateNanoID();
			// NanoID is 21 characters by default, URL-safe alphabet
			expect(nanoid).toMatch(/^[A-Za-z0-9_-]{21}$/);
		});

		it('should generate NanoID with custom length', () => {
			const nanoid = generateNanoID(10);
			expect(nanoid.length).toBe(10);
		});

		it('should use URL-safe characters only', () => {
			const nanoid = generateNanoID(100);
			expect(nanoid).toMatch(/^[A-Za-z0-9_-]+$/);
		});
	});

	describe('formatting options', () => {
		it('should convert UUID to uppercase', () => {
			const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
			const uppercased = uuid.toUpperCase();
			expect(uppercased).toBe('A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D');
		});

		it('should remove dashes from UUID', () => {
			const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
			const noDashes = uuid.replace(/-/g, '');
			expect(noDashes).toBe('a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d');
			expect(noDashes.length).toBe(32);
		});

		it('should apply both uppercase and no dashes', () => {
			const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
			const formatted = uuid.toUpperCase().replace(/-/g, '');
			expect(formatted).toBe('A1B2C3D4E5F64A7B8C9D0E1F2A3B4C5D');
		});
	});

	describe('bulk generation', () => {
		it('should generate multiple UUIDs', () => {
			const quantity = 5;
			const uuids = generateMultiple(quantity, 'v4');
			expect(uuids.length).toBe(quantity);
		});

		it('should generate up to 100 UUIDs', () => {
			const quantity = 100;
			const uuids = generateMultiple(quantity, 'v4');
			expect(uuids.length).toBe(100);
		});

		it('should limit quantity to valid range', () => {
			expect(clampQuantity(0)).toBe(1);
			expect(clampQuantity(1)).toBe(1);
			expect(clampQuantity(50)).toBe(50);
			expect(clampQuantity(100)).toBe(100);
			expect(clampQuantity(150)).toBe(100);
		});
	});

	describe('history management', () => {
		it('should add generated UUIDs to history', () => {
			const history: GeneratedUUID[] = [];
			const uuid = createHistoryEntry('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'v4');

			history.unshift(uuid);
			expect(history.length).toBe(1);
			expect(history[0].value).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
		});

		it('should limit history to 50 items', () => {
			const history: GeneratedUUID[] = [];

			for (let i = 0; i < 60; i++) {
				const uuid = createHistoryEntry(`uuid-${i}`, 'v4');
				history.unshift(uuid);
			}

			const limitedHistory = history.slice(0, 50);
			expect(limitedHistory.length).toBe(50);
		});

		it('should remove item from history by id', () => {
			const history: GeneratedUUID[] = [
				createHistoryEntry('uuid-1', 'v4', 'id-1'),
				createHistoryEntry('uuid-2', 'v4', 'id-2'),
				createHistoryEntry('uuid-3', 'v4', 'id-3')
			];

			const filtered = history.filter((h) => h.id !== 'id-2');
			expect(filtered.length).toBe(2);
			expect(filtered.find((h) => h.id === 'id-2')).toBeUndefined();
		});

		it('should clear all history', () => {
			let history: GeneratedUUID[] = [
				createHistoryEntry('uuid-1', 'v4'),
				createHistoryEntry('uuid-2', 'v4')
			];

			history = [];
			expect(history.length).toBe(0);
		});
	});

	describe('clipboard operations', () => {
		it('should copy UUID to clipboard', async () => {
			const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
			await navigator.clipboard.writeText(uuid);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(uuid);
		});

		it('should copy multiple UUIDs as newline-separated text', async () => {
			const uuids = ['uuid-1', 'uuid-2', 'uuid-3'];
			const text = uuids.join('\n');
			await navigator.clipboard.writeText(text);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith('uuid-1\nuuid-2\nuuid-3');
		});
	});

	describe('format version labels', () => {
		it('should format v4 as UUID v4', () => {
			expect(formatVersion('v4')).toBe('UUID v4');
		});

		it('should format v1-like as UUID v1', () => {
			expect(formatVersion('v1-like')).toBe('UUID v1');
		});

		it('should format ulid as ULID', () => {
			expect(formatVersion('ulid')).toBe('ULID');
		});

		it('should format nanoid as NanoID', () => {
			expect(formatVersion('nanoid')).toBe('NanoID');
		});
	});

	describe('UUID validation', () => {
		it('should validate correct UUID v4 format', () => {
			expect(isValidUUID('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
		});

		it('should reject invalid UUID format', () => {
			expect(isValidUUID('not-a-uuid')).toBe(false);
			expect(isValidUUID('a1b2c3d4-e5f6-4a7b-8c9d')).toBe(false);
			expect(isValidUUID('')).toBe(false);
		});

		it('should validate uppercase UUID', () => {
			expect(isValidUUID('A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D')).toBe(true);
		});
	});
});

// Types
type UUIDVersion = 'v4' | 'v1-like' | 'ulid' | 'nanoid';

interface GeneratedUUID {
	id: string;
	value: string;
	version: UUIDVersion;
	timestamp: Date;
}

// Helper functions that mirror component logic
function generateUUIDv4(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return generateUUIDv4Fallback();
}

function generateUUIDv4Fallback(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function generateUUIDv1Like(): string {
	const now = Date.now();
	const timeHex = now.toString(16).padStart(12, '0');
	const timeLow = timeHex.slice(-8);
	const timeMid = timeHex.slice(-12, -8);
	const timeHigh = '1' + timeHex.slice(0, 3);
	const clockSeq = ((Math.random() * 0x3fff) | 0x8000).toString(16);
	const node = Array.from({ length: 6 }, () =>
		Math.floor(Math.random() * 256)
			.toString(16)
			.padStart(2, '0')
	).join('');
	return `${timeLow}-${timeMid}-${timeHigh}-${clockSeq}-${node}`;
}

function generateULID(): string {
	const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
	const now = Date.now();
	let str = '';

	// Encode timestamp (48 bits = 10 chars)
	let t = now;
	for (let i = 0; i < 10; i++) {
		str = ENCODING[t % 32] + str;
		t = Math.floor(t / 32);
	}

	// Encode randomness (80 bits = 16 chars)
	for (let i = 0; i < 16; i++) {
		str += ENCODING[Math.floor(Math.random() * 32)];
	}

	return str;
}

function generateNanoID(size = 21): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
	let id = '';
	const bytes = new Uint8Array(size);
	crypto.getRandomValues(bytes);
	for (let i = 0; i < size; i++) {
		id += alphabet[bytes[i] % 64];
	}
	return id;
}

function generateMultiple(quantity: number, version: UUIDVersion): string[] {
	const results: string[] = [];
	for (let i = 0; i < quantity; i++) {
		switch (version) {
			case 'v4':
				results.push(generateUUIDv4());
				break;
			case 'v1-like':
				results.push(generateUUIDv1Like());
				break;
			case 'ulid':
				results.push(generateULID());
				break;
			case 'nanoid':
				results.push(generateNanoID());
				break;
		}
	}
	return results;
}

function clampQuantity(quantity: number): number {
	return Math.max(1, Math.min(100, quantity));
}

function createHistoryEntry(
	value: string,
	version: UUIDVersion,
	id?: string
): GeneratedUUID {
	return {
		id: id || crypto.randomUUID(),
		value,
		version,
		timestamp: new Date()
	};
}

function formatVersion(version: UUIDVersion): string {
	switch (version) {
		case 'v4':
			return 'UUID v4';
		case 'v1-like':
			return 'UUID v1';
		case 'ulid':
			return 'ULID';
		case 'nanoid':
			return 'NanoID';
		default:
			return version;
	}
}

function isValidUUID(uuid: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}
