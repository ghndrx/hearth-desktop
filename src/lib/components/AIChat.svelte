<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import {
		conversations,
		currentConversation,
		currentMessages,
		templates,
		chatLoading,
		chatError,
		streamingContent,
		isStreaming,
		fetchConversations,
		createConversation,
		getConversation,
		updateConversation,
		deleteConversation,
		sendMessage,
		regenerateMessage,
		deleteMessage,
		fetchTemplates,
		clearCurrentConversation,
		type AIConversation,
		type AIChatMessage,
		type AIChatTemplate,
	} from '$lib/stores/aiChat';
	import {
		aiProviders,
		availableModels,
		enabledProviders,
		fetchProviders,
		fetchAvailableModels,
		type AIProvider,
		type ModelInfo,
	} from '$lib/stores/ai';
	import MarkdownRenderer from './MarkdownRenderer.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Button from './Button.svelte';

	// Props
	export let visible = true;
	export let onClose: (() => void) | undefined = undefined;

	// State
	let messageInput = '';
	let messagesContainer: HTMLDivElement;
	let inputElement: HTMLTextAreaElement;
	let showSidebar = true;
	let showSettings = false;
	let showTemplates = false;
	let searchQuery = '';
	let selectedModel = '';
	let editingTitle = false;
	let newTitle = '';
	let copiedMessageId: string | null = null;

	// Reactive
	$: filteredConversations = searchQuery
		? $conversations.filter((c) =>
				c.title.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: $conversations;

	$: pinnedConvs = filteredConversations.filter((c) => c.is_pinned);
	$: recentConvs = filteredConversations.filter((c) => !c.is_pinned);

	// Initialize
	onMount(async () => {
		await Promise.all([
			fetchConversations(),
			fetchTemplates(),
			fetchProviders(),
			fetchAvailableModels(),
		]);
	});

	// Auto-scroll on new messages
	$: if ($currentMessages.length || $streamingContent) {
		scrollToBottom();
	}

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	// Actions
	async function handleNewChat(template?: AIChatTemplate) {
		const conv = await createConversation({
			template_id: template?.id,
			system_prompt: template?.system_prompt,
		});
		if (conv) {
			await getConversation(conv.id);
			showTemplates = false;
		}
	}

	async function handleSelectConversation(conv: AIConversation) {
		await getConversation(conv.id);
	}

	async function handleSendMessage() {
		if (!messageInput.trim() || $isStreaming || !$currentConversation) return;

		const content = messageInput.trim();
		messageInput = '';
		
		// Resize textarea back to default
		if (inputElement) {
			inputElement.style.height = 'auto';
		}

		await sendMessage($currentConversation.id, content, {
			stream: true,
			model_id: selectedModel || undefined,
		});
	}

	async function handleRegenerate(messageId: string) {
		if (!$currentConversation || $isStreaming) return;
		await regenerateMessage($currentConversation.id, messageId, true);
	}

	async function handleDeleteMessage(messageId: string) {
		if (!$currentConversation) return;
		if (confirm('Delete this message?')) {
			await deleteMessage($currentConversation.id, messageId);
		}
	}

	async function handleDeleteConversation(convId: string) {
		if (confirm('Delete this conversation?')) {
			await deleteConversation(convId);
		}
	}

	async function handleTogglePin(conv: AIConversation) {
		await updateConversation(conv.id, { is_pinned: !conv.is_pinned });
	}

	async function handleRenameConversation() {
		if (!$currentConversation || !newTitle.trim()) return;
		await updateConversation($currentConversation.id, { title: newTitle.trim() });
		editingTitle = false;
	}

	function startEditTitle() {
		if (!$currentConversation) return;
		newTitle = $currentConversation.title;
		editingTitle = true;
	}

	function copyMessage(content: string, messageId: string) {
		navigator.clipboard.writeText(content);
		copiedMessageId = messageId;
		setTimeout(() => {
			copiedMessageId = null;
		}, 2000);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	function autoResize(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = 'auto';
		target.style.height = Math.min(target.scrollHeight, 200) + 'px';
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		return date.toLocaleDateString();
	}

	function getProviderName(modelId: string | undefined): string {
		if (!modelId) return '';
		const model = $availableModels.find((m) => m.id === modelId);
		if (!model) return '';
		const provider = $aiProviders.find((p) => p.id === model.provider_id);
		return provider?.display_name || '';
	}
</script>

{#if visible}
	<div
		class="ai-chat-container"
		transition:fade={{ duration: 200 }}
	>
		<!-- Sidebar -->
		{#if showSidebar}
			<aside class="chat-sidebar" transition:slide={{ axis: 'x', duration: 200 }}>
				<div class="sidebar-header">
					<h2>AI Chat</h2>
					<button
						class="icon-btn"
						on:click={() => (showSidebar = false)}
						title="Hide sidebar"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
						</svg>
					</button>
				</div>

				<div class="sidebar-actions">
					<button class="new-chat-btn" on:click={() => handleNewChat()}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 5v14M5 12h14" />
						</svg>
						New Chat
					</button>
					<button
						class="icon-btn"
						on:click={() => (showTemplates = true)}
						title="Templates"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="3" width="18" height="18" rx="2" />
							<path d="M3 9h18M9 21V9" />
						</svg>
					</button>
				</div>

				<div class="search-box">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" />
						<path d="M21 21l-4.35-4.35" />
					</svg>
					<input
						type="text"
						placeholder="Search conversations..."
						bind:value={searchQuery}
					/>
				</div>

				<div class="conversations-list">
					{#if pinnedConvs.length > 0}
						<div class="conv-section">
							<h3>📌 Pinned</h3>
							{#each pinnedConvs as conv (conv.id)}
								<div
									class="conv-item"
									class:active={$currentConversation?.id === conv.id}
									role="button"
									tabindex="0"
									on:click={() => handleSelectConversation(conv)}
									on:keypress={(e) => e.key === 'Enter' && handleSelectConversation(conv)}
								>
									<span class="conv-title">{conv.title}</span>
									<span class="conv-date">{formatDate(conv.last_message_at || conv.created_at)}</span>
									<div class="conv-actions">
										<button
											class="conv-action-btn"
											on:click|stopPropagation={() => handleTogglePin(conv)}
											title="Unpin"
										>
											📌
										</button>
										<button
											class="conv-action-btn danger"
											on:click|stopPropagation={() => handleDeleteConversation(conv.id)}
											title="Delete"
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if recentConvs.length > 0}
						<div class="conv-section">
							<h3>Recent</h3>
							{#each recentConvs as conv (conv.id)}
								<div
									class="conv-item"
									class:active={$currentConversation?.id === conv.id}
									role="button"
									tabindex="0"
									on:click={() => handleSelectConversation(conv)}
									on:keypress={(e) => e.key === 'Enter' && handleSelectConversation(conv)}
								>
									<span class="conv-title">{conv.title}</span>
									<span class="conv-date">{formatDate(conv.last_message_at || conv.created_at)}</span>
									<div class="conv-actions">
										<button
											class="conv-action-btn"
											on:click|stopPropagation={() => handleTogglePin(conv)}
											title="Pin"
										>
											📍
										</button>
										<button
											class="conv-action-btn danger"
											on:click|stopPropagation={() => handleDeleteConversation(conv.id)}
											title="Delete"
										>
											🗑️
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if filteredConversations.length === 0}
						<div class="empty-state">
							<p>No conversations yet</p>
							<p class="hint">Start a new chat to get started</p>
						</div>
					{/if}
				</div>
			</aside>
		{/if}

		<!-- Main Chat Area -->
		<main class="chat-main">
			<!-- Header -->
			<header class="chat-header">
				{#if !showSidebar}
					<button
						class="icon-btn"
						on:click={() => (showSidebar = true)}
						title="Show sidebar"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M3 12h18M3 6h18M3 18h18" />
						</svg>
					</button>
				{/if}

				{#if $currentConversation}
					<div class="header-title">
						{#if editingTitle}
							<input
								type="text"
								bind:value={newTitle}
								on:keydown={(e) => e.key === 'Enter' && handleRenameConversation()}
								on:blur={handleRenameConversation}
								class="title-input"
								autofocus
							/>
						{:else}
							<h1 on:click={startEditTitle} title="Click to rename">
								{$currentConversation.title}
							</h1>
						{/if}
						{#if $currentConversation.model_id}
							<span class="model-badge">
								{$currentConversation.model_id}
								{#if getProviderName($currentConversation.model_id)}
									<span class="provider-name">({getProviderName($currentConversation.model_id)})</span>
								{/if}
							</span>
						{/if}
					</div>

					<div class="header-actions">
						<button
							class="icon-btn"
							on:click={() => (showSettings = !showSettings)}
							title="Settings"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="12" cy="12" r="3" />
								<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
							</svg>
						</button>
					</div>
				{:else}
					<h1>AI Assistant</h1>
				{/if}

				{#if onClose}
					<button class="icon-btn close-btn" on:click={onClose} title="Close">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</header>

			<!-- Settings Panel -->
			{#if showSettings && $currentConversation}
				<div class="settings-panel" transition:slide>
					<div class="setting-row">
						<label>Model</label>
						<select bind:value={selectedModel}>
							<option value="">Default</option>
							{#each $availableModels as model}
								<option value={model.id}>{model.name || model.id}</option>
							{/each}
						</select>
					</div>
					<div class="setting-row">
						<label>Temperature: {$currentConversation.temperature.toFixed(1)}</label>
						<input
							type="range"
							min="0"
							max="2"
							step="0.1"
							value={$currentConversation.temperature}
							on:change={(e) =>
								updateConversation($currentConversation.id, {
									temperature: parseFloat(e.currentTarget.value),
								})}
						/>
					</div>
				</div>
			{/if}

			<!-- Messages Area -->
			<div class="messages-area" bind:this={messagesContainer}>
				{#if !$currentConversation}
					<!-- Welcome Screen -->
					<div class="welcome-screen">
						<div class="welcome-content">
							<h2>👋 Welcome to AI Chat</h2>
							<p>Start a conversation with your local LLM or cloud AI provider.</p>
							
							<div class="quick-actions">
								<button class="quick-action" on:click={() => handleNewChat()}>
									<span class="icon">💬</span>
									<span>New Chat</span>
								</button>
								<button class="quick-action" on:click={() => (showTemplates = true)}>
									<span class="icon">📋</span>
									<span>Use Template</span>
								</button>
							</div>

							{#if $templates.length > 0}
								<div class="template-suggestions">
									<h3>Quick Start Templates</h3>
									<div class="template-grid">
										{#each $templates.slice(0, 4) as template}
											<button
												class="template-card"
												on:click={() => handleNewChat(template)}
											>
												<span class="template-icon">{template.icon || '💡'}</span>
												<span class="template-name">{template.name}</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Messages -->
					{#each $currentMessages as message (message.id)}
						<div
							class="message"
							class:user={message.role === 'user'}
							class:assistant={message.role === 'assistant'}
							class:system={message.role === 'system'}
							class:error={!!message.error_message}
							transition:fly={{ y: 10, duration: 200 }}
						>
							<div class="message-avatar">
								{#if message.role === 'user'}
									<div class="avatar user-avatar">U</div>
								{:else if message.role === 'assistant'}
									<div class="avatar ai-avatar">🤖</div>
								{:else}
									<div class="avatar system-avatar">⚙️</div>
								{/if}
							</div>
							<div class="message-content">
								<div class="message-header">
									<span class="role-label">
										{message.role === 'user' ? 'You' : message.role === 'assistant' ? 'AI' : 'System'}
									</span>
									{#if message.model_used}
										<span class="model-tag">{message.model_used}</span>
									{/if}
									{#if message.tokens_used}
										<span class="token-count">{message.tokens_used} tokens</span>
									{/if}
								</div>
								<div class="message-body">
									{#if message.error_message}
										<div class="error-content">
											⚠️ Error: {message.error_message}
										</div>
									{:else}
										<MarkdownRenderer content={message.content} />
									{/if}
								</div>
								<div class="message-actions">
									<button
										class="msg-action-btn"
										on:click={() => copyMessage(message.content, message.id)}
										title="Copy"
									>
										{copiedMessageId === message.id ? '✓' : '📋'}
									</button>
									{#if message.role === 'assistant'}
										<button
											class="msg-action-btn"
											on:click={() => handleRegenerate(message.id)}
											title="Regenerate"
											disabled={$isStreaming}
										>
											🔄
										</button>
									{/if}
									<button
										class="msg-action-btn danger"
										on:click={() => handleDeleteMessage(message.id)}
										title="Delete"
									>
										🗑️
									</button>
								</div>
							</div>
						</div>
					{/each}

					<!-- Streaming Response -->
					{#if $isStreaming && $streamingContent}
						<div class="message assistant streaming" transition:fade>
							<div class="message-avatar">
								<div class="avatar ai-avatar">🤖</div>
							</div>
							<div class="message-content">
								<div class="message-header">
									<span class="role-label">AI</span>
									<span class="streaming-indicator">
										<span class="dot"></span>
										<span class="dot"></span>
										<span class="dot"></span>
									</span>
								</div>
								<div class="message-body">
									<MarkdownRenderer content={$streamingContent} />
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Input Area -->
			{#if $currentConversation}
				<div class="input-area">
					<div class="input-wrapper">
						<textarea
							bind:this={inputElement}
							bind:value={messageInput}
							on:keydown={handleKeydown}
							on:input={autoResize}
							placeholder="Type your message..."
							disabled={$isStreaming}
							rows="1"
						></textarea>
						<button
							class="send-btn"
							on:click={handleSendMessage}
							disabled={!messageInput.trim() || $isStreaming}
						>
							{#if $isStreaming}
								<LoadingSpinner size="sm" />
							{:else}
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
								</svg>
							{/if}
						</button>
					</div>
					<p class="input-hint">Press Enter to send, Shift+Enter for new line</p>
				</div>
			{/if}
		</main>

		<!-- Templates Modal -->
		{#if showTemplates}
			<div class="modal-overlay" on:click={() => (showTemplates = false)} transition:fade>
				<div class="modal-content" on:click|stopPropagation transition:fly={{ y: 20 }}>
					<div class="modal-header">
						<h2>Chat Templates</h2>
						<button class="icon-btn" on:click={() => (showTemplates = false)}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
					<div class="templates-grid">
						{#each $templates as template}
							<button
								class="template-item"
								on:click={() => handleNewChat(template)}
							>
								<span class="template-icon">{template.icon || '💡'}</span>
								<div class="template-info">
									<span class="template-name">{template.name}</span>
									{#if template.description}
										<span class="template-desc">{template.description}</span>
									{/if}
									{#if template.category}
										<span class="template-category">{template.category}</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Error Toast -->
		{#if $chatError}
			<div class="error-toast" transition:fly={{ y: 50 }}>
				<span>⚠️ {$chatError}</span>
				<button on:click={() => chatError.set(null)}>×</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.ai-chat-container {
		display: flex;
		width: 100%;
		height: 100%;
		background: var(--bg-primary, #1a1a2e);
		color: var(--text-primary, #e0e0e0);
		font-family: var(--font-family, system-ui, -apple-system, sans-serif);
	}

	/* Sidebar */
	.chat-sidebar {
		width: 280px;
		background: var(--bg-secondary, #16162a);
		border-right: 1px solid var(--border-color, #2a2a4a);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color, #2a2a4a);
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.sidebar-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
	}

	.new-chat-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: var(--accent-primary, #6366f1);
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	.new-chat-btn:hover {
		background: var(--accent-hover, #5558e6);
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		margin: 0 1rem;
		background: var(--bg-tertiary, #12122a);
		border-radius: 0.5rem;
		border: 1px solid var(--border-color, #2a2a4a);
	}

	.search-box input {
		flex: 1;
		background: transparent;
		border: none;
		color: inherit;
		font-size: 0.875rem;
		outline: none;
	}

	.search-box svg {
		color: var(--text-secondary, #888);
	}

	.conversations-list {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.conv-section h3 {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--text-secondary, #888);
		margin: 0 0 0.5rem 0;
		letter-spacing: 0.05em;
	}

	.conv-item {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.75rem;
		margin-bottom: 0.25rem;
		background: transparent;
		border: none;
		border-radius: 0.5rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
		position: relative;
	}

	.conv-item:hover {
		background: var(--bg-hover, #1e1e3a);
	}

	.conv-item.active {
		background: var(--bg-active, #252545);
	}

	.conv-title {
		font-size: 0.875rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	.conv-date {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
		margin-top: 0.25rem;
	}

	.conv-actions {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		display: none;
		gap: 0.25rem;
	}

	.conv-item:hover .conv-actions {
		display: flex;
	}

	.conv-action-btn {
		padding: 0.25rem;
		background: transparent;
		border: none;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.conv-action-btn:hover {
		opacity: 1;
	}

	.empty-state {
		text-align: center;
		padding: 2rem 1rem;
		color: var(--text-secondary, #888);
	}

	.empty-state .hint {
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	/* Main Chat Area */
	.chat-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.chat-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color, #2a2a4a);
		background: var(--bg-secondary, #16162a);
	}

	.chat-header h1 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.header-title {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-title h1 {
		cursor: pointer;
	}

	.header-title h1:hover {
		text-decoration: underline;
	}

	.title-input {
		font-size: 1.125rem;
		font-weight: 600;
		background: var(--bg-tertiary, #12122a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		color: inherit;
		outline: none;
	}

	.model-badge {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--bg-tertiary, #12122a);
		border-radius: 0.25rem;
		color: var(--text-secondary, #888);
	}

	.provider-name {
		opacity: 0.7;
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.close-btn {
		margin-left: auto;
	}

	.icon-btn {
		padding: 0.5rem;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		border-radius: 0.375rem;
		transition: background 0.15s;
	}

	.icon-btn:hover {
		background: var(--bg-hover, #1e1e3a);
	}

	/* Settings Panel */
	.settings-panel {
		padding: 1rem;
		background: var(--bg-secondary, #16162a);
		border-bottom: 1px solid var(--border-color, #2a2a4a);
	}

	.setting-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.setting-row:last-child {
		margin-bottom: 0;
	}

	.setting-row label {
		min-width: 120px;
		font-size: 0.875rem;
		color: var(--text-secondary, #888);
	}

	.setting-row select,
	.setting-row input[type="range"] {
		flex: 1;
	}

	.setting-row select {
		padding: 0.5rem;
		background: var(--bg-tertiary, #12122a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.375rem;
		color: inherit;
	}

	/* Messages Area */
	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.welcome-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
	}

	.welcome-content {
		max-width: 500px;
		text-align: center;
	}

	.welcome-content h2 {
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.welcome-content p {
		color: var(--text-secondary, #888);
		margin-bottom: 1.5rem;
	}

	.quick-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.quick-action {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 2rem;
		background: var(--bg-secondary, #16162a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.75rem;
		color: inherit;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}

	.quick-action:hover {
		background: var(--bg-hover, #1e1e3a);
		border-color: var(--accent-primary, #6366f1);
	}

	.quick-action .icon {
		font-size: 1.5rem;
	}

	.template-suggestions h3 {
		font-size: 0.875rem;
		color: var(--text-secondary, #888);
		margin-bottom: 1rem;
	}

	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.template-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--bg-secondary, #16162a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.5rem;
		color: inherit;
		cursor: pointer;
		transition: background 0.2s;
	}

	.template-card:hover {
		background: var(--bg-hover, #1e1e3a);
	}

	.template-icon {
		font-size: 1.5rem;
	}

	.template-name {
		font-size: 0.75rem;
		text-align: center;
	}

	/* Messages */
	.message {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		max-width: 100%;
	}

	.message-avatar {
		flex-shrink: 0;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.user-avatar {
		background: var(--accent-primary, #6366f1);
		color: white;
	}

	.ai-avatar {
		background: var(--bg-tertiary, #12122a);
		font-size: 1.25rem;
	}

	.system-avatar {
		background: var(--warning-bg, #4a3f00);
		font-size: 1rem;
	}

	.message-content {
		flex: 1;
		min-width: 0;
	}

	.message-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.role-label {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.model-tag {
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		background: var(--bg-tertiary, #12122a);
		border-radius: 0.25rem;
		color: var(--text-secondary, #888);
	}

	.token-count {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
	}

	.message-body {
		line-height: 1.6;
	}

	.message-body :global(pre) {
		background: var(--bg-tertiary, #12122a);
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	.message-body :global(code) {
		font-family: 'Fira Code', monospace;
		font-size: 0.875rem;
	}

	.error-content {
		color: var(--error-color, #ef4444);
		padding: 0.5rem;
		background: var(--error-bg, rgba(239, 68, 68, 0.1));
		border-radius: 0.375rem;
	}

	.message-actions {
		display: flex;
		gap: 0.25rem;
		margin-top: 0.5rem;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.message:hover .message-actions {
		opacity: 1;
	}

	.msg-action-btn {
		padding: 0.25rem 0.5rem;
		background: var(--bg-secondary, #16162a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.25rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.msg-action-btn:hover {
		background: var(--bg-hover, #1e1e3a);
	}

	.msg-action-btn.danger:hover {
		background: var(--error-bg, rgba(239, 68, 68, 0.2));
	}

	.msg-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Streaming Indicator */
	.streaming .message-header {
		display: flex;
		align-items: center;
	}

	.streaming-indicator {
		display: flex;
		gap: 0.25rem;
		margin-left: 0.5rem;
	}

	.streaming-indicator .dot {
		width: 6px;
		height: 6px;
		background: var(--accent-primary, #6366f1);
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.streaming-indicator .dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.streaming-indicator .dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; transform: scale(0.8); }
		50% { opacity: 1; transform: scale(1); }
	}

	/* Input Area */
	.input-area {
		padding: 1rem;
		border-top: 1px solid var(--border-color, #2a2a4a);
		background: var(--bg-secondary, #16162a);
	}

	.input-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.input-wrapper textarea {
		flex: 1;
		padding: 0.75rem 1rem;
		background: var(--bg-tertiary, #12122a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.5rem;
		color: inherit;
		font-family: inherit;
		font-size: 0.9375rem;
		resize: none;
		outline: none;
		max-height: 200px;
		min-height: 44px;
	}

	.input-wrapper textarea:focus {
		border-color: var(--accent-primary, #6366f1);
	}

	.send-btn {
		padding: 0.75rem 1rem;
		background: var(--accent-primary, #6366f1);
		border: none;
		border-radius: 0.5rem;
		color: white;
		cursor: pointer;
		transition: background 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 48px;
		height: 44px;
	}

	.send-btn:hover:not(:disabled) {
		background: var(--accent-hover, #5558e6);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-hint {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
		margin-top: 0.5rem;
		text-align: center;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.modal-content {
		background: var(--bg-primary, #1a1a2e);
		border-radius: 0.75rem;
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--border-color, #2a2a4a);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.templates-grid {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
	}

	.template-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--bg-secondary, #16162a);
		border: 1px solid var(--border-color, #2a2a4a);
		border-radius: 0.5rem;
		color: inherit;
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
	}

	.template-item:hover {
		background: var(--bg-hover, #1e1e3a);
	}

	.template-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.template-desc {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
	}

	.template-category {
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		background: var(--bg-tertiary, #12122a);
		border-radius: 0.25rem;
		width: fit-content;
	}

	/* Error Toast */
	.error-toast {
		position: fixed;
		bottom: 2rem;
		left: 50%;
		transform: translateX(-50%);
		background: var(--error-bg, #ef4444);
		color: white;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 1000;
	}

	.error-toast button {
		background: transparent;
		border: none;
		color: inherit;
		font-size: 1.25rem;
		cursor: pointer;
		opacity: 0.7;
	}

	.error-toast button:hover {
		opacity: 1;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.chat-sidebar {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: 50;
			width: 280px;
		}

		.chat-sidebar::before {
			content: '';
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.5);
			z-index: -1;
		}
	}
</style>
