import { SignalingService } from './SignalingService';
import { MediaDeviceManager } from './MediaDeviceManager';
import type {
	PeerConnection,
	VoiceUser,
	VoiceServiceConfig,
	VoiceServiceEvents,
	SignalingMessage,
	SdpMessage,
	IceCandidateMessage,
	JoinMessage,
	SignalingConnectionState,
} from './types';
import { DEFAULT_VOICE_CONFIG } from './types';

type EventCallback<T extends keyof VoiceServiceEvents> = VoiceServiceEvents[T];

/**
 * Main voice service orchestrating WebRTC peer connections for P2P voice communication.
 * Manages the full lifecycle: media acquisition via MediaDeviceManager,
 * signaling via SignalingService, and RTCPeerConnection management for each peer.
 */
export class VoiceService {
	private config: VoiceServiceConfig;
	private signaling: SignalingService;
	private media: MediaDeviceManager;
	private peers = new Map<string, PeerConnection>();
	private localUserId = '';
	private channelId = '';
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private signalingCleanups: Array<() => void> = [];
	private remoteUsers = new Map<string, VoiceUser>();
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;

	constructor(config?: Partial<VoiceServiceConfig>) {
		this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
		this.signaling = new SignalingService({
			maxReconnectAttempts: this.config.maxReconnectAttempts,
			reconnectDelayMs: this.config.reconnectDelayMs,
		});
		this.media = new MediaDeviceManager();
	}

	getSignalingService(): SignalingService {
		return this.signaling;
	}

	getMediaDeviceManager(): MediaDeviceManager {
		return this.media;
	}

	getLocalStream(): MediaStream | null {
		return this.media.getLocalStream();
	}

	getPeers(): Map<string, PeerConnection> {
		return this.peers;
	}

	getPeer(userId: string): PeerConnection | undefined {
		return this.peers.get(userId);
	}

	getRemoteUsers(): Map<string, VoiceUser> {
		return this.remoteUsers;
	}

	/**
	 * Join a voice channel. Acquires microphone, connects to signaling,
	 * and begins exchanging offers/answers with peers.
	 */
	async join(
		signalingUrl: string,
		token: string,
		channelId: string,
		localUserId: string,
		username: string,
		displayName?: string,
	): Promise<void> {
		this.localUserId = localUserId;
		this.channelId = channelId;

		// Acquire microphone
		const stream = await this.media.acquireStream();
		this.emit('local-stream-ready', stream);

		// Setup speaking detection
		this.setupSpeakingDetection(stream);

		// Wire up signaling events
		this.setupSignalingListeners();

		// Connect to signaling server
		this.signaling.connect(
			signalingUrl || this.config.signalingUrl,
			token,
			channelId,
		);

		// The 'connected' event on signaling will trigger our join announcement
		this.signalingCleanups.push(
			this.signaling.on('connected', () => {
				this.signaling.send({
					type: 'join',
					fromUserId: this.localUserId,
					channelId: this.channelId,
					timestamp: Date.now(),
					username,
					displayName,
				});
			})
		);
	}

	private setupSignalingListeners(): void {
		this.signalingCleanups.forEach(fn => fn());
		this.signalingCleanups = [];

		this.signalingCleanups.push(
			this.signaling.on('message', (message: SignalingMessage) => {
				this.handleSignalingMessage(message);
			})
		);

		this.signalingCleanups.push(
			this.signaling.on('error', (error: Error) => {
				this.emit('error', error);
			})
		);

		// Forward signaling state changes
		const forwardState = (state: SignalingConnectionState) => {
			this.emit('signaling-state-changed', state);
		};

		this.signalingCleanups.push(
			this.signaling.on('connected', () => forwardState('connected'))
		);
		this.signalingCleanups.push(
			this.signaling.on('disconnected', () => forwardState('disconnected'))
		);
		this.signalingCleanups.push(
			this.signaling.on('reconnecting', () => forwardState('reconnecting'))
		);
	}

	private handleSignalingMessage(message: SignalingMessage): void {
		if (message.fromUserId === this.localUserId) return;

		switch (message.type) {
			case 'join':
				this.handlePeerJoin(message as JoinMessage);
				break;
			case 'leave':
				this.removePeer(message.fromUserId);
				break;
			case 'offer':
				this.handleOffer(message as SdpMessage);
				break;
			case 'answer':
				this.handleAnswer(message as SdpMessage);
				break;
			case 'ice-candidate':
				this.handleIceCandidate(message as IceCandidateMessage);
				break;
			case 'mute-update':
				this.handleMuteUpdate(message);
				break;
			case 'speaking':
				this.handleSpeakingUpdate(message);
				break;
		}
	}

	private handlePeerJoin(message: JoinMessage): void {
		const user: VoiceUser = {
			userId: message.fromUserId,
			username: message.username,
			displayName: message.displayName,
			isMuted: false,
			isDeafened: false,
			isSpeaking: false,
			joinedAt: message.timestamp,
		};
		this.remoteUsers.set(message.fromUserId, user);
		this.emit('peer-joined', user);

		// Initiator: we create the offer because the new peer just joined
		this.createPeerConnection(message.fromUserId, true);
	}

	private handleMuteUpdate(message: SignalingMessage): void {
		if (message.type !== 'mute-update') return;
		const user = this.remoteUsers.get(message.fromUserId);
		if (user) {
			user.isMuted = message.isMuted;
			user.isDeafened = message.isDeafened;
			this.emit('peer-mute-changed', message.fromUserId, message.isMuted, message.isDeafened);
		}
	}

	private handleSpeakingUpdate(message: SignalingMessage): void {
		if (message.type !== 'speaking') return;
		const user = this.remoteUsers.get(message.fromUserId);
		if (user) {
			user.isSpeaking = message.isSpeaking;
			this.emit('peer-speaking', message.fromUserId, message.isSpeaking);
		}
	}

	/**
	 * Create an RTCPeerConnection for a remote peer.
	 */
	private createPeerConnection(userId: string, createOffer: boolean): PeerConnection {
		if (this.peers.has(userId)) {
			this.closePeerConnection(userId);
		}

		console.log(`[VoiceService] Creating peer connection to ${userId}, initiator: ${createOffer}`);

		const connection = new RTCPeerConnection({
			iceServers: this.config.iceServers as RTCIceServer[],
		});
		const remoteStream = new MediaStream();

		const peer: PeerConnection = {
			userId,
			connection,
			remoteStream,
			audioTrack: null,
			state: 'new',
			reconnectAttempts: 0,
		};

		this.peers.set(userId, peer);

		// Add local tracks
		const localStream = this.media.getLocalStream();
		if (localStream) {
			localStream.getTracks().forEach(track => {
				connection.addTrack(track, localStream);
			});
		}

		// Handle incoming tracks
		connection.ontrack = (event) => {
			console.log(`[VoiceService] Received track from ${userId}`);
			event.streams[0]?.getTracks().forEach(track => {
				remoteStream.addTrack(track);
			});
			peer.audioTrack = remoteStream.getAudioTracks()[0] ?? null;
			this.emit('remote-stream', userId, remoteStream);
		};

		// ICE candidates
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				this.signaling.send({
					type: 'ice-candidate',
					fromUserId: this.localUserId,
					toUserId: userId,
					channelId: this.channelId,
					timestamp: Date.now(),
					candidate: event.candidate.candidate,
					sdpMid: event.candidate.sdpMid,
					sdpMLineIndex: event.candidate.sdpMLineIndex,
				});
			}
		};

		// Connection state monitoring
		connection.onconnectionstatechange = () => {
			const state = connection.connectionState;
			peer.state = state;
			console.log(`[VoiceService] Connection state with ${userId}: ${state}`);
			this.emit('connection-state-changed', state, userId);

			if (state === 'connected') {
				peer.reconnectAttempts = 0;
			} else if (state === 'failed') {
				this.handleConnectionFailure(userId);
			}
		};

		if (createOffer) {
			this.createAndSendOffer(userId, connection);
		}

		return peer;
	}

	private async createAndSendOffer(userId: string, connection: RTCPeerConnection): Promise<void> {
		try {
			const offer = await connection.createOffer();
			await connection.setLocalDescription(offer);

			this.signaling.send({
				type: 'offer',
				fromUserId: this.localUserId,
				toUserId: userId,
				channelId: this.channelId,
				timestamp: Date.now(),
				sdp: offer.sdp!,
			});
		} catch (error) {
			console.error(`[VoiceService] Failed to create offer for ${userId}:`, error);
			this.emit('error', new Error(`Failed to create offer: ${error}`));
		}
	}

	private async handleOffer(message: SdpMessage): Promise<void> {
		const { fromUserId, sdp } = message;
		console.log(`[VoiceService] Received offer from ${fromUserId}`);

		let peer = this.peers.get(fromUserId);
		if (!peer) {
			peer = this.createPeerConnection(fromUserId, false);
		}

		try {
			await peer.connection.setRemoteDescription({ type: 'offer', sdp });
			const answer = await peer.connection.createAnswer();
			await peer.connection.setLocalDescription(answer);

			this.signaling.send({
				type: 'answer',
				fromUserId: this.localUserId,
				toUserId: fromUserId,
				channelId: this.channelId,
				timestamp: Date.now(),
				sdp: answer.sdp!,
			});
		} catch (error) {
			console.error(`[VoiceService] Failed to handle offer from ${fromUserId}:`, error);
			this.emit('error', new Error(`Failed to handle offer: ${error}`));
		}
	}

	private async handleAnswer(message: SdpMessage): Promise<void> {
		const { fromUserId, sdp } = message;
		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'answer', sdp });
		} catch (error) {
			console.error(`[VoiceService] Failed to handle answer from ${fromUserId}:`, error);
		}
	}

	private async handleIceCandidate(message: IceCandidateMessage): Promise<void> {
		const peer = this.peers.get(message.fromUserId);
		if (!peer) return;

		try {
			await peer.connection.addIceCandidate(
				new RTCIceCandidate({
					candidate: message.candidate,
					sdpMid: message.sdpMid,
					sdpMLineIndex: message.sdpMLineIndex,
				})
			);
		} catch (error) {
			console.error(`[VoiceService] Failed to add ICE candidate from ${message.fromUserId}:`, error);
		}
	}

	private handleConnectionFailure(userId: string): void {
		const peer = this.peers.get(userId);
		if (!peer) return;

		if (peer.reconnectAttempts >= this.config.maxReconnectAttempts) {
			console.error(`[VoiceService] Max reconnect attempts reached for ${userId}`);
			this.removePeer(userId);
			return;
		}

		peer.reconnectAttempts++;
		const delay = this.config.reconnectDelayMs * Math.pow(1.5, peer.reconnectAttempts - 1);

		console.log(`[VoiceService] Reconnecting to ${userId} in ${Math.round(delay)}ms (attempt ${peer.reconnectAttempts})`);

		setTimeout(() => {
			if (!this.peers.has(userId)) return;
			this.createPeerConnection(userId, true);
		}, delay);
	}

	private closePeerConnection(userId: string): void {
		const peer = this.peers.get(userId);
		if (!peer) return;

		peer.connection.ontrack = null;
		peer.connection.onicecandidate = null;
		peer.connection.onconnectionstatechange = null;
		peer.connection.close();
		this.peers.delete(userId);
	}

	private removePeer(userId: string): void {
		this.closePeerConnection(userId);
		this.remoteUsers.delete(userId);
		this.emit('peer-left', userId);
		console.log(`[VoiceService] Removed peer ${userId}`);
	}

	/**
	 * Setup voice activity detection on the local stream.
	 */
	private setupSpeakingDetection(stream: MediaStream): void {
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
				this.signaling.send({
					type: 'speaking',
					fromUserId: this.localUserId,
					channelId: this.channelId,
					timestamp: Date.now(),
					isSpeaking: speaking,
				});
			}
		}, 100);
	}

	/**
	 * Set local mute state and notify peers.
	 */
	setMuted(muted: boolean): void {
		this.media.setMuted(muted);
		this.signaling.send({
			type: 'mute-update',
			fromUserId: this.localUserId,
			channelId: this.channelId,
			timestamp: Date.now(),
			isMuted: muted,
			isDeafened: false,
		});
	}

	/**
	 * Set deafened state - mutes all remote audio elements.
	 */
	setDeafened(deafened: boolean): void {
		if (typeof document !== 'undefined') {
			document.querySelectorAll<HTMLAudioElement>('[id^="voice-audio-"]').forEach(audio => {
				audio.muted = deafened;
			});
		}
	}

	/**
	 * Replace local audio track on all peer connections (for device switching).
	 */
	async replaceTrack(newStream: MediaStream): Promise<void> {
		const newTrack = newStream.getAudioTracks()[0];
		if (!newTrack) return;

		for (const [, peer] of this.peers) {
			const senders = peer.connection.getSenders();
			const audioSender = senders.find(s => s.track?.kind === 'audio');
			if (audioSender) {
				await audioSender.replaceTrack(newTrack);
			}
		}
	}

	/**
	 * Leave the voice channel and clean up all resources.
	 */
	leave(): void {
		console.log('[VoiceService] Leaving voice channel');

		// Announce departure
		if (this.signaling.getState() === 'connected') {
			this.signaling.send({
				type: 'leave',
				fromUserId: this.localUserId,
				channelId: this.channelId,
				timestamp: Date.now(),
			});
		}

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
		this.isSpeaking = false;

		// Close all peer connections
		for (const userId of [...this.peers.keys()]) {
			this.removePeer(userId);
		}

		// Release media
		this.media.releaseStream();

		// Disconnect signaling
		this.signalingCleanups.forEach(fn => fn());
		this.signalingCleanups = [];
		this.signaling.disconnect();

		// Remove audio elements
		if (typeof document !== 'undefined') {
			document.querySelectorAll('[id^="voice-audio-"]').forEach(el => el.remove());
		}

		this.remoteUsers.clear();
	}

	on<T extends keyof VoiceServiceEvents>(event: T, callback: EventCallback<T>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const cb = callback as (...args: unknown[]) => void;
		this.listeners.get(event)!.add(cb);
		return () => {
			this.listeners.get(event)?.delete(cb);
		};
	}

	private emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach(cb => cb(...args));
	}

	destroy(): void {
		this.leave();
		this.media.destroy();
		this.signaling.destroy();
		this.listeners.clear();
	}
}
