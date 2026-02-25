<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { globalShortcuts } from '$lib/stores/globalShortcuts';

	export let open = false;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	interface ShortcutCategory {
		name: string;
		icon: string;
		shortcuts: Array<{
			keys: string[];
			description: string;
			global?: boolean;
		}>;
	}

	const categories: ShortcutCategory[] = [
		{
			name: 'Navigation',
			icon: '🧭',
			shortcuts: [
				{ keys: ['Ctrl', 'K'], description: 'Open Quick Switcher' },
				{ keys: ['Ctrl', 'Shift', 'H'], description: 'Toggle window visibility', global: true },
				{ keys: ['Ctrl', 'Shift', 'S'], description: 'Show window', global: true },
				{ keys: ['Alt', '↑'], description: 'Go to previous channel' },
				{ keys: ['Alt', '↓'], description: 'Go to next channel' },
				{ keys: ['Ctrl', 'Tab'], description: 'Switch to next server' },
				{ keys: ['Ctrl', 'Shift', 'Tab'], description: 'Switch to previous server' },
				{ keys: ['Ctrl', '1-9'], description: 'Jump to server by position' },
			]
		},
		{
			name: 'Messages',
			icon: '💬',
			shortcuts: [
				{ keys: ['Enter'], description: 'Send message' },
				{ keys: ['Shift', 'Enter'], description: 'New line in message' },
				{ keys: ['↑'], description: 'Edit last message (when input empty)' },
				{ keys: ['Ctrl', 'E'], description: 'Toggle emoji picker' },
				{ keys: ['Ctrl', 'G'], description: 'Toggle GIF picker' },
				{ keys: ['@'], description: 'Mention user or role' },
				{ keys: ['#'], description: 'Link a channel' },
				{ keys: [':'], description: 'Emoji autocomplete' },
			]
		},
		{
			name: 'Voice & Video',
			icon: '🎤',
			shortcuts: [
				{ keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle deafen' },
				{ keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle mute', global: true },
				{ keys: ['Ctrl', 'Shift', 'V'], description: 'Toggle video' },
				{ keys: ['Ctrl', 'Shift', 'E'], description: 'Toggle screenshare' },
			]
		},
		{
			name: 'Window',
			icon: '🪟',
			shortcuts: [
				{ keys: ['Ctrl', 'Shift', 'P'], description: 'Toggle mini mode (PiP)', global: true },
				{ keys: ['Ctrl', 'Shift', 'F'], description: 'Toggle focus mode', global: true },
				{ keys: ['Ctrl', '+'], description: 'Zoom in' },
				{ keys: ['Ctrl', '-'], description: 'Zoom out' },
				{ keys: ['Ctrl', '0'], description: 'Reset zoom' },
				{ keys: ['F11'], description: 'Toggle fullscreen' },
				{ keys: ['Ctrl', 'W'], description: 'Close current tab/panel' },
			]
		},
		{
			name: 'Search & Find',
			icon: '🔍',
			shortcuts: [
				{ keys: ['Ctrl', 'F'], description: 'Search in current channel' },
				{ keys: ['Ctrl', 'Shift', 'F'], description: 'Search everywhere' },
				{ keys: ['Ctrl', 'P'], description: 'Search pinned messages' },
			]
		},
		{
			name: 'Quick Actions',
			icon: '⚡',
			shortcuts: [
				{ keys: ['Ctrl', '/'], description: 'Show this help' },
				{ keys: ['?'], description: 'Show this help' },
				{ keys: ['Ctrl', ','], description: 'Open settings' },
				{ keys: ['Ctrl', 'Shift', 'I'], description: 'Open developer tools' },
				{ keys: ['Escape'], description: 'Close modal / Cancel action' },
			]
		},
	];

	let searchQuery = '';
	let filteredCategories = categories;
	let inputEl: HTMLInputElement;

	$: {
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filteredCategories = categories
				.map(cat => ({
					...cat,
					shortcuts: cat.shortcuts.filter(
						s => s.description.toLowerCase().includes(query) ||
							s.keys.some(k => k.toLowerCase().includes(query))
					)
				}))
				.filter(cat => cat.shortcuts.length > 0);
		} else {
			filteredCategories = categories;
		}
	}

	function close() {
		searchQuery = '';
		dispatch('close');
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}

	function formatKey(key: string): string {
		// Convert key names to symbols for macOS style
		const keyMap: Record<string, string> = {
			'Ctrl': '⌘',
			'Alt': '⌥',
			'Shift': '⇧',
			'Enter': '↵',
			'Escape': 'Esc',
			'Tab': '⇥',
		};
		return keyMap[key] || key;
	}

	$: if (open) {
		// Focus search input when modal opens
		setTimeout(() => inputEl?.focus(), 50);
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="modal-backdrop" 
		on:click={handleBackdropClick}
		transition:fade={{ duration: 150 }}
	>
		<div 
			class="modal" 
			role="dialog" 
			aria-modal="true" 
			aria-labelledby="shortcuts-title"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<header class="modal-header">
				<div class="header-content">
					<h2 id="shortcuts-title">⌨️ Keyboard Shortcuts</h2>
					<p class="subtitle">Master Hearth with these shortcuts</p>
				</div>
				<button class="close-button" on:click={close} aria-label="Close">
					<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
						<path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
					</svg>
				</button>
			</header>

			<div class="search-container">
				<svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.403 14.9 16.314L20.293 21.707L21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={searchQuery}
					type="text"
					class="search-input"
					placeholder="Search shortcuts..."
					aria-label="Search keyboard shortcuts"
				/>
				{#if searchQuery}
					<button class="clear-button" on:click={() => searchQuery = ''} aria-label="Clear search">
						✕
					</button>
				{/if}
			</div>

			<div class="shortcuts-content">
				{#if filteredCategories.length === 0}
					<div class="no-results">
						<p>No shortcuts found for "{searchQuery}"</p>
					</div>
				{:else}
					<div class="categories-grid">
						{#each filteredCategories as category (category.name)}
							<section class="category">
								<h3 class="category-title">
									<span class="category-icon">{category.icon}</span>
									{category.name}
								</h3>
								<ul class="shortcuts-list">
									{#each category.shortcuts as shortcut}
										<li class="shortcut-item">
											<span class="shortcut-description">
												{shortcut.description}
												{#if shortcut.global}
													<span class="global-badge" title="Works even when Hearth is not focused">
														Global
													</span>
												{/if}
											</span>
											<span class="shortcut-keys">
												{#each shortcut.keys as key, i}
													<kbd class="key">{formatKey(key)}</kbd>
													{#if i < shortcut.keys.length - 1}
														<span class="key-separator">+</span>
													{/if}
												{/each}
											</span>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				{/if}
			</div>

			<footer class="modal-footer">
				<div class="footer-hint">
					<kbd class="key">?</kbd>
					<span>or</span>
					<kbd class="key">⌘</kbd>
					<kbd class="key">/</kbd>
					<span>to open this anytime</span>
				</div>
				<div class="custom-shortcuts-link">
					<a href="/settings/keybinds" on:click={close}>
						Customize shortcuts →
					</a>
				</div>
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		padding: 20px;
	}

	.modal {
		width: 100%;
		max-width: 800px;
		max-height: 85vh;
		background: var(--bg-floating, #313338);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--border-subtle, #1e1f22);
	}

	.header-content h2 {
		margin: 0;
		font-size: 22px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
	}

	.subtitle {
		margin: 4px 0 0;
		font-size: 14px;
		color: var(--text-muted, #949ba4);
	}

	.close-button {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-button:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-normal, #f2f3f5);
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 24px;
		background: var(--bg-secondary, #2b2d31);
	}

	.search-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		color: var(--text-normal, #f2f3f5);
		font-size: 15px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.clear-button {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		font-size: 12px;
		transition: all 0.15s ease;
	}

	.clear-button:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.6));
		color: var(--text-normal, #f2f3f5);
	}

	.shortcuts-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px 24px;
	}

	.no-results {
		text-align: center;
		padding: 40px;
		color: var(--text-muted, #949ba4);
	}

	.categories-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 24px;
	}

	.category {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 16px;
	}

	.category-title {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-normal, #f2f3f5);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.category-icon {
		font-size: 16px;
	}

	.shortcuts-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 0;
	}

	.shortcut-description {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--text-normal, #dbdee1);
	}

	.global-badge {
		font-size: 10px;
		font-weight: 600;
		color: var(--brand-primary, #5865f2);
		background: rgba(88, 101, 242, 0.15);
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.shortcut-keys {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border-subtle, #3f4147);
		border-radius: 4px;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted, #b5bac1);
		box-shadow: 0 1px 0 var(--border-subtle, #3f4147);
	}

	.key-separator {
		color: var(--text-muted, #72767d);
		font-size: 11px;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		background: var(--bg-secondary, #2b2d31);
		border-top: 1px solid var(--border-subtle, #1e1f22);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.footer-hint .key {
		min-width: 20px;
		height: 20px;
		font-size: 11px;
	}

	.custom-shortcuts-link a {
		font-size: 13px;
		color: var(--brand-primary, #5865f2);
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.custom-shortcuts-link a:hover {
		color: var(--brand-primary-hover, #4752c4);
		text-decoration: underline;
	}

	/* Scrollbar styling */
	.shortcuts-content::-webkit-scrollbar {
		width: 8px;
	}

	.shortcuts-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.shortcuts-content::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb, #1a1b1e);
		border-radius: 4px;
	}

	.shortcuts-content::-webkit-scrollbar-thumb:hover {
		background: var(--scrollbar-thumb-hover, #2e3035);
	}
</style>
