// User types
export interface User {
	id: string;
	username: string;
	email: string;
	avatarUrl?: string;
	status: 'online' | 'idle' | 'dnd' | 'offline';
	createdAt: string;
}

// Server (Guild) types
export interface Server {
	id: string;
	name: string;
	iconUrl?: string;
	ownerId: string;
	createdAt: string;
}

// Channel types
export type ChannelType = 'text' | 'voice' | 'announcement';

export interface Channel {
	id: string;
	serverId: string;
	name: string;
	type: ChannelType;
	topic?: string;
	position: number;
	createdAt: string;
}

// Message types
export interface Message {
	id: string;
	channelId: string;
	authorId: string;
	author?: User;
	content: string;
	createdAt: string;
	updatedAt?: string;
	attachments?: Attachment[];
	reactions?: Reaction[];
}

export interface Attachment {
	id: string;
	url: string;
	filename: string;
	contentType: string;
	size: number;
}

export interface Reaction {
	emoji: string;
	count: number;
	userIds: string[];
}

// Member types
export interface Member {
	userId: string;
	serverId: string;
	user?: User;
	nickname?: string;
	joinedAt: string;
	roles: string[];
}

// Role types
export interface Role {
	id: string;
	serverId: string;
	name: string;
	color: string;
	position: number;
	permissions: string[];
}

// WebSocket event types
export type WSEventType =
	| 'MESSAGE_CREATE'
	| 'MESSAGE_UPDATE'
	| 'MESSAGE_DELETE'
	| 'CHANNEL_CREATE'
	| 'CHANNEL_UPDATE'
	| 'CHANNEL_DELETE'
	| 'MEMBER_JOIN'
	| 'MEMBER_LEAVE'
	| 'MEMBER_UPDATE'
	| 'PRESENCE_UPDATE'
	| 'TYPING_START'
	| 'READY';

export interface WSEvent<T = unknown> {
	type: WSEventType;
	data: T;
	timestamp: string;
}

// Auth types
export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterRequest {
	username: string;
	email: string;
	password: string;
}

export interface AuthResponse {
	user: User;
	token: string;
}
