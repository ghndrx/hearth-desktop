<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	// Color state
	let currentColor = $state('#3b82f6');
	let hexInput = $state('#3b82f6');
	let rgb = $state({ r: 59, g: 130, b: 246 });
	let hsl = $state({ h: 217, s: 91, l: 60 });
	let savedColors = $state<string[]>([]);
	let showCopyToast = $state(false);
	let copiedFormat = $state('');
	let activeTab = $state<'picker' | 'palette' | 'saved'>('picker');

	// Predefined color palettes
	const palettes = {
		tailwind: [
			'#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
			'#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
			'#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
			'#ec4899', '#f43f5e'
		],
		material: [
			'#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
			'#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
			'#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
			'#ff5722', '#795548'
		],
		pastel: [
			'#ffd1dc', '#ffb3ba', '#bae1ff', '#baffc9', '#ffffba',
			'#ffdfba', '#e0bbe4', '#d4a5a5', '#a8d8ea', '#aa96da',
			'#fcbad3', '#ffffd2', '#b5ead7', '#c7ceea', '#ffdac1'
		],
		grayscale: [
			'#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666',
			'#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6',
			'#f5f5f5', '#ffffff'
		]
	};

	let activePalette = $state<keyof typeof palettes>('tailwind');

	onMount(() => {
		loadSavedColors();
	});

	function loadSavedColors(): void {
		const saved = localStorage.getItem('colorPickerWidget_savedColors');
		if (saved) {
			savedColors = JSON.parse(saved);
		}
	}

	function saveSavedColors(): void {
		localStorage.setItem('colorPickerWidget_savedColors', JSON.stringify(savedColors));
	}

	function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	function rgbToHex(r: number, g: number, b: number): string {
		return '#' + [r, g, b].map(x => {
			const hex = Math.round(x).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		}).join('');
	}

	function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
		r /= 255;
		g /= 255;
		b /= 255;

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

		return {
			h: Math.round(h * 360),
			s: Math.round(s * 100),
			l: Math.round(l * 100)
		};
	}

	function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
		h /= 360;
		s /= 100;
		l /= 100;

		let r: number, g: number, b: number;

		if (s === 0) {
			r = g = b = l;
		} else {
			const hue2rgb = (p: number, q: number, t: number) => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};

			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;

			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}

		return {
			r: Math.round(r * 255),
			g: Math.round(g * 255),
			b: Math.round(b * 255)
		};
	}

	function updateFromHex(hex: string): void {
		if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
			currentColor = hex;
			hexInput = hex;
			const newRgb = hexToRgb(hex);
			if (newRgb) {
				rgb = newRgb;
				hsl = rgbToHsl(newRgb.r, newRgb.g, newRgb.b);
			}
		}
	}

	function updateFromRgb(): void {
		const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
		currentColor = hex;
		hexInput = hex;
		hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
	}

	function updateFromHsl(): void {
		const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
		rgb = newRgb;
		const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
		currentColor = hex;
		hexInput = hex;
	}

	function handleHexInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		let value = target.value;
		if (!value.startsWith('#')) {
			value = '#' + value;
		}
		hexInput = value;
		if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
			updateFromHex(value);
		}
	}

	function handleColorPickerChange(e: Event): void {
		const target = e.target as HTMLInputElement;
		updateFromHex(target.value);
	}

	async function copyToClipboard(text: string, format: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copiedFormat = format;
			showCopyToast = true;
			setTimeout(() => {
				showCopyToast = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function saveColor(): void {
		if (!savedColors.includes(currentColor)) {
			savedColors = [...savedColors, currentColor];
			saveSavedColors();
		}
	}

	function removeSavedColor(color: string): void {
		savedColors = savedColors.filter(c => c !== color);
		saveSavedColors();
	}

	function selectColor(color: string): void {
		updateFromHex(color);
	}

	function getContrastColor(hex: string): string {
		const rgbVal = hexToRgb(hex);
		if (!rgbVal) return '#000000';
		const luminance = (0.299 * rgbVal.r + 0.587 * rgbVal.g + 0.114 * rgbVal.b) / 255;
		return luminance > 0.5 ? '#000000' : '#ffffff';
	}

	function generateComplementary(): string {
		const newH = (hsl.h + 180) % 360;
		const newRgb = hslToRgb(newH, hsl.s, hsl.l);
		return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
	}

	function generateAnalogous(): string[] {
		return [
			rgbToHex(...Object.values(hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l)) as [number, number, number]),
			currentColor,
			rgbToHex(...Object.values(hslToRgb((hsl.h - 30 + 360) % 360, hsl.s, hsl.l)) as [number, number, number])
		];
	}

	function generateTriadic(): string[] {
		return [
			currentColor,
			rgbToHex(...Object.values(hslToRgb((hsl.h + 120) % 360, hsl.s, hsl.l)) as [number, number, number]),
			rgbToHex(...Object.values(hslToRgb((hsl.h + 240) % 360, hsl.s, hsl.l)) as [number, number, number])
		];
	}
</script>

<div class="color-picker-widget">
	<div class="widget-header">
		<span class="widget-title">🎨 Color Picker</span>
		<div class="tab-buttons">
			<button
				class="tab-btn"
				class:active={activeTab === 'picker'}
				onclick={() => activeTab = 'picker'}
			>
				Pick
			</button>
			<button
				class="tab-btn"
				class:active={activeTab === 'palette'}
				onclick={() => activeTab = 'palette'}
			>
				Palettes
			</button>
			<button
				class="tab-btn"
				class:active={activeTab === 'saved'}
				onclick={() => activeTab = 'saved'}
			>
				Saved
			</button>
		</div>
	</div>

	{#if activeTab === 'picker'}
		<div class="picker-section">
			<div class="color-preview-row">
				<div
					class="color-preview"
					style="background-color: {currentColor}"
				>
					<span style="color: {getContrastColor(currentColor)}">{currentColor}</span>
				</div>
				<input
					type="color"
					value={currentColor}
					oninput={handleColorPickerChange}
					class="native-picker"
				/>
				<button class="save-btn" onclick={saveColor} title="Save color">
					💾
				</button>
			</div>

			<div class="input-section">
				<label class="input-row">
					<span class="label">HEX</span>
					<input
						type="text"
						value={hexInput}
						oninput={handleHexInput}
						class="color-input"
						maxlength="7"
					/>
					<button class="copy-btn" onclick={() => copyToClipboard(currentColor, 'HEX')}>📋</button>
				</label>

				<label class="input-row">
					<span class="label">RGB</span>
					<div class="rgb-inputs">
						<input
							type="number"
							min="0"
							max="255"
							bind:value={rgb.r}
							oninput={updateFromRgb}
							class="small-input"
						/>
						<input
							type="number"
							min="0"
							max="255"
							bind:value={rgb.g}
							oninput={updateFromRgb}
							class="small-input"
						/>
						<input
							type="number"
							min="0"
							max="255"
							bind:value={rgb.b}
							oninput={updateFromRgb}
							class="small-input"
						/>
					</div>
					<button class="copy-btn" onclick={() => copyToClipboard(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, 'RGB')}>📋</button>
				</label>

				<label class="input-row">
					<span class="label">HSL</span>
					<div class="hsl-inputs">
						<input
							type="number"
							min="0"
							max="360"
							bind:value={hsl.h}
							oninput={updateFromHsl}
							class="small-input"
						/>
						<input
							type="number"
							min="0"
							max="100"
							bind:value={hsl.s}
							oninput={updateFromHsl}
							class="small-input"
						/>
						<input
							type="number"
							min="0"
							max="100"
							bind:value={hsl.l}
							oninput={updateFromHsl}
							class="small-input"
						/>
					</div>
					<button class="copy-btn" onclick={() => copyToClipboard(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, 'HSL')}>📋</button>
				</label>
			</div>

			<div class="harmony-section">
				<span class="harmony-label">Color Harmony</span>
				<div class="harmony-row">
					<div class="harmony-group">
						<span class="harmony-type">Complementary</span>
						<div class="harmony-colors">
							<button
								class="harmony-swatch"
								style="background-color: {currentColor}"
								onclick={() => selectColor(currentColor)}
							></button>
							<button
								class="harmony-swatch"
								style="background-color: {generateComplementary()}"
								onclick={() => selectColor(generateComplementary())}
							></button>
						</div>
					</div>
					<div class="harmony-group">
						<span class="harmony-type">Triadic</span>
						<div class="harmony-colors">
							{#each generateTriadic() as color}
								<button
									class="harmony-swatch"
									style="background-color: {color}"
									onclick={() => selectColor(color)}
								></button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'palette'}
		<div class="palette-section">
			<div class="palette-tabs">
				{#each Object.keys(palettes) as palette}
					<button
						class="palette-tab"
						class:active={activePalette === palette}
						onclick={() => activePalette = palette as keyof typeof palettes}
					>
						{palette}
					</button>
				{/each}
			</div>
			<div class="palette-grid">
				{#each palettes[activePalette] as color}
					<button
						class="palette-swatch"
						style="background-color: {color}"
						onclick={() => selectColor(color)}
						title={color}
					></button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="saved-section">
			{#if savedColors.length === 0}
				<p class="empty-text">No saved colors yet. Pick a color and click 💾 to save it.</p>
			{:else}
				<div class="saved-grid">
					{#each savedColors as color}
						<div class="saved-color-item">
							<button
								class="saved-swatch"
								style="background-color: {color}"
								onclick={() => selectColor(color)}
								title={color}
							></button>
							<button class="remove-btn" onclick={() => removeSavedColor(color)}>×</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if showCopyToast}
		<div class="copy-toast">
			Copied {copiedFormat}!
		</div>
	{/if}
</div>

<style>
	.color-picker-widget {
		padding: 12px;
		background: var(--bg-secondary, #2a2a2a);
		border-radius: 8px;
		position: relative;
	}

	.widget-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.widget-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #ffffff);
	}

	.tab-buttons {
		display: flex;
		gap: 4px;
	}

	.tab-btn {
		flex: 1;
		padding: 6px 8px;
		border: none;
		background: var(--bg-tertiary, #3a3a3a);
		color: var(--text-secondary, #aaaaaa);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.tab-btn:hover {
		background: var(--bg-hover, #444444);
	}

	.tab-btn.active {
		background: var(--accent-color, #3b82f6);
		color: white;
	}

	.picker-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.color-preview-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.color-preview {
		flex: 1;
		height: 48px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: monospace;
		font-size: 14px;
		font-weight: 600;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.native-picker {
		width: 48px;
		height: 48px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		padding: 0;
	}

	.native-picker::-webkit-color-swatch-wrapper {
		padding: 0;
	}

	.native-picker::-webkit-color-swatch {
		border: none;
		border-radius: 6px;
	}

	.save-btn {
		width: 40px;
		height: 40px;
		border: none;
		background: var(--bg-tertiary, #3a3a3a);
		border-radius: 6px;
		cursor: pointer;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.save-btn:hover {
		background: var(--bg-hover, #444444);
	}

	.input-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.input-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.label {
		width: 36px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #aaaaaa);
	}

	.color-input {
		flex: 1;
		padding: 6px 8px;
		border: 1px solid var(--border-color, #444444);
		background: var(--bg-tertiary, #3a3a3a);
		color: var(--text-primary, #ffffff);
		border-radius: 4px;
		font-family: monospace;
		font-size: 12px;
	}

	.rgb-inputs,
	.hsl-inputs {
		flex: 1;
		display: flex;
		gap: 4px;
	}

	.small-input {
		flex: 1;
		padding: 6px 4px;
		border: 1px solid var(--border-color, #444444);
		background: var(--bg-tertiary, #3a3a3a);
		color: var(--text-primary, #ffffff);
		border-radius: 4px;
		font-size: 11px;
		text-align: center;
		width: 40px;
	}

	.small-input::-webkit-inner-spin-button,
	.small-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.copy-btn {
		width: 32px;
		height: 32px;
		border: none;
		background: var(--bg-tertiary, #3a3a3a);
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.copy-btn:hover {
		background: var(--bg-hover, #444444);
	}

	.harmony-section {
		padding-top: 8px;
		border-top: 1px solid var(--border-color, #444444);
	}

	.harmony-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #aaaaaa);
		display: block;
		margin-bottom: 8px;
	}

	.harmony-row {
		display: flex;
		gap: 12px;
	}

	.harmony-group {
		flex: 1;
	}

	.harmony-type {
		font-size: 10px;
		color: var(--text-muted, #888888);
		display: block;
		margin-bottom: 4px;
	}

	.harmony-colors {
		display: flex;
		gap: 4px;
	}

	.harmony-swatch {
		width: 24px;
		height: 24px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.harmony-swatch:hover {
		transform: scale(1.1);
	}

	.palette-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.palette-tabs {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.palette-tab {
		padding: 4px 8px;
		border: none;
		background: var(--bg-tertiary, #3a3a3a);
		color: var(--text-secondary, #aaaaaa);
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
		text-transform: capitalize;
		transition: all 0.2s;
	}

	.palette-tab:hover {
		background: var(--bg-hover, #444444);
	}

	.palette-tab.active {
		background: var(--accent-color, #3b82f6);
		color: white;
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
		gap: 6px;
	}

	.palette-swatch {
		width: 100%;
		aspect-ratio: 1;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.palette-swatch:hover {
		transform: scale(1.15);
		z-index: 1;
	}

	.saved-section {
		min-height: 80px;
	}

	.empty-text {
		font-size: 12px;
		color: var(--text-muted, #888888);
		text-align: center;
		padding: 20px;
	}

	.saved-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
		gap: 8px;
	}

	.saved-color-item {
		position: relative;
	}

	.saved-swatch {
		width: 100%;
		aspect-ratio: 1;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.saved-swatch:hover {
		transform: scale(1.1);
	}

	.remove-btn {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border: none;
		background: #ef4444;
		color: white;
		border-radius: 50%;
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.saved-color-item:hover .remove-btn {
		opacity: 1;
	}

	.copy-toast {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		padding: 6px 12px;
		background: var(--accent-color, #3b82f6);
		color: white;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		animation: fadeInOut 2s ease-in-out;
	}

	@keyframes fadeInOut {
		0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
		15% { opacity: 1; transform: translateX(-50%) translateY(0); }
		85% { opacity: 1; transform: translateX(-50%) translateY(0); }
		100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
	}
</style>
