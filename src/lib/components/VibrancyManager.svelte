<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { writable } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';
	import { type } from '@tauri-apps/plugin-os';
	
	/**
	 * VibrancyManager - Manages macOS vibrancy/transparency effects for the window
	 * 
	 * Supports various vibrancy materials:
	 * - titlebar: Native titlebar blur
	 * - sidebar: Sidebar-style transparency
	 * - content: Content area transparency
	 * - menu: Menu bar style
	 * - popover: Popover style
	 * - fullscreen-ui: Full-screen UI elements
	 */
	
	export type VibrancyMaterial = 
		| 'titlebar'
		| 'selection'
		| 'menu'
		| 'popover'
		| 'sidebar'
		| 'header'
		| 'sheet'
		| 'window'
		| 'hud'
		| 'fullscreen-ui'
		| 'tooltip'
		| 'content'
		| 'under-window'
		| 'under-page';
	
	export type VibrancyAppearance = 'light' | 'dark' | 'auto';
	
	export interface VibrancyConfig {
		enabled: boolean;
		material: VibrancyMaterial;
		appearance: VibrancyAppearance;
		blurRadius: number;
	}
	
	/** Initial material to apply */
	export let material: VibrancyMaterial = 'sidebar';
	
	/** Appearance mode */
	export let appearance: VibrancyAppearance = 'auto';
	
	/** Whether vibrancy is enabled */
	export let enabled: boolean = true;
	
	/** Blur radius (0-100) */
	export let blurRadius: number = 20;
	
	/** Callback when vibrancy state changes */
	export let onChange: ((config: VibrancyConfig) => void) | undefined = undefined;
	
	/** Callback on error */
	export let onError: ((error: Error) => void) | undefined = undefined;
	
	// Stores
	const isMacOS = writable(false);
	const isSupported = writable(false);
	const currentConfig = writable<VibrancyConfig>({
		enabled,
		material,
		appearance,
		blurRadius
	});
	
	let mounted = false;
	let platform: string = '';
	
	const STORAGE_KEY = 'hearth_vibrancy_config';
	
	// Material descriptions for UI
	export const materialDescriptions: Record<VibrancyMaterial, string> = {
		'titlebar': 'Native titlebar transparency',
		'selection': 'Selection highlight style',
		'menu': 'Menu bar appearance',
		'popover': 'Popover/tooltip style',
		'sidebar': 'Sidebar transparency (default)',
		'header': 'Header bar style',
		'sheet': 'Sheet/dialog background',
		'window': 'Full window transparency',
		'hud': 'Heads-up display style',
		'fullscreen-ui': 'Fullscreen UI elements',
		'tooltip': 'Tooltip background',
		'content': 'Content area blur',
		'under-window': 'Under-window background',
		'under-page': 'Under-page background'
	};
	
	async function detectPlatform(): Promise<boolean> {
		if (!browser) return false;
		
		try {
			platform = await type();
			const isMac = platform === 'macos';
			isMacOS.set(isMac);
			isSupported.set(isMac);
			return isMac;
		} catch (error) {
			console.warn('Failed to detect platform:', error);
			isMacOS.set(false);
			isSupported.set(false);
			return false;
		}
	}
	
	function loadConfig(): VibrancyConfig | null {
		if (!browser) return null;
		
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.warn('Failed to load vibrancy config:', error);
		}
		return null;
	}
	
	function saveConfig(config: VibrancyConfig): void {
		if (!browser) return;
		
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		} catch (error) {
			console.warn('Failed to save vibrancy config:', error);
		}
	}
	
	async function applyVibrancy(config: VibrancyConfig): Promise<boolean> {
		if (!browser) return false;
		
		try {
			// Check if Tauri vibrancy plugin is available
			if (!config.enabled) {
				await invoke('plugin:vibrancy|clear');
				return true;
			}
			
			await invoke('plugin:vibrancy|apply', {
				material: config.material,
				appearance: config.appearance,
				radius: config.blurRadius
			});
			
			return true;
		} catch (error) {
			// Vibrancy plugin may not be installed - graceful fallback
			console.debug('Vibrancy not available (plugin may not be installed):', error);
			
			// Try CSS-based fallback for non-macOS or missing plugin
			applyFallbackTransparency(config);
			return false;
		}
	}
	
	function applyFallbackTransparency(config: VibrancyConfig): void {
		if (!browser || !config.enabled) {
			document.documentElement.style.removeProperty('--vibrancy-blur');
			document.documentElement.style.removeProperty('--vibrancy-bg');
			return;
		}
		
		// CSS variable fallback for transparency effects
		const opacity = Math.max(0.7, 1 - (config.blurRadius / 100) * 0.3);
		const isDark = config.appearance === 'dark' || 
			(config.appearance === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		
		document.documentElement.style.setProperty(
			'--vibrancy-blur',
			`blur(${config.blurRadius}px)`
		);
		
		document.documentElement.style.setProperty(
			'--vibrancy-bg',
			isDark 
				? `rgba(30, 30, 30, ${opacity})`
				: `rgba(255, 255, 255, ${opacity})`
		);
	}
	
	async function updateConfig(updates: Partial<VibrancyConfig>): Promise<void> {
		const current = await new Promise<VibrancyConfig>(resolve => {
			currentConfig.subscribe(v => resolve(v))();
		});
		
		const newConfig: VibrancyConfig = { ...current, ...updates };
		currentConfig.set(newConfig);
		saveConfig(newConfig);
		
		const success = await applyVibrancy(newConfig);
		
		if (onChange) {
			onChange(newConfig);
		}
		
		if (!success && onError) {
			onError(new Error('Native vibrancy not available, using CSS fallback'));
		}
	}
	
	// Reactive updates when props change
	$: if (mounted) {
		updateConfig({ enabled, material, appearance, blurRadius });
	}
	
	onMount(async () => {
		mounted = true;
		
		const supported = await detectPlatform();
		
		// Load saved config or use defaults
		const savedConfig = loadConfig();
		if (savedConfig) {
			currentConfig.set(savedConfig);
			enabled = savedConfig.enabled;
			material = savedConfig.material;
			appearance = savedConfig.appearance;
			blurRadius = savedConfig.blurRadius;
		}
		
		// Apply initial vibrancy
		const current = await new Promise<VibrancyConfig>(resolve => {
			currentConfig.subscribe(v => resolve(v))();
		});
		
		await applyVibrancy(current);
		
		// Listen for appearance changes
		if (browser && appearance === 'auto') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			mediaQuery.addEventListener('change', () => {
				updateConfig({ appearance: 'auto' });
			});
		}
	});
	
	onDestroy(() => {
		mounted = false;
	});
	
	// Public API
	export function setMaterial(newMaterial: VibrancyMaterial): Promise<void> {
		return updateConfig({ material: newMaterial });
	}
	
	export function setAppearance(newAppearance: VibrancyAppearance): Promise<void> {
		return updateConfig({ appearance: newAppearance });
	}
	
	export function setEnabled(newEnabled: boolean): Promise<void> {
		return updateConfig({ enabled: newEnabled });
	}
	
	export function setBlurRadius(newRadius: number): Promise<void> {
		const clamped = Math.max(0, Math.min(100, newRadius));
		return updateConfig({ blurRadius: clamped });
	}
	
	export function getConfig(): VibrancyConfig {
		let config: VibrancyConfig = { enabled, material, appearance, blurRadius };
		currentConfig.subscribe(v => config = v)();
		return config;
	}
	
	export function getMaterials(): VibrancyMaterial[] {
		return Object.keys(materialDescriptions) as VibrancyMaterial[];
	}
</script>

<!-- VibrancyManager is a headless component for managing window transparency -->
<slot 
	isMacOS={$isMacOS}
	isSupported={$isSupported}
	config={$currentConfig}
	materials={materialDescriptions}
	{setMaterial}
	{setAppearance}
	{setEnabled}
	{setBlurRadius}
/>
