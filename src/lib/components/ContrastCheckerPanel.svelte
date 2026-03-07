<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ContrastResult {
		foreground: string;
		background: string;
		ratio: number;
		wcag_aa_normal: boolean;
		wcag_aa_large: boolean;
		wcag_aaa_normal: boolean;
		wcag_aaa_large: boolean;
		level: string;
	}

	interface ColorSuggestion {
		color: string;
		ratio: number;
		level: string;
	}

	interface HistoryEntry {
		id: string;
		foreground: string;
		background: string;
		ratio: number;
		level: string;
		checked_at: number;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let foreground = $state('#ffffff');
	let background = $state('#1a1a2e');
	let result = $state<ContrastResult | null>(null);
	let suggestions = $state<ColorSuggestion[]>([]);
	let history = $state<HistoryEntry[]>([]);
	let error = $state<string | null>(null);
	let showHistory = $state(false);
	let targetLevel = $state('AA');

	const presets = [
		{ name: 'Discord Dark', fg: '#dcddde', bg: '#36393f' },
		{ name: 'Discord Light', fg: '#2e3338', bg: '#ffffff' },
		{ name: 'Slack Dark', fg: '#d1d2d3', bg: '#1a1d21' },
		{ name: 'GitHub Dark', fg: '#c9d1d9', bg: '#0d1117' },
		{ name: 'High Contrast', fg: '#ffffff', bg: '#000000' },
		{ name: 'Hearth Default', fg: '#e2e8f0', bg: '#1e293b' },
	];

	onMount(() => {
		checkContrast();
	});

	async function checkContrast() {
		try {
			error = null;
			result = await invoke<ContrastResult>('contrast_check', { foreground, background });
			suggestions = await invoke<ColorSuggestion[]>('contrast_suggest', {
				foreground,
				background,
				targetLevel,
			});
		} catch (e) {
			error = String(e);
			result = null;
		}
	}

	async function loadHistory() {
		try {
			history = await invoke<HistoryEntry[]>('contrast_get_history');
		} catch (e) {
			error = String(e);
		}
	}

	async function clearHistory() {
		try {
			await invoke('contrast_clear_history');
			history = [];
		} catch (e) {
			error = String(e);
		}
	}

	function applyPreset(preset: { fg: string; bg: string }) {
		foreground = preset.fg;
		background = preset.bg;
		checkContrast();
	}

	function swapColors() {
		const temp = foreground;
		foreground = background;
		background = temp;
		checkContrast();
	}

	function applySuggestion(color: string) {
		foreground = color;
		checkContrast();
	}

	function applyHistoryEntry(entry: HistoryEntry) {
		foreground = entry.foreground;
		background = entry.background;
		showHistory = false;
		checkContrast();
	}

	function levelColor(level: string): string {
		switch (level) {
			case 'AAA':
				return 'text-green-400';
			case 'AA':
				return 'text-yellow-400';
			case 'AA Large':
				return 'text-orange-400';
			default:
				return 'text-red-400';
		}
	}

	function levelBg(level: string): string {
		switch (level) {
			case 'AAA':
				return 'bg-green-500/20 border-green-500/40';
			case 'AA':
				return 'bg-yellow-500/20 border-yellow-500/40';
			case 'AA Large':
				return 'bg-orange-500/20 border-orange-500/40';
			default:
				return 'bg-red-500/20 border-red-500/40';
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[560px] max-h-[85vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="3" />
							<path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7.05 7.05 5.636 5.636M18.364 18.364l-1.414-1.414M7.05 16.95l-1.414 1.414M18.364 5.636l-1.414 1.414" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Contrast Checker</h2>
						<p class="text-gray-400 text-xs">WCAG 2.1 accessibility compliance</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
						onclick={() => { showHistory = !showHistory; if (showHistory) loadHistory(); }}
					>
						{showHistory ? 'Checker' : 'History'}
					</button>
					<button
						class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
						onclick={() => { open = false; onClose?.(); }}
					aria-label="Close contrast checker"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5">
				{#if showHistory}
					<!-- History View -->
					<div class="space-y-2">
						{#if history.length === 0}
							<p class="text-gray-500 text-sm text-center py-8">No contrast checks yet</p>
						{:else}
							<div class="flex justify-end mb-2">
								<button class="text-xs text-red-400 hover:text-red-300" onclick={clearHistory}>Clear All</button>
							</div>
							{#each history as entry}
								<button
									class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
									onclick={() => applyHistoryEntry(entry)}
								>
									<div class="flex gap-1">
										<div class="w-6 h-6 rounded border border-gray-600" style="background-color: {entry.foreground}"></div>
										<div class="w-6 h-6 rounded border border-gray-600" style="background-color: {entry.background}"></div>
									</div>
									<div class="flex-1 min-w-0">
										<span class="text-gray-300 text-xs font-mono">{entry.foreground} / {entry.background}</span>
									</div>
									<div class="text-right">
										<span class="text-white text-sm font-bold">{entry.ratio}:1</span>
										<span class="ml-2 text-xs {levelColor(entry.level)}">{entry.level}</span>
									</div>
								</button>
							{/each}
						{/if}
					</div>
				{:else}
					<!-- Checker View -->
					<div class="space-y-5">
						<!-- Color Inputs -->
						<div class="flex gap-3 items-end">
							<div class="flex-1">
								<label class="text-xs text-gray-400 mb-1.5 block">Foreground (Text)</label>
								<div class="flex gap-2 items-center">
									<input
										type="color"
										bind:value={foreground}
										onchange={checkContrast}
										class="w-10 h-10 rounded cursor-pointer border border-gray-600 bg-transparent"
									/>
									<input
										type="text"
										bind:value={foreground}
										onchange={checkContrast}
										class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
										placeholder="#ffffff"
									/>
								</div>
							</div>

							<button
								class="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors mb-0.5"
								onclick={swapColors}
								title="Swap colors"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
								</svg>
							</button>

							<div class="flex-1">
								<label class="text-xs text-gray-400 mb-1.5 block">Background</label>
								<div class="flex gap-2 items-center">
									<input
										type="color"
										bind:value={background}
										onchange={checkContrast}
										class="w-10 h-10 rounded cursor-pointer border border-gray-600 bg-transparent"
									/>
									<input
										type="text"
										bind:value={background}
										onchange={checkContrast}
										class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
										placeholder="#000000"
									/>
								</div>
							</div>
						</div>

						<!-- Preview -->
						<div class="rounded-xl overflow-hidden border border-gray-700">
							<div class="p-6 text-center" style="background-color: {background}">
								<p class="text-2xl font-bold mb-1" style="color: {foreground}">Sample Text</p>
								<p class="text-base mb-2" style="color: {foreground}">The quick brown fox jumps over the lazy dog.</p>
								<p class="text-xs" style="color: {foreground}">Small text for AAA normal compliance check (14px)</p>
							</div>
						</div>

						<!-- Result -->
						{#if result}
							<div class="rounded-xl border {levelBg(result.level)} p-4">
								<div class="flex items-center justify-between mb-3">
									<div>
										<span class="text-3xl font-bold text-white">{result.ratio}:1</span>
										<span class="ml-2 text-lg font-semibold {levelColor(result.level)}">{result.level}</span>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-2">
									<div class="flex items-center gap-2">
										<span class="w-4 h-4 rounded-full {result.wcag_aa_normal ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">AA Normal (4.5:1)</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-4 h-4 rounded-full {result.wcag_aa_large ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">AA Large (3:1)</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-4 h-4 rounded-full {result.wcag_aaa_normal ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">AAA Normal (7:1)</span>
									</div>
									<div class="flex items-center gap-2">
										<span class="w-4 h-4 rounded-full {result.wcag_aaa_large ? 'bg-green-500' : 'bg-red-500'}"></span>
										<span class="text-sm text-gray-300">AAA Large (4.5:1)</span>
									</div>
								</div>
							</div>
						{/if}

						<!-- Suggestions -->
						{#if suggestions.length > 0 && result && result.level !== 'AAA'}
							<div>
								<div class="flex items-center justify-between mb-2">
									<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide">Suggestions for {targetLevel}</h3>
									<select
										bind:value={targetLevel}
										onchange={checkContrast}
										class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none"
									>
										<option value="AA Large">AA Large</option>
										<option value="AA">AA</option>
										<option value="AAA">AAA</option>
									</select>
								</div>
								<div class="flex flex-wrap gap-2">
									{#each suggestions as suggestion}
										<button
											class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700 transition-colors"
											onclick={() => applySuggestion(suggestion.color)}
										>
											<div class="w-5 h-5 rounded border border-gray-600" style="background-color: {suggestion.color}"></div>
											<span class="text-xs font-mono text-gray-300">{suggestion.color}</span>
											<span class="text-xs {levelColor(suggestion.level)}">{suggestion.ratio}:1</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Presets -->
						<div>
							<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Theme Presets</h3>
							<div class="grid grid-cols-3 gap-2">
								{#each presets as preset}
									<button
										class="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 transition-colors"
										onclick={() => applyPreset(preset)}
									>
										<div class="flex gap-0.5">
											<div class="w-4 h-4 rounded-l border border-gray-600" style="background-color: {preset.fg}"></div>
											<div class="w-4 h-4 rounded-r border border-gray-600" style="background-color: {preset.bg}"></div>
										</div>
										<span class="text-xs text-gray-300 truncate">{preset.name}</span>
									</button>
								{/each}
							</div>
						</div>

						{#if error}
							<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
								<p class="text-sm text-red-400">{error}</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
