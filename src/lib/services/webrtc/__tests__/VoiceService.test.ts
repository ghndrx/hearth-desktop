import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceService } from '../VoiceService';
import { SignalingService } from '../SignalingService';
import { MediaDeviceManager } from '../MediaDeviceManager';
import type { SignalingMessage } from '../types';

// Mock the dependencies
vi.mock('../SignalingService');
vi.mock('../MediaDeviceManager');

// Mock Web APIs
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
	createOffer: vi.fn().mockResolvedValue({ sdp: 'mock-offer-sdp' }),
	createAnswer: vi.fn().mockResolvedValue({ sdp: 'mock-answer-sdp' }),
	setLocalDescription: vi.fn(),
	setRemoteDescription: vi.fn(),
	addTrack: vi.fn(),
	addIceCandidate: vi.fn(),
	getSenders: vi.fn().mockReturnValue([]),
	close: vi.fn(),
	ontrack: null,
	onicecandidate: null,
	onconnectionstatechange: null,
	connectionState: 'new'
}));

global.MediaStream = vi.fn().mockImplementation(() => ({
	getTracks: vi.fn().mockReturnValue([]),
	getAudioTracks: vi.fn().mockReturnValue([]),
	addTrack: vi.fn()
}));

global.AudioContext = vi.fn().mockImplementation(() => ({
	createMediaStreamSource: vi.fn().mockReturnValue({}),
	createAnalyser: vi.fn().mockReturnValue({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn(),
		connect: vi.fn()
	}),
	close: vi.fn()
}));

const MockSignalingService = vi.mocked(SignalingService);
const MockMediaDeviceManager = vi.mocked(MediaDeviceManager);

describe('VoiceService', () => {
	let voiceService: VoiceService;
	let mockSignaling: any;
	let mockMedia: any;

	beforeEach(() => {
		// Create mock instances
		mockSignaling = {
			connect: vi.fn(),
			disconnect: vi.fn(),
			send: vi.fn(),
			on: vi.fn((event, callback) => () => {}), // Return cleanup function
			getState: vi.fn().mockReturnValue('connected'),
			destroy: vi.fn()
		};

		mockMedia = {
			acquireStream: vi.fn().mockResolvedValue(new MediaStream()),
			releaseStream: vi.fn(),
			setMuted: vi.fn(),
			getLocalStream: vi.fn().mockReturnValue(new MediaStream()),
			destroy: vi.fn()
		};

		MockSignalingService.mockImplementation(() => mockSignaling);
		MockMediaDeviceManager.mockImplementation(() => mockMedia);

		voiceService = new VoiceService();
	});

	afterEach(() => {
		voiceService.destroy();
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should create SignalingService and MediaDeviceManager', () => {
			expect(MockSignalingService).toHaveBeenCalled();
			expect(MockMediaDeviceManager).toHaveBeenCalled();
		});

		it('should accept custom configuration', () => {
			const config = {
				maxReconnectAttempts: 10,
				reconnectDelayMs: 5000,
				audioBitrate: 128000
			};

			const service = new VoiceService(config);

			expect(MockSignalingService).toHaveBeenCalledWith({
				maxReconnectAttempts: 10,
				reconnectDelayMs: 5000
			});

			service.destroy();
		});
	});

	describe('joining channel', () => {
		it('should join voice channel successfully', async () => {
			const mockStream = new MediaStream();
			mockMedia.acquireStream.mockResolvedValue(mockStream);

			await voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser',
				'Test User'
			);

			// Should acquire media stream
			expect(mockMedia.acquireStream).toHaveBeenCalled();

			// Should connect to signaling
			expect(mockSignaling.connect).toHaveBeenCalledWith(
				'wss://signaling.example.com',
				'token123',
				'channel123'
			);

			// Should setup signaling listeners
			expect(mockSignaling.on).toHaveBeenCalledWith('message', expect.any(Function));
			expect(mockSignaling.on).toHaveBeenCalledWith('error', expect.any(Function));
		});

		it('should emit local-stream-ready event', async () => {
			const mockStream = new MediaStream();
			mockMedia.acquireStream.mockResolvedValue(mockStream);

			const streamCallback = vi.fn();
			voiceService.on('local-stream-ready', streamCallback);

			await voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser'
			);

			expect(streamCallback).toHaveBeenCalledWith(mockStream);
		});

		it('should handle media acquisition failure', async () => {
			mockMedia.acquireStream.mockRejectedValue(new Error('No microphone access'));

			await expect(voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser'
			)).rejects.toThrow('No microphone access');
		});
	});

	describe('signaling message handling', () => {
		beforeEach(async () => {
			mockMedia.acquireStream.mockResolvedValue(new MediaStream());
			await voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser'
			);
		});

		it('should handle peer join message', () => {
			const joinMessage: SignalingMessage = {
				type: 'join',
				fromUserId: 'peer123',
				channelId: 'channel123',
				timestamp: Date.now(),
				username: 'peer',
				displayName: 'Peer User'
			};

			const peerJoinedCallback = vi.fn();
			voiceService.on('peer-joined', peerJoinedCallback);

			// Get the message handler that was registered
			const messageHandler = mockSignaling.on.mock.calls.find(
				call => call[0] === 'message'
			)?.[1];

			if (messageHandler) {
				messageHandler(joinMessage);
			}

			expect(peerJoinedCallback).toHaveBeenCalledWith({
				userId: 'peer123',
				username: 'peer',
				displayName: 'Peer User',
				isMuted: false,
				isDeafened: false,
				isSpeaking: false,
				joinedAt: joinMessage.timestamp
			});
		});

		it('should handle offer message and create answer', async () => {
			const offerMessage: SignalingMessage = {
				type: 'offer',
				fromUserId: 'peer123',
				toUserId: 'user123',
				channelId: 'channel123',
				timestamp: Date.now(),
				sdp: 'mock-offer-sdp'
			};

			// Get the message handler
			const messageHandler = mockSignaling.on.mock.calls.find(
				call => call[0] === 'message'
			)?.[1];

			if (messageHandler) {
				messageHandler(offerMessage);
			}

			// Should create peer connection and send answer
			expect(mockSignaling.send).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'answer',
					fromUserId: 'user123',
					toUserId: 'peer123',
					sdp: 'mock-answer-sdp'
				})
			);
		});

		it('should ignore messages from self', () => {
			const selfMessage: SignalingMessage = {
				type: 'join',
				fromUserId: 'user123', // Same as local user
				channelId: 'channel123',
				timestamp: Date.now(),
				username: 'testuser'
			};

			const peerJoinedCallback = vi.fn();
			voiceService.on('peer-joined', peerJoinedCallback);

			const messageHandler = mockSignaling.on.mock.calls.find(
				call => call[0] === 'message'
			)?.[1];

			if (messageHandler) {
				messageHandler(selfMessage);
			}

			// Should not emit peer-joined for self
			expect(peerJoinedCallback).not.toHaveBeenCalled();
		});
	});

	describe('audio controls', () => {
		beforeEach(async () => {
			mockMedia.acquireStream.mockResolvedValue(new MediaStream());
			await voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser'
			);
		});

		it('should set muted state', () => {
			voiceService.setMuted(true);

			expect(mockMedia.setMuted).toHaveBeenCalledWith(true);
			expect(mockSignaling.send).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'mute-update',
					fromUserId: 'user123',
					isMuted: true,
					isDeafened: false
				})
			);
		});

		it('should replace audio track on all peer connections', async () => {
			// Create a mock peer
			const mockPeerConnection = new RTCPeerConnection();
			const mockSender = {
				track: { kind: 'audio' },
				replaceTrack: vi.fn()
			};
			mockPeerConnection.getSenders = vi.fn().mockReturnValue([mockSender]);

			// Manually add to peers map
			const peers = voiceService.getPeers();
			peers.set('peer123', {
				userId: 'peer123',
				connection: mockPeerConnection,
				remoteStream: new MediaStream(),
				audioTrack: null,
				state: 'connected',
				reconnectAttempts: 0
			});

			const mockNewTrack = { kind: 'audio' } as MediaStreamTrack;
			const mockNewStream = new MediaStream();
			mockNewStream.getAudioTracks = vi.fn().mockReturnValue([mockNewTrack]);

			await voiceService.replaceTrack(mockNewStream);

			expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockNewTrack);
		});
	});

	describe('leaving channel', () => {
		it('should clean up all resources when leaving', async () => {
			mockMedia.acquireStream.mockResolvedValue(new MediaStream());
			await voiceService.join(
				'wss://signaling.example.com',
				'token123',
				'channel123',
				'user123',
				'testuser'
			);

			// Mock document for audio element removal
			global.document = {
				querySelectorAll: vi.fn().mockReturnValue([
					{ remove: vi.fn() },
					{ remove: vi.fn() }
				])
			} as any;

			voiceService.leave();

			// Should send leave message
			expect(mockSignaling.send).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'leave',
					fromUserId: 'user123'
				})
			);

			// Should release media
			expect(mockMedia.releaseStream).toHaveBeenCalled();

			// Should disconnect signaling
			expect(mockSignaling.disconnect).toHaveBeenCalled();

			// Should remove audio elements
			expect(global.document.querySelectorAll).toHaveBeenCalledWith('[id^="voice-audio-"]');
		});
	});

	describe('event system', () => {
		it('should register and trigger event listeners', () => {
			const callback = vi.fn();
			const cleanup = voiceService.on('error', callback);

			// Manually trigger error event
			const errorEvent = new Error('Test error');
			(voiceService as any).emit('error', errorEvent);

			expect(callback).toHaveBeenCalledWith(errorEvent);

			// Cleanup should remove listener
			cleanup();
			(voiceService as any).emit('error', errorEvent);

			// Should not be called again
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('destroy', () => {
		it('should destroy all services and clean up', () => {
			voiceService.destroy();

			expect(mockMedia.destroy).toHaveBeenCalled();
			expect(mockSignaling.destroy).toHaveBeenCalled();
		});
	});
});