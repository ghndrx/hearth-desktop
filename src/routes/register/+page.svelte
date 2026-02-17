<script lang="ts">
	import { auth } from '$lib/stores/auth';
	
	let email = '';
	let username = '';
	let password = '';
	let error = '';
	let loading = false;
	
	async function handleSubmit() {
		error = '';
		loading = true;
		
		try {
			await auth.register(email, username, password);
		} catch (e: any) {
			error = e.message || 'Registration failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="auth-page">
	<div class="auth-card">
		<div class="auth-header">
			<h1>Create an account</h1>
		</div>
		
		<form on:submit|preventDefault={handleSubmit}>
			{#if error}
				<div class="error">{error}</div>
			{/if}
			
			<div class="form-group">
				<label for="email">EMAIL</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					disabled={loading}
				/>
			</div>
			
			<div class="form-group">
				<label for="username">USERNAME</label>
				<input
					type="text"
					id="username"
					bind:value={username}
					required
					minlength="2"
					maxlength="32"
					disabled={loading}
				/>
			</div>
			
			<div class="form-group">
				<label for="password">PASSWORD</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					minlength="8"
					disabled={loading}
				/>
			</div>
			
			<button type="submit" class="submit-btn" disabled={loading}>
				{loading ? 'Creating account...' : 'Continue'}
			</button>
			
			<p class="tos">
				By registering, you agree to Hearth's <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
			</p>
			
			<p class="login-link">
				<a href="/login">Already have an account?</a>
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
	
	.tos {
		margin-top: 16px;
		font-size: 12px;
		color: var(--text-muted);
		text-align: center;
	}
	
	.tos a {
		color: var(--text-link);
	}
	
	.login-link {
		text-align: center;
		margin-top: 16px;
		font-size: 14px;
	}
	
	.login-link a {
		color: var(--text-link);
	}
</style>
