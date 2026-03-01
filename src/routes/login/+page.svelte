<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	
	let email = '';
	let password = '';
	let error = '';
	let loading = false;
	let oauthProviders: string[] = [];
	let oauthLoading = '';
	
	onMount(async () => {
		// Fetch enabled OAuth providers
		const result = await auth.getOAuthProviders();
		oauthProviders = result.providers;
	});
	
	async function handleSubmit() {
		error = '';
		loading = true;
		
		try {
			await auth.login(email, password);
		} catch (e: any) {
			error = e.message || 'Login failed';
		} finally {
			loading = false;
		}
	}
	
	async function handleOAuthLogin(provider: string) {
		error = '';
		oauthLoading = provider;
		
		try {
			// Store provider for callback
			localStorage.setItem('oauth_pending_provider', provider);
			await auth.startOAuthLogin(provider);
		} catch (e: any) {
			localStorage.removeItem('oauth_pending_provider');
			error = e.message || `${provider} login failed`;
			oauthLoading = '';
		}
	}
	
	const providerInfo: Record<string, { name: string; icon: string; color: string }> = {
		github: { name: 'GitHub', icon: '🐙', color: '#24292e' },
		google: { name: 'Google', icon: '🔍', color: '#4285f4' },
		discord: { name: 'Discord', icon: '🎮', color: '#5865f2' }
	};
</script>

<div class="auth-page">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Welcome back!</h1>
			<p>We're so excited to see you again!</p>
		</div>
		
		{#if error}
			<div class="error">{error}</div>
		{/if}
		
		<!-- OAuth Providers -->
		{#if oauthProviders.length > 0}
			<div class="oauth-section">
				{#each oauthProviders as provider}
					{@const info = providerInfo[provider] || { name: provider, icon: '🔗', color: '#666' }}
					<button
						type="button"
						class="oauth-btn"
						style="--provider-color: {info.color}"
						disabled={!!oauthLoading}
						on:click={() => handleOAuthLogin(provider)}
					>
						{#if oauthLoading === provider}
							<span class="oauth-spinner"></span>
						{:else}
							<span class="oauth-icon">{info.icon}</span>
						{/if}
						<span>Continue with {info.name}</span>
					</button>
				{/each}
			</div>
			
			<div class="divider">
				<span>or</span>
			</div>
		{/if}
		
		<form on:submit|preventDefault={handleSubmit}>
			<div class="form-group">
				<label for="email">EMAIL</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					disabled={loading || !!oauthLoading}
				/>
			</div>
			
			<div class="form-group">
				<label for="password">PASSWORD</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					disabled={loading || !!oauthLoading}
				/>
				<a href="/forgot-password" class="forgot">Forgot your password?</a>
			</div>
			
			<button type="submit" class="submit-btn" disabled={loading || !!oauthLoading}>
				{loading ? 'Logging in...' : 'Log In'}
			</button>
			
			<p class="register-link">
				Need an account? <a href="/register">Register</a>
			</p>
		</form>
	</div>
</div>

<style>
	.auth-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg-tertiary);
		padding: 20px;
	}
	
	.oauth-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 20px;
	}
	
	.oauth-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		padding: 12px;
		background: var(--provider-color);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.1s ease;
	}
	
	.oauth-btn:hover:not(:disabled) {
		opacity: 0.9;
	}
	
	.oauth-btn:active:not(:disabled) {
		transform: scale(0.98);
	}
	
	.oauth-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	
	.oauth-icon {
		font-size: 18px;
	}
	
	.oauth-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 24px 0;
		color: var(--text-muted);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
	}
	
	.divider span {
		padding: 0 16px;
	}
	
	.auth-card {
		background: var(--bg-primary);
		border-radius: 8px;
		padding: 32px;
		width: 100%;
		max-width: 480px;
		box-shadow: var(--shadow-elevation-high);
	}
	
	.auth-header {
		text-align: center;
		margin-bottom: 24px;
	}
	
	.auth-header h1 {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 8px;
	}
	
	.auth-header p {
		color: var(--text-muted);
	}
	
	.error {
		background: rgba(242, 63, 67, 0.1);
		border: 1px solid var(--status-danger);
		color: var(--status-danger);
		padding: 10px;
		border-radius: 4px;
		margin-bottom: 16px;
		font-size: 14px;
	}
	
	.form-group {
		margin-bottom: 20px;
	}
	
	label {
		display: block;
		margin-bottom: 8px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		letter-spacing: 0.02em;
	}
	
	input {
		width: 100%;
		padding: 10px;
		background: var(--bg-tertiary);
		border: none;
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 16px;
	}
	
	input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--brand-primary);
	}
	
	input:disabled {
		opacity: 0.5;
	}
	
	.forgot {
		display: block;
		margin-top: 4px;
		font-size: 14px;
		color: var(--text-link);
	}
	
	.submit-btn {
		width: 100%;
		padding: 12px;
		background: var(--brand-primary);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 16px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	
	.submit-btn:hover:not(:disabled) {
		background: var(--brand-hover);
	}
	
	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.register-link {
		text-align: center;
		margin-top: 16px;
		color: var(--text-muted);
		font-size: 14px;
	}
	
	.register-link a {
		color: var(--text-link);
	}
</style>
