<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toasts, type Toast } from '$lib/stores/toasts';

	export let toast: Toast;

	const icons: Record<Toast['type'], string> = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ'
	};
</script>

<div
	class="toast toast-{toast.type}"
	role="alert"
	aria-live="polite"
	in:fly={{ x: 300, duration: 300 }}
	out:fade={{ duration: 200 }}
>
	<div class="toast-icon">
		{icons[toast.type]}
	</div>
	<div class="toast-content">
		<p class="toast-message">{toast.message}</p>
	</div>
	{#if toast.dismissible}
		<button
			class="toast-dismiss"
			on:click={() => toasts.dismiss(toast.id)}
			aria-label="Dismiss notification"
		>
			✕
		</button>
	{/if}
</div>

<style>
	.toast {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 8px;
		background: var(--background-secondary, #2b2d31);
		border-left: 4px solid;
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.3),
			0 2px 4px rgba(0, 0, 0, 0.2);
		min-width: 280px;
		max-width: 400px;
		pointer-events: auto;
	}

	.toast-success {
		border-left-color: #3ba55c;
	}

	.toast-error {
		border-left-color: #ed4245;
	}

	.toast-warning {
		border-left-color: #faa61a;
	}

	.toast-info {
		border-left-color: #5865f2;
	}

	.toast-icon {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-size: 14px;
		font-weight: 600;
	}

	.toast-success .toast-icon {
		background: rgba(59, 165, 92, 0.2);
		color: #3ba55c;
	}

	.toast-error .toast-icon {
		background: rgba(237, 66, 69, 0.2);
		color: #ed4245;
	}

	.toast-warning .toast-icon {
		background: rgba(250, 166, 26, 0.2);
		color: #faa61a;
	}

	.toast-info .toast-icon {
		background: rgba(88, 101, 242, 0.2);
		color: #5865f2;
	}

	.toast-content {
		flex: 1;
		min-width: 0;
	}

	.toast-message {
		margin: 0;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		line-height: 1.4;
		word-break: break-word;
	}

	.toast-dismiss {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		font-size: 12px;
		transition: all 0.15s ease;
	}

	.toast-dismiss:hover {
		background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-normal, #dbdee1);
	}

	.toast-dismiss:active {
		transform: scale(0.95);
	}
</style>
