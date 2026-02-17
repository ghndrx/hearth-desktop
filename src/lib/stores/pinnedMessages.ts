import { writable, get, derived } from 'svelte/store';
import { api } from '$lib/api';
import type { Message } from './messages';

interface PinnedMessagesState {
	isOpen: boolean;
	channelId: string | null;
	messages: Message[];
	loading: boolean;
}

function createPinnedMessagesStore() {
	const { subscribe, set, update } = writable<PinnedMessagesState>({
		isOpen: false,
		channelId: null,
		messages: [],
		loading: false
	});

	return {
		subscribe,

		// Open the pinned messages panel for a channel
		async open(channelId: string) {
			update(state => ({
				...state,
				isOpen: true,
				channelId,
				loading: true,
				messages: []
			}));

			try {
				const data = await api.get<Message[]>(`/channels/${channelId}/pins`);
				
				update(state => ({
					...state,
					messages: Array.isArray(data) ? data : [],
					loading: false
				}));
			} catch (error) {
				console.error('Failed to load pinned messages:', error);
				update(state => ({ ...state, loading: false }));
			}
		},

		// Close the pinned messages panel
		close() {
			set({
				isOpen: false,
				channelId: null,
				messages: [],
				loading: false
			});
		},

		// Toggle the panel
		toggle(channelId: string) {
			const state = get({ subscribe });
			if (state.isOpen && state.channelId === channelId) {
				this.close();
			} else {
				this.open(channelId);
			}
		},

		// Refresh pinned messages for current channel
		async refresh() {
			const state = get({ subscribe });
			if (!state.channelId) return;

			update(s => ({ ...s, loading: true }));

			try {
				const data = await api.get<Message[]>(`/channels/${state.channelId}/pins`);
				
				update(s => ({
					...s,
					messages: Array.isArray(data) ? data : [],
					loading: false
				}));
			} catch (error) {
				console.error('Failed to refresh pinned messages:', error);
				update(s => ({ ...s, loading: false }));
			}
		},

		// Pin a message
		async pin(channelId: string, messageId: string) {
			try {
				await api.put(`/channels/${channelId}/pins/${messageId}`);
				
				// Refresh if panel is open for this channel
				const state = get({ subscribe });
				if (state.isOpen && state.channelId === channelId) {
					await this.refresh();
				}
			} catch (error) {
				console.error('Failed to pin message:', error);
				throw error;
			}
		},

		// Unpin a message
		async unpin(channelId: string, messageId: string) {
			try {
				await api.delete(`/channels/${channelId}/pins/${messageId}`);
				
				// Remove from local state immediately
				update(state => ({
					...state,
					messages: state.messages.filter(m => m.id !== messageId)
				}));
			} catch (error) {
				console.error('Failed to unpin message:', error);
				throw error;
			}
		},

		// Handle message pin update from WebSocket
		handlePinUpdate(data: { channel_id: string; message_id: string; pinned: boolean }) {
			const state = get({ subscribe });
			if (!state.isOpen || state.channelId !== data.channel_id) return;

			if (!data.pinned) {
				// Remove unpinned message
				update(s => ({
					...s,
					messages: s.messages.filter(m => m.id !== data.message_id)
				}));
			} else {
				// Refresh to get the new pinned message
				this.refresh();
			}
		},

		// Check if panel is open
		isOpenForChannel(channelId: string): boolean {
			const state = get({ subscribe });
			return state.isOpen && state.channelId === channelId;
		}
	};
}

export const pinnedMessagesStore = createPinnedMessagesStore();

// Derived stores for convenience
export const pinnedMessagesOpen = derived(
	{ subscribe: pinnedMessagesStore.subscribe },
	$state => $state.isOpen
);

export const pinnedMessages = derived(
	{ subscribe: pinnedMessagesStore.subscribe },
	$state => $state.messages
);

export const pinnedMessagesLoading = derived(
	{ subscribe: pinnedMessagesStore.subscribe },
	$state => $state.loading
);
