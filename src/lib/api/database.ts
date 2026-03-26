import { invoke } from '@tauri-apps/api/core';
import type { Message, MessageSearchOptions, DirectMessage } from '../types/messages';
import type { Channel, Server } from '../types/channels';

export interface DatabaseMessage {
	id: string;
	channel_id: string;
	user_id: string;
	content: string;
	message_type: string;
	reply_to?: string | null;
	edited_at?: string | null;
	deleted_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface DatabaseDirectMessage {
	id: string;
	participants: string; // JSON string
	last_message_id?: string | null;
	created_at: string;
	updated_at: string;
}

export interface DatabaseChannel {
	id: string;
	server_id: string;
	name: string;
	topic: string | null;
	channel_type: string;
	position: number;
	created_at: string;
	updated_at: string;
}

export interface DatabaseServer {
	id: string;
	name: string;
	icon: string | null;
	owner_id: string;
	created_at: string;
	updated_at: string;
}

/**
 * Database API client for message persistence
 */
export class DatabaseAPI {
	/**
	 * Get messages for a channel from local database
	 */
	static async getMessages(
		channelId: string,
		limit?: number,
		before?: string
	): Promise<Message[]> {
		try {
			const messages: DatabaseMessage[] = await invoke('db_get_messages', {
				channelId,
				limit,
				before
			});

			return messages.map(this.transformDatabaseMessage);
		} catch (error) {
			console.error('Failed to get messages from database:', error);
			throw new Error('Failed to load messages from local storage');
		}
	}

	/**
	 * Save a message to local database
	 */
	static async saveMessage(message: Message): Promise<void> {
		try {
			const dbMessage: DatabaseMessage = {
				id: message.id,
				channel_id: message.channel_id,
				user_id: message.user_id,
				content: message.content,
				message_type: message.type,
				reply_to: message.reply_to,
				edited_at: message.edited_at,
				deleted_at: message.deleted_at,
				created_at: message.created_at,
				updated_at: message.updated_at
			};

			await invoke('db_save_message', { message: dbMessage });
		} catch (error) {
			console.error('Failed to save message to database:', error);
			throw new Error('Failed to save message to local storage');
		}
	}

	/**
	 * Update a message in local database
	 */
	static async updateMessage(messageId: string, content: string): Promise<void> {
		try {
			const updatedAt = new Date().toISOString();
			await invoke('db_update_message', {
				messageId,
				content,
				updatedAt
			});
		} catch (error) {
			console.error('Failed to update message in database:', error);
			throw new Error('Failed to update message in local storage');
		}
	}

	/**
	 * Delete a message in local database (soft delete)
	 */
	static async deleteMessage(messageId: string): Promise<void> {
		try {
			const deletedAt = new Date().toISOString();
			await invoke('db_delete_message', {
				messageId,
				deletedAt
			});
		} catch (error) {
			console.error('Failed to delete message in database:', error);
			throw new Error('Failed to delete message from local storage');
		}
	}

	/**
	 * Search messages in local database
	 */
	static async searchMessages(options: MessageSearchOptions): Promise<Message[]> {
		try {
			const messages: DatabaseMessage[] = await invoke('db_search_messages', {
				query: options.query,
				channelId: options.channel_id,
				limit: options.limit
			});

			return messages.map(this.transformDatabaseMessage);
		} catch (error) {
			console.error('Failed to search messages in database:', error);
			throw new Error('Failed to search messages in local storage');
		}
	}

	/**
	 * Get direct message channels for a user
	 */
	static async getDirectMessages(userId: string): Promise<DirectMessage[]> {
		try {
			const dms: DatabaseDirectMessage[] = await invoke('db_get_direct_messages', {
				userId
			});

			return dms.map(this.transformDatabaseDirectMessage);
		} catch (error) {
			console.error('Failed to get direct messages from database:', error);
			throw new Error('Failed to load direct messages from local storage');
		}
	}

	/**
	 * Transform database message to frontend message format
	 */
	private static transformDatabaseMessage(dbMessage: DatabaseMessage): Message {
		return {
			id: dbMessage.id,
			channel_id: dbMessage.channel_id,
			user_id: dbMessage.user_id,
			content: dbMessage.content,
			type: dbMessage.message_type as 'text' | 'system' | 'file',
			reply_to: dbMessage.reply_to,
			edited_at: dbMessage.edited_at,
			deleted_at: dbMessage.deleted_at,
			created_at: dbMessage.created_at,
			updated_at: dbMessage.updated_at
		};
	}

	/**
	 * Transform database direct message to frontend format
	 */
	private static transformDatabaseDirectMessage(dbDM: DatabaseDirectMessage): DirectMessage {
		return {
			id: dbDM.id,
			participants: JSON.parse(dbDM.participants),
			last_message_id: dbDM.last_message_id,
			created_at: dbDM.created_at,
			updated_at: dbDM.updated_at
		};
	}

	// ============ Channel Methods ============

	/**
	 * Get channels, optionally filtered by server ID
	 */
	static async getChannels(serverId?: string): Promise<Channel[]> {
		try {
			const channels: DatabaseChannel[] = await invoke('db_get_channels', {
				serverId: serverId ?? null
			});

			return channels.map(this.transformDatabaseChannel);
		} catch (error) {
			console.error('Failed to get channels from database:', error);
			throw new Error('Failed to load channels from local storage');
		}
	}

	/**
	 * Get a single channel by ID
	 */
	static async getChannel(channelId: string): Promise<Channel | null> {
		try {
			const channel: DatabaseChannel | null = await invoke('db_get_channel', {
				channelId
			});

			return channel ? this.transformDatabaseChannel(channel) : null;
		} catch (error) {
			console.error('Failed to get channel from database:', error);
			throw new Error('Failed to load channel from local storage');
		}
	}

	/**
	 * Save a channel to local database
	 */
	static async saveChannel(channel: Channel): Promise<void> {
		try {
			const dbChannel: DatabaseChannel = {
				id: channel.id,
				server_id: channel.server_id,
				name: channel.name,
				topic: channel.topic,
				channel_type: channel.type,
				position: channel.position,
				created_at: channel.created_at,
				updated_at: channel.updated_at
			};

			await invoke('db_save_channel', { channel: dbChannel });
		} catch (error) {
			console.error('Failed to save channel to database:', error);
			throw new Error('Failed to save channel to local storage');
		}
	}

	/**
	 * Update a channel in local database
	 */
	static async updateChannel(
		channelId: string,
		updates: { name?: string; topic?: string; position?: number }
	): Promise<void> {
		try {
			const updatedAt = new Date().toISOString();
			await invoke('db_update_channel', {
				channelId,
				name: updates.name ?? null,
				topic: updates.topic ?? null,
				position: updates.position ?? null,
				updatedAt
			});
		} catch (error) {
			console.error('Failed to update channel in database:', error);
			throw new Error('Failed to update channel in local storage');
		}
	}

	/**
	 * Delete a channel from local database
	 */
	static async deleteChannel(channelId: string): Promise<void> {
		try {
			await invoke('db_delete_channel', { channelId });
		} catch (error) {
			console.error('Failed to delete channel from database:', error);
			throw new Error('Failed to delete channel from local storage');
		}
	}

	/**
	 * Transform database channel to frontend channel format
	 */
	private static transformDatabaseChannel(dbChannel: DatabaseChannel): Channel {
		return {
			id: dbChannel.id,
			server_id: dbChannel.server_id,
			name: dbChannel.name,
			topic: dbChannel.topic,
			type: dbChannel.channel_type as 'text' | 'voice',
			position: dbChannel.position,
			created_at: dbChannel.created_at,
			updated_at: dbChannel.updated_at
		};
	}

	// ============ Server Methods ============

	/**
	 * Get all servers from local database
	 */
	static async getServers(): Promise<Server[]> {
		try {
			const servers: DatabaseServer[] = await invoke('db_get_servers');
			return servers.map(this.transformDatabaseServer);
		} catch (error) {
			console.error('Failed to get servers from database:', error);
			throw new Error('Failed to load servers from local storage');
		}
	}

	/**
	 * Get a single server by ID
	 */
	static async getServer(serverId: string): Promise<Server | null> {
		try {
			const server: DatabaseServer | null = await invoke('db_get_server', {
				serverId
			});
			return server ? this.transformDatabaseServer(server) : null;
		} catch (error) {
			console.error('Failed to get server from database:', error);
			throw new Error('Failed to load server from local storage');
		}
	}

	/**
	 * Save a server to local database
	 */
	static async saveServer(server: Server): Promise<void> {
		try {
			const dbServer: DatabaseServer = {
				id: server.id,
				name: server.name,
				icon: server.icon,
				owner_id: server.owner_id,
				created_at: server.created_at,
				updated_at: server.updated_at
			};

			await invoke('db_save_server', { server: dbServer });
		} catch (error) {
			console.error('Failed to save server to database:', error);
			throw new Error('Failed to save server to local storage');
		}
	}

	/**
	 * Delete a server from local database
	 */
	static async deleteServer(serverId: string): Promise<void> {
		try {
			await invoke('db_delete_server', { serverId });
		} catch (error) {
			console.error('Failed to delete server from database:', error);
			throw new Error('Failed to delete server from local storage');
		}
	}

	/**
	 * Transform database server to frontend server format
	 */
	private static transformDatabaseServer(dbServer: DatabaseServer): Server {
		return {
			id: dbServer.id,
			name: dbServer.name,
			icon: dbServer.icon,
			owner_id: dbServer.owner_id,
			created_at: dbServer.created_at,
			updated_at: dbServer.updated_at
		};
	}
}