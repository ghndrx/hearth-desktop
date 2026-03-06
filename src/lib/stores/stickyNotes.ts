import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export interface StickyNote {
	id: string;
	content: string;
	color: StickyNoteColor;
	positionX: number;
	positionY: number;
	width: number;
	height: number;
	pinned: boolean;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
	channelId: string | null;
	messageId: string | null;
}

export const stickyNotes = writable<StickyNote[]>([]);
export const archivedNotes = writable<StickyNote[]>([]);

export const pinnedStickyNotes = derived(stickyNotes, ($notes) =>
	$notes.filter((n) => n.pinned)
);

export const stickyNoteCount = derived(stickyNotes, ($notes) => $notes.length);

export async function loadStickyNotes(): Promise<void> {
	const notes = await invoke<StickyNote[]>('sticky_get_all');
	stickyNotes.set(notes);
}

export async function loadArchivedNotes(): Promise<void> {
	const notes = await invoke<StickyNote[]>('sticky_get_archived');
	archivedNotes.set(notes);
}

export async function createNote(
	content: string,
	color?: StickyNoteColor,
	positionX?: number,
	positionY?: number
): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_create', {
		content,
		color: color ?? null,
		positionX: positionX ?? null,
		positionY: positionY ?? null
	});
	stickyNotes.update((notes) => [...notes, note]);
	return note;
}

export async function updateNote(id: string, content: string): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_update', { id, content });
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function deleteNote(id: string): Promise<boolean> {
	const result = await invoke<boolean>('sticky_delete', { id });
	stickyNotes.update((notes) => notes.filter((n) => n.id !== id));
	return result;
}

export async function setNoteColor(id: string, color: StickyNoteColor): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_set_color', { id, color });
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function setNotePosition(id: string, x: number, y: number): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_set_position', { id, x, y });
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function setNoteSize(
	id: string,
	width: number,
	height: number
): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_set_size', { id, width, height });
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function togglePin(id: string): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_toggle_pin', { id });
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function archiveNote(id: string): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_archive', { id });
	stickyNotes.update((notes) => notes.filter((n) => n.id !== id));
	archivedNotes.update((notes) => [...notes, note]);
	return note;
}

export async function restoreNote(id: string): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_restore', { id });
	archivedNotes.update((notes) => notes.filter((n) => n.id !== id));
	stickyNotes.update((notes) => [...notes, note]);
	return note;
}

export async function linkNoteToMessage(
	id: string,
	channelId: string,
	messageId: string
): Promise<StickyNote> {
	const note = await invoke<StickyNote>('sticky_link_to_message', {
		id,
		channelId,
		messageId
	});
	stickyNotes.update((notes) => notes.map((n) => (n.id === id ? note : n)));
	return note;
}

export async function clearArchived(): Promise<number> {
	const count = await invoke<number>('sticky_clear_archived');
	archivedNotes.set([]);
	return count;
}
