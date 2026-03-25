import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceConnectionManager } from '../VoiceConnectionManager';
import { WebRTCConnectionManager } from '../WebRTCConnectionManager';

// Mock dependencies
vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('svelte/store', () => ({
	get: vi.fn()
}));

vi.mock('$lib/stores/gateway', () => ({
	gateway: { send: vi.fn() },
	Op: { DISPATCH: 0 },
	onGatewayEvent: vi.fn()
}));

vi.mock('$lib/stores/voice', () => ({
	voiceState: {
		update: vi.fn(),
		reset: vi.fn()
	},
	voiceActions: {
		setConnected: vi.fn(),
		setError: vi.fn()
	}
}));

vi.mock('$lib/stores/auth', () => ({
	user: { subscribe: vi.fn() }
}));

vi.mock('../WebRTCConnectionManager');

// Mock AudioContext
class MockAudioContext {
	createMediaStreamSource = vi.fn().mockReturnValue({
		connect: vi.fn()
	});
	createAnalyser = vi.fn().mockReturnValue({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn()
	});
	close = vi.fn();
}

const originalAudioContext = global.AudioContext;
beforeEach(() => {
	global.AudioContext = MockAudioContext as any;
});

afterEach(() => {
	global.AudioContext = originalAudioContext;
	vi.clearAllMocks();
});

describe('VoiceConnectionManager', () => {
	let manager: VoiceConnectionManager;
	let mockWebRTCManager: any;

	beforeEach(() => {
		// Mock the get function to return mock user data
		const { get } = require('svelte/store');
		get.mockImplementation((store) => {
			if (store === require('$lib/stores/voice').voiceState) {
				return { channelId: 'test-channel', selfMuted: false, selfDeafened: false };
			}
			if (store === require('$lib/stores/auth').user) {
				return { id: 'user1', name: 'Test User' };
			}
			return {};
		});

		// Mock onGatewayEvent to return cleanup functions
		const { onGatewayEvent } = require('$lib/stores/gateway');
		onGatewayEvent.mockImplementation((event: string, handler: Function) => {
			return () => {}; // Return cleanup function
		});

		// Create mock WebRTC manager
		mockWebRTCManager = {
			acquireLocalStream: vi.fn().mockResolvedValue({
				getAudioTracks: () => [{ enabled: true }]
			}),
			getLocalStream: vi.fn().mockReturnValue({
				getAudioTracks: () => [{ enabled: true }]
			}),
			getPeers: vi.fn().mockReturnValue(new Map()),
			getPeer: vi.fn(),
			setMuted: vi.fn(),
			disconnect: vi.fn(),
			destroy: vi.fn(),
			on: vi.fn().mockReturnValue(() => {}),
			handleSignalingMessage: vi.fn()
		};

		// Mock WebRTCConnectionManager constructor
		(WebRTCConnectionManager as any).mockImplementation(() => mockWebRTCManager);

		manager = new VoiceConnectionManager();
	});

	afterEach(() => {
		manager?.destroy();
	});

	describe('Construction', () => {
		it('should create WebRTCConnectionManager instance', () => {
			expect(WebRTCConnectionManager).toHaveBeenCalled();
		});

		it('should set up gateway listeners', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');

			// Should have registered multiple gateway events
			expect(onGatewayEvent).toHaveBeenCalledWith('VOICE_OFFER', expect.any(Function));
			expect(onGatewayEvent).toHaveBeenCalledWith('VOICE_ANSWER', expect.any(Function));
			expect(onGatewayEvent).toHaveBeenCalledWith('VOICE_ICE_CANDIDATE', expect.any(Function));
			expect(onGatewayEvent).toHaveBeenCalledWith('VOICE_SERVER_UPDATE', expect.any(Function));
			expect(onGatewayEvent).toHaveBeenCalledWith('VOICE_STATE_UPDATE', expect.any(Function));
		});

		it('should set up WebRTC listeners', () => {
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('remote-stream', expect.any(Function));
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('peer-disconnected', expect.any(Function));
			expect(mockWebRTCManager.on).toHaveBeenCalledWith('error', expect.any(Function));
		});
	});

	describe('Connection Management', () => {
		it('should connect successfully', async () => {
			const { voiceActions } = require('$lib/stores/voice');

			await manager.connect('test-channel', 'test-server');

			expect(mockWebRTCManager.acquireLocalStream).toHaveBeenCalled();
			expect(voiceActions.setConnected).toHaveBeenCalled();
		});

		it('should handle connection errors', async () => {
			const { voiceActions } = require('$lib/stores/voice');
			const error = new Error('Connection failed');
			mockWebRTCManager.acquireLocalStream.mockRejectedValueOnce(error);

			await expect(manager.connect('test-channel', 'test-server')).rejects.toThrow('Connection failed');
			expect(voiceActions.setError).toHaveBeenCalledWith('Connection failed');
		});

		it('should set up speaking detection after connection', async () => {
			await manager.connect('test-channel', 'test-server');

			expect(MockAudioContext.prototype.createMediaStreamSource).toHaveBeenCalled();
			expect(MockAudioContext.prototype.createAnalyser).toHaveBeenCalled();
		});

		it('should apply mute state to local stream', async () => {
			const { get } = require('svelte/store');
			get.mockImplementation((store) => {
				if (store === require('$lib/stores/voice').voiceState) {
					return { channelId: 'test-channel', selfMuted: true, selfDeafened: false };
				}
				if (store === require('$lib/stores/auth').user) {
					return { id: 'user1', name: 'Test User' };
				}
				return {};
			});

			const mockTrack = { enabled: true };
			mockWebRTCManager.getLocalStream.mockReturnValue({
				getAudioTracks: () => [mockTrack]
			});

			await manager.connect('test-channel', 'test-server');

			expect(mockTrack.enabled).toBe(false);
		});
	});

	describe('Gateway Message Handling', () => {
		beforeEach(async () => {
			await manager.connect('test-channel', 'test-server');
		});

		it('should handle VOICE_OFFER messages', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const offerHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_OFFER')[1];

			const offerData = {
				from_user_id: 'user2',
				sdp: 'test-sdp',
				channel_id: 'test-channel'
			};

			offerHandler(offerData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'offer',
				fromUserId: 'user2',
				channelId: 'test-channel',
				sdp: 'test-sdp'
			});
		});

		it('should handle VOICE_ANSWER messages', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const answerHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_ANSWER')[1];

			const answerData = {
				from_user_id: 'user2',
				sdp: 'test-sdp',
				channel_id: 'test-channel'
			};

			answerHandler(answerData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'answer',
				fromUserId: 'user2',
				channelId: 'test-channel',
				sdp: 'test-sdp'
			});
		});

		it('should handle VOICE_ICE_CANDIDATE messages', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const candidateHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_ICE_CANDIDATE')[1];

			const candidateData = {
				from_user_id: 'user2',
				candidate: 'test-candidate',
				sdpMid: '0',
				sdpMLineIndex: 0,
				channel_id: 'test-channel'
			};

			candidateHandler(candidateData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'ice-candidate',
				fromUserId: 'user2',
				channelId: 'test-channel',
				candidate: 'test-candidate',
				sdpMid: '0',
				sdpMLineIndex: 0
			});
		});

		it('should handle VOICE_SERVER_UPDATE messages', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const updateHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_SERVER_UPDATE')[1];

			mockWebRTCManager.getPeer.mockReturnValue(undefined); // No existing peer

			const updateData = {
				channel_id: 'test-channel',
				server_id: 'test-server',
				peers: [{ user_id: 'user2' }]
			};

			updateHandler(updateData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'join',
				fromUserId: 'user2',
				channelId: 'test-channel'
			});
		});

		it('should handle VOICE_STATE_UPDATE messages for joining', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const stateHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_STATE_UPDATE')[1];

			const stateData = {
				user_id: 'user2',
				channel_id: 'test-channel'
			};

			stateHandler(stateData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'join',
				fromUserId: 'user2',
				channelId: 'test-channel'
			});
		});

		it('should handle VOICE_STATE_UPDATE messages for leaving', () => {
			const { onGatewayEvent } = require('$lib/stores/gateway');
			const stateHandler = onGatewayEvent.mock.calls.find(call => call[0] === 'VOICE_STATE_UPDATE')[1];

			const stateData = {
				user_id: 'user2',
				channel_id: null // User left
			};

			stateHandler(stateData);

			expect(mockWebRTCManager.handleSignalingMessage).toHaveBeenCalledWith({
				type: 'leave',
				fromUserId: 'user2',
				channelId: 'test-channel'
			});
		});
	});

	describe('Speaking Detection', () => {
		beforeEach(async () => {
			await manager.connect('test-channel', 'test-server');
		});

		it('should send speaking state changes', () => {
			const { gateway, Op } = require('$lib/stores/gateway');

			// Manually trigger speaking state change
			(manager as any).sendSpeakingState(true);

			expect(gateway.send).toHaveBeenCalledWith({
				op: Op.DISPATCH,
				d: {
					t: 'VOICE_SPEAKING',
					d: {
						channel_id: 'test-channel',
						speaking: true
					}
				}
			});
		});

		it('should not send speaking state without channel', () => {
			const { get } = require('svelte/store');
			get.mockImplementation(() => ({ channelId: null }));

			const { gateway } = require('$lib/stores/gateway');

			(manager as any).sendSpeakingState(true);

			expect(gateway.send).not.toHaveBeenCalled();
		});
	});

	describe('Audio Controls', () => {
		beforeEach(async () => {
			await manager.connect('test-channel', 'test-server');
		});

		it('should set muted state', () => {
			manager.setMuted(true);
			expect(mockWebRTCManager.setMuted).toHaveBeenCalledWith(true);
		});

		it('should set deafened state for remote audio', () => {
			// Mock DOM with audio elements
			const audioElement = {
				id: 'voice-audio-user2',
				muted: false
			};

			document.getElementById = vi.fn().mockReturnValue(audioElement);
			mockWebRTCManager.getPeers.mockReturnValue(new Map([['user2', {}]]));

			manager.setDeafened(true);

			expect(audioElement.muted).toBe(true);
		});
	});

	describe('Remote Audio Handling', () => {
		beforeEach(async () => {
			await manager.connect('test-channel', 'test-server');
		});

		it('should play remote audio streams', () => {
			// Mock DOM methods
			const mockAudioElement = {
				srcObject: null,
				autoplay: false,
				id: '',
				muted: false,
				style: { display: '' }
			};

			document.createElement = vi.fn().mockReturnValue(mockAudioElement);
			document.body.appendChild = vi.fn();
			document.getElementById = vi.fn().mockReturnValue(null);

			const mockStream = { id: 'mock-stream' } as MediaStream;

			// Simulate remote stream event
			const remoteStreamHandler = mockWebRTCManager.on.mock.calls.find(
				call => call[0] === 'remote-stream'
			)[1];

			remoteStreamHandler('user2', mockStream);

			expect(document.createElement).toHaveBeenCalledWith('audio');
			expect(mockAudioElement.srcObject).toBe(mockStream);
			expect(mockAudioElement.autoplay).toBe(true);
			expect(mockAudioElement.id).toBe('voice-audio-user2');
			expect(document.body.appendChild).toHaveBeenCalledWith(mockAudioElement);
		});

		it('should remove existing audio element before adding new one', () => {
			const existingElement = { remove: vi.fn() };
			document.getElementById = vi.fn().mockReturnValue(existingElement);
			document.createElement = vi.fn().mockReturnValue({
				srcObject: null,
				autoplay: false,
				id: '',
				muted: false,
				style: { display: '' }
			});
			document.body.appendChild = vi.fn();

			const mockStream = { id: 'mock-stream' } as MediaStream;

			const remoteStreamHandler = mockWebRTCManager.on.mock.calls.find(
				call => call[0] === 'remote-stream'
			)[1];

			remoteStreamHandler('user2', mockStream);

			expect(existingElement.remove).toHaveBeenCalled();
		});
	});

	describe('Disconnect and Cleanup', () => {
		beforeEach(async () => {
			await manager.connect('test-channel', 'test-server');
		});

		it('should disconnect and clean up resources', () => {
			// Mock DOM cleanup
			const mockElements = [{ remove: vi.fn() }, { remove: vi.fn() }];
			document.querySelectorAll = vi.fn().mockReturnValue({
				forEach: (callback: Function) => mockElements.forEach(callback)
			});

			manager.disconnect();

			expect(mockWebRTCManager.disconnect).toHaveBeenCalled();
			mockElements.forEach(el => expect(el.remove).toHaveBeenCalled());
		});

		it('should destroy and clean up all listeners', () => {
			manager.destroy();

			expect(mockWebRTCManager.destroy).toHaveBeenCalled();
		});
	});

	describe('WebRTC Manager Access', () => {
		it('should provide access to WebRTC manager', () => {
			const webrtcManager = manager.getWebRTCManager();
			expect(webrtcManager).toBe(mockWebRTCManager);
		});
	});
});