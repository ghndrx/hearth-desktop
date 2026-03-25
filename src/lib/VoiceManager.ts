import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { VoiceService } from './services/webrtc/VoiceService';
import type { VoiceServiceConfig } from './services/webrtc/types';
import { voiceState, voiceActions, voiceChannelStates, type VoiceUser } from './stores/voice';
import { user } from './stores/auth';
import { gateway } from './stores/gateway';

/**
 * VoiceManager orchestrates the WebRTC voice infrastructure with the application state.
 * It bridges the VoiceService with Svelte stores and handles the complete voice session lifecycle.
 */
export class VoiceManager {
	private voiceService: VoiceService | null = null;
	private currentChannel: { id: string; serverId: string } | null = null;
	private cleanupCallbacks: Array<() => void> = [];
	private remoteAudioElements = new Map<string, HTMLAudioElement>();

	constructor(private config?: Partial<VoiceServiceConfig>) {}

	/**
	 * Join a voice channel. Creates VoiceService, connects to signaling, and establishes P2P connections.
	 */
	async joinChannel(
		channelId: string,
		channelName: string,
		serverId: string,
		serverName: string,
		signalingUrl: string,
		token: string
	): Promise<void> {
		if (!browser) return;

		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User not authenticated');
		}

		// Leave current channel if already in one
		if (this.currentChannel) {
			await this.leaveChannel();
		}

		// Update store state
		voiceActions.join({
			id: channelId,
			name: channelName,
			serverId,
			serverName
		});

		try {
			// Create voice service
			this.voiceService = new VoiceService(this.config);
			this.currentChannel = { id: channelId, serverId };

			// Setup event handlers
			this.setupVoiceServiceListeners();

			// Join the channel
			await this.voiceService.join(
				signalingUrl,
				token,
				channelId,
				currentUser.id,
				currentUser.username,
				currentUser.display_name || undefined
			);

			voiceActions.setConnected();
			console.log(`[VoiceManager] Successfully joined voice channel: ${channelName}`);

		} catch (error) {
			console.error('[VoiceManager] Failed to join voice channel:', error);
			voiceActions.setError(`Failed to join voice channel: ${error}`);
			this.cleanup();
			throw error;
		}
	}

	/**
	 * Leave the current voice channel and clean up all resources.
	 */
	async leaveChannel(): Promise<void> {
		if (!this.voiceService || !this.currentChannel) return;

		console.log('[VoiceManager] Leaving voice channel');

		// Leave via voice service
		this.voiceService.leave();

		// Update store state
		voiceActions.leave();

		// Cleanup
		this.cleanup();
	}

	/**
	 * Toggle mute state
	 */
	toggleMute(): void {
		if (!this.voiceService) return;

		voiceActions.toggleMute();
		const state = get(voiceState);
		this.voiceService.setMuted(state.selfMuted);
	}

	/**
	 * Toggle deafen state
	 */
	toggleDeafen(): void {
		if (!this.voiceService) return;

		voiceActions.toggleDeafen();
		const state = get(voiceState);
		this.voiceService.setMuted(state.selfMuted);
		this.voiceService.setDeafened(state.selfDeafened);
	}

	/**
	 * Set mute state
	 */
	setMuted(muted: boolean): void {
		if (!this.voiceService) return;

		if (muted !== get(voiceState).selfMuted) {
			this.toggleMute();
		}
	}

	/**
	 * Set deafen state
	 */
	setDeafened(deafened: boolean): void {
		if (!this.voiceService) return;

		if (deafened !== get(voiceState).selfDeafened) {
			this.toggleDeafen();
		}
	}

	/**
	 * Get the current voice service instance
	 */
	getVoiceService(): VoiceService | null {
		return this.voiceService;
	}

	/**
	 * Check if currently in a voice channel
	 */
	isInVoice(): boolean {
		return this.voiceService !== null && this.currentChannel !== null;
	}

	/**
	 * Switch audio input device
	 */
	async switchInputDevice(deviceId: string): Promise<void> {
		if (!this.voiceService) return;

		const mediaManager = this.voiceService.getMediaDeviceManager();
		const newStream = await mediaManager.switchInputDevice(deviceId);

		// Replace track on all peer connections
		await this.voiceService.replaceTrack(newStream);
	}

	/**
	 * Set audio output device for all remote audio elements
	 */
	async setOutputDevice(deviceId: string): Promise<void> {
		if (!this.voiceService) return;

		const mediaManager = this.voiceService.getMediaDeviceManager();

		// Update all existing audio elements
		for (const audio of this.remoteAudioElements.values()) {
			await mediaManager.setOutputDevice(audio, deviceId);
		}
	}

	/**
	 * Get available audio devices
	 */
	async getAudioDevices() {
		if (!this.voiceService) return { input: [], output: [] };

		const mediaManager = this.voiceService.getMediaDeviceManager();
		await mediaManager.refreshDevices();

		return {
			input: mediaManager.getInputDevices(),
			output: mediaManager.getOutputDevices()
		};
	}

	private setupVoiceServiceListeners(): void {
		if (!this.voiceService) return;

		// Peer joined
		this.cleanupCallbacks.push(
			this.voiceService.on('peer-joined', (user: any) => {
				console.log(`[VoiceManager] Peer joined: ${user.username}`);

				// Convert WebRTC user to store user format
				const storeUser: VoiceUser = {
					id: user.userId,
					username: user.username,
					display_name: user.displayName,
					avatar: user.avatar,
					self_muted: user.isMuted,
					self_deafened: user.isDeafened,
					self_video: false,
					self_stream: false,
					muted: false,
					deafened: false,
					speaking: user.isSpeaking
				};

				if (this.currentChannel) {
					voiceChannelStates.addUser(this.currentChannel.id, storeUser);
				}
			})
		);

		// Peer left
		this.cleanupCallbacks.push(
			this.voiceService.on('peer-left', (userId: string) => {
				console.log(`[VoiceManager] Peer left: ${userId}`);

				// Remove audio element
				const audio = this.remoteAudioElements.get(userId);
				if (audio) {
					audio.remove();
					this.remoteAudioElements.delete(userId);
				}

				if (this.currentChannel) {
					voiceChannelStates.removeUser(this.currentChannel.id, userId);
				}
			})
		);

		// Remote stream received
		this.cleanupCallbacks.push(
			this.voiceService.on('remote-stream', (userId: string, stream: MediaStream) => {
				console.log(`[VoiceManager] Remote stream received from: ${userId}`);
				this.createRemoteAudioElement(userId, stream);
			})
		);

		// Speaking state changed
		this.cleanupCallbacks.push(
			this.voiceService.on('peer-speaking', (userId: string, speaking: boolean) => {
				if (this.currentChannel) {
					voiceChannelStates.setSpeaking(this.currentChannel.id, userId, speaking);
				}
			})
		);

		// Mute state changed
		this.cleanupCallbacks.push(
			this.voiceService.on('peer-mute-changed', (userId: string, muted: boolean, deafened: boolean) => {
				if (this.currentChannel) {
					voiceChannelStates.updateUser(this.currentChannel.id, userId, {
						self_muted: muted,
						self_deafened: deafened
					});
				}
			})
		);

		// Connection state changed
		this.cleanupCallbacks.push(
			this.voiceService.on('connection-state-changed', (state: any, userId: string) => {
				console.log(`[VoiceManager] Connection state changed for ${userId}: ${state}`);
				// Could update UI to show connection quality
			})
		);

		// Signaling state changed
		this.cleanupCallbacks.push(
			this.voiceService.on('signaling-state-changed', (state: any) => {
				console.log(`[VoiceManager] Signaling state changed: ${state}`);

				voiceState.update(currentState => ({
					...currentState,
					connectionState: state,
					isConnecting: state === 'connecting' || state === 'reconnecting',
					isConnected: state === 'connected'
				}));
			})
		);

		// Errors
		this.cleanupCallbacks.push(
			this.voiceService.on('error', (error: Error) => {
				console.error('[VoiceManager] Voice service error:', error);
				voiceActions.setError(error.message);
			})
		);
	}

	private createRemoteAudioElement(userId: string, stream: MediaStream): void {
		// Remove existing audio element if any
		const existingAudio = this.remoteAudioElements.get(userId);
		if (existingAudio) {
			existingAudio.remove();
		}

		// Create new audio element
		const audio = document.createElement('audio');
		audio.id = `voice-audio-${userId}`;
		audio.autoplay = true;
		audio.srcObject = stream;
		audio.volume = 1.0;

		// Apply current deafen state
		const state = get(voiceState);
		audio.muted = state.selfDeafened;

		// Hide the audio element
		audio.style.display = 'none';
		document.body.appendChild(audio);

		this.remoteAudioElements.set(userId, audio);

		// Set output device if one is selected
		if (this.voiceService) {
			const mediaManager = this.voiceService.getMediaDeviceManager();
			const selectedOutputDevice = mediaManager.getSelectedOutputDeviceId();
			if (selectedOutputDevice) {
				mediaManager.setOutputDevice(audio, selectedOutputDevice);
			}
		}
	}

	private cleanup(): void {
		// Run cleanup callbacks
		this.cleanupCallbacks.forEach(cleanup => cleanup());
		this.cleanupCallbacks = [];

		// Remove all remote audio elements
		for (const [userId, audio] of this.remoteAudioElements) {
			audio.remove();
		}
		this.remoteAudioElements.clear();

		// Destroy voice service
		if (this.voiceService) {
			this.voiceService.destroy();
			this.voiceService = null;
		}

		this.currentChannel = null;
	}

	/**
	 * Destroy the voice manager and clean up all resources
	 */
	destroy(): void {
		this.cleanup();
	}
}

// Create singleton instance
export const voiceManager = new VoiceManager();

// Handle gateway events for voice channel information
if (browser) {
	// Listen for voice channel join responses with signaling info
	gateway.on('VOICE_CHANNEL_JOIN', async (data: any) => {
		const { channel_id, channel_name, server_id, server_name, signaling_url, token } = data;

		try {
			await voiceManager.joinChannel(
				channel_id,
				channel_name,
				server_id,
				server_name,
				signaling_url,
				token
			);
		} catch (error) {
			console.error('[VoiceManager] Failed to join channel from gateway event:', error);
		}
	});
}