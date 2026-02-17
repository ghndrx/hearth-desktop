import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { gateway, Op, onGatewayEvent } from './gateway';

// Voice state types
export interface VoiceUser {
	id: string;
	username: string;
	display_name?: string;
	avatar?: string;
	self_muted: boolean;
	self_deafened: boolean;
	self_video: boolean;
	self_stream: boolean;
	muted: boolean;
	deafened: boolean;
	speaking: boolean;
}

export interface VoiceState {
	isConnected: boolean;
	isConnecting: boolean;
	channelId: string | null;
	channelName: string | null;
	serverId: string | null;
	serverName: string | null;
	selfMuted: boolean;
	selfDeafened: boolean;
	selfVideo: boolean;
	selfStream: boolean;
	connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
	error: string | null;
}

export interface VoiceChannelState {
	[channelId: string]: VoiceUser[];
}

const initialState: VoiceState = {
	isConnected: false,
	isConnecting: false,
	channelId: null,
	channelName: null,
	serverId: null,
	serverName: null,
	selfMuted: false,
	selfDeafened: false,
	selfVideo: false,
	selfStream: false,
	connectionState: 'disconnected',
	error: null
};

// Store for current user's voice state
function createVoiceStore() {
	const { subscribe, set, update } = writable<VoiceState>(initialState);

	return {
		subscribe,
		set,
		update,
		reset: () => set(initialState)
	};
}

// Store for all voice channel states (who's in which channel)
function createVoiceChannelStatesStore() {
	const { subscribe, set, update } = writable<VoiceChannelState>({});

	return {
		subscribe,
		set,
		update,

		// Set users for a specific channel
		setChannelUsers(channelId: string, users: VoiceUser[]) {
			update(state => ({
				...state,
				[channelId]: users
			}));
		},

		// Add a user to a channel
		addUser(channelId: string, user: VoiceUser) {
			update(state => {
				const channelUsers = state[channelId] || [];
				// Don't add duplicates
				if (channelUsers.some(u => u.id === user.id)) {
					return state;
				}
				return {
					...state,
					[channelId]: [...channelUsers, user]
				};
			});
		},

		// Remove a user from a channel
		removeUser(channelId: string, userId: string) {
			update(state => {
				const channelUsers = state[channelId] || [];
				const filtered = channelUsers.filter(u => u.id !== userId);
				if (filtered.length === 0) {
					const { [channelId]: _, ...rest } = state;
					return rest;
				}
				return {
					...state,
					[channelId]: filtered
				};
			});
		},

		// Remove user from all channels (when they disconnect)
		removeUserFromAll(userId: string) {
			update(state => {
				const newState: VoiceChannelState = {};
				for (const [channelId, users] of Object.entries(state)) {
					const filtered = users.filter(u => u.id !== userId);
					if (filtered.length > 0) {
						newState[channelId] = filtered;
					}
				}
				return newState;
			});
		},

		// Update a user's state (mute, deafen, speaking)
		updateUser(channelId: string, userId: string, updates: Partial<VoiceUser>) {
			update(state => {
				const channelUsers = state[channelId] || [];
				return {
					...state,
					[channelId]: channelUsers.map(u =>
						u.id === userId ? { ...u, ...updates } : u
					)
				};
			});
		},

		// Set speaking state for a user
		setSpeaking(channelId: string, userId: string, speaking: boolean) {
			update(state => {
				const channelUsers = state[channelId] || [];
				return {
					...state,
					[channelId]: channelUsers.map(u =>
						u.id === userId ? { ...u, speaking } : u
					)
				};
			});
		},

		// Get users for a specific channel
		getChannelUsers(channelId: string): VoiceUser[] {
			return get({ subscribe })[channelId] || [];
		},

		// Clear all state
		reset() {
			set({});
		}
	};
}

export const voiceState = createVoiceStore();
export const voiceChannelStates = createVoiceChannelStatesStore();

// Derived stores for convenience
export const isInVoice = derived(voiceState, $state => $state.isConnected);
export const voiceChannel = derived(voiceState, $state => ({
	id: $state.channelId,
	name: $state.channelName,
	serverId: $state.serverId,
	serverName: $state.serverName
}));
export const voiceConnectionState = derived(voiceState, $state => $state.connectionState);

// Get users in the current voice channel
export const currentVoiceUsers = derived(
	[voiceState, voiceChannelStates],
	([$state, $channelStates]) => {
		if (!$state.channelId) return [];
		return $channelStates[$state.channelId] || [];
	}
);

// Listen to gateway events for voice state updates
if (browser) {
	// Voice state update (user joined, left, or updated state)
	onGatewayEvent('VOICE_STATE_UPDATE', (data: unknown) => {
		const update = data as {
			user_id: string;
			username?: string;
			display_name?: string;
			avatar?: string;
			channel_id: string | null;
			server_id: string;
			self_muted?: boolean;
			self_deafened?: boolean;
			self_video?: boolean;
			self_stream?: boolean;
			muted?: boolean;
			deafened?: boolean;
		};

		if (update.channel_id === null) {
			// User left voice
			voiceChannelStates.removeUserFromAll(update.user_id);
		} else {
			// User joined or updated
			// First remove from any other channel
			voiceChannelStates.removeUserFromAll(update.user_id);

			// Then add to the new channel
			voiceChannelStates.addUser(update.channel_id, {
				id: update.user_id,
				username: update.username || 'Unknown',
				display_name: update.display_name,
				avatar: update.avatar,
				self_muted: update.self_muted || false,
				self_deafened: update.self_deafened || false,
				self_video: update.self_video || false,
				self_stream: update.self_stream || false,
				muted: update.muted || false,
				deafened: update.deafened || false,
				speaking: false
			});
		}
	});

	// Voice server update (list of peers when joining)
	onGatewayEvent('VOICE_SERVER_UPDATE', (data: unknown) => {
		const update = data as {
			channel_id: string;
			server_id: string;
			peers: Array<{
				user_id: string;
				username: string;
				display_name?: string;
				avatar?: string;
				self_muted: boolean;
				self_deafened: boolean;
				self_video: boolean;
				self_stream: boolean;
				muted: boolean;
				deafened: boolean;
			}>;
		};

		// Set all peers for this channel
		const users: VoiceUser[] = update.peers.map(p => ({
			id: p.user_id,
			username: p.username,
			display_name: p.display_name,
			avatar: p.avatar,
			self_muted: p.self_muted,
			self_deafened: p.self_deafened,
			self_video: p.self_video,
			self_stream: p.self_stream,
			muted: p.muted,
			deafened: p.deafened,
			speaking: false
		}));

		voiceChannelStates.setChannelUsers(update.channel_id, users);
	});

	// Speaking state update
	onGatewayEvent('VOICE_SPEAKING', (data: unknown) => {
		const update = data as {
			user_id: string;
			channel_id: string;
			speaking: boolean;
		};

		voiceChannelStates.setSpeaking(update.channel_id, update.user_id, update.speaking);
	});
}

// Voice actions
export const voiceActions = {
	// Join a voice channel
	join(channel: { id: string; name: string; serverId: string; serverName: string }) {
		if (!browser) return;

		voiceState.update(state => ({
			...state,
			isConnecting: true,
			channelId: channel.id,
			channelName: channel.name,
			serverId: channel.serverId,
			serverName: channel.serverName,
			connectionState: 'connecting',
			error: null
		}));

		// Send join via gateway
		gateway.send({
			op: Op.DISPATCH,
			d: {
				t: 'VOICE_JOIN',
				d: {
					channel_id: channel.id,
					server_id: channel.serverId,
					self_muted: get(voiceState).selfMuted,
					self_deafened: get(voiceState).selfDeafened
				}
			}
		});
	},

	// Leave current voice channel
	leave() {
		if (!browser) return;

		const state = get(voiceState);
		if (!state.channelId || !state.serverId) return;

		gateway.send({
			op: Op.DISPATCH,
			d: {
				t: 'VOICE_LEAVE',
				d: {
					channel_id: state.channelId,
					server_id: state.serverId
				}
			}
		});

		voiceState.reset();
	},

	// Toggle mute
	toggleMute() {
		voiceState.update(state => {
			const newMuted = !state.selfMuted;
			
			// Send update via gateway
			if (state.serverId) {
				gateway.send({
					op: Op.VOICE_STATE_UPDATE,
					d: {
						server_id: state.serverId,
						self_muted: newMuted,
						self_deafened: state.selfDeafened,
						self_video: state.selfVideo,
						self_stream: state.selfStream
					}
				});
			}

			return { ...state, selfMuted: newMuted };
		});
	},

	// Toggle deafen (also mutes)
	toggleDeafen() {
		voiceState.update(state => {
			const newDeafened = !state.selfDeafened;
			const newMuted = newDeafened ? true : state.selfMuted;

			// Send update via gateway
			if (state.serverId) {
				gateway.send({
					op: Op.VOICE_STATE_UPDATE,
					d: {
						server_id: state.serverId,
						self_muted: newMuted,
						self_deafened: newDeafened,
						self_video: state.selfVideo,
						self_stream: state.selfStream
					}
				});
			}

			return { ...state, selfMuted: newMuted, selfDeafened: newDeafened };
		});
	},

	// Set connecting state
	setConnecting() {
		voiceState.update(state => ({
			...state,
			isConnecting: true,
			connectionState: 'connecting'
		}));
	},

	// Set connected state
	setConnected() {
		voiceState.update(state => ({
			...state,
			isConnected: true,
			isConnecting: false,
			connectionState: 'connected'
		}));
	},

	// Set error state
	setError(error: string) {
		voiceState.update(state => ({
			...state,
			isConnecting: false,
			connectionState: 'disconnected',
			error
		}));
	}
};
