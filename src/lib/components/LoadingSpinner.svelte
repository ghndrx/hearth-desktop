<script lang="ts">
	/**
	 * LoadingSpinner Component
	 * 
	 * A reusable loading spinner with Discord-like styling.
	 * Supports multiple sizes and optional loading text.
	 */
	
	export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let text: string | null = null;
	export let fullScreen = false;
	export let overlay = false;
	
	const sizes = {
		xs: { spinner: 16, border: 2 },
		sm: { spinner: 24, border: 2 },
		md: { spinner: 32, border: 3 },
		lg: { spinner: 48, border: 3 },
		xl: { spinner: 64, border: 4 }
	};
	
	$: sizeConfig = sizes[size];
</script>

{#if fullScreen}
	<div class="loading-container" class:overlay role="status" aria-live="polite">
		<div 
			class="spinner"
			style="
				width: {sizeConfig.spinner}px;
				height: {sizeConfig.spinner}px;
				border-width: {sizeConfig.border}px;
			"
			aria-hidden="true"
		></div>
		{#if text}
			<p class="loading-text" class:text-sm={size === 'xs' || size === 'sm'}>
				{text}
			</p>
		{/if}
		<span class="sr-only">{text || 'Loading'}</span>
	</div>
{:else}
	<div class="loading-inline" role="status" aria-live="polite">
		<div 
			class="spinner"
			style="
				width: {sizeConfig.spinner}px;
				height: {sizeConfig.spinner}px;
				border-width: {sizeConfig.border}px;
			"
			aria-hidden="true"
		></div>
		{#if text}
			<span class="loading-text-inline" class:text-sm={size === 'xs' || size === 'sm'}>
				{text}
			</span>
		{/if}
		<span class="sr-only">{text || 'Loading'}</span>
	</div>
{/if}

<style>
	/* Full screen loading container */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		width: 100%;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #b5bac1);
	}
	
	/* Overlay variant */
	.loading-container.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.85);
		z-index: 9999;
	}
	
	/* Inline loading container */
	.loading-inline {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	
	/* Spinner animation */
	.spinner {
		border-style: solid;
		border-color: var(--bg-modifier-accent, #4f545c);
		border-top-color: var(--brand-primary, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		flex-shrink: 0;
	}
	
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	
	/* Loading text for full screen */
	.loading-text {
		margin-top: 16px;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-muted, #b5bac1);
	}
	
	.loading-text.text-sm {
		margin-top: 12px;
		font-size: 12px;
	}
	
	/* Loading text for inline */
	.loading-text-inline {
		font-size: 14px;
		color: var(--text-muted, #b5bac1);
	}
	
	.loading-text-inline.text-sm {
		font-size: 12px;
	}
	
	/* Screen reader only text */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	
	/* Pulse animation variant (for skeleton-like loading) */
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
