<script lang="ts">
	import Button from './Button.svelte';

	interface Props {
		children: import('svelte').Snippet;
		fallback?: import('svelte').Snippet<[Error, () => void]>;
		onError?: (error: Error) => void;
	}

	let { children, fallback, onError }: Props = $props();

	let error = $state<Error | null>(null);

	function handleError(e: Event) {
		const errorEvent = e as ErrorEvent;
		const err = errorEvent.error instanceof Error 
			? errorEvent.error 
			: new Error(String(errorEvent.message));
		error = err;
		if (onError) {
			onError(err);
		}
		e.preventDefault();
	}

	function reset() {
		error = null;
	}
</script>

<svelte:window on:error={handleError} />

{#if error}
	{#if fallback}
		{@render fallback(error, reset)}
	{:else}
		<div class="error-boundary">
			<div class="error-container">
				<div class="error-icon">
					<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
					</svg>
				</div>
				<h2 class="error-title">Something went wrong</h2>
				<p class="error-message">{error.message}</p>
				<div class="error-actions">
					<Button variant="primary" on:click={reset}>
						Try Again
					</Button>
					<Button variant="secondary" on:click={() => window.location.reload()}>
						Reload App
					</Button>
				</div>
				{#if import.meta.env.DEV}
					<details class="error-stack">
						<summary>Error Details (Development Only)</summary>
						<pre>{error.stack}</pre>
					</details>
				{/if}
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 24px;
		background: var(--bg-tertiary, #1e1f22);
	}

	.error-container {
		max-width: 480px;
		width: 100%;
		text-align: center;
		padding: 32px;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
	}

	.error-icon {
		color: var(--red-400, #f23f43);
		margin-bottom: 16px;
	}

	.error-title {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
		margin: 0 0 12px 0;
	}

	.error-message {
		font-size: 16px;
		color: var(--text-muted, #b5bac1);
		margin: 0 0 24px 0;
		line-height: 1.5;
	}

	.error-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.error-stack {
		margin-top: 24px;
		text-align: left;
		color: var(--text-muted, #b5bac1);
	}

	.error-stack summary {
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		padding: 8px 0;
		user-select: none;
	}

	.error-stack summary:hover {
		color: var(--text-normal, #f2f3f5);
	}

	.error-stack pre {
		background: var(--bg-secondary, #2b2d31);
		padding: 16px;
		border-radius: 4px;
		overflow-x: auto;
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-normal, #f2f3f5);
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
