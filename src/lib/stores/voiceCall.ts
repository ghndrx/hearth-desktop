import { writable, derived } from 'svelte/store';

export interface VoiceParticipant {
	id: string;
	username: string;
	display_name: string | null;
	avatar: string | null;
	isMuted: boolean;
	isDeafened: boolean;
	isSpeaking: boolean;
	isScreenSharing: boolean;
	isVideoEnabled: boolean;
	joinedAt: Date;
}

export interface VoiceCallState {
	isActive: boolean;
	channelId: string | null;
	channelName: string | null;
	serverId: string | null;
	serverName: string | null;
	participants: VoiceParticipant[];
	localMuted: boolean;
	localDeafened: boolean;
	startedAt: Date | null;
	connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

const initialState: VoiceCallState = {
	isActive: false,
	channelId: null,
	channelName: null,
	serverId: null,
	serverName: null,
	participants: [],
	localMuted: false,
	localDeafened: false,
	startedAt: null,
	connectionState: 'disconnected'
};

function createVoiceCallStore() {
	const { subscribe, set, update } = writable<VoiceCallState>(initialState);

	return {
		subscribe,

		// Join a voice channel
		join(channel: { id: string; name: string; serverId?: string; serverName?: string }) {
			update(state => ({
				...state,
				isActive: true,
				channelId: channel.id,
				channelName: channel.name,
				serverId: channel.serverId ?? null,
				serverName: channel.serverName ?? null,
				startedAt: new Date(),
				connectionState: 'connecting'
			}));
		},

		// Leave the voice channel
		leave() {
			set(initialState);
		},

		// Set connection state
		setConnectionState(connectionState: VoiceCallState['connectionState']) {
			update(state => ({ ...state, connectionState }));
		},

		// Add a participant
		addParticipant(participant: Omit<VoiceParticipant, 'joinedAt' | 'isSpeaking'>) {
			update(state => {
				// Don't add duplicates
				if (state.participants.some(p => p.id === participant.id)) {
					return state;
				}
				return {
					...state,
					participants: [
						...state.participants,
						{
							...participant,
							isSpeaking: false,
							joinedAt: new Date()
						}
					]
				};
			});
		},

		// Remove a participant
		removeParticipant(userId: string) {
			update(state => ({
				...state,
				participants: state.participants.filter(p => p.id !== userId)
			}));
		},

		// Update a participant's state
		updateParticipant(userId: string, updates: Partial<VoiceParticipant>) {
			update(state => ({
				...state,
				participants: state.participants.map(p =>
					p.id === userId ? { ...p, ...updates } : p
				)
			}));
		},

		// Set speaking state for a participant
		setSpeaking(userId: string, isSpeaking: boolean) {
			update(state => ({
				...state,
				participants: state.participants.map(p =>
					p.id === userId ? { ...p, isSpeaking } : p
				)
			}));
		},

		// Toggle local mute
		toggleMute() {
			update(state => ({ ...state, localMuted: !state.localMuted }));
		},

		// Toggle local deafen
		toggleDeafen() {
			update(state => {
				const newDeafened = !state.localDeafened;
				return {
					...state,
					localDeafened: newDeafened,
					// Deafening also mutes
					localMuted: newDeafened ? true : state.localMuted
				};
			});
		},

		// Set mute state explicitly
		setMuted(muted: boolean) {
			update(state => ({ ...state, localMuted: muted }));
		},

		// Set deafen state explicitly
		setDeafened(deafened: boolean) {
			update(state => ({
				...state,
				localDeafened: deafened,
				localMuted: deafened ? true : state.localMuted
			}));
		},

		// Reset store
		reset() {
			set(initialState);
		}
	};
}

export const voiceCallStore = createVoiceCallStore();

// Derived stores for convenience
export const isInVoiceCall = derived(voiceCallStore, $state => $state.isActive);
export const voiceCallParticipants = derived(voiceCallStore, $state => $state.participants);
export const voiceCallParticipantCount = derived(voiceCallStore, $state => $state.participants.length);
export const voiceCallChannel = derived(voiceCallStore, $state => ({
	id: $state.channelId,
	name: $state.channelName,
	serverId: $state.serverId,
	serverName: $state.serverName
}));
export const voiceCallDuration = derived(voiceCallStore, $state => $state.startedAt);
export const voiceConnectionState = derived(voiceCallStore, $state => $state.connectionState);

// Helper to format call duration
export function formatCallDuration(startedAt: Date | null): string {
	if (!startedAt) return '00:00';
	
	const now = new Date();
	const diff = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
	
	const hours = Math.floor(diff / 3600);
	const minutes = Math.floor((diff % 3600) / 60);
	const seconds = diff % 60;
	
	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
