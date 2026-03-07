<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface FontInfo {
		name: string;
		family: string;
		style: string;
		path: string;
		is_monospace: boolean;
	}

	interface FontCategory {
		name: string;
		count: number;
	}

	let fonts = $state<FontInfo[]>([]);
	let filteredFonts = $state<FontInfo[]>([]);
	let categories = $state<FontCategory[]>([]);
	let favorites = $state<string[]>([]);
	let searchQuery = $state('');
	let activeCategory = $state('all');
	let previewText = $state('The quick brown fox jumps over the lazy dog');
	let previewSize = $state(24);
	let fontCount = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const categoryLabels: Record<string, string> = {
		all: 'All',
		serif: 'Serif',
		'sans-serif': 'Sans-Serif',
		monospace: 'Monospace',
		display: 'Display'
	};

	onMount(async () => {
		await loadFonts();
	});

	async function loadFonts() {
		loading = true;
		error = null;
		try {
			const [allFonts, cats, favs, count] = await Promise.all([
				invoke<FontInfo[]>('fontpreview_get_fonts'),
				invoke<FontCategory[]>('fontpreview_get_font_categories'),
				invoke<string[]>('fontpreview_get_favorites'),
				invoke<number>('fontpreview_get_font_count')
			]);
			fonts = allFonts;
			categories = cats;
			favorites = favs;
			fontCount = count;
			applyFilters();
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		let result = fonts;

		if (activeCategory !== 'all') {
			result = result.filter((f) => {
				if (activeCategory === 'monospace') return f.is_monospace;
				if (activeCategory === 'serif') return isSerif(f.family);
				if (activeCategory === 'display') return isDisplay(f.family);
				if (activeCategory === 'sans-serif')
					return !f.is_monospace && !isSerif(f.family) && !isDisplay(f.family);
				return true;
			});
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(f) =>
					f.name.toLowerCase().includes(q) ||
					f.family.toLowerCase().includes(q) ||
					f.style.toLowerCase().includes(q)
			);
		}

		filteredFonts = result;
	}

	function isSerif(family: string): boolean {
		const l = family.toLowerCase();
		return (
			(l.includes('serif') && !l.includes('sans')) ||
			l.includes('times') ||
			l.includes('georgia') ||
			l.includes('garamond') ||
			l.includes('palatino') ||
			l.includes('cambria') ||
			l.includes('playfair') ||
			l.includes('merriweather') ||
			l.includes('lora') ||
			l.includes('crimson')
		);
	}

	function isDisplay(family: string): boolean {
		const l = family.toLowerCase();
		return (
			l.includes('display') ||
			l.includes('script') ||
			l.includes('cursive') ||
			l.includes('handwrit') ||
			l.includes('brush') ||
			l.includes('comic') ||
			l.includes('decorative') ||
			l.includes('stencil')
		);
	}

	$effect(() => {
		// Re-filter whenever search or category changes
		searchQuery;
		activeCategory;
		applyFilters();
	});

	function isFavorite(fontName: string): boolean {
		return favorites.includes(fontName);
	}

	async function toggleFavorite(fontName: string) {
		try {
			if (isFavorite(fontName)) {
				await invoke('fontpreview_remove_favorite', { fontName });
				favorites = favorites.filter((f) => f !== fontName);
			} else {
				await invoke('fontpreview_add_favorite', { fontName });
				favorites = [...favorites, fontName];
			}
		} catch (e) {
			error = String(e);
		}
	}

	function getCategoryCount(cat: string): number {
		if (cat === 'all') return fontCount;
		const found = categories.find((c) => c.name === cat);
		return found ? found.count : 0;
	}
</script>

<div class="flex h-full flex-col bg-zinc-900 text-zinc-100">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
			</svg>
			<h2 class="text-lg font-semibold text-zinc-100">Font Preview</h2>
		</div>
		<span class="text-sm text-zinc-400">{filteredFonts.length} / {fontCount} fonts</span>
	</div>

	<!-- Search and Controls -->
	<div class="space-y-3 border-b border-zinc-700 px-4 py-3">
		<!-- Search input -->
		<div class="relative">
			<svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
			</svg>
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search fonts..."
				class="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
			/>
		</div>

		<!-- Category filter buttons -->
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(categoryLabels) as [key, label]}
				<button
					onclick={() => (activeCategory = key)}
					class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {activeCategory === key
						? 'bg-purple-600 text-white'
						: 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}"
				>
					{label}
					<span class="ml-1 opacity-70">({getCategoryCount(key)})</span>
				</button>
			{/each}
		</div>

		<!-- Preview text and size controls -->
		<div class="flex items-center gap-3">
			<input
				type="text"
				bind:value={previewText}
				placeholder="Preview text..."
				class="min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500"
			/>
			<div class="flex items-center gap-2">
				<label for="preview-size" class="whitespace-nowrap text-xs text-zinc-400">Size:</label>
				<input
					id="preview-size"
					type="range"
					bind:value={previewSize}
					min="12"
					max="72"
					step="2"
					class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-zinc-600 accent-purple-500"
				/>
				<span class="w-8 text-right text-xs text-zinc-400">{previewSize}px</span>
			</div>
		</div>
	</div>

	<!-- Font Grid -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if loading}
			<div class="flex h-40 items-center justify-center">
				<div class="flex items-center gap-3 text-zinc-400">
					<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<span>Scanning system fonts...</span>
				</div>
			</div>
		{:else if error}
			<div class="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
				{error}
			</div>
		{:else if filteredFonts.length === 0}
			<div class="flex h-40 items-center justify-center text-zinc-500">
				No fonts found matching your criteria.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
				{#each filteredFonts as font (font.name)}
					<div class="group relative rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-colors hover:border-zinc-500">
						<!-- Font header -->
						<div class="mb-2 flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-medium text-zinc-200">{font.name}</h3>
								<div class="flex items-center gap-2 text-xs text-zinc-500">
									<span>{font.style}</span>
									{#if font.is_monospace}
										<span class="rounded bg-purple-900/50 px-1.5 py-0.5 text-purple-300">mono</span>
									{/if}
								</div>
							</div>
							<!-- Favorite toggle -->
							<button
								onclick={() => toggleFavorite(font.name)}
								class="ml-2 flex-shrink-0 p-1 transition-colors"
								title={isFavorite(font.name) ? 'Remove from favorites' : 'Add to favorites'}
							>
								{#if isFavorite(font.name)}
									<svg class="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
									</svg>
								{:else}
									<svg class="h-5 w-5 text-zinc-600 group-hover:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
									</svg>
								{/if}
							</button>
						</div>

						<!-- Font preview rendered in its own typeface -->
						<div
							class="overflow-hidden text-ellipsis whitespace-nowrap text-zinc-300"
							style="font-family: '{font.family}', sans-serif; font-size: {previewSize}px; line-height: 1.3;"
						>
							{previewText}
						</div>

						<!-- Font path -->
						<div class="mt-2 truncate text-xs text-zinc-600" title={font.path}>
							{font.path}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
