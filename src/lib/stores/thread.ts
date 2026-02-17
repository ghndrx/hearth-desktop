/**
 * Thread Store
 * FEAT-001: Message Threading Enhancements
 * 
 * Manages thread state including:
 * - Thread sidebar visibility
 * - Thread messages
 * - Thread participants
 * - Thread notification preferences
 * - Thread presence (active viewers)
 */
import { writable, get, derived } from 'svelte/store';
import { api } from '$lib/api';
import type { Message } from './messages';
import { gateway } from './gateway';

/**
 * FEAT-001: Message Threading Enhancements
 * Thread participant interface
 */
export interface ThreadParticipant {
	id: string;
	username: string;
	display_name?: string | null;
	avatar?: string | null;
}

/**
 * FEAT-001: Active viewer in a thread (real-time presence)
 */
export interface ThreadActiveViewer {
	id: string;
	username: string;
	display_name?: string | null;
	avatar?: string | null;
}

/**
 * FEAT-001: Thread notification level options
 */
export type ThreadNotificationLevel = 'all' | 'mentions' | 'none';

export interface Thread {
	id: string;
	channel_id: string;
	parent_message_id: string;
	parent_message?: Message;
	name?: string;
	message_count: number;
	member_count?: number;
	created_at: string;
	last_message_at?: string;
	participants?: ThreadParticipant[];
}

export interface ThreadMessage extends Message {
	thread_id: string;
}

interface ThreadState {
	currentThread: Thread | null;
	messages: ThreadMessage[];
	loading: boolean;
	sending: boolean;
	// FEAT-001: Notification preferences
	notificationLevel: ThreadNotificationLevel;
	// FEAT-001: Active viewers (real-time presence)
	activeViewers: ThreadActiveViewer[];
}

// Heartbeat interval for presence (30 seconds)
const PRESENCE_HEARTBEAT_INTERVAL = 30000;

function createThreadStore() {
	const { subscribe, set, update } = writable<ThreadState>({
		currentThread: null,
		messages: [],
		loading: false,
		sending: false,
		notificationLevel: 'all',
		activeViewers: []
	});

	let presenceHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let gatewayUnsubscribe: (() => void) | null = null;

	// Subscribe to gateway events for thread presence updates
	function setupGatewaySubscription(threadId: string) {
		if (gatewayUnsubscribe) {
			gatewayUnsubscribe();
		}

		gatewayUnsubscribe = gateway.on('THREAD_PRESENCE_UPDATE', (data: unknown) => {
			const presenceData = data as { thread_id: string; active_users: ThreadActiveViewer[] };
			if (presenceData.thread_id === threadId) {
				update(state => ({
					...state,
					activeViewers: presenceData.active_users || []
				}));
			}
		});
	}

	// Start presence heartbeat
	function startPresenceHeartbeat(threadId: string) {
		if (presenceHeartbeatInterval) {
			clearInterval(presenceHeartbeatInterval);
		}

		presenceHeartbeatInterval = setInterval(async () => {
			try {
				await api.patch(`/threads/${threadId}/presence`);
			} catch (error) {
				console.warn('Failed to send presence heartbeat:', error);
			}
		}, PRESENCE_HEARTBEAT_INTERVAL);
	}

	// Stop presence heartbeat
	function stopPresenceHeartbeat() {
		if (presenceHeartbeatInterval) {
			clearInterval(presenceHeartbeatInterval);
			presenceHeartbeatInterval = null;
		}
	}

	// Cleanup gateway subscription
	function cleanupGateway() {
		if (gatewayUnsubscribe) {
			gatewayUnsubscribe();
			gatewayUnsubscribe = null;
		}
	}

	return {
		subscribe,

		/**
		 * Open a thread panel for a specific message
		 * Loads messages, notification preferences, and sets up presence
		 */
		async open(parentMessage: Message, channelId: string) {
			update(state => ({ 
				...state, 
				loading: true, 
				messages: [],
				activeViewers: [],
				notificationLevel: 'all'
			}));

			// Create a thread reference from the parent message
			const thread: Thread = {
				id: parentMessage.id, // Use message ID as thread ID for now
				channel_id: channelId,
				parent_message_id: parentMessage.id,
				parent_message: parentMessage,
				name: `Thread - ${parentMessage.content.slice(0, 30)}${parentMessage.content.length > 30 ? '...' : ''}`,
				message_count: 0,
				created_at: parentMessage.created_at
			};

			update(state => ({ ...state, currentThread: thread }));

			try {
				// Load thread data in parallel
				const [messagesResult, presenceResult, notificationResult] = await Promise.allSettled([
					// Load thread messages
					api.get<ThreadMessage[]>(
						`/channels/${channelId}/messages/${parentMessage.id}/thread`
					).catch(() => []),
					// Enter thread presence (marks user as viewing)
					api.post<{ thread_id: string; active_users: ThreadActiveViewer[] }>(
						`/threads/${parentMessage.id}/presence`
					).catch(() => ({ thread_id: parentMessage.id, active_users: [] })),
					// Get notification preference
					api.get<{ thread_id: string; user_id: string; level: ThreadNotificationLevel }>(
						`/threads/${parentMessage.id}/notifications`
					).catch(() => ({ level: 'all' as ThreadNotificationLevel }))
				]);

				const messages = messagesResult.status === 'fulfilled' ? messagesResult.value : [];
				const presence = presenceResult.status === 'fulfilled' ? presenceResult.value : { active_users: [] };
				const notification = notificationResult.status === 'fulfilled' ? notificationResult.value : { level: 'all' as ThreadNotificationLevel };

				update(state => ({
					...state,
					messages: Array.isArray(messages) ? messages : [],
					activeViewers: presence.active_users || [],
					notificationLevel: notification.level || 'all',
					loading: false
				}));

				// Setup real-time updates
				setupGatewaySubscription(parentMessage.id);
				startPresenceHeartbeat(parentMessage.id);

			} catch (error) {
				console.error('Failed to load thread:', error);
				update(state => ({ ...state, loading: false }));
			}
		},

		/**
		 * Close the thread panel and cleanup
		 */
		async close() {
			const state = get({ subscribe });
			const threadId = state.currentThread?.id;

			// Clean up presence and gateway subscription
			stopPresenceHeartbeat();
			cleanupGateway();

			// Notify backend that user left the thread
			if (threadId) {
				api.delete(`/threads/${threadId}/presence`).catch(() => {
					// Ignore errors on leave
				});
			}

			set({
				currentThread: null,
				messages: [],
				loading: false,
				sending: false,
				notificationLevel: 'all',
				activeViewers: []
			});
		},

		/**
		 * Send a reply in the thread
		 */
		async sendReply(content: string) {
			const state = get({ subscribe });
			if (!state.currentThread || !content.trim()) return;

			update(s => ({ ...s, sending: true }));

			try {
				const response = await api.post<ThreadMessage>(
					`/channels/${state.currentThread.channel_id}/messages`,
					{
						content: content.trim(),
						reply_to: state.currentThread.parent_message_id
					}
				);

				// Add the new message to the thread
				update(s => ({
					...s,
					messages: [...s.messages, response],
					sending: false
				}));

				return response;
			} catch (error) {
				console.error('Failed to send thread reply:', error);
				update(s => ({ ...s, sending: false }));
				throw error;
			}
		},

		/**
		 * FEAT-001: Set notification preference for the current thread
		 */
		async setNotificationPreference(level: ThreadNotificationLevel) {
			const state = get({ subscribe });
			if (!state.currentThread) return;

			try {
				await api.put(`/threads/${state.currentThread.id}/notifications`, { level });
				update(s => ({ ...s, notificationLevel: level }));
			} catch (error) {
				console.error('Failed to set notification preference:', error);
				throw error;
			}
		},

		/**
		 * Add a message to the current thread (from WebSocket)
		 */
		addMessage(message: ThreadMessage) {
			update(state => {
				if (!state.currentThread) return state;
				if (message.reply_to !== state.currentThread.parent_message_id) return state;
				
				// Avoid duplicates
				if (state.messages.find(m => m.id === message.id)) return state;

				return {
					...state,
					messages: [...state.messages, message]
				};
			});
		},

		/**
		 * Update a message in the thread
		 */
		updateMessage(message: Partial<ThreadMessage> & { id: string }) {
			update(state => ({
				...state,
				messages: state.messages.map(m =>
					m.id === message.id ? { ...m, ...message } : m
				)
			}));
		},

		/**
		 * Remove a message from the thread
		 */
		removeMessage(messageId: string) {
			update(state => ({
				...state,
				messages: state.messages.filter(m => m.id !== messageId)
			}));
		},

		/**
		 * Update active viewers (from WebSocket)
		 */
		updateActiveViewers(viewers: ThreadActiveViewer[]) {
			update(state => ({
				...state,
				activeViewers: viewers
			}));
		},

		/**
		 * Check if a thread is currently open
		 */
		isOpen(): boolean {
			return get({ subscribe }).currentThread !== null;
		}
	};
}

export const threadStore = createThreadStore();

// Derived stores for convenience
export const currentThread = {
	subscribe: (fn: (value: Thread | null) => void) => {
		return threadStore.subscribe(state => fn(state.currentThread));
	}
};

export const threadMessages = {
	subscribe: (fn: (value: ThreadMessage[]) => void) => {
		return threadStore.subscribe(state => fn(state.messages));
	}
};

export const threadLoading = {
	subscribe: (fn: (value: boolean) => void) => {
		return threadStore.subscribe(state => fn(state.loading));
	}
};

// FEAT-001: Notification level store
export const threadNotificationLevel = {
	subscribe: (fn: (value: ThreadNotificationLevel) => void) => {
		return threadStore.subscribe(state => fn(state.notificationLevel));
	}
};

// FEAT-001: Active viewers store (real-time presence)
export const threadActiveViewers = {
	subscribe: (fn: (value: ThreadActiveViewer[]) => void) => {
		return threadStore.subscribe(state => fn(state.activeViewers));
	}
};

// FEAT-001: Derived store for thread participants (from messages)
export const threadParticipants = derived(
	{ subscribe: threadStore.subscribe },
	($state): ThreadParticipant[] => {
		const seen = new Set<string>();
		const participants: ThreadParticipant[] = [];

		// Add parent message author first
		const parentAuthor = $state.currentThread?.parent_message?.author;
		if (parentAuthor) {
			seen.add(parentAuthor.id);
			participants.push({
				id: parentAuthor.id,
				username: parentAuthor.username,
				display_name: parentAuthor.display_name,
				avatar: parentAuthor.avatar
			});
		}

		// Add message authors
		for (const msg of $state.messages) {
			if (msg.author && !seen.has(msg.author.id)) {
				seen.add(msg.author.id);
				participants.push({
					id: msg.author.id,
					username: msg.author.username,
					display_name: msg.author.display_name ?? undefined,
					avatar: msg.author.avatar ?? undefined
				});
			}
		}

		return participants;
	}
);
