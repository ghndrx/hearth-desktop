import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
}));

// Mock voice store - all fns defined inline since vi.mock is hoisted
vi.mock('$lib/stores/voice', () => ({
	transcriptionActions: {
		setInitializing: vi.fn(),
		setReady: vi.fn(),
		setEnabled: vi.fn(),
		setError: vi.fn(),
		addEntry: vi.fn(),
		setLanguage: vi.fn(),
		setAutoDetectLanguage: vi.fn(),
		updateSettings: vi.fn(),
		clearEntries: vi.fn(),
		clearError: vi.fn(),
		init: vi.fn(),
		updateEntry: vi.fn(),
	},
	transcriptionState: {
		subscribe: vi.fn(() => vi.fn()),
	},
}));

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn().mockResolvedValue(vi.fn()),
}));

// Mock @xenova/transformers
vi.mock('@xenova/transformers', () => ({
	pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({ text: 'Hello world' })),
}));

import { TranscriptionManager } from './TranscriptionManager';
import { transcriptionActions } from '$lib/stores/voice';

// Get mock references after import
const mockInvoke = vi.mocked((await import('@tauri-apps/api/core')).invoke);
const mockListen = vi.mocked((await import('@tauri-apps/api/event')).listen);
const mockTranscriptionActions = vi.mocked(transcriptionActions);

describe('TranscriptionManager', () => {
	let manager: TranscriptionManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new TranscriptionManager({
			backend: 'native',
			nativeModel: 'base',
			language: 'en',
		});
	});

	afterEach(() => {
		manager.destroy();
	});

	it('should initialize with default state', () => {
		expect(manager.isReady()).toBe(false);
		expect(manager.getActiveBackend()).toBeNull();
	});

	it('should return supported languages', () => {
		const langs = manager.getSupportedLanguages();
		expect(Object.keys(langs).length).toBeGreaterThanOrEqual(15);
		expect(langs['en']).toBe('English');
		expect(langs['ja']).toBe('Japanese');
		expect(langs['tr']).toBe('Turkish');
		expect(langs['uk']).toBe('Ukrainian');
	});

	it('should initialize with native backend when available', async () => {
		mockInvoke.mockResolvedValueOnce(undefined); // transcription_load_model

		await manager.initialize();

		expect(mockInvoke).toHaveBeenCalledWith('transcription_load_model', { model: 'base' });
		expect(manager.isReady()).toBe(true);
		expect(manager.getActiveBackend()).toBe('native');
		expect(mockTranscriptionActions.setReady).toHaveBeenCalledWith(true);
	});

	it('should fall back to WASM when native fails', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Python not found'));

		await manager.initialize();

		expect(manager.isReady()).toBe(true);
		expect(manager.getActiveBackend()).toBe('wasm');
	});

	it('should set up Tauri event listeners on native init', async () => {
		mockInvoke.mockResolvedValueOnce(undefined);

		await manager.initialize();

		expect(mockListen).toHaveBeenCalledWith(
			'transcription:live-segment',
			expect.any(Function),
		);
	});

	it('should process audio when initialized', async () => {
		mockInvoke.mockResolvedValueOnce(undefined); // load model
		await manager.initialize();

		// Process audio - should not throw when initialized
		const audio = new Float32Array(16000); // 1 second of audio
		for (let i = 0; i < audio.length; i++) {
			audio[i] = (Math.random() - 0.5) * 0.2;
		}

		await manager.processAudio('user1', audio, 'TestUser');
		// No error means success
	});

	it('should not process audio when not initialized', async () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await manager.processAudio('user1', new Float32Array(1024), 'TestUser');

		expect(consoleSpy).toHaveBeenCalledWith('[Transcription] Manager not initialized');
		consoleSpy.mockRestore();
	});

	it('should start live transcription on native backend', async () => {
		mockInvoke.mockResolvedValueOnce(undefined); // load model
		await manager.initialize();

		mockInvoke.mockResolvedValueOnce(undefined); // start live
		await manager.startLive();

		expect(mockInvoke).toHaveBeenCalledWith('transcription_start_live', {
			model: 'base',
			language: 'en',
			sampleRate: 16000,
		});
	});

	it('should stop live transcription', async () => {
		mockInvoke.mockResolvedValueOnce(undefined); // load model
		await manager.initialize();

		mockInvoke.mockResolvedValueOnce(undefined); // stop live
		await manager.stopLive();

		expect(mockInvoke).toHaveBeenCalledWith('transcription_stop_live');
	});

	it('should check live status', async () => {
		mockInvoke.mockResolvedValueOnce(undefined); // load model
		await manager.initialize();

		mockInvoke.mockResolvedValueOnce(true);
		const isActive = await manager.isLiveActive();
		expect(isActive).toBe(true);
	});

	it('should update config', () => {
		manager.updateConfig({ language: 'fr' });
		const config = manager.getConfig();
		expect(config.language).toBe('fr');
	});

	it('should update language in store when config changes', () => {
		manager.updateConfig({ language: 'es', autoDetectLanguage: false });
		expect(mockTranscriptionActions.setLanguage).toHaveBeenCalledWith('es');
		expect(mockTranscriptionActions.setAutoDetectLanguage).toHaveBeenCalledWith(false);
	});

	it('should destroy cleanly', async () => {
		mockInvoke.mockResolvedValue(undefined);
		await manager.initialize();

		manager.destroy();

		expect(manager.isReady()).toBe(false);
		expect(manager.getActiveBackend()).toBeNull();
		expect(mockTranscriptionActions.setReady).toHaveBeenCalledWith(false);
	});

	it('should not start live on WASM backend', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Python not found')); // force WASM fallback
		await manager.initialize();

		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await manager.startLive();

		expect(consoleSpy).toHaveBeenCalledWith(
			'[Transcription] Live mode only available with native backend'
		);
		consoleSpy.mockRestore();
	});
});

describe('TranscriptionManager - WASM only mode', () => {
	let manager: TranscriptionManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new TranscriptionManager({
			backend: 'wasm',
			modelName: 'Xenova/whisper-tiny',
		});
	});

	afterEach(() => {
		manager.destroy();
	});

	it('should initialize directly to WASM backend', async () => {
		await manager.initialize();

		expect(manager.isReady()).toBe(true);
		expect(manager.getActiveBackend()).toBe('wasm');
	});

	it('should return false for isLiveActive on WASM', async () => {
		await manager.initialize();
		const result = await manager.isLiveActive();
		expect(result).toBe(false);
	});
});
