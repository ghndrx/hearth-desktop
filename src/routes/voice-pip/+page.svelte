<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { page } from '$app/stores';
	import VoiceParticipant from '$lib/components/VoiceParticipant.svelte';
	import type { VoiceUser } from '$lib/stores/voice';

	let channelId = '';
	let channelName = '';
	let participants: VoiceUser[] = [];
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let windowStartX = 0;
	let windowStartY = 0;
	let isHovered = false;
	let isMinimized = false;
	let unlistenChannelUpdate: UnlistenFn | null = null;

	const appWindow = getCurrentWindow();

	onMount(async () => {
		// Get channel info from URL params
		const params = new URLSearchParams(window.location.search);
		channelId = params.get('id') || '';
		channelName = params.get('name') || 'Voice Channel';

		// Listen for channel updates from main window
		unlistenChannelUpdate = await listen<{ channel_id: string; channel_name: string }>(
			'voice-pip:channel-update',
			(event) => {
				channelId = event.payload.channel_id;
				channelName = event.payload.channel_name;
			}
		);

		// Simulate participants for demo (in real app, this would come from voice store)
		// For now, show placeholder participants
		participants = getDemoParticipants();
	});

	onDestroy(() => {
		if (unlistenChannelUpdate) {
			unlistenChannelUpdate();
		}
	});

	function getDemoParticipants(): VoiceUser[] {
		// Demo data for visual development - replace with actual voice store data
		return [
			{
				id: '1',
				username: 'You',
				display_name: 'You',
				self_muted: false,
				self_deafened: false,
				self_video: false,
				self_stream: false,
				muted: false,
				deafened: false,
				speaking: true
			},
			{
				id: '2',
				username: 'Alice',
				display_name: 'Alice',
				self_muted: false,
				self_deafened: false,
				self_video: false,
				self_stream: false,
				muted: false,
				deafened: false,
				speaking: false
			},
			{
				id: '3',
				username: 'Bob',
				display_name: 'Bob',
				self_muted: true,
				self_deafened: false,
				self_video: false,
				self_stream: false,
				muted: true,
				deafened: false,
				speaking: false
			}
		];
	}

	async function startDrag(e: MouseEvent) {
		// Don't start drag if clicking on controls
		if ((e.target as HTMLElement).closest('.pip-controls')) return;
		
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		
		const position = await appWindow.outerPosition();
		windowStartX = position.x;
		windowStartY = position.y;
		
		await appWindow.startDragging();
	}

	async function handleMinimize() {
		isMinimized = true;
		await invoke('voice_pip_hide');
	}

	async function handleClose() {
		await invoke('voice_pip_close');
	}

	async function handleToggleAlwaysOnTop() {
		// Toggle would require storing and inverting the current state
		// For now, keep it always on top as default
	}
</script>

<div 
	class="voice-pip-overlay"
	class:minimized={isMinimized}
	class:hovered={isHovered}
	on:mouseenter={() => isHovered = true}
	on:mouseleave={() => isHovered = false}
	role="application"
	aria-label="Voice Channel Picture-in-Picture"
>
	<!-- Draggable header -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="pip-header" on:mousedown={startDrag}>
		<div class="pip-title">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="voice-icon">
				<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
				<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
				<line x1="12" y1="19" x2="12" y2="23"/>
				<line x1="8" y1="23" x2="16" y2="23"/>
			</svg>
			<span class="channel-name">{channelName}</span>
		</div>
		
		{#if isHovered}
			<div class="pip-controls">
				<button 
					class="pip-btn pin-btn" 
					title="Always on top"
					on:click|stopPropagation={handleToggleAlwaysOnTop}
				>
					📌
				</button>
				<button 
					class="pip-btn minimize-btn" 
					title="Minimize"
					on:click|stopPropagation={handleMinimize}
				>
					<svg width="10" height="10" viewBox="0 0 12 12">
						<line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/>
					</svg>
				</button>
				<button 
					class="pip-btn close-btn" 
					title="Close"
					on:click|stopPropagation={handleClose}
				>
					<svg width="10" height="10" viewBox="0 0 12 12">
						<line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/>
						<line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/>
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- Participants list -->
	<div class="pip-content">
		{#if participants.length === 0}
			<div class="empty-state">
				<p>No one else is here</p>
			</div>
		{:else}
			<div class="participants-list" role="list">
				{#each participants as user (user.id)}
					<VoiceParticipant {user} />
				{/each}
			</div>
		{/if}
	</div>

	<!-- Resize handle -->
	{#if isHovered}
		<div class="resize-handle se" aria-hidden="true"></div>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: transparent;
		overflow: hidden;
	}

	.voice-pip-overlay {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-primary, #313338);
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--bg-modifier-accent, #3f4147);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		color: var(--text-normal, #dbdee1);
		position: relative;
	}

	.voice-pip-overlay.minimized {
		height: 36px;
	}

	.voice-pip-overlay.hovered {
		border-color: var(--accent-color, #5865f2);
	}

	.pip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 36px;
		padding: 0 8px;
		background: var(--bg-tertiary, #1e1f22);
		cursor: grab;
		user-select: none;
		flex-shrink: 0;
	}

	.pip-header:active {
		cursor: grabbing;
	}

	.pip-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-normal, #dbdee1);
	}

	.voice-icon {
		color: #23a559;
	}

	.channel-name {
		color: var(--text-muted, #949ba4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 150px;
	}

	.pip-controls {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pip-btn {
		width: 22px;
		height: 22px;
		border: none;
		background: transparent;
		color: var(--text-muted, #949ba4);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-size: 11px;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.pip-btn:hover {
		background: var(--bg-modifier-hover, #3f4147);
		color: var(--text-normal, #dbdee1);
	}

	.close-btn:hover {
		background: #ed4245;
		color: white;
	}

	.pip-content {
		flex: 1;
		overflow-y: auto;
		padding: 4px;
	}

	.participants-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted, #949ba4);
		font-size: 13px;
		text-align: center;
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 16px;
		height: 16px;
		cursor: se-resize;
	}

	.resize-handle.se::after {
		content: '';
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 8px;
		height: 8px;
		border-right: 2px solid var(--text-muted, #949ba4);
		border-bottom: 2px solid var(--text-muted, #949ba4);
		opacity: 0.5;
	}

	/* Speaking animation for the header border */
	@keyframes speaking-glow {
		0%, 100% {
			box-shadow: inset 0 0 0 2px #23a559;
		}
		50% {
			box-shadow: inset 0 0 0 2px rgba(35, 165, 89, 0.5);
		}
	}

	.voice-pip-overlay:has(.speaking) .pip-header {
		animation: speaking-glow 1s ease-in-out infinite;
	}
</style>
