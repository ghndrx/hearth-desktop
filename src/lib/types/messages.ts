export interface Message {
	id: string;
	channel_id: string;
	user_id: string;
	content: string;
	type: 'text' | 'system' | 'file';
	reply_to?: string | null;
	edited_at?: string | null;
	deleted_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface MessageReaction {
	id: string;
	message_id: string;
	user_id: string;
	emoji: string;
	created_at: string;
}

export interface MessageAttachment {
	id: string;
	message_id: string;
	filename: string;
	url: string;
	size: number;
	mime_type: string;
	width?: number | null;
	height?: number | null;
	created_at: string;
}

export interface MessageDraft {
	channel_id: string;
	content: string;
	reply_to?: string | null;
}

export interface MessagePagination {
	before?: string;
	after?: string;
	limit?: number;
}

export interface MessageSearchOptions {
	query: string;
	channel_id?: string;
	user_id?: string;
	after?: string;
	before?: string;
	limit?: number;
}

export interface DirectMessage {
	id: string;
	participants: string[];
	last_message_id?: string | null;
	created_at: string;
	updated_at: string;
}

// WebSocket message types for real-time communication
export interface WSMessage {
	type: WSMessageType;
	data: any;
	timestamp: number;
}

export enum WSMessageType {
	// Connection
	AUTHENTICATE = 'authenticate',
	HEARTBEAT = 'heartbeat',

	// Messages
	MESSAGE_CREATE = 'message_create',
	MESSAGE_UPDATE = 'message_update',
	MESSAGE_DELETE = 'message_delete',
	MESSAGE_REACTION_ADD = 'message_reaction_add',
	MESSAGE_REACTION_REMOVE = 'message_reaction_remove',

	// Typing indicators
	TYPING_START = 'typing_start',
	TYPING_STOP = 'typing_stop',

	// User presence
	PRESENCE_UPDATE = 'presence_update',

	// Channel events
	CHANNEL_JOIN = 'channel_join',
	CHANNEL_LEAVE = 'channel_leave',
}

export interface WSMessageCreate {
	type: WSMessageType.MESSAGE_CREATE;
	data: {
		channel_id: string;
		content: string;
		reply_to?: string | null;
		nonce?: string; // For deduplication
	};
}

export interface WSMessageUpdate {
	type: WSMessageType.MESSAGE_UPDATE;
	data: {
		message_id: string;
		content: string;
	};
}

export interface WSMessageDelete {
	type: WSMessageType.MESSAGE_DELETE;
	data: {
		message_id: string;
	};
}

export interface WSTypingStart {
	type: WSMessageType.TYPING_START;
	data: {
		channel_id: string;
	};
}

export interface WSTypingStop {
	type: WSMessageType.TYPING_STOP;
	data: {
		channel_id: string;
	};
}

export interface WSAuthenticate {
	type: WSMessageType.AUTHENTICATE;
	data: {
		token: string;
	};
}

export interface WSHeartbeat {
	type: WSMessageType.HEARTBEAT;
	data: null;
}

export type WSOutgoingMessage =
	| WSMessageCreate
	| WSMessageUpdate
	| WSMessageDelete
	| WSTypingStart
	| WSTypingStop
	| WSAuthenticate
	| WSHeartbeat;

// Incoming WebSocket messages from server
export interface WSIncomingMessageCreate {
	type: WSMessageType.MESSAGE_CREATE;
	data: Message;
}

export interface WSIncomingMessageUpdate {
	type: WSMessageType.MESSAGE_UPDATE;
	data: Message;
}

export interface WSIncomingMessageDelete {
	type: WSMessageType.MESSAGE_DELETE;
	data: {
		message_id: string;
		channel_id: string;
	};
}

export interface WSIncomingTyping {
	type: WSMessageType.TYPING_START | WSMessageType.TYPING_STOP;
	data: {
		channel_id: string;
		user_id: string;
	};
}

export type WSIncomingMessage =
	| WSIncomingMessageCreate
	| WSIncomingMessageUpdate
	| WSIncomingMessageDelete
	| WSIncomingTyping
	| WSHeartbeat;

// Message status for offline handling
export enum MessageStatus {
	PENDING = 'pending',
	SENT = 'sent',
	FAILED = 'failed',
}

export interface PendingMessage {
	id: string; // temporary ID
	channel_id: string;
	content: string;
	reply_to?: string | null;
	status: MessageStatus;
	nonce: string;
	created_at: string;
}