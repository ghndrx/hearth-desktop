import { browser } from '$app/environment';

export interface AudioProcessingSettings {
	echoCancellation: boolean;
	noiseSuppression: boolean;
	autoGainControl: boolean;
	sampleRate: number;
	bitrate: number;
	voiceActivationThreshold: number;
	compressionEnabled: boolean;
	highPassFilter: boolean;
	lowPassFilter: boolean;
}

export interface VoiceActivitySettings {
	enabled: boolean;
	threshold: number;
	hangTime: number; // ms to wait before stopping transmission
	smoothingTime: number; // ms for smoothing audio level changes
}

export interface AudioEnhancement {
	name: string;
	enabled: boolean;
	settings: Record<string, number>;
}

export interface VoiceMetrics {
	inputLevel: number;
	outputLevel: number;
	noiseLevel: number;
	speechProbability: number;
	isVoiceActive: boolean;
	processingLatency: number;
	timestamp: number;
}

/**
 * Voice Quality Manager
 * Handles advanced audio processing, voice activity detection, and quality optimization
 */
export class VoiceQualityManager {
	private audioContext: AudioContext | null = null;
	private inputSource: MediaStreamAudioSourceNode | null = null;
	private outputDestination: MediaStreamAudioDestinationNode | null = null;
	private inputAnalyser: AnalyserNode | null = null;
	private outputAnalyser: AnalyserNode | null = null;
	private gainNode: GainNode | null = null;
	private compressor: DynamicsCompressorNode | null = null;
	private highPassFilter: BiquadFilterNode | null = null;
	private lowPassFilter: BiquadFilterNode | null = null;
	private noiseGate: AudioWorkletNode | null = null;

	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private metricsInterval: ReturnType<typeof setInterval> | null = null;
	private localStream: MediaStream | null = null;
	private processedStream: MediaStream | null = null;

	// Settings
	private audioSettings: AudioProcessingSettings = {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		sampleRate: 48000,
		bitrate: 64000,
		voiceActivationThreshold: 0.01,
		compressionEnabled: true,
		highPassFilter: true,
		lowPassFilter: false
	};

	private voiceActivitySettings: VoiceActivitySettings = {
		enabled: true,
		threshold: 0.01,
		hangTime: 250,
		smoothingTime: 100
	};

	private audioEnhancements: Map<string, AudioEnhancement> = new Map([
		['noise_reduction', { name: 'Noise Reduction', enabled: true, settings: { strength: 0.5 } }],
		['echo_suppression', { name: 'Echo Suppression', enabled: true, settings: { strength: 0.7 } }],
		['voice_clarity', { name: 'Voice Clarity', enabled: false, settings: { enhancement: 0.3 } }],
		['bass_boost', { name: 'Bass Boost', enabled: false, settings: { gain: 0.2 } }]
	]);

	// Voice activity detection
	private isVoiceActive = false;
	private voiceHangTimer: ReturnType<typeof setTimeout> | null = null;
	private smoothedAudioLevel = 0;

	constructor() {
		if (!browser) return;
	}

	/**
	 * Initialize the voice quality manager with a media stream
	 */
	async initialize(stream: MediaStream): Promise<MediaStream> {
		if (!browser) throw new Error('Cannot initialize outside browser');

		this.localStream = stream;

		try {
			// Create audio context with optimal settings
			this.audioContext = new AudioContext({
				sampleRate: this.audioSettings.sampleRate,
				latencyHint: 'interactive'
			});

			// Resume context if suspended (browser policy)
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume();
			}

			await this.setupAudioProcessingChain(stream);
			this.startMetricsCollection();

			console.log('[VoiceQuality] Initialized with enhanced audio processing');
			return this.processedStream!;
		} catch (error) {
			console.error('[VoiceQuality] Failed to initialize:', error);
			throw error;
		}
	}

	/**
	 * Get current audio processing settings
	 */
	getAudioSettings(): AudioProcessingSettings {
		return { ...this.audioSettings };
	}

	/**
	 * Update audio processing settings
	 */
	async updateAudioSettings(settings: Partial<AudioProcessingSettings>): Promise<void> {
		this.audioSettings = { ...this.audioSettings, ...settings };

		if (this.audioContext && this.localStream) {
			// Rebuild audio processing chain with new settings
			await this.setupAudioProcessingChain(this.localStream);
		}

		this.emit('settings-updated', this.audioSettings);
		console.log('[VoiceQuality] Audio settings updated:', settings);
	}

	/**
	 * Get voice activity detection settings
	 */
	getVoiceActivitySettings(): VoiceActivitySettings {
		return { ...this.voiceActivitySettings };
	}

	/**
	 * Update voice activity detection settings
	 */
	updateVoiceActivitySettings(settings: Partial<VoiceActivitySettings>): void {
		this.voiceActivitySettings = { ...this.voiceActivitySettings, ...settings };
		this.emit('vad-settings-updated', this.voiceActivitySettings);
		console.log('[VoiceQuality] Voice activity settings updated:', settings);
	}

	/**
	 * Get available audio enhancements
	 */
	getAudioEnhancements(): Map<string, AudioEnhancement> {
		return new Map(this.audioEnhancements);
	}

	/**
	 * Toggle an audio enhancement
	 */
	async toggleAudioEnhancement(enhancementId: string, enabled?: boolean): Promise<void> {
		const enhancement = this.audioEnhancements.get(enhancementId);
		if (!enhancement) {
			throw new Error(`Audio enhancement '${enhancementId}' not found`);
		}

		enhancement.enabled = enabled !== undefined ? enabled : !enhancement.enabled;

		// Apply the enhancement change
		await this.applyAudioEnhancements();

		this.emit('enhancement-toggled', enhancementId, enhancement.enabled);
		console.log(`[VoiceQuality] Audio enhancement '${enhancement.name}' ${enhancement.enabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Update settings for a specific audio enhancement
	 */
	async updateEnhancementSettings(enhancementId: string, settings: Record<string, number>): Promise<void> {
		const enhancement = this.audioEnhancements.get(enhancementId);
		if (!enhancement) {
			throw new Error(`Audio enhancement '${enhancementId}' not found`);
		}

		enhancement.settings = { ...enhancement.settings, ...settings };

		if (enhancement.enabled) {
			await this.applyAudioEnhancements();
		}

		this.emit('enhancement-settings-updated', enhancementId, enhancement.settings);
		console.log(`[VoiceQuality] Enhancement '${enhancement.name}' settings updated:`, settings);
	}

	/**
	 * Get current voice metrics
	 */
	getCurrentMetrics(): VoiceMetrics | null {
		if (!this.audioContext || !this.inputAnalyser || !this.outputAnalyser) {
			return null;
		}

		const inputData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
		const outputData = new Uint8Array(this.outputAnalyser.frequencyBinCount);

		this.inputAnalyser.getByteFrequencyData(inputData);
		this.outputAnalyser.getByteFrequencyData(outputData);

		const inputLevel = this.calculateAudioLevel(inputData);
		const outputLevel = this.calculateAudioLevel(outputData);
		const noiseLevel = this.estimateNoiseLevel(inputData);
		const speechProbability = this.calculateSpeechProbability(inputData);

		return {
			inputLevel,
			outputLevel,
			noiseLevel,
			speechProbability,
			isVoiceActive: this.isVoiceActive,
			processingLatency: this.audioContext.baseLatency * 1000,
			timestamp: Date.now()
		};
	}

	/**
	 * Test microphone and return quality metrics
	 */
	async testMicrophone(duration: number = 5000): Promise<{
		averageLevel: number;
		peakLevel: number;
		noiseFloor: number;
		dynamicRange: number;
		recommendation: string;
	}> {
		if (!this.inputAnalyser) {
			throw new Error('Voice quality manager not initialized');
		}

		return new Promise((resolve) => {
			const samples: number[] = [];
			const startTime = Date.now();

			const collectSample = () => {
				const data = new Uint8Array(this.inputAnalyser!.frequencyBinCount);
				this.inputAnalyser!.getByteFrequencyData(data);
				const level = this.calculateAudioLevel(data);
				samples.push(level);

				if (Date.now() - startTime < duration) {
					requestAnimationFrame(collectSample);
				} else {
					// Calculate metrics
					const averageLevel = samples.reduce((a, b) => a + b) / samples.length;
					const peakLevel = Math.max(...samples);
					const sortedSamples = [...samples].sort((a, b) => a - b);
					const noiseFloor = sortedSamples[Math.floor(sortedSamples.length * 0.1)];
					const dynamicRange = peakLevel - noiseFloor;

					let recommendation = '';
					if (averageLevel < 0.1) {
						recommendation = 'Microphone level is too low. Increase input gain or move closer to microphone.';
					} else if (averageLevel > 0.9) {
						recommendation = 'Microphone level is too high. Reduce input gain to avoid clipping.';
					} else if (dynamicRange < 0.2) {
						recommendation = 'Low dynamic range detected. Check for background noise or microphone issues.';
					} else {
						recommendation = 'Microphone is working properly.';
					}

					resolve({
						averageLevel,
						peakLevel,
						noiseFloor,
						dynamicRange,
						recommendation
					});
				}
			};

			collectSample();
		});
	}

	/**
	 * Calibrate voice activation threshold automatically
	 */
	async calibrateVoiceActivation(): Promise<number> {
		if (!this.inputAnalyser) {
			throw new Error('Voice quality manager not initialized');
		}

		console.log('[VoiceQuality] Calibrating voice activation threshold...');

		// Collect ambient noise level for 2 seconds
		const noiseSamples: number[] = [];
		const startTime = Date.now();

		return new Promise((resolve) => {
			const collectNoise = () => {
				const data = new Uint8Array(this.inputAnalyser!.frequencyBinCount);
				this.inputAnalyser!.getByteFrequencyData(data);
				const level = this.calculateAudioLevel(data);
				noiseSamples.push(level);

				if (Date.now() - startTime < 2000) {
					requestAnimationFrame(collectNoise);
				} else {
					// Calculate noise floor and set threshold above it
					const averageNoise = noiseSamples.reduce((a, b) => a + b) / noiseSamples.length;
					const threshold = Math.max(averageNoise * 2.5, 0.01);

					this.voiceActivitySettings.threshold = threshold;
					console.log(`[VoiceQuality] Voice activation threshold calibrated to ${threshold.toFixed(3)}`);

					this.emit('vad-calibrated', threshold);
					resolve(threshold);
				}
			};

			collectNoise();
		});
	}

	/**
	 * Set up the audio processing chain
	 */
	private async setupAudioProcessingChain(stream: MediaStream): Promise<void> {
		if (!this.audioContext) return;

		// Clean up existing chain
		this.cleanupAudioChain();

		try {
			// Create input source
			this.inputSource = this.audioContext.createMediaStreamSource(stream);

			// Create analysers for monitoring
			this.inputAnalyser = this.audioContext.createAnalyser();
			this.outputAnalyser = this.audioContext.createAnalyser();
			this.inputAnalyser.fftSize = 256;
			this.outputAnalyser.fftSize = 256;

			// Create gain control
			this.gainNode = this.audioContext.createGain();
			this.gainNode.gain.value = 1.0;

			// Create compressor for dynamic range control
			if (this.audioSettings.compressionEnabled) {
				this.compressor = this.audioContext.createDynamicsCompressor();
				this.compressor.threshold.value = -24;
				this.compressor.knee.value = 30;
				this.compressor.ratio.value = 6;
				this.compressor.attack.value = 0.003;
				this.compressor.release.value = 0.25;
			}

			// Create filters
			if (this.audioSettings.highPassFilter) {
				this.highPassFilter = this.audioContext.createBiquadFilter();
				this.highPassFilter.type = 'highpass';
				this.highPassFilter.frequency.value = 85; // Remove low-frequency noise
				this.highPassFilter.Q.value = 0.7;
			}

			if (this.audioSettings.lowPassFilter) {
				this.lowPassFilter = this.audioContext.createBiquadFilter();
				this.lowPassFilter.type = 'lowpass';
				this.lowPassFilter.frequency.value = 8000; // Remove high-frequency noise
				this.lowPassFilter.Q.value = 0.7;
			}

			// Create output destination
			this.outputDestination = this.audioContext.createMediaStreamDestination();

			// Connect the processing chain
			let currentNode: AudioNode = this.inputSource;

			// Connect to input analyser (for monitoring)
			currentNode.connect(this.inputAnalyser);

			// Apply high-pass filter
			if (this.highPassFilter) {
				currentNode.connect(this.highPassFilter);
				currentNode = this.highPassFilter;
			}

			// Apply low-pass filter
			if (this.lowPassFilter) {
				currentNode.connect(this.lowPassFilter);
				currentNode = this.lowPassFilter;
			}

			// Apply compression
			if (this.compressor) {
				currentNode.connect(this.compressor);
				currentNode = this.compressor;
			}

			// Apply gain control
			currentNode.connect(this.gainNode);
			currentNode = this.gainNode;

			// Connect to output analyser (for monitoring)
			currentNode.connect(this.outputAnalyser);

			// Connect to destination
			currentNode.connect(this.outputDestination);

			// Get the processed stream
			this.processedStream = this.outputDestination.stream;

			// Apply additional enhancements
			await this.applyAudioEnhancements();

		} catch (error) {
			console.error('[VoiceQuality] Failed to setup audio processing chain:', error);
			throw error;
		}
	}

	/**
	 * Apply audio enhancements
	 */
	private async applyAudioEnhancements(): Promise<void> {
		// This would typically involve loading and applying audio worklets
		// For now, we'll log which enhancements are enabled

		const enabledEnhancements = Array.from(this.audioEnhancements.entries())
			.filter(([_, enhancement]) => enhancement.enabled)
			.map(([id, enhancement]) => ({ id, ...enhancement }));

		if (enabledEnhancements.length > 0) {
			console.log('[VoiceQuality] Active audio enhancements:',
				enabledEnhancements.map(e => e.name).join(', '));
		}

		// Here you would typically:
		// 1. Load audio worklets for advanced processing
		// 2. Connect them to the audio chain
		// 3. Configure them with the enhancement settings
	}

	/**
	 * Start collecting voice metrics
	 */
	private startMetricsCollection(): void {
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
		}

		this.metricsInterval = setInterval(() => {
			this.updateVoiceActivityDetection();
			const metrics = this.getCurrentMetrics();
			if (metrics) {
				this.emit('metrics-updated', metrics);
			}
		}, 100); // Update every 100ms
	}

	/**
	 * Update voice activity detection
	 */
	private updateVoiceActivityDetection(): void {
		if (!this.inputAnalyser || !this.voiceActivitySettings.enabled) return;

		const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
		this.inputAnalyser.getByteFrequencyData(data);
		const currentLevel = this.calculateAudioLevel(data);

		// Smooth the audio level
		const smoothing = 1 - Math.exp(-100 / this.voiceActivitySettings.smoothingTime);
		this.smoothedAudioLevel = this.smoothedAudioLevel * (1 - smoothing) + currentLevel * smoothing;

		const wasVoiceActive = this.isVoiceActive;
		const shouldBeActive = this.smoothedAudioLevel > this.voiceActivitySettings.threshold;

		if (shouldBeActive && !this.isVoiceActive) {
			// Voice activity started
			this.isVoiceActive = true;
			if (this.voiceHangTimer) {
				clearTimeout(this.voiceHangTimer);
				this.voiceHangTimer = null;
			}
		} else if (!shouldBeActive && this.isVoiceActive) {
			// Voice might have stopped, start hang timer
			if (!this.voiceHangTimer) {
				this.voiceHangTimer = setTimeout(() => {
					this.isVoiceActive = false;
					this.voiceHangTimer = null;
				}, this.voiceActivitySettings.hangTime);
			}
		}

		if (wasVoiceActive !== this.isVoiceActive) {
			this.emit('voice-activity-changed', this.isVoiceActive);
		}
	}

	/**
	 * Calculate audio level from frequency data
	 */
	private calculateAudioLevel(data: Uint8Array): number {
		let sum = 0;
		for (let i = 0; i < data.length; i++) {
			sum += data[i];
		}
		return sum / (data.length * 255);
	}

	/**
	 * Estimate noise level from frequency data
	 */
	private estimateNoiseLevel(data: Uint8Array): number {
		// Use lower frequency bins to estimate noise floor
		let sum = 0;
		const noiseBins = Math.floor(data.length * 0.3);
		for (let i = 0; i < noiseBins; i++) {
			sum += data[i];
		}
		return sum / (noiseBins * 255);
	}

	/**
	 * Calculate speech probability from frequency data
	 */
	private calculateSpeechProbability(data: Uint8Array): number {
		// Simple heuristic: look for energy in speech frequency range (300-3400 Hz)
		// This is a basic implementation; real speech detection would be more sophisticated
		const sampleRate = this.audioContext?.sampleRate || 48000;
		const binSize = (sampleRate / 2) / data.length;
		const speechStart = Math.floor(300 / binSize);
		const speechEnd = Math.floor(3400 / binSize);

		let speechEnergy = 0;
		let totalEnergy = 0;

		for (let i = 0; i < data.length; i++) {
			totalEnergy += data[i];
			if (i >= speechStart && i <= speechEnd) {
				speechEnergy += data[i];
			}
		}

		return totalEnergy > 0 ? speechEnergy / totalEnergy : 0;
	}

	/**
	 * Clean up the audio processing chain
	 */
	private cleanupAudioChain(): void {
		if (this.inputSource) {
			this.inputSource.disconnect();
			this.inputSource = null;
		}
		if (this.gainNode) {
			this.gainNode.disconnect();
			this.gainNode = null;
		}
		if (this.compressor) {
			this.compressor.disconnect();
			this.compressor = null;
		}
		if (this.highPassFilter) {
			this.highPassFilter.disconnect();
			this.highPassFilter = null;
		}
		if (this.lowPassFilter) {
			this.lowPassFilter.disconnect();
			this.lowPassFilter = null;
		}
		if (this.inputAnalyser) {
			this.inputAnalyser.disconnect();
			this.inputAnalyser = null;
		}
		if (this.outputAnalyser) {
			this.outputAnalyser.disconnect();
			this.outputAnalyser = null;
		}
		if (this.outputDestination) {
			this.outputDestination.disconnect();
			this.outputDestination = null;
		}
		if (this.noiseGate) {
			this.noiseGate.disconnect();
			this.noiseGate = null;
		}
	}

	/**
	 * Register an event listener
	 */
	on(event: string, callback: (...args: unknown[]) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);
		return () => {
			this.listeners.get(event)?.delete(callback);
		};
	}

	/**
	 * Emit an event to listeners
	 */
	private emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach(callback => {
			try {
				callback(...args);
			} catch (error) {
				console.error(`[VoiceQuality] Error in event listener for ${event}:`, error);
			}
		});
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.metricsInterval) {
			clearInterval(this.metricsInterval);
			this.metricsInterval = null;
		}

		if (this.voiceHangTimer) {
			clearTimeout(this.voiceHangTimer);
			this.voiceHangTimer = null;
		}

		this.cleanupAudioChain();

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.listeners.clear();
		this.localStream = null;
		this.processedStream = null;

		console.log('[VoiceQuality] Destroyed');
	}
}