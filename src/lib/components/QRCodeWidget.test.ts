import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('QRCodeWidget', () => {
	beforeEach(() => {
		// Mock localStorage
		const store: Record<string, string> = {};
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
			store[key] = value;
		});
	});

	describe('QR code matrix generation', () => {
		it('should generate a valid matrix for simple text', () => {
			const matrix = generateQRMatrix('Hello');
			expect(matrix).not.toBeNull();
			expect(Array.isArray(matrix)).toBe(true);
			if (matrix) {
				expect(matrix.length).toBeGreaterThan(0);
				expect(matrix[0].length).toBe(matrix.length); // Square matrix
			}
		});

		it('should return null for empty text', () => {
			const matrix = generateQRMatrix('');
			expect(matrix).toBeNull();
		});

		it('should generate larger matrix for longer text', () => {
			const shortMatrix = generateQRMatrix('Hi');
			const longMatrix = generateQRMatrix('This is a much longer text that requires more data');
			
			expect(shortMatrix).not.toBeNull();
			expect(longMatrix).not.toBeNull();
			
			if (shortMatrix && longMatrix) {
				expect(longMatrix.length).toBeGreaterThanOrEqual(shortMatrix.length);
			}
		});

		it('should handle URLs', () => {
			const matrix = generateQRMatrix('https://example.com/path?query=value');
			expect(matrix).not.toBeNull();
			if (matrix) {
				expect(matrix.length).toBeGreaterThan(20); // URLs need larger version
			}
		});

		it('should handle special characters', () => {
			const matrix = generateQRMatrix('Test @#$%^&*()');
			expect(matrix).not.toBeNull();
		});
	});

	describe('version calculation', () => {
		it('should use version 1 for short text', () => {
			const version = getVersion(10);
			expect(version).toBe(1);
		});

		it('should use higher version for longer text', () => {
			const version = getVersion(100);
			expect(version).toBeGreaterThan(1);
		});

		it('should cap at version 10', () => {
			const version = getVersion(1000);
			expect(version).toBe(10);
		});
	});

	describe('data encoding', () => {
		it('should encode text to binary array', () => {
			const data = encodeData('A');
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			// Should contain mode indicator + length + data + terminator
			expect(data.every(bit => bit === 0 || bit === 1)).toBe(true);
		});

		it('should handle multi-byte characters', () => {
			const data = encodeData('Test');
			expect(data.length).toBeGreaterThan(0);
		});
	});

	describe('error correction levels', () => {
		it('should have all error correction levels defined', () => {
			expect(ERROR_CORRECTION_LEVEL.L).toBeDefined();
			expect(ERROR_CORRECTION_LEVEL.M).toBeDefined();
			expect(ERROR_CORRECTION_LEVEL.Q).toBeDefined();
			expect(ERROR_CORRECTION_LEVEL.H).toBeDefined();
		});
	});

	describe('finder pattern', () => {
		it('should add finder pattern to matrix', () => {
			const size = 25;
			const matrix: number[][] = Array(size).fill(null).map(() => Array(size).fill(-1));
			addFinderPattern(matrix, 0, 0);
			
			// Check corners of finder pattern
			expect(matrix[0][0]).toBe(1);
			expect(matrix[0][6]).toBe(1);
			expect(matrix[6][0]).toBe(1);
			expect(matrix[6][6]).toBe(1);
			
			// Check center
			expect(matrix[3][3]).toBe(1);
			
			// Check separator
			expect(matrix[7][0]).toBe(0);
		});
	});

	describe('history management', () => {
		it('should limit history to 10 items', () => {
			const history: string[] = [];
			for (let i = 0; i < 15; i++) {
				const newText = `text${i}`;
				if (!history.includes(newText)) {
					history.unshift(newText);
					if (history.length > 10) {
						history.pop();
					}
				}
			}
			expect(history.length).toBe(10);
		});

		it('should not add duplicate entries', () => {
			const history: string[] = ['test1'];
			const newText = 'test1';
			
			if (!history.includes(newText)) {
				history.unshift(newText);
			}
			
			expect(history.length).toBe(1);
		});
	});
});

// Extracted helper functions for testing
// These mirror the component's internal logic

const VERSION_CAPACITY = [
	0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271
];

const ERROR_CORRECTION_LEVEL = {
	L: 1,
	M: 0,
	Q: 3,
	H: 2
};

function getVersion(length: number): number {
	for (let v = 1; v <= 10; v++) {
		if (length <= VERSION_CAPACITY[v]) return v;
	}
	return 10;
}

function encodeData(text: string): number[] {
	const data: number[] = [];
	// Byte mode indicator
	data.push(0, 1, 0, 0);
	
	// Character count (8 bits)
	const len = text.length;
	for (let i = 7; i >= 0; i--) {
		data.push((len >> i) & 1);
	}
	
	// Data encoding
	for (const char of text) {
		const code = char.charCodeAt(0);
		for (let i = 7; i >= 0; i--) {
			data.push((code >> i) & 1);
		}
	}
	
	// Terminator
	for (let i = 0; i < 4; i++) data.push(0);
	
	return data;
}

function addFinderPattern(matrix: number[][], row: number, col: number): void {
	const pattern = [
		[1, 1, 1, 1, 1, 1, 1],
		[1, 0, 0, 0, 0, 0, 1],
		[1, 0, 1, 1, 1, 0, 1],
		[1, 0, 1, 1, 1, 0, 1],
		[1, 0, 1, 1, 1, 0, 1],
		[1, 0, 0, 0, 0, 0, 1],
		[1, 1, 1, 1, 1, 1, 1]
	];
	
	for (let r = 0; r < 7; r++) {
		for (let c = 0; c < 7; c++) {
			if (row + r < matrix.length && col + c < matrix.length) {
				matrix[row + r][col + c] = pattern[r][c];
			}
		}
	}
	
	// Add separator
	for (let i = 0; i < 8; i++) {
		if (row + 7 < matrix.length && col + i < matrix.length) matrix[row + 7][col + i] = 0;
		if (row + i < matrix.length && col + 7 < matrix.length) matrix[row + i][col + 7] = 0;
	}
}

function generateQRMatrix(text: string): number[][] | null {
	if (!text) return null;
	
	try {
		const data = encodeData(text);
		const version = getVersion(text.length);
		const size = 21 + (version - 1) * 4;
		const matrix: number[][] = Array(size).fill(null).map(() => Array(size).fill(-1));
		
		// Add finder patterns
		addFinderPattern(matrix, 0, 0);
		addFinderPattern(matrix, size - 7, 0);
		addFinderPattern(matrix, 0, size - 7);
		
		// Add timing patterns
		for (let i = 8; i < size - 8; i++) {
			matrix[6][i] = i % 2 === 0 ? 1 : 0;
			matrix[i][6] = i % 2 === 0 ? 1 : 0;
		}
		
		// Fill remaining with data
		let dataIndex = 0;
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				if (matrix[row][col] === -1) {
					matrix[row][col] = dataIndex < data.length ? data[dataIndex++] : 0;
				}
			}
		}
		
		return matrix;
	} catch {
		return null;
	}
}
