import { browser } from '$app/environment';
import { get } from 'svelte/store';
// TODO: Implement gateway store for WebSocket communication
import { voiceState, voiceActions, transcriptionState, transcriptionActions } from '$lib/stores/voice';
import { user as authUser } from '$lib/stores/app';
import { SignalingClient } from './SignalingClient';
import { WebRTCConnectionManager } from './WebRTCConnectionManager';
import { getTranscriptionManager } from './TranscriptionManager';

class VoiceConnectionManager {
	private webrtc: WebRTCConnectionManager | null = null;
	private signaling: SignalingClient | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;
	private cleanupFunctions: Array<() => void> = [];
	private webrtcCleanups: Array<() => void> = [];
	private transcriptionWorkletNode: AudioWorkletNode | null = null;
	private remoteAudioProcessors = new Map<string, AudioWorkletNode>();
	private usernames = new Map<string, string>();

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
				this.setupRemoteTranscription(userId, stream);
			})
		);

		// Listen for peer disconnection to remove audio elements
		this.webrtcCleanups.push(
			this.webrtc.on('peer-disconnected', ({ userId }) => {
				const audio = document.getElementById(`voice-audio-${userId}`);
				if (audio) audio.remove();

				// Clean up transcription processor for this user
				const processor = this.remoteAudioProcessors.get(userId);
				if (processor) {
					processor.disconnect();
					this.remoteAudioProcessors.delete(userId);
				}
				this.usernames.delete(userId);
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
		// TODO: Implement gateway listeners for voice state updates
		// Listen for voice state updates that come through the gateway
		// but aren't handled by SignalingClient (e.g., VOICE_STATE_UPDATE
		// for channel-level state tracking in voiceState store)
		console.log('[Voice] Gateway listeners not implemented yet');
	}

	async connect(_channelId: string, _serverId: string): Promise<void> {
		if (!browser) return;

		try {
			// Acquire microphone via WebRTCConnectionManager
			await this.webrtc!.acquireLocalStream();

			// Setup audio analysis for speaking detection
			this.setupSpeakingDetection();

			// Setup transcription if enabled
			const transcriptionStateValue = get(transcriptionState);
			if (transcriptionStateValue.isEnabled) {
				await this.setupLocalTranscription();
			}

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

		// TODO: Send speaking state through gateway when implemented
		console.log(`[Voice] Speaking state: ${speaking} for channel ${state.channelId}`);
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

	private async setupLocalTranscription() {
		if (!this.audioContext || !get(transcriptionState).isEnabled) return;

		try {
			// Setup audio worklet for local audio processing
			await this.audioContext.audioWorklet.addModule('/worklets/transcription-processor.js');

			const localStream = this.webrtc?.getLocalStream();
			if (!localStream) return;

			const source = this.audioContext.createMediaStreamSource(localStream);
			this.transcriptionWorkletNode = new AudioWorkletNode(
				this.audioContext,
				'transcription-processor',
				{
					processorOptions: {
						sampleRate: 16000, // Whisper expects 16kHz
					},
				}
			);

			// Listen for processed audio data
			this.transcriptionWorkletNode.port.onmessage = (event) => {
				const { audioData } = event.data;
				const currentUser = get(authUser);
				if (currentUser && audioData) {
					const transcription = getTranscriptionManager();
					transcription.processAudio(
						currentUser.id,
						audioData,
						currentUser.display_name || currentUser.username
					);
				}
			};

			source.connect(this.transcriptionWorkletNode);
			this.transcriptionWorkletNode.connect(this.audioContext.destination);

			console.log('[Voice] Local transcription setup complete');
		} catch (error) {
			console.error('[Voice] Failed to setup local transcription:', error);
		}
	}

	private async setupRemoteTranscription(userId: string, stream: MediaStream) {
		if (!this.audioContext || !get(transcriptionState).isEnabled) return;

		try {
			const source = this.audioContext.createMediaStreamSource(stream);
			const workletNode = new AudioWorkletNode(
				this.audioContext,
				'transcription-processor',
				{
					processorOptions: {
						sampleRate: 16000,
					},
				}
			);

			// Listen for processed audio data
			workletNode.port.onmessage = (event) => {
				const { audioData } = event.data;
				if (audioData) {
					const username = this.usernames.get(userId) || userId;
					const transcription = getTranscriptionManager();
					transcription.processAudio(userId, audioData, username);
				}
			};

			source.connect(workletNode);
			workletNode.connect(this.audioContext.destination);

			this.remoteAudioProcessors.set(userId, workletNode);

			console.log(`[Voice] Remote transcription setup for ${userId}`);
		} catch (error) {
			console.error(`[Voice] Failed to setup remote transcription for ${userId}:`, error);
		}
	}

	async enableTranscription(): Promise<void> {
		if (!browser) return;

		try {
			const transcription = getTranscriptionManager();

			transcriptionActions.setEnabled(true);
			await transcription.initialize();

			// Setup transcription for existing streams
			await this.setupLocalTranscription();

			console.log('[Voice] Transcription enabled');
		} catch (error) {
			console.error('[Voice] Failed to enable transcription:', error);
			transcriptionActions.setError(
				error instanceof Error ? error.message : 'Failed to enable transcription'
			);
		}
	}

	disableTranscription(): void {
		transcriptionActions.setEnabled(false);

		// Disconnect transcription worklets
		if (this.transcriptionWorkletNode) {
			this.transcriptionWorkletNode.disconnect();
			this.transcriptionWorkletNode = null;
		}

		for (const worklet of this.remoteAudioProcessors.values()) {
			worklet.disconnect();
		}
		this.remoteAudioProcessors.clear();

		console.log('[Voice] Transcription disabled');
	}

	setUsername(userId: string, username: string): void {
		this.usernames.set(userId, username);
	}

	disconnect() {
		console.log('[Voice] Disconnecting');

		// Stop speaking detection
		if (this.speakingCheckInterval) {
			clearInterval(this.speakingCheckInterval);
			this.speakingCheckInterval = null;
		}

		// Clean up transcription
		if (this.transcriptionWorkletNode) {
			this.transcriptionWorkletNode.disconnect();
			this.transcriptionWorkletNode = null;
		}

		for (const worklet of this.remoteAudioProcessors.values()) {
			worklet.disconnect();
		}
		this.remoteAudioProcessors.clear();

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
