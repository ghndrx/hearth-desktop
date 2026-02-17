<script lang="ts">
	/**
	 * SplitViewContainer.svelte
	 * FEAT-003: Split View (Desktop)
	 * 
	 * Alternative container wrapper for split view (kept for backwards compatibility).
	 * For new code, prefer using SplitView.svelte directly.
	 * Uses Svelte 5 runes.
	 */
	import SplitView from './SplitView.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		desktopBreakpoint?: number;
	}

	let { children, desktopBreakpoint = 1024 }: Props = $props();
</script>

<SplitView {desktopBreakpoint}>
	{@render children()}
</SplitView>
