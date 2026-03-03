<script lang="ts">
	export let variant: 'text' | 'circle' | 'rect' = 'text';
	export let width: string | undefined = undefined;
	export let height: string | undefined = undefined;
	export let lines = 1;
	export let animated = true;

	$: circleSize = height || '48px';

	function getStyle(isCircle: boolean, w?: string, h?: string, size?: string): string {
		if (isCircle) {
			return `width: ${size}; height: ${size}`;
		}
		const styles: string[] = [];
		if (w) styles.push(`width: ${w}`);
		if (h) styles.push(`height: ${h}`);
		return styles.join('; ');
	}

	$: textLineStyle = getStyle(false, width, height);
	$: mainStyle = getStyle(variant === 'circle', width, height, circleSize);
</script>

{#if variant === 'text' && lines > 1}
	<div class="skeleton-lines" role="status" aria-label="Loading content">
		{#each Array(lines) as _, i}
			<div
				class="skeleton skeleton-text"
				class:animated
				style={textLineStyle}
			></div>
		{/each}
	</div>
{:else}
	<div
		class="skeleton skeleton-{variant}"
		class:animated
		role="status"
		aria-label="Loading"
		style={mainStyle}
	></div>
{/if}

<style>
	.skeleton {
		background: var(--bg-modifier-active, #404249);
		border-radius: 4px;
	}

	.skeleton.animated {
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-text {
		height: 16px;
		width: 100%;
		border-radius: 4px;
	}

	.skeleton-circle {
		border-radius: 50%;
	}

	.skeleton-rect {
		width: 100%;
		height: 100px;
	}

	.skeleton-lines {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
