import { browser } from '$app/environment';
import { SignalingClient } from './SignalingClient';
import type {
	Peer,
	WebRTCConfig,
	WebRTCEvents,
	SignalingOffer,
	SignalingAnswer,
	SignalingIceCandidate,
} from './types';

type EventCallback<T> = (data: T) => void;

const DEFAULT_CONFIG: WebRTCConfig = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
	],
};

const PEER_RECONNECT_DELAY = 3000;
const MAX_PEER_RECONNECT_ATTEMPTS = 5;

/**
 * Manages RTCPeerConnection lifecycle for all peers in a voice channel.
 * Handles ICE candidate exchange, offer/answer negotiation,
 * local media stream management, and per-peer reconnection.
 */
export class WebRTCConnectionManager {
	private peers = new Map<string, Peer>();
	private localStream: MediaStream | null = null;
	private config: WebRTCConfig;
	private signalingClient: SignalingClient;
	private listeners = new Map<string, Set<EventCallback<unknown>>>();
	private signalingCleanups: Array<() => void> = [];
	private peerReconnectAttempts = new Map<string, number>();
	private peerReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(signalingClient: SignalingClient, config?: WebRTCConfig) {
		this.signalingClient = signalingClient;
		this.config = config ?? DEFAULT_CONFIG;

		if (!browser) return;
		this.setupSignalingListeners();
	}

	private setupSignalingListeners() {
		this.signalingCleanups.push(
			this.signalingClient.on('offer', (offer: SignalingOffer) => {
				this.handleOffer(offer.from_user_id, offer.sdp);
			})
		);

		this.signalingCleanups.push(
			this.signalingClient.on('answer', (answer: SignalingAnswer) => {
				this.handleAnswer(answer.from_user_id, answer.sdp);
			})
		);

		this.signalingCleanups.push(
			this.signalingClient.on('ice-candidate', (candidate: SignalingIceCandidate) => {
				this.handleIceCandidate(candidate.from_user_id, {
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
				});
			})
		);
	}

	/**
	 * Acquire the local media stream (microphone).
	 */
	async acquireLocalStream(): Promise<MediaStream> {
		if (this.localStream) return this.localStream;

		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: false,
		});

		this.emit('local-stream-ready', { stream: this.localStream });
		return this.localStream;
	}

	/**
	 * Get the local media stream if acquired.
	 */
	getLocalStream(): MediaStream | null {
		return this.localStream;
	}

	/**
	 * Create a peer connection and optionally send an offer.
	 */
	createPeer(userId: string, initiateOffer: boolean): Peer {
		// Close existing connection if any
		if (this.peers.has(userId)) {
			this.closePeer(userId);
		}

		console.log(`[WebRTC] Creating peer connection to ${userId}, offer: ${initiateOffer}`);

		const connection = new RTCPeerConnection({
			iceServers: this.config.iceServers,
			iceTransportPolicy: this.config.iceTransportPolicy,
		});
		const remoteStream = new MediaStream();

		const peer: Peer = {
			userId,
			connection,
			audioTrack: null,
			remoteStream,
		};

		this.peers.set(userId, peer);

		// Add local tracks to the connection
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => {
				connection.addTrack(track, this.localStream!);
			});
		}

		// Handle incoming remote tracks
		connection.ontrack = (event) => {
			console.log(`[WebRTC] Received track from ${userId}`);
			event.streams[0].getTracks().forEach((track) => {
				remoteStream.addTrack(track);
			});
			peer.audioTrack = event.streams[0].getAudioTracks()[0] ?? null;
			this.emit('peer-track', { userId, track: peer.audioTrack!, stream: remoteStream });
		};

		// Send ICE candidates to the remote peer
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				this.signalingClient.sendIceCandidate(
					userId,
					event.candidate.candidate,
					event.candidate.sdpMid,
					event.candidate.sdpMLineIndex
				);
			}
		};

		// Monitor connection state for reconnection
		connection.onconnectionstatechange = () => {
			const state = connection.connectionState;
			console.log(`[WebRTC] Connection state with ${userId}: ${state}`);
			this.emit('connection-state-changed', { userId, state });

			if (state === 'connected') {
				// Reset reconnect counter on successful connection
				this.peerReconnectAttempts.delete(userId);
			} else if (state === 'failed') {
				this.attemptPeerReconnect(userId);
			} else if (state === 'disconnected') {
				// Give it a moment before attempting reconnect (may recover on its own)
				const timer = setTimeout(() => {
					if (this.peers.get(userId)?.connection.connectionState === 'disconnected') {
						this.attemptPeerReconnect(userId);
					}
				}, PEER_RECONNECT_DELAY);
				this.peerReconnectTimers.set(userId, timer);
			}
		};

		connection.oniceconnectionstatechange = () => {
			console.log(`[WebRTC] ICE state with ${userId}: ${connection.iceConnectionState}`);
		};

		if (initiateOffer) {
			this.createAndSendOffer(userId, connection);
		}

		this.emit('peer-connected', { userId });
		return peer;
	}

	/**
	 * Attempt to reconnect to a peer with retry limits.
	 */
	private attemptPeerReconnect(userId: string) {
		const attempts = this.peerReconnectAttempts.get(userId) ?? 0;

		if (attempts >= MAX_PEER_RECONNECT_ATTEMPTS) {
			console.warn(`[WebRTC] Max reconnect attempts for ${userId}, giving up`);
			this.closePeer(userId);
			this.emit('error', { userId, error: new Error('Peer reconnection failed') });
			return;
		}

		this.peerReconnectAttempts.set(userId, attempts + 1);
		console.log(`[WebRTC] Reconnecting to ${userId} (attempt ${attempts + 1})`);

		// Close old connection and create a new one as initiator
		this.closePeerInternal(userId);
		this.createPeer(userId, true);
	}

	private async createAndSendOffer(userId: string, connection: RTCPeerConnection) {
		try {
			const offer = await connection.createOffer();
			await connection.setLocalDescription(offer);

			this.signalingClient.sendOffer(userId, offer.sdp!);
		} catch (error) {
			console.error(`[WebRTC] Failed to create offer for ${userId}:`, error);
			this.emit('error', {
				userId,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	private async handleOffer(fromUserId: string, sdp: string) {
		console.log(`[WebRTC] Received offer from ${fromUserId}`);

		// Create peer connection if it doesn't exist
		if (!this.peers.has(fromUserId)) {
			this.createPeer(fromUserId, false);
		}

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'offer', sdp });
			const answer = await peer.connection.createAnswer();
			await peer.connection.setLocalDescription(answer);

			this.signalingClient.sendAnswer(fromUserId, answer.sdp!);
		} catch (error) {
			console.error(`[WebRTC] Failed to handle offer from ${fromUserId}:`, error);
			this.emit('error', {
				userId: fromUserId,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	private async handleAnswer(fromUserId: string, sdp: string) {
		console.log(`[WebRTC] Received answer from ${fromUserId}`);

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'answer', sdp });
		} catch (error) {
			console.error(`[WebRTC] Failed to handle answer from ${fromUserId}:`, error);
		}
	}

	private async handleIceCandidate(
		fromUserId: string,
		candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
	) {
		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.addIceCandidate(
				new RTCIceCandidate({
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid ?? undefined,
					sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
				})
			);
		} catch (error) {
			console.error(`[WebRTC] Failed to add ICE candidate from ${fromUserId}:`, error);
		}
	}

	/**
	 * Close a peer connection and emit disconnection event.
	 */
	closePeer(userId: string) {
		this.closePeerInternal(userId);
		this.emit('peer-disconnected', { userId });
	}

	private closePeerInternal(userId: string) {
		const peer = this.peers.get(userId);
		if (!peer) return;

		console.log(`[WebRTC] Closing peer connection to ${userId}`);
		peer.connection.close();
		this.peers.delete(userId);

		// Clear reconnect timer
		const timer = this.peerReconnectTimers.get(userId);
		if (timer) {
			clearTimeout(timer);
			this.peerReconnectTimers.delete(userId);
		}
	}

	/**
	 * Get a peer by user ID.
	 */
	getPeer(userId: string): Peer | undefined {
		return this.peers.get(userId);
	}

	/**
	 * Get all connected peers.
	 */
	getAllPeers(): Map<string, Peer> {
		return this.peers;
	}

	/**
	 * Set the mute state of the local stream.
	 */
	setMuted(muted: boolean) {
		if (this.localStream) {
			this.localStream.getAudioTracks().forEach((track) => {
				track.enabled = !muted;
			});
		}
	}

	/**
	 * Subscribe to a WebRTC event.
	 */
	on<K extends keyof WebRTCEvents>(event: K, callback: EventCallback<WebRTCEvents[K]>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const typedCb = callback as EventCallback<unknown>;
		this.listeners.get(event)!.add(typedCb);
		return () => {
			this.listeners.get(event)?.delete(typedCb);
		};
	}

	private emit<K extends keyof WebRTCEvents>(event: K, data: WebRTCEvents[K]) {
		const handlers = this.listeners.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(data);
				} catch (err) {
					console.error(`[WebRTC] Error in ${event} handler:`, err);
				}
			}
		}
	}

	/**
	 * Close all peer connections and release local media.
	 */
	disconnectAll() {
		for (const [userId] of this.peers) {
			this.closePeerInternal(userId);
		}
		this.peers.clear();
		this.peerReconnectAttempts.clear();

		for (const timer of this.peerReconnectTimers.values()) {
			clearTimeout(timer);
		}
		this.peerReconnectTimers.clear();

		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => track.stop());
			this.localStream = null;
		}
	}

	/**
	 * Destroy the manager, cleaning up all resources.
	 */
	destroy() {
		this.disconnectAll();
		this.signalingCleanups.forEach((fn) => fn());
		this.signalingCleanups = [];
		this.listeners.clear();
	}
}
