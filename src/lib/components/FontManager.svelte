<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	interface FontInfo {
		family: string;
		style: string;
		path: string | null;
		is_monospace: boolean;
		is_system: boolean;
	}

	interface FontPreferences {
		chat_font: string;
		code_font: string;
		ui_font: string;
		chat_font_size: number;
		code_font_size: number;
		ui_font_size: number;
		line_height: number;
		letter_spacing: number;
		custom_css: string | null;
	}

	let fonts: FontInfo[] = [];
	let monoFonts: FontInfo[] = [];
	let searchQuery = '';
	let filteredFonts: FontInfo[] = [];
	let preferences: FontPreferences = {
		chat_font: 'system-ui',
		code_font: 'monospace',
		ui_font: 'system-ui',
		chat_font_size: 14,
		code_font_size: 13,
		ui_font_size: 14,
		line_height: 1.5,
		letter_spacing: 0,
		custom_css: null
	};
	let activeTab: 'chat' | 'code' | 'ui' = 'chat';
	let loading = true;

	$: filteredFonts = searchQuery
		? fonts.filter((f) => f.family.toLowerCase().includes(searchQuery.toLowerCase()))
		: fonts;

	onMount(async () => {
		try {
			[fonts, monoFonts, preferences] = await Promise.all([
				invoke<FontInfo[]>('font_list_system'),
				invoke<FontInfo[]>('font_list_monospace'),
				invoke<FontPreferences>('font_get_preferences')
			]);
		} catch (e) {
			console.error('Failed to load fonts:', e);
		} finally {
			loading = false;
		}
	});

	async function savePreferences() {
		try {
			await invoke('font_set_preferences', { preferences });
			const css = await invoke<string>('font_get_css');
			applyCSS(css);
		} catch (e) {
			console.error('Failed to save font preferences:', e);
		}
	}

	function applyCSS(css: string) {
		let styleEl = document.getElementById('hearth-font-styles');
		if (!styleEl) {
			styleEl = document.createElement('style');
			styleEl.id = 'hearth-font-styles';
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = css;
	}

	function selectFont(family: string) {
		if (activeTab === 'chat') preferences.chat_font = family;
		else if (activeTab === 'code') preferences.code_font = family;
		else preferences.ui_font = family;
		savePreferences();
	}

	function getCurrentFont(): string {
		if (activeTab === 'chat') return preferences.chat_font;
		if (activeTab === 'code') return preferences.code_font;
		return preferences.ui_font;
	}

	function getCurrentSize(): number {
		if (activeTab === 'chat') return preferences.chat_font_size;
		if (activeTab === 'code') return preferences.code_font_size;
		return preferences.ui_font_size;
	}

	function setSize(size: number) {
		if (activeTab === 'chat') preferences.chat_font_size = size;
		else if (activeTab === 'code') preferences.code_font_size = size;
		else preferences.ui_font_size = size;
		savePreferences();
	}

	$: displayFonts = activeTab === 'code' ? monoFonts : filteredFonts;
</script>

<div class="font-manager">
	<h3 class="text-lg font-semibold text-white mb-4">Font Settings</h3>

	<div class="tabs">
		<button class="tab" class:active={activeTab === 'chat'} on:click={() => (activeTab = 'chat')}>
			Chat
		</button>
		<button class="tab" class:active={activeTab === 'code'} on:click={() => (activeTab = 'code')}>
			Code
		</button>
		<button class="tab" class:active={activeTab === 'ui'} on:click={() => (activeTab = 'ui')}>
			Interface
		</button>
	</div>

	<div class="preview-card">
		<div
			class="preview-text"
			style="font-family: '{getCurrentFont()}', system-ui; font-size: {getCurrentSize()}px; line-height: {preferences.line_height}; letter-spacing: {preferences.letter_spacing}em;"
		>
			{#if activeTab === 'code'}
				<code>const greeting = "Hello, Hearth!";</code>
			{:else}
				The quick brown fox jumps over the lazy dog. 0123456789
			{/if}
		</div>
		<div class="text-xs text-gray-500 mt-2">
			{getCurrentFont()} &middot; {getCurrentSize()}px
		</div>
	</div>

	<div class="controls">
		<div class="control-row">
			<label class="text-sm text-gray-400">Size</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="10"
					max="24"
					step="1"
					value={getCurrentSize()}
					on:input={(e) => setSize(Number(e.currentTarget.value))}
					class="range-slider"
				/>
				<span class="text-sm text-gray-300 w-8">{getCurrentSize()}</span>
			</div>
		</div>

		<div class="control-row">
			<label class="text-sm text-gray-400">Line Height</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="1.0"
					max="2.0"
					step="0.1"
					bind:value={preferences.line_height}
					on:change={savePreferences}
					class="range-slider"
				/>
				<span class="text-sm text-gray-300 w-8">{preferences.line_height.toFixed(1)}</span>
			</div>
		</div>

		<div class="control-row">
			<label class="text-sm text-gray-400">Letter Spacing</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					min="-0.05"
					max="0.1"
					step="0.01"
					bind:value={preferences.letter_spacing}
					on:change={savePreferences}
					class="range-slider"
				/>
				<span class="text-sm text-gray-300 w-12">{preferences.letter_spacing.toFixed(2)}em</span>
			</div>
		</div>
	</div>

	{#if activeTab !== 'code'}
		<div class="mt-3">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search fonts..."
				class="search-input"
			/>
		</div>
	{/if}

	<div class="font-list">
		{#if loading}
			<div class="text-center text-gray-500 py-8">Loading fonts...</div>
		{:else if displayFonts.length === 0}
			<div class="text-center text-gray-500 py-8">No fonts found</div>
		{:else}
			{#each displayFonts as font}
				<button
					class="font-item"
					class:selected={getCurrentFont() === font.family}
					on:click={() => selectFont(font.family)}
				>
					<span class="font-name" style="font-family: '{font.family}', system-ui"
						>{font.family}</span
					>
					{#if font.is_monospace}
						<span class="mono-badge">Mono</span>
					{/if}
				</button>
			{/each}
		{/if}
	</div>
</div>

<style>
	.font-manager {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		padding: 0.25rem;
	}
	.tab {
		flex: 1;
		padding: 0.5rem;
		border: none;
		background: transparent;
		color: #b5bac1;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.tab.active {
		background: #5865f2;
		color: white;
	}
	.preview-card {
		padding: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 6px;
		margin-bottom: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.preview-text {
		color: #dbdee1;
		min-height: 2.5rem;
	}
	.controls {
		margin-bottom: 0.75rem;
	}
	.control-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0;
	}
	.range-slider {
		width: 120px;
		accent-color: #5865f2;
	}
	.search-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: white;
		font-size: 0.875rem;
	}
	.search-input:focus {
		outline: none;
		border-color: rgba(88, 101, 242, 0.6);
	}
	.font-list {
		max-height: 300px;
		overflow-y: auto;
		margin-top: 0.5rem;
	}
	.font-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		color: #b5bac1;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.875rem;
		text-align: left;
	}
	.font-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.font-item.selected {
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
	}
	.mono-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		color: #80848e;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
