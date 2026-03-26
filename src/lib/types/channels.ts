// Channel types for Hearth messaging infrastructure

export interface Channel {
	id: string;
	server_id: string;
	name: string;
	topic: string | null;
	type: 'text' | 'voice';
	position: number;
	created_at: string;
	updated_at: string;
}

export interface Server {
	id: string;
	name: string;
	icon: string | null;
	owner_id: string;
	created_at: string;
	updated_at: string;
}

export interface ChannelCategory {
	id: string;
	server_id: string;
	name: string;
	position: number;
}

// WebSocket message types for channels
export interface WSChannelCreate {
	type: 'channel_create';
	data: Channel;
}

export interface WSChannelUpdate {
	type: 'channel_update';
	data: {
		channel_id: string;
		name?: string;
		topic?: string;
		position?: number;
	};
}

export interface WSChannelDelete {
	type: 'channel_delete';
	data: {
		channel_id: string;
		server_id: string;
	};
}

export interface WSServerCreate {
	type: 'server_create';
	data: Server;
}

export interface WSServerUpdate {
	type: 'server_update';
	data: {
		server_id: string;
		name?: string;
		icon?: string;
	};
}

export interface WSServerDelete {
	type: 'server_delete';
	data: {
		server_id: string;
	};
}

export type WSChannelMessage =
	| WSChannelCreate
	| WSChannelUpdate
	| WSChannelDelete
	| WSServerCreate
	| WSServerUpdate
	| WSServerDelete;
