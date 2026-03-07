<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { ui, searchOpen, helpOpen } from '$lib/stores/ui';
	import { goto } from '$app/navigation';
	import { writable } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';
	import { servers } from '$lib/stores/servers';
	import { isSettingsOpen, settings } from '$lib/stores/settings';
	import { splitViewStore } from '$lib/stores/splitView';

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
		category: 'navigation' | 'action' | 'view' | 'settings' | 'help' | 'status' | 'tools' | 'servers';
		icon: string;
		shortcut?: string[];
		action: () => void | Promise<void>;
	}

	const staticCommands: Command[] = [
		// Navigation
		{
			id: 'goto-home',
			label: 'Go to Home',
			description: 'Navigate to direct messages',
			category: 'navigation',
			icon: '🏠',
			action: () => goto('/channels/@me')
		},
		{
			id: 'goto-settings',
			label: 'Open Settings',
			description: 'User preferences and account settings',
			category: 'settings',
			icon: '⚙️',
			shortcut: ['Ctrl', ','],
			action: () => settings.open()
		},
		{
			id: 'goto-dms',
			label: 'Direct Messages',
			description: 'View your direct messages',
			category: 'navigation',
			icon: '💬',
			action: () => goto('/channels/@me')
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
			action: () => ui.toggleSidebar()
		},
		{
			id: 'toggle-members',
			label: 'Toggle Member List',
			description: 'Show or hide the member list',
			category: 'view',
			icon: '👥',
			shortcut: ['Ctrl', 'Shift', 'I'],
			action: () => ui.toggleMemberList()
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
		{
			id: 'toggle-split-view',
			label: 'Toggle Split View',
			description: 'Side-by-side channel view',
			category: 'view',
			icon: '⬛',
			shortcut: ['Alt', 'Shift', 'P'],
			action: () => splitViewStore.toggle()
		},
		// Status (Tauri-powered)
		{
			id: 'status-online',
			label: 'Set Status: Online',
			description: 'Show as online',
			category: 'status',
			icon: '🟢',
			action: () => invoke('tray_set_user_status', { status: 'online' }).catch(() => {})
		},
		{
			id: 'status-idle',
			label: 'Set Status: Idle',
			description: 'Show as away',
			category: 'status',
			icon: '🌙',
			action: () => invoke('tray_set_user_status', { status: 'idle' }).catch(() => {})
		},
		{
			id: 'status-dnd',
			label: 'Set Status: Do Not Disturb',
			description: 'Suppress all notifications',
			category: 'status',
			icon: '⛔',
			action: () => invoke('tray_set_user_status', { status: 'dnd' }).catch(() => {})
		},
		{
			id: 'status-invisible',
			label: 'Set Status: Invisible',
			description: 'Appear offline to others',
			category: 'status',
			icon: '👻',
			action: () => invoke('tray_set_user_status', { status: 'invisible' }).catch(() => {})
		},
		// Notifications (Tauri-powered)
		{
			id: 'toggle-mute',
			label: 'Toggle Mute Notifications',
			description: 'Mute or unmute all notifications',
			category: 'action',
			icon: '🔇',
			shortcut: ['Ctrl', 'Shift', 'M'],
			action: () => invoke('toggle_mute').catch(() => {})
		},
		{
			id: 'focus-mode',
			label: 'Toggle Focus Mode',
			description: 'Only show mentions and DMs',
			category: 'action',
			icon: '🎯',
			shortcut: ['Ctrl', 'Shift', 'F'],
			action: () => invoke('toggle_focus_mode').catch(() => {})
		},
		{
			id: 'toggle-dnd-notifs',
			label: 'Toggle Do Not Disturb',
			description: 'Suppress notification popups',
			category: 'action',
			icon: '🔕',
			action: () => invoke('set_notification_dnd', { active: true }).catch(() => {})
		},
		// Tools (Tauri-powered)
		{
			id: 'zen-mode',
			label: 'Toggle Zen Mode',
			description: 'Distraction-free view',
			category: 'tools',
			icon: '🧘',
			shortcut: ['Ctrl', 'Shift', 'Z'],
			action: () => invoke('toggle_zen_mode').catch(() => {})
		},
		{
			id: 'privacy-mode',
			label: 'Toggle Privacy Mode',
			description: 'Hide sensitive content (boss key)',
			category: 'tools',
			icon: '🔒',
			shortcut: ['Ctrl', 'Shift', 'L'],
			action: () => invoke('toggle_privacy_mode').catch(() => {})
		},
		{
			id: 'quick-capture',
			label: 'Quick Capture',
			description: 'Capture a quick note',
			category: 'tools',
			icon: '📝',
			action: () => invoke('toggle_quick_capture').catch(() => {})
		},
		{
			id: 'screenshot',
			label: 'Take Screenshot',
			description: 'Capture a screenshot',
			category: 'tools',
			icon: '📸',
			action: () => invoke('take_screenshot', { options: {} }).catch(() => {})
		},
		{
			id: 'color-picker',
			label: 'Open Color Picker',
			description: 'Pick a color from screen',
			category: 'tools',
			icon: '🎨',
			action: () => invoke('open_color_picker').catch(() => {})
		},
		{
			id: 'qr-code',
			label: 'QR Code Generator',
			description: 'Generate QR codes for text, URLs, or WiFi',
			category: 'tools',
			icon: '📱',
			action: () => dispatch('openPanel', { panel: 'qrcode' })
		},
		{
			id: 'night-light',
			label: 'Night Light',
			description: 'Adjust blue light filter and color temperature',
			category: 'tools',
			icon: '🌙',
			action: () => dispatch('openPanel', { panel: 'nightlight' })
		},
		{
			id: 'audio-devices',
			label: 'Audio Devices',
			description: 'Manage audio input and output devices',
			category: 'tools',
			icon: '🎧',
			action: () => dispatch('openPanel', { panel: 'audio' })
		},
		{
			id: 'window-snap',
			label: 'Window Snap',
			description: 'Snap window to screen zones',
			category: 'tools',
			icon: '🪟',
			action: () => dispatch('openPanel', { panel: 'windowsnap' })
		},
		{
			id: 'screen-recorder',
			label: 'Screen Recorder',
			description: 'Record your screen with audio',
			category: 'tools',
			icon: '⏺️',
			action: () => dispatch('openPanel', { panel: 'screenrecorder' })
		},
		{
			id: 'text-expander',
			label: 'Text Expander',
			description: 'Manage text shortcuts and abbreviations',
			category: 'tools',
			icon: 'T',
			shortcut: ['Ctrl', 'Shift', 'E'],
			action: () => dispatch('openPanel', { panel: 'textexpander' })
		},
		// Window
		{
			id: 'minimize',
			label: 'Minimize Window',
			category: 'view',
			icon: '➖',
			action: () => invoke('minimize_window').catch(() => {})
		},
		{
			id: 'maximize',
			label: 'Toggle Maximize',
			category: 'view',
			icon: '⬜',
			action: () => invoke('toggle_maximize').catch(() => {})
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
			id: 'check-updates',
			label: 'Check for Updates',
			description: 'Check if a new version is available',
			category: 'help',
			icon: '🔄',
			action: () => invoke('check_for_updates_cmd').catch(() => {})
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
			id: 'report-bug',
			label: 'Report a Bug',
			description: 'Open bug report form',
			category: 'help',
			icon: '🐛',
			action: () => dispatch('reportBug')
		}
	];

	// Build dynamic server navigation commands from the store
	function getAllCommands(): Command[] {
		const serverCommands: Command[] = ($servers || []).map((server) => ({
			id: `server-${server.id}`,
			label: `Go to ${server.name}`,
			description: `Navigate to ${server.name} server`,
			category: 'servers' as const,
			icon: '🖥️',
			action: () => goto(`/channels/${server.id}`)
		}));
		return [...staticCommands, ...serverCommands];
	}

	function getCategoryLabel(category: string): string {
		const labels: Record<string, string> = {
			navigation: 'Navigation',
			action: 'Actions',
			view: 'View',
			settings: 'Settings',
			status: 'Status',
			tools: 'Tools',
			servers: 'Servers',
			help: 'Help'
		};
		return labels[category] || category;
	}

	function filterCommands(q: string): Command[] {
		const allCommands = getAllCommands();
		if (!q.trim()) return allCommands;

		const lower = q.toLowerCase();
		const terms = lower.split(/\s+/);

		return allCommands
			.map((cmd) => {
				const text = `${cmd.label} ${cmd.description || ''} ${cmd.category}`.toLowerCase();
				let score = 0;
				for (const term of terms) {
					if (text.includes(term)) score++;
					else return { cmd, score: -1 };
				}
				if (cmd.label.toLowerCase().startsWith(lower)) score += 10;
				return { cmd, score };
			})
			.filter((r) => r.score >= 0)
			.sort((a, b) => b.score - a.score)
			.map((r) => r.cmd);
	}

	$: filteredCommands = filterCommands(query);
	$: if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
		selectedIndex = 0;
	}

	function open() {
		$isOpen = true;
		query = '';
		selectedIndex = 0;
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
			// Open command palette with Ctrl+.
			if ((e.ctrlKey || e.metaKey) && e.key === '.') {
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
						<path d="M4 6h16M4 12h16M4 18h7" stroke="currentColor" stroke-width="2" fill="none" />
					</svg>
				</div>
				<input
					bind:this={searchInput}
					bind:value={query}
					type="text"
					placeholder="Type a command..."
					class="palette-input"
					aria-label="Command palette search"
					autocomplete="off"
					spellcheck="false"
				/>
				<div class="shortcut-hint">
					<kbd>Esc</kbd>
				</div>
			</div>

			<div class="palette-content">
				{#if filteredCommands.length === 0}
					<div class="no-results">
						<span class="no-results-icon">🔍</span>
						<span>No commands found for "{query}"</span>
					</div>
				{:else}
					{#each [...groupedCommands] as [category, cmds]}
						<div class="command-category">
							<div class="category-label">{getCategoryLabel(category)}</div>
							{#each cmds as command (command.id)}
								{@const globalIdx = filteredCommands.indexOf(command)}
								<button
									class="command-item"
									class:selected={globalIdx === selectedIndex}
									onclick={() => executeCommand(command)}
									onmouseenter={() => selectedIndex = globalIdx}
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
					<kbd>↑</kbd><kbd>↓</kbd> navigate
					<kbd>↵</kbd> select
					<span class="footer-trigger">Ctrl+.</span>
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
		background: var(--bg-floating, #111214);
		border-radius: 12px;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15),
		            0 16px 48px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.palette-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
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
		color: var(--text-primary, #f2f3f5);
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
		flex-shrink: 0;
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
		margin-bottom: 4px;
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
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;
		color: var(--text-secondary, #b5bac1);
	}

	.command-item:hover,
	.command-item.selected {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.24));
		color: var(--text-primary, #f2f3f5);
	}

	.command-item.selected {
		background: var(--brand-primary, #5865f2);
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
		font-size: 16px;
		width: 24px;
		text-align: center;
		flex-shrink: 0;
	}

	.command-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.command-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #f2f3f5);
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
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
		border-radius: 4px;
		min-width: 16px;
		text-align: center;
	}

	.palette-footer {
		padding: 8px 16px;
		border-top: 1px solid var(--border-faint, rgba(255, 255, 255, 0.06));
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

	.footer-trigger {
		margin-left: auto;
		opacity: 0.6;
	}

	.palette-content::-webkit-scrollbar {
		width: 8px;
	}

	.palette-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.palette-content::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-accent, rgba(79, 84, 92, 0.48));
		border-radius: 4px;
	}

	.palette-content::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #949ba4);
	}
</style>
