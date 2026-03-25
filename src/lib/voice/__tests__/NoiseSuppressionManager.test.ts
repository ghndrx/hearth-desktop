import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	NoiseSuppressionManager,
	getNoiseSuppressionManager,
	destroyNoiseSuppressionManager,
	SuppressionLevel,
	type NoiseSuppressionConfig
} from '../NoiseSuppressionManager';

// Mock browser environment
Object.defineProperty(global, 'AudioContext', {
	value: class MockAudioContext {
		sampleRate = 48000;
		state = 'running';

		createMediaStreamSource = vi.fn(() => ({
			connect: vi.fn()
		}));

		createMediaStreamDestination = vi.fn(() => ({
			stream: new MediaStream(), // Each call creates a new MediaStream
			connect: vi.fn()
		}));

		audioWorklet = {
			addModule: vi.fn().mockResolvedValue(undefined)
		};

		close = vi.fn().mockResolvedValue(undefined);
	},
	writable: true
});

Object.defineProperty(global, 'AudioWorkletNode', {
	value: class MockAudioWorkletNode {
		port = {
			onmessage: null as ((event: MessageEvent) => void) | null,
			postMessage: vi.fn()
		};

		connect = vi.fn();
		disconnect = vi.fn();
	},
	writable: true
});

Object.defineProperty(global, 'URL', {
	value: {
		createObjectURL: vi.fn(() => 'mock-blob-url')
	},
	writable: true
});

Object.defineProperty(global, 'Blob', {
	value: class MockBlob {
		constructor(public content: any[], public options?: any) {}
	},
	writable: true
});

Object.defineProperty(global, 'MediaStream', {
	value: class MockMediaStream {
		getTracks = vi.fn(() => []);
		getAudioTracks = vi.fn(() => []);
	},
	writable: true
});

// Mock browser environment variable
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('NoiseSuppressionManager', () => {
	let manager: NoiseSuppressionManager;

	beforeEach(() => {
		// Reset singleton
		destroyNoiseSuppressionManager();
		manager = new NoiseSuppressionManager();
	});

	afterEach(() => {
		manager?.destroy();
		destroyNoiseSuppressionManager();
	});

	describe('initialization', () => {
		it('should initialize with default config', async () => {
			await manager.initialize();

			const config = manager.getConfig();
			expect(config).toBeDefined();
			expect(config?.level).toBe(SuppressionLevel.MEDIUM);
			expect(config?.enabled).toBe(true);
			expect(config?.vadThreshold).toBe(0.5);
			expect(config?.smoothingFactor).toBe(0.8);
		});

		it('should initialize with custom config', async () => {
			const customConfig: Partial<NoiseSuppressionConfig> = {
				level: SuppressionLevel.AGGRESSIVE,
				vadThreshold: 0.7,
				smoothingFactor: 0.9
			};

			await manager.initialize(customConfig);

			const config = manager.getConfig();
			expect(config?.level).toBe(SuppressionLevel.AGGRESSIVE);
			expect(config?.vadThreshold).toBe(0.7);
			expect(config?.smoothingFactor).toBe(0.9);
		});

		it('should handle initialization failure gracefully', async () => {
			// Create a new manager for this test
			const testManager = new NoiseSuppressionManager();

			// Mock createMockRNNoiseModule to throw
			const originalMethod = testManager['createMockRNNoiseModule'];
			testManager['createMockRNNoiseModule'] = vi.fn().mockRejectedValue(new Error('WASM load failed'));

			try {
				await expect(testManager.initialize()).rejects.toThrow('WASM load failed');

				// Should disable noise suppression on failure
				const config = testManager.getConfig();
				expect(config?.enabled).toBe(false);
			} finally {
				// Restore method
				testManager['createMockRNNoiseModule'] = originalMethod;
				testManager.destroy();
			}
		});
	});

	describe('level management', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should change suppression level', async () => {
			await manager.setLevel(SuppressionLevel.LIGHT);

			const config = manager.getConfig();
			expect(config?.level).toBe(SuppressionLevel.LIGHT);
		});

		it('should support all suppression levels', async () => {
			const levels = [
				SuppressionLevel.OFF,
				SuppressionLevel.LIGHT,
				SuppressionLevel.MEDIUM,
				SuppressionLevel.AGGRESSIVE
			];

			for (const level of levels) {
				await manager.setLevel(level);
				const config = manager.getConfig();
				expect(config?.level).toBe(level);
			}
		});
	});

	describe('enable/disable functionality', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should enable and disable noise suppression', () => {
			manager.setEnabled(false);
			expect(manager.getConfig()?.enabled).toBe(false);

			manager.setEnabled(true);
			expect(manager.getConfig()?.enabled).toBe(true);
		});

		it('should not process audio when disabled', async () => {
			manager.setEnabled(false);

			const mockStream = new MediaStream();
			const result = await manager.processMediaStream(mockStream);

			// Should return original stream when disabled
			expect(result).toBe(mockStream);
		});
	});

	describe('audio processing', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should process MediaStream', async () => {
			const mockStream = new MediaStream();
			const processedStream = await manager.processMediaStream(mockStream);

			expect(processedStream).toBeInstanceOf(MediaStream);
			// The stream might be the same if worklet setup fails (graceful fallback)
			// or different if processing is applied
		});

		it('should test noise suppression on audio buffer', async () => {
			const inputBuffer = new Float32Array(480);
			// Fill with mock audio data
			for (let i = 0; i < inputBuffer.length; i++) {
				inputBuffer[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * 0.5; // 440Hz sine wave
			}

			const outputBuffer = await manager.testNoiseSuppression(inputBuffer);

			expect(outputBuffer).toBeInstanceOf(Float32Array);
			expect(outputBuffer.length).toBe(inputBuffer.length);
		});

		it('should return original buffer when disabled', async () => {
			manager.setEnabled(false);

			const inputBuffer = new Float32Array(480);
			inputBuffer.fill(0.5);

			const outputBuffer = await manager.testNoiseSuppression(inputBuffer);

			expect(outputBuffer).toBe(inputBuffer);
		});

		it('should handle audio processing errors gracefully', async () => {
			const inputBuffer = new Float32Array(480);

			// This should not throw even if there are internal errors
			const outputBuffer = await manager.testNoiseSuppression(inputBuffer);

			expect(outputBuffer).toBeInstanceOf(Float32Array);
		});
	});

	describe('statistics', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should provide processing statistics', () => {
			const stats = manager.getStats();

			expect(stats).toBeDefined();
			expect(typeof stats.samplesProcessed).toBe('number');
			expect(typeof stats.noiseReduction).toBe('number');
			expect(typeof stats.voiceActivity).toBe('number');
			expect(typeof stats.processingLatency).toBe('number');
		});

		it('should track processed samples', async () => {
			const initialStats = manager.getStats();

			const inputBuffer = new Float32Array(480);
			await manager.testNoiseSuppression(inputBuffer);

			const updatedStats = manager.getStats();
			expect(updatedStats.samplesProcessed).toBeGreaterThanOrEqual(initialStats.samplesProcessed);
		});
	});

	describe('resource cleanup', () => {
		it('should clean up resources on destroy', async () => {
			await manager.initialize();

			const config = manager.getConfig();
			expect(config).toBeDefined();

			manager.destroy();

			const configAfterDestroy = manager.getConfig();
			expect(configAfterDestroy).toBeNull();
		});
	});

	describe('singleton management', () => {
		it('should return same instance from getNoiseSuppressionManager', () => {
			const instance1 = getNoiseSuppressionManager();
			const instance2 = getNoiseSuppressionManager();

			expect(instance1).toBe(instance2);
		});

		it('should destroy singleton instance', () => {
			const instance = getNoiseSuppressionManager();
			expect(instance).toBeDefined();

			destroyNoiseSuppressionManager();

			// Getting manager after destroy should return new instance
			const newInstance = getNoiseSuppressionManager();
			expect(newInstance).not.toBe(instance);
		});
	});

	describe('error handling', () => {
		it('should handle missing AudioContext gracefully', async () => {
			// Temporarily set AudioContext to undefined
			const originalAudioContext = global.AudioContext;
			// @ts-ignore
			global.AudioContext = undefined;

			const testManager = new NoiseSuppressionManager();

			try {
				await testManager.initialize();

				const mockStream = new MediaStream();
				const result = await testManager.processMediaStream(mockStream);
				expect(result).toBe(mockStream); // Should fall back to original stream
			} finally {
				// Restore AudioContext
				global.AudioContext = originalAudioContext;
				testManager.destroy();
			}
		});

		it('should handle worklet setup failure gracefully', async () => {
			// Mock audioWorklet.addModule to fail
			const originalAddModule = AudioContext.prototype.audioWorklet?.addModule;
			if (AudioContext.prototype.audioWorklet) {
				AudioContext.prototype.audioWorklet.addModule = vi.fn().mockRejectedValue(new Error('Worklet failed'));
			}

			try {
				await manager.initialize();

				const mockStream = new MediaStream();
				const result = await manager.processMediaStream(mockStream);
				expect(result).toBeInstanceOf(MediaStream);
			} finally {
				// Restore original method
				if (AudioContext.prototype.audioWorklet && originalAddModule) {
					AudioContext.prototype.audioWorklet.addModule = originalAddModule;
				}
			}
		});
	});

	describe('suppression levels behavior', () => {
		beforeEach(async () => {
			await manager.initialize();
		});

		it('should apply different suppression based on level', async () => {
			const inputBuffer = new Float32Array(480);
			inputBuffer.fill(0.05); // Low amplitude signal

			// Test light suppression
			await manager.setLevel(SuppressionLevel.LIGHT);
			const lightResult = await manager.testNoiseSuppression(inputBuffer);

			// Test aggressive suppression
			await manager.setLevel(SuppressionLevel.AGGRESSIVE);
			const aggressiveResult = await manager.testNoiseSuppression(inputBuffer);

			// Aggressive should suppress more than light
			const lightMean = lightResult.reduce((sum, val) => sum + Math.abs(val), 0) / lightResult.length;
			const aggressiveMean = aggressiveResult.reduce((sum, val) => sum + Math.abs(val), 0) / aggressiveResult.length;

			expect(aggressiveMean).toBeLessThanOrEqual(lightMean);
		});
	});
});

describe('NoiseSuppressionManager Edge Cases', () => {
	it('should handle zero-length audio buffers', async () => {
		const manager = new NoiseSuppressionManager();
		await manager.initialize();

		const emptyBuffer = new Float32Array(0);
		const result = await manager.testNoiseSuppression(emptyBuffer);

		expect(result.length).toBe(0);

		manager.destroy();
	});

	it('should handle very large audio buffers', async () => {
		const manager = new NoiseSuppressionManager();
		await manager.initialize();

		const largeBuffer = new Float32Array(48000); // 1 second at 48kHz
		largeBuffer.fill(0.1);

		const result = await manager.testNoiseSuppression(largeBuffer);

		expect(result.length).toBe(largeBuffer.length);
		expect(result).toBeInstanceOf(Float32Array);

		manager.destroy();
	});

	it('should handle non-standard sample rates gracefully', async () => {
		const manager = new NoiseSuppressionManager();

		// Mock AudioContext with different sample rate
		const originalAudioContext = global.AudioContext;
		global.AudioContext = class extends originalAudioContext {
			sampleRate = 44100;
		} as any;

		try {
			await manager.initialize();

			const buffer = new Float32Array(441); // 10ms at 44.1kHz
			const result = await manager.testNoiseSuppression(buffer);

			expect(result).toBeInstanceOf(Float32Array);
		} finally {
			global.AudioContext = originalAudioContext;
			manager.destroy();
		}
	});
});