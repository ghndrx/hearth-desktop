<script lang="ts">
	import {
		isInMeeting,
		currentMeetingTitle,
		nextEvent,
		minutesUntilNextEvent,
		startCalendarPolling,
		stopCalendarPolling
	} from '$lib/stores/calendar';
	import { onMount, onDestroy } from 'svelte';

	onMount(() => {
		startCalendarPolling();
	});

	onDestroy(() => {
		stopCalendarPolling();
	});

	function formatTime(timestamp: number): string {
		return new Date(timestamp * 1000).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if $isInMeeting}
	<div class="calendar-status in-meeting" title={$currentMeetingTitle ?? 'In a meeting'}>
		<div class="meeting-dot"></div>
		<span class="meeting-text">
			{$currentMeetingTitle ? `In: ${$currentMeetingTitle}` : 'In a meeting'}
		</span>
	</div>
{:else if $nextEvent && $minutesUntilNextEvent !== null && $minutesUntilNextEvent <= 15}
	<div class="calendar-status upcoming" title={$nextEvent.title}>
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="10" />
			<polyline points="12 6 12 12 16 14" />
		</svg>
		<span class="upcoming-text">
			{$nextEvent.title} in {$minutesUntilNextEvent}m
		</span>
	</div>
{/if}

<style>
	.calendar-status {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 11px;
		max-width: 200px;
		overflow: hidden;
	}

	.in-meeting {
		background: rgba(250, 166, 26, 0.15);
		color: #faa61a;
	}

	.meeting-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #faa61a;
		flex-shrink: 0;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.meeting-text,
	.upcoming-text {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.upcoming {
		color: var(--text-muted, #8e9297);
	}
</style>
