<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface HslColor {
		h: number;
		s: number;
		l: number;
	}

	interface PaletteColor {
		hex: string;
		hsl: HslColor;
		label: string;
	}

	interface Palette {
		mode: string;
		colors: PaletteColor[];
	}

	const MODES = [
		{ id: 'complementary', label: 'Complementary' },
		{ id: 'analogous', label: 'Analogous' },
		{ id: 'triadic', label: 'Triadic' },
		{ id: 'split-complementary', label: 'Split Compl.' },
		{ id: 'tetradic', label: 'Tetradic' },
		{ id: 'monochromatic', label: 'Monochromatic' },
	];

	let baseHex = $state('#5865f2');
	let selectedMode = $state('analogous');
	let palette = $state<Palette | null>(null);
	let error = $state<string | null>(null);
	let copiedIdx = $state<number | null>(null);

	onMount(() => {
		generate();
	});

	async function generate() {
		error = null;
		try {
			palette = await invoke<Palette>('palette_generate', { hex: baseHex, mode: selectedMode });
		} catch (e) {
			error = String(e);
		}
	}

	function onColorInput(e: Event) {
		baseHex = (e.target as HTMLInputElement).value;
		generate();
	}

	function onHexInput(e: Event) {
		const val = (e.target as HTMLInputElement).value.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(val)) {
			baseHex = val;
			generate();
		}
	}

	function selectMode(mode: string) {
		selectedMode = mode;
		generate();
	}

	async function copyHex(hex: string, idx: number) {
		try {
			await navigator.clipboard.writeText(hex);
			copiedIdx = idx;
			setTimeout(() => { if (copiedIdx === idx) copiedIdx = null; }, 1200);
		} catch {
			// fallback: use Tauri clipboard
			try {
				await invoke('clipboard_write_text', { text: hex });
				copiedIdx = idx;
				setTimeout(() => { if (copiedIdx === idx) copiedIdx = null; }, 1200);
			} catch {}
		}
	}

	function contrastColor(hex: string): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return lum > 0.5 ? '#1e1f22' : '#ffffff';
	}

	function formatHsl(hsl: HslColor): string {
		return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
	}
</script>

<div class="palette-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F3A8;</span>
			<h3>Color Palette</h3>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="color-input-row">
		<input type="color" value={baseHex} oninput={onColorInput} class="color-picker" />
		<input
			type="text"
			value={baseHex}
			oninput={onHexInput}
			class="hex-input"
			maxlength="7"
			placeholder="#5865f2"
		/>
	</div>

	<div class="mode-tabs">
		{#each MODES as mode}
			<button
				class="mode-tab"
				class:active={selectedMode === mode.id}
				onclick={() => selectMode(mode.id)}
			>{mode.label}</button>
		{/each}
	</div>

	{#if palette}
		<div class="swatches">
			{#each palette.colors as color, i}
				<button
					class="swatch"
					style="background: {color.hex}; color: {contrastColor(color.hex)}"
					onclick={() => copyHex(color.hex, i)}
					title="Click to copy {color.hex}"
				>
					<span class="swatch-hex">{copiedIdx === i ? 'Copied!' : color.hex}</span>
					<span class="swatch-label">{color.label}</span>
					<span class="swatch-hsl">{formatHsl(color.hsl)}</span>
				</button>
			{/each}
		</div>

		<div class="palette-strip">
			{#each palette.colors as color}
				<div class="strip-cell" style="background: {color.hex}"></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.palette-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.error { font-size: 12px; color: #ed4245; }

	.color-input-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.color-picker {
		width: 40px;
		height: 34px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		padding: 0;
		background: none;
	}
	.color-picker::-webkit-color-swatch-wrapper { padding: 0; }
	.color-picker::-webkit-color-swatch { border: 2px solid var(--border, #3f4147); border-radius: 6px; }

	.hex-input {
		flex: 1;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-family: monospace;
		font-size: 14px;
	}
	.hex-input:focus {
		outline: none;
		border-color: #5865f2;
	}

	.mode-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.mode-tab {
		padding: 5px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.mode-tab:hover {
		border-color: #5865f2;
		color: #5865f2;
	}
	.mode-tab.active {
		background: #5865f2;
		border-color: #5865f2;
		color: white;
	}

	.swatches {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.swatch {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: transform 0.1s ease, box-shadow 0.15s ease;
		text-align: left;
	}
	.swatch:hover {
		transform: scale(1.01);
		box-shadow: 0 2px 8px rgba(0,0,0,0.3);
	}
	.swatch:active {
		transform: scale(0.99);
	}
	.swatch-hex {
		font-family: monospace;
		font-size: 13px;
		font-weight: 700;
		min-width: 72px;
	}
	.swatch-label {
		font-size: 11px;
		opacity: 0.85;
		flex: 1;
	}
	.swatch-hsl {
		font-size: 10px;
		font-family: monospace;
		opacity: 0.7;
	}

	.palette-strip {
		display: flex;
		border-radius: 6px;
		overflow: hidden;
		height: 32px;
	}
	.strip-cell {
		flex: 1;
		transition: flex 0.2s ease;
	}
	.strip-cell:hover {
		flex: 2;
	}
</style>
