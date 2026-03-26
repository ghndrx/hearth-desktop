<script lang="ts">
	import { onMount } from 'svelte';
	import { auth, isAuthenticated, isLoading } from '$lib/stores/auth';
	import { gateway } from '$lib/gateway';
	import '$lib/styles/theme.css';
	import NativeEventBridge from '$lib/components/NativeEventBridge.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import ShortcutListener from '$lib/components/ShortcutListener.svelte';
	import UpdateNotification from '$lib/components/UpdateNotification.svelte';
	
	onMount(() => {
		auth.init();
	});
	
	// Connect gateway when authenticated
	$: if ($isAuthenticated) {
		const token = localStorage.getItem('hearth_token');
		if (token) {
			gateway.connect(token);
		}
	}
</script>

<svelte:head>
	<title>Hearth</title>
	<meta name="description" content="Self-hosted chat with E2EE" />
</svelte:head>

<NativeEventBridge />
<ToastContainer />
<ShortcutListener />
<UpdateNotification />

{#if $isLoading}
	<div class="loading">
		<div class="spinner"></div>
		<p>Loading...</p>
	</div>
{:else}
	<slot />
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
	
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		background: var(--bg-tertiary);
		color: var(--text-muted);
	}
	
	.spinner {
		width: 48px;
		height: 48px;
		border: 3px solid var(--bg-modifier-accent);
		border-top-color: var(--brand-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	
	.loading p {
		margin-top: 16px;
	}
</style>
