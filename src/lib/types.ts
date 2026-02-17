// User types
export interface User {
	id: string;
	username: string;
	email?: string;
	display_name: string | null;
	discriminator?: string;
	avatar: string | null;
	avatar_url?: string | null;
	avatarUrl?: string; // Alias for compatibility
	banner?: string | null;
	banner_url?: string | null;
	bio?: string | null;
	about_me?: string | null;
	pronouns?: string | null;
	accent_color?: number | null;
	custom_status?: string | null;
	role_color?: string;
	status?: 'online' | 'idle' | 'dnd' | 'offline';
	flags?: number;
	created_at?: string;
	createdAt?: string; // Alias for compatibility
}

// Connected account types
export type ConnectedAccountType = 'github' | 'twitter' | 'spotify' | 'steam' | 'twitch' | 'youtube' | 'reddit' | 'playstation' | 'xbox';

export interface ConnectedAccount {
	id: string;
	user_id: string;
	type: ConnectedAccountType;
	account_id: string;
	account_name: string | null;
	verified: boolean;
	visibility: 0 | 1 | 2; // 0=private, 1=friends only, 2=everyone
	show_activity: boolean;
	created_at: string;
}

// User badge types
export interface UserBadge {
	id: string;
	user_id: string;
	badge_type: string;
	badge_name: string;
	badge_icon: string | null;
	description: string | null;
	earned_at: string;
	expires_at: string | null;
}

// Custom status with emoji
export interface UserCustomStatus {
	custom_text: string | null;
	emoji: string | null;
	emoji_id: string | null;
	emoji_name: string | null;
	clear_after: string | null;
}

// Server (Guild) types
export interface Server {
	id: string;
	name: string;
	icon_url?: string | null;
	iconUrl?: string | null; // Alias for compatibility
	banner_url?: string | null;
	description?: string | null;
	owner_id: string;
	ownerId?: string; // Alias for compatibility
	features?: string[];
	created_at: string;
	createdAt?: string; // Alias for compatibility
}

// Channel types (string values matching backend)
export const ChannelType = {
	TEXT: 'text',
	DM: 'dm',
	VOICE: 'voice',
	GROUP_DM: 'group_dm',
	CATEGORY: 'category',
	ANNOUNCEMENT: 'announcement',
	FORUM: 'forum',
	STAGE: 'stage'
} as const;

export type ChannelTypeString = 'text' | 'voice' | 'announcement' | 'category' | 'dm' | 'group_dm';

export interface Channel {
	id: string;
	server_id?: string | null;
	serverId?: string | null; // Alias for compatibility
	name: string;
	type: ChannelTypeString; // Backend uses string type: 'text', 'voice', 'dm', etc.
	topic?: string;
	position: number;
	nsfw?: boolean;
	slowmode?: number;
	last_message_id?: string | null;
	created_at: string;
	createdAt?: string; // Alias for compatibility
}

// Message types
export type MessageType = 'default' | 'reply' | 'recipient_add' | 'recipient_remove' | 'call' | 'channel_name_change' | 'channel_icon_change' | 'pinned' | 'member_join' | 'thread_created';

export interface Message {
	id: string;
	channel_id: string;
	author_id: string;
	server_id?: string;
	guild_id?: string; // Backend uses guild_id
	content: string;
	encrypted_content?: string;
	encrypted: boolean;
	type: MessageType;
	reply_to?: string | null;
	reply_to_id?: string;
	referenced_message_id?: string | null; // Backend field
	thread_id?: string;
	pinned: boolean;
	tts: boolean;
	mention_everyone: boolean;
	flags: number;
	created_at: string;
	timestamp?: string; // Backend field
	edited_at?: string | null;
	edited_timestamp?: string | null; // Backend field
	author?: User;
	attachments?: Attachment[];
	embeds?: Embed[];
	reactions?: Reaction[];
	mentions?: string[];
	mention_roles?: string[];
	referenced_message?: Message;
}

export interface Embed {
	type?: string;
	title?: string;
	description?: string;
	url?: string;
	timestamp?: string;
	color?: number;
	footer?: { text: string; icon_url?: string };
	image?: { url: string; proxy_url?: string; width?: number; height?: number };
	thumbnail?: { url: string; proxy_url?: string; width?: number; height?: number };
	video?: { url: string; proxy_url?: string; width?: number; height?: number };
	provider?: { name?: string; url?: string };
	author?: { name: string; url?: string; icon_url?: string };
	fields?: { name: string; value: string; inline?: boolean }[];
}

export interface Attachment {
	id: string;
	message_id?: string;
	filename: string;
	url: string;
	proxy_url?: string;
	size: number;
	content_type?: string;
	width?: number;
	height?: number;
	ephemeral?: boolean;
	encrypted?: boolean;
	encrypted_key?: string;
	iv?: string;
	created_at?: string;
}

export interface Reaction {
	message_id: string;
	emoji: string;
	count: number;
	me: boolean;
	user_ids?: string[];
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

// User Profile Enhancements (UX-003)
export interface SharedChannel {
	id: string;
	name: string;
	server_id: string;
	server_name: string;
	server_icon: string | null;
}

export interface RecentActivity {
	last_message_at: string | null;
	server_name: string | null;
	channel_name: string | null;
	message_count_24h: number;
}

export interface UserProfile {
	user: User;
	badges?: UserBadge[];
	connected_accounts?: ConnectedAccount[];
	mutual_servers: { id: string; name: string; icon_url: string | null }[];
	shared_channels: SharedChannel[];
	mutual_friends: { id: string; username: string; avatar_url: string | null }[];
	recent_activity: RecentActivity | null;
	total_mutual: {
		servers: number;
		channels: number;
		friends: number;
	};
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

// Backend auth response format
export interface BackendAuthResponse {
	access_token: string;
	refresh_token: string;
	expires_in?: number;
	token_type?: string;
}

// Frontend auth response format (normalized)
export interface AuthResponse {
	user: User;
	token: string;
	refreshToken: string;
}
