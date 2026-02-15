<script lang="ts">
	import { ui, searchOpen } from '$lib/stores/ui';
	import { fade, scale } from 'svelte/transition';

	let searchQuery = $state('');
	let inputElement: HTMLInputElement | undefined = $state();

	function close() {
		ui.setSearchOpen(false);
		searchQuery = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	$effect(() => {
		if ($searchOpen && inputElement) {
			inputElement.focus();
		}
	});
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $searchOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="search-backdrop" transition:fade={{ duration: 100 }} onclick={handleBackdropClick}>
		<div
			class="search-modal"
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			transition:scale={{ duration: 100, start: 0.95 }}
		>
			<div class="search-header">
				<svg class="search-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M21.707 20.293l-4.054-4.054A8.46 8.46 0 0 0 19.5 11 8.5 8.5 0 1 0 11 19.5a8.46 8.46 0 0 0 5.239-1.847l4.054 4.054a1 1 0 0 0 1.414-1.414zM11 17.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13z"/>
				</svg>
				<input
					bind:this={inputElement}
					bind:value={searchQuery}
					type="text"
					placeholder="Search messages, channels, users..."
					class="search-input"
				/>
				<span class="shortcut-hint">ESC</span>
			</div>
			<div class="search-content">
				{#if searchQuery.length === 0}
					<div class="search-hint">
						<p>Start typing to search</p>
						<div class="search-tips">
							<div class="tip"><code>from:</code> Search by sender</div>
							<div class="tip"><code>in:</code> Search in channel</div>
							<div class="tip"><code>has:</code> Filter by content type</div>
						</div>
					</div>
				{:else}
					<div class="search-results">
						<p class="no-results">No results found for "{searchQuery}"</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.search-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		z-index: 1000;
		padding-top: 100px;
	}

	.search-modal {
		width: 550px;
		max-width: 90vw;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 8px 16px rgba(0, 0, 0, 0.24);
		overflow: hidden;
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.search-icon {
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		font-size: 16px;
		color: var(--text-normal, #f2f3f5);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #b5bac1);
	}

	.shortcut-hint {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted, #b5bac1);
		background: var(--bg-tertiary, #1e1f22);
		padding: 4px 8px;
		border-radius: 4px;
	}

	.search-content {
		padding: 16px;
		min-height: 150px;
		max-height: 400px;
		overflow-y: auto;
	}

	.search-hint {
		text-align: center;
		color: var(--text-muted, #b5bac1);
	}

	.search-hint p {
		margin: 0 0 16px 0;
	}

	.search-tips {
		display: flex;
		flex-direction: column;
		gap: 8px;
		text-align: left;
		max-width: 300px;
		margin: 0 auto;
	}

	.tip {
		font-size: 13px;
	}

	.tip code {
		background: var(--bg-tertiary, #1e1f22);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: monospace;
		color: var(--text-normal, #f2f3f5);
	}

	.search-results {
		color: var(--text-muted, #b5bac1);
	}

	.no-results {
		text-align: center;
		margin: 0;
	}
</style>
