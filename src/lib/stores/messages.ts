import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { v4 as uuid } from 'uuid';
import type {
	Message,
	MessageDraft,
	PendingMessage,
	DirectMessage,
	WSIncomingMessage,
	WSMessageCreate,
	WSMessageUpdate,
	WSMessageDelete
} from '../types/messages';
import { MessageStatus, WSMessageType } from '../types/messages';
import { WebSocketManager, ConnectionState } from '../messaging/WebSocketManager';
import { DatabaseAPI } from '../api/database';
import { app } from './app';

// Message store state
export interface MessagesState {
	// Messages grouped by channel ID
	messagesByChannel: Record<string, Message[]>;
	// Pending messages (not yet sent)
	pendingMessages: PendingMessage[];
	// Message drafts for each channel
	drafts: Record<string, MessageDraft>;
	// Typing indicators by channel
	typingIndicators: Record<string, string[]>; // channel_id -> user_ids
	// Currently loaded channels
	loadedChannels: Set<string>;
	// Loading states
	loading: Record<string, boolean>; // channel_id -> loading
	// Connection status
	connected: boolean;
	initialized: boolean;
}

const initialState: MessagesState = {
	messagesByChannel: {},
	pendingMessages: [],
	drafts: {},
	typingIndicators: {},
	loadedChannels: new Set(),
	loading: {},
	connected: false,
	initialized: false
};

// WebSocket manager instance
let wsManager: WebSocketManager | null = null;

// Create the main message store
function createMessagesStore() {
	const { subscribe, set, update } = writable<MessagesState>(initialState);

	return {
		subscribe,
		update, // Expose update for internal use

		/**
		 * Initialize the message store
		 */
		async init(wsUrl?: string) {
			if (!browser) return;

			const token = get(app).token;
			if (!token) {
				console.warn('Cannot initialize messaging without authentication token');
				return;
			}

			// Initialize WebSocket connection
			if (!wsManager && wsUrl) {
				wsManager = new WebSocketManager({
					url: wsUrl,
					token
				});

				// Handle WebSocket messages
				wsManager.addMessageHandler((message: WSIncomingMessage) => {
					handleIncomingMessage(message);
				});

				// Handle connection state changes
				wsManager.addStateChangeHandler((state: ConnectionState) => {
					update((s) => ({
						...s,
						connected: state === ConnectionState.AUTHENTICATED
					}));
				});

				try {
					await wsManager.connect();
				} catch (error) {
					console.error('Failed to connect to messaging service:', error);
				}
			}

			update((s) => ({ ...s, initialized: true }));
		},

		/**
		 * Load messages for a channel
		 */
		async loadMessages(channelId: string, limit = 50, before?: string) {
			update((s) => ({
				...s,
				loading: { ...s.loading, [channelId]: true }
			}));

			try {
				// Load messages from local database first
				const messages = await DatabaseAPI.getMessages(channelId, limit, before);

				update((s) => ({
					...s,
					messagesByChannel: {
						...s.messagesByChannel,
						[channelId]: messages.sort((a, b) =>
							new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
						)
					},
					loadedChannels: new Set([...s.loadedChannels, channelId]),
					loading: { ...s.loading, [channelId]: false }
				}));

				// TODO: Also fetch from remote API to sync latest messages
				// This would be implemented when backend API is available
			} catch (error) {
				console.error('Failed to load messages:', error);

				// Fallback to mock messages for development
				const mockMessages: Message[] = [
					{
						id: uuid(),
						channel_id: channelId,
						user_id: 'user-1',
						content: 'Hello, this is a test message!',
						type: 'text',
						created_at: new Date(Date.now() - 60000).toISOString(),
						updated_at: new Date(Date.now() - 60000).toISOString()
					},
					{
						id: uuid(),
						channel_id: channelId,
						user_id: 'user-2',
						content: 'This is another message in the channel.',
						type: 'text',
						created_at: new Date(Date.now() - 30000).toISOString(),
						updated_at: new Date(Date.now() - 30000).toISOString()
					}
				];

				// Save mock messages to database
				for (const message of mockMessages) {
					try {
						await DatabaseAPI.saveMessage(message);
					} catch (dbError) {
						console.error('Failed to save mock message:', dbError);
					}
				}

				update((s) => ({
					...s,
					messagesByChannel: {
						...s.messagesByChannel,
						[channelId]: mockMessages
					},
					loadedChannels: new Set([...s.loadedChannels, channelId]),
					loading: { ...s.loading, [channelId]: false }
				}));
			}
		},

		/**
		 * Send a message
		 */
		async sendMessage(channelId: string, content: string, replyTo?: string) {
			if (!wsManager) {
				console.error('WebSocket manager not initialized');
				return;
			}

			const nonce = uuid();
			const pendingMessage: PendingMessage = {
				id: uuid(),
				channel_id: channelId,
				content,
				reply_to: replyTo,
				status: MessageStatus.PENDING,
				nonce,
				created_at: new Date().toISOString()
			};

			// Add to pending messages
			update((s) => ({
				...s,
				pendingMessages: [...s.pendingMessages, pendingMessage]
			}));

			// Send via WebSocket
			const wsMessage: WSMessageCreate = {
				type: WSMessageType.MESSAGE_CREATE,
				data: {
					channel_id: channelId,
					content,
					reply_to: replyTo,
					nonce
				}
			};

			try {
				wsManager.send(wsMessage);

				// Update status to sent
				update((s) => ({
					...s,
					pendingMessages: s.pendingMessages.map((msg) =>
						msg.id === pendingMessage.id
							? { ...msg, status: MessageStatus.SENT }
							: msg
					)
				}));
			} catch (error) {
				console.error('Failed to send message:', error);

				// Update status to failed
				update((s) => ({
					...s,
					pendingMessages: s.pendingMessages.map((msg) =>
						msg.id === pendingMessage.id
							? { ...msg, status: MessageStatus.FAILED }
							: msg
					)
				}));
			}

			// Clear draft
			this.clearDraft(channelId);
		},

		/**
		 * Update a message
		 */
		async updateMessage(messageId: string, content: string) {
			if (!wsManager) return;

			const wsMessage: WSMessageUpdate = {
				type: WSMessageType.MESSAGE_UPDATE,
				data: {
					message_id: messageId,
					content
				}
			};

			wsManager.send(wsMessage);
		},

		/**
		 * Delete a message
		 */
		async deleteMessage(messageId: string) {
			if (!wsManager) return;

			const wsMessage: WSMessageDelete = {
				type: WSMessageType.MESSAGE_DELETE,
				data: {
					message_id: messageId
				}
			};

			wsManager.send(wsMessage);
		},

		/**
		 * Save a draft for a channel
		 */
		saveDraft(channelId: string, content: string, replyTo?: string) {
			update((s) => ({
				...s,
				drafts: {
					...s.drafts,
					[channelId]: {
						channel_id: channelId,
						content,
						reply_to: replyTo
					}
				}
			}));
		},

		/**
		 * Get draft for a channel
		 */
		getDraft(channelId: string) {
			const state = get({ subscribe });
			return state.drafts[channelId];
		},

		/**
		 * Clear draft for a channel
		 */
		clearDraft(channelId: string) {
			update((s) => {
				const newDrafts = { ...s.drafts };
				delete newDrafts[channelId];
				return {
					...s,
					drafts: newDrafts
				};
			});
		},

		/**
		 * Retry sending a failed message
		 */
		retryMessage(pendingMessageId: string) {
			const state = get({ subscribe });
			const pendingMessage = state.pendingMessages.find((msg) => msg.id === pendingMessageId);

			if (pendingMessage) {
				this.sendMessage(
					pendingMessage.channel_id,
					pendingMessage.content,
					pendingMessage.reply_to || undefined
				);

				// Remove the failed message
				update((s) => ({
					...s,
					pendingMessages: s.pendingMessages.filter((msg) => msg.id !== pendingMessageId)
				}));
			}
		},

		/**
		 * Clean up resources
		 */
		destroy() {
			if (wsManager) {
				wsManager.disconnect();
				wsManager = null;
			}
			set(initialState);
		}
	};
}

// Store instance for handling messages
let storeInstance: ReturnType<typeof createMessagesStore>;

// Handle incoming WebSocket messages
async function handleIncomingMessage(message: WSIncomingMessage) {
	switch (message.type) {
		case WSMessageType.MESSAGE_CREATE:
			const newMessage = message.data as Message;

			// Save to database
			try {
				await DatabaseAPI.saveMessage(newMessage);
			} catch (error) {
				console.error('Failed to save incoming message to database:', error);
			}

			storeInstance.update((s: MessagesState) => {
				const channelMessages = s.messagesByChannel[newMessage.channel_id] || [];

				// Check if this message replaces a pending message (by nonce)
				const pendingIndex = s.pendingMessages.findIndex(
					(pending: PendingMessage) => pending.nonce === (message.data as any).nonce
				);

				let newPendingMessages = s.pendingMessages;
				if (pendingIndex !== -1) {
					newPendingMessages = s.pendingMessages.filter((_: PendingMessage, i: number) => i !== pendingIndex);
				}

				return {
					...s,
					messagesByChannel: {
						...s.messagesByChannel,
						[newMessage.channel_id]: [...channelMessages, newMessage]
					},
					pendingMessages: newPendingMessages
				};
			});
			break;

		case WSMessageType.MESSAGE_UPDATE:
			const updatedMessage = message.data as Message;

			// Update in database
			try {
				await DatabaseAPI.updateMessage(updatedMessage.id, updatedMessage.content);
			} catch (error) {
				console.error('Failed to update message in database:', error);
			}

			storeInstance.update((s: MessagesState) => {
				const channelMessages = s.messagesByChannel[updatedMessage.channel_id] || [];

				return {
					...s,
					messagesByChannel: {
						...s.messagesByChannel,
						[updatedMessage.channel_id]: channelMessages.map((msg: Message) =>
							msg.id === updatedMessage.id ? updatedMessage : msg
						)
					}
				};
			});
			break;

		case WSMessageType.MESSAGE_DELETE:
			const { message_id, channel_id } = message.data as { message_id: string; channel_id: string };

			// Delete from database (soft delete)
			try {
				await DatabaseAPI.deleteMessage(message_id);
			} catch (error) {
				console.error('Failed to delete message in database:', error);
			}

			storeInstance.update((s: MessagesState) => {
				const channelMessages = s.messagesByChannel[channel_id] || [];

				return {
					...s,
					messagesByChannel: {
						...s.messagesByChannel,
						[channel_id]: channelMessages.filter((msg: Message) => msg.id !== message_id)
					}
				};
			});
			break;

		case WSMessageType.TYPING_START:
		case WSMessageType.TYPING_STOP:
			// Handle typing indicators
			storeInstance.update((s: MessagesState) => {
				const { channel_id, user_id } = message.data as { channel_id: string; user_id: string };
				const currentTyping = s.typingIndicators[channel_id] || [];

				let newTyping: string[];
				if (message.type === WSMessageType.TYPING_START) {
					newTyping = currentTyping.includes(user_id)
						? currentTyping
						: [...currentTyping, user_id];
				} else {
					newTyping = currentTyping.filter((id: string) => id !== user_id);
				}

				return {
					...s,
					typingIndicators: {
						...s.typingIndicators,
						[channel_id]: newTyping
					}
				};
			});
			break;
	}
}

export const messagesStore = createMessagesStore();

// Set the store instance for message handlers
storeInstance = messagesStore;

// Derived stores for convenience
export const isMessagingConnected = derived(messagesStore, ($messages) => $messages.connected);
export const isMessagingInitialized = derived(messagesStore, ($messages) => $messages.initialized);

// Channel-specific derived stores
export const createChannelMessagesStore = (channelId: string) =>
	derived(messagesStore, ($messages) => ({
		messages: $messages.messagesByChannel[channelId] || [],
		pendingMessages: $messages.pendingMessages.filter((msg) => msg.channel_id === channelId),
		loading: $messages.loading[channelId] || false,
		loaded: $messages.loadedChannels.has(channelId),
		typing: $messages.typingIndicators[channelId] || [],
		draft: $messages.drafts[channelId]
	}));

// Direct messages store (simplified for now)
function createDirectMessagesStore() {
	const { subscribe, set, update } = writable<DirectMessage[]>([]);

	return {
		subscribe,
		// TODO: Implement direct message functionality
		loadDirectMessages: async () => {},
		createDirectMessage: async (userIds: string[]) => {}
	};
}

export const directMessages = createDirectMessagesStore();