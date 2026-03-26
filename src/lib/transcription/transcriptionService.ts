/**
 * TranscriptionService - Real-time speech-to-text using faster-whisper.
 * Captures audio from voice channels, buffers it, sends to backend for transcription,
 * and provides live transcript updates.
 */
import { browser } from '$app/environment';
import { TranscriptionAudioBuffer, type AudioBufferConfig } from './audioBuffer';
import { ModelManager, type WhisperModel } from './modelManager';

export interface TranscriptSegment {
	id: string;
	speakerId: string;
	speakerName: string;
	text: string;
	timestamp: number;
	language?: string;
	isFinal: boolean;
}

export interface TranscriptionConfig {
	/** Language code (e.g., 'en', 'es', 'auto') - default: 'auto' */
	language: string;
	/** Whisper model to use */
	model: WhisperModel;
	/** Audio buffer configuration */
	buffer: Partial<AudioBufferConfig>;
	/** Maximum transcript segments to keep in memory */
	maxSegments: number;
}

const DEFAULT_CONFIG: TranscriptionConfig = {
	language: 'auto',
	model: 'base',
	buffer: {
		bufferDuration: 2,
		vadThreshold: 0.01,
	},
	maxSegments: 500,
};

export const SUPPORTED_LANGUAGES = [
	{ code: 'auto', name: 'Auto-detect' },
	{ code: 'en', name: 'English' },
	{ code: 'zh', name: 'Chinese' },
	{ code: 'de', name: 'German' },
	{ code: 'es', name: 'Spanish' },
	{ code: 'ru', name: 'Russian' },
	{ code: 'ko', name: 'Korean' },
	{ code: 'fr', name: 'French' },
	{ code: 'ja', name: 'Japanese' },
	{ code: 'pt', name: 'Portuguese' },
	{ code: 'tr', name: 'Turkish' },
	{ code: 'pl', name: 'Polish' },
	{ code: 'it', name: 'Italian' },
	{ code: 'nl', name: 'Dutch' },
	{ code: 'ar', name: 'Arabic' },
	{ code: 'sv', name: 'Swedish' },
	{ code: 'hi', name: 'Hindi' },
	{ code: 'uk', name: 'Ukrainian' },
];

type TranscriptionEventType = 'segment' | 'error' | 'stateChange';
type TranscriptionListener = (data: unknown) => void;

export class TranscriptionService {
	private config: TranscriptionConfig;
	private audioBuffer: TranscriptionAudioBuffer;
	private modelManager: ModelManager;
	private segments: TranscriptSegment[] = [];
	private _isActive = false;
	private _isInitialized = false;
	private pendingTranscriptions = 0;
	private segmentCounter = 0;
	private listeners: Map<TranscriptionEventType, Set<TranscriptionListener>> = new Map();
	private audioContext: AudioContext | null = null;
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
	private scriptProcessor: ScriptProcessorNode | null = null;

	constructor(config: Partial<TranscriptionConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.audioBuffer = new TranscriptionAudioBuffer(this.config.buffer);
		this.modelManager = new ModelManager();

		this.audioBuffer.setFlushCallback((audio) => this.processAudioChunk(audio));
	}

	get isActive(): boolean {
		return this._isActive;
	}

	get isInitialized(): boolean {
		return this._isInitialized;
	}

	get isProcessing(): boolean {
		return this.pendingTranscriptions > 0;
	}

	getSegments(): TranscriptSegment[] {
		return [...this.segments];
	}

	getModelManager(): ModelManager {
		return this.modelManager;
	}

	/**
	 * Initialize the service - download/load model if needed.
	 */
	async initialize(): Promise<boolean> {
		if (!browser) return false;
		if (this._isInitialized) return true;

		try {
			const ready = await this.modelManager.ensureModelReady(this.config.model);
			if (!ready) {
				this.emit('error', { message: 'Failed to initialize model' });
				return false;
			}
			this._isInitialized = true;
			this.emit('stateChange', { initialized: true });
			return true;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.emit('error', { message: `Initialization failed: ${msg}` });
			return false;
		}
	}

	/**
	 * Start transcribing audio from a MediaStream (from WebRTC track).
	 */
	async startFromStream(stream: MediaStream, speakerId: string, speakerName: string): Promise<void> {
		if (!browser) return;
		if (!this._isInitialized) {
			const ok = await this.initialize();
			if (!ok) return;
		}

		try {
			this.audioContext = new AudioContext({ sampleRate: 48000 });
			this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

			// Use ScriptProcessorNode to capture raw audio data
			// Buffer size of 4096 at 48kHz = ~85ms chunks
			this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

			this.scriptProcessor.onaudioprocess = (event) => {
				const inputData = event.inputBuffer.getChannelData(0);
				// Copy the data since the buffer gets reused
				const chunk = new Float32Array(inputData.length);
				chunk.set(inputData);
				this.audioBuffer.addChunk(chunk);
			};

			this.mediaStreamSource.connect(this.scriptProcessor);
			this.scriptProcessor.connect(this.audioContext.destination);

			this.audioBuffer.start();
			this._isActive = true;
			this._currentSpeakerId = speakerId;
			this._currentSpeakerName = speakerName;
			this.emit('stateChange', { active: true });
			console.log('[Transcription] Started transcription for', speakerName);
		} catch (error) {
			console.error('[Transcription] Failed to start from stream:', error);
			this.emit('error', { message: 'Failed to capture audio stream' });
		}
	}

	private _currentSpeakerId = '';
	private _currentSpeakerName = '';

	/**
	 * Add audio data manually (e.g., from AudioWorklet or remote tracks).
	 */
	addAudioData(audio: Float32Array, speakerId?: string, speakerName?: string): void {
		if (!this._isActive) return;
		if (speakerId) this._currentSpeakerId = speakerId;
		if (speakerName) this._currentSpeakerName = speakerName;
		this.audioBuffer.addChunk(audio);
	}

	/**
	 * Stop transcription.
	 */
	stop(): void {
		this._isActive = false;
		this.audioBuffer.stop();

		if (this.scriptProcessor) {
			this.scriptProcessor.disconnect();
			this.scriptProcessor = null;
		}
		if (this.mediaStreamSource) {
			this.mediaStreamSource.disconnect();
			this.mediaStreamSource = null;
		}
		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.emit('stateChange', { active: false });
		console.log('[Transcription] Stopped');
	}

	/**
	 * Process a buffered audio chunk - send to backend for transcription.
	 */
	private async processAudioChunk(audio: Float32Array): Promise<void> {
		if (!browser) return;

		this.pendingTranscriptions++;

		try {
			const { invoke } = await import('@tauri-apps/api/core');

			// Send raw audio data to Rust backend for transcription
			const result = await invoke<{
				text: string;
				language: string;
				segments: { start: number; end: number; text: string }[];
			}>('transcription_transcribe', {
				audioData: Array.from(audio),
				language: this.config.language,
				sampleRate: this.audioBuffer['config'].targetSampleRate,
			});

			if (result.text.trim()) {
				const segment: TranscriptSegment = {
					id: `seg-${++this.segmentCounter}`,
					speakerId: this._currentSpeakerId,
					speakerName: this._currentSpeakerName,
					text: result.text.trim(),
					timestamp: Date.now(),
					language: result.language,
					isFinal: true,
				};

				this.segments.push(segment);

				// Trim segments if over limit
				if (this.segments.length > this.config.maxSegments) {
					this.segments = this.segments.slice(-this.config.maxSegments);
				}

				this.emit('segment', segment);
			}
		} catch (error) {
			console.error('[Transcription] Transcribe failed:', error);
			this.emit('error', {
				message: error instanceof Error ? error.message : 'Transcription failed',
			});
		} finally {
			this.pendingTranscriptions--;
		}
	}

	/**
	 * Update transcription configuration.
	 */
	async updateConfig(config: Partial<TranscriptionConfig>): Promise<void> {
		if (config.buffer) {
			this.audioBuffer.updateConfig(config.buffer);
		}

		if (config.model && config.model !== this.config.model) {
			const wasActive = this._isActive;
			if (wasActive) this.stop();
			await this.modelManager.switchModel(config.model);
			this.config.model = config.model;
		}

		if (config.language !== undefined) {
			this.config.language = config.language;
		}

		if (config.maxSegments !== undefined) {
			this.config.maxSegments = config.maxSegments;
		}
	}

	/**
	 * Clear transcript history.
	 */
	clearSegments(): void {
		this.segments = [];
		this.segmentCounter = 0;
	}

	/**
	 * Subscribe to events.
	 */
	on(event: TranscriptionEventType, listener: TranscriptionListener): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(listener);
		return () => this.listeners.get(event)?.delete(listener);
	}

	private emit(event: TranscriptionEventType, data: unknown): void {
		this.listeners.get(event)?.forEach(l => l(data));
	}

	/**
	 * Destroy the service and release all resources.
	 */
	async destroy(): Promise<void> {
		this.stop();
		await this.modelManager.destroy();
		this.listeners.clear();
		this.segments = [];
	}
}

// Singleton
let instance: TranscriptionService | null = null;

export function getTranscriptionService(): TranscriptionService {
	if (!instance && browser) {
		instance = new TranscriptionService();
	}
	return instance!;
}

export function destroyTranscriptionService(): void {
	if (instance) {
		instance.destroy();
		instance = null;
	}
}
