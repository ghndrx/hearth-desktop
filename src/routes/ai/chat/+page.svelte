<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import AIChat from '$lib/components/AIChat.svelte';

	onMount(() => {
		// Redirect to login if not authenticated
		if (!$isAuthenticated) {
			goto('/login');
		}
	});
</script>

<svelte:head>
	<title>AI Chat | Hearth</title>
</svelte:head>

{#if $isAuthenticated}
	<div class="ai-chat-page">
		<AIChat visible={true} />
	</div>
{/if}

<style>
	.ai-chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-primary, #1a1a1a);
	}
</style>
