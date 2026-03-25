<script lang="ts">
	import type { Sticker } from '$lib/types/sticker';

	export let sticker: Sticker;

	let failed = false;

	function handleError() {
		failed = true;
	}
</script>

<div class="inline-block mt-1">
	{#if failed}
		<div class="w-16 h-16 rounded-lg bg-[#2b2d31] flex items-center justify-center text-[#949ba4] text-xs">
			<span title={sticker.alias}>Sticker</span>
		</div>
	{:else}
		<img
			src={sticker.image_url}
			alt={sticker.alias}
			title={`:${sticker.alias}:`}
			class="w-16 h-16 object-contain hover:scale-110 transition-transform cursor-default"
			loading="lazy"
			on:error={handleError}
		/>
	{/if}
</div>
