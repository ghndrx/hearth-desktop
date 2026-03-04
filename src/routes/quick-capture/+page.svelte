<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { fly, fade } from 'svelte/transition';

	// Types
	interface Contact {
		id: string;
		name: string;
		type: 'user' | 'channel' | 'group';
		avatar?: string;
		serverName?: string;
	}

	interface QuickCaptureConfig {
		width: number;
		height: number;
		always_on_top: boolean;
		center_on_screen: boolean;
		remember_position: boolean;
	}

	// State
	let messageText = $state('');
	let searchQuery = $state('');
	let selectedRecipient = $state<Contact | null>(null);
	let contacts = $state<Contact[]>([]);
	let filteredContacts = $state<Contact[]>([]);
	let showContactList = $state(false);
	let isSending = $state(false);
	let sendSuccess = $state(false);
	let recentRecipients = $state<Contact[]>([]);
	let focusedIndex = $state(0);
	let textareaRef: HTMLTextAreaElement;
	let searchInputRef: HTMLInputElement;
	let unlistenShow: UnlistenFn | null = null;
	let unlistenHide: UnlistenFn | null = null;

	// Load contacts and recent recipients on mount
	onMount(async () => {
		await loadContacts();
		loadRecentRecipients();
		setupEventListeners();
		focusTextarea();
	});

	async function setupEventListeners() {
		// Listen for show/hide events from the backend
		unlistenShow = await listen('quick-capture-show', () => {
			focusTextarea();
		});

		unlistenHide = await listen('quick-capture-hide', () => {
			// Window is being hidden, could save draft here
		});

		// Handle window close request (minimize instead)
		const window = getCurrentWindow();
		window.listen('tauri://close-requested', async () => {
			await hideWindow();
		});
	}

	async function loadContacts() {
		// In a real implementation, this would fetch from the backend
		// For now, use some sample data that would come from the main app
		contacts = [
			{ id: '1', name: 'General', type: 'channel', serverName: 'Team Chat' },
			{ id: '2', name: 'Random', type: 'channel', serverName: 'Team Chat' },
			{ id: '3', name: 'Alice Johnson', type: 'user' },
			{ id: '4', name: 'Bob Smith', type: 'user' },
			{ id: '5', name: 'Engineering', type: 'channel', serverName: 'Work' },
			{ id: '6', name: 'Design Team', type: 'group' },
		];
	}

	function loadRecentRecipients() {
		const stored = localStorage.getItem('hearth_quick_capture_recent');
		if (stored) {
			try {
				recentRecipients = JSON.parse(stored);
			} catch {
				recentRecipients = [];
			}
		}
	}

	function saveRecentRecipient(contact: Contact) {
		// Remove if already exists
		recentRecipients = recentRecipients.filter(r => r.id !== contact.id);
		// Add to front
		recentRecipients = [contact, ...recentRecipients].slice(0, 5);
		localStorage.setItem('hearth_quick_capture_recent', JSON.stringify(recentRecipients));
	}

	// Filter contacts based on search query
	$effect(() => {
		if (searchQuery.trim() === '') {
			filteredContacts = recentRecipients.length > 0 ? recentRecipients : contacts.slice(0, 8);
		} else {
			const query = searchQuery.toLowerCase();
			filteredContacts = contacts.filter(c => 
				c.name.toLowerCase().includes(query) ||
				(c.serverName && c.serverName.toLowerCase().includes(query))
			);
		}
		focusedIndex = 0;
	});

	async function focusTextarea() {
		await tick();
		if (selectedRecipient) {
			textareaRef?.focus();
		} else {
			searchInputRef?.focus();
		}
	}

	async function hideWindow() {
		try {
			await invoke('quick_capture_hide');
		} catch (e) {
			console.error('Failed to hide window:', e);
			// Fallback: try to minimize
			const window = getCurrentWindow();
			await window.minimize();
		}
	}

	async function closeWindow() {
		// Clear state and hide
		messageText = '';
		searchQuery = '';
		selectedRecipient = null;
		await hideWindow();
	}

	function selectContact(contact: Contact) {
		selectedRecipient = contact;
		showContactList = false;
		searchQuery = '';
		focusTextarea();
	}

	function clearRecipient() {
		selectedRecipient = null;
		messageText = '';
		focusTextarea();
	}

	async function sendMessage() {
		if (!selectedRecipient || !messageText.trim() || isSending) return;

		isSending = true;
		
		try {
			// Call backend to send message
			await invoke('quick_capture_send_message', {
				recipientId: selectedRecipient.id,
				recipientType: selectedRecipient.type,
				content: messageText.trim()
			});

			// Save to recent
			saveRecentRecipient(selectedRecipient);

			// Show success state
			sendSuccess = true;
			setTimeout(() => {
				sendSuccess = false;
				messageText = '';
				closeWindow();
			}, 800);
		} catch (e) {
			console.error('Failed to send message:', e);
			// Show error notification
		} finally {
			isSending = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Escape to close
		if (event.key === 'Escape') {
			if (showContactList) {
				showContactList = false;
			} else if (selectedRecipient && messageText === '') {
				clearRecipient();
			} else {
				closeWindow();
			}
			event.preventDefault();
			return;
		}

		// Handle contact list navigation
		if (showContactList || (!selectedRecipient && document.activeElement === searchInputRef)) {
			if (event.key === 'ArrowDown') {
				focusedIndex = (focusedIndex + 1) % filteredContacts.length;
				event.preventDefault();
			} else if (event.key === 'ArrowUp') {
				focusedIndex = (focusedIndex - 1 + filteredContacts.length) % filteredContacts.length;
				event.preventDefault();
			} else if (event.key === 'Enter' && filteredContacts.length > 0) {
				selectContact(filteredContacts[focusedIndex]);
				event.preventDefault();
			}
		}

		// Cmd/Ctrl+Enter to send
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			sendMessage();
			event.preventDefault();
		}
	}

	function getContactIcon(type: Contact['type']): string {
		switch (type) {
			case 'user': return '👤';
			case 'channel': return '#';
			case 'group': return '👥';
			default: return '💬';
		}
	}

	function getContactTypeLabel(type: Contact['type']): string {
		switch (type) {
			case 'user': return 'User';
			case 'channel': return 'Channel';
			case 'group': return 'Group';
			default: return 'Chat';
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="quick-capture" class:sending={isSending} class:success={sendSuccess}>
	<!-- Header -->
	<header class="header">
		<div class="header-left">
			<span class="app-icon">⚡</span>
			<h1>Quick Capture</h1>
		</div>
		<button class="close-btn" on:click={closeWindow} aria-label="Close">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</header>

	<!-- Recipient Selection -->
	{#if !selectedRecipient}
		<div class="recipient-selection" in:fly={{ y: -10, duration: 200 }}>
			<div class="search-box">
				<span class="search-icon">🔍</span>
				<input
					bind:this={searchInputRef}
					type="text"
					placeholder="Search contacts, channels..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>

			{#if recentRecipients.length > 0 && searchQuery === ''}
				<div class="section-label">Recent</div>
			{/if}

			{#if filteredContacts.length > 0}
				<ul class="contact-list" role="listbox">
					{#each filteredContacts as contact, i}
						<li
							role="option"
							aria-selected={i === focusedIndex}
							class="contact-item"
							class:focused={i === focusedIndex}
							on:click={() => selectContact(contact)}
							on:mouseenter={() => focusedIndex = i}
							in:fly={{ y: 10, delay: i * 30, duration: 150 }}
						>
							<span class="contact-icon">{getContactIcon(contact.type)}</span>
							<div class="contact-info">
								<span class="contact-name">{contact.name}</span>
								{#if contact.serverName}
									<span class="contact-server">{contact.serverName}</span>
								{:else}
									<span class="contact-type">{getContactTypeLabel(contact.type)}</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty-state">
					<span class="empty-icon">🔍</span>
					<p>No contacts found</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Message Composition -->
		<div class="compose-area" in:fly={{ y: 10, duration: 200 }}>
			<div class="recipient-bar">
				<span class="to-label">To:</span>
				<div class="recipient-chip">
					<span class="recipient-icon">{getContactIcon(selectedRecipient.type)}</span>
					<span class="recipient-name">{selectedRecipient.name}</span>
					<button class="clear-recipient" on:click={clearRecipient} aria-label="Change recipient">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<textarea
				bind:this={textareaRef}
				bind:value={messageText}
				placeholder="Type your message... (Cmd+Enter to send)"
				class="message-input"
				rows="4"
				disabled={isSending}
			></textarea>

			<div class="compose-footer">
				<span class="hint">Cmd+Enter to send</span>
				<button
					class="send-btn"
					on:click={sendMessage}
					disabled={!messageText.trim() || isSending}
				>
					{#if isSending}
						<span class="spinner"></span>
					{:else if sendSuccess}
						<span class="success-icon">✓</span>
					{:else}
						<span>Send</span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
						</svg>
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg-primary, #1a1b1e);
		color: var(--text-primary, #ffffff);
	}

	.quick-capture {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--bg-primary, #1a1b1e);
		overflow: hidden;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: var(--bg-secondary, #25262b);
		border-bottom: 1px solid var(--border-color, #2c2e33);
		-webkit-app-region: drag;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
		-webkit-app-region: no-drag;
	}

	.app-icon {
		font-size: 18px;
	}

	.header h1 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #ffffff);
	}

	.close-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text-muted, #909296);
		cursor: pointer;
		transition: all 0.15s ease;
		-webkit-app-region: no-drag;
	}

	.close-btn:hover {
		background: var(--bg-hover, #2c2e33);
		color: var(--text-primary, #ffffff);
	}

	.close-btn svg {
		width: 16px;
		height: 16px;
	}

	/* Recipient Selection */
	.recipient-selection {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 12px;
		overflow: hidden;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg-secondary, #25262b);
		border: 1px solid var(--border-color, #2c2e33);
		border-radius: 8px;
		margin-bottom: 12px;
	}

	.search-icon {
		font-size: 14px;
		color: var(--text-muted, #909296);
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-primary, #ffffff);
		font-size: 14px;
		outline: none;
	}

	.search-input::placeholder {
		color: var(--text-muted, #909296);
	}

	.section-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #909296);
		margin-bottom: 8px;
		padding-left: 4px;
	}

	.contact-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
	}

	.contact-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.contact-item:hover,
	.contact-item.focused {
		background: var(--bg-hover, #2c2e33);
	}

	.contact-item.focused {
		outline: 2px solid var(--accent-primary, #5865f2);
		outline-offset: -2px;
	}

	.contact-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #2c2e33);
		border-radius: 8px;
		font-size: 14px;
		color: var(--text-secondary, #a6a7ab);
	}

	.contact-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.contact-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #ffffff);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.contact-server,
	.contact-type {
		font-size: 12px;
		color: var(--text-muted, #909296);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--text-muted, #909296);
	}

	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0;
		font-size: 14px;
	}

	/* Compose Area */
	.compose-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 12px;
	}

	.recipient-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--border-color, #2c2e33);
	}

	.to-label {
		font-size: 13px;
		color: var(--text-muted, #909296);
	}

	.recipient-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 4px 4px 10px;
		background: var(--bg-secondary, #25262b);
		border: 1px solid var(--border-color, #2c2e33);
		border-radius: 16px;
	}

	.recipient-icon {
		font-size: 12px;
	}

	.recipient-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary, #ffffff);
	}

	.clear-recipient {
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-tertiary, #2c2e33);
		border: none;
		border-radius: 50%;
		color: var(--text-muted, #909296);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clear-recipient:hover {
		background: var(--red-500, #fa5252);
		color: white;
	}

	.clear-recipient svg {
		width: 10px;
		height: 10px;
	}

	.message-input {
		flex: 1;
		background: var(--bg-secondary, #25262b);
		border: 1px solid var(--border-color, #2c2e33);
		border-radius: 12px;
		padding: 12px;
		color: var(--text-primary, #ffffff);
		font-size: 14px;
		line-height: 1.5;
		resize: none;
		outline: none;
		font-family: inherit;
	}

	.message-input:focus {
		border-color: var(--accent-primary, #5865f2);
	}

	.message-input::placeholder {
		color: var(--text-muted, #909296);
	}

	.message-input:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.compose-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 12px;
	}

	.hint {
		font-size: 12px;
		color: var(--text-muted, #909296);
	}

	.send-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: var(--accent-primary, #5865f2);
		border: none;
		border-radius: 8px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--accent-hover, #4752c4);
		transform: translateY(-1px);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn svg {
		width: 16px;
		height: 16px;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.success-icon {
		color: var(--green-500, #51cf66);
		font-weight: bold;
	}

	/* States */
	.quick-capture.sending {
		opacity: 0.9;
	}

	.quick-capture.success .send-btn {
		background: var(--green-500, #51cf66);
	}
</style>
