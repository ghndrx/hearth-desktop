<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import type { UnlistenFn } from '@tauri-apps/api/event';

	interface AccentColor {
		r: number;
		g: number;
		b: number;
		hex: string;
	}

	interface SystemThemeInfo {
		is_dark_mode: boolean;
		accent_color: AccentColor | null;
		high_contrast: boolean;
		reduce_motion: boolean;
		reduce_transparency: boolean;
	}

	export let onThemeChange: (info: SystemThemeInfo) => void = () => {};
	export let applyToCSS = true;

	let themeInfo: SystemThemeInfo | null = null;
	let unlisten: UnlistenFn | null = null;

	function applyThemeVariables(info: SystemThemeInfo) {
		if (!applyToCSS) return;

		const root = document.documentElement;
		if (info.accent_color) {
			root.style.setProperty('--system-accent-color', info.accent_color.hex);
			root.style.setProperty('--system-accent-r', String(info.accent_color.r));
			root.style.setProperty('--system-accent-g', String(info.accent_color.g));
			root.style.setProperty('--system-accent-b', String(info.accent_color.b));
		}
		root.style.setProperty('--system-dark-mode', info.is_dark_mode ? '1' : '0');

		if (info.reduce_motion) {
			root.style.setProperty('--reduce-motion', '1');
			root.classList.add('reduce-motion');
		} else {
			root.style.removeProperty('--reduce-motion');
			root.classList.remove('reduce-motion');
		}

		if (info.reduce_transparency) {
			root.classList.add('reduce-transparency');
		} else {
			root.classList.remove('reduce-transparency');
		}
	}

	onMount(async () => {
		try {
			themeInfo = await invoke<SystemThemeInfo>('get_system_theme_info');
			applyThemeVariables(themeInfo);
			onThemeChange(themeInfo);

			// Watch for changes
			await invoke('watch_system_theme');
			unlisten = await listen<SystemThemeInfo>('system-theme-changed', (event) => {
				themeInfo = event.payload;
				applyThemeVariables(themeInfo);
				onThemeChange(themeInfo);
			});
		} catch (e) {
			console.error('Failed to get system theme info:', e);
		}
	});

	onDestroy(() => {
		unlisten?.();
	});
</script>

{#if $$slots.default && themeInfo}
	<slot
		accentColor={themeInfo.accent_color}
		isDarkMode={themeInfo.is_dark_mode}
		reduceMotion={themeInfo.reduce_motion}
		reduceTransparency={themeInfo.reduce_transparency}
	/>
{/if}
