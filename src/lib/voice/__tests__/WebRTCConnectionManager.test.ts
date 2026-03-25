import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebRTCConnectionManager } from '../WebRTCConnectionManager';
import type { AnySignalingMessage } from '../types';

// Mock RTCIceCandidate
class MockRTCIceCandidate {
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;

	constructor(init: RTCIceCandidateInit) {
		this.candidate = init.candidate || '';
		this.sdpMid = init.sdpMid || null;
		this.sdpMLineIndex = init.sdpMLineIndex || null;
	}
}

// Mock RTCPeerConnection
class MockRTCPeerConnection {
	static connectionState: RTCPeerConnectionState = 'new';
	static iceConnectionState: RTCIceConnectionState = 'new';

	connectionState: RTCPeerConnectionState = 'new';
	iceConnectionState: RTCIceConnectionState = 'new';
	localDescription: RTCSessionDescription | null = null;
	remoteDescription: RTCSessionDescription | null = null;

	ontrack: ((event: RTCTrackEvent) => void) | null = null;
	onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
	onconnectionstatechange: (() => void) | null = null;
	oniceconnectionstatechange: (() => void) | null = null;

	constructor(public config?: RTCConfiguration) {}

	addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
		return {} as RTCRtpSender;
	}

	async createOffer(): Promise<RTCSessionDescriptionInit> {
		return { type: 'offer', sdp: 'mock-offer-sdp' };
	}

	async createAnswer(): Promise<RTCSessionDescriptionInit> {
		return { type: 'answer', sdp: 'mock-answer-sdp' };
	}

	async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
		this.localDescription = description as RTCSessionDescription;
	}

	async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
		this.remoteDescription = description as RTCSessionDescription;
	}

	async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
		// Mock successful ICE candidate addition
	}

	close(): void {
		this.connectionState = 'closed';
	}

	// Helper method to simulate state changes
	simulateConnectionStateChange(newState: RTCPeerConnectionState) {
		this.connectionState = newState;
		this.onconnectionstatechange?.();
	}

	simulateIceCandidate(candidate: string) {
		const event = {
			candidate: {
				candidate,
				sdpMid: '0',
				sdpMLineIndex: 0
			}
		} as RTCPeerConnectionIceEvent;
		this.onicecandidate?.(event);
	}

	simulateTrack(stream: MediaStream) {
		const track = stream.getAudioTracks()[0];
		const event = {
			track,
			streams: [stream]
		} as RTCTrackEvent;
		this.ontrack?.(event);
	}
}

// Mock MediaStream
class MockMediaStream {
	id = 'mock-stream-id';
	private tracks: MediaStreamTrack[] = [];

	constructor(tracks?: MediaStreamTrack[]) {
		if (tracks) {
			this.tracks = [...tracks];
		}
	}

	getTracks(): MediaStreamTrack[] {
		return [...this.tracks];
	}

	getAudioTracks(): MediaStreamTrack[] {
		return this.tracks.filter(track => track.kind === 'audio');
	}

	getVideoTracks(): MediaStreamTrack[] {
		return this.tracks.filter(track => track.kind === 'video');
	}

	addTrack(track: MediaStreamTrack): void {
		this.tracks.push(track);
	}
}

// Mock MediaStreamTrack
class MockMediaStreamTrack {
	enabled = true;
	kind = 'audio';
	id = 'mock-track-id';

	stop(): void {
		// Mock stop
	}
}

// Mock getUserMedia
const mockGetUserMedia = vi.fn().mockResolvedValue(
	new MockMediaStream([new MockMediaStreamTrack()] as any)
);

// Setup global mocks
const originalRTCPeerConnection = global.RTCPeerConnection;
const originalRTCIceCandidate = global.RTCIceCandidate;
const originalMediaStream = global.MediaStream;
const originalNavigator = global.navigator;

beforeEach(() => {
	global.RTCPeerConnection = MockRTCPeerConnection as any;
	global.RTCIceCandidate = MockRTCIceCandidate as any;
	global.MediaStream = MockMediaStream as any;
	global.navigator = {
		...originalNavigator,
		mediaDevices: {
			getUserMedia: mockGetUserMedia
		}
	} as any;
});

afterEach(() => {
	global.RTCPeerConnection = originalRTCPeerConnection;
	global.RTCIceCandidate = originalRTCIceCandidate;
	global.MediaStream = originalMediaStream;
	global.navigator = originalNavigator;
	vi.clearAllMocks();
});

describe('WebRTCConnectionManager', () => {
	let manager: WebRTCConnectionManager;

	beforeEach(() => {
		manager = new WebRTCConnectionManager({
			iceServers: [{ urls: 'stun:stun.example.com' }],
			maxReconnectAttempts: 2,
			reconnectDelay: 100,
		});
	});

	afterEach(() => {
		manager.destroy();
	});

	describe('Construction', () => {
		it('should initialize with default config', () => {
			const defaultManager = new WebRTCConnectionManager();
			expect(defaultManager.getPeers().size).toBe(0);
			expect(defaultManager.getLocalStream()).toBeNull();
			defaultManager.destroy();
		});

		it('should initialize with custom config', () => {
			expect(manager.getPeers().size).toBe(0);
			expect(manager.getLocalStream()).toBeNull();
		});
	});

	describe('Local Stream Management', () => {
		it('should acquire local stream', async () => {
			const stream = await manager.acquireLocalStream();

			expect(stream).toBeInstanceOf(MockMediaStream);
			expect(manager.getLocalStream()).toBe(stream);
			expect(mockGetUserMedia).toHaveBeenCalledWith({
				audio: expect.objectContaining({
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				}),
				video: false,
			});
		});

		it('should return existing stream if already acquired', async () => {
			const stream1 = await manager.acquireLocalStream();
			const stream2 = await manager.acquireLocalStream();

			expect(stream1).toBe(stream2);
			expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
		});

		it('should emit local-stream-ready event', async () => {
			const eventPromise = new Promise<MediaStream>(resolve => {
				manager.on('local-stream-ready', resolve);
			});

			const stream = await manager.acquireLocalStream();
			const emittedStream = await eventPromise;

			expect(emittedStream).toBe(stream);
		});

		it('should handle getUserMedia failure', async () => {
			const error = new Error('Permission denied');
			mockGetUserMedia.mockRejectedValueOnce(error);

			await expect(manager.acquireLocalStream()).rejects.toThrow('Permission denied');
		});
	});

	describe('Peer Connection Management', () => {
		beforeEach(async () => {
			await manager.acquireLocalStream();
		});

		it('should handle join signaling message', () => {
			const message: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};

			const peerConnectedPromise = new Promise<string>(resolve => {
				manager.on('peer-connected', resolve);
			});

			// Use private method for testing
			(manager as any).handleSignalingMessage(message);

			const peer = manager.getPeer('user1');
			expect(peer).toBeDefined();
			expect(peer!.userId).toBe('user1');
		});

		it('should handle leave signaling message', async () => {
			// First create a peer
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const peerDisconnectedPromise = new Promise<string>(resolve => {
				manager.on('peer-disconnected', resolve);
			});

			// Then remove the peer
			const leaveMessage: AnySignalingMessage = {
				type: 'leave',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(leaveMessage);

			const disconnectedUserId = await peerDisconnectedPromise;
			expect(disconnectedUserId).toBe('user1');
			expect(manager.getPeer('user1')).toBeUndefined();
		});

		it('should handle offer signaling message', async () => {
			const offerMessage: AnySignalingMessage = {
				type: 'offer',
				fromUserId: 'user1',
				channelId: 'test-channel',
				sdp: 'test-offer-sdp'
			};

			(manager as any).handleSignalingMessage(offerMessage);

			// Should create peer connection and set remote description
			const peer = manager.getPeer('user1');
			expect(peer).toBeDefined();
			expect(peer!.connection.remoteDescription?.sdp).toBe('test-offer-sdp');
		});

		it('should handle answer signaling message', async () => {
			// First create peer connection with join
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			// Then handle answer
			const answerMessage: AnySignalingMessage = {
				type: 'answer',
				fromUserId: 'user1',
				channelId: 'test-channel',
				sdp: 'test-answer-sdp'
			};

			(manager as any).handleSignalingMessage(answerMessage);

			const peer = manager.getPeer('user1');
			expect(peer!.connection.remoteDescription?.sdp).toBe('test-answer-sdp');
		});

		it('should handle ICE candidate signaling message', async () => {
			// First create peer connection
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const peer = manager.getPeer('user1')!;
			const addIceCandidateSpy = vi.spyOn(peer.connection, 'addIceCandidate');

			const iceCandidateMessage: AnySignalingMessage = {
				type: 'ice-candidate',
				fromUserId: 'user1',
				channelId: 'test-channel',
				candidate: 'test-candidate',
				sdpMid: '0',
				sdpMLineIndex: 0
			};

			(manager as any).handleSignalingMessage(iceCandidateMessage);

			expect(addIceCandidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					candidate: 'test-candidate',
					sdpMid: '0',
					sdpMLineIndex: 0
				})
			);
		});
	});

	describe('Connection State Management', () => {
		beforeEach(async () => {
			await manager.acquireLocalStream();
		});

		it('should handle connection state changes', async () => {
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const stateChangePromise = new Promise<[RTCPeerConnectionState, string]>(resolve => {
				manager.on('connection-state-changed', (state, userId) => resolve([state, userId]));
			});

			const peer = manager.getPeer('user1')!;
			(peer.connection as MockRTCPeerConnection).simulateConnectionStateChange('connected');

			const [state, userId] = await stateChangePromise;
			expect(state).toBe('connected');
			expect(userId).toBe('user1');
		});

		it('should handle connection failure with reconnection', async () => {
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const peer = manager.getPeer('user1')!;

			// Simulate connection failure
			(peer.connection as MockRTCPeerConnection).simulateConnectionStateChange('failed');

			// Should attempt reconnection
			await new Promise(resolve => setTimeout(resolve, 150));

			// Should still have the peer (reconnection attempt)
			expect(manager.getPeer('user1')).toBeDefined();
		});

		it('should give up after max reconnection attempts', async () => {
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const peerDisconnectedPromise = new Promise<string>(resolve => {
				manager.on('peer-disconnected', resolve);
			});

			// Simulate multiple failures
			for (let i = 0; i < 3; i++) {
				const peer = manager.getPeer('user1');
				if (peer) {
					(peer.connection as MockRTCPeerConnection).simulateConnectionStateChange('failed');
					await new Promise(resolve => setTimeout(resolve, 150));
				}
			}

			const disconnectedUserId = await peerDisconnectedPromise;
			expect(disconnectedUserId).toBe('user1');
			expect(manager.getPeer('user1')).toBeUndefined();
		});
	});

	describe('Audio Controls', () => {
		beforeEach(async () => {
			await manager.acquireLocalStream();
		});

		it('should mute/unmute local audio', () => {
			const stream = manager.getLocalStream()!;
			const audioTrack = stream.getAudioTracks()[0];

			manager.setMuted(true);
			expect(audioTrack.enabled).toBe(false);

			manager.setMuted(false);
			expect(audioTrack.enabled).toBe(true);
		});
	});

	describe('Event System', () => {
		it('should register and unregister event listeners', () => {
			const listener = vi.fn();
			const unsubscribe = manager.on('peer-connected', listener);

			expect(typeof unsubscribe).toBe('function');

			unsubscribe();
			// Event should not be called after unsubscription
		});
	});

	describe('Cleanup', () => {
		it('should disconnect and clean up all resources', async () => {
			await manager.acquireLocalStream();

			// Create some peers
			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			manager.disconnect();

			expect(manager.getPeers().size).toBe(0);
			expect(manager.getLocalStream()).toBeNull();
		});

		it('should destroy properly', async () => {
			await manager.acquireLocalStream();

			manager.destroy();

			expect(manager.getPeers().size).toBe(0);
			expect(manager.getLocalStream()).toBeNull();
		});
	});

	describe('Signaling Integration', () => {
		it('should emit remote-stream event when receiving tracks', async () => {
			await manager.acquireLocalStream();

			const joinMessage: AnySignalingMessage = {
				type: 'join',
				fromUserId: 'user1',
				channelId: 'test-channel'
			};
			(manager as any).handleSignalingMessage(joinMessage);

			const remoteStreamPromise = new Promise<[string, MediaStream]>(resolve => {
				manager.on('remote-stream', (userId, stream) => resolve([userId, stream]));
			});

			const peer = manager.getPeer('user1')!;
			const mockStream = new MockMediaStream([new MockMediaStreamTrack() as any]);
			(peer.connection as MockRTCPeerConnection).simulateTrack(mockStream as any);

			const [userId, stream] = await remoteStreamPromise;
			expect(userId).toBe('user1');
			expect(stream).toBeDefined();
		});
	});
});