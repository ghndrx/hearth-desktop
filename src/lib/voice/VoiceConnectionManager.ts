import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { gateway, Op, onGatewayEvent } from '$lib/stores/gateway';
import { voiceState, voiceActions, voiceChannelStates, type VoiceUser } from '$lib/stores/voice';
import { user as authUser } from '$lib/stores/auth';

// ICE servers for STUN/TURN
const ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' },
	{ urls: 'stun:stun2.l.google.com:19302' },
];

interface PeerConnection {
	connection: RTCPeerConnection;
	audioTrack: MediaStreamTrack | null;
	remoteStream: MediaStream;
	userId: string;
}

class VoiceConnectionManager {
	private localStream: MediaStream | null = null;
	private peers: Map<string, PeerConnection> = new Map();
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private speakingCheckInterval: ReturnType<typeof setInterval> | null = null;
	private isSpeaking = false;
	private cleanupFunctions: Array<() => void> = [];

	constructor() {
		if (!browser) return;
		this.setupGatewayListeners();
	}

	private setupGatewayListeners() {
		// Listen for WebRTC signaling messages
		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_OFFER', (data: unknown) => {
				const offer = data as { from_user_id: string; sdp: string };
				this.handleOffer(offer.from_user_id, offer.sdp);
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_ANSWER', (data: unknown) => {
				const answer = data as { from_user_id: string; sdp: string };
				this.handleAnswer(answer.from_user_id, answer.sdp);
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_ICE_CANDIDATE', (data: unknown) => {
				const candidate = data as {
					from_user_id: string;
					candidate: string;
					sdpMid: string;
					sdpMLineIndex: number;
				};
				this.handleICECandidate(candidate.from_user_id, candidate);
			})
		);

		// Listen for voice state updates to know when to connect/disconnect peers
		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_SERVER_UPDATE', (data: unknown) => {
				const update = data as {
					channel_id: string;
					server_id: string;
					peers: Array<{ user_id: string }>;
				};
				this.handlePeerList(update.peers.map(p => p.user_id));
			})
		);

		this.cleanupFunctions.push(
			onGatewayEvent('VOICE_STATE_UPDATE', (data: unknown) => {
				const update = data as {
					user_id: string;
					channel_id: string | null;
				};

				const currentState = get(voiceState);
				if (update.channel_id === currentState.channelId && update.channel_id !== null) {
					// New peer joined our channel
					const currentUser = get(authUser);
					if (currentUser && update.user_id !== currentUser.id) {
						this.createPeerConnection(update.user_id, true);
					}
				} else if (update.channel_id === null) {
					// Peer left
					this.closePeerConnection(update.user_id);
				}
			})
		);
	}

	async connect(channelId: string, serverId: string): Promise<void> {
		if (!browser) return;

		try {
			// Request microphone access
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				},
				video: false
			});

			// Setup audio analysis for speaking detection
			this.setupSpeakingDetection();

			// Apply current mute state
			const state = get(voiceState);
			this.localStream.getAudioTracks().forEach(track => {
				track.enabled = !state.selfMuted;
			});

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
		if (!this.localStream) return;

		this.audioContext = new AudioContext();
		const source = this.audioContext.createMediaStreamSource(this.localStream);
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 256;

		source.connect(this.analyser);

		const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

		this.speakingCheckInterval = setInterval(() => {
			if (!this.analyser) return;

			this.analyser.getByteFrequencyData(dataArray);
			const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
			const speaking = average > 20; // Threshold for speaking detection

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

	private handlePeerList(peerUserIds: string[]) {
		const currentUser = get(authUser);
		if (!currentUser) return;

		// Create connections to all peers
		for (const userId of peerUserIds) {
			if (userId !== currentUser.id && !this.peers.has(userId)) {
				// We initiate the connection to existing peers
				this.createPeerConnection(userId, true);
			}
		}
	}

	private createPeerConnection(userId: string, createOffer: boolean) {
		if (this.peers.has(userId)) return;

		console.log(`[Voice] Creating peer connection to ${userId}, offer: ${createOffer}`);

		const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
		const remoteStream = new MediaStream();

		const peer: PeerConnection = {
			connection,
			audioTrack: null,
			remoteStream,
			userId
		};

		this.peers.set(userId, peer);

		// Add local tracks
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => {
				connection.addTrack(track, this.localStream!);
			});
		}

		// Handle incoming tracks
		connection.ontrack = (event) => {
			console.log(`[Voice] Received track from ${userId}`);
			event.streams[0].getTracks().forEach(track => {
				remoteStream.addTrack(track);
			});
			peer.audioTrack = event.streams[0].getAudioTracks()[0] || null;
			this.playRemoteAudio(userId, remoteStream);
		};

		// Handle ICE candidates
		connection.onicecandidate = (event) => {
			if (event.candidate) {
				gateway.send({
					op: Op.DISPATCH,
					d: {
						t: 'VOICE_ICE_CANDIDATE',
						d: {
							to_user_id: userId,
							candidate: event.candidate.candidate,
							sdpMid: event.candidate.sdpMid,
							sdpMLineIndex: event.candidate.sdpMLineIndex
						}
					}
				});
			}
		};

		// Handle connection state
		connection.onconnectionstatechange = () => {
			console.log(`[Voice] Connection state with ${userId}: ${connection.connectionState}`);
			if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
				this.closePeerConnection(userId);
			}
		};

		// Create offer if we're initiating
		if (createOffer) {
			this.createAndSendOffer(userId, connection);
		}
	}

	private async createAndSendOffer(userId: string, connection: RTCPeerConnection) {
		try {
			const offer = await connection.createOffer();
			await connection.setLocalDescription(offer);

			gateway.send({
				op: Op.DISPATCH,
				d: {
					t: 'VOICE_OFFER',
					d: {
						to_user_id: userId,
						sdp: offer.sdp
					}
				}
			});
		} catch (error) {
			console.error(`[Voice] Failed to create offer for ${userId}:`, error);
		}
	}

	private async handleOffer(fromUserId: string, sdp: string) {
		console.log(`[Voice] Received offer from ${fromUserId}`);

		// Create peer connection if it doesn't exist
		if (!this.peers.has(fromUserId)) {
			this.createPeerConnection(fromUserId, false);
		}

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'offer', sdp });
			const answer = await peer.connection.createAnswer();
			await peer.connection.setLocalDescription(answer);

			gateway.send({
				op: Op.DISPATCH,
				d: {
					t: 'VOICE_ANSWER',
					d: {
						to_user_id: fromUserId,
						sdp: answer.sdp
					}
				}
			});
		} catch (error) {
			console.error(`[Voice] Failed to handle offer from ${fromUserId}:`, error);
		}
	}

	private async handleAnswer(fromUserId: string, sdp: string) {
		console.log(`[Voice] Received answer from ${fromUserId}`);

		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.setRemoteDescription({ type: 'answer', sdp });
		} catch (error) {
			console.error(`[Voice] Failed to handle answer from ${fromUserId}:`, error);
		}
	}

	private async handleICECandidate(
		fromUserId: string,
		candidate: { candidate: string; sdpMid: string; sdpMLineIndex: number }
	) {
		const peer = this.peers.get(fromUserId);
		if (!peer) return;

		try {
			await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (error) {
			console.error(`[Voice] Failed to add ICE candidate from ${fromUserId}:`, error);
		}
	}

	private playRemoteAudio(userId: string, stream: MediaStream) {
		// Create audio element for remote stream
		const audio = document.createElement('audio');
		audio.srcObject = stream;
		audio.autoplay = true;
		audio.id = `voice-audio-${userId}`;

		// Apply deafen state
		const state = get(voiceState);
		audio.muted = state.selfDeafened;

		// Add to DOM (hidden)
		audio.style.display = 'none';
		document.body.appendChild(audio);

		console.log(`[Voice] Playing audio from ${userId}`);
	}

	private closePeerConnection(userId: string) {
		const peer = this.peers.get(userId);
		if (!peer) return;

		console.log(`[Voice] Closing peer connection to ${userId}`);

		peer.connection.close();
		this.peers.delete(userId);

		// Remove audio element
		const audio = document.getElementById(`voice-audio-${userId}`);
		if (audio) {
			audio.remove();
		}
	}

	disconnect() {
		console.log('[Voice] Disconnecting');

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

		// Close all peer connections
		for (const [userId] of this.peers) {
			this.closePeerConnection(userId);
		}

		// Stop local stream
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
		}

		// Clear speaking state
		this.isSpeaking = false;
	}

	setMuted(muted: boolean) {
		if (this.localStream) {
			this.localStream.getAudioTracks().forEach(track => {
				track.enabled = !muted;
			});
		}
	}

	setDeafened(deafened: boolean) {
		// Mute all remote audio elements
		for (const [userId] of this.peers) {
			const audio = document.getElementById(`voice-audio-${userId}`) as HTMLAudioElement;
			if (audio) {
				audio.muted = deafened;
			}
		}
	}

	destroy() {
		this.disconnect();
		this.cleanupFunctions.forEach(fn => fn());
		this.cleanupFunctions = [];
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
