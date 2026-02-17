<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	
	onMount(() => {
		// Redirect based on auth status
		if ($isAuthenticated) {
			goto('/channels/@me');
		} else {
			goto('/login');
		}
	});
	
	$: if ($isAuthenticated !== undefined) {
		if ($isAuthenticated) {
			goto('/channels/@me');
		}
	}
</script>

<div class="landing">
	<div class="hero">
		<h1>🔥 Hearth</h1>
		<p>Self-hosted chat with end-to-end encryption</p>
		<div class="buttons">
			<a href="/login" class="btn primary">Log In</a>
			<a href="/register" class="btn secondary">Sign Up</a>
		</div>
	</div>
</div>

<style>
	.landing {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: var(--bg-tertiary);
	}
	
	.hero {
		text-align: center;
		padding: 32px;
	}
	
	h1 {
		font-size: 64px;
		margin-bottom: 16px;
		color: var(--text-primary);
	}
	
	p {
		font-size: 20px;
		color: var(--text-muted);
		margin-bottom: 32px;
	}
	
	.buttons {
		display: flex;
		gap: 16px;
		justify-content: center;
	}
	
	.btn {
		padding: 12px 32px;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.15s ease;
	}
	
	.btn.primary {
		background: var(--brand-primary);
		color: white;
	}
	
	.btn.primary:hover {
		background: var(--brand-hover);
	}
	
	.btn.secondary {
		background: transparent;
		color: var(--text-primary);
		border: 1px solid var(--text-muted);
	}
	
	.btn.secondary:hover {
		border-color: var(--text-primary);
	}
</style>
