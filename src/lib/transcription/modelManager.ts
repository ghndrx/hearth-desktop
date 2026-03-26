/**
 * ModelManager - Manages Whisper model loading, downloading, and lifecycle.
 * Communicates with the Rust backend for model operations.
 */
import { browser } from '$app/environment';

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

export interface ModelInfo {
	name: WhisperModel;
	size: string;
	downloaded: boolean;
	path?: string;
}

export interface ModelManagerState {
	currentModel: WhisperModel;
	isLoaded: boolean;
	isLoading: boolean;
	isDownloading: boolean;
	downloadProgress: number;
	error: string | null;
	availableModels: ModelInfo[];
}

const MODEL_SIZES: Record<WhisperModel, string> = {
	tiny: '~75 MB',
	base: '~145 MB',
	small: '~484 MB',
	medium: '~1.5 GB',
	large: '~3.1 GB',
};

export class ModelManager {
	private state: ModelManagerState = {
		currentModel: 'base',
		isLoaded: false,
		isLoading: false,
		isDownloading: false,
		downloadProgress: 0,
		error: null,
		availableModels: Object.entries(MODEL_SIZES).map(([name, size]) => ({
			name: name as WhisperModel,
			size,
			downloaded: false,
		})),
	};

	private stateListeners: Set<(state: ModelManagerState) => void> = new Set();

	getState(): ModelManagerState {
		return { ...this.state };
	}

	onStateChange(listener: (state: ModelManagerState) => void): () => void {
		this.stateListeners.add(listener);
		return () => this.stateListeners.delete(listener);
	}

	private notify(): void {
		const snapshot = this.getState();
		this.stateListeners.forEach(l => l(snapshot));
	}

	/**
	 * Check which models are available locally.
	 */
	async checkAvailableModels(): Promise<ModelInfo[]> {
		if (!browser) return this.state.availableModels;

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			const result = await invoke<{ name: string; downloaded: boolean; path?: string }[]>(
				'transcription_list_models'
			);

			this.state.availableModels = result.map(m => ({
				name: m.name as WhisperModel,
				size: MODEL_SIZES[m.name as WhisperModel] || 'Unknown',
				downloaded: m.downloaded,
				path: m.path,
			}));
			this.notify();
		} catch (error) {
			console.error('[Transcription] Failed to check models:', error);
		}

		return this.state.availableModels;
	}

	/**
	 * Download a model if not already present.
	 */
	async downloadModel(model: WhisperModel): Promise<boolean> {
		if (!browser) return false;

		this.state.isDownloading = true;
		this.state.downloadProgress = 0;
		this.state.error = null;
		this.notify();

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('transcription_download_model', { model });

			// Update model list
			const modelInfo = this.state.availableModels.find(m => m.name === model);
			if (modelInfo) {
				modelInfo.downloaded = true;
			}

			this.state.isDownloading = false;
			this.state.downloadProgress = 100;
			this.notify();
			return true;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('[Transcription] Model download failed:', msg);
			this.state.isDownloading = false;
			this.state.error = `Failed to download model: ${msg}`;
			this.notify();
			return false;
		}
	}

	/**
	 * Load a model for inference.
	 */
	async loadModel(model?: WhisperModel): Promise<boolean> {
		if (!browser) return false;

		const targetModel = model || this.state.currentModel;

		this.state.isLoading = true;
		this.state.error = null;
		this.notify();

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('transcription_load_model', { model: targetModel });

			this.state.currentModel = targetModel;
			this.state.isLoaded = true;
			this.state.isLoading = false;
			this.notify();
			console.log(`[Transcription] Model '${targetModel}' loaded`);
			return true;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('[Transcription] Failed to load model:', msg);
			this.state.isLoading = false;
			this.state.error = `Failed to load model: ${msg}`;
			this.notify();
			return false;
		}
	}

	/**
	 * Unload the current model to free memory.
	 */
	async unloadModel(): Promise<void> {
		if (!browser || !this.state.isLoaded) return;

		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('transcription_unload_model');

			this.state.isLoaded = false;
			this.notify();
			console.log('[Transcription] Model unloaded');
		} catch (error) {
			console.error('[Transcription] Failed to unload model:', error);
		}
	}

	/**
	 * Switch to a different model (unloads current, loads new).
	 */
	async switchModel(model: WhisperModel): Promise<boolean> {
		await this.unloadModel();
		return this.loadModel(model);
	}

	/**
	 * Ensure a model is downloaded and loaded, downloading if needed.
	 */
	async ensureModelReady(model?: WhisperModel): Promise<boolean> {
		const targetModel = model || this.state.currentModel;

		await this.checkAvailableModels();
		const modelInfo = this.state.availableModels.find(m => m.name === targetModel);

		if (!modelInfo?.downloaded) {
			const downloaded = await this.downloadModel(targetModel);
			if (!downloaded) return false;
		}

		if (!this.state.isLoaded || this.state.currentModel !== targetModel) {
			return this.loadModel(targetModel);
		}

		return true;
	}

	/**
	 * Clean up resources.
	 */
	async destroy(): Promise<void> {
		await this.unloadModel();
		this.stateListeners.clear();
	}
}
