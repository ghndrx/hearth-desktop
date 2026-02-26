<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { messages } from '$lib/stores/messages';
	import { focusMode } from '$lib/stores/focusMode';
	import { activity } from '$lib/stores/activity';
	import { servers } from '$lib/stores/servers';

	// Props
	export let compact = false;
	export let showHeader = true;
	export let refreshInterval = 1000; // ms

	// Session tracking
	let sessionStartTime = Date.now();
	let currentTime = Date.now();
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Message stats
	let messagesSent = 0;
	let messagesReceived = 0;
	let reactionsAdded = 0;

	// Activity tracking
	let activeServersVisited = new Set<string>();
	let activeChannelsVisited = new Set<string>();
	let focusTimeMs = 0;
	let lastFocusStart: number | null = null;

	// Track focus mode changes
	let focusModeUnsub: (() => void) | null = null;

	$: sessionDuration = currentTime - sessionStartTime;
	$: formattedDuration = formatDuration(sessionDuration);
	$: focusPercentage = sessionDuration > 0 
		? Math.round((focusTimeMs / sessionDuration) * 100) 
		: 0;
	$: messagesPerHour = sessionDuration > 0 
		? Math.round((messagesSent / (sessionDuration / 3600000)) * 10) / 10 
		: 0;
	$: isIdle = $activity?.idleStatus?.is_idle ?? false;

	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		}
		return `${seconds}s`;
	}

	function formatFocusTime(ms: number): string {
		const totalMinutes = Math.floor(ms / 60000);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	function trackServerVisit(serverId: string) {
		activeServersVisited.add(serverId);
		activeServersVisited = activeServersVisited; // trigger reactivity
	}

	function trackChannelVisit(channelId: string) {
		activeChannelsVisited.add(channelId);
		activeChannelsVisited = activeChannelsVisited; // trigger reactivity
	}

	function handleMessageSent() {
		messagesSent++;
	}

	function handleMessageReceived() {
		messagesReceived++;
	}

	function handleReactionAdded() {
		reactionsAdded++;
	}

	function resetStats() {
		sessionStartTime = Date.now();
		currentTime = Date.now();
		messagesSent = 0;
		messagesReceived = 0;
		reactionsAdded = 0;
		activeServersVisited.clear();
		activeChannelsVisited.clear();
		focusTimeMs = 0;
		lastFocusStart = null;
	}

	function exportStats() {
		const stats = {
			sessionStart: new Date(sessionStartTime).toISOString(),
			sessionDuration: formattedDuration,
			messagesSent,
			messagesReceived,
			reactionsAdded,
			serversVisited: activeServersVisited.size,
			channelsVisited: activeChannelsVisited.size,
			focusTime: formatFocusTime(focusTimeMs),
			focusPercentage,
			messagesPerHour,
			exportedAt: new Date().toISOString()
		};

		const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `hearth-session-${new Date().toISOString().split('T')[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		// Update time every second
		intervalId = setInterval(() => {
			currentTime = Date.now();
			
			// Track focus time
			if ($focusMode && lastFocusStart) {
				focusTimeMs += refreshInterval;
			}
		}, refreshInterval);

		// Subscribe to focus mode changes
		focusModeUnsub = focusMode.subscribe((isFocused) => {
			if (isFocused && !lastFocusStart) {
				lastFocusStart = Date.now();
			} else if (!isFocused && lastFocusStart) {
				focusTimeMs += Date.now() - lastFocusStart;
				lastFocusStart = null;
			}
		});

		// Listen for message events (custom events from app)
		window.addEventListener('hearth:message-sent', handleMessageSent);
		window.addEventListener('hearth:message-received', handleMessageReceived);
		window.addEventListener('hearth:reaction-added', handleReactionAdded);
	});

	onDestroy(() => {
		if (intervalId) {
			clearInterval(intervalId);
		}
		if (focusModeUnsub) {
			focusModeUnsub();
		}
		window.removeEventListener('hearth:message-sent', handleMessageSent);
		window.removeEventListener('hearth:message-received', handleMessageReceived);
		window.removeEventListener('hearth:reaction-added', handleReactionAdded);
	});
</script>

<div 
	class="session-stats-panel" 
	class:compact 
	transition:fade={{ duration: 200 }}
	role="region"
	aria-label="Session Statistics"
>
	{#if showHeader}
		<div class="panel-header">
			<h3>
				<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 20V10M18 20V4M6 20v-4"/>
				</svg>
				Session Stats
			</h3>
			<div class="header-actions">
				<button 
					class="icon-btn" 
					on:click={exportStats} 
					title="Export stats"
					aria-label="Export session statistics"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
					</svg>
				</button>
				<button 
					class="icon-btn" 
					on:click={resetStats} 
					title="Reset stats"
					aria-label="Reset session statistics"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M1 4v6h6M23 20v-6h-6"/>
						<path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<div class="stats-grid">
		<!-- Session Duration -->
		<div class="stat-card primary" transition:scale={{ delay: 50 }}>
			<div class="stat-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<path d="M12 6v6l4 2"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">{formattedDuration}</span>
				<span class="stat-label">Session Time</span>
			</div>
			{#if isIdle}
				<span class="idle-badge" transition:fade>Idle</span>
			{/if}
		</div>

		<!-- Messages -->
		<div class="stat-card" transition:scale={{ delay: 100 }}>
			<div class="stat-icon messages">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">
					{messagesSent}
					<span class="stat-secondary">/ {messagesReceived}</span>
				</span>
				<span class="stat-label">Sent / Received</span>
			</div>
		</div>

		<!-- Activity -->
		<div class="stat-card" transition:scale={{ delay: 150 }}>
			<div class="stat-icon activity">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">{messagesPerHour}</span>
				<span class="stat-label">Messages/Hour</span>
			</div>
		</div>

		<!-- Focus Time -->
		<div class="stat-card" transition:scale={{ delay: 200 }}>
			<div class="stat-icon focus" class:active={$focusMode}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3"/>
					<path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">
					{formatFocusTime(focusTimeMs)}
					<span class="stat-secondary">({focusPercentage}%)</span>
				</span>
				<span class="stat-label">Focus Time</span>
			</div>
			{#if $focusMode}
				<div class="focus-indicator" transition:scale></div>
			{/if}
		</div>

		<!-- Reactions -->
		<div class="stat-card small" transition:scale={{ delay: 250 }}>
			<div class="stat-icon reactions">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/>
					<path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">{reactionsAdded}</span>
				<span class="stat-label">Reactions</span>
			</div>
		</div>

		<!-- Servers/Channels -->
		<div class="stat-card small" transition:scale={{ delay: 300 }}>
			<div class="stat-icon servers">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="2" y="3" width="20" height="14" rx="2"/>
					<path d="M8 21h8M12 17v4"/>
				</svg>
			</div>
			<div class="stat-content">
				<span class="stat-value">
					{activeServersVisited.size}
					<span class="stat-secondary">/ {activeChannelsVisited.size}</span>
				</span>
				<span class="stat-label">Servers / Channels</span>
			</div>
		</div>
	</div>
</div>

<style>
	.session-stats-panel {
		background: var(--bg-secondary, #2f3136);
		border-radius: 12px;
		padding: 16px;
		color: var(--text-primary, #dcddde);
	}

	.session-stats-panel.compact {
		padding: 12px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.panel-header h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.panel-header .icon {
		width: 18px;
		height: 18px;
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-muted, #72767d);
		transition: all 0.15s ease;
	}

	.icon-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.4));
		color: var(--text-primary, #dcddde);
	}

	.icon-btn svg {
		width: 16px;
		height: 16px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	.compact .stats-grid {
		gap: 8px;
	}

	.stat-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		background: var(--bg-tertiary, #202225);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.32));
		transform: translateY(-1px);
	}

	.stat-card.primary {
		grid-column: span 2;
		background: linear-gradient(135deg, var(--brand-primary, #5865f2) 0%, #7289da 100%);
	}

	.stat-card.primary .stat-value,
	.stat-card.primary .stat-label {
		color: #fff;
	}

	.stat-card.small {
		padding: 10px;
	}

	.compact .stat-card {
		padding: 10px;
		gap: 8px;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: var(--bg-secondary, #2f3136);
		flex-shrink: 0;
	}

	.stat-card.primary .stat-icon {
		background: rgba(255, 255, 255, 0.2);
	}

	.stat-icon svg {
		width: 20px;
		height: 20px;
		color: var(--text-muted, #72767d);
	}

	.stat-card.primary .stat-icon svg {
		color: #fff;
	}

	.stat-icon.messages svg {
		color: var(--brand-primary, #5865f2);
	}

	.stat-icon.activity svg {
		color: #43b581;
	}

	.stat-icon.focus svg {
		color: #faa61a;
	}

	.stat-icon.focus.active svg {
		color: #43b581;
		animation: pulse 2s ease-in-out infinite;
	}

	.stat-icon.reactions svg {
		color: #f47b67;
	}

	.stat-icon.servers svg {
		color: #7289da;
	}

	.compact .stat-icon {
		width: 32px;
		height: 32px;
	}

	.compact .stat-icon svg {
		width: 16px;
		height: 16px;
	}

	.stat-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary, #fff);
		line-height: 1.2;
	}

	.compact .stat-value {
		font-size: 14px;
	}

	.stat-secondary {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted, #72767d);
	}

	.stat-card.primary .stat-secondary {
		color: rgba(255, 255, 255, 0.7);
	}

	.stat-label {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-top: 2px;
	}

	.compact .stat-label {
		font-size: 10px;
	}

	.idle-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 4px;
		color: #fff;
		text-transform: uppercase;
	}

	.focus-indicator {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 8px;
		height: 8px;
		background: #43b581;
		border-radius: 50%;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.1);
		}
	}

	/* Dark mode adjustments */
	:global(.theme-light) .session-stats-panel {
		background: var(--bg-secondary, #f2f3f5);
	}

	:global(.theme-light) .stat-card {
		background: var(--bg-tertiary, #fff);
	}

	:global(.theme-light) .stat-icon {
		background: var(--bg-secondary, #e3e5e8);
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.stat-card:hover {
			transform: none;
		}

		.focus-indicator,
		.stat-icon.focus.active svg {
			animation: none;
		}
	}

	/* Mobile responsive */
	@media (max-width: 400px) {
		.stats-grid {
			grid-template-columns: 1fr;
		}

		.stat-card.primary {
			grid-column: span 1;
		}
	}
</style>
