import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { gateway, Op, onGatewayEvent } from '$lib/stores/gateway';
import { voiceState, voiceActions } from '$lib/stores/voice';
import { user as authUser } from '$lib/stores/auth';
import { WebRTCConnectionManager } from './WebRTCConnectionManager';
import { getNoiseSuppressionManager, type SuppressionLevel } from './NoiseSuppressionManager';
import type { AnySignalingMessage } from './types';

/**
 * VoiceConnectionManager bridges the app's gateway (WebSocket) signaling
 * with the WebRTCConnectionManager for peer-to-peer voice.
 *
 * The gateway acts as the signaling transport: voice offers, answers, and
 * ICE candidates are sent/received through gateway events, then forwarded
 * to/from the WebRTCConnectionManager.
 */
class VoiceConnectionManager {
	private webrtc: WebRTCConnectionManager;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;
	private cleanupFunctions: Array<() => void> = [];
	private webrtcCleanups: Array<() => void> = [];
	private noiseSuppressionEnabled = false;

	constructor() {
		this.webrtc = new WebRTCConnectionManager();

		if (!browser) return;
		this.setupGatewayListeners();
		this.setupWebRTCListeners();
	}

	/**
	 * Listen for WebRTC signaling messages arriving via the gateway
	 * and forward them into the WebRTCConnectionManager as signaling messages.
	 */
	private setupGatewayListeners() {
		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_OFFER', (data: unknown) => {
				const offer = data as { from_user_id: string; sdp: string; channel_id?: string };
				const channelId = offer.channel_id ?? get(voiceState).channelId ?? '';
				this.webrtc['handleSignalingMessage']({
					type: 'offer',
					fromUserId: offer.from_user_id,
					channelId,
					sdp: offer.sdp,
				} as AnySignalingMessage);
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_ANSWER', (data: unknown) => {
				const answer = data as { from_user_id: string; sdp: string; channel_id?: string };
				const channelId = answer.channel_id ?? get(voiceState).channelId ?? '';
				this.webrtc['handleSignalingMessage']({
					type: 'answer',
					fromUserId: answer.from_user_id,
					channelId,
					sdp: answer.sdp,
				} as AnySignalingMessage);
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_ICE_CANDIDATE', (data: unknown) => {
				const candidate = data as {
					from_user_id: string;
					candidate: string;
					sdpMid: string;
					sdpMLineIndex: number;
					channel_id?: string;
				};
				const channelId = candidate.channel_id ?? get(voiceState).channelId ?? '';
				this.webrtc['handleSignalingMessage']({
					type: 'ice-candidate',
					fromUserId: candidate.from_user_id,
					channelId,
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
				} as AnySignalingMessage);
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_SERVER_UPDATE', (data: unknown) => {
				const update = data as {
					channel_id: string;
					server_id: string;
					peers: Array<{ user_id: string }>;
				};
				const currentUser = get(authUser);
				if (!currentUser) return;
				for (const peer of update.peers) {
					if (peer.user_id !== currentUser.id && !this.webrtc.getPeer(peer.user_id)) {
						// Simulate a join message so WebRTCConnectionManager creates the connection
						this.webrtc['handleSignalingMessage']({
							type: 'join',
							fromUserId: peer.user_id,
							channelId: update.channel_id,
						} as AnySignalingMessage);
					}
				}
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_STATE_UPDATE', (data: unknown) => {
				const update = data as {
					user_id: string;
					channel_id: string | null;
				};

				const currentState = get(voiceState);
				const currentUser = get(authUser);
				if (!currentUser) return;

				if (update.channel_id === currentState.channelId && update.channel_id !== null) {
					if (update.user_id !== currentUser.id) {
						this.webrtc['handleSignalingMessage']({
							type: 'join',
							fromUserId: update.user_id,
							channelId: update.channel_id,
						} as AnySignalingMessage);
					}
				} else if (update.channel_id === null) {
					this.webrtc['handleSignalingMessage']({
						type: 'leave',
						fromUserId: update.user_id,
						channelId: currentState.channelId ?? '',
					} as AnySignalingMessage);
				}
			})
		);
	}

	/**
	 * Listen for WebRTCConnectionManager events and bridge outgoing signaling
	 * messages back through the gateway.
	 */
	private setupWebRTCListeners() {
		this.webrtcCleanups.push(
			this.webrtc.on('remote-stream', (userId: string, stream: MediaStream) => {
				this.playRemoteAudio(userId, stream);
			})
		);

		this.webrtcCleanups.push(
			this.webrtc.on('peer-disconnected', (userId: string) => {
				const audio = document.getElementById(`voice-audio-${userId}`);
				if (audio) audio.remove();
			})
		);

		this.webrtcCleanups.push(
			this.webrtc.on('error', (error: Error) => {
				console.error('[Voice] WebRTC error:', error.message);
			})
		);
	}

	async connect(_channelId: string, _serverId: string): Promise<void> {
		if (!browser) return;

		try {
			// Acquire microphone via WebRTCConnectionManager
			await this.webrtc.acquireLocalStream();
			let localStream = this.webrtc.getLocalStream();

			// Set the local user ID so WebRTCConnectionManager can filter own messages
			const currentUser = get(authUser);
			if (currentUser) {
				// Store userId for gateway-based signaling forwarding
				this.webrtc['localUserId'] = currentUser.id;
				this.webrtc['channelId'] = _channelId;
			}

			// Apply noise suppression to the local stream if enabled
			if (localStream && this.noiseSuppressionEnabled) {
				try {
					const nsManager = getNoiseSuppressionManager();
					if (!nsManager.getConfig()) {
						await nsManager.initialize();
					}
					localStream = await nsManager.processMediaStream(localStream);
					console.log('[Voice] Noise suppression applied to local stream');
				} catch (error) {
					console.warn('[Voice] Noise suppression unavailable:', error);
				}
			}

			// Setup audio analysis for speaking detection
			if (localStream) {
				this.setupSpeakingDetection(localStream);

				// Apply current mute state
				const state = get(voiceState);
				localStream.getAudioTracks().forEach(track => {
					track.enabled = !state.selfMuted;
				});
			}

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

	/**
	 * Enable or disable noise suppression for voice connections.
	 * Takes effect on the next connect() call, or immediately if already connected.
	 */
	async setNoiseSuppression(enabled: boolean, level?: SuppressionLevel): Promise<void> {
		this.noiseSuppressionEnabled = enabled;
		const nsManager = getNoiseSuppressionManager();

		if (enabled) {
			if (!nsManager.getConfig()) {
				await nsManager.initialize(level !== undefined ? { level } : undefined);
			} else if (level !== undefined) {
				await nsManager.setLevel(level);
			}
			nsManager.setEnabled(true);
		} else {
			nsManager.setEnabled(false);
		}
	}

	/**
	 * Check if noise suppression is currently enabled
	 */
	isNoiseSuppressionEnabled(): boolean {
		return this.noiseSuppressionEnabled;
	}

	private setupSpeakingDetection(stream: MediaStream) {
		this.audioContext = new AudioContext();
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
					speaking
				}
			}
		});
	}

	private playRemoteAudio(userId: string, stream: MediaStream) {
		// Remove existing audio element if any
		const existing = document.getElementById(`voice-audio-${userId}`);
		if (existing) existing.remove();

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

		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
			this.analyser = null;
		}

		this.webrtc.disconnect();

		// Remove all voice audio elements
		document.querySelectorAll('[id^="voice-audio-"]').forEach(el => el.remove());

		this.isSpeaking = false;
	}

	setMuted(muted: boolean) {
		this.webrtc.setMuted(muted);
	}

	setDeafened(deafened: boolean) {
		for (const [userId] of this.webrtc.getPeers()) {
			const audio = document.getElementById(`voice-audio-${userId}`) as HTMLAudioElement;
			if (audio) {
				audio.muted = deafened;
			}
		}
	}

	/** Get the underlying WebRTCConnectionManager for advanced usage */
	getWebRTCManager(): WebRTCConnectionManager {
		return this.webrtc;
	}

	destroy() {
		this.disconnect();
		this.cleanupFunctions.forEach(fn => fn());
		this.cleanupFunctions = [];
		this.webrtcCleanups.forEach(fn => fn());
		this.webrtcCleanups = [];
		this.webrtc.destroy();
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
