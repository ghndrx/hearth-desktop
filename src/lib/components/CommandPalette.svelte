<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { ui, searchOpen, helpOpen } from '$lib/stores/ui';
	import { goto } from '$app/navigation';
	import { writable } from 'svelte/store';

	const dispatch = createEventDispatcher();

	export let isOpen = writable(false);
	
	let searchInput: HTMLInputElement;
	let query = '';
	let selectedIndex = 0;
	let filteredCommands: Command[] = [];

	interface Command {
		id: string;
		label: string;
		description?: string;
		category: 'navigation' | 'action' | 'view' | 'settings' | 'help';
		icon: string;
		shortcut?: string[];
		action: () => void | Promise<void>;
	}

	const commands: Command[] = [
		// Navigation
		{
			id: 'goto-home',
			label: 'Go to Home',
			description: 'Navigate to home/friends view',
			category: 'navigation',
			icon: '🏠',
			action: () => goto('/')
		},
		{
			id: 'goto-settings',
			label: 'Open Settings',
			description: 'Open user settings',
			category: 'settings',
			icon: '⚙️',
			shortcut: ['Ctrl', ','],
			action: () => dispatch('openSettings')
		},
		{
			id: 'goto-dms',
			label: 'Direct Messages',
			description: 'View your direct messages',
			category: 'navigation',
			icon: '💬',
			action: () => dispatch('openDMs')
		},
		// Actions
		{
			id: 'search',
			label: 'Search Messages',
			description: 'Search in current server or DM',
			category: 'action',
			icon: '🔍',
			shortcut: ['Ctrl', 'K'],
			action: () => ui.setSearchOpen(true)
		},
		{
			id: 'new-dm',
			label: 'New Direct Message',
			description: 'Start a new conversation',
			category: 'action',
			icon: '✉️',
			action: () => dispatch('newDM')
		},
		{
			id: 'create-server',
			label: 'Create Server',
			description: 'Create a new server',
			category: 'action',
			icon: '➕',
			action: () => dispatch('createServer')
		},
		{
			id: 'join-server',
			label: 'Join Server',
			description: 'Join an existing server with invite',
			category: 'action',
			icon: '🔗',
			action: () => dispatch('joinServer')
		},
		// View
		{
			id: 'toggle-sidebar',
			label: 'Toggle Sidebar',
			description: 'Show or hide the sidebar',
			category: 'view',
			icon: '📱',
			shortcut: ['Ctrl', '\\'],
			action: () => dispatch('toggleSidebar')
		},
		{
			id: 'toggle-members',
			label: 'Toggle Member List',
			description: 'Show or hide the member list',
			category: 'view',
			icon: '👥',
			shortcut: ['Ctrl', 'Shift', 'I'],
			action: () => dispatch('toggleMembers')
		},
		{
			id: 'toggle-pins',
			label: 'Show Pinned Messages',
			description: 'View pinned messages in channel',
			category: 'view',
			icon: '📌',
			action: () => dispatch('showPins')
		},
		{
			id: 'toggle-threads',
			label: 'Show Active Threads',
			description: 'View active threads in channel',
			category: 'view',
			icon: '🧵',
			action: () => dispatch('showThreads')
		},
		// Settings/Preferences
		{
			id: 'toggle-mute',
			label: 'Toggle Mute',
			description: 'Mute/unmute your microphone',
			category: 'action',
			icon: '🎤',
			shortcut: ['Ctrl', 'Shift', 'M'],
			action: () => dispatch('toggleMute')
		},
		{
			id: 'toggle-deafen',
			label: 'Toggle Deafen',
			description: 'Deafen/undeafen audio',
			category: 'action',
			icon: '🎧',
			shortcut: ['Ctrl', 'Shift', 'D'],
			action: () => dispatch('toggleDeafen')
		},
		{
			id: 'focus-mode',
			label: 'Toggle Focus Mode',
			description: 'Only show mentions and DMs',
			category: 'action',
			icon: '🎯',
			action: () => dispatch('toggleFocusMode')
		},
		// Help
		{
			id: 'keyboard-shortcuts',
			label: 'Keyboard Shortcuts',
			description: 'View all keyboard shortcuts',
			category: 'help',
			icon: '⌨️',
			shortcut: ['Ctrl', '/'],
			action: () => ui.setHelpOpen(true)
		},
		{
			id: 'about',
			label: 'About Hearth',
			description: 'View version and credits',
			category: 'help',
			icon: 'ℹ️',
			action: () => dispatch('showAbout')
		},
		{
			id: 'check-updates',
			label: 'Check for Updates',
			description: 'Check if a new version is available',
			category: 'help',
			icon: '🔄',
			action: () => dispatch('checkUpdates')
		},
		{
			id: 'report-bug',
			label: 'Report a Bug',
			description: 'Open bug report form',
			category: 'help',
			icon: '🐛',
			action: () => dispatch('reportBug')
		}
	];

	function fuzzyMatch(text: string, query: string): boolean {
		const lowerText = text.toLowerCase();
		const lowerQuery = query.toLowerCase();
		
		let queryIndex = 0;
		for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
			if (lowerText[i] === lowerQuery[queryIndex]) {
				queryIndex++;
			}
		}
		return queryIndex === lowerQuery.length;
	}

	function filterCommands(query: string): Command[] {
		if (!query.trim()) {
			return commands;
		}
		
		return commands.filter(cmd => 
			fuzzyMatch(cmd.label, query) || 
			fuzzyMatch(cmd.description || '', query) ||
			fuzzyMatch(cmd.category, query)
		).sort((a, b) => {
			// Prioritize exact prefix matches
			const aStartsWith = a.label.toLowerCase().startsWith(query.toLowerCase());
			const bStartsWith = b.label.toLowerCase().startsWith(query.toLowerCase());
			if (aStartsWith && !bStartsWith) return -1;
			if (!aStartsWith && bStartsWith) return 1;
			return 0;
		});
	}

	$: filteredCommands = filterCommands(query);
	$: if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
		selectedIndex = 0;
	}

	function open() {
		$isOpen = true;
		query = '';
		selectedIndex = 0;
		// Focus input after the modal renders
		requestAnimationFrame(() => {
			searchInput?.focus();
		});
	}

	function close() {
		$isOpen = false;
		query = '';
		selectedIndex = 0;
	}

	function executeCommand(command: Command) {
		close();
		command.action();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!$isOpen) {
			// Open command palette with Ctrl+Shift+P
			if (e.ctrlKey && e.shiftKey && e.key === 'P') {
				e.preventDefault();
				open();
			}
			return;
		}

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				close();
				break;
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
				scrollToSelected();
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				scrollToSelected();
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					executeCommand(filteredCommands[selectedIndex]);
				}
				break;
		}
	}

	function scrollToSelected() {
		const selected = document.querySelector('.command-item.selected');
		selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function getCategoryLabel(category: string): string {
		const labels: Record<string, string> = {
			navigation: 'Navigation',
			action: 'Actions',
			view: 'View',
			settings: 'Settings',
			help: 'Help'
		};
		return labels[category] || category;
	}

	// Group commands by category for display
	function groupByCategory(cmds: Command[]): Map<string, Command[]> {
		const groups = new Map<string, Command[]>();
		for (const cmd of cmds) {
			const existing = groups.get(cmd.category) || [];
			groups.set(cmd.category, [...existing, cmd]);
		}
		return groups;
	}

	$: groupedCommands = groupByCategory(filteredCommands);

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});

	// Export open function for external triggers
	export { open };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
{#if $isOpen}
	<div class="palette-backdrop" transition:fade={{ duration: 100 }} onclick={handleBackdropClick}>
		<div
			class="palette-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="palette-title"
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<div class="palette-header">
				<div class="search-icon">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
						<path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 001.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 00-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 005.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
					</svg>
				</div>
				<input
					bind:this={searchInput}
					bind:value={query}
					type="text"
					placeholder="Type a command or search..."
					class="palette-input"
					aria-label="Command palette search"
					autocomplete="off"
				/>
				<div class="shortcut-hint">
					<kbd>Esc</kbd> to close
				</div>
			</div>

			<div class="palette-content">
				{#if filteredCommands.length === 0}
					<div class="no-results">
						<span class="no-results-icon">🔍</span>
						<span>No commands found for "{query}"</span>
					</div>
				{:else}
					{#each [...groupedCommands] as [category, cmds], categoryIndex}
						<div class="command-category">
							<div class="category-label">{getCategoryLabel(category)}</div>
							{#each cmds as command, i (command.id)}
								{@const globalIndex = filteredCommands.indexOf(command)}
								<button
									class="command-item"
									class:selected={globalIndex === selectedIndex}
									onclick={() => executeCommand(command)}
									onmouseenter={() => selectedIndex = globalIndex}
								>
									<span class="command-icon">{command.icon}</span>
									<div class="command-info">
										<span class="command-label">{command.label}</span>
										{#if command.description}
											<span class="command-description">{command.description}</span>
										{/if}
									</div>
									{#if command.shortcut}
										<div class="command-shortcut">
											{#each command.shortcut as key, keyIndex}
												{#if keyIndex > 0}<span class="plus">+</span>{/if}
												<kbd>{key}</kbd>
											{/each}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>

			<div class="palette-footer">
				<div class="footer-hint">
					<kbd>↑</kbd><kbd>↓</kbd> to navigate
					<kbd>Enter</kbd> to select
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		z-index: 1100;
		padding-top: 15vh;
	}

	.palette-modal {
		width: 560px;
		max-width: 90vw;
		max-height: 60vh;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 16px 32px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.palette-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
	}

	.search-icon {
		color: var(--text-muted, #949ba4);
		flex-shrink: 0;
	}

	.palette-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 16px;
		color: var(--text-normal, #f2f3f5);
		font-family: inherit;
	}

	.palette-input::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.shortcut-hint {
		display: flex;
		gap: 4px;
		color: var(--text-muted, #949ba4);
		font-size: 12px;
	}

	.palette-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-muted, #949ba4);
		gap: 8px;
	}

	.no-results-icon {
		font-size: 24px;
		opacity: 0.6;
	}

	.command-category {
		margin-bottom: 8px;
	}

	.command-category:last-child {
		margin-bottom: 0;
	}

	.category-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.02em;
		color: var(--text-muted, #949ba4);
		padding: 8px 12px 4px;
	}

	.command-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;
	}

	.command-item:hover,
	.command-item.selected {
		background: var(--bg-modifier-hover, #2e3035);
	}

	.command-item.selected {
		background: var(--brand-experiment, #5865f2);
	}

	.command-item.selected .command-label {
		color: white;
	}

	.command-item.selected .command-description {
		color: rgba(255, 255, 255, 0.8);
	}

	.command-item.selected kbd {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.command-icon {
		font-size: 18px;
		width: 24px;
		text-align: center;
		flex-shrink: 0;
	}

	.command-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.command-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.command-description {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.command-shortcut {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.plus {
		color: var(--text-muted, #949ba4);
		font-size: 10px;
	}

	kbd {
		display: inline-block;
		padding: 2px 6px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 600;
		color: var(--text-muted, #949ba4);
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 3px;
		min-width: 16px;
		text-align: center;
	}

	.palette-footer {
		padding: 8px 16px;
		border-top: 1px solid var(--bg-modifier-accent, #3f4147);
		background: var(--bg-secondary, #2b2d31);
	}

	.footer-hint {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		color: var(--text-muted, #949ba4);
	}

	.footer-hint kbd {
		padding: 2px 4px;
		font-size: 10px;
	}

	/* Scrollbar styling */
	.palette-content::-webkit-scrollbar {
		width: 8px;
	}

	.palette-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.palette-content::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-accent, #3f4147);
		border-radius: 4px;
	}

	.palette-content::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #949ba4);
	}
</style>
