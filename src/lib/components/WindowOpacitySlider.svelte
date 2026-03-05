<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	export let opacity = 100;
	export let showVibrancy = true;

	let vibrancyEffect = 'none';

	async function handleOpacityChange() {
		try {
			await invoke('set_window_opacity', { opacity: opacity / 100 });
		} catch (e) {
			console.error('Failed to set opacity:', e);
		}
	}

	async function handleVibrancyChange() {
		try {
			await invoke('set_window_vibrancy', { effect: vibrancyEffect });
		} catch (e) {
			console.error('Failed to set vibrancy:', e);
		}
	}

	async function toggleCompactMode(compact: boolean) {
		try {
			await invoke('set_compact_mode', { compact });
		} catch (e) {
			console.error('Failed to toggle compact mode:', e);
		}
	}

	const vibrancyOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'sidebar', label: 'Sidebar' },
		{ value: 'content', label: 'Content' },
		{ value: 'under-window', label: 'Under Window' },
		{ value: 'hud', label: 'HUD' },
		{ value: 'titlebar', label: 'Titlebar' }
	];
</script>

<div class="space-y-3">
	<div>
		<div class="flex items-center justify-between mb-1.5">
			<label class="text-sm font-medium text-gray-300" for="opacity-slider">Window Opacity</label>
			<span class="text-sm text-gray-400">{opacity}%</span>
		</div>
		<input
			id="opacity-slider"
			type="range"
			min="30"
			max="100"
			step="5"
			bind:value={opacity}
			on:change={handleOpacityChange}
			class="w-full h-1.5 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-warm-500"
		/>
		<div class="flex justify-between text-xs text-gray-500 mt-0.5">
			<span>30%</span>
			<span>100%</span>
		</div>
	</div>

	{#if showVibrancy}
		<div>
			<label class="text-sm font-medium text-gray-300 block mb-1.5" for="vibrancy-select">Window Effect</label>
			<select
				id="vibrancy-select"
				bind:value={vibrancyEffect}
				on:change={handleVibrancyChange}
				class="w-full px-3 py-1.5 bg-dark-700 border border-dark-500 rounded text-sm text-gray-200 focus:border-warm-500 focus:outline-none"
			>
				{#each vibrancyOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	{/if}

	<div class="flex gap-2">
		<button
			class="flex-1 px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 text-gray-300 rounded transition-colors"
			on:click={() => toggleCompactMode(true)}
		>
			Compact Mode
		</button>
		<button
			class="flex-1 px-3 py-1.5 text-sm bg-dark-700 hover:bg-dark-600 text-gray-300 rounded transition-colors"
			on:click={() => toggleCompactMode(false)}
		>
			Normal Mode
		</button>
	</div>
</div>
