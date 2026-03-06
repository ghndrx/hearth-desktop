import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface VoiceMemo {
	id: string;
	title: string;
	file_path: string;
	duration_ms: number;
	file_size: number;
	channel_id: string | null;
	transcript: string | null;
	tags: string[];
	created_at: number;
	is_favorite: boolean;
	waveform_data: number[];
}

export interface VoiceMemoRecordingState {
	is_recording: boolean;
	current_memo_id: string | null;
	recording_start_time: number | null;
	audio_level: number;
}

export interface VoiceMemoStats {
	total_count: number;
	total_duration_ms: number;
	favorites_count: number;
}

export const voiceMemos = writable<VoiceMemo[]>([]);
export const recordingState = writable<VoiceMemoRecordingState>({
	is_recording: false,
	current_memo_id: null,
	recording_start_time: null,
	audio_level: 0
});
export const memoCount = derived(voiceMemos, ($memos) => $memos.length);
export const favoriteMemos = derived(voiceMemos, ($memos) => $memos.filter((m) => m.is_favorite));

export async function startRecording(): Promise<void> {
	const state = await invoke<VoiceMemoRecordingState>('memo_start_recording');
	recordingState.set(state);
}

export async function stopRecording(data: {
	title: string;
	file_path: string;
	duration_ms: number;
	file_size: number;
	channel_id?: string;
	tags?: string[];
	waveform_data?: number[];
}): Promise<VoiceMemo> {
	const memo = await invoke<VoiceMemo>('memo_stop_recording', { data });
	recordingState.set({
		is_recording: false,
		current_memo_id: null,
		recording_start_time: null,
		audio_level: 0
	});
	voiceMemos.update((memos) => [memo, ...memos]);
	return memo;
}

export async function cancelRecording(): Promise<void> {
	await invoke('memo_cancel_recording');
	recordingState.set({
		is_recording: false,
		current_memo_id: null,
		recording_start_time: null,
		audio_level: 0
	});
}

export async function getRecordingState(): Promise<VoiceMemoRecordingState> {
	const state = await invoke<VoiceMemoRecordingState>('memo_get_recording_state');
	recordingState.set(state);
	return state;
}

export async function saveMemo(data: {
	title: string;
	file_path: string;
	duration_ms: number;
	file_size: number;
	channel_id?: string;
	tags?: string[];
	waveform_data?: number[];
}): Promise<VoiceMemo> {
	const memo = await invoke<VoiceMemo>('memo_save', { data });
	voiceMemos.update((memos) => [memo, ...memos]);
	return memo;
}

export async function deleteMemo(id: string): Promise<void> {
	await invoke('memo_delete', { id });
	voiceMemos.update((memos) => memos.filter((m) => m.id !== id));
}

export async function getAllMemos(): Promise<void> {
	const memos = await invoke<VoiceMemo[]>('memo_get_all');
	voiceMemos.set(memos);
}

export async function getMemosByChannel(channelId: string): Promise<VoiceMemo[]> {
	return invoke<VoiceMemo[]>('memo_get_by_channel', { channelId });
}

export async function searchMemos(query: string): Promise<VoiceMemo[]> {
	return invoke<VoiceMemo[]>('memo_search', { query });
}

export async function toggleFavorite(id: string): Promise<void> {
	await invoke('memo_toggle_favorite', { id });
	voiceMemos.update((memos) =>
		memos.map((m) => (m.id === id ? { ...m, is_favorite: !m.is_favorite } : m))
	);
}

export async function updateMemoTitle(id: string, title: string): Promise<void> {
	await invoke('memo_update_title', { id, title });
	voiceMemos.update((memos) => memos.map((m) => (m.id === id ? { ...m, title } : m)));
}

export async function updateTranscript(id: string, transcript: string): Promise<void> {
	await invoke('memo_update_transcript', { id, transcript });
	voiceMemos.update((memos) =>
		memos.map((m) => (m.id === id ? { ...m, transcript } : m))
	);
}

export async function updateMemoTags(id: string, tags: string[]): Promise<void> {
	await invoke('memo_update_tags', { id, tags });
	voiceMemos.update((memos) => memos.map((m) => (m.id === id ? { ...m, tags } : m)));
}

export async function getMemoStats(): Promise<VoiceMemoStats> {
	return invoke<VoiceMemoStats>('memo_get_stats');
}

export async function exportMemos(): Promise<string> {
	return invoke<string>('memo_export');
}
