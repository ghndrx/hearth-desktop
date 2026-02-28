<script lang="ts">
	import {
		biometricCapabilities,
		checkBiometrics,
		storeAuthToken,
		getAuthToken,
		clearAuthToken
	} from '$lib/stores/nativeAuth';
	import { onMount } from 'svelte';

	let keychainStatus = $state<'idle' | 'stored' | 'error'>('idle');
	let statusMessage = $state('');

	onMount(async () => {
		await checkBiometrics();
		const token = await getAuthToken();
		if (token) {
			keychainStatus = 'stored';
			statusMessage = 'Auth token stored in system keychain';
		}
	});

	async function handleSaveToken() {
		try {
			// Get current token from session storage or auth store
			const token = sessionStorage.getItem('auth_token');
			if (!token) {
				statusMessage = 'No token to save';
				keychainStatus = 'error';
				return;
			}
			await storeAuthToken(token);
			keychainStatus = 'stored';
			statusMessage = 'Token saved to system keychain';
		} catch (e) {
			keychainStatus = 'error';
			statusMessage = `Failed: ${e}`;
		}
	}

	async function handleClearToken() {
		try {
			await clearAuthToken();
			keychainStatus = 'idle';
			statusMessage = 'Token removed from keychain';
		} catch (e) {
			keychainStatus = 'error';
			statusMessage = `Failed: ${e}`;
		}
	}
</script>

<div class="native-auth">
	<div class="auth-section">
		<h4>Keychain Storage</h4>
		<p class="description">Store your login credentials securely in the system keychain.</p>

		<div class="status" class:stored={keychainStatus === 'stored'} class:error={keychainStatus === 'error'}>
			{#if keychainStatus === 'stored'}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				</svg>
				Credentials stored securely
			{:else if keychainStatus === 'error'}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="15" y1="9" x2="9" y2="15" />
					<line x1="9" y1="9" x2="15" y2="15" />
				</svg>
				{statusMessage}
			{:else}
				No credentials stored
			{/if}
		</div>

		<div class="auth-actions">
			<button class="btn primary" onclick={handleSaveToken}>
				Save to Keychain
			</button>
			{#if keychainStatus === 'stored'}
				<button class="btn danger" onclick={handleClearToken}>
					Remove
				</button>
			{/if}
		</div>
	</div>

	{#if $biometricCapabilities.available}
		<div class="auth-section">
			<h4>Biometric Unlock</h4>
			<p class="description">
				Use {$biometricCapabilities.methods.join(', ')} to unlock Hearth.
			</p>
			<div class="biometric-badge">
				Available
			</div>
		</div>
	{/if}
</div>

<style>
	.native-auth {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.auth-section {
		padding: 12px;
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
	}

	.auth-section h4 {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-normal, #dcddde);
	}

	.description {
		margin: 0 0 8px;
		font-size: 12px;
		color: var(--text-muted, #8e9297);
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 12px;
		color: var(--text-muted, #8e9297);
		background: var(--bg-tertiary, #202225);
		margin-bottom: 8px;
	}

	.status.stored {
		color: #43b581;
	}

	.status.error {
		color: #f04747;
	}

	.auth-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.btn:hover {
		opacity: 0.85;
	}

	.btn.primary {
		background: var(--brand-experiment, #5865f2);
		color: white;
	}

	.btn.danger {
		background: #f04747;
		color: white;
	}

	.biometric-badge {
		display: inline-flex;
		padding: 4px 8px;
		background: rgba(67, 181, 129, 0.15);
		color: #43b581;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 600;
	}
</style>
