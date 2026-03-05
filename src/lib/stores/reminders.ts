import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface Reminder {
	id: string;
	messageId: string;
	channelId: string;
	serverId: string | null;
	messagePreview: string;
	authorName: string;
	note: string | null;
	remindAt: string;
	createdAt: string;
	fired: boolean;
}

export interface ReminderFiredEvent {
	id: string;
	messageId: string;
	channelId: string;
	serverId: string | null;
	messagePreview: string;
	authorName: string;
}

const remindersInternal = writable<Reminder[]>([]);
export const reminders = { subscribe: remindersInternal.subscribe };

export const pendingCount = derived(remindersInternal, ($r) =>
	$r.filter((r) => !r.fired).length
);

export const panelOpen = writable(false);

let unlisten: UnlistenFn | null = null;

export async function initReminders() {
	await loadReminders();

	if (!unlisten) {
		unlisten = await listen<ReminderFiredEvent>('reminder:fired', (event) => {
			// Remove fired reminder from local state
			remindersInternal.update((list) =>
				list.filter((r) => r.id !== event.payload.id)
			);
		});
	}
}

export async function loadReminders() {
	try {
		const list = await invoke<Reminder[]>('reminder_get_all');
		remindersInternal.set(list);
	} catch (e) {
		console.error('Failed to load reminders:', e);
	}
}

export async function createReminder(params: {
	messageId: string;
	channelId: string;
	serverId?: string;
	messagePreview: string;
	authorName: string;
	note?: string;
	remindAt: Date;
}): Promise<Reminder> {
	const reminder = await invoke<Reminder>('reminder_create', {
		messageId: params.messageId,
		channelId: params.channelId,
		serverId: params.serverId ?? null,
		messagePreview: params.messagePreview,
		authorName: params.authorName,
		note: params.note ?? null,
		remindAt: params.remindAt.toISOString(),
	});
	remindersInternal.update((list) => {
		const updated = [...list, reminder];
		updated.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
		return updated;
	});
	return reminder;
}

export async function cancelReminder(id: string) {
	await invoke<boolean>('reminder_cancel', { id });
	remindersInternal.update((list) => list.filter((r) => r.id !== id));
}

export async function rescheduleReminder(id: string, remindAt: Date) {
	await invoke<boolean>('reminder_reschedule', { id, remindAt: remindAt.toISOString() });
	remindersInternal.update((list) => {
		const updated = list.map((r) =>
			r.id === id ? { ...r, remindAt: remindAt.toISOString() } : r
		);
		updated.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
		return updated;
	});
}

export async function updateReminderNote(id: string, note: string | null) {
	await invoke<boolean>('reminder_update_note', { id, note });
	remindersInternal.update((list) =>
		list.map((r) => (r.id === id ? { ...r, note } : r))
	);
}

export function togglePanel() {
	panelOpen.update((v) => !v);
}

export function cleanup() {
	if (unlisten) {
		unlisten();
		unlisten = null;
	}
}
