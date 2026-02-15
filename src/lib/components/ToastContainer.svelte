<script lang="ts">
	import { toasts } from '$lib/stores/toasts';
	import Toast from './Toast.svelte';

	export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'bottom-right';
</script>

<div class="toast-container position-{position}" aria-live="polite" aria-atomic="false">
	{#each $toasts as toast (toast.id)}
		<Toast {toast} />
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		pointer-events: none;
		max-height: calc(100vh - 32px);
		overflow: hidden;
	}

	.position-top-right {
		top: 0;
		right: 0;
		align-items: flex-end;
	}

	.position-top-left {
		top: 0;
		left: 0;
		align-items: flex-start;
	}

	.position-bottom-right {
		bottom: 0;
		right: 0;
		align-items: flex-end;
		flex-direction: column-reverse;
	}

	.position-bottom-left {
		bottom: 0;
		left: 0;
		align-items: flex-start;
		flex-direction: column-reverse;
	}
</style>
