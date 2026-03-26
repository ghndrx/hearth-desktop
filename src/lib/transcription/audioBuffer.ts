/**
 * AudioBuffer - Accumulates audio chunks from WebRTC tracks for transcription.
 * Handles resampling from 48kHz (WebRTC default) to 16kHz (Whisper expected).
 */

export interface AudioBufferConfig {
	/** Target sample rate for transcription (default: 16000) */
	targetSampleRate: number;
	/** Source sample rate from WebRTC (default: 48000) */
	sourceSampleRate: number;
	/** Buffer duration in seconds before flushing (default: 2) */
	bufferDuration: number;
	/** Voice activity detection threshold (0-1, default: 0.01) */
	vadThreshold: number;
}

const DEFAULT_CONFIG: AudioBufferConfig = {
	targetSampleRate: 16000,
	sourceSampleRate: 48000,
	bufferDuration: 2,
	vadThreshold: 0.01,
};

export class TranscriptionAudioBuffer {
	private config: AudioBufferConfig;
	private chunks: Float32Array[] = [];
	private totalSamples = 0;
	private onFlush: ((audio: Float32Array) => void) | null = null;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private _isActive = false;

	constructor(config: Partial<AudioBufferConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	get isActive(): boolean {
		return this._isActive;
	}

	/**
	 * Set the callback invoked when buffer is flushed (enough audio accumulated).
	 */
	setFlushCallback(cb: (audio: Float32Array) => void): void {
		this.onFlush = cb;
	}

	/**
	 * Start accepting audio data.
	 */
	start(): void {
		this._isActive = true;
		this.chunks = [];
		this.totalSamples = 0;
	}

	/**
	 * Stop accepting audio data and flush remaining.
	 */
	stop(): void {
		this._isActive = false;
		this.flush();
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
	}

	/**
	 * Add an audio chunk from a WebRTC track or AudioWorklet.
	 * Performs VAD check and resampling.
	 */
	addChunk(audioData: Float32Array): void {
		if (!this._isActive) return;

		// Voice activity detection - skip silent frames
		if (!this.detectVoiceActivity(audioData)) return;

		// Resample if needed
		const resampled = this.config.sourceSampleRate !== this.config.targetSampleRate
			? this.resample(audioData, this.config.sourceSampleRate, this.config.targetSampleRate)
			: audioData;

		this.chunks.push(resampled);
		this.totalSamples += resampled.length;

		// Check if buffer is full
		const targetSamples = this.config.targetSampleRate * this.config.bufferDuration;
		if (this.totalSamples >= targetSamples) {
			this.flush();
		} else if (!this.flushTimer) {
			// Set a max-wait timer to flush even if buffer isn't full
			this.flushTimer = setTimeout(() => {
				this.flushTimer = null;
				if (this.totalSamples > 0) {
					this.flush();
				}
			}, this.config.bufferDuration * 1000 * 1.5);
		}
	}

	/**
	 * Simple voice activity detection based on RMS energy.
	 */
	private detectVoiceActivity(audio: Float32Array): boolean {
		let sum = 0;
		for (let i = 0; i < audio.length; i++) {
			sum += audio[i] * audio[i];
		}
		const rms = Math.sqrt(sum / audio.length);
		return rms > this.config.vadThreshold;
	}

	/**
	 * Resample audio from source rate to target rate using linear interpolation.
	 */
	resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
		if (fromRate === toRate) return input;

		const ratio = fromRate / toRate;
		const outputLength = Math.round(input.length / ratio);
		const output = new Float32Array(outputLength);

		for (let i = 0; i < outputLength; i++) {
			const srcIndex = i * ratio;
			const srcIndexFloor = Math.floor(srcIndex);
			const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
			const fraction = srcIndex - srcIndexFloor;
			output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction;
		}

		return output;
	}

	/**
	 * Flush accumulated chunks and invoke the callback.
	 */
	private flush(): void {
		if (this.chunks.length === 0) return;

		// Merge chunks into single buffer
		const merged = new Float32Array(this.totalSamples);
		let offset = 0;
		for (const chunk of this.chunks) {
			merged.set(chunk, offset);
			offset += chunk.length;
		}

		this.chunks = [];
		this.totalSamples = 0;

		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.onFlush) {
			this.onFlush(merged);
		}
	}

	/**
	 * Reset buffer state.
	 */
	reset(): void {
		this.chunks = [];
		this.totalSamples = 0;
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
	}

	/**
	 * Update configuration dynamically.
	 */
	updateConfig(config: Partial<AudioBufferConfig>): void {
		this.config = { ...this.config, ...config };
	}
}
