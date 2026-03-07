import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface RecentChannel {
	channel_id: string;
	channel_name: string;
	server_id: string | null;
	server_name: string | null;
	channel_type: number;
	visited_at: number;
}

export const recentChannels = writable<RecentChannel[]>([]);

export async function trackChannelVisit(
	channelId: string,
	channelName: string,
	serverId: string | null,
	serverName: string | null,
	channelType: number = 0
): Promise<void> {
	try {
		await invoke('recent_channels_visit', {
			channelId,
			channelName,
			serverId: serverId ?? null,
			serverName: serverName ?? null,
			channelType
		});
		await loadRecentChannels();
	} catch (e) {
		console.warn('Failed to track channel visit:', e);
	}
}

export async function loadRecentChannels(): Promise<void> {
	try {
		const list = await invoke<RecentChannel[]>('recent_channels_list');
		recentChannels.set(list);
	} catch (e) {
		console.warn('Failed to load recent channels:', e);
	}
}

export async function clearRecentChannels(): Promise<void> {
	try {
		await invoke('recent_channels_clear');
		recentChannels.set([]);
	} catch (e) {
		console.warn('Failed to clear recent channels:', e);
	}
}
