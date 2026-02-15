import { writable, derived, get } from 'svelte/store';
import type { Channel } from './channels';
import { user } from './auth';

/**
 * Participant in a voice call
 */
export interface VoiceParticipant {
	id: string;
	username: string;
	displayName?: string;
	avatar: string | null;
	muted: boolean;
	deafened: boolean;
	speaking: boolean;
	screenSharing: boolean;
}

/**
 * Voice call state
 */
export interface VoiceCallState {
	connected: boolean;
	connecting: boolean;
	channel: Channel | null;
	participants: VoiceParticipant[];
	muted: boolean;
	deafened: boolean;
	screenSharing: boolean;
	connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
	callDuration: number; // in seconds
}

const initialState: VoiceCallState = {
	connected: false,
	connecting: false,
	channel: null,
	participants: [],
	muted: false,
	deafened: false,
	screenSharing: false,
	connectionQuality: 'disconnected',
	callDuration: 0
};

function createVoiceCallStore() {
	const { subscribe, set, update } = writable<VoiceCallState>(initialState);
	let durationInterval: ReturnType<typeof setInterval> | null = null;

	function startDurationTimer() {
		if (durationInterval) clearInterval(durationInterval);
		durationInterval = setInterval(() => {
			update(state => ({
				...state,
				callDuration: state.callDuration + 1
			}));
		}, 1000);
	}

	function stopDurationTimer() {
		if (durationInterval) {
			clearInterval(durationInterval);
			durationInterval = null;
		}
	}

	return {
		subscribe,

		/**
		 * Join a voice channel
		 */
		join: async (channel: Channel) => {
			update(state => ({
				...state,
				connecting: true,
				channel
			}));

			// Simulate connection delay (in real app, this would be WebRTC setup)
			await new Promise(resolve => setTimeout(resolve, 800));

			const currentUser = get(user);
			const selfParticipant: VoiceParticipant = {
				id: currentUser?.id || 'self',
				username: currentUser?.username || 'You',
				displayName: currentUser?.display_name ?? undefined,
				avatar: currentUser?.avatar ?? null,
				muted: false,
				deafened: false,
				speaking: false,
				screenSharing: false
			};

			update(state => ({
				...state,
				connected: true,
				connecting: false,
				participants: [selfParticipant],
				connectionQuality: 'excellent',
				callDuration: 0
			}));

			startDurationTimer();
		},

		/**
		 * Leave the current voice channel
		 */
		disconnect: () => {
			stopDurationTimer();
			set(initialState);
		},

		/**
		 * Toggle mute state
		 */
		toggleMute: () => {
			update(state => {
				const newMuted = !state.muted;
				return {
					...state,
					muted: newMuted,
					// Update self in participants
					participants: state.participants.map(p => 
						p.id === get(user)?.id ? { ...p, muted: newMuted } : p
					)
				};
			});
		},

		/**
		 * Toggle deafen state (also mutes when deafening)
		 */
		toggleDeafen: () => {
			update(state => {
				const newDeafened = !state.deafened;
				const newMuted = newDeafened ? true : state.muted;
				return {
					...state,
					deafened: newDeafened,
					muted: newMuted,
					participants: state.participants.map(p => 
						p.id === get(user)?.id ? { ...p, deafened: newDeafened, muted: newMuted } : p
					)
				};
			});
		},

		/**
		 * Toggle screen sharing
		 */
		toggleScreenShare: async () => {
			update(state => {
				const newScreenSharing = !state.screenSharing;
				return {
					...state,
					screenSharing: newScreenSharing,
					participants: state.participants.map(p => 
						p.id === get(user)?.id ? { ...p, screenSharing: newScreenSharing } : p
					)
				};
			});
		},

		/**
		 * Set speaking state (typically called by voice activity detection)
		 */
		setSpeaking: (speaking: boolean) => {
			update(state => ({
				...state,
				participants: state.participants.map(p => 
					p.id === get(user)?.id ? { ...p, speaking } : p
				)
			}));
		},

		/**
		 * Add a participant (when someone joins)
		 */
		addParticipant: (participant: VoiceParticipant) => {
			update(state => ({
				...state,
				participants: [...state.participants, participant]
			}));
		},

		/**
		 * Remove a participant (when someone leaves)
		 */
		removeParticipant: (userId: string) => {
			update(state => ({
				...state,
				participants: state.participants.filter(p => p.id !== userId)
			}));
		},

		/**
		 * Update participant state
		 */
		updateParticipant: (userId: string, updates: Partial<VoiceParticipant>) => {
			update(state => ({
				...state,
				participants: state.participants.map(p => 
					p.id === userId ? { ...p, ...updates } : p
				)
			}));
		},

		/**
		 * Update connection quality
		 */
		setConnectionQuality: (quality: VoiceCallState['connectionQuality']) => {
			update(state => ({
				...state,
				connectionQuality: quality
			}));
		}
	};
}

export const voiceCall = createVoiceCallStore();

// Derived stores for convenience
export const isInVoiceCall = derived(voiceCall, $vc => $vc.connected);
export const voiceChannel = derived(voiceCall, $vc => $vc.channel);
export const voiceParticipants = derived(voiceCall, $vc => $vc.participants);
export const isMuted = derived(voiceCall, $vc => $vc.muted);
export const isDeafened = derived(voiceCall, $vc => $vc.deafened);
export const isScreenSharing = derived(voiceCall, $vc => $vc.screenSharing);

/**
 * Format call duration as MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
