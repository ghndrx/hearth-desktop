<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let title = 'Settings';
	export let activeSection = '';
	export let sections: Array<{
		id: string;
		label: string;
		icon?: string;
		divider?: boolean;
		danger?: boolean;
	}> = [];

	const dispatch = createEventDispatcher<{
		close: void;
		select: string;
	}>();

	function close() {
		open = false;
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	function handleSectionClick(id: string) {
		if (!id.startsWith('divider')) {
			activeSection = id;
			dispatch('select', id);
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div
		class="settings-overlay"
		transition:fade={{ duration: 150 }}
		on:click|self={close}
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<div class="settings-container" transition:fly={{ y: 20, duration: 200 }}>
			<!-- Sidebar Navigation -->
			<nav class="settings-sidebar" aria-label="Settings navigation">
				<div class="sidebar-content">
					{#each sections as section}
						{#if section.divider}
							<div class="sidebar-divider">
								{#if section.label}
									<span>{section.label}</span>
								{/if}
							</div>
						{:else}
							<button
								class="sidebar-item"
								class:active={activeSection === section.id}
								class:danger={section.danger}
								on:click={() => handleSectionClick(section.id)}
							>
								{#if section.icon}
									<span class="item-icon">{section.icon}</span>
								{/if}
								<span class="item-label">{section.label}</span>
							</button>
						{/if}
					{/each}
				</div>
			</nav>

			<!-- Content Area -->
			<main class="settings-content">
				<div class="content-header">
					<h1 id="settings-title">{title}</h1>
					<button class="close-btn" on:click={close} aria-label="Close settings">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M18 6L6 18M6 6L18 18"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</button>
				</div>
				<div class="content-body">
					<slot />
				</div>
			</main>
		</div>
	</div>
{/if}

<style>
	.settings-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.settings-container {
		display: flex;
		width: 100%;
		max-width: 1200px;
		height: 100%;
		max-height: 800px;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		overflow: hidden;
	}

	.settings-sidebar {
		width: 280px;
		background: var(--bg-secondary, #2b2d31);
		padding: 24px 16px;
		overflow-y: auto;
		flex-shrink: 0;
	}

	.sidebar-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-divider {
		padding: 16px 8px 8px;
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--text-muted, #b5bac1);
		letter-spacing: 0.02em;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: var(--text-muted, #b5bac1);
		font-size: 14px;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.sidebar-item:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}

	.sidebar-item.active {
		background: var(--bg-modifier-selected, #404249);
		color: var(--text-normal, #f2f3f5);
	}

	.sidebar-item.danger {
		color: var(--red, #da373c);
	}

	.sidebar-item.danger:hover {
		background: rgba(218, 55, 60, 0.1);
	}

	.item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		font-size: 12px;
	}

	.item-label {
		flex: 1;
	}

	.settings-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.content-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 32px;
		border-bottom: 1px solid var(--bg-secondary, #2b2d31);
	}

	.content-header h1 {
		margin: 0;
		font-size: 24px;
		font-weight: 600;
		color: var(--text-normal, #f2f3f5);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		color: var(--text-muted, #b5bac1);
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}

	.content-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px 32px;
	}

	@media (max-width: 1024px) {
		.settings-container {
			max-width: 100%;
			max-height: 100%;
			border-radius: 0;
		}

		.settings-sidebar {
			width: 240px;
		}
	}

	@media (max-width: 768px) {
		.settings-container {
			flex-direction: column;
		}

		.settings-sidebar {
			width: 100%;
			height: auto;
			max-height: 200px;
			padding: 16px;
			border-bottom: 1px solid var(--bg-secondary, #2b2d31);
		}

		.sidebar-content {
			flex-direction: row;
			flex-wrap: wrap;
			gap: 4px;
		}

		.sidebar-divider {
			width: 100%;
			padding: 8px 4px 4px;
		}

		.sidebar-item {
			flex: 0 0 auto;
			padding: 6px 12px;
		}
	}
</style>
