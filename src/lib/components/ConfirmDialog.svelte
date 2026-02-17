<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';

	export let open = false;
	export let title = 'Are you sure?';
	export let message = '';
	export let confirmText = 'Confirm';
	export let cancelText = 'Cancel';
	export let danger = false;
	export let loading = false;

	const dispatch = createEventDispatcher<{
		confirm: void;
		cancel: void;
	}>();

	function handleConfirm() {
		if (loading) return;
		dispatch('confirm');
	}

	function handleCancel() {
		if (loading) return;
		open = false;
		dispatch('cancel');
	}

	function handleClose() {
		if (loading) return;
		dispatch('cancel');
	}
</script>

<Modal {open} {title} size="small" on:close={handleClose}>
	<div class="confirm-content">
		{#if message}
			<p class="message">{message}</p>
		{/if}
		<slot />
	</div>

	<svelte:fragment slot="footer">
		<button
			class="btn secondary"
			on:click={handleCancel}
			disabled={loading}
			type="button"
			aria-label={cancelText}
		>
			{cancelText}
		</button>
		<button
			class="btn {danger ? 'danger' : 'primary'}"
			on:click={handleConfirm}
			disabled={loading}
			type="button"
			aria-label={confirmText}
			aria-busy={loading}
		>
			{#if loading}
				<span class="loading-spinner" aria-hidden="true"></span>
				Please wait...
			{:else}
				{confirmText}
			{/if}
		</button>
	</svelte:fragment>
</Modal>

<style>
	.confirm-content {
		text-align: center;
	}

	.message {
		margin: 0;
		font-size: 16px;
		line-height: 1.375;
		color: var(--text-muted, #b5bac1);
	}

	/* PRD Section 4.1 Button Styles */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 96px;
		min-height: 38px;
		padding: 8px 16px;
		border-radius: 3px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: background-color 0.1s ease;
	}

	/* Primary Button: background var(--blurple), color white */
	.btn.primary {
		background: var(--blurple, #5865f2);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--blurple-hover, #4752c4);
	}

	.btn.primary:focus-visible {
		outline: 2px solid var(--blurple, #5865f2);
		outline-offset: 2px;
	}

	/* Secondary Button: background transparent, color var(--text-normal) */
	.btn.secondary {
		background: transparent;
		color: var(--text-normal, #f2f3f5);
	}

	.btn.secondary:hover:not(:disabled) {
		text-decoration: underline;
	}

	.btn.secondary:focus-visible {
		outline: 2px solid var(--text-normal, #f2f3f5);
		outline-offset: 2px;
	}

	/* Danger Button: background var(--red), color white */
	.btn.danger {
		background: var(--red, #da373c);
		color: white;
	}

	.btn.danger:hover:not(:disabled) {
		background: #a12828;
	}

	.btn.danger:focus-visible {
		outline: 2px solid var(--red, #da373c);
		outline-offset: 2px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
