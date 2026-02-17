<script lang="ts">
	/**
	 * MessageActionBar Component
	 * 
	 * Discord-style floating action bar that appears on message hover.
	 * Per PRD Section 3.4 Hover Actions:
	 * - React (emoji icon) - opens emoji picker
	 * - Edit (pencil - own messages only)
	 * - Reply (arrow)
	 * - More (three dots) - opens context menu
	 */
	
	import { createEventDispatcher } from 'svelte';
	import Tooltip from './Tooltip.svelte';
	
	export let messageId: string;
	export let isOwn: boolean = false;
	export let isPinned: boolean = false;
	export let canManageMessages: boolean = false;
	export let visible: boolean = false;
	
	const dispatch = createEventDispatcher<{
		react: { messageId: string; openPicker: boolean };
		quickReact: { messageId: string; emoji: string };
		reply: { messageId: string };
		edit: { messageId: string };
		pin: { messageId: string };
		unpin: { messageId: string };
		delete: { messageId: string };
		thread: { messageId: string };
		copyLink: { messageId: string };
		copyText: { messageId: string };
		markUnread: { messageId: string };
	}>();
	
	let showMoreMenu = false;
	
	// Quick reaction emojis (common Discord defaults)
	const quickReactions = ['👍', '😂', '❤️', '👀'];
	
	function handleReactClick() {
		dispatch('react', { messageId, openPicker: true });
	}
	
	function handleQuickReact(emoji: string) {
		dispatch('quickReact', { messageId, emoji });
	}
	
	function handleReply() {
		dispatch('reply', { messageId });
	}
	
	function handleEdit() {
		if (isOwn) {
			dispatch('edit', { messageId });
		}
	}
	
	function handlePin() {
		if (isPinned) {
			dispatch('unpin', { messageId });
		} else {
			dispatch('pin', { messageId });
		}
		showMoreMenu = false;
	}
	
	function handleDelete() {
		dispatch('delete', { messageId });
		showMoreMenu = false;
	}
	
	function handleThread() {
		dispatch('thread', { messageId });
		showMoreMenu = false;
	}
	
	function handleCopyLink() {
		dispatch('copyLink', { messageId });
		showMoreMenu = false;
	}
	
	function handleCopyText() {
		dispatch('copyText', { messageId });
		showMoreMenu = false;
	}
	
	function handleMarkUnread() {
		dispatch('markUnread', { messageId });
		showMoreMenu = false;
	}
	
	function toggleMoreMenu() {
		showMoreMenu = !showMoreMenu;
	}
	
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.more-menu') && !target.closest('.more-button')) {
			showMoreMenu = false;
		}
	}
	
	// Close menu when action bar becomes hidden
	$: if (!visible) {
		showMoreMenu = false;
	}
</script>

<svelte:window on:click={handleClickOutside} />

{#if visible}
	<div class="action-bar" role="toolbar" aria-label="Message actions">
		<!-- Quick Reactions -->
		<div class="quick-reactions" role="group" aria-label="Quick reactions">
			{#each quickReactions as emoji}
				<Tooltip text={emoji} position="top" delay={100}>
					<button
						class="action-btn quick-react"
						on:click={() => handleQuickReact(emoji)}
						aria-label="React with {emoji}"
						type="button"
					>
						<span class="emoji" aria-hidden="true">{emoji}</span>
					</button>
				</Tooltip>
			{/each}
		</div>
		
		<!-- Separator -->
		<div class="separator" aria-hidden="true"></div>
		
		<!-- Add Reaction (opens emoji picker) -->
		<Tooltip text="Add Reaction" position="top">
			<button
				class="action-btn"
				on:click={handleReactClick}
				aria-label="Add Reaction"
				type="button"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.514 0-10-4.486-10-10S6.486 2 12 2s10 4.486 10 10-4.486 10-10 10zm5.5-13c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 10.5c.83 0 1.5-.67 1.5-1.5S8.83 7.5 8 7.5 6.5 8.17 6.5 9s.67 1.5 1.5 1.5zm4 8c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
				</svg>
			</button>
		</Tooltip>
		
		<!-- Reply -->
		<Tooltip text="Reply" position="top">
			<button
				class="action-btn"
				on:click={handleReply}
				aria-label="Reply"
				type="button"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z"/>
				</svg>
			</button>
		</Tooltip>
		
		<!-- Create Thread -->
		<Tooltip text="Create Thread" position="top">
			<button
				class="action-btn"
				on:click={handleThread}
				aria-label="Create Thread"
				type="button"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06819 17 2.01168 16.9327 2.02453 16.8593L2.33253 15.0993C2.34258 15.0419 2.39244 15 2.45074 15H6.34991L7.40991 9H3.55274C3.47819 9 3.42168 8.93274 3.43453 8.85931L3.74253 7.09931C3.75258 7.04189 3.80244 7 3.86074 7H7.75991L8.45234 3.09903C8.46251 3.04174 8.51231 3 8.57049 3H10.3267C10.4014 3 10.4579 3.06746 10.4449 3.14097L9.75991 7H15.7599L16.4523 3.09903C16.4625 3.04174 16.5123 3 16.5765 3H18.3267C18.4014 3 18.4579 3.06746 18.4449 3.14097L17.7599 7H21.6171C21.6916 7 21.7481 7.06725 21.7353 7.14069L21.4273 8.90069C21.4172 8.95811 21.3674 9 21.3091 9H17.4099L16.3499 15H20.2071C20.2816 15 20.3381 15.0673 20.3253 15.1407L20.0173 16.9007C20.0072 16.9581 19.9574 17 19.8991 17H15.9999L15.3068 20.9096C15.2966 20.9669 15.2468 21.0086 15.1887 21.0086H13.4325C13.3578 21.0086 13.3013 20.9412 13.3143 20.8677L13.9999 17H7.99991L7.30656 20.9096C7.2964 20.9669 7.2466 21.0086 7.18842 21.0086H5.43309C5.35842 21.0086 5.30189 20.9412 5.31494 20.8677L5.43309 21ZM8.34991 15H14.3499L15.4099 9H9.40991L8.34991 15Z"/>
				</svg>
			</button>
		</Tooltip>
		
		<!-- Edit (own messages only) -->
		{#if isOwn}
			<Tooltip text="Edit" position="top">
				<button
					class="action-btn"
					on:click={handleEdit}
					aria-label="Edit"
					type="button"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M19.2929 9.8299L19.9409 9.18278C21.353 7.77064 21.353 5.47197 19.9409 4.05892C18.5287 2.64678 16.2292 2.64678 14.817 4.05892L14.1699 4.70603L19.2929 9.8299ZM12.8962 5.97688L5.18469 13.6906L10.3085 18.8162L18.0201 11.1025L12.8962 5.97688ZM4.11851 20.9704L8.75906 19.8112L4.18692 15.239L3.02678 19.8796C2.95028 20.1856 3.04028 20.5105 3.26349 20.7337C3.48669 20.9569 3.8116 21.0469 4.11851 20.9704Z"/>
					</svg>
				</button>
			</Tooltip>
		{/if}
		
		<!-- More Actions -->
		<div class="more-wrapper">
			<Tooltip text="More" position="top">
				<button
					class="action-btn more-button"
					class:active={showMoreMenu}
					on:click={toggleMoreMenu}
					aria-label="More actions"
					aria-expanded={showMoreMenu}
					aria-haspopup="menu"
					type="button"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M6 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
					</svg>
				</button>
			</Tooltip>
			
			{#if showMoreMenu}
				<div class="more-menu" role="menu" aria-label="More message actions">
					<button class="menu-item" on:click={handleReply} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M10 8.26667V4L3 11.4667L10 18.9333V14.56C15 14.56 18.5 16.2667 21 20C20 14.6667 17 9.33333 10 8.26667Z"/>
						</svg>
						<span>Reply</span>
					</button>
					
					<button class="menu-item" on:click={handleThread} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99991 17H2.14274C2.06819 17 2.01168 16.9327 2.02453 16.8593L2.33253 15.0993C2.34258 15.0419 2.39244 15 2.45074 15H6.34991L7.40991 9H3.55274C3.47819 9 3.42168 8.93274 3.43453 8.85931L3.74253 7.09931C3.75258 7.04189 3.80244 7 3.86074 7H7.75991L8.45234 3.09903C8.46251 3.04174 8.51231 3 8.57049 3H10.3267C10.4014 3 10.4579 3.06746 10.4449 3.14097L9.75991 7H15.7599L16.4523 3.09903C16.4625 3.04174 16.5123 3 16.5765 3H18.3267C18.4014 3 18.4579 3.06746 18.4449 3.14097L17.7599 7H21.6171C21.6916 7 21.7481 7.06725 21.7353 7.14069L21.4273 8.90069C21.4172 8.95811 21.3674 9 21.3091 9H17.4099L16.3499 15H20.2071C20.2816 15 20.3381 15.0673 20.3253 15.1407L20.0173 16.9007C20.0072 16.9581 19.9574 17 19.8991 17H15.9999L15.3068 20.9096C15.2966 20.9669 15.2468 21.0086 15.1887 21.0086H13.4325C13.3578 21.0086 13.3013 20.9412 13.3143 20.8677L13.9999 17H7.99991L7.30656 20.9096C7.2964 20.9669 7.2466 21.0086 7.18842 21.0086H5.43309C5.35842 21.0086 5.30189 20.9412 5.31494 20.8677L5.43309 21ZM8.34991 15H14.3499L15.4099 9H9.40991L8.34991 15Z"/>
						</svg>
						<span>Create Thread</span>
					</button>
					
					{#if isOwn}
						<button class="menu-item" on:click={handleEdit} role="menuitem" type="button">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M19.2929 9.8299L19.9409 9.18278C21.353 7.77064 21.353 5.47197 19.9409 4.05892C18.5287 2.64678 16.2292 2.64678 14.817 4.05892L14.1699 4.70603L19.2929 9.8299ZM12.8962 5.97688L5.18469 13.6906L10.3085 18.8162L18.0201 11.1025L12.8962 5.97688ZM4.11851 20.9704L8.75906 19.8112L4.18692 15.239L3.02678 19.8796C2.95028 20.1856 3.04028 20.5105 3.26349 20.7337C3.48669 20.9569 3.8116 21.0469 4.11851 20.9704Z"/>
							</svg>
							<span>Edit Message</span>
						</button>
					{/if}
					
					<button class="menu-item" on:click={handlePin} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M22 12L12.101 2.10101L10.686 3.51401L12.101 4.92901L7.15096 9.87801V9.88001L5.73596 8.46501L4.32196 9.88001L8.56496 14.122L2.90796 19.778L4.32196 21.192L9.97896 15.536L14.222 19.778L15.636 18.364L14.222 16.95L19.171 12H19.172L20.586 13.414L22 12Z"/>
						</svg>
						<span>{isPinned ? 'Unpin Message' : 'Pin Message'}</span>
					</button>
					
					<button class="menu-item" on:click={handleMarkUnread} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 5C5.648 5 1 12 1 12C1 12 5.648 19 12 19C18.352 19 23 12 23 12C23 12 18.352 5 12 5ZM12 16C9.791 16 8 14.21 8 12C8 9.79 9.791 8 12 8C14.209 8 16 9.79 16 12C16 14.21 14.209 16 12 16Z"/>
							<circle cx="12" cy="12" r="3"/>
						</svg>
						<span>Mark Unread</span>
					</button>
					
					<button class="menu-item" on:click={handleCopyText} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
						</svg>
						<span>Copy Text</span>
					</button>
					
					<button class="menu-item" on:click={handleCopyLink} role="menuitem" type="button">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z"/>
						</svg>
						<span>Copy Message Link</span>
					</button>
					
					<div class="menu-separator" role="separator"></div>
					
					{#if isOwn || canManageMessages}
						<button class="menu-item danger" on:click={handleDelete} role="menuitem" type="button">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
								<path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z"/>
								<path d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z"/>
							</svg>
							<span>Delete Message</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.action-bar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
		background-color: var(--bg-primary, #313338);
		border: 1px solid var(--bg-modifier-accent, #1e1f22);
		border-radius: var(--radius-md, 4px);
		box-shadow: 
			0 8px 16px rgba(0, 0, 0, 0.24),
			0 0 0 1px rgba(0, 0, 0, 0.1);
		position: absolute;
		right: 16px;
		top: -16px;
		z-index: 10;
		animation: actionBarFadeIn 0.1s ease-out;
	}
	
	@keyframes actionBarFadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.quick-reactions {
		display: flex;
		gap: 2px;
	}
	
	.separator {
		width: 1px;
		height: 24px;
		background-color: var(--bg-modifier-accent, #3f4147);
		margin: 0 4px;
	}
	
	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm, 3px);
		color: var(--text-muted, #b5bac1);
		cursor: pointer;
		transition: 
			background-color var(--transition-fast, 0.1s ease),
			color var(--transition-fast, 0.1s ease);
	}
	
	.action-btn:hover {
		background-color: var(--bg-modifier-hover, #35373c);
		color: var(--text-normal, #f2f3f5);
	}
	
	.action-btn:active {
		background-color: var(--bg-modifier-active, #404249);
	}
	
	.action-btn.active {
		background-color: var(--bg-modifier-selected, #404249);
		color: var(--text-normal, #f2f3f5);
	}
	
	.action-btn.quick-react {
		width: 28px;
		height: 28px;
	}
	
	.action-btn.quick-react .emoji {
		font-size: 16px;
		line-height: 1;
		transition: transform 0.1s ease;
	}
	
	.action-btn.quick-react:hover .emoji {
		transform: scale(1.2);
	}
	
	/* More Menu */
	.more-wrapper {
		position: relative;
	}
	
	.more-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 188px;
		padding: 6px 8px;
		background-color: var(--bg-floating, #111214);
		border-radius: var(--radius-md, 4px);
		box-shadow: 
			0 8px 16px rgba(0, 0, 0, 0.24),
			0 0 0 1px rgba(255, 255, 255, 0.06);
		z-index: 20;
		animation: menuFadeIn 0.1s ease-out;
	}
	
	@keyframes menuFadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	
	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm, 3px);
		color: var(--text-normal, #dcddde);
		font-size: var(--font-size-sm, 14px);
		text-align: left;
		cursor: pointer;
		transition: 
			background-color var(--transition-fast, 0.1s ease),
			color var(--transition-fast, 0.1s ease);
	}
	
	.menu-item:hover {
		background-color: var(--blurple, #5865f2);
		color: white;
	}
	
	.menu-item:hover svg {
		color: white;
	}
	
	.menu-item svg {
		color: var(--text-muted, #b5bac1);
		flex-shrink: 0;
		transition: color var(--transition-fast, 0.1s ease);
	}
	
	.menu-item span {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.menu-item.danger {
		color: var(--red, #f23f43);
	}
	
	.menu-item.danger svg {
		color: var(--red, #f23f43);
	}
	
	.menu-item.danger:hover {
		background-color: var(--red, #f23f43);
		color: white;
	}
	
	.menu-item.danger:hover svg {
		color: white;
	}
	
	.menu-separator {
		height: 1px;
		margin: 4px 0;
		background-color: var(--bg-modifier-accent, #3f4147);
	}
	
	/* Mobile responsive */
	@media (max-width: 640px) {
		.action-bar {
			right: 8px;
		}
		
		.quick-reactions {
			display: none;
		}
		
		.separator {
			display: none;
		}
	}
</style>
