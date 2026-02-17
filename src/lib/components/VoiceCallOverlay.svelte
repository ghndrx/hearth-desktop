<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { voiceCallStore, formatCallDuration, type VoiceParticipant } from '$lib/stores/voiceCall';
	import Avatar from './Avatar.svelte';

	// Overlay state
	let isExpanded = true;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let positionX = 20;
	let positionY = 20;
	let overlayEl: HTMLDivElement;

	// Call duration timer
	let durationDisplay = '00:00';
	let durationInterval: ReturnType<typeof setInterval>;

	// Update duration every second
	onMount(() => {
		durationInterval = setInterval(() => {
			durationDisplay = formatCallDuration($voiceCallStore.startedAt);
		}, 1000);

		// Load saved position from localStorage
		const savedPosition = localStorage.getItem('voiceOverlayPosition');
		if (savedPosition) {
			try {
				const { x, y } = JSON.parse(savedPosition);
				positionX = x;
				positionY = y;
			} catch {
				// Ignore parse errors
			}
		}
	});

	onDestroy(() => {
		if (durationInterval) {
			clearInterval(durationInterval);
		}
	});

	// Dragging handlers
	function handleMouseDown(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		
		isDragging = true;
		dragStartX = e.clientX - positionX;
		dragStartY = e.clientY - positionY;
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		
		const newX = e.clientX - dragStartX;
		const newY = e.clientY - dragStartY;
		
		// Constrain to viewport
		const maxX = window.innerWidth - (overlayEl?.offsetWidth || 300);
		const maxY = window.innerHeight - (overlayEl?.offsetHeight || 200);
		
		positionX = Math.max(0, Math.min(newX, maxX));
		positionY = Math.max(0, Math.min(newY, maxY));
	}

	function handleMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		
		// Save position
		localStorage.setItem('voiceOverlayPosition', JSON.stringify({ x: positionX, y: positionY }));
	}

	function toggleExpand() {
		isExpanded = !isExpanded;
	}

	function handleDisconnect() {
		voiceCallStore.leave();
	}

	function handleToggleMute() {
		voiceCallStore.toggleMute();
	}

	function handleToggleDeafen() {
		voiceCallStore.toggleDeafen();
	}

	// Get status color for participant
	function getSpeakingRingColor(participant: VoiceParticipant): string {
		if (participant.isMuted || participant.isDeafened) return 'transparent';
		if (participant.isSpeaking) return '#23a559';
		return 'transparent';
	}

	$: connectionStatusText = {
		disconnected: 'Disconnected',
		connecting: 'Connecting...',
		connected: 'Voice Connected',
		reconnecting: 'Reconnecting...'
	}[$voiceCallStore.connectionState];
</script>

{#if $voiceCallStore.isActive}
	<div
		bind:this={overlayEl}
		class="voice-overlay"
		class:expanded={isExpanded}
		class:dragging={isDragging}
		style="left: {positionX}px; top: {positionY}px;"
		transition:fly={{ y: 50, duration: 200 }}
		role="dialog"
		aria-label="Voice call overlay"
	>
		<!-- Header (always visible, draggable) -->
		<div 
			class="overlay-header"
			on:mousedown={handleMouseDown}
			role="banner"
		>
			<div class="header-left">
				<div class="channel-info">
					<div class="voice-icon">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
							<path d="M12 3a9 9 0 0 0-9 9v4c0 1.1.9 2 2 2h2v-6H5v-1a7 7 0 0 1 14 0v1h-2v6h2c1.1 0 2-.9 2-2v-4a9 9 0 0 0-9-9z"/>
						</svg>
					</div>
					<div class="channel-details">
						<span class="channel-name">{$voiceCallStore.channelName || 'Voice Channel'}</span>
						{#if $voiceCallStore.serverName}
							<span class="server-name">{$voiceCallStore.serverName}</span>
						{/if}
					</div>
				</div>
			</div>
			
			<div class="header-right">
				<span class="duration">{durationDisplay}</span>
				<button 
					class="expand-btn" 
					on:click={toggleExpand}
					title={isExpanded ? 'Collapse' : 'Expand'}
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						{#if isExpanded}
							<path d="M19 13H5v-2h14v2z"/>
						{:else}
							<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
						{/if}
					</svg>
				</button>
			</div>
		</div>

		<!-- Expanded content -->
		{#if isExpanded}
			<div class="overlay-content" transition:scale={{ duration: 150, start: 0.95 }}>
				<!-- Connection status -->
				<div class="connection-status" class:connected={$voiceCallStore.connectionState === 'connected'}>
					<div class="status-indicator"></div>
					<span>{connectionStatusText}</span>
				</div>

				<!-- Participants grid -->
				<div class="participants-grid">
					{#each $voiceCallStore.participants as participant (participant.id)}
						<div 
							class="participant"
							class:speaking={participant.isSpeaking && !participant.isMuted}
							class:muted={participant.isMuted || participant.isDeafened}
						>
							<div class="participant-avatar" style="--ring-color: {getSpeakingRingColor(participant)}">
								<Avatar 
									src={participant.avatar} 
									username={participant.username} 
									size="md"
								/>
								{#if participant.isMuted}
									<div class="status-badge muted-badge" title="Muted">
										<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
											<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
											<path d="M2.7 3.7L21.3 21.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
										</svg>
									</div>
								{:else if participant.isDeafened}
									<div class="status-badge deafened-badge" title="Deafened">
										<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
											<path d="M12 3a9 9 0 0 0-9 9v4c0 1.1.9 2 2 2h2v-6H5v-1a7 7 0 0 1 14 0v1h-2v6h2c1.1 0 2-.9 2-2v-4a9 9 0 0 0-9-9z"/>
											<path d="M2.7 3.7L21.3 21.3" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
										</svg>
									</div>
								{/if}
								{#if participant.isScreenSharing}
									<div class="status-badge screen-badge" title="Screen Sharing">
										<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
											<path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
										</svg>
									</div>
								{/if}
							</div>
							<span class="participant-name">
								{participant.display_name || participant.username}
							</span>
						</div>
					{:else}
						<div class="no-participants">
							<span>Waiting for others to join...</span>
						</div>
					{/each}
				</div>

				<!-- Controls -->
				<div class="overlay-controls">
					<button 
						class="control-btn"
						class:active={$voiceCallStore.localMuted}
						on:click={handleToggleMute}
						title={$voiceCallStore.localMuted ? 'Unmute' : 'Mute'}
					>
						{#if $voiceCallStore.localMuted}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
								<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
								<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
								<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
							</svg>
						{/if}
					</button>

					<button 
						class="control-btn"
						class:active={$voiceCallStore.localDeafened}
						on:click={handleToggleDeafen}
						title={$voiceCallStore.localDeafened ? 'Undeafen' : 'Deafen'}
					>
						{#if $voiceCallStore.localDeafened}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
								<rect x="6" y="12" width="4" height="8" rx="1"/>
								<rect x="14" y="12" width="4" height="8" rx="1"/>
								<path d="M2.7 3.7L21.3 21.3" stroke="#f23f43" stroke-width="2.5" stroke-linecap="round"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M12 2C6.48 2 2 6.48 2 12v4c0 1.1.9 2 2 2h1v-6H4v-2c0-4.42 3.58-8 8-8s8 3.58 8 8v2h-1v6h1c1.1 0 2-.9 2-2v-4c0-5.52-4.48-10-10-10z"/>
								<rect x="6" y="12" width="4" height="8" rx="1"/>
								<rect x="14" y="12" width="4" height="8" rx="1"/>
							</svg>
						{/if}
					</button>

					<button 
						class="control-btn disconnect-btn"
						on:click={handleDisconnect}
						title="Disconnect"
					>
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.voice-overlay {
		position: fixed;
		z-index: 1000;
		min-width: 280px;
		max-width: 400px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		user-select: none;
		transition: box-shadow 0.2s ease;
	}

	.voice-overlay.dragging {
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
		cursor: grabbing;
	}

	.voice-overlay:not(.expanded) {
		min-width: auto;
	}

	.overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		background: var(--bg-secondary, #2b2d31);
		cursor: grab;
		border-bottom: 1px solid rgba(0, 0, 0, 0.2);
	}

	.overlay-header:active {
		cursor: grabbing;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.voice-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--status-online, #23a559);
		flex-shrink: 0;
	}

	.channel-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.channel-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.server-name {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.duration {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-secondary, #b5bac1);
		font-variant-numeric: tabular-nums;
	}

	.expand-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #949ba4);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.expand-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}

	.overlay-content {
		padding: 12px;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 4px;
		margin-bottom: 12px;
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-warning, #f0b232);
		animation: pulse 1.5s infinite;
	}

	.connection-status.connected .status-indicator {
		background: var(--status-online, #23a559);
		animation: none;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.participants-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
		gap: 12px;
		margin-bottom: 12px;
		max-height: 200px;
		overflow-y: auto;
	}

	.participant {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px;
		border-radius: 8px;
		background: var(--bg-secondary, #2b2d31);
		transition: all 0.15s ease;
	}

	.participant.speaking {
		background: rgba(35, 165, 89, 0.15);
	}

	.participant.muted {
		opacity: 0.7;
	}

	.participant-avatar {
		position: relative;
		border-radius: 50%;
		border: 2px solid var(--ring-color, transparent);
		transition: border-color 0.15s ease;
	}

	.participant.speaking .participant-avatar {
		border-color: var(--status-online, #23a559);
	}

	.status-badge {
		position: absolute;
		bottom: -2px;
		right: -2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--bg-secondary, #2b2d31);
	}

	.muted-badge {
		background: var(--status-danger, #f23f43);
		color: white;
	}

	.deafened-badge {
		background: var(--status-danger, #f23f43);
		color: white;
	}

	.screen-badge {
		background: var(--brand-primary, #5865f2);
		color: white;
	}

	.participant-name {
		font-size: 11px;
		color: var(--text-secondary, #b5bac1);
		text-align: center;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.no-participants {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		color: var(--text-muted, #949ba4);
		font-size: 13px;
	}

	.overlay-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle, rgba(79, 84, 92, 0.24));
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: var(--bg-secondary, #2b2d31);
		border: none;
		border-radius: 50%;
		color: var(--text-secondary, #b5bac1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		color: var(--text-primary, #f2f3f5);
	}

	.control-btn.active {
		background: var(--status-danger, #f23f43);
		color: white;
	}

	.control-btn.active:hover {
		background: #d63439;
	}

	.disconnect-btn {
		background: var(--status-danger, #f23f43);
		color: white;
	}

	.disconnect-btn:hover {
		background: #d63439;
	}
</style>
