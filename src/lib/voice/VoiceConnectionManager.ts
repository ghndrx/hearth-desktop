import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { gateway, Op, onGatewayEvent } from '$lib/stores/gateway';
import { voiceState, voiceActions } from '$lib/stores/voice';
import { user as authUser } from '$lib/stores/auth';
import { SignalingClient } from './SignalingClient';
import { WebRTCConnectionManager } from './WebRTCConnectionManager';

class VoiceConnectionManager {
	private webrtc: WebRTCConnectionManager | null = null;
	private signaling: SignalingClient | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;
	private cleanupFunctions: Array<() => void> = [];
	private webrtcCleanups: Array<() => void> = [];

	constructor() {
		if (!browser) return;
		this.initManagers();
		this.setupGatewayListeners();
	}

	private initManagers() {
		this.signaling = new SignalingClient();
		this.webrtc = new WebRTCConnectionManager(this.signaling);

		// Listen for peer track events to play remote audio
		this.webrtcCleanups.push(
			this.webrtc.on('peer-track', ({ userId, stream }) => {
				this.playRemoteAudio(userId, stream);
			})
		);

		// Listen for peer disconnection to remove audio elements
		this.webrtcCleanups.push(
			this.webrtc.on('peer-disconnected', ({ userId }) => {
				const audio = document.getElementById(`voice-audio-${userId}`);
				if (audio) audio.remove();
			})
		);

		// Listen for signaling peer-list to initiate connections
		this.webrtcCleanups.push(
			this.signaling.on('peer-list', ({ peers }) => {
				this.handlePeerList(peers);
			})
		);

		// Listen for new peer joining our channel
		this.webrtcCleanups.push(
			this.signaling.on('peer-joined', ({ userId }) => {
				const currentState = get(voiceState);
				const currentUser = get(authUser);
				if (currentState.channelId && currentUser && userId !== currentUser.id) {
					this.webrtc!.createPeer(userId, true);
				}
			})
		);

		// Listen for peer leaving
		this.webrtcCleanups.push(
			this.signaling.on('peer-left', ({ userId }) => {
				this.webrtc!.closePeer(userId);
			})
		);
	}

	private setupGatewayListeners() {
		// Listen for voice state updates that come through the gateway
		// but aren't handled by SignalingClient (e.g., VOICE_STATE_UPDATE
		// for channel-level state tracking in voiceState store)
		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_STATE_UPDATE', (data: unknown) => {
				const update = data as {
					user_id: string;
					channel_id: string | null;
				};

				const currentState = get(voiceState);
				if (update.channel_id === currentState.channelId && update.channel_id !== null) {
					const currentUser = get(authUser);
					if (currentUser && update.user_id !== currentUser.id) {
						this.webrtc?.createPeer(update.user_id, true);
					}
				} else if (update.channel_id === null) {
					this.webrtc?.closePeer(update.user_id);
				}
			})
		);
	}

	async connect(_channelId: string, _serverId: string): Promise<void> {
		if (!browser) return;

		try {
			// Acquire microphone via WebRTCConnectionManager
			await this.webrtc!.acquireLocalStream();

			// Setup audio analysis for speaking detection
			this.setupSpeakingDetection();

			// Apply current mute state
			const state = get(voiceState);
			this.webrtc!.setMuted(state.selfMuted);

			// Mark as connected
			voiceActions.setConnected();

			console.log('[Voice] Connected to voice channel');
		} catch (error) {
			console.error('[Voice] Failed to connect:', error);
			voiceActions.setError(
				error instanceof Error ? error.message : 'Failed to access microphone'
			);
			throw error;
		}
	}

	private setupSpeakingDetection() {
		const localStream = this.webrtc?.getLocalStream();
		if (!localStream) return;

		this.audioContext = new AudioContext();
		const source = this.audioContext.createMediaStreamSource(localStream);
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
				this.sendSpeakingState(speaking);
			}
		}, 100);
	}

	private sendSpeakingState(speaking: boolean) {
		const state = get(voiceState);
		if (!state.channelId) return;

		gateway.send({
			op: Op.DISPATCH,
			d: {
				t: 'VOICE_SPEAKING',
				d: {
					channel_id: state.channelId,
					speaking,
				},
			},
		});
	}

	private handlePeerList(peerUserIds: string[]) {
		const currentUser = get(authUser);
		if (!currentUser) return;

		for (const userId of peerUserIds) {
			if (userId !== currentUser.id && !this.webrtc!.getPeer(userId)) {
				this.webrtc!.createPeer(userId, true);
			}
		}
	}

	private playRemoteAudio(userId: string, stream: MediaStream) {
		const audio = document.createElement('audio');
		audio.srcObject = stream;
		audio.autoplay = true;
		audio.id = `voice-audio-${userId}`;

		const state = get(voiceState);
		audio.muted = state.selfDeafened;

		audio.style.display = 'none';
		document.body.appendChild(audio);

		console.log(`[Voice] Playing audio from ${userId}`);
	}

	disconnect() {
		console.log('[Voice] Disconnecting');

		// Stop speaking detection
		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
			this.analyser = null;
		}

		// Disconnect all peers and release media
		this.webrtc?.disconnectAll();

		this.isSpeaking = false;
	}

	setMuted(muted: boolean) {
		this.webrtc?.setMuted(muted);
	}

	setDeafened(deafened: boolean) {
		const peers = this.webrtc?.getAllPeers();
		if (!peers) return;

		for (const [userId] of peers) {
			const audio = document.getElementById(`voice-audio-${userId}`) as HTMLAudioElement;
			if (audio) {
				audio.muted = deafened;
			}
		}
	}

	destroy() {
		this.disconnect();
		this.webrtcCleanups.forEach((fn) => fn());
		this.webrtcCleanups = [];
		this.cleanupFunctions.forEach((fn) => fn());
		this.cleanupFunctions = [];
		this.webrtc?.destroy();
		this.signaling?.destroy();
	}
}

// Singleton instance
let instance: VoiceConnectionManager | null = null;

export function getVoiceConnectionManager(): VoiceConnectionManager {
	if (!instance && browser) {
		instance = new VoiceConnectionManager();
	}
	return instance!;
}

export function destroyVoiceConnectionManager() {
	if (instance) {
		instance.destroy();
		instance = null;
	}
}
