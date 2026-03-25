import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceQualityManager } from '../VoiceQualityManager';
import type { AudioProcessingSettings, VoiceActivitySettings } from '../VoiceQualityManager';

// Mock AudioContext and related Web Audio API
class MockAudioContext {
	state = 'running';
	sampleRate = 48000;
	baseLatency = 0.01;

	resume = vi.fn().mockResolvedValue(undefined);
	close = vi.fn().mockResolvedValue(undefined);
	createMediaStreamSource = vi.fn().mockReturnValue({
		connect: vi.fn()
	});
	createAnalyser = vi.fn().mockReturnValue({
		fftSize: 256,
		frequencyBinCount: 128,
		getByteFrequencyData: vi.fn(),
		connect: vi.fn(),
		disconnect: vi.fn()
	});
	createGain = vi.fn().mockReturnValue({
		gain: { value: 1.0 },
		connect: vi.fn(),
		disconnect: vi.fn()
	});
	createDynamicsCompressor = vi.fn().mockReturnValue({
		threshold: { value: -24 },
		knee: { value: 30 },
		ratio: { value: 6 },
		attack: { value: 0.003 },
		release: { value: 0.25 },
		connect: vi.fn(),
		disconnect: vi.fn()
	});
	createBiquadFilter = vi.fn().mockReturnValue({
		type: 'highpass',
		frequency: { value: 85 },
		Q: { value: 0.7 },
		connect: vi.fn(),
		disconnect: vi.fn()
	});
	createMediaStreamDestination = vi.fn().mockReturnValue({
		stream: new MediaStream(),
		connect: vi.fn(),
		disconnect: vi.fn()
	});
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

	getTracks() {
		return [...this.tracks];
	}

	getAudioTracks() {
		return this.tracks.filter(track => track.kind === 'audio');
	}
}

// Mock MediaStreamTrack
class MockMediaStreamTrack {
	enabled = true;
	kind = 'audio';
	id = 'mock-track-id';

	stop() {}
}

// Mock browser environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Setup global mocks
const originalAudioContext = global.AudioContext;
const originalMediaStream = global.MediaStream;

beforeEach(() => {
	global.AudioContext = MockAudioContext as any;
	global.MediaStream = MockMediaStream as any;
	vi.useFakeTimers();
});

afterEach(() => {
	global.AudioContext = originalAudioContext;
	global.MediaStream = originalMediaStream;
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('VoiceQualityManager', () => {
	let voiceQuality: VoiceQualityManager;
	let mockStream: MediaStream;

	beforeEach(() => {
		voiceQuality = new VoiceQualityManager();
		mockStream = new MockMediaStream([new MockMediaStreamTrack() as any]) as any;
	});

	afterEach(() => {
		voiceQuality.destroy();
	});

	describe('Construction', () => {
		it('should initialize properly', () => {
			expect(voiceQuality).toBeDefined();
		});

		it('should have default audio settings', () => {
			const settings = voiceQuality.getAudioSettings();
			expect(settings).toEqual({
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				sampleRate: 48000,
				bitrate: 64000,
				voiceActivationThreshold: 0.01,
				compressionEnabled: true,
				highPassFilter: true,
				lowPassFilter: false
			});
		});

		it('should have default voice activity settings', () => {
			const settings = voiceQuality.getVoiceActivitySettings();
			expect(settings).toEqual({
				enabled: true,
				threshold: 0.01,
				hangTime: 250,
				smoothingTime: 100
			});
		});

		it('should have default audio enhancements', () => {
			const enhancements = voiceQuality.getAudioEnhancements();
			expect(enhancements.size).toBeGreaterThan(0);
			expect(enhancements.has('noise_reduction')).toBe(true);
			expect(enhancements.has('echo_suppression')).toBe(true);
		});
	});

	describe('Initialization', () => {
		it('should initialize with media stream', async () => {
			const processedStream = await voiceQuality.initialize(mockStream);

			expect(processedStream).toBeDefined();
			expect(MockAudioContext.prototype.createMediaStreamSource).toHaveBeenCalled();
			expect(MockAudioContext.prototype.createAnalyser).toHaveBeenCalled();
		});

		it('should handle audio context suspension', async () => {
			const mockContext = new MockAudioContext();
			mockContext.state = 'suspended';
			global.AudioContext = vi.fn().mockReturnValue(mockContext);

			await voiceQuality.initialize(mockStream);

			expect(mockContext.resume).toHaveBeenCalled();
		});

		it('should handle initialization errors', async () => {
			global.AudioContext = vi.fn().mockImplementation(() => {
				throw new Error('AudioContext creation failed');
			});

			await expect(voiceQuality.initialize(mockStream)).rejects.toThrow('AudioContext creation failed');
		});
	});

	describe('Audio Settings', () => {
		beforeEach(async () => {
			await voiceQuality.initialize(mockStream);
		});

		it('should update audio settings', async () => {
			const newSettings: Partial<AudioProcessingSettings> = {
				echoCancellation: false,
				sampleRate: 44100
			};

			await voiceQuality.updateAudioSettings(newSettings);

			const updatedSettings = voiceQuality.getAudioSettings();
			expect(updatedSettings.echoCancellation).toBe(false);
			expect(updatedSettings.sampleRate).toBe(44100);
		});

		it('should rebuild audio chain when settings change', async () => {
			const createAnalyserSpy = vi.spyOn(MockAudioContext.prototype, 'createAnalyser');

			await voiceQuality.updateAudioSettings({ compressionEnabled: false });

			// Should create new audio nodes
			expect(createAnalyserSpy).toHaveBeenCalled();
		});
	});

	describe('Voice Activity Detection', () => {
		beforeEach(async () => {
			await voiceQuality.initialize(mockStream);
		});

		it('should update VAD settings', () => {
			const newSettings: Partial<VoiceActivitySettings> = {
				threshold: 0.05,
				hangTime: 500
			};

			voiceQuality.updateVoiceActivitySettings(newSettings);

			const updatedSettings = voiceQuality.getVoiceActivitySettings();
			expect(updatedSettings.threshold).toBe(0.05);
			expect(updatedSettings.hangTime).toBe(500);
		});

		it('should calibrate voice activation threshold', async () => {
			const calibratePromise = voiceQuality.calibrateVoiceActivation();

			// Fast forward through calibration period
			await vi.advanceTimersByTimeAsync(2000);

			const threshold = await calibratePromise;
			expect(typeof threshold).toBe('number');
			expect(threshold).toBeGreaterThan(0);
		});
	});

	describe('Audio Enhancements', () => {
		beforeEach(async () => {
			await voiceQuality.initialize(mockStream);
		});

		it('should toggle audio enhancements', async () => {
			const initialState = voiceQuality.getAudioEnhancements().get('noise_reduction')?.enabled;

			await voiceQuality.toggleAudioEnhancement('noise_reduction');

			const newState = voiceQuality.getAudioEnhancements().get('noise_reduction')?.enabled;
			expect(newState).toBe(!initialState);
		});

		it('should toggle enhancement to specific state', async () => {
			await voiceQuality.toggleAudioEnhancement('noise_reduction', false);

			const enhancement = voiceQuality.getAudioEnhancements().get('noise_reduction');
			expect(enhancement?.enabled).toBe(false);
		});

		it('should update enhancement settings', async () => {
			await voiceQuality.updateEnhancementSettings('noise_reduction', { strength: 0.8 });

			const enhancement = voiceQuality.getAudioEnhancements().get('noise_reduction');
			expect(enhancement?.settings.strength).toBe(0.8);
		});

		it('should throw error for non-existent enhancement', async () => {
			await expect(voiceQuality.toggleAudioEnhancement('non-existent'))
				.rejects.toThrow("Audio enhancement 'non-existent' not found");
		});
	});

	describe('Metrics Collection', () => {
		beforeEach(async () => {
			await voiceQuality.initialize(mockStream);
		});

		it('should return null metrics before initialization', () => {
			const uninitializedManager = new VoiceQualityManager();
			const metrics = uninitializedManager.getCurrentMetrics();
			expect(metrics).toBeNull();
		});

		it('should collect voice metrics', () => {
			const metrics = voiceQuality.getCurrentMetrics();

			expect(metrics).toEqual({
				inputLevel: expect.any(Number),
				outputLevel: expect.any(Number),
				noiseLevel: expect.any(Number),
				speechProbability: expect.any(Number),
				isVoiceActive: expect.any(Boolean),
				processingLatency: expect.any(Number),
				timestamp: expect.any(Number)
			});
		});

		it('should emit metrics updates', async () => {
			const metricsListener = vi.fn();
			voiceQuality.on('metrics-updated', metricsListener);

			// Advance timers to trigger metrics collection
			await vi.advanceTimersByTimeAsync(100);

			expect(metricsListener).toHaveBeenCalled();
		});
	});

	describe('Microphone Testing', () => {
		beforeEach(async () => {
			await voiceQuality.initialize(mockStream);
		});

		it('should test microphone quality', async () => {
			const testPromise = voiceQuality.testMicrophone(100); // Short duration for testing

			// Fast forward through test duration
			await vi.advanceTimersByTimeAsync(100);

			const results = await testPromise;
			expect(results).toEqual({
				averageLevel: expect.any(Number),
				peakLevel: expect.any(Number),
				noiseFloor: expect.any(Number),
				dynamicRange: expect.any(Number),
				recommendation: expect.any(String)
			});
		});

		it('should throw error when testing uninitialized manager', async () => {
			const uninitializedManager = new VoiceQualityManager();
			await expect(uninitializedManager.testMicrophone())
				.rejects.toThrow('Voice quality manager not initialized');
		});
	});

	describe('Event System', () => {
		it('should register and call event listeners', () => {
			const listener = vi.fn();
			const unsubscribe = voiceQuality.on('settings-updated', listener);

			expect(typeof unsubscribe).toBe('function');

			unsubscribe();
		});

		it('should emit events', async () => {
			const settingsListener = vi.fn();
			voiceQuality.on('settings-updated', settingsListener);

			await voiceQuality.initialize(mockStream);
			await voiceQuality.updateAudioSettings({ echoCancellation: false });

			expect(settingsListener).toHaveBeenCalled();
		});

		it('should handle listener errors gracefully', async () => {
			const errorListener = vi.fn().mockImplementation(() => {
				throw new Error('Listener error');
			});
			voiceQuality.on('settings-updated', errorListener);

			await voiceQuality.initialize(mockStream);

			// Should not throw despite listener error
			await expect(voiceQuality.updateAudioSettings({ echoCancellation: false }))
				.resolves.not.toThrow();
		});
	});

	describe('Cleanup', () => {
		it('should destroy properly', async () => {
			await voiceQuality.initialize(mockStream);

			expect(() => voiceQuality.destroy()).not.toThrow();
		});

		it('should handle destroy when not initialized', () => {
			expect(() => voiceQuality.destroy()).not.toThrow();
		});

		it('should clean up audio context', async () => {
			await voiceQuality.initialize(mockStream);
			const mockContext = MockAudioContext.prototype.close;

			voiceQuality.destroy();

			expect(mockContext).toHaveBeenCalled();
		});

		it('should clear all listeners', async () => {
			const listener = vi.fn();
			voiceQuality.on('metrics-updated', listener);

			await voiceQuality.initialize(mockStream);
			voiceQuality.destroy();

			// Should not call listener after destroy
			await vi.advanceTimersByTimeAsync(100);
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe('Audio Processing Chain', () => {
		it('should create processing chain with compression', async () => {
			await voiceQuality.updateAudioSettings({ compressionEnabled: true });
			await voiceQuality.initialize(mockStream);

			expect(MockAudioContext.prototype.createDynamicsCompressor).toHaveBeenCalled();
		});

		it('should create processing chain with filters', async () => {
			await voiceQuality.updateAudioSettings({
				highPassFilter: true,
				lowPassFilter: true
			});
			await voiceQuality.initialize(mockStream);

			expect(MockAudioContext.prototype.createBiquadFilter).toHaveBeenCalledTimes(2);
		});

		it('should skip optional processing nodes when disabled', async () => {
			await voiceQuality.updateAudioSettings({
				compressionEnabled: false,
				highPassFilter: false,
				lowPassFilter: false
			});
			await voiceQuality.initialize(mockStream);

			expect(MockAudioContext.prototype.createDynamicsCompressor).not.toHaveBeenCalled();
			expect(MockAudioContext.prototype.createBiquadFilter).not.toHaveBeenCalled();
		});
	});
});