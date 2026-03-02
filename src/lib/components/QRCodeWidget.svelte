<script lang="ts">
	import { onMount } from 'svelte';

	// Props
	let { compact = false }: { compact?: boolean } = $props();

	// State
	let inputText = $state('');
	let qrSize = $state(200);
	let errorCorrection = $state<'L' | 'M' | 'Q' | 'H'>('M');
	let foregroundColor = $state('#000000');
	let backgroundColor = $state('#ffffff');
	let copied = $state(false);
	let history = $state<string[]>([]);
	let showHistory = $state(false);
	let qrCanvas: HTMLCanvasElement | null = null;
	let qrError = $state('');

	// QR Code generation using qr-code-styling approach (simplified)
	// This implements a basic QR code encoder
	
	const ERROR_CORRECTION_LEVEL = {
		L: 1, // 7% recovery
		M: 0, // 15% recovery
		Q: 3, // 25% recovery
		H: 2  // 30% recovery
	};

	// Alphanumeric mode encoding table
	const ALPHANUMERIC_TABLE: Record<string, number> = {};
	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'.split('').forEach((c, i) => {
		ALPHANUMERIC_TABLE[c] = i;
	});

	// QR Code Version capacities (simplified for versions 1-10)
	const VERSION_CAPACITY = [
		0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271
	];

	function getVersion(length: number): number {
		for (let v = 1; v <= 10; v++) {
			if (length <= VERSION_CAPACITY[v]) return v;
		}
		return 10; // Max version we support
	}

	// Generate QR code matrix using a simplified algorithm
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
			
			// Add alignment pattern for version 2+
			if (version >= 2) {
				const alignPos = getAlignmentPosition(version);
				addAlignmentPattern(matrix, alignPos, alignPos);
			}
			
			// Add format information
			addFormatInfo(matrix, ERROR_CORRECTION_LEVEL[errorCorrection]);
			
			// Add data (simplified placement)
			placeData(matrix, data, size);
			
			// Apply mask pattern
			applyMask(matrix, 0);
			
			return matrix;
		} catch {
			return null;
		}
	}

	function encodeData(text: string): number[] {
		const data: number[] = [];
		// Byte mode indicator
		data.push(0, 1, 0, 0);
		
		// Character count (8 bits for version 1-9)
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

	function addAlignmentPattern(matrix: number[][], row: number, col: number): void {
		const pattern = [
			[1, 1, 1, 1, 1],
			[1, 0, 0, 0, 1],
			[1, 0, 1, 0, 1],
			[1, 0, 0, 0, 1],
			[1, 1, 1, 1, 1]
		];
		
		for (let r = -2; r <= 2; r++) {
			for (let c = -2; c <= 2; c++) {
				if (matrix[row + r][col + c] === -1) {
					matrix[row + r][col + c] = pattern[r + 2][c + 2];
				}
			}
		}
	}

	function getAlignmentPosition(version: number): number {
		return version * 4 + 10;
	}

	function addFormatInfo(matrix: number[][], ecLevel: number): void {
		// Simplified format info (using mask 0)
		const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
		const size = matrix.length;
		
		for (let i = 0; i < 6; i++) {
			matrix[8][i] = formatBits[i];
			matrix[i][8] = formatBits[14 - i];
		}
		matrix[8][7] = formatBits[6];
		matrix[8][8] = formatBits[7];
		matrix[7][8] = formatBits[8];
		
		for (let i = 0; i < 7; i++) {
			matrix[8][size - 1 - i] = formatBits[i];
			matrix[size - 1 - i][8] = formatBits[14 - i];
		}
		matrix[size - 8][8] = 1; // Dark module
	}

	function placeData(matrix: number[][], data: number[], size: number): void {
		let dataIndex = 0;
		let up = true;
		
		for (let col = size - 1; col > 0; col -= 2) {
			if (col === 6) col = 5; // Skip timing pattern
			
			const rows = up ? 
				Array.from({ length: size }, (_, i) => size - 1 - i) :
				Array.from({ length: size }, (_, i) => i);
			
			for (const row of rows) {
				for (const c of [col, col - 1]) {
					if (matrix[row][c] === -1) {
						matrix[row][c] = dataIndex < data.length ? data[dataIndex++] : 0;
					}
				}
			}
			up = !up;
		}
	}

	function applyMask(matrix: number[][], pattern: number): void {
		const size = matrix.length;
		
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				// Skip reserved modules
				if (isReserved(row, col, size)) continue;
				
				let shouldFlip = false;
				switch (pattern) {
					case 0: shouldFlip = (row + col) % 2 === 0; break;
					case 1: shouldFlip = row % 2 === 0; break;
					case 2: shouldFlip = col % 3 === 0; break;
					default: shouldFlip = (row + col) % 2 === 0;
				}
				
				if (shouldFlip && matrix[row][col] !== -1) {
					matrix[row][col] ^= 1;
				}
			}
		}
	}

	function isReserved(row: number, col: number, size: number): boolean {
		// Finder patterns + separators
		if (row < 9 && col < 9) return true;
		if (row < 9 && col >= size - 8) return true;
		if (row >= size - 8 && col < 9) return true;
		// Timing patterns
		if (row === 6 || col === 6) return true;
		return false;
	}

	function renderQR(): void {
		if (!qrCanvas || !inputText) {
			qrError = '';
			return;
		}
		
		const matrix = generateQRMatrix(inputText);
		if (!matrix) {
			qrError = 'Failed to generate QR code';
			return;
		}
		
		qrError = '';
		const ctx = qrCanvas.getContext('2d');
		if (!ctx) return;
		
		const moduleSize = Math.floor(qrSize / matrix.length);
		const actualSize = moduleSize * matrix.length;
		qrCanvas.width = actualSize;
		qrCanvas.height = actualSize;
		
		// Background
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, actualSize, actualSize);
		
		// Modules
		ctx.fillStyle = foregroundColor;
		for (let row = 0; row < matrix.length; row++) {
			for (let col = 0; col < matrix.length; col++) {
				if (matrix[row][col] === 1) {
					ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
				}
			}
		}
	}

	async function copyAsImage(): Promise<void> {
		if (!qrCanvas) return;
		
		try {
			qrCanvas.toBlob(async (blob) => {
				if (blob) {
					const item = new ClipboardItem({ 'image/png': blob });
					await navigator.clipboard.write([item]);
					copied = true;
					setTimeout(() => copied = false, 2000);
				}
			});
		} catch (err) {
			console.error('Failed to copy image:', err);
		}
	}

	function downloadQR(): void {
		if (!qrCanvas) return;
		
		const link = document.createElement('a');
		link.download = `qrcode-${Date.now()}.png`;
		link.href = qrCanvas.toDataURL('image/png');
		link.click();
	}

	function addToHistory(): void {
		if (!inputText || history.includes(inputText)) return;
		history = [inputText, ...history.slice(0, 9)];
		saveHistory();
	}

	function loadHistory(): void {
		try {
			const saved = localStorage.getItem('hearth-qr-history');
			if (saved) history = JSON.parse(saved);
		} catch (err) {
			console.error('Failed to load history:', err);
		}
	}

	function saveHistory(): void {
		try {
			localStorage.setItem('hearth-qr-history', JSON.stringify(history));
		} catch (err) {
			console.error('Failed to save history:', err);
		}
	}

	function clearHistory(): void {
		history = [];
		saveHistory();
	}

	function useHistoryItem(text: string): void {
		inputText = text;
		showHistory = false;
		renderQR();
	}

	$effect(() => {
		if (inputText) {
			renderQR();
		}
	});

	onMount(() => {
		loadHistory();
	});
</script>

<div class="qr-generator" class:compact>
	{#if compact}
		<!-- Compact mode -->
		<div class="compact-header">
			<span class="icon">📱</span>
			<span class="title">QR Code</span>
		</div>
		
		<input 
			type="text" 
			class="compact-input"
			placeholder="Enter text or URL..."
			bind:value={inputText}
			oninput={() => renderQR()}
		/>
		
		{#if inputText}
			<div class="compact-qr">
				<canvas bind:this={qrCanvas}></canvas>
			</div>
			<div class="compact-actions">
				<button onclick={copyAsImage} title="Copy">
					{copied ? '✓' : '📋'}
				</button>
				<button onclick={downloadQR} title="Download">
					💾
				</button>
			</div>
		{:else}
			<div class="placeholder">Enter text to generate</div>
		{/if}
	{:else}
		<!-- Full mode -->
		<div class="header">
			<h3>📱 QR Code Generator</h3>
			<button class="history-toggle" onclick={() => showHistory = !showHistory}>
				{showHistory ? '⬅️' : '📜'}
			</button>
		</div>

		{#if showHistory}
			<div class="history-panel">
				<div class="history-header">
					<span>Recent QR Codes</span>
					<button onclick={clearHistory} class="clear-btn">Clear</button>
				</div>
				<div class="history-list">
					{#each history as text}
						<button type="button" class="history-item" onclick={() => useHistoryItem(text)}>
							<span>{text.slice(0, 30)}{text.length > 30 ? '...' : ''}</span>
						</button>
					{:else}
						<div class="empty">No history</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="input-section">
				<textarea 
					class="qr-input"
					placeholder="Enter text, URL, or any data..."
					bind:value={inputText}
					oninput={() => renderQR()}
					onblur={addToHistory}
					rows="3"
				></textarea>
			</div>

			<div class="qr-display">
				{#if inputText}
					<canvas bind:this={qrCanvas}></canvas>
					{#if qrError}
						<div class="error">{qrError}</div>
					{/if}
				{:else}
					<div class="placeholder-large">
						<span class="placeholder-icon">📱</span>
						<span>Enter text to generate QR code</span>
					</div>
				{/if}
			</div>

			<div class="options">
				<div class="option-row">
					<label for="qr-size">Size</label>
					<select id="qr-size" bind:value={qrSize} onchange={() => renderQR()}>
						<option value={150}>Small (150px)</option>
						<option value={200}>Medium (200px)</option>
						<option value={300}>Large (300px)</option>
						<option value={400}>XL (400px)</option>
					</select>
				</div>
				
				<div class="option-row">
					<label for="qr-error">Error Correction</label>
					<select id="qr-error" bind:value={errorCorrection} onchange={() => renderQR()}>
						<option value="L">Low (7%)</option>
						<option value="M">Medium (15%)</option>
						<option value="Q">Quartile (25%)</option>
						<option value="H">High (30%)</option>
					</select>
				</div>
				
				<div class="color-options">
					<div class="color-picker">
						<label for="fg-color">Foreground</label>
						<input id="fg-color" type="color" bind:value={foregroundColor} onchange={() => renderQR()} />
					</div>
					<div class="color-picker">
						<label for="bg-color">Background</label>
						<input id="bg-color" type="color" bind:value={backgroundColor} onchange={() => renderQR()} />
					</div>
				</div>
			</div>

			<div class="actions">
				<button onclick={copyAsImage} class="action-btn" class:copied disabled={!inputText}>
					{copied ? '✓ Copied!' : '📋 Copy Image'}
				</button>
				<button onclick={downloadQR} class="action-btn download" disabled={!inputText}>
					💾 Download
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.qr-generator {
		background: var(--bg-tertiary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
	}

	.qr-generator.compact {
		padding: 8px;
	}

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

	.compact-input {
		width: 100%;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 6px 8px;
		color: var(--text-primary, #dcddde);
		font-size: 11px;
		outline: none;
		margin-bottom: 8px;
		box-sizing: border-box;
	}

	.compact-input:focus {
		border-color: var(--brand-color, #5865f2);
	}

	.compact-qr {
		display: flex;
		justify-content: center;
		margin-bottom: 8px;
	}

	.compact-qr canvas {
		max-width: 100%;
		height: auto;
		border-radius: 4px;
	}

	.compact-actions {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.compact-actions button {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 4px 12px;
		cursor: pointer;
		font-size: 12px;
	}

	.compact-actions button:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.placeholder {
		text-align: center;
		color: var(--text-muted, #72767d);
		font-size: 11px;
		padding: 12px;
	}

	/* Full mode styles */
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

	.history-toggle {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 14px;
		padding: 4px;
	}

	.history-toggle:hover {
		opacity: 0.8;
	}

	.input-section {
		margin-bottom: 12px;
	}

	.qr-input {
		width: 100%;
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 10px;
		color: var(--text-primary, #dcddde);
		font-size: 13px;
		outline: none;
		resize: vertical;
		box-sizing: border-box;
		font-family: inherit;
	}

	.qr-input:focus {
		border-color: var(--brand-color, #5865f2);
	}

	.qr-display {
		display: flex;
		justify-content: center;
		align-items: center;
		background: var(--bg-secondary, #36393f);
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 12px;
		min-height: 150px;
	}

	.qr-display canvas {
		border-radius: 4px;
	}

	.placeholder-large {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		color: var(--text-muted, #72767d);
	}

	.placeholder-icon {
		font-size: 32px;
		opacity: 0.5;
	}

	.error {
		color: #ed4245;
		font-size: 12px;
		text-align: center;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 12px;
	}

	.option-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.option-row label {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.option-row select {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		padding: 4px 8px;
		color: var(--text-primary, #dcddde);
		font-size: 12px;
		outline: none;
		cursor: pointer;
	}

	.color-options {
		display: flex;
		gap: 16px;
	}

	.color-picker {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.color-picker label {
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.color-picker input[type="color"] {
		width: 28px;
		height: 28px;
		border: 1px solid var(--border-color, #202225);
		border-radius: 4px;
		cursor: pointer;
		padding: 2px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		flex: 1;
		background: var(--brand-color, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		padding: 10px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--brand-color-hover, #4752c4);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.copied {
		background: #3ba55d;
	}

	.action-btn.download {
		background: var(--bg-secondary, #36393f);
		border: 1px solid var(--border-color, #202225);
		color: var(--text-primary, #dcddde);
	}

	.action-btn.download:hover:not(:disabled) {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	/* History panel */
	.history-panel {
		height: 200px;
		display: flex;
		flex-direction: column;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 12px;
		color: var(--text-secondary, #8e9297);
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-link, #00aff4);
		cursor: pointer;
		font-size: 11px;
	}

	.clear-btn:hover {
		text-decoration: underline;
	}

	.history-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.history-item {
		width: 100%;
		background: var(--bg-secondary, #36393f);
		border: none;
		border-radius: 4px;
		padding: 8px 10px;
		cursor: pointer;
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-primary, #dcddde);
		text-align: left;
	}

	.history-item:hover {
		background: var(--bg-modifier-hover, #3c3f45);
	}

	.empty {
		text-align: center;
		color: var(--text-muted, #72767d);
		font-size: 12px;
		padding: 20px;
	}
</style>
