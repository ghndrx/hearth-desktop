import { browser } from '$app/environment';
import { transcriptionActions, type TranscriptionEntry } from '$lib/stores/voice';

// Dynamic import for @xenova/transformers (WASM fallback only)
type Pipeline = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineFn: ((task: any, model?: string) => Promise<Pipeline>) | null = null;

export type TranscriptionBackend = 'native' | 'wasm';

export interface TranscriptionConfig {
	modelName: string;
	language: string;
	autoDetectLanguage: boolean;
	chunk_length_s: number;
	stride_length_s: number;
	minSilenceDuration: number;
	minConfidence: number;
	/** Whisper model for native backend (tiny, base, small, medium) */
	nativeModel: string;
	/** Preferred backend: 'native' (faster-whisper via Tauri) or 'wasm' (Xenova/transformers) */
	backend: TranscriptionBackend;
}

const DEFAULT_CONFIG: TranscriptionConfig = {
	modelName: 'Xenova/whisper-tiny',
	language: 'auto',
	autoDetectLanguage: true,
	chunk_length_s: 30,
	stride_length_s: 5,
	minSilenceDuration: 300, // ms
	minConfidence: 0.3,
	nativeModel: 'base',
	backend: 'native',
};

const SUPPORTED_LANGUAGES: Record<string, string> = {
	'en': 'English',
	'es': 'Spanish',
	'fr': 'French',
	'de': 'German',
	'it': 'Italian',
	'pt': 'Portuguese',
	'ru': 'Russian',
	'ja': 'Japanese',
	'ko': 'Korean',
	'zh': 'Chinese',
	'ar': 'Arabic',
	'hi': 'Hindi',
	'nl': 'Dutch',
	'pl': 'Polish',
	'sv': 'Swedish',
	'tr': 'Turkish',
	'uk': 'Ukrainian',
};

interface AudioSegment {
	data: Float32Array;
	timestamp: number;
	userId: string;
	username: string;
}

class AudioBufferProcessor {
	private buffers = new Map<string, Float32Array[]>();
	private lastActivity = new Map<string, number>();
	private readonly maxBufferSize = 16000 * 10; // 10 seconds at 16kHz

	addAudioData(userId: string, audioData: Float32Array): boolean {
		const now = Date.now();
		this.lastActivity.set(userId, now);

		if (!this.buffers.has(userId)) {
			this.buffers.set(userId, []);
		}

		const userBuffer = this.buffers.get(userId)!;
		userBuffer.push(audioData);

		// Calculate total buffer size
		const totalSize = userBuffer.reduce((sum, chunk) => sum + chunk.length, 0);

		// If buffer is too large, remove old chunks
		if (totalSize > this.maxBufferSize) {
			let removedSize = 0;
			while (removedSize < totalSize - this.maxBufferSize && userBuffer.length > 1) {
				const removed = userBuffer.shift()!;
				removedSize += removed.length;
			}
		}

		return totalSize >= 16000; // ~1 second of audio
	}

	getAndClearBuffer(userId: string): Float32Array | null {
		const userBuffer = this.buffers.get(userId);
		if (!userBuffer || userBuffer.length === 0) return null;

		// Concatenate all chunks
		const totalLength = userBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
		const result = new Float32Array(totalLength);

		let offset = 0;
		for (const chunk of userBuffer) {
			result.set(chunk, offset);
			offset += chunk.length;
		}

		// Clear the buffer
		this.buffers.set(userId, []);

		return result;
	}

	cleanup(maxAge: number = 30000): void {
		const now = Date.now();
		for (const [userId, lastActivity] of this.lastActivity.entries()) {
			if (now - lastActivity > maxAge) {
				this.buffers.delete(userId);
				this.lastActivity.delete(userId);
			}
		}
	}
}

export class TranscriptionManager {
	private pipeline: Pipeline | null = null;
	private config: TranscriptionConfig;
	private audioProcessor: AudioBufferProcessor;
	private isInitialized = false;
	private initPromise: Promise<void> | null = null;
	private usernames = new Map<string, string>();
	private processingQueue: AudioSegment[] = [];
	private isProcessing = false;
	private cleanupInterval: ReturnType<typeof setInterval> | null = null;
	private activeBackend: TranscriptionBackend | null = null;
	private tauriEventUnlisten: (() => void) | null = null;

	constructor(config?: Partial<TranscriptionConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.audioProcessor = new AudioBufferProcessor();

		if (browser) {
			this.setupCleanup();
		}
	}

	private setupCleanup(): void {
		this.cleanupInterval = setInterval(() => {
			this.audioProcessor.cleanup();
		}, 30000);
	}

	/**
	 * Initialize the Whisper model - tries native (faster-whisper) first, falls back to WASM
	 */
	async initialize(): Promise<void> {
		if (this.initPromise) return this.initPromise;
		if (this.isInitialized) return;

		transcriptionActions.setInitializing(true);

		this.initPromise = this.initializeInternal();
		return this.initPromise;
	}

	private async initializeInternal(): Promise<void> {
		if (!browser) {
			throw new Error('TranscriptionManager can only be initialized in browser environment');
		}

		// Try native backend first (faster-whisper via Tauri)
		if (this.config.backend === 'native') {
			try {
				await this.initializeNative();
				return;
			} catch (error) {
				console.warn('[Transcription] Native backend unavailable, falling back to WASM:', error);
			}
		}

		// Fall back to WASM backend
		try {
			await this.initializeWasm();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to initialize transcription model';
			console.error('[Transcription] All backends failed:', error);
			transcriptionActions.setError(message);
			throw error;
		}
	}

	/**
	 * Initialize native backend using faster-whisper via Tauri commands
	 */
	private async initializeNative(): Promise<void> {
		console.log('[Transcription] Initializing native faster-whisper backend...');

		const { invoke } = await import('@tauri-apps/api/core');

		// Load the model (this validates Python + faster-whisper availability)
		await invoke('transcription_load_model', { model: this.config.nativeModel });

		// Set up Tauri event listener for live transcription segments
		await this.setupTauriEventListeners();

		this.activeBackend = 'native';
		this.isInitialized = true;
		transcriptionActions.setReady(true);

		console.log(`[Transcription] Native backend ready (model: ${this.config.nativeModel})`);
	}

	/**
	 * Initialize WASM backend using @xenova/transformers
	 */
	private async initializeWasm(): Promise<void> {
		console.log('[Transcription] Initializing WASM Whisper backend...');

		// Dynamically import to avoid loading heavy WASM unless needed
		if (!pipelineFn) {
			const transformers = await import('@xenova/transformers');
			pipelineFn = transformers.pipeline;
		}

		this.pipeline = await pipelineFn!('automatic-speech-recognition', this.config.modelName);

		this.activeBackend = 'wasm';
		this.isInitialized = true;
		transcriptionActions.setReady(true);

		console.log('[Transcription] WASM backend ready');
	}

	/**
	 * Set up listeners for Tauri transcription events (live mode)
	 */
	private async setupTauriEventListeners(): Promise<void> {
		try {
			const { listen } = await import('@tauri-apps/api/event');

			const unlisten = await listen<{ text: string; start: number; end: number; is_final: boolean; speaker?: string }>(
				'transcription:live-segment',
				(event) => {
					const { text, is_final, speaker } = event.payload;
					if (text && text.trim()) {
						transcriptionActions.addEntry({
							userId: speaker || 'unknown',
							username: speaker || 'Speaker',
							text: text.trim(),
							confidence: 0.9, // Native backend generally high confidence
							language: this.config.language === 'auto' ? 'en' : this.config.language,
							isFinal: is_final,
						});
					}
				}
			);

			this.tauriEventUnlisten = unlisten;
		} catch (error) {
			console.warn('[Transcription] Failed to set up Tauri event listeners:', error);
		}
	}

	/**
	 * Start live transcription mode (native backend only)
	 */
	async startLive(): Promise<void> {
		if (this.activeBackend !== 'native') {
			console.warn('[Transcription] Live mode only available with native backend');
			return;
		}

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('transcription_start_live', {
				model: this.config.nativeModel,
				language: this.config.language,
				sampleRate: 16000,
			});
			console.log('[Transcription] Live transcription started');
		} catch (error) {
			console.error('[Transcription] Failed to start live transcription:', error);
		}
	}

	/**
	 * Stop live transcription mode
	 */
	async stopLive(): Promise<void> {
		if (this.activeBackend !== 'native') return;

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('transcription_stop_live');
			console.log('[Transcription] Live transcription stopped');
		} catch (error) {
			console.error('[Transcription] Failed to stop live transcription:', error);
		}
	}

	/**
	 * Check live transcription status
	 */
	async isLiveActive(): Promise<boolean> {
		if (this.activeBackend !== 'native') return false;

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			return await invoke<boolean>('transcription_live_status');
		} catch {
			return false;
		}
	}

	/**
	 * Get the active backend type
	 */
	getActiveBackend(): TranscriptionBackend | null {
		return this.activeBackend;
	}

	/**
	 * Process audio data from a user
	 */
	async processAudio(userId: string, audioData: Float32Array, username?: string): Promise<void> {
		if (!this.isInitialized) {
			console.warn('[Transcription] Manager not initialized');
			return;
		}

		if (username) {
			this.usernames.set(userId, username);
		}

		const shouldProcess = this.audioProcessor.addAudioData(userId, audioData);

		if (shouldProcess) {
			const bufferedAudio = this.audioProcessor.getAndClearBuffer(userId);
			if (bufferedAudio) {
				const segment: AudioSegment = {
					data: bufferedAudio,
					timestamp: Date.now(),
					userId,
					username: this.usernames.get(userId) || userId,
				};

				this.processingQueue.push(segment);
				this.processQueue();
			}
		}
	}

	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.processingQueue.length === 0) return;

		this.isProcessing = true;

		while (this.processingQueue.length > 0) {
			const segment = this.processingQueue.shift()!;
			await this.transcribeSegment(segment);
		}

		this.isProcessing = false;
	}

	private async transcribeSegment(segment: AudioSegment): Promise<void> {
		try {
			if (this.activeBackend === 'native') {
				await this.transcribeSegmentNative(segment);
			} else {
				await this.transcribeSegmentWasm(segment);
			}
		} catch (error) {
			console.error('[Transcription] Failed to transcribe segment:', error);
		}
	}

	/**
	 * Transcribe a segment using the native faster-whisper backend (Tauri command)
	 */
	private async transcribeSegmentNative(segment: AudioSegment): Promise<void> {
		const startTime = performance.now();

		const { invoke } = await import('@tauri-apps/api/core');
		const result = await invoke<{
			text: string;
			language: string;
			segments: { start: number; end: number; text: string }[];
			start: number;
			end: number;
		}>('transcription_transcribe', {
			audioData: Array.from(segment.data),
			language: this.config.language,
			sampleRate: 16000,
		});

		const processingTime = performance.now() - startTime;
		console.log(`[Transcription] Native processed in ${processingTime.toFixed(2)}ms`);

		const text = result.text?.trim();
		if (!text || text.length < 2) return;

		transcriptionActions.addEntry({
			userId: segment.userId,
			username: segment.username,
			text,
			confidence: 0.9, // Native backend has high confidence
			language: result.language || this.config.language,
			isFinal: true,
		});

		console.log(`[Transcription] ${segment.username}: "${text}"`);
	}

	/**
	 * Transcribe a segment using the WASM Whisper backend
	 */
	private async transcribeSegmentWasm(segment: AudioSegment): Promise<void> {
		if (!this.pipeline) return;

		const startTime = performance.now();

		// Prepare transcription options
		const options: any = {
			chunk_length_s: this.config.chunk_length_s,
			stride_length_s: this.config.stride_length_s,
			return_timestamps: true,
		};

		// Set language if not auto-detecting
		if (!this.config.autoDetectLanguage && this.config.language !== 'auto') {
			options.language = this.config.language;
		}

		// Perform transcription
		const result = await this.pipeline(segment.data, options);

		const processingTime = performance.now() - startTime;
		console.log(`[Transcription] WASM processed in ${processingTime.toFixed(2)}ms`);

		// Extract text and confidence
		const text = result.text?.trim();
		if (!text || text.length < 2) return;

		const confidence = this.calculateConfidence(result);

		if (confidence < this.config.minConfidence) {
			console.log(`[Transcription] Skipping low confidence result: ${confidence.toFixed(2)}`);
			return;
		}

		const detectedLanguage = this.detectLanguage(result) || this.config.language;

		transcriptionActions.addEntry({
			userId: segment.userId,
			username: segment.username,
			text,
			confidence,
			language: detectedLanguage,
			isFinal: true,
		});

		console.log(`[Transcription] ${segment.username}: "${text}" (${confidence.toFixed(2)})`);
	}

	private calculateConfidence(result: any): number {
		// If the model provides confidence scores, use them
		if (result.confidence !== undefined) {
			return result.confidence;
		}

		// Fallback: estimate confidence based on text characteristics
		const text = result.text || '';

		// Longer text generally indicates higher confidence
		const lengthScore = Math.min(text.length / 50, 1);

		// Presence of punctuation suggests higher confidence
		const punctuationScore = /[.!?]/.test(text) ? 0.2 : 0;

		// No repeated characters or gibberish
		const qualityScore = !/(.)\1{3,}/.test(text) && !/[^a-zA-Z0-9\s.,!?'-]/.test(text) ? 0.3 : 0;

		return Math.min(0.5 + lengthScore * 0.3 + punctuationScore + qualityScore, 1.0);
	}

	private detectLanguage(result: any): string | null {
		// If the model provides language detection, use it
		if (result.language) {
			return result.language;
		}

		// Fallback: basic language detection based on character sets
		const text = result.text || '';

		// Check for non-Latin scripts
		if (/[\u4e00-\u9fff]/.test(text)) return 'zh'; // Chinese
		if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // Japanese
		if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // Korean
		if (/[\u0600-\u06ff]/.test(text)) return 'ar'; // Arabic
		if (/[\u0400-\u04ff]/.test(text)) return 'ru'; // Russian

		// For Latin scripts, return the configured language
		return this.config.language;
	}

	/**
	 * Update transcription configuration
	 */
	updateConfig(updates: Partial<TranscriptionConfig>): void {
		this.config = { ...this.config, ...updates };

		if (updates.language && !updates.autoDetectLanguage) {
			transcriptionActions.setLanguage(updates.language);
		}

		if (updates.autoDetectLanguage !== undefined) {
			transcriptionActions.setAutoDetectLanguage(updates.autoDetectLanguage);
		}
	}

	/**
	 * Get available languages
	 */
	getSupportedLanguages(): Record<string, string> {
		return { ...SUPPORTED_LANGUAGES };
	}

	/**
	 * Check if the manager is ready for transcription
	 */
	isReady(): boolean {
		return this.isInitialized && (this.activeBackend === 'native' || this.pipeline !== null);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): TranscriptionConfig {
		return { ...this.config };
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}

		// Stop live transcription if active
		this.stopLive().catch(() => {});

		// Unload native model
		if (this.activeBackend === 'native') {
			import('@tauri-apps/api/core').then(({ invoke }) => {
				invoke('transcription_unload_model').catch(() => {});
			}).catch(() => {});
		}

		// Clean up Tauri event listeners
		if (this.tauriEventUnlisten) {
			this.tauriEventUnlisten();
			this.tauriEventUnlisten = null;
		}

		this.processingQueue = [];
		this.usernames.clear();
		this.audioProcessor = new AudioBufferProcessor();
		this.activeBackend = null;

		this.isInitialized = false;
		transcriptionActions.setReady(false);
	}
}

// Singleton instance for the application
let instance: TranscriptionManager | null = null;

export function getTranscriptionManager(config?: Partial<TranscriptionConfig>): TranscriptionManager {
	if (!instance && browser) {
		instance = new TranscriptionManager(config);
	}
	return instance!;
}

export function destroyTranscriptionManager(): void {
	if (instance) {
		instance.destroy();
		instance = null;
	}
}