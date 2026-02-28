import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface CalendarEvent {
	title: string;
	start_time: number;
	end_time: number;
	is_all_day: boolean;
	location: string | null;
	calendar_name: string | null;
}

export const currentEvents = writable<CalendarEvent[]>([]);
export const nextEvent = writable<CalendarEvent | null>(null);
export const isInMeeting = writable(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;

export async function refreshCalendar() {
	try {
		const [meeting, current, next] = await Promise.all([
			invoke<boolean>('calendar_check_in_meeting'),
			invoke<CalendarEvent[]>('calendar_get_current_events'),
			invoke<CalendarEvent | null>('calendar_get_next_event')
		]);
		isInMeeting.set(meeting);
		currentEvents.set(current);
		nextEvent.set(next);
	} catch {
		// Calendar integration is optional
	}
}

export function startCalendarPolling(intervalMs = 60000) {
	refreshCalendar();
	pollInterval = setInterval(refreshCalendar, intervalMs);
}

export function stopCalendarPolling() {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export const currentMeetingTitle = derived(
	[isInMeeting, currentEvents],
	([$inMeeting, $events]) => {
		if (!$inMeeting || $events.length === 0) return null;
		return $events[0].title;
	}
);

export const minutesUntilNextEvent = derived(nextEvent, ($next) => {
	if (!$next) return null;
	const now = Math.floor(Date.now() / 1000);
	return Math.max(0, Math.floor(($next.start_time - now) / 60));
});
