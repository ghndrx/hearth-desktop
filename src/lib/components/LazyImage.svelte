<script lang="ts">
	/**
	 * LazyImage Component
	 * 
	 * Lazy-loading image with skeleton placeholder and fade-in animation.
	 * Uses native loading="lazy" with Intersection Observer fallback for older browsers.
	 * 
	 * @performance Reduces initial page load by deferring off-screen images
	 */
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import SkeletonBase from './SkeletonBase.svelte';

	export let src: string;
	export let alt: string;
	export let title: string = '';
	export let maxWidth: string = '400px';
	export let maxHeight: string = '300px';
	export let borderRadius: string = '8px';
	
	/** Use skeleton placeholder while loading */
	export let showSkeleton: boolean = true;
	
	/** Intersection observer root margin for preloading */
	export let rootMargin: string = '200px';
	
	/** CSS class for additional styling */
	let className: string = '';
	export { className as class };

	const dispatch = createEventDispatcher<{
		load: { src: string };
		error: { src: string; error: Error };
	}>();

	let imageLoaded = false;
	let imageError = false;
	let shouldLoad = false;
	let imgElement: HTMLImageElement;
	let containerElement: HTMLDivElement;
	let observer: IntersectionObserver | null = null;

	// Check for native lazy loading support
	const supportsNativeLazy = 'loading' in HTMLImageElement.prototype;

	function handleImageLoad() {
		imageLoaded = true;
		dispatch('load', { src });
	}

	function handleImageError(event: Event) {
		imageError = true;
		imageLoaded = true; // Stop showing skeleton
		dispatch('error', { src, error: new Error('Failed to load image') });
	}

	function setupIntersectionObserver() {
		if (supportsNativeLazy) {
			// Native lazy loading - load immediately and let browser handle it
			shouldLoad = true;
			return;
		}

		// Fallback for browsers without native lazy loading
		if (!('IntersectionObserver' in window)) {
			// No IO support - load immediately
			shouldLoad = true;
			return;
		}

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						shouldLoad = true;
						observer?.disconnect();
					}
				});
			},
			{
				rootMargin,
				threshold: 0
			}
		);

		if (containerElement) {
			observer.observe(containerElement);
		}
	}

	onMount(() => {
		setupIntersectionObserver();
	});

	onDestroy(() => {
		observer?.disconnect();
	});

	$: showPlaceholder = showSkeleton && !imageLoaded;
	$: imageVisible = shouldLoad && !imageError;
</script>

<div
	bind:this={containerElement}
	class="lazy-image-container {className}"
	style="max-width: {maxWidth}; max-height: {maxHeight};"
>
	{#if showPlaceholder}
		<div 
			class="lazy-image-skeleton"
			style="border-radius: {borderRadius};"
			aria-hidden="true"
		>
			<SkeletonBase 
				width="100%" 
				height="100%" 
				borderRadius={borderRadius}
				animated={true}
			/>
		</div>
	{/if}

	{#if imageVisible}
		<img
			bind:this={imgElement}
			{src}
			{alt}
			title={title || alt}
			loading={supportsNativeLazy ? 'lazy' : undefined}
			decoding="async"
			class="lazy-image"
			class:loaded={imageLoaded}
			style="border-radius: {borderRadius};"
			on:load={handleImageLoad}
			on:error={handleImageError}
		/>
	{/if}

	{#if imageError}
		<div 
			class="lazy-image-error"
			style="border-radius: {borderRadius};"
			role="img"
			aria-label="Failed to load image: {alt}"
		>
			<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
				<path d="M21 5v6.59l-3-3.01-4 4.01-4-4-4 4-3-3.01V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2zm-3 6.42 3 3.01V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-6.58l3 2.99 4-4 4 4 4-3.99z"/>
			</svg>
			<span class="error-text">Failed to load</span>
		</div>
	{/if}
</div>

<style>
	.lazy-image-container {
		position: relative;
		display: inline-block;
		min-width: 100px;
		min-height: 75px;
	}

	.lazy-image-skeleton {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		min-height: 150px;
		background-color: var(--bg-modifier-accent, #4e5058);
		overflow: hidden;
	}

	.lazy-image {
		display: block;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.lazy-image.loaded {
		opacity: 1;
	}

	.lazy-image-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 150px;
		padding: 16px;
		background-color: var(--bg-modifier-accent, #4e5058);
		color: var(--text-muted, #949ba4);
	}

	.error-text {
		font-size: 12px;
	}
</style>
