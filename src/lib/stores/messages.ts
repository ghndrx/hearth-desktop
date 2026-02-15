import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api';

export interface Message {
	id: string;
	channel_id: string;
	author_id: string;
	author?: {
		id: string;
		username: string;
		display_name: string | null;
		avatar: string | null;
		role_color?: string;
	};
	content: string;
	encrypted: boolean;
	attachments: Attachment[];
	reactions: Reaction[];
	reply_to: string | null;
	reply_to_author?: { username: string };
	reply_to_content?: string;
	pinned: boolean;
	created_at: string;
	edited_at: string | null;
}

// Backend message format (for normalization)
interface BackendMessage {
	id: string;
	channel_id: string;
	guild_id?: string;
	author_id?: string;
	author?: {
		id: string;
		username: string;
		display_name?: string | null;
		avatar?: string | null;
	};
	content: string;
	timestamp?: string;
	created_at?: string;
	edited_timestamp?: string | null;
	edited_at?: string | null;
	pinned: boolean;
	tts?: boolean;
	referenced_message_id?: string | null;
	reply_to?: string | null;
	attachments?: Attachment[];
	reactions?: Reaction[];
}

export interface Attachment {
	id: string;
	filename: string;
	url: string;
	content_type: string;
	size: number;
}

export interface Reaction {
	emoji: string;
	count: number;
	me: boolean;
}

// Map of channel_id -> messages
export const messages = writable<Record<string, Message[]>>({});

// Loading states
export const loadingMessages = writable<Record<string, boolean>>({});

// Normalize backend message to frontend format
function normalizeMessage(msg: BackendMessage): Message {
	return {
		id: msg.id,
		channel_id: msg.channel_id,
		author_id: msg.author?.id || msg.author_id || '',
		author: msg.author ? {
			id: msg.author.id,
			username: msg.author.username,
			display_name: msg.author.display_name ?? null,
			avatar: msg.author.avatar ?? null,
		} : undefined,
		content: msg.content,
		encrypted: false,
		attachments: msg.attachments || [],
		reactions: msg.reactions || [],
		reply_to: msg.referenced_message_id || msg.reply_to || null,
		pinned: msg.pinned,
		created_at: msg.timestamp || msg.created_at || new Date().toISOString(),
		edited_at: msg.edited_timestamp || msg.edited_at || null,
	};
}

export async function loadMessages(channelId: string, before?: string) {
	loadingMessages.update(l => ({ ...l, [channelId]: true }));
	
	try {
		const params = new URLSearchParams({ limit: '50' });
		if (before) params.set('before', before);
		
		const data = await api.get<BackendMessage[]>(`/channels/${channelId}/messages?${params}`);
		const normalized = data.map(normalizeMessage);
		
		messages.update(m => {
			const existing = m[channelId] || [];
			if (before) {
				// Prepend older messages
				return { ...m, [channelId]: [...normalized.reverse(), ...existing] };
			}
			return { ...m, [channelId]: normalized.reverse() };
		});
	} catch (error) {
		console.error('Failed to load messages:', error);
		if (error instanceof ApiError && error.status === 403) {
			// No permission - clear messages for this channel
			messages.update(m => ({ ...m, [channelId]: [] }));
		}
		throw error;
	} finally {
		loadingMessages.update(l => ({ ...l, [channelId]: false }));
	}
}

export async function sendMessage(
	channelId: string,
	content: string,
	attachments: File[] = [],
	replyToId?: string
) {
	try {
		let data: { content: string; reply_to?: string } | FormData = { content };
		if (replyToId) {
			data.reply_to = replyToId;
		}
		
		// If we have attachments, use FormData
		if (attachments.length > 0) {
			const formData = new FormData();
			formData.append('content', content);
			if (replyToId) {
				formData.append('reply_to', replyToId);
			}
			attachments.forEach((file, i) => {
				formData.append(`files[${i}]`, file);
			});
			data = formData;
		}
		
		const response = await api.post<BackendMessage>(`/channels/${channelId}/messages`, data);
		const message = normalizeMessage(response);
		
		// Add to local store (will also come via WebSocket)
		addMessage(message);
		
		return message;
	} catch (error) {
		console.error('Failed to send message:', error);
		throw error;
	}
}

export async function editMessage(messageId: string, channelId: string, content: string) {
	try {
		const response = await api.patch<BackendMessage>(`/channels/${channelId}/messages/${messageId}`, { content });
		const message = normalizeMessage(response);
		updateMessage(message);
		return message;
	} catch (error) {
		console.error('Failed to edit message:', error);
		throw error;
	}
}

export async function deleteMessage(messageId: string, channelId: string) {
	try {
		await api.delete(`/channels/${channelId}/messages/${messageId}`);
		removeMessage(channelId, messageId);
	} catch (error) {
		console.error('Failed to delete message:', error);
		throw error;
	}
}

export async function addReaction(messageId: string, channelId: string, emoji: string) {
	try {
		await api.put(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
	} catch (error) {
		console.error('Failed to add reaction:', error);
		throw error;
	}
}

export async function removeReaction(messageId: string, channelId: string, emoji: string) {
	try {
		await api.delete(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
	} catch (error) {
		console.error('Failed to remove reaction:', error);
		throw error;
	}
}

// Send typing indicator via REST API (not WebSocket)
let typingThrottle: ReturnType<typeof setTimeout> | null = null;
export async function sendTypingIndicator(channelId: string) {
	// Throttle typing requests (backend typing indicator lasts ~10 seconds)
	if (typingThrottle) return;
	
	typingThrottle = setTimeout(() => {
		typingThrottle = null;
	}, 8000);
	
	try {
		await api.post(`/channels/${channelId}/typing`);
	} catch (error) {
		// Typing failures are not critical, just log
		console.debug('Failed to send typing indicator:', error);
	}
}

// Internal functions for updating store

export function addMessage(message: Message) {
	messages.update(m => {
		const channelMessages = m[message.channel_id] || [];
		// Avoid duplicates
		if (channelMessages.find(msg => msg.id === message.id)) {
			return m;
		}
		return {
			...m,
			[message.channel_id]: [...channelMessages, message]
		};
	});
}

export function updateMessage(message: Message) {
	messages.update(m => {
		const channelMessages = m[message.channel_id] || [];
		return {
			...m,
			[message.channel_id]: channelMessages.map(msg =>
				msg.id === message.id ? { ...msg, ...message } : msg
			)
		};
	});
}

export function removeMessage(channelId: string, messageId: string) {
	messages.update(m => {
		const channelMessages = m[channelId] || [];
		return {
			...m,
			[channelId]: channelMessages.filter(msg => msg.id !== messageId)
		};
	});
}

// Handle incoming WebSocket events (data already normalized by gateway)
export function handleMessageCreate(data: Record<string, unknown>) {
	// Ensure required fields exist
	const message: Message = {
		id: data.id as string,
		channel_id: data.channel_id as string,
		author_id: data.author_id as string || '',
		author: data.author as Message['author'],
		content: data.content as string || '',
		encrypted: false,
		attachments: (data.attachments as Attachment[]) || [],
		reactions: (data.reactions as Reaction[]) || [],
		reply_to: (data.reply_to as string) || null,
		pinned: Boolean(data.pinned),
		created_at: (data.created_at as string) || new Date().toISOString(),
		edited_at: (data.edited_at as string) || null,
	};
	addMessage(message);
}

export function handleMessageUpdate(data: Record<string, unknown>) {
	const message: Partial<Message> & { id: string; channel_id: string } = {
		id: data.id as string,
		channel_id: data.channel_id as string,
	};
	
	// Only include fields that are present
	if (data.content !== undefined) message.content = data.content as string;
	if (data.edited_at !== undefined) message.edited_at = data.edited_at as string;
	if (data.pinned !== undefined) message.pinned = Boolean(data.pinned);
	if (data.attachments !== undefined) message.attachments = data.attachments as Attachment[];
	if (data.reactions !== undefined) message.reactions = data.reactions as Reaction[];
	
	updateMessage(message as Message);
}

export function handleMessageDelete(data: { id: string; channel_id: string }) {
	removeMessage(data.channel_id, data.id);
}
