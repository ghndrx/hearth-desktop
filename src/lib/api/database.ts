import { invoke } from '@tauri-apps/api/core';
import type { Message, MessageSearchOptions, DirectMessage } from '../types/messages';

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
}