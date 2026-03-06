<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ColorValue {
		hex: string;
		rgb: { r: number; g: number; b: number; a: number };
		hsl: { h: number; s: number; l: number };
		hsv: { h: number; s: number; v: number };
		timestamp: number;
		label: string | null;
	}

	let currentColor = $state<ColorValue | null>(null);
	let history = $state<ColorValue[]>([]);
	let favorites = $state<ColorValue[]>([]);
	let palette = $state<ColorValue[]>([]);
	let hexInput = $state('#FF6B35');
	let paletteType = $state('complementary');
	let copyFormat = $state('hex');
	let error = $state<string | null>(null);
	let copied = $state(false);
	let activeTab = $state<'picker' | 'history' | 'favorites'>('picker');

	const paletteTypes = ['complementary', 'triadic', 'analogous', 'shades', 'tints'];

	onMount(async () => {
		await loadHistory();
		await loadFavorites();
		await parseHexInput();
	});

	async function pickFromScreen() {
		error = null;
		try {
			currentColor = await invoke<ColorValue>('pick_color_at_cursor');
			if (currentColor) {
				hexInput = currentColor.hex;
				await generatePalette();
				await loadHistory();
			}
		} catch (e) {
			error = String(e);
		}
	}

	async function parseHexInput() {
		if (!hexInput.trim()) return;
		try {
			currentColor = await invoke<ColorValue>('parse_color', { input: hexInput });
			await generatePalette();
		} catch (e) {
			error = String(e);
		}
	}

	async function generatePalette() {
		if (!currentColor) return;
		try {
			palette = await invoke<ColorValue[]>('generate_color_palette', {
				hex: currentColor.hex,
				paletteType
			});
		} catch (e) {
			palette = [];
		}
	}

	async function copyColor(color: ColorValue) {
		try {
			await invoke('copy_color_to_clipboard', { color, format: copyFormat });
			copied = true;
			setTimeout(() => copied = false, 1500);
		} catch (e) {
			error = String(e);
		}
	}

	async function addToFavorites(color: ColorValue) {
		try {
			await invoke('add_color_to_favorites', { color });
			await loadFavorites();
		} catch {}
	}

	async function removeFromFavorites(hex: string) {
		try {
			await invoke('remove_color_from_favorites', { hex });
			await loadFavorites();
		} catch {}
	}

	async function loadHistory() {
		try { history = await invoke<ColorValue[]>('get_color_history'); } catch {}
	}

	async function loadFavorites() {
		try { favorites = await invoke<ColorValue[]>('get_favorite_colors'); } catch {}
	}

	async function clearHistory() {
		try {
			await invoke('clear_color_history');
			history = [];
		} catch {}
	}

	function formatColor(color: ColorValue): string {
		switch (copyFormat) {
			case 'rgb': return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`;
			case 'hsl': return `hsl(${color.hsl.h.toFixed(0)}, ${color.hsl.s.toFixed(0)}%, ${color.hsl.l.toFixed(0)}%)`;
			default: return color.hex;
		}
	}
</script>

<div class="flex flex-col gap-3 p-4 h-full overflow-y-auto bg-dark-800 text-gray-200">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-white">Color Picker</h2>
		<select bind:value={copyFormat} class="text-xs bg-dark-700 border border-dark-500 rounded px-2 py-1 text-gray-300">
			<option value="hex">HEX</option>
			<option value="rgb">RGB</option>
			<option value="hsl">HSL</option>
		</select>
	</div>

	{#if error}
		<div class="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">{error}</div>
	{/if}

	<!-- Tabs -->
	<div class="flex gap-1 bg-dark-700 rounded-lg p-1">
		{#each ['picker', 'history', 'favorites'] as tab}
			<button
				onclick={() => activeTab = tab as typeof activeTab}
				class="flex-1 px-2 py-1 text-xs rounded-md transition-colors {activeTab === tab ? 'bg-hearth-600 text-white' : 'text-gray-400 hover:text-white'}"
			>
				{tab.charAt(0).toUpperCase() + tab.slice(1)}
			</button>
		{/each}
	</div>

	{#if activeTab === 'picker'}
		<!-- Color Input -->
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={hexInput}
				onkeydown={(e) => e.key === 'Enter' && parseHexInput()}
				placeholder="#FF6B35 or rgb(255,107,53)"
				class="flex-1 bg-dark-700 border border-dark-500 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-hearth-500 focus:outline-none"
			/>
			<button
				onclick={parseHexInput}
				class="px-3 py-2 bg-hearth-600 hover:bg-hearth-700 text-white text-sm rounded transition-colors"
			>
				Parse
			</button>
		</div>

		<button
			onclick={pickFromScreen}
			class="w-full py-2 bg-dark-700 hover:bg-dark-600 border border-dark-500 rounded text-sm text-gray-300 transition-colors flex items-center justify-center gap-2"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
			</svg>
			Pick from Screen
		</button>

		{#if currentColor}
			<!-- Current Color Preview -->
			<div class="flex gap-3 items-stretch">
				<div
					class="w-20 h-20 rounded-lg border border-dark-500 flex-shrink-0 cursor-pointer"
					style="background-color: {currentColor.hex}"
					title="Click to copy"
					onclick={() => copyColor(currentColor!)}
					role="button"
					tabindex="0"
				></div>
				<div class="flex flex-col gap-1 text-xs font-mono flex-1">
					<div class="flex justify-between"><span class="text-gray-400">HEX</span><span class="text-white">{currentColor.hex}</span></div>
					<div class="flex justify-between"><span class="text-gray-400">RGB</span><span class="text-white">{currentColor.rgb.r}, {currentColor.rgb.g}, {currentColor.rgb.b}</span></div>
					<div class="flex justify-between"><span class="text-gray-400">HSL</span><span class="text-white">{currentColor.hsl.h.toFixed(0)}, {currentColor.hsl.s.toFixed(0)}%, {currentColor.hsl.l.toFixed(0)}%</span></div>
					<div class="flex justify-between"><span class="text-gray-400">HSV</span><span class="text-white">{currentColor.hsv.h.toFixed(0)}, {currentColor.hsv.s.toFixed(0)}%, {currentColor.hsv.v.toFixed(0)}%</span></div>
				</div>
			</div>

			<div class="flex gap-2">
				<button onclick={() => copyColor(currentColor!)} class="flex-1 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 rounded text-gray-300 transition-colors">
					{copied ? 'Copied!' : `Copy ${copyFormat.toUpperCase()}`}
				</button>
				<button onclick={() => addToFavorites(currentColor!)} class="flex-1 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 rounded text-gray-300 transition-colors">
					Add to Favorites
				</button>
			</div>

			<!-- Palette -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium">Palette</span>
					<select bind:value={paletteType} onchange={generatePalette} class="text-xs bg-dark-700 border border-dark-500 rounded px-2 py-1 text-gray-300">
						{#each paletteTypes as pt}
							<option value={pt}>{pt.charAt(0).toUpperCase() + pt.slice(1)}</option>
						{/each}
					</select>
				</div>
				<div class="flex gap-1">
					{#each palette as color}
						<button
							onclick={() => { currentColor = color; hexInput = color.hex; }}
							class="flex-1 h-10 rounded border border-dark-500 hover:border-white/30 transition-colors cursor-pointer"
							style="background-color: {color.hex}"
							title={color.hex}
						></button>
					{/each}
				</div>
			</div>
		{/if}

	{:else if activeTab === 'history'}
		<div class="flex items-center justify-between">
			<span class="text-sm text-gray-400">{history.length} colors</span>
			{#if history.length > 0}
				<button onclick={clearHistory} class="text-xs text-red-400 hover:text-red-300">Clear</button>
			{/if}
		</div>
		<div class="grid grid-cols-6 gap-2">
			{#each history as color}
				<button
					onclick={() => { currentColor = color; hexInput = color.hex; activeTab = 'picker'; generatePalette(); }}
					class="aspect-square rounded-lg border border-dark-500 hover:border-white/30 transition-colors"
					style="background-color: {color.hex}"
					title={color.hex}
				></button>
			{/each}
		</div>
		{#if history.length === 0}
			<div class="text-center text-gray-500 text-sm py-8">No color history yet</div>
		{/if}

	{:else if activeTab === 'favorites'}
		<div class="grid grid-cols-6 gap-2">
			{#each favorites as color}
				<div class="relative group">
					<button
						onclick={() => { currentColor = color; hexInput = color.hex; activeTab = 'picker'; generatePalette(); }}
						class="w-full aspect-square rounded-lg border border-dark-500 hover:border-white/30 transition-colors"
						style="background-color: {color.hex}"
						title={color.hex}
					></button>
					<button
						onclick={() => removeFromFavorites(color.hex)}
						class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none hidden group-hover:flex items-center justify-center"
					>&times;</button>
				</div>
			{/each}
		</div>
		{#if favorites.length === 0}
			<div class="text-center text-gray-500 text-sm py-8">No favorite colors</div>
		{/if}
	{/if}
</div>
