<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import '$lib/styles/theme.css';

	let currentView: 'chat' | 'voice' | 'notes' = 'chat';
	let channelName = '';
	let messages: Array<{ id: string; author: string; content: string; time: string }> = [];
	let noteText = '';
	let isDragging = false;
	let dragStartY = 0;
	let dragStartX = 0;
	let unlisten: (() => void) | null = null;
	let opacity = 1.0;
	let isHovered = false;

	const appWindow = getCurrentWindow();

	onMount(async () => {
		unlisten = await listen<string>('floating:navigate', (event) => {
			// Handle navigation events from main window
			console.log('Floating navigate:', event.payload);
		});
	});

	onDestroy(() => {
		if (unlisten) unlisten();
	});

	function handleClose() {
		invoke('floating_hide');
	}

	function handleMinimize() {
		invoke('floating_hide');
	}

	async function handleCorner(corner: string) {
		await invoke('floating_move_corner', { corner });
	}

	function startDrag(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.titlebar-controls')) return;
		isDragging = true;
		appWindow.startDragging();
	}

	async function handleOpacity(val: number) {
		opacity = val;
		await invoke('floating_set_opacity', { opacity: val });
	}

	function switchView(view: 'chat' | 'voice' | 'notes') {
		currentView = view;
	}
</script>

<div class="floating-container" class:hovered={isHovered}
	on:mouseenter={() => isHovered = true}
	on:mouseleave={() => isHovered = false}
	role="application"
>
	<!-- Custom titlebar for borderless window -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="titlebar" on:mousedown={startDrag}>
		<div class="titlebar-title">
			<span class="app-icon">H</span>
			<span class="app-name">Hearth</span>
			{#if channelName}
				<span class="channel-name">#{channelName}</span>
			{/if}
		</div>
		<div class="titlebar-controls">
			<button class="control-btn opacity-btn" title="Opacity" on:click={() => handleOpacity(opacity >= 0.9 ? 0.6 : 1.0)}>
				{#if opacity < 0.9}
					<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/></svg>
				{:else}
					<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
				{/if}
			</button>
			<button class="control-btn minimize-btn" title="Minimize to tray" on:click={handleMinimize}>
				<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>
			</button>
			<button class="control-btn close-btn" title="Close" on:click={handleClose}>
				<svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>
			</button>
		</div>
	</div>

	<!-- View navigation tabs -->
	<div class="view-tabs">
		<button class="tab" class:active={currentView === 'chat'} on:click={() => switchView('chat')}>Chat</button>
		<button class="tab" class:active={currentView === 'voice'} on:click={() => switchView('voice')}>Voice</button>
		<button class="tab" class:active={currentView === 'notes'} on:click={() => switchView('notes')}>Notes</button>
	</div>

	<!-- Content area -->
	<div class="content">
		{#if currentView === 'chat'}
			<div class="chat-view">
				{#if messages.length === 0}
					<div class="empty-state">
						<p>No active chat</p>
						<p class="hint">Open a channel in the main window to see messages here</p>
					</div>
				{:else}
					<div class="message-list">
						{#each messages as msg (msg.id)}
							<div class="message">
								<span class="msg-author">{msg.author}</span>
								<span class="msg-content">{msg.content}</span>
								<span class="msg-time">{msg.time}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else if currentView === 'voice'}
			<div class="voice-view">
				<div class="empty-state">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
						<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
						<line x1="12" y1="19" x2="12" y2="23"/>
						<line x1="8" y1="23" x2="16" y2="23"/>
					</svg>
					<p>Not in a voice channel</p>
					<p class="hint">Join a voice channel to see controls here</p>
				</div>
			</div>
		{:else if currentView === 'notes'}
			<div class="notes-view">
				<textarea
					class="quick-note"
					bind:value={noteText}
					placeholder="Quick notes..."
				></textarea>
			</div>
		{/if}
	</div>

	<!-- Corner position controls (visible on hover) -->
	{#if isHovered}
		<div class="corner-controls">
			<button class="corner-btn" title="Top Left" on:click={() => handleCorner('top-left')}>&#x25F0;</button>
			<button class="corner-btn" title="Top Right" on:click={() => handleCorner('top-right')}>&#x25F3;</button>
			<button class="corner-btn" title="Bottom Left" on:click={() => handleCorner('bottom-left')}>&#x25F1;</button>
			<button class="corner-btn" title="Bottom Right" on:click={() => handleCorner('bottom-right')}>&#x25F2;</button>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: transparent;
		overflow: hidden;
	}

	.floating-container {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary, #313338);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: var(--text-normal, #dbdee1);
		position: relative;
	}

	.titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 36px;
		padding: 0 10px;
		background: var(--bg-tertiary, #1e1f22);
		cursor: grab;
		user-select: none;
		-webkit-app-region: drag;
		flex-shrink: 0;
	}

	.titlebar-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
	}

	.app-icon {
		width: 18px;
		height: 18px;
		background: var(--brand-primary, #e87620);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
		color: white;
	}

	.app-name {
		color: var(--text-muted, #949ba4);
	}

	.channel-name {
		color: var(--text-normal, #dbdee1);
	}

	.titlebar-controls {
		display: flex;
		gap: 4px;
		-webkit-app-region: no-drag;
	}

	.control-btn {
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--text-muted, #949ba4);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.control-btn:hover {
		background: var(--bg-modifier-hover, #3f4147);
		color: var(--text-normal, #dbdee1);
	}

	.close-btn:hover {
		background: #ed4245;
		color: white;
	}

	.view-tabs {
		display: flex;
		padding: 4px 8px;
		gap: 2px;
		background: var(--bg-secondary, #2b2d31);
		flex-shrink: 0;
	}

	.tab {
		flex: 1;
		padding: 6px 0;
		border: none;
		background: transparent;
		color: var(--text-muted, #949ba4);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.15s;
	}

	.tab:hover {
		color: var(--text-normal, #dbdee1);
		background: var(--bg-modifier-hover, #3f4147);
	}

	.tab.active {
		color: var(--text-normal, #dbdee1);
		background: var(--bg-modifier-selected, #3f4147);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted, #949ba4);
		text-align: center;
		padding: 20px;
	}

	.empty-state p {
		margin: 4px 0;
	}

	.hint {
		font-size: 12px;
		opacity: 0.7;
	}

	.message-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.message {
		display: flex;
		flex-direction: column;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.message:hover {
		background: var(--bg-modifier-hover, #3f4147);
	}

	.msg-author {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
	}

	.msg-content {
		font-size: 13px;
		color: var(--text-normal, #dbdee1);
		word-break: break-word;
	}

	.msg-time {
		font-size: 10px;
		color: var(--text-muted, #949ba4);
	}

	.quick-note {
		width: 100%;
		height: calc(100% - 8px);
		background: var(--bg-secondary, #2b2d31);
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		border-radius: 8px;
		color: var(--text-normal, #dbdee1);
		font-size: 13px;
		padding: 10px;
		resize: none;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.quick-note:focus {
		border-color: var(--brand-primary, #e87620);
	}

	.quick-note::placeholder {
		color: var(--text-muted, #949ba4);
	}

	.corner-controls {
		position: absolute;
		bottom: 8px;
		right: 8px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px;
		opacity: 0.7;
	}

	.corner-btn {
		width: 22px;
		height: 22px;
		border: none;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border-radius: 3px;
		cursor: pointer;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.corner-btn:hover {
		background: var(--bg-modifier-hover, #3f4147);
		color: var(--text-normal, #dbdee1);
	}
</style>
