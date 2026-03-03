<script lang="ts">
	let className = '';
	export { className as class };
	export let count = 0;
	export let maxCount = 99;
	export let dot = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let isMention = false;

	$: displayCount = count > maxCount ? `${maxCount}+` : String(count);
	$: show = dot || count > 0;
	$: ariaLabel = dot
		? 'New notifications'
		: isMention
			? `${count} mentions`
			: `${count} unread messages`;
</script>

{#if show}
	<span
		class="notification-badge badge-{size} {className}"
		class:dot-only={dot}
		class:mention={isMention}
		role="status"
		aria-label={ariaLabel}
	>
		{#if !dot}{displayCount}{/if}
	</span>
{/if}

<style>
	.notification-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--red, #da373c);
		color: white;
		font-weight: 700;
		border-radius: 999px;
		line-height: 1;
		white-space: nowrap;
	}

	.notification-badge.mention {
		background: var(--red, #da373c);
	}

	.badge-sm {
		min-width: 16px;
		height: 16px;
		font-size: 10px;
		padding: 0 4px;
	}

	.badge-md {
		min-width: 20px;
		height: 20px;
		font-size: 12px;
		padding: 0 5px;
	}

	.badge-lg {
		min-width: 24px;
		height: 24px;
		font-size: 14px;
		padding: 0 6px;
	}

	.dot-only {
		width: 8px;
		height: 8px;
		min-width: 8px;
		padding: 0;
		border-radius: 50%;
	}

	.dot-only.badge-sm {
		width: 6px;
		height: 6px;
		min-width: 6px;
	}

	.dot-only.badge-lg {
		width: 10px;
		height: 10px;
		min-width: 10px;
	}
</style>
