import { browser } from '$app/environment';
import { SignalingClient } from './SignalingClient';
import type {
	Peer,
	WebRTCConfig,
	WebRTCEvents,
	AnySignalingMessage,
	SignalingOffer,
	SignalingAnswer,
	SignalingIceCandidate,
} from './types';
import { DEFAULT_WEBRTC_CONFIG, DEFAULT_AUDIO_CONSTRAINTS } from './types';

type EventCallback<T extends keyof WebRTCEvents> = WebRTCEvents[T];

/**
 * Manages WebRTC peer connections for voice communication.
 * Handles the full lifecycle: media acquisition, peer connection creation,
 * offer/answer exchange via signaling, ICE candidate exchange, and reconnection.
 */
export class WebRTCConnectionManager {
	private config: WebRTCConfig;
	private signaling: SignalingClient;
	private peers = new Map<string, Peer>();
	private localStream: MediaStream | null = null;
	private localUserId: string = '';
	private channelId: string = '';
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private signalingCleanups: Array<() => void> = [];
	private reconnectAttempts = new Map<string, number>();

	constructor(config?: Partial<WebRTCConfig>) {
		this.config = { ...DEFAULT_WEBRTC_CONFIG, ...config };
		this.signaling = new SignalingClient({
			maxReconnectAttempts: this.config.maxReconnectAttempts,
			reconnectDelay: this.config.reconnectDelay,
		});
	}

	/** Get the signaling client (for external event binding) */
	getSignalingClient(): SignalingClient {
		return this.signaling;
	}

	/** Get the local media stream */
	getLocalStream(): MediaStream | null {
		return this.localStream;
	}

	/** Get all connected peers */
	getPeers(): Map<string, Peer> {
		return this.peers;
	}

	/** Get a specific peer */
	getPeer(userId: string): Peer | undefined {
		return this.peers.get(userId);
	}

	/**
	 * Acquire the local audio stream (microphone).
	 * Call this before connecting to ensure microphone access is granted.
	 */
	async acquireLocalStream(constraints?: MediaTrackConstraints): Promise<MediaStream> {
		if (!browser) throw new Error('Cannot acquire media stream outside browser');

		if (this.localStream) {
			return this.localStream;
		}

		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: constraints ?? DEFAULT_AUDIO_CONSTRAINTS,
			video: false,
		});

		this.emit('local-stream-ready', this.localStream);
		return this.localStream;
	}

	/**
	 * Connect to a voice channel via the signaling server.
	 */
	connect(signalingUrl: string, token: string, channelId: string, localUserId: string): void {
		if (!browser) return;

		this.localUserId = localUserId;
		this.channelId = channelId;

		this.setupSignalingListeners();
		this.signaling.connect(signalingUrl, token, channelId);
	}

	private setupSignalingListeners(): void {
		// Clean up any previous listeners
		this.signalingCleanups.forEach(fn => fn());
		this.signalingCleanups = [];

		this.signalingCleanups.push(
			this.signaling.on('message', (message: AnySignalingMessage) => {
				this.handleSignalingMessage(message);
			})
		);

		this.signalingCleanups.push(
			this.signaling.on('connected', () => {
				// Announce our presence
				this.signaling.send({
					type: 'join',
					fromUserId: this.localUserId,
					channelId: this.channelId,
				});
			})
		);

		this.signalingCleanups.push(
			this.signaling.on('error', (error: Error) => {
				this.emit('error', error);
			})
		);
	}

	private handleSignalingMessage(message: AnySignalingMessage): void {
		// Ignore messages from ourselves
		if (message.fromUserId === this.localUserId) return;

		switch (message.type) {
			case 'join':
				// New peer joined - we initiate the connection
				this.createPeerConnection(message.fromUserId, true);
				break;
			case 'leave':
				this.removePeer(message.fromUserId);
				break;
			case 'offer':
				this.handleOffer(message as SignalingOffer);
				break;
			case 'answer':
				this.handleAnswer(message as SignalingAnswer);
				break;
			case 'ice-candidate':
				this.handleIceCandidate(message as SignalingIceCandidate);
				break;
		}
	}

	/**
	 * Create a new RTCPeerConnection for a remote peer.
	 */
	private createPeerConnection(userId: string, createOffer: boolean): Peer {
		// Close existing connection if any
		if (this.peers.has(userId)) {
			this.closePeerConnection(userId);
		}

		console.log(`[WebRTC] Creating peer connection to ${userId}, initiator: ${createOffer}`);

		const connection = new RTCPeerConnection({
			iceServers: this.config.iceServers as RTCIceServer[],
		});
		const remoteStream = new MediaStream();

		const peer: Peer = {
			userId,
			connection,
			remoteStream,
			audioTrack: null,
			connectionState: 'new',
		};

		this.peers.set(userId, peer);

		// Add local tracks to the connection
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => {
				connection.addTrack(track, this.localStream!);
			});
		}

		// Handle incoming remote tracks
		connection.ontrack = (event) => {
			console.log(`[WebRTC] Received track from ${userId}`);
			event.streams[0]?.getTracks().forEach(track => {
				remoteStream.addTrack(track);
			});
			peer.audioTrack = remoteStream.getAudioTracks()[0] ?? null;
			this.emit('remote-stream', userId, remoteStream);
		};

		// Handle ICE candidates
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				this.signaling.send({
					type: 'ice-candidate',
					fromUserId: this.localUserId,
					toUserId: userId,
					channelId: this.channelId,
					candidate: event.candidate.candidate,
					sdpMid: event.candidate.sdpMid,
					sdpMLineIndex: event.candidate.sdpMLineIndex,
				});
			}
		};

		// Monitor connection state
		connection.onconnectionstatechange = () => {
			const state = connection.connectionState;
			peer.connectionState = state;
			console.log(`[WebRTC] Connection state with ${userId}: ${state}`);

			this.emit('connection-state-changed', state, userId);

			if (state === 'connected') {
				this.reconnectAttempts.delete(userId);
				this.emit('peer-connected', userId);
			} else if (state === 'failed') {
				this.handleConnectionFailure(userId);
			} else if (state === 'disconnected') {
				// Brief disconnections are normal; wait for 'failed' before acting
			}
		};

		connection.oniceconnectionstatechange = () => {
			console.log(`[WebRTC] ICE state with ${userId}: ${connection.iceConnectionState}`);
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
				sdp: offer.sdp!,
			});
		} catch (error) {
			console.error(`[WebRTC] Failed to create offer for ${userId}:`, error);
			this.emit('error', new Error(`Failed to create offer for ${userId}: ${error}`));
		}
	}

	private async handleOffer(message: SignalingOffer): Promise<void> {
		const { fromUserId, sdp } = message;
		console.log(`[WebRTC] Received offer from ${fromUserId}`);

		// Create peer connection if needed (we don't initiate since they sent the offer)
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
				sdp: answer.sdp!,
			});
		} catch (error) {
			console.error(`[WebRTC] Failed to handle offer from ${fromUserId}:`, error);
			this.emit('error', new Error(`Failed to handle offer from ${fromUserId}: ${error}`));
		}
	}

	private async handleAnswer(message: SignalingAnswer): Promise<void> {
		const { fromUserId, sdp } = message;
		console.log(`[WebRTC] Received answer from ${fromUserId}`);

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'answer', sdp });
		} catch (error) {
			console.error(`[WebRTC] Failed to handle answer from ${fromUserId}:`, error);
		}
	}

	private async handleIceCandidate(message: SignalingIceCandidate): Promise<void> {
		const { fromUserId, candidate, sdpMid, sdpMLineIndex } = message;

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.addIceCandidate(
				new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex })
			);
		} catch (error) {
			console.error(`[WebRTC] Failed to add ICE candidate from ${fromUserId}:`, error);
		}
	}

	/**
	 * Handle a failed peer connection with reconnection logic.
	 */
	private handleConnectionFailure(userId: string): void {
		const attempts = this.reconnectAttempts.get(userId) ?? 0;

		if (attempts >= this.config.maxReconnectAttempts) {
			console.error(`[WebRTC] Max reconnect attempts reached for ${userId}`);
			this.removePeer(userId);
			return;
		}

		this.reconnectAttempts.set(userId, attempts + 1);
		const delay = this.config.reconnectDelay * Math.pow(1.5, attempts);

		console.log(`[WebRTC] Reconnecting to ${userId} in ${Math.round(delay)}ms (attempt ${attempts + 1})`);

		setTimeout(() => {
			if (!this.peers.has(userId)) return; // Peer was removed
			this.createPeerConnection(userId, true);
		}, delay);
	}

	private closePeerConnection(userId: string): void {
		const peer = this.peers.get(userId);
		if (!peer) return;

		peer.connection.ontrack = null;
		peer.connection.onicecandidate = null;
		peer.connection.onconnectionstatechange = null;
		peer.connection.oniceconnectionstatechange = null;
		peer.connection.close();
		this.peers.delete(userId);
	}

	/** Remove a peer and emit disconnect event */
	private removePeer(userId: string): void {
		this.closePeerConnection(userId);
		this.reconnectAttempts.delete(userId);
		this.emit('peer-disconnected', userId);
		console.log(`[WebRTC] Removed peer ${userId}`);
	}

	/** Set local audio track enabled/disabled (mute/unmute) */
	setMuted(muted: boolean): void {
		this.localStream?.getAudioTracks().forEach(track => {
			track.enabled = !muted;
		});
	}

	/** Disconnect from all peers and the signaling server */
	disconnect(): void {
		console.log('[WebRTC] Disconnecting');

		// Announce leave
		if (this.signaling.getState() === 'connected') {
			this.signaling.send({
				type: 'leave',
				fromUserId: this.localUserId,
				channelId: this.channelId,
			});
		}

		// Close all peer connections
		for (const userId of [...this.peers.keys()]) {
			this.removePeer(userId);
		}

		// Stop local stream
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
		}

		// Disconnect signaling
		this.signalingCleanups.forEach(fn => fn());
		this.signalingCleanups = [];
		this.signaling.disconnect();

		this.reconnectAttempts.clear();
	}

	/** Register an event listener */
	on<T extends keyof WebRTCEvents>(event: T, callback: EventCallback<T>): () => void {
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

	/** Clean up all resources */
	destroy(): void {
		this.disconnect();
		this.listeners.clear();
		this.signaling.destroy();
	}
}
