<script lang="ts">
	import '$lib/styles/theme.css';
	import '../../app.css';

	let { children } = $props();
</script>

{@render children()}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: transparent;
		overflow: hidden;
	}
</style>
