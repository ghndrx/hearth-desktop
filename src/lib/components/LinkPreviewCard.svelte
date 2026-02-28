<!--
  LinkPreviewCard - Renders a rich link preview using native URL metadata.

  Calls the Rust backend to fetch Open Graph / Twitter Card / HTML meta
  data for a URL, bypassing CORS restrictions. Displays the preview as
  an inline card with title, description, image, and favicon.

  Usage:
    <LinkPreviewCard url="https://example.com/article" />
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	/** The URL to preview */
	export let url: string;
	/** Whether to show the image (can disable for compact mode) */
	export let showImage = true;
	/** Max width class */
	export let maxWidth = 'max-w-lg';

	interface LinkPreview {
		url: string;
		title: string | null;
		description: string | null;
		image: string | null;
		site_name: string | null;
		favicon: string | null;
		content_type: string | null;
		theme_color: string | null;
		author: string | null;
	}

	let preview: LinkPreview | null = null;
	let loading = true;
	let error = false;

	onMount(async () => {
		try {
			preview = await invoke<LinkPreview>('fetch_link_preview', { url });
		} catch {
			error = true;
		} finally {
			loading = false;
		}
	});

	function handleImageError() {
		if (preview) {
			preview = { ...preview, image: null };
		}
	}

	function handleFaviconError(e: Event) {
		const img = e.target as HTMLImageElement;
		img.style.display = 'none';
	}

	$: domain = (() => {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	})();
</script>

{#if loading}
	<div
		class="{maxWidth} rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 animate-pulse"
	>
		<div class="h-4 w-3/4 rounded bg-zinc-700 mb-2"></div>
		<div class="h-3 w-full rounded bg-zinc-700 mb-1"></div>
		<div class="h-3 w-2/3 rounded bg-zinc-700"></div>
	</div>
{:else if preview && (preview.title || preview.description)}
	<a
		href={preview.url}
		target="_blank"
		rel="noopener noreferrer"
		class="{maxWidth} block rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden
			hover:border-zinc-600 hover:bg-zinc-800 transition-colors group"
		style={preview.theme_color ? `border-left: 3px solid ${preview.theme_color}` : ''}
	>
		{#if showImage && preview.image}
			<div class="w-full h-40 overflow-hidden bg-zinc-900">
				<img
					src={preview.image}
					alt={preview.title || 'Link preview'}
					class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
					on:error={handleImageError}
				/>
			</div>
		{/if}

		<div class="p-3">
			<!-- Site info -->
			<div class="flex items-center gap-1.5 mb-1.5">
				{#if preview.favicon}
					<img
						src={preview.favicon}
						alt=""
						class="w-4 h-4 rounded-sm"
						on:error={handleFaviconError}
					/>
				{/if}
				<span class="text-xs text-zinc-400 truncate">
					{preview.site_name || domain}
				</span>
				{#if preview.author}
					<span class="text-xs text-zinc-500">by {preview.author}</span>
				{/if}
			</div>

			<!-- Title -->
			{#if preview.title}
				<h4 class="text-sm font-medium text-zinc-200 line-clamp-2 mb-1 group-hover:text-white">
					{preview.title}
				</h4>
			{/if}

			<!-- Description -->
			{#if preview.description}
				<p class="text-xs text-zinc-400 line-clamp-2">
					{preview.description}
				</p>
			{/if}
		</div>
	</a>
{:else if !error}
	<!-- URL with no metadata — render as simple link -->
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		class="text-sm text-blue-400 hover:underline break-all"
	>
		{url}
	</a>
{/if}
