<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores/auth';

	let error = '';
	let loading = true;

	onMount(async () => {
		const searchParams = $page.url.searchParams;
		const code = searchParams.get('code');
		const state = searchParams.get('state');
		const oauthError = searchParams.get('error');
		const errorDescription = searchParams.get('error_description');

		if (oauthError) {
			error = errorDescription || `OAuth error: ${oauthError}`;
			loading = false;
			return;
		}

		if (!code || !state) {
			error = 'Missing authorization code or state parameter';
			loading = false;
			return;
		}

		// Provider stored before redirect
		const provider = localStorage.getItem('oauth_pending_provider');
		localStorage.removeItem('oauth_pending_provider');

		if (!provider) {
			error = 'Could not determine OAuth provider. Please try again.';
			loading = false;
			return;
		}

		try {
			await auth.handleOAuthCallback(provider, code, state);
		} catch (e: any) {
			console.error('OAuth callback error:', e);
			error = e.message || 'OAuth authentication failed. Please try again.';
			loading = false;
		}
	});
</script>

<div class="callback-page">
	<div class="callback-card">
		{#if loading}
			<div class="loading">
				<div class="spinner"></div>
				<h2>Completing sign in...</h2>
				<p>Please wait while we verify your account.</p>
			</div>
		{:else if error}
			<div class="error-state">
				<div class="error-icon">&#x26A0;&#xFE0F;</div>
				<h2>Authentication Failed</h2>
				<p class="error-message">{error}</p>
				<div class="actions">
					<a href="/login" class="btn primary">Back to Login</a>
					<button class="btn secondary" on:click={() => history.back()}>
						Try Again
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.callback-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg-tertiary, #1e1f22);
		padding: 20px;
	}

	.callback-card {
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		padding: 48px;
		width: 100%;
		max-width: 400px;
		text-align: center;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 3px solid var(--bg-tertiary, #1e1f22);
		border-top-color: var(--brand-primary, #5865f2);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		margin: 0;
	}

	.loading p {
		color: var(--text-muted, #949ba4);
		margin: 0;
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.error-icon {
		font-size: 48px;
	}

	.error-state h2 {
		font-size: 20px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		margin: 0;
	}

	.error-message {
		color: var(--status-danger, #f23f43);
		margin: 0;
		font-size: 14px;
		background: rgba(242, 63, 67, 0.1);
		padding: 12px 16px;
		border-radius: 4px;
		width: 100%;
	}

	.actions {
		display: flex;
		gap: 12px;
		margin-top: 8px;
	}

	.btn {
		padding: 12px 24px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.btn.primary {
		background: var(--brand-primary, #5865f2);
		color: white;
		border: none;
	}

	.btn.primary:hover {
		background: var(--brand-hover, #4752c4);
	}

	.btn.secondary {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #f2f3f5);
		border: none;
	}

	.btn.secondary:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
	}
</style>
