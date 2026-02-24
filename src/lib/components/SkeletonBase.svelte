<script lang="ts">
	/**
	 * SkeletonBase Component
	 * 
	 * Base skeleton component with shimmer animation.
	 * Used as a building block for specific skeleton components.
	 */
	
	export let width: string = '100%';
	export let height: string = '16px';
	export let borderRadius: string = '4px';
	export let animated = true;
</script>

<div 
	class="skeleton-base"
	class:animated
	style="
		width: {width};
		height: {height};
		border-radius: {borderRadius};
	"
	role="presentation"
	aria-hidden="true"
></div>

<style>
	.skeleton-base {
		background-color: var(--bg-modifier-accent, #4e5058);
		position: relative;
		overflow: hidden;
	}

	.skeleton-base.animated::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.05) 50%,
			transparent 100%
		);
		animation: shimmer 1.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}
</style>
