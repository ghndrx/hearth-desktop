import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ScheduledMessage {
	id: string;
	channelId: string;
	content: string;
	scheduledAt: number; // Unix timestamp ms
	createdAt: number;
	status: 'pending' | 'sent' | 'failed' | 'cancelled';
	attachments: string[];
	replyTo: string | null;
}

export interface ScheduleRequest {
	channelId: string;
	content: string;
	scheduledAt: number;
	attachments?: string[];
	replyTo?: string;
}

const messagesInternal = writable<ScheduledMessage[]>([]);
export const scheduledMessages = { subscribe: messagesInternal.subscribe };

export const pendingCount = derived(messagesInternal, ($m) =>
	$m.filter((m) => m.status === 'pending').length
);

export const panelOpen = writable(false);

let unlisteners: UnlistenFn[] = [];

export async function initScheduler() {
	await loadMessages();

	if (unlisteners.length === 0) {
		unlisteners.push(
			await listen<ScheduledMessage>('scheduler:added', (event) => {
				messagesInternal.update((list) => {
					const updated = [...list, event.payload];
					updated.sort((a, b) => a.scheduledAt - b.scheduledAt);
					return updated;
				});
			}),
			await listen<ScheduledMessage>('scheduler:cancelled', (event) => {
				messagesInternal.update((list) =>
					list.map((m) => (m.id === event.payload.id ? event.payload : m))
				);
			}),
			await listen<ScheduledMessage>('scheduler:sent', (event) => {
				messagesInternal.update((list) =>
					list.map((m) => (m.id === event.payload.id ? event.payload : m))
				);
			}),
			await listen<ScheduledMessage>('scheduler:updated', (event) => {
				messagesInternal.update((list) => {
					const updated = list.map((m) =>
						m.id === event.payload.id ? event.payload : m
					);
					updated.sort((a, b) => a.scheduledAt - b.scheduledAt);
					return updated;
				});
			}),
			await listen<ScheduledMessage>('scheduler:failed', (event) => {
				messagesInternal.update((list) =>
					list.map((m) => (m.id === event.payload.id ? event.payload : m))
				);
			})
		);
	}
}

export async function loadMessages() {
	try {
		const list = await invoke<ScheduledMessage[]>('get_scheduled_messages');
		list.sort((a, b) => a.scheduledAt - b.scheduledAt);
		messagesInternal.set(list);
	} catch (e) {
		console.error('Failed to load scheduled messages:', e);
	}
}

export async function scheduleMessage(req: ScheduleRequest): Promise<ScheduledMessage> {
	const msg = await invoke<ScheduledMessage>('schedule_message', {
		request: {
			channelId: req.channelId,
			content: req.content,
			scheduledAt: req.scheduledAt,
			attachments: req.attachments ?? [],
			replyTo: req.replyTo ?? null,
		},
	});
	messagesInternal.update((list) => {
		const updated = [...list, msg];
		updated.sort((a, b) => a.scheduledAt - b.scheduledAt);
		return updated;
	});
	return msg;
}

export async function cancelScheduledMessage(id: string) {
	await invoke<ScheduledMessage>('cancel_scheduled_message', { id });
	messagesInternal.update((list) =>
		list.map((m) => (m.id === id ? { ...m, status: 'cancelled' as const } : m))
	);
}

export async function updateScheduledMessage(id: string, content?: string, scheduledAt?: number) {
	await invoke<ScheduledMessage>('update_scheduled_message', {
		request: { id, content: content ?? null, scheduledAt: scheduledAt ?? null },
	});
	messagesInternal.update((list) => {
		const updated = list.map((m) => {
			if (m.id !== id) return m;
			return {
				...m,
				...(content !== undefined ? { content } : {}),
				...(scheduledAt !== undefined ? { scheduledAt } : {}),
			};
		});
		updated.sort((a, b) => a.scheduledAt - b.scheduledAt);
		return updated;
	});
}

export function togglePanel() {
	panelOpen.update((v) => !v);
}

export function cleanup() {
	for (const unlisten of unlisteners) {
		unlisten();
	}
	unlisteners = [];
}
