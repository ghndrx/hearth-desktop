import { writable, derived } from 'svelte/store';
import { api, ApiError } from '$lib/api';
import { currentServer } from './servers';

export interface Channel {
	id: string;
	server_id: string | null;
	name: string;
	topic: string | null;
	type: number; // 0=text, 1=dm, 2=voice, 3=group_dm, 4=category
	position: number;
	parent_id: string | null;
	slowmode: number;
	nsfw: boolean;
	e2ee_enabled: boolean;
	recipients?: User[];
	last_message_id: string | null;
	last_message_at: string | null;
}

// Backend channel format (for normalization)
interface BackendChannel {
	id: string;
	server_id?: string | null;
	guild_id?: string | null;
	name: string;
	topic?: string | null;
	type: number | string; // Backend sends string, frontend expects number
	position?: number;
	parent_id?: string | null;
	slowmode?: number;
	rate_limit_per_user?: number;
	nsfw?: boolean;
	e2ee_enabled?: boolean;
	recipients?: User[];
	last_message_id?: string | null;
	last_message_at?: string | null;
}

export interface User {
	id: string;
	username: string;
	display_name: string | null;
	avatar: string | null;
}

export const channels = writable<Channel[]>([]);
export const currentChannel = writable<Channel | null>(null);
export const channelsLoading = writable(false);
export const channelsError = writable<string | null>(null);

// Channel type mapping from backend strings to frontend numbers
const CHANNEL_TYPE_MAP: Record<string, number> = {
	'text': 0,
	'dm': 1,
	'voice': 2,
	'group_dm': 3,
	'category': 4,
	'announcement': 5,
	'forum': 6,
	'stage': 7
};

// Normalize backend channel to frontend format
function normalizeChannel(ch: BackendChannel): Channel {
	// Convert string type to numeric
	let channelType: number;
	if (typeof ch.type === 'string') {
		channelType = CHANNEL_TYPE_MAP[ch.type] ?? 0;
	} else {
		channelType = ch.type;
	}

	return {
		id: ch.id,
		server_id: ch.server_id || ch.guild_id || null,
		name: ch.name,
		topic: ch.topic ?? null,
		type: channelType,
		position: ch.position ?? 0,
		parent_id: ch.parent_id ?? null,
		slowmode: ch.slowmode ?? ch.rate_limit_per_user ?? 0,
		nsfw: ch.nsfw ?? false,
		e2ee_enabled: ch.e2ee_enabled ?? false,
		recipients: ch.recipients,
		last_message_id: ch.last_message_id ?? null,
		last_message_at: ch.last_message_at ?? null,
	};
}

// Derived store for current server's channels
export const serverChannels = derived(
	[channels, currentServer],
	([$channels, $currentServer]) => {
		if (!$currentServer) return [];
		return $channels.filter(c => c.server_id === $currentServer.id);
	}
);

// Derived store for DM channels
export const dmChannels = derived(channels, $channels => 
	$channels.filter(c => c.type === 1 || c.type === 3)
);

export async function loadServerChannels(serverId: string) {
	channelsLoading.set(true);
	channelsError.set(null);
	
	try {
		const data = await api.get<BackendChannel[]>(`/servers/${serverId}/channels`);
		const normalized = data.map(normalizeChannel);
		
		channels.update(c => {
			// Remove old channels for this server, add new ones
			const other = c.filter(ch => ch.server_id !== serverId);
			return [...other, ...normalized];
		});
	} catch (error) {
		console.error('Failed to load channels:', error);
		if (error instanceof ApiError) {
			channelsError.set(error.message);
		}
		throw error;
	} finally {
		channelsLoading.set(false);
	}
}

export async function loadDMChannels() {
	channelsLoading.set(true);
	channelsError.set(null);
	
	try {
		const data = await api.get<BackendChannel[]>('/users/@me/channels');
		const normalized = data.map(normalizeChannel);
		
		channels.update(c => {
			// Remove old DM channels, add new ones
			const serverChs = c.filter(ch => ch.server_id !== null);
			return [...serverChs, ...normalized];
		});
	} catch (error) {
		console.error('Failed to load DM channels:', error);
		if (error instanceof ApiError) {
			channelsError.set(error.message);
		}
		throw error;
	} finally {
		channelsLoading.set(false);
	}
}

export type ChannelTypeString = 'text' | 'voice' | 'announcement';

export interface CreateChannelOptions {
	name: string;
	type?: ChannelTypeString;
	topic?: string;
	parentId?: string;
	nsfw?: boolean;
}

export async function createChannel(serverId: string, options: CreateChannelOptions) {
	try {
		const payload: {
			name: string;
			type: string;
			topic?: string;
			parent_id?: string;
			nsfw?: boolean;
		} = {
			name: options.name,
			type: options.type || 'text'
		};
		
		if (options.topic) {
			payload.topic = options.topic;
		}
		if (options.parentId) {
			payload.parent_id = options.parentId;
		}
		if (options.nsfw !== undefined) {
			payload.nsfw = options.nsfw;
		}
		
		const response = await api.post<BackendChannel>(`/servers/${serverId}/channels`, payload);
		const channel = normalizeChannel(response);
		
		channels.update(c => [...c, channel]);
		return channel;
	} catch (error) {
		console.error('Failed to create channel:', error);
		throw error;
	}
}

export async function updateChannel(id: string, updates: Partial<Pick<Channel, 'name' | 'topic' | 'position' | 'parent_id' | 'nsfw' | 'slowmode'>>) {
	try {
		// Map frontend field names to backend if needed
		const payload: Record<string, unknown> = { ...updates };
		if ('slowmode' in updates) {
			payload.rate_limit_per_user = updates.slowmode;
			delete payload.slowmode;
		}
		
		const response = await api.patch<BackendChannel>(`/channels/${id}`, payload);
		const channel = normalizeChannel(response);
		
		channels.update(c => c.map(ch => ch.id === id ? channel : ch));
		currentChannel.update(ch => ch?.id === id ? channel : ch);
		return channel;
	} catch (error) {
		console.error('Failed to update channel:', error);
		throw error;
	}
}

export async function deleteChannel(id: string) {
	try {
		await api.delete(`/channels/${id}`);
		channels.update(c => c.filter(ch => ch.id !== id));
		currentChannel.update(ch => ch?.id === id ? null : ch);
	} catch (error) {
		console.error('Failed to delete channel:', error);
		throw error;
	}
}

export async function createDM(userId: string) {
	try {
		// POST to /users/@me/channels creates/gets a DM channel
		const response = await api.post<BackendChannel>('/users/@me/channels', { recipient_id: userId });
		const channel = normalizeChannel(response);
		
		channels.update(c => {
			// Avoid duplicates
			if (c.find(ch => ch.id === channel.id)) return c;
			return [...c, channel];
		});
		return channel;
	} catch (error) {
		console.error('Failed to create DM:', error);
		throw error;
	}
}

export async function getChannel(id: string): Promise<Channel | null> {
	try {
		const response = await api.get<BackendChannel>(`/channels/${id}`);
		return normalizeChannel(response);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
}
