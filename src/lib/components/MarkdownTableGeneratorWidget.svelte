<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();

	let rows = $state(3);
	let cols = $state(3);
	let cells = $state<string[][]>(createGrid(3, 3));
	let alignments = $state<('left' | 'center' | 'right')[]>(Array(3).fill('left'));
	let copied = $state(false);
	let includeHeader = $state(true);

	function createGrid(r: number, c: number): string[][] {
		return Array.from({ length: r }, (_, ri) =>
			Array.from({ length: c }, (_, ci) => {
				if (ri === 0) return `Header ${ci + 1}`;
				return '';
			})
		);
	}

	function updateDimensions() {
		const newCells = Array.from({ length: rows }, (_, ri) =>
			Array.from({ length: cols }, (_, ci) => {
				if (ri < cells.length && ci < (cells[ri]?.length ?? 0)) {
					return cells[ri][ci];
				}
				if (ri === 0) return `Header ${ci + 1}`;
				return '';
			})
		);
		cells = newCells;

		const newAlignments = Array.from({ length: cols }, (_, ci) =>
			ci < alignments.length ? alignments[ci] : 'left' as const
		);
		alignments = newAlignments;
	}

	function generateMarkdown(): string {
		if (cells.length === 0 || cols === 0) return '';

		const colWidths = Array.from({ length: cols }, (_, ci) => {
			let max = 3;
			for (const row of cells) {
				max = Math.max(max, (row[ci] || '').length);
			}
			return max;
		});

		const lines: string[] = [];

		// Header row
		const headerCells = cells[0].map((cell, ci) => {
			const content = cell || '';
			return ` ${content.padEnd(colWidths[ci])} `;
		});
		lines.push(`|${headerCells.join('|')}|`);

		// Separator row
		const separatorCells = colWidths.map((w, ci) => {
			const align = alignments[ci];
			const dashes = '-'.repeat(w);
			if (align === 'center') return `:${dashes}:`;
			if (align === 'right') return ` ${dashes}:`;
			return `:${dashes} `;
		});
		lines.push(`|${separatorCells.join('|')}|`);

		// Data rows
		for (let ri = 1; ri < cells.length; ri++) {
			const rowCells = cells[ri].map((cell, ci) => {
				const content = cell || '';
				return ` ${content.padEnd(colWidths[ci])} `;
			});
			lines.push(`|${rowCells.join('|')}|`);
		}

		return lines.join('\n');
	}

	async function copyMarkdown() {
		const md = generateMarkdown();
		if (!md) return;
		try {
			await navigator.clipboard.writeText(md);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function cycleAlignment(ci: number) {
		const order: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];
		const current = order.indexOf(alignments[ci]);
		alignments[ci] = order[(current + 1) % 3];
		alignments = [...alignments];
	}

	function addRow() {
		rows++;
		cells = [...cells, Array(cols).fill('')];
	}

	function addColumn() {
		cols++;
		cells = cells.map((row, ri) => [...row, ri === 0 ? `Header ${cols}` : '']);
		alignments = [...alignments, 'left'];
	}

	function removeRow() {
		if (rows <= 2) return;
		rows--;
		cells = cells.slice(0, rows);
	}

	function removeColumn() {
		if (cols <= 1) return;
		cols--;
		cells = cells.map(row => row.slice(0, cols));
		alignments = alignments.slice(0, cols);
	}

	function clearTable() {
		cells = createGrid(rows, cols);
		alignments = Array(cols).fill('left');
	}

	const alignmentIcons: Record<string, string> = {
		left: '\u2190',
		center: '\u2194',
		right: '\u2192'
	};

	let markdownOutput = $derived(generateMarkdown());
</script>

<div class="table-generator" class:compact>
	{#if compact}
		<div class="compact-header">
			<span class="icon">\u{1F4CB}</span>
			<span class="title">Table Generator</span>
		</div>

		<div class="compact-controls">
			<label>
				<span>{rows}x{cols}</span>
			</label>
			<button onclick={addRow} class="mini-btn" title="Add row">+R</button>
			<button onclick={addColumn} class="mini-btn" title="Add column">+C</button>
			<button onclick={copyMarkdown} class="mini-btn copy" class:copied>
				{copied ? '\u2713' : '\u{1F4CB}'}
			</button>
		</div>

		{#if markdownOutput}
			<pre class="compact-preview">{markdownOutput}</pre>
		{/if}
	{:else}
		<div class="header">
			<h3>\u{1F4CB} Markdown Table Generator</h3>
			<div class="header-actions">
				<button onclick={clearTable} class="action-btn" title="Clear table">\u{1F5D1}</button>
				<button onclick={copyMarkdown} class="copy-btn" class:copied>
					{copied ? '\u2713 Copied' : '\u{1F4CB} Copy'}
				</button>
			</div>
		</div>

		<div class="dimension-controls">
			<div class="dim-group">
				<button onclick={removeRow} disabled={rows <= 2} class="dim-btn">\u2212</button>
				<span class="dim-label">{rows} rows</span>
				<button onclick={addRow} class="dim-btn">+</button>
			</div>
			<div class="dim-group">
				<button onclick={removeColumn} disabled={cols <= 1} class="dim-btn">\u2212</button>
				<span class="dim-label">{cols} cols</span>
				<button onclick={addColumn} class="dim-btn">+</button>
			</div>
		</div>

		<div class="table-editor">
			<div class="alignment-row">
				{#each alignments as align, ci}
					<button
						class="align-btn"
						onclick={() => cycleAlignment(ci)}
						title="Alignment: {align}"
					>
						{alignmentIcons[align]}
					</button>
				{/each}
			</div>

			<div class="table-scroll">
				<table>
					<tbody>
						{#each cells as row, ri}
							<tr class:header-row={ri === 0}>
								{#each row as cell, ci}
									<td>
										<input
											type="text"
											value={cell}
											oninput={(e) => {
												cells[ri][ci] = (e.target as HTMLInputElement).value;
												cells = [...cells];
											}}
											placeholder={ri === 0 ? `Col ${ci + 1}` : ''}
											class:header-cell={ri === 0}
										/>
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="output-section">
			<div class="output-header">
				<label>Generated Markdown</label>
			</div>
			<pre class="markdown-output">{markdownOutput}</pre>
		</div>
	{/if}
</div>

<style>
	.table-generator {
		background: var(--bg-tertiary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
	}

	.table-generator.compact {
		padding: 8px;
	}

	/* Compact */
	.compact-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.compact-header .icon {
		font-size: 14px;
	}

	.compact-header .title {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.compact-controls {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 6px;
		font-size: 11px;
	}

	.compact-controls label {
		flex: 1;
		color: var(--text-secondary, #8e9297);
		font-weight: 600;
	}

	.mini-btn {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 2px 6px;
		color: var(--text-secondary, #8e9297);
		cursor: pointer;
		font-size: 10px;
	}

	.mini-btn:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.mini-btn.copy.copied {
		color: #3ba55d;
	}

	.compact-preview {
		background: var(--bg-secondary, #36393f);
		border-radius: 4px;
		padding: 6px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 9px;
		overflow-x: auto;
		white-space: pre;
		margin: 0;
		color: var(--text-primary, #dcddde);
	}

	/* Full mode */
	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.action-btn:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.copy-btn {
		background: var(--brand-color, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 11px;
		transition: background 0.2s;
	}

	.copy-btn:hover {
		background: var(--brand-color-hover, #4752c4);
	}

	.copy-btn.copied {
		background: #3ba55d;
	}

	.dimension-controls {
		display: flex;
		gap: 16px;
		margin-bottom: 12px;
	}

	.dim-group {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.dim-btn {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: var(--text-primary, #dcddde);
		font-size: 14px;
		padding: 0;
	}

	.dim-btn:hover:not(:disabled) {
		background: var(--bg-modifier-hover, #3c3f45);
		border-color: var(--brand-color, #5865f2);
	}

	.dim-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.dim-label {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
		min-width: 45px;
		text-align: center;
	}

	.table-editor {
		margin-bottom: 12px;
	}

	.alignment-row {
		display: flex;
		gap: 2px;
		margin-bottom: 4px;
	}

	.align-btn {
		flex: 1;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px 4px 0 0;
		padding: 4px;
		cursor: pointer;
		color: var(--text-secondary, #8e9297);
		font-size: 12px;
		text-align: center;
	}

	.align-btn:hover {
		background: var(--bg-modifier-hover, #3c3f45);
		color: var(--brand-color, #5865f2);
	}

	.table-scroll {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		border: 1px solid var(--border-color, #202225);
		border-radius: 0 0 4px 4px;
	}

	td {
		padding: 0;
		border: 1px solid var(--border-color, #202225);
	}

	td input {
		width: 100%;
		background: var(--bg-secondary, #36393f);
		border: none;
		padding: 6px 8px;
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	td input:focus {
		background: var(--bg-primary, #36393f);
		box-shadow: inset 0 0 0 1px var(--brand-color, #5865f2);
	}

	td input.header-cell {
		font-weight: 600;
		background: var(--bg-tertiary, #2f3136);
	}

	.header-row td {
		border-bottom: 2px solid var(--brand-color, #5865f2);
	}

	.output-section {
		background: var(--bg-secondary, #36393f);
		border-radius: 6px;
		padding: 10px;
	}

	.output-header {
		margin-bottom: 6px;
	}

	.output-header label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #8e9297);
	}

	.markdown-output {
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		background: var(--bg-tertiary, #2f3136);
		padding: 10px;
		border-radius: 4px;
		overflow-x: auto;
		white-space: pre;
		margin: 0;
		line-height: 1.5;
	}
</style>
