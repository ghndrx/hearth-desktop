import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MarkdownTableGeneratorWidget', () => {
	beforeEach(() => {
		Object.assign(navigator, {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined)
			}
		});
	});

	describe('Markdown table generation', () => {
		function createGrid(rows: number, cols: number): string[][] {
			return Array.from({ length: rows }, (_, ri) =>
				Array.from({ length: cols }, (_, ci) => {
					if (ri === 0) return `Header ${ci + 1}`;
					return '';
				})
			);
		}

		function generateMarkdown(
			cells: string[][],
			alignments: ('left' | 'center' | 'right')[]
		): string {
			if (cells.length === 0 || cells[0].length === 0) return '';

			const cols = cells[0].length;
			const colWidths = Array.from({ length: cols }, (_, ci) => {
				let max = 3;
				for (const row of cells) {
					max = Math.max(max, (row[ci] || '').length);
				}
				return max;
			});

			const lines: string[] = [];

			const headerCells = cells[0].map((cell, ci) => {
				return ` ${(cell || '').padEnd(colWidths[ci])} `;
			});
			lines.push(`|${headerCells.join('|')}|`);

			const separatorCells = colWidths.map((w, ci) => {
				const align = alignments[ci];
				const dashes = '-'.repeat(w);
				if (align === 'center') return `:${dashes}:`;
				if (align === 'right') return ` ${dashes}:`;
				return `:${dashes} `;
			});
			lines.push(`|${separatorCells.join('|')}|`);

			for (let ri = 1; ri < cells.length; ri++) {
				const rowCells = cells[ri].map((cell, ci) => {
					return ` ${(cell || '').padEnd(colWidths[ci])} `;
				});
				lines.push(`|${rowCells.join('|')}|`);
			}

			return lines.join('\n');
		}

		it('should generate a 3x3 table with default headers', () => {
			const cells = createGrid(3, 3);
			const alignments: ('left' | 'center' | 'right')[] = ['left', 'left', 'left'];
			const md = generateMarkdown(cells, alignments);

			expect(md).toContain('| Header 1');
			expect(md).toContain('| Header 2');
			expect(md).toContain('| Header 3');
			expect(md.split('\n')).toHaveLength(4); // header + separator + 2 data rows
		});

		it('should generate correct separator for left alignment', () => {
			const cells = createGrid(2, 1);
			const alignments: ('left' | 'center' | 'right')[] = ['left'];
			const md = generateMarkdown(cells, alignments);
			const lines = md.split('\n');

			expect(lines[1]).toMatch(/^\|:[-]+ \|$/);
		});

		it('should generate correct separator for center alignment', () => {
			const cells = createGrid(2, 1);
			const alignments: ('left' | 'center' | 'right')[] = ['center'];
			const md = generateMarkdown(cells, alignments);
			const lines = md.split('\n');

			expect(lines[1]).toMatch(/^\|:[-]+:\|$/);
		});

		it('should generate correct separator for right alignment', () => {
			const cells = createGrid(2, 1);
			const alignments: ('left' | 'center' | 'right')[] = ['right'];
			const md = generateMarkdown(cells, alignments);
			const lines = md.split('\n');

			expect(lines[1]).toMatch(/^\| [-]+:\|$/);
		});

		it('should handle cells with content', () => {
			const cells = [
				['Name', 'Age'],
				['Alice', '30'],
				['Bob', '25']
			];
			const alignments: ('left' | 'center' | 'right')[] = ['left', 'right'];
			const md = generateMarkdown(cells, alignments);

			expect(md).toContain('Alice');
			expect(md).toContain('Bob');
			expect(md).toContain('30');
			expect(md).toContain('25');
		});

		it('should pad columns to consistent widths', () => {
			const cells = [
				['A', 'Longer Header'],
				['Short', 'X']
			];
			const alignments: ('left' | 'center' | 'right')[] = ['left', 'left'];
			const md = generateMarkdown(cells, alignments);
			const lines = md.split('\n');

			// All lines should have the same number of | characters
			const pipeCount = lines[0].split('|').length;
			lines.forEach(line => {
				expect(line.split('|').length).toBe(pipeCount);
			});
		});

		it('should return empty string for empty cells array', () => {
			expect(generateMarkdown([], ['left'])).toBe('');
		});

		it('should handle single column table', () => {
			const cells = [['Title'], ['Data']];
			const alignments: ('left' | 'center' | 'right')[] = ['left'];
			const md = generateMarkdown(cells, alignments);

			expect(md.split('\n')).toHaveLength(3);
			expect(md).toContain('Title');
			expect(md).toContain('Data');
		});

		it('should handle mixed alignments', () => {
			const cells = createGrid(2, 3);
			const alignments: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
			const md = generateMarkdown(cells, alignments);
			const separator = md.split('\n')[1];

			// Left: starts with :, no trailing :
			// Center: starts and ends with :
			// Right: ends with :, no leading :
			const parts = separator.split('|').filter(Boolean);
			expect(parts[0]).toMatch(/^:[-]+ $/);
			expect(parts[1]).toMatch(/^:[-]+:$/);
			expect(parts[2]).toMatch(/^ [-]+:$/);
		});
	});

	describe('Grid creation', () => {
		function createGrid(rows: number, cols: number): string[][] {
			return Array.from({ length: rows }, (_, ri) =>
				Array.from({ length: cols }, (_, ci) => {
					if (ri === 0) return `Header ${ci + 1}`;
					return '';
				})
			);
		}

		it('should create grid with correct dimensions', () => {
			const grid = createGrid(4, 5);
			expect(grid).toHaveLength(4);
			grid.forEach(row => expect(row).toHaveLength(5));
		});

		it('should set header row with default labels', () => {
			const grid = createGrid(2, 3);
			expect(grid[0]).toEqual(['Header 1', 'Header 2', 'Header 3']);
		});

		it('should set data rows as empty strings', () => {
			const grid = createGrid(3, 2);
			expect(grid[1]).toEqual(['', '']);
			expect(grid[2]).toEqual(['', '']);
		});
	});
});
