<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	interface InputMethodInfo {
		id: string;
		name: string;
		language: string;
		layout: string;
	}

	export let showLabel = true;
	export let compact = false;

	let currentMethod: InputMethodInfo | null = null;
	let availableMethods: InputMethodInfo[] = [];
	let showDropdown = false;
	let unlisten: UnlistenFn | null = null;

	const languageFlags: Record<string, string> = {
		en: 'EN',
		de: 'DE',
		fr: 'FR',
		es: 'ES',
		ja: 'JA',
		zh: 'ZH',
		ko: 'KO',
		ru: 'RU',
		ar: 'AR',
		pt: 'PT',
		it: 'IT',
		us: 'US'
	};

	function getDisplayLabel(method: InputMethodInfo): string {
		return languageFlags[method.language] || method.name.substring(0, 2).toUpperCase();
	}

	onMount(async () => {
		try {
			currentMethod = await invoke<InputMethodInfo>('get_current_input_method');
			availableMethods = await invoke<InputMethodInfo[]>('list_input_methods');

			await invoke('watch_input_method');
			unlisten = await listen<InputMethodInfo>('input-method-changed', (event) => {
				currentMethod = event.payload;
			});
		} catch (e) {
			console.error('Failed to get input method:', e);
		}
	});

	onDestroy(() => {
		unlisten?.();
	});
</script>

{#if currentMethod}
	<div class="relative">
		<button
			class="flex items-center gap-1 {compact
				? 'px-1.5 py-0.5 text-xs'
				: 'px-2 py-1 text-sm'} rounded bg-dark-700 hover:bg-dark-600 text-gray-300 transition-colors"
			on:click={() => (showDropdown = !showDropdown)}
			title="Current keyboard layout: {currentMethod.name}"
		>
			<span class="font-mono font-bold">{getDisplayLabel(currentMethod)}</span>
			{#if showLabel && !compact}
				<span class="text-gray-400">{currentMethod.name}</span>
			{/if}
		</button>

		{#if showDropdown && availableMethods.length > 1}
			<div
				class="absolute bottom-full mb-1 left-0 bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[160px] z-50"
			>
				{#each availableMethods as method}
					<button
						class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-dark-600 transition-colors {method.id ===
						currentMethod?.id
							? 'text-warm-400'
							: 'text-gray-300'}"
						on:click={() => (showDropdown = false)}
					>
						<span class="font-mono font-bold w-6">{getDisplayLabel(method)}</span>
						<span>{method.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
