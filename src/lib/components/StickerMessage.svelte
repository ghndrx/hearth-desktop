<script lang="ts">
	import type { Sticker } from '$lib/api/stickers';

	export let sticker: Sticker;
</script>

<div class="inline-block mt-1">
	<img
		src={sticker.image_url}
		alt={sticker.alias}
		title={sticker.alias}
		class="w-16 h-16 object-contain"
		loading="lazy"
	/>
</div>
