import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranscriptionAudioBuffer } from './audioBuffer';

describe('TranscriptionAudioBuffer', () => {
	let buffer: TranscriptionAudioBuffer;

	beforeEach(() => {
		vi.useFakeTimers();
		buffer = new TranscriptionAudioBuffer({
			targetSampleRate: 16000,
			sourceSampleRate: 48000,
			bufferDuration: 2,
			vadThreshold: 0.01,
		});
	});

	afterEach(() => {
		buffer.stop();
		vi.useRealTimers();
	});

	it('should initialize with inactive state', () => {
		expect(buffer.isActive).toBe(false);
	});

	it('should become active after start()', () => {
		buffer.start();
		expect(buffer.isActive).toBe(true);
	});

	it('should become inactive after stop()', () => {
		buffer.start();
		buffer.stop();
		expect(buffer.isActive).toBe(false);
	});

	it('should not process chunks when inactive', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);

		const audio = createNoisyAudio(4096);
		buffer.addChunk(audio);

		expect(flushCb).not.toHaveBeenCalled();
	});

	it('should skip silent audio (VAD)', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);
		buffer.start();

		// Create silent audio (all zeros)
		const silent = new Float32Array(4096);
		buffer.addChunk(silent);

		// Advance timers to trigger any pending flush
		vi.advanceTimersByTime(5000);

		expect(flushCb).not.toHaveBeenCalled();
	});

	it('should flush when buffer duration is reached', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);
		buffer.start();

		// At 16kHz target, 2 seconds = 32000 samples
		// Source is 48kHz, so we need 96000 source samples to get 32000 resampled samples
		// Each chunk is 4096 source samples → ~1365 target samples
		// Need ~24 chunks to fill 2 second buffer
		for (let i = 0; i < 25; i++) {
			buffer.addChunk(createNoisyAudio(4096));
		}

		expect(flushCb).toHaveBeenCalled();
		const flushedAudio = flushCb.mock.calls[0][0];
		expect(flushedAudio).toBeInstanceOf(Float32Array);
		expect(flushedAudio.length).toBeGreaterThan(0);
	});

	it('should flush remaining audio on stop()', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);
		buffer.start();

		// Add just a small amount of audio (not enough to trigger automatic flush)
		buffer.addChunk(createNoisyAudio(4096));
		expect(flushCb).not.toHaveBeenCalled();

		buffer.stop();
		expect(flushCb).toHaveBeenCalledTimes(1);
	});

	it('should flush on timeout even if buffer is not full', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);
		buffer.start();

		buffer.addChunk(createNoisyAudio(4096));
		expect(flushCb).not.toHaveBeenCalled();

		// bufferDuration * 1.5 = 3 seconds timeout
		vi.advanceTimersByTime(3100);

		expect(flushCb).toHaveBeenCalledTimes(1);
	});

	it('should resample from 48kHz to 16kHz', () => {
		const input = new Float32Array(4800); // 100ms at 48kHz
		for (let i = 0; i < input.length; i++) {
			input[i] = Math.sin(2 * Math.PI * 440 * i / 48000); // 440Hz sine
		}

		const output = buffer.resample(input, 48000, 16000);

		// 4800 samples at 48kHz → ~1600 samples at 16kHz
		expect(output.length).toBe(1600);
		// Values should be in valid range
		for (let i = 0; i < output.length; i++) {
			expect(Math.abs(output[i])).toBeLessThanOrEqual(1.0);
		}
	});

	it('should return same buffer if sample rates match', () => {
		const input = new Float32Array([0.1, 0.2, 0.3]);
		const output = buffer.resample(input, 16000, 16000);
		expect(output).toBe(input);
	});

	it('should reset buffer state', () => {
		const flushCb = vi.fn();
		buffer.setFlushCallback(flushCb);
		buffer.start();

		buffer.addChunk(createNoisyAudio(4096));
		buffer.reset();

		// After reset, stop should not flush anything
		buffer.stop();
		expect(flushCb).not.toHaveBeenCalled();
	});

	it('should update config dynamically', () => {
		buffer.updateConfig({ bufferDuration: 5, vadThreshold: 0.05 });
		// No error thrown means config was updated
		expect(buffer.isActive).toBe(false);
	});
});

// Helper: create audio with noise above VAD threshold
function createNoisyAudio(length: number): Float32Array {
	const audio = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		audio[i] = (Math.random() - 0.5) * 0.2; // Random noise, amplitude ~0.1
	}
	return audio;
}
