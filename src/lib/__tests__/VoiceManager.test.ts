import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { VoiceManager } from '../VoiceManager';
import { voiceState, voiceChannelStates } from '../stores/voice';
import { user } from '../stores/auth';
import type { VoiceService } from '../services/webrtc/VoiceService';

// Mock the browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock the VoiceService
vi.mock('../services/webrtc/VoiceService', () => {
	const mockVoiceService = {
		join: vi.fn(),
		leave: vi.fn(),
		setMuted: vi.fn(),
		setDeafened: vi.fn(),
		replaceTrack: vi.fn(),
		getMediaDeviceManager: vi.fn(() => ({
			switchInputDevice: vi.fn(),
			setOutputDevice: vi.fn(),
			refreshDevices: vi.fn(),
			getInputDevices: vi.fn(() => []),
			getOutputDevices: vi.fn(() => []),
			getSelectedOutputDeviceId: vi.fn(() => null)
		})),
		on: vi.fn((event, callback) => {
			// Store callbacks for manual triggering
			if (!mockVoiceService._callbacks) {
				mockVoiceService._callbacks = {};
			}
			if (!mockVoiceService._callbacks[event]) {
				mockVoiceService._callbacks[event] = [];
			}
			mockVoiceService._callbacks[event].push(callback);
			return () => {}; // cleanup function
		}),
		destroy: vi.fn(),
		_callbacks: {} as Record<string, Function[]>
	};

	return {
		VoiceService: vi.fn(() => mockVoiceService)
	};
});

// Mock the stores
vi.mock('../stores/voice', () => ({
	voiceState: {
		update: vi.fn(),
		subscribe: vi.fn()
	},
	voiceActions: {
		join: vi.fn(),
		leave: vi.fn(),
		setConnected: vi.fn(),
		setError: vi.fn(),
		toggleMute: vi.fn(),
		toggleDeafen: vi.fn()
	},
	voiceChannelStates: {
		addUser: vi.fn(),
		removeUser: vi.fn(),
		setSpeaking: vi.fn(),
		updateUser: vi.fn()
	}
}));

vi.mock('../stores/auth', () => ({
	user: {
		subscribe: vi.fn()
	}
}));

vi.mock('../stores/gateway', () => ({
	gateway: {
		on: vi.fn()
	}
}));

// Mock get function for stores
vi.mock('svelte/store', () => ({
	get: vi.fn()
}));

const getMock = vi.mocked(get);

describe('VoiceManager', () => {
	let voiceManager: VoiceManager;
	let mockUser: any;

	beforeEach(() => {
		voiceManager = new VoiceManager();
		mockUser = {
			id: 'user123',
			username: 'testuser',
			display_name: 'Test User'
		};

		// Setup default mock returns
		getMock.mockImplementation((store) => {
			if (store === user) return mockUser;
			if (store === voiceState) return {
				selfMuted: false,
				selfDeafened: false,
				isConnected: false
			};
			return {};
		});

		// Mock document.createElement
		global.document = {
			...global.document,
			createElement: vi.fn((tagName) => {
				if (tagName === 'audio') {
					return {
						id: '',
						autoplay: false,
						srcObject: null,
						volume: 1,
						muted: false,
						style: { display: '' },
						remove: vi.fn()
					};
				}
				return {};
			}),
			body: {
				appendChild: vi.fn()
			}
		} as any;
	});

	afterEach(() => {
		voiceManager.destroy();
		vi.clearAllMocks();
	});

	describe('joinChannel', () => {
		it('should successfully join a voice channel', async () => {
			const mockVoiceService = voiceManager.getVoiceService();

			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);

			// Should update voice actions
			expect(vi.mocked(voiceActions.join)).toHaveBeenCalledWith({
				id: 'channel123',
				name: 'Test Channel',
				serverId: 'server123',
				serverName: 'Test Server'
			});

			// Should set connected state
			expect(vi.mocked(voiceActions.setConnected)).toHaveBeenCalled();

			// Should have a voice service instance
			expect(voiceManager.getVoiceService()).toBeTruthy();
		});

		it('should handle join errors gracefully', async () => {
			// Mock VoiceService to throw an error
			const { VoiceService } = await import('../services/webrtc/VoiceService');
			const mockConstructor = vi.mocked(VoiceService);
			const mockInstance = mockConstructor.mock.results[0]?.value;
			if (mockInstance) {
				mockInstance.join.mockRejectedValue(new Error('Connection failed'));
			}

			await expect(voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			)).rejects.toThrow('Connection failed');

			// Should set error state
			expect(vi.mocked(voiceActions.setError)).toHaveBeenCalledWith('Failed to join voice channel: Error: Connection failed');
		});

		it('should require authenticated user', async () => {
			getMock.mockImplementation((store) => {
				if (store === user) return null;
				return {};
			});

			await expect(voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			)).rejects.toThrow('User not authenticated');
		});
	});

	describe('leaveChannel', () => {
		it('should leave voice channel and clean up resources', async () => {
			// First join a channel
			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);

			// Then leave
			await voiceManager.leaveChannel();

			// Should update voice actions
			expect(vi.mocked(voiceActions.leave)).toHaveBeenCalled();

			// Should no longer be in voice
			expect(voiceManager.isInVoice()).toBe(false);
		});
	});

	describe('audio controls', () => {
		beforeEach(async () => {
			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);
		});

		it('should toggle mute state', () => {
			voiceManager.toggleMute();

			expect(vi.mocked(voiceActions.toggleMute)).toHaveBeenCalled();

			const mockVoiceService = voiceManager.getVoiceService();
			expect(mockVoiceService?.setMuted).toHaveBeenCalled();
		});

		it('should toggle deafen state', () => {
			voiceManager.toggleDeafen();

			expect(vi.mocked(voiceActions.toggleDeafen)).toHaveBeenCalled();

			const mockVoiceService = voiceManager.getVoiceService();
			expect(mockVoiceService?.setMuted).toHaveBeenCalled();
			expect(mockVoiceService?.setDeafened).toHaveBeenCalled();
		});

		it('should set specific mute state', () => {
			voiceManager.setMuted(true);

			// Since current state is false, should toggle
			expect(vi.mocked(voiceActions.toggleMute)).toHaveBeenCalled();
		});

		it('should not toggle if state is already correct', () => {
			getMock.mockImplementation((store) => {
				if (store === user) return mockUser;
				if (store === voiceState) return {
					selfMuted: true, // Already muted
					selfDeafened: false,
					isConnected: true
				};
				return {};
			});

			voiceManager.setMuted(true);

			// Should not toggle since already muted
			expect(vi.mocked(voiceActions.toggleMute)).not.toHaveBeenCalled();
		});
	});

	describe('device management', () => {
		beforeEach(async () => {
			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);
		});

		it('should switch input device', async () => {
			const mockStream = new MediaStream();
			const mockVoiceService = voiceManager.getVoiceService();
			const mockMediaManager = mockVoiceService?.getMediaDeviceManager();

			if (mockMediaManager) {
				mockMediaManager.switchInputDevice.mockResolvedValue(mockStream);
			}

			await voiceManager.switchInputDevice('device123');

			expect(mockMediaManager?.switchInputDevice).toHaveBeenCalledWith('device123');
			expect(mockVoiceService?.replaceTrack).toHaveBeenCalledWith(mockStream);
		});

		it('should get audio devices', async () => {
			const devices = await voiceManager.getAudioDevices();

			expect(devices).toEqual({
				input: [],
				output: []
			});
		});
	});

	describe('event handling', () => {
		it('should handle peer joined event', async () => {
			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);

			const mockVoiceService = voiceManager.getVoiceService() as any;

			// Simulate peer joined event
			const mockUser = {
				userId: 'peer123',
				username: 'peer',
				displayName: 'Peer User',
				isMuted: false,
				isDeafened: false,
				isSpeaking: false
			};

			// Trigger the peer-joined callback
			if (mockVoiceService._callbacks['peer-joined']) {
				mockVoiceService._callbacks['peer-joined'].forEach((cb: Function) => cb(mockUser));
			}

			expect(vi.mocked(voiceChannelStates.addUser)).toHaveBeenCalledWith('channel123', {
				id: 'peer123',
				username: 'peer',
				display_name: 'Peer User',
				avatar: undefined,
				self_muted: false,
				self_deafened: false,
				self_video: false,
				self_stream: false,
				muted: false,
				deafened: false,
				speaking: false
			});
		});

		it('should handle remote stream event', async () => {
			await voiceManager.joinChannel(
				'channel123',
				'Test Channel',
				'server123',
				'Test Server',
				'wss://voice.example.com',
				'token123'
			);

			const mockVoiceService = voiceManager.getVoiceService() as any;
			const mockStream = new MediaStream();

			// Trigger the remote-stream callback
			if (mockVoiceService._callbacks['remote-stream']) {
				mockVoiceService._callbacks['remote-stream'].forEach((cb: Function) =>
					cb('peer123', mockStream)
				);
			}

			// Should create audio element
			expect(global.document.createElement).toHaveBeenCalledWith('audio');
			expect(global.document.body.appendChild).toHaveBeenCalled();
		});
	});
});