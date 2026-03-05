import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	updatedAt: string;
	pinned: boolean;
	color: string | null;
	tags: string[];
	sourceChannelId: string | null;
	sourceMessageId: string | null;
}

export interface QuickNotesState {
	notes: Note[];
	activeNoteId: string | null;
	isVisible: boolean;
	isPinned: boolean;
}

export const quickNotesState = writable<QuickNotesState>({
	notes: [],
	activeNoteId: null,
	isVisible: false,
	isPinned: false
});

export const activeNote = derived(quickNotesState, ($state) => {
	if (!$state.activeNoteId) return $state.notes[0] ?? null;
	return $state.notes.find((n) => n.id === $state.activeNoteId) ?? null;
});

export const pinnedNotes = derived(quickNotesState, ($state) =>
	$state.notes.filter((n) => n.pinned)
);

export const noteCount = derived(quickNotesState, ($state) => $state.notes.length);

export async function loadQuickNotes(): Promise<void> {
	const state = await invoke<QuickNotesState>('quicknotes_get_state');
	quickNotesState.set(state);
}

export async function createNote(
	title: string,
	content?: string,
	options?: {
		color?: string;
		tags?: string[];
		sourceChannelId?: string;
		sourceMessageId?: string;
	}
): Promise<Note> {
	const note = await invoke<Note>('quicknotes_create', {
		title,
		content: content ?? null,
		color: options?.color ?? null,
		tags: options?.tags ?? null,
		sourceChannelId: options?.sourceChannelId ?? null,
		sourceMessageId: options?.sourceMessageId ?? null
	});
	await loadQuickNotes();
	return note;
}

export async function updateNote(
	id: string,
	updates: {
		title?: string;
		content?: string;
		color?: string;
		tags?: string[];
	}
): Promise<Note> {
	const note = await invoke<Note>('quicknotes_update', {
		id,
		title: updates.title ?? null,
		content: updates.content ?? null,
		color: updates.color ?? null,
		tags: updates.tags ?? null
	});
	quickNotesState.update((s) => ({
		...s,
		notes: s.notes.map((n) => (n.id === id ? note : n))
	}));
	return note;
}

export async function deleteNote(id: string): Promise<void> {
	await invoke('quicknotes_delete', { id });
	await loadQuickNotes();
}

export async function toggleNotePin(id: string): Promise<void> {
	const note = await invoke<Note>('quicknotes_toggle_pin', { id });
	quickNotesState.update((s) => ({
		...s,
		notes: s.notes.map((n) => (n.id === id ? note : n))
	}));
}

export async function setActiveNote(id: string): Promise<void> {
	await invoke('quicknotes_set_active', { id });
	quickNotesState.update((s) => ({ ...s, activeNoteId: id }));
}

export async function toggleQuickNotes(): Promise<void> {
	const visible = await invoke<boolean>('quicknotes_toggle_visible');
	quickNotesState.update((s) => ({ ...s, isVisible: visible }));
}

export async function searchNotes(query: string): Promise<Note[]> {
	return invoke<Note[]>('quicknotes_search', { query });
}

export async function exportNotes(): Promise<string> {
	return invoke<string>('quicknotes_export');
}

export async function importNotes(json: string): Promise<void> {
	await invoke<Note[]>('quicknotes_import', { json });
	await loadQuickNotes();
}
