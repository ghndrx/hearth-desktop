<script lang="ts">
	import { Sidebar } from '$lib';
	import NotificationDemo from '$lib/components/NotificationDemo.svelte';
	import NotificationSettings from '$lib/components/NotificationSettings.svelte';
	import { writable } from 'svelte/store';

	const activeTab = writable('demo');
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar />

	<main class="flex-1 flex flex-col bg-dark-800 overflow-hidden">
		<!-- Tab Navigation -->
		<div class="flex border-b border-gray-700 bg-dark-700">
			<button
				class="px-4 py-3 text-sm font-medium transition-colors {$activeTab === 'welcome' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}"
				on:click={() => $activeTab = 'welcome'}
			>
				Welcome
			</button>
			<button
				class="px-4 py-3 text-sm font-medium transition-colors {$activeTab === 'demo' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}"
				on:click={() => $activeTab = 'demo'}
			>
				Notification Demo
			</button>
			<button
				class="px-4 py-3 text-sm font-medium transition-colors {$activeTab === 'settings' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-gray-200'}"
				on:click={() => $activeTab = 'settings'}
			>
				Notification Settings
			</button>
		</div>

		<!-- Tab Content -->
		<div class="flex-1 overflow-auto">
			{#if $activeTab === 'welcome'}
				<div class="flex-1 flex items-center justify-center h-full">
					<div class="text-center">
						<h1 class="text-2xl font-bold text-gray-100 mb-2">Welcome to Hearth</h1>
						<p class="text-gray-400 mb-4">Select a server or start a conversation</p>
						<p class="text-gray-500 text-sm">Try the Notification Demo tab to test the new notification system!</p>
					</div>
				</div>
			{:else if $activeTab === 'demo'}
				<div class="p-6">
					<NotificationDemo />
				</div>
			{:else if $activeTab === 'settings'}
				<div class="p-6">
					<NotificationSettings />
				</div>
			{/if}
		</div>
	</main>
</div>
