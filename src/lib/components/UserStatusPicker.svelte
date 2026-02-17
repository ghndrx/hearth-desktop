<script lang="ts">
	/**
	 * UserStatusPicker Component
	 * 
	 * Allows users to set their presence status:
	 * - Online, Idle, Do Not Disturb, Invisible
	 * - Custom status with optional emoji
	 */
	
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { gateway } from '$lib/stores/gateway';
	import { presenceStore, getStatusColor, getStatusLabel, type PresenceStatus } from '$lib/stores/presence';
	import EmojiPicker from './EmojiPicker.svelte';
	
	export let show = false;
	export let anchorX = 0;
	export let anchorY = 0;
	export let currentStatus: PresenceStatus = 'online';
	export let currentCustomStatus: string = '';
	export let currentEmoji: string = '';
	
	const dispatch = createEventDispatcher<{
		close: void;
		statusChange: { status: PresenceStatus; customStatus?: string; emoji?: string };
	}>();
	
	let menuElement: HTMLDivElement;
	let showCustomStatusInput = false;
	let showEmojiPicker = false;
	let customStatusText = currentCustomStatus;
	let selectedEmoji = currentEmoji;
	let customStatusInputRef: HTMLInputElement;
	
	const statusOptions: { status: PresenceStatus; label: string; icon: string }[] = [
		{ status: 'online', label: 'Online', icon: 'online' },
		{ status: 'idle', label: 'Idle', icon: 'idle' },
		{ status: 'dnd', label: 'Do Not Disturb', icon: 'dnd' },
		{ status: 'invisible', label: 'Invisible', icon: 'invisible' },
	];
	
	function handleClickOutside(event: MouseEvent) {
		if (menuElement && !menuElement.contains(event.target as Node)) {
			close();
		}
	}
	
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showEmojiPicker) {
				showEmojiPicker = false;
			} else if (showCustomStatusInput) {
				showCustomStatusInput = false;
			} else {
				close();
			}
		}
	}
	
	function close() {
		show = false;
		showCustomStatusInput = false;
		showEmojiPicker = false;
		dispatch('close');
	}
	
	function selectStatus(status: PresenceStatus) {
		currentStatus = status;
		
		// Build activities array for custom status
		const activities: unknown[] = [];
		if (customStatusText || selectedEmoji) {
			activities.push({
				type: 4, // Custom status
				name: 'Custom Status',
				state: customStatusText || undefined,
				emoji: selectedEmoji ? { name: selectedEmoji } : undefined,
			});
		}
		
		gateway.updatePresence(status, status === 'idle');
		presenceStore.setStatus(status);
		
		dispatch('statusChange', { 
			status, 
			customStatus: customStatusText || undefined,
			emoji: selectedEmoji || undefined,
		});
		close();
	}
	
	function openCustomStatus() {
		showCustomStatusInput = true;
		setTimeout(() => customStatusInputRef?.focus(), 50);
	}
	
	function saveCustomStatus() {
		// Save the custom status and set current presence
		const activities: unknown[] = [];
		if (customStatusText || selectedEmoji) {
			activities.push({
				type: 4, // Custom status
				name: 'Custom Status',
				state: customStatusText || undefined,
				emoji: selectedEmoji ? { name: selectedEmoji } : undefined,
			});
		}
		
		gateway.updatePresence(currentStatus, currentStatus === 'idle');
		
		dispatch('statusChange', { 
			status: currentStatus, 
			customStatus: customStatusText || undefined,
			emoji: selectedEmoji || undefined,
		});
		
		showCustomStatusInput = false;
	}
	
	function clearCustomStatus() {
		customStatusText = '';
		selectedEmoji = '';
		saveCustomStatus();
	}
	
	function handleEmojiSelect(event: CustomEvent<string>) {
		selectedEmoji = event.detail;
		showEmojiPicker = false;
	}
	
	function handleCustomStatusKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			saveCustomStatus();
		}
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside, true);
		document.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		document.removeEventListener('click', handleClickOutside, true);
		document.removeEventListener('keydown', handleKeydown);
	});
	
	// Position adjustment
	$: if (show && menuElement) {
		const rect = menuElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		
		if (anchorX + rect.width > viewportWidth) {
			anchorX = viewportWidth - rect.width - 8;
		}
		if (anchorY + rect.height > viewportHeight) {
			anchorY = anchorY - rect.height - 8;
		}
	}
</script>

{#if show}
	<div
		bind:this={menuElement}
		class="status-picker"
		style="left: {anchorX}px; bottom: calc(100vh - {anchorY}px + 8px);"
		role="menu"
		aria-label="Set status"
	>
		{#if showCustomStatusInput}
			<!-- Custom Status Input View -->
			<div class="custom-status-view">
				<div class="custom-status-header">
					<button class="back-btn" on:click={() => showCustomStatusInput = false} aria-label="Back">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
						</svg>
					</button>
					<span class="header-title">Set Custom Status</span>
				</div>
				
				<div class="custom-status-input-row">
					<button 
						class="emoji-btn"
						on:click={() => showEmojiPicker = !showEmojiPicker}
						aria-label="Pick emoji"
					>
						{#if selectedEmoji}
							<span class="selected-emoji">{selectedEmoji}</span>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zm1-2c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm8 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
							</svg>
						{/if}
					</button>
					<input
						bind:this={customStatusInputRef}
						bind:value={customStatusText}
						type="text"
						class="custom-status-input"
						placeholder="What's happening?"
						maxlength="128"
						on:keydown={handleCustomStatusKeydown}
					/>
				</div>
				
				{#if showEmojiPicker}
					<div class="emoji-picker-container">
						<EmojiPicker show={true} on:select={handleEmojiSelect} on:close={() => showEmojiPicker = false} />
					</div>
				{/if}
				
				<div class="custom-status-actions">
					{#if customStatusText || selectedEmoji}
						<button class="clear-btn" on:click={clearCustomStatus}>
							Clear Status
						</button>
					{/if}
					<button class="save-btn" on:click={saveCustomStatus}>
						Save
					</button>
				</div>
			</div>
		{:else}
			<!-- Main Status Selection View -->
			<div class="status-section">
				{#each statusOptions as option}
					<button
						class="status-option"
						class:selected={currentStatus === option.status}
						on:click={() => selectStatus(option.status)}
						role="menuitem"
					>
						<div class="status-indicator" data-status={option.status}>
							{#if option.status === 'idle'}
								<div class="idle-moon"></div>
							{:else if option.status === 'dnd'}
								<div class="dnd-dash"></div>
							{:else if option.status === 'invisible'}
								<div class="invisible-ring"></div>
							{/if}
						</div>
						<span class="status-label">{option.label}</span>
						{#if currentStatus === option.status}
							<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
							</svg>
						{/if}
					</button>
				{/each}
			</div>
			
			<div class="divider"></div>
			
			<button class="custom-status-btn" on:click={openCustomStatus} role="menuitem">
				<div class="custom-status-icon">
					{#if selectedEmoji}
						<span>{selectedEmoji}</span>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-6c.78 2.34 2.72 4 5 4s4.22-1.66 5-4H7zm1-2c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm8 0c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
						</svg>
					{/if}
				</div>
				<div class="custom-status-content">
					{#if customStatusText}
						<span class="custom-status-text">{customStatusText}</span>
					{:else}
						<span class="custom-status-placeholder">Set Custom Status</span>
					{/if}
				</div>
				<svg class="chevron-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
				</svg>
			</button>
		{/if}
	</div>
{/if}

<style>
	.status-picker {
		position: fixed;
		z-index: 1001;
		min-width: 220px;
		max-width: 300px;
		background-color: var(--bg-floating, #111214);
		border-radius: 8px;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
		padding: 8px;
		animation: slideUp 0.15s ease-out;
	}
	
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.status-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	
	.status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		text-align: left;
		transition: background-color 0.1s ease;
	}
	
	.status-option:hover {
		background-color: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}
	
	.status-option.selected {
		background-color: var(--bg-modifier-selected, rgba(79, 84, 92, 0.6));
	}
	
	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		position: relative;
		flex-shrink: 0;
	}
	
	.status-indicator[data-status="online"] {
		background-color: #23a559;
	}
	
	.status-indicator[data-status="idle"] {
		background-color: #f0b232;
	}
	
	.status-indicator[data-status="dnd"] {
		background-color: #f23f43;
	}
	
	.status-indicator[data-status="invisible"] {
		background-color: #80848e;
	}
	
	.idle-moon {
		position: absolute;
		top: -1px;
		right: -1px;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--bg-floating, #111214);
	}
	
	.dnd-dash {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 6px;
		height: 2px;
		background-color: var(--bg-floating, #111214);
		border-radius: 1px;
	}
	
	.invisible-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: var(--bg-floating, #111214);
	}
	
	.status-label {
		flex: 1;
	}
	
	.check-icon {
		color: var(--text-positive, #23a559);
	}
	
	.divider {
		height: 1px;
		background-color: var(--bg-modifier-accent, #3f4147);
		margin: 8px 4px;
	}
	
	.custom-status-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		text-align: left;
		transition: background-color 0.1s ease;
	}
	
	.custom-status-btn:hover {
		background-color: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
	}
	
	.custom-status-icon {
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted, #949ba4);
	}
	
	.custom-status-icon span {
		font-size: 16px;
	}
	
	.custom-status-content {
		flex: 1;
		min-width: 0;
	}
	
	.custom-status-text {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.custom-status-placeholder {
		color: var(--text-muted, #949ba4);
	}
	
	.chevron-icon {
		color: var(--text-muted, #949ba4);
	}
	
	/* Custom Status Input View */
	.custom-status-view {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	
	.custom-status-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 0;
	}
	
	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #949ba4);
		transition: all 0.1s ease;
	}
	
	.back-btn:hover {
		background-color: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-normal, #dbdee1);
	}
	
	.header-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
	}
	
	.custom-status-input-row {
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: var(--bg-secondary, #1e1f22);
		border-radius: 4px;
		padding: 8px 12px;
	}
	
	.emoji-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #949ba4);
		transition: all 0.1s ease;
		flex-shrink: 0;
	}
	
	.emoji-btn:hover {
		background-color: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-normal, #dbdee1);
	}
	
	.selected-emoji {
		font-size: 18px;
	}
	
	.custom-status-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-normal, #dbdee1);
		font-size: 14px;
		outline: none;
	}
	
	.custom-status-input::placeholder {
		color: var(--text-muted, #949ba4);
	}
	
	.emoji-picker-container {
		position: relative;
		margin-top: -4px;
	}
	
	.emoji-picker-container :global(.emoji-picker) {
		position: relative !important;
		left: 0 !important;
		top: 0 !important;
		width: 100%;
		max-height: 280px;
	}
	
	.custom-status-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	
	.clear-btn {
		padding: 8px 16px;
		border-radius: 4px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted, #949ba4);
		font-size: 14px;
		font-weight: 500;
		transition: all 0.1s ease;
	}
	
	.clear-btn:hover {
		color: var(--text-normal, #dbdee1);
		text-decoration: underline;
	}
	
	.save-btn {
		padding: 8px 16px;
		border-radius: 4px;
		background-color: var(--brand-primary, #5865f2);
		border: none;
		cursor: pointer;
		color: white;
		font-size: 14px;
		font-weight: 500;
		transition: background-color 0.1s ease;
	}
	
	.save-btn:hover {
		background-color: var(--brand-hover, #4752c4);
	}
	
	.save-btn:active {
		background-color: var(--brand-active, #3c45a5);
	}
</style>
