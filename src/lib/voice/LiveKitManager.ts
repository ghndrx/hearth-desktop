import { browser } from '$app/environment';
import { get } from 'svelte/store';
import {
	Room,
	RoomEvent,
	Track,
	LocalParticipant,
	RemoteParticipant,
	Participant,
	ConnectionState,
	DisconnectReason,
	TrackPublication,
	LocalTrackPublication,
	RemoteTrackPublication,
	type AudioTrack,
	type RoomOptions,
	type AudioCaptureOptions,
} from 'livekit-client';
import { voiceState, voiceActions, voiceChannelStates, type VoiceUser } from '$lib/stores/voice';
import { user as authUser } from '$lib/stores/auth';
import { API_BASE } from '$lib/api';

interface LiveKitConfig {
	serverUrl: string;
	token: string;
}

/**
 * LiveKit Connection Manager
 * Manages voice connections using LiveKit SFU for scalable voice channels
 */
class LiveKitManager {
	private room: Room | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;
	private currentChannelId: string | null = null;

	constructor() {
		if (!browser) return;
	}

	/**
	 * Fetch a LiveKit token from the backend
	 */
	async fetchToken(channelId: string, serverId: string): Promise<LiveKitConfig> {
		const response = await fetch(`${API_BASE}/voice/token`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
			},
			body: JSON.stringify({ channel_id: channelId, server_id: serverId }),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ message: 'Failed to get voice token' }));
			throw new Error(error.message || 'Failed to get voice token');
		}

		const data = await response.json();
		return {
			serverUrl: data.server_url || data.url,
			token: data.token,
		};
	}

	/**
	 * Connect to a voice channel
	 */
	async connect(channelId: string, serverId: string): Promise<void> {
		if (!browser) return;

		// Disconnect from current room if connected
		if (this.room) {
			await this.disconnect();
		}

		try {
			voiceActions.setConnecting();

			// Fetch token from backend
			const config = await this.fetchToken(channelId, serverId);

			// Create room with options
			const roomOptions: RoomOptions = {
				adaptiveStream: true,
				dynacast: true,
				audioCaptureDefaults: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				} as AudioCaptureOptions,
			};

			this.room = new Room(roomOptions);
			this.currentChannelId = channelId;

			// Set up event listeners before connecting
			this.setupRoomListeners();

			// Connect to LiveKit server
			await this.room.connect(config.serverUrl, config.token);

			// Enable microphone
			const state = get(voiceState);
			await this.room.localParticipant.setMicrophoneEnabled(!state.selfMuted);

			// Set up speaking detection
			this.setupSpeakingDetection();

			// Update participants list
			this.updateParticipantsList();

			voiceActions.setConnected();
			console.log('[LiveKit] Connected to voice channel');
		} catch (error) {
			console.error('[LiveKit] Failed to connect:', error);
			voiceActions.setError(
				error instanceof Error ? error.message : 'Failed to connect to voice channel'
			);
			throw error;
		}
	}

	/**
	 * Set up room event listeners
	 */
	private setupRoomListeners() {
		if (!this.room) return;

		// Connection state changes
		this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
			console.log('[LiveKit] Connection state:', state);
			switch (state) {
				case ConnectionState.Connected:
					voiceActions.setConnected();
					break;
				case ConnectionState.Reconnecting:
					voiceState.update(s => ({ ...s, connectionState: 'reconnecting' }));
					break;
				case ConnectionState.Disconnected:
					voiceState.update(s => ({ ...s, connectionState: 'disconnected', isConnected: false }));
					break;
			}
		});

		// Participant joined
		this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
			console.log('[LiveKit] Participant joined:', participant.identity);
			this.updateParticipantsList();
		});

		// Participant left
		this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
			console.log('[LiveKit] Participant left:', participant.identity);
			this.updateParticipantsList();
		});

		// Track subscribed (for remote audio)
		this.room.on(
			RoomEvent.TrackSubscribed,
			(track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				if (track.kind === Track.Kind.Audio) {
					// Attach audio track to DOM for playback
					const audioElement = track.attach();
					audioElement.id = `voice-audio-${participant.identity}`;

					// Apply deafen state
					const state = get(voiceState);
					audioElement.muted = state.selfDeafened;

					document.body.appendChild(audioElement);
				}
			}
		);

		// Track unsubscribed
		this.room.on(
			RoomEvent.TrackUnsubscribed,
			(track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
				track.detach().forEach(element => element.remove());
			}
		);

		// Speaking detection from LiveKit
		this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
			if (!this.currentChannelId) return;

			// Get current participants
			const currentUsers = voiceChannelStates.getChannelUsers(this.currentChannelId);
			
			// Reset all speaking states
			currentUsers.forEach(user => {
				voiceChannelStates.setSpeaking(this.currentChannelId!, user.id, false);
			});

			// Set speaking for active speakers
			speakers.forEach(speaker => {
				voiceChannelStates.setSpeaking(this.currentChannelId!, speaker.identity, true);
			});
		});

		// Participant metadata/track updates
		this.room.on(RoomEvent.ParticipantMetadataChanged, () => {
			this.updateParticipantsList();
		});

		this.room.on(RoomEvent.TrackMuted, () => {
			this.updateParticipantsList();
		});

		this.room.on(RoomEvent.TrackUnmuted, () => {
			this.updateParticipantsList();
		});

		// Disconnected
		this.room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
			console.log('[LiveKit] Disconnected:', reason);
			this.cleanup();
		});
	}

	/**
	 * Update the participants list in the store
	 */
	private updateParticipantsList() {
		if (!this.room || !this.currentChannelId) return;

		const users: VoiceUser[] = [];
		const currentUser = get(authUser);

		// Add local participant
		const local = this.room.localParticipant;
		if (local) {
			const localMuted = !local.isMicrophoneEnabled;
			users.push({
				id: local.identity,
				username: local.name || local.identity,
				display_name: local.name,
				avatar: this.getParticipantAvatar(local),
				self_muted: localMuted,
				self_deafened: get(voiceState).selfDeafened,
				self_video: local.isCameraEnabled,
				self_stream: local.isScreenShareEnabled,
				muted: false,
				deafened: false,
				speaking: local.isSpeaking,
			});
		}

		// Add remote participants
		this.room.remoteParticipants.forEach((participant) => {
			const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
			const videoTrack = participant.getTrackPublication(Track.Source.Camera);
			const screenTrack = participant.getTrackPublication(Track.Source.ScreenShare);

			users.push({
				id: participant.identity,
				username: participant.name || participant.identity,
				display_name: participant.name,
				avatar: this.getParticipantAvatar(participant),
				self_muted: audioTrack?.isMuted ?? true,
				self_deafened: false,
				self_video: videoTrack?.isSubscribed ?? false,
				self_stream: screenTrack?.isSubscribed ?? false,
				muted: false,
				deafened: false,
				speaking: participant.isSpeaking,
			});
		});

		voiceChannelStates.setChannelUsers(this.currentChannelId, users);
	}

	/**
	 * Get avatar URL from participant metadata
	 */
	private getParticipantAvatar(participant: Participant): string | undefined {
		try {
			const metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
			return metadata.avatar;
		} catch {
			return undefined;
		}
	}

	/**
	 * Set up local speaking detection (backup for LiveKit's ActiveSpeakersChanged)
	 */
	private setupSpeakingDetection() {
		if (!this.room) return;

		const localParticipant = this.room.localParticipant;
		const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);

		if (!audioTrack?.track) return;

		try {
			this.audioContext = new AudioContext();
			const mediaStreamTrack = audioTrack.track.mediaStreamTrack;
			const stream = new MediaStream([mediaStreamTrack]);
			const source = this.audioContext.createMediaStreamSource(stream);
			this.analyser = this.audioContext.createAnalyser();
			this.analyser.fftSize = 256;

			source.connect(this.analyser);

			const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

			this.speakingCheckInterval = setInterval(() => {
				if (!this.analyser) return;

				this.analyser.getByteFrequencyData(dataArray);
				const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
				const speaking = average > 20;

				if (speaking !== this.isSpeaking) {
					this.isSpeaking = speaking;
					// Update local user speaking state
					if (this.currentChannelId) {
						const currentUser = get(authUser);
						if (currentUser) {
							voiceChannelStates.setSpeaking(this.currentChannelId, currentUser.id, speaking);
						}
					}
				}
			}, 100);
		} catch (error) {
			console.error('[LiveKit] Failed to setup speaking detection:', error);
		}
	}

	/**
	 * Disconnect from the current voice channel
	 */
	async disconnect(): Promise<void> {
		console.log('[LiveKit] Disconnecting');
		this.cleanup();

		if (this.room) {
			await this.room.disconnect();
			this.room = null;
		}

		this.currentChannelId = null;
		voiceState.reset();
	}

	/**
	 * Clean up resources
	 */
	private cleanup() {
		// Stop speaking detection
		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		// Close audio context
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
			this.analyser = null;
		}

		// Remove all audio elements
		document.querySelectorAll('[id^="voice-audio-"]').forEach(el => el.remove());

		this.isSpeaking = false;
	}

	/**
	 * Toggle mute state
	 */
	async setMuted(muted: boolean): Promise<void> {
		if (!this.room) return;

		try {
			await this.room.localParticipant.setMicrophoneEnabled(!muted);
			this.updateParticipantsList();
		} catch (error) {
			console.error('[LiveKit] Failed to toggle mute:', error);
		}
	}

	/**
	 * Toggle deafen state
	 */
	setDeafened(deafened: boolean): void {
		// Mute all remote audio elements
		document.querySelectorAll<HTMLAudioElement>('[id^="voice-audio-"]').forEach(audio => {
			audio.muted = deafened;
		});
	}

	/**
	 * Check if currently connected
	 */
	isConnected(): boolean {
		return this.room?.state === ConnectionState.Connected;
	}

	/**
	 * Get the current room
	 */
	getRoom(): Room | null {
		return this.room;
	}

	/**
	 * Destroy the manager
	 */
	async destroy(): Promise<void> {
		await this.disconnect();
	}
}

// Singleton instance
let instance: LiveKitManager | null = null;

export function getLiveKitManager(): LiveKitManager {
	if (!instance && browser) {
		instance = new LiveKitManager();
	}
	return instance!;
}

export function destroyLiveKitManager(): void {
	if (instance) {
		instance.destroy();
		instance = null;
	}
}

export { LiveKitManager };
