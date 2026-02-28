<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { writable, derived } from 'svelte/store';
	import { invoke } from '@tauri-apps/api/core';
	import { getCurrentWindow, Window } from '@tauri-apps/api/window';
	import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
	import { emit, listen } from '@tauri-apps/api/event';
	
	/**
	 * QuickCaptureWidget - Floating mini-window for rapid message composition
	 * 
	 * Features:
	 * - System-wide global shortcut (Cmd/Ctrl+Shift+C) to summon
	 * - Fuzzy search for recent contacts/channels
	 * - Quick message composition with markdown preview
	 * - Send without switching to main window
	 * - Remembers last used recipient
	 * - Supports attachments via paste
	 * - Auto-dismiss after send (configurable)
	 */
	
	export interface Contact {
		id: string;
		name: string;
		type: 'user' | 'channel' | 'group';
		avatar?: string;
		lastMessageAt?: Date;
		unread?: number;
	}
	
	export interface CapturedMessage {
		recipientId: string;
		recipientName: string;
		recipientType: 'user' | 'channel' | 'group';
		content: string;
		attachments: File[];
		sentAt: Date;
	}
	
	export interface QuickCaptureConfig {
		enabled: boolean;
		shortcut: string;
		autoDismiss: boolean;
		autoDismissDelay: number;
		rememberLastRecipient: boolean;
		showPreview: boolean;
		maxRecentContacts: number;
	}
	
	/** Global shortcut to summon widget */
	export let shortcut: string = 'CommandOrControl+Shift+C';
	
	/** Whether widget is enabled */
	export let enabled: boolean = true;
	
	/** Auto-dismiss after sending */
	export let autoDismiss: boolean = true;
	
	/** Auto-dismiss delay in ms */
	export let autoDismissDelay: number = 1500;
	
	/** Remember last recipient */
	export let rememberLastRecipient: boolean = true;
	
	/** Show markdown preview */
	export let showPreview: boolean = false;
	
	/** Max recent contacts to show */
	export let maxRecentContacts: number = 8;
	
	/** Available contacts (should be provided by parent) */
	export let contacts: Contact[] = [];
	
	/** Callback when message is sent */
	export let onSend: ((message: CapturedMessage) => Promise<boolean>) | undefined = undefined;
	
	/** Callback when widget state changes */
	export let onChange: ((visible: boolean) => void) | undefined = undefined;
	
	// State
	const isVisible = writable(false);
	const searchQuery = writable('');
	const messageContent = writable('');
	const selectedRecipient = writable<Contact | null>(null);
	const attachments = writable<File[]>([]);
	const isSending = writable(false);
	const sendSuccess = writable(false);
	const recentRecipients = writable<Contact[]>([]);
	const focusedIndex = writable(0);
	
	let mounted = false;
	let inputRef: HTMLInputElement;
	let textareaRef: HTMLTextAreaElement;
	let widgetWindow: Window | null = null;
	let unlistenShortcut: (() => void) | null = null;
	let unlistenEvents: (() => void)[] = [];
	
	const STORAGE_KEY = 'hearth_quick_capture';
	const RECENT_KEY = 'hearth_quick_capture_recent';
	
	// Derived stores
	const filteredContacts = derived(
		[searchQuery, recentRecipients],
		([$query, $recent]) => {
			if (!$query.trim()) {
				return $recent.slice(0, maxRecentContacts);
			}
			
			const query = $query.toLowerCase();
			return contacts
				.filter(c => 
					c.name.toLowerCase().includes(query) ||
					c.id.toLowerCase().includes(query)
				)
				.sort((a, b) => {
					// Prioritize exact matches
					const aExact = a.name.toLowerCase().startsWith(query);
					const bExact = b.name.toLowerCase().startsWith(query);
					if (aExact && !bExact) return -1;
					if (!aExact && bExact) return 1;
					// Then by recent usage
					const aRecent = $recent.findIndex(r => r.id === a.id);
					const bRecent = $recent.findIndex(r => r.id === b.id);
					if (aRecent >= 0 && bRecent < 0) return -1;
					if (aRecent < 0 && bRecent >= 0) return 1;
					if (aRecent >= 0 && bRecent >= 0) return aRecent - bRecent;
					return 0;
				})
				.slice(0, maxRecentContacts);
		}
	);
	
	// Load recent recipients from storage
	function loadRecentRecipients(): Contact[] {
		if (!browser) return [];
		try {
			const stored = localStorage.getItem(RECENT_KEY);
			if (stored) {
				const ids: string[] = JSON.parse(stored);
				return ids
					.map(id => contacts.find(c => c.id === id))
					.filter((c): c is Contact => c !== undefined);
			}
		} catch (error) {
			console.warn('Failed to load recent recipients:', error);
		}
		return [];
	}
	
	// Save recent recipients to storage
	function saveRecentRecipients(recipients: Contact[]): void {
		if (!browser) return;
		try {
			const ids = recipients.map(r => r.id);
			localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
		} catch (error) {
			console.warn('Failed to save recent recipients:', error);
		}
	}
	
	// Add contact to recent recipients
	function addToRecent(contact: Contact): void {
		recentRecipients.update(recent => {
			const filtered = recent.filter(r => r.id !== contact.id);
			const updated = [contact, ...filtered].slice(0, maxRecentContacts);
			saveRecentRecipients(updated);
			return updated;
		});
	}
	
	// Load last recipient if enabled
	function loadLastRecipient(): Contact | null {
		if (!browser || !rememberLastRecipient) return null;
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const config = JSON.parse(stored);
				if (config.lastRecipientId) {
					return contacts.find(c => c.id === config.lastRecipientId) || null;
				}
			}
		} catch (error) {
			console.warn('Failed to load last recipient:', error);
		}
		return null;
	}
	
	// Save last recipient
	function saveLastRecipient(contact: Contact | null): void {
		if (!browser || !rememberLastRecipient) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				lastRecipientId: contact?.id || null
			}));
		} catch (error) {
			console.warn('Failed to save last recipient:', error);
		}
	}
	
	// Register global shortcut
	async function registerShortcut(): Promise<void> {
		if (!browser || !enabled) return;
		
		try {
			await register(shortcut, async () => {
				await toggleWidget();
			});
			console.log(`QuickCapture: registered shortcut ${shortcut}`);
		} catch (error) {
			console.warn('Failed to register QuickCapture shortcut:', error);
		}
	}
	
	// Unregister global shortcut
	async function unregisterShortcut(): Promise<void> {
		if (!browser) return;
		
		try {
			await unregister(shortcut);
		} catch (error) {
			// Ignore - shortcut may not be registered
		}
	}
	
	// Toggle widget visibility
	async function toggleWidget(): Promise<void> {
		const visible = await new Promise<boolean>(resolve => {
			isVisible.subscribe(v => resolve(v))();
		});
		
		if (visible) {
			await hideWidget();
		} else {
			await showWidget();
		}
	}
	
	// Show the widget
	async function showWidget(): Promise<void> {
		isVisible.set(true);
		sendSuccess.set(false);
		
		// Load last recipient and recent contacts
		const lastRecipient = loadLastRecipient();
		if (lastRecipient) {
			selectedRecipient.set(lastRecipient);
		}
		recentRecipients.set(loadRecentRecipients());
		
		// Focus input after render
		await tick();
		if (inputRef) {
			inputRef.focus();
		}
		
		if (onChange) {
			onChange(true);
		}
		
		// Emit event for Tauri to position/show the widget window
		try {
			await emit('quick-capture:show');
		} catch (error) {
			// Ignore if not in Tauri context
		}
	}
	
	// Hide the widget
	async function hideWidget(): Promise<void> {
		isVisible.set(false);
		searchQuery.set('');
		messageContent.set('');
		attachments.set([]);
		focusedIndex.set(0);
		
		if (onChange) {
			onChange(false);
		}
		
		try {
			await emit('quick-capture:hide');
		} catch (error) {
			// Ignore if not in Tauri context
		}
	}
	
	// Select a recipient
	function selectRecipient(contact: Contact): void {
		selectedRecipient.set(contact);
		searchQuery.set('');
		saveLastRecipient(contact);
		addToRecent(contact);
		
		// Focus textarea for message input
		tick().then(() => {
			if (textareaRef) {
				textareaRef.focus();
			}
		});
	}
	
	// Clear recipient selection
	function clearRecipient(): void {
		selectedRecipient.set(null);
		messageContent.set('');
		tick().then(() => {
			if (inputRef) {
				inputRef.focus();
			}
		});
	}
	
	// Send the message
	async function sendMessage(): Promise<void> {
		const recipient = await new Promise<Contact | null>(resolve => {
			selectedRecipient.subscribe(v => resolve(v))();
		});
		
		const content = await new Promise<string>(resolve => {
			messageContent.subscribe(v => resolve(v))();
		});
		
		const files = await new Promise<File[]>(resolve => {
			attachments.subscribe(v => resolve(v))();
		});
		
		if (!recipient || !content.trim()) return;
		
		isSending.set(true);
		
		const message: CapturedMessage = {
			recipientId: recipient.id,
			recipientName: recipient.name,
			recipientType: recipient.type,
			content: content.trim(),
			attachments: files,
			sentAt: new Date()
		};
		
		try {
			let success = true;
			
			if (onSend) {
				success = await onSend(message);
			} else {
				// Emit event if no callback provided
				await emit('quick-capture:send', message);
			}
			
			if (success) {
				sendSuccess.set(true);
				
				if (autoDismiss) {
					setTimeout(() => {
						hideWidget();
					}, autoDismissDelay);
				} else {
					// Clear for next message
					messageContent.set('');
					attachments.set([]);
				}
			}
		} catch (error) {
			console.error('Failed to send message:', error);
		} finally {
			isSending.set(false);
		}
	}
	
	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent): void {
		const visible = $isVisible;
		const recipient = $selectedRecipient;
		const filtered = $filteredContacts;
		const focused = $focusedIndex;
		
		if (!visible) return;
		
		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				if (recipient) {
					clearRecipient();
				} else {
					hideWidget();
				}
				break;
				
			case 'ArrowDown':
				if (!recipient) {
					event.preventDefault();
					focusedIndex.set(Math.min(focused + 1, filtered.length - 1));
				}
				break;
				
			case 'ArrowUp':
				if (!recipient) {
					event.preventDefault();
					focusedIndex.set(Math.max(focused - 1, 0));
				}
				break;
				
			case 'Enter':
				if (!recipient && filtered.length > 0) {
					event.preventDefault();
					selectRecipient(filtered[focused]);
				} else if (recipient && event.metaKey || event.ctrlKey) {
					event.preventDefault();
					sendMessage();
				}
				break;
				
			case 'Tab':
				if (!recipient && filtered.length > 0) {
					event.preventDefault();
					selectRecipient(filtered[focused]);
				}
				break;
		}
	}
	
	// Handle paste for attachments
	function handlePaste(event: ClipboardEvent): void {
		const items = event.clipboardData?.items;
		if (!items) return;
		
		const files: File[] = [];
		for (const item of items) {
			if (item.kind === 'file') {
				const file = item.getAsFile();
				if (file) {
					files.push(file);
				}
			}
		}
		
		if (files.length > 0) {
			attachments.update(current => [...current, ...files]);
		}
	}
	
	// Remove attachment
	function removeAttachment(index: number): void {
		attachments.update(current => current.filter((_, i) => i !== index));
	}
	
	// Get recipient type icon
	function getTypeIcon(type: Contact['type']): string {
		switch (type) {
			case 'user': return '👤';
			case 'channel': return '#';
			case 'group': return '👥';
			default: return '•';
		}
	}
	
	// Format file size
	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	
	onMount(async () => {
		mounted = true;
		
		// Register global shortcut
		await registerShortcut();
		
		// Load recent contacts
		recentRecipients.set(loadRecentRecipients());
		
		// Listen for external show/hide events
		if (browser) {
			try {
				const unlisten1 = await listen('quick-capture:toggle', toggleWidget);
				const unlisten2 = await listen('quick-capture:request-show', showWidget);
				const unlisten3 = await listen('quick-capture:request-hide', hideWidget);
				unlistenEvents = [unlisten1, unlisten2, unlisten3];
			} catch (error) {
				// Not in Tauri context
			}
			
			// Global keyboard listener
			document.addEventListener('keydown', handleKeydown);
		}
	});
	
	onDestroy(async () => {
		mounted = false;
		
		// Unregister shortcut
		await unregisterShortcut();
		
		// Remove event listeners
		for (const unlisten of unlistenEvents) {
			unlisten();
		}
		
		if (browser) {
			document.removeEventListener('keydown', handleKeydown);
		}
	});
	
	// Public API
	export function show(): Promise<void> {
		return showWidget();
	}
	
	export function hide(): Promise<void> {
		return hideWidget();
	}
	
	export function toggle(): Promise<void> {
		return toggleWidget();
	}
	
	export function setContacts(newContacts: Contact[]): void {
		contacts = newContacts;
		recentRecipients.set(loadRecentRecipients());
	}
</script>

{#if $isVisible}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div 
		class="quick-capture-overlay"
		on:click|self={hideWidget}
	>
		<div 
			class="quick-capture-widget"
			role="dialog"
			aria-label="Quick Capture"
			aria-modal="true"
		>
			{#if $sendSuccess}
				<!-- Success state -->
				<div class="success-state">
					<div class="success-icon">✓</div>
					<div class="success-text">Message sent!</div>
				</div>
			{:else if $selectedRecipient}
				<!-- Message composition -->
				<div class="compose-header">
					<button 
						class="back-button"
						on:click={clearRecipient}
						aria-label="Back to recipient selection"
					>
						←
					</button>
					<div class="recipient-badge">
						<span class="recipient-type">{getTypeIcon($selectedRecipient.type)}</span>
						<span class="recipient-name">{$selectedRecipient.name}</span>
					</div>
				</div>
				
				<div class="compose-body">
					<textarea
						bind:this={textareaRef}
						bind:value={$messageContent}
						placeholder="Type your message... (Cmd/Ctrl+Enter to send)"
						class="message-input"
						on:paste={handlePaste}
						rows="3"
						disabled={$isSending}
					></textarea>
					
					{#if $attachments.length > 0}
						<div class="attachments-list">
							{#each $attachments as file, index}
								<div class="attachment-item">
									<span class="attachment-name">{file.name}</span>
									<span class="attachment-size">({formatSize(file.size)})</span>
									<button 
										class="attachment-remove"
										on:click={() => removeAttachment(index)}
										aria-label="Remove attachment"
									>
										×
									</button>
								</div>
							{/each}
						</div>
					{/if}
					
					{#if showPreview && $messageContent.trim()}
						<div class="preview-section">
							<div class="preview-label">Preview</div>
							<div class="preview-content">{$messageContent}</div>
						</div>
					{/if}
				</div>
				
				<div class="compose-footer">
					<span class="hint">Cmd/Ctrl+Enter to send • Esc to cancel</span>
					<button 
						class="send-button"
						on:click={sendMessage}
						disabled={!$messageContent.trim() || $isSending}
					>
						{#if $isSending}
							Sending...
						{:else}
							Send
						{/if}
					</button>
				</div>
			{:else}
				<!-- Recipient selection -->
				<div class="search-header">
					<input
						bind:this={inputRef}
						bind:value={$searchQuery}
						type="text"
						placeholder="Search contacts or channels..."
						class="search-input"
						autocomplete="off"
						spellcheck="false"
					/>
				</div>
				
				<div class="contacts-list" role="listbox">
					{#if $filteredContacts.length === 0}
						<div class="no-results">
							{#if $searchQuery.trim()}
								No contacts found for "{$searchQuery}"
							{:else}
								Start typing to search contacts
							{/if}
						</div>
					{:else}
						{#each $filteredContacts as contact, index}
							<button
								class="contact-item"
								class:focused={index === $focusedIndex}
								on:click={() => selectRecipient(contact)}
								on:mouseenter={() => focusedIndex.set(index)}
								role="option"
								aria-selected={index === $focusedIndex}
							>
								<span class="contact-avatar">
									{#if contact.avatar}
										<img src={contact.avatar} alt="" />
									{:else}
										{contact.name.charAt(0).toUpperCase()}
									{/if}
								</span>
								<span class="contact-info">
									<span class="contact-name">{contact.name}</span>
									<span class="contact-type">{contact.type}</span>
								</span>
								{#if contact.unread}
									<span class="unread-badge">{contact.unread}</span>
								{/if}
							</button>
						{/each}
					{/if}
				</div>
				
				<div class="search-footer">
					<span class="hint">↑↓ to navigate • Enter to select • Esc to close</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.quick-capture-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 15vh;
		z-index: 99999;
		animation: fadeIn 0.15s ease-out;
	}
	
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	
	.quick-capture-widget {
		width: 100%;
		max-width: 480px;
		background: var(--bg-primary, #1e1e1e);
		border-radius: 12px;
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		overflow: hidden;
		animation: slideDown 0.2s ease-out;
	}
	
	@keyframes slideDown {
		from { 
			opacity: 0; 
			transform: translateY(-20px) scale(0.95);
		}
		to { 
			opacity: 1; 
			transform: translateY(0) scale(1);
		}
	}
	
	/* Success State */
	.success-state {
		padding: 40px;
		text-align: center;
		animation: scaleIn 0.2s ease-out;
	}
	
	@keyframes scaleIn {
		from { transform: scale(0.8); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}
	
	.success-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto 12px;
		background: #22c55e;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 24px;
		color: white;
	}
	
	.success-text {
		font-size: 16px;
		font-weight: 500;
		color: var(--text-primary, #fff);
	}
	
	/* Search Header */
	.search-header {
		padding: 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.search-input {
		width: 100%;
		padding: 12px 16px;
		font-size: 16px;
		background: var(--bg-secondary, #2a2a2a);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--text-primary, #fff);
		outline: none;
		transition: border-color 0.15s;
	}
	
	.search-input:focus {
		border-color: var(--accent-color, #3b82f6);
	}
	
	.search-input::placeholder {
		color: var(--text-muted, #666);
	}
	
	/* Contacts List */
	.contacts-list {
		max-height: 320px;
		overflow-y: auto;
	}
	
	.no-results {
		padding: 24px;
		text-align: center;
		color: var(--text-muted, #666);
	}
	
	.contact-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 16px;
		background: transparent;
		border: none;
		color: var(--text-primary, #fff);
		cursor: pointer;
		transition: background 0.1s;
		text-align: left;
	}
	
	.contact-item:hover,
	.contact-item.focused {
		background: rgba(255, 255, 255, 0.05);
	}
	
	.contact-item.focused {
		background: rgba(59, 130, 246, 0.2);
	}
	
	.contact-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--accent-color, #3b82f6);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 14px;
		overflow: hidden;
		flex-shrink: 0;
	}
	
	.contact-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	
	.contact-info {
		flex: 1;
		min-width: 0;
	}
	
	.contact-name {
		display: block;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.contact-type {
		display: block;
		font-size: 12px;
		color: var(--text-muted, #666);
		text-transform: capitalize;
	}
	
	.unread-badge {
		padding: 2px 8px;
		background: var(--accent-color, #3b82f6);
		border-radius: 10px;
		font-size: 12px;
		font-weight: 600;
		flex-shrink: 0;
	}
	
	/* Search Footer */
	.search-footer {
		padding: 10px 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.hint {
		font-size: 12px;
		color: var(--text-muted, #666);
	}
	
	/* Compose Header */
	.compose-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.back-button {
		width: 32px;
		height: 32px;
		background: var(--bg-secondary, #2a2a2a);
		border: none;
		border-radius: 6px;
		color: var(--text-primary, #fff);
		cursor: pointer;
		font-size: 16px;
		transition: background 0.15s;
	}
	
	.back-button:hover {
		background: var(--bg-tertiary, #333);
	}
	
	.recipient-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: var(--bg-secondary, #2a2a2a);
		border-radius: 20px;
	}
	
	.recipient-type {
		font-size: 14px;
	}
	
	.recipient-name {
		font-weight: 500;
		color: var(--text-primary, #fff);
	}
	
	/* Compose Body */
	.compose-body {
		padding: 12px 16px;
	}
	
	.message-input {
		width: 100%;
		padding: 12px;
		font-size: 14px;
		font-family: inherit;
		background: var(--bg-secondary, #2a2a2a);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--text-primary, #fff);
		resize: vertical;
		min-height: 80px;
		outline: none;
		transition: border-color 0.15s;
	}
	
	.message-input:focus {
		border-color: var(--accent-color, #3b82f6);
	}
	
	.message-input::placeholder {
		color: var(--text-muted, #666);
	}
	
	.message-input:disabled {
		opacity: 0.7;
	}
	
	/* Attachments */
	.attachments-list {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	
	.attachment-item {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: rgba(59, 130, 246, 0.2);
		border-radius: 4px;
		font-size: 12px;
	}
	
	.attachment-name {
		max-width: 120px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.attachment-size {
		color: var(--text-muted, #666);
	}
	
	.attachment-remove {
		background: none;
		border: none;
		color: var(--text-muted, #666);
		cursor: pointer;
		padding: 0;
		font-size: 14px;
		line-height: 1;
	}
	
	.attachment-remove:hover {
		color: #ef4444;
	}
	
	/* Preview */
	.preview-section {
		margin-top: 12px;
		padding: 8px 12px;
		background: var(--bg-tertiary, #333);
		border-radius: 6px;
	}
	
	.preview-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted, #666);
		margin-bottom: 4px;
	}
	
	.preview-content {
		font-size: 14px;
		color: var(--text-primary, #fff);
		white-space: pre-wrap;
	}
	
	/* Compose Footer */
	.compose-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.send-button {
		padding: 8px 20px;
		background: var(--accent-color, #3b82f6);
		border: none;
		border-radius: 6px;
		color: white;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}
	
	.send-button:hover:not(:disabled) {
		background: #2563eb;
	}
	
	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	/* Dark mode adjustments */
	:global(.light) .quick-capture-widget {
		--bg-primary: #fff;
		--bg-secondary: #f3f4f6;
		--bg-tertiary: #e5e7eb;
		--text-primary: #111;
		--text-muted: #6b7280;
	}
	
	:global(.light) .quick-capture-overlay {
		background: rgba(0, 0, 0, 0.3);
	}
</style>
