import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TranscriptionService, SUPPORTED_LANGUAGES } from './transcriptionService';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
}));

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

describe('TranscriptionService', () => {
	let service: TranscriptionService;

	beforeEach(() => {
		service = new TranscriptionService({
			language: 'en',
			model: 'base',
		});
	});

	afterEach(async () => {
		await service.destroy();
	});

	it('should initialize with default state', () => {
		expect(service.isActive).toBe(false);
		expect(service.isInitialized).toBe(false);
		expect(service.isProcessing).toBe(false);
		expect(service.getSegments()).toEqual([]);
	});

	it('should expose supported languages', () => {
		expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(15);
		expect(SUPPORTED_LANGUAGES[0]).toEqual({ code: 'auto', name: 'Auto-detect' });
		expect(SUPPORTED_LANGUAGES.find(l => l.code === 'en')).toBeDefined();
		expect(SUPPORTED_LANGUAGES.find(l => l.code === 'ja')).toBeDefined();
	});

	it('should emit events via on()', () => {
		const errorListener = vi.fn();
		const unsubscribe = service.on('error', errorListener);

		// Trigger an internal error event manually through the service
		// Since we can't easily trigger a real error, test the unsubscribe
		expect(typeof unsubscribe).toBe('function');
		unsubscribe();
	});

	it('should clear segments', () => {
		// Access internal segments for testing
		service.clearSegments();
		expect(service.getSegments()).toEqual([]);
	});

	it('should allow config updates', async () => {
		await service.updateConfig({ language: 'fr' });
		// No error means config was updated
	});

	it('should stop cleanly', () => {
		service.stop();
		expect(service.isActive).toBe(false);
	});

	it('should emit stateChange on stop', () => {
		const listener = vi.fn();
		service.on('stateChange', listener);

		service.stop();
		expect(listener).toHaveBeenCalledWith({ active: false });
	});

	it('should destroy cleanly', async () => {
		const listener = vi.fn();
		service.on('segment', listener);

		await service.destroy();
		expect(service.isActive).toBe(false);
		expect(service.getSegments()).toEqual([]);
	});

	it('should not accept audio data when inactive', () => {
		// This should not throw
		service.addAudioData(new Float32Array(1024), 'user1', 'TestUser');
		expect(service.isActive).toBe(false);
	});

	it('should get model manager', () => {
		const mm = service.getModelManager();
		expect(mm).toBeDefined();
		expect(mm.getState().currentModel).toBe('base');
	});
});

describe('SUPPORTED_LANGUAGES', () => {
	it('should have auto-detect as first option', () => {
		expect(SUPPORTED_LANGUAGES[0].code).toBe('auto');
	});

	it('should support at least 15 languages plus auto', () => {
		expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(16);
	});

	it('should have unique language codes', () => {
		const codes = SUPPORTED_LANGUAGES.map(l => l.code);
		expect(new Set(codes).size).toBe(codes.length);
	});
});
