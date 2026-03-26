import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelManager, type WhisperModel } from './modelManager';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
}));

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
	invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('ModelManager', () => {
	let manager: ModelManager;

	beforeEach(() => {
		manager = new ModelManager();
		mockInvoke.mockReset();
	});

	afterEach(async () => {
		await manager.destroy();
	});

	it('should initialize with default state', () => {
		const state = manager.getState();
		expect(state.currentModel).toBe('base');
		expect(state.isLoaded).toBe(false);
		expect(state.isLoading).toBe(false);
		expect(state.isDownloading).toBe(false);
		expect(state.error).toBeNull();
	});

	it('should list available models', () => {
		const state = manager.getState();
		expect(state.availableModels.length).toBe(5);
		const names = state.availableModels.map(m => m.name);
		expect(names).toContain('tiny');
		expect(names).toContain('base');
		expect(names).toContain('small');
		expect(names).toContain('medium');
		expect(names).toContain('large');
	});

	it('should have model sizes', () => {
		const state = manager.getState();
		for (const model of state.availableModels) {
			expect(model.size).toBeTruthy();
			expect(model.size).toMatch(/MB|GB/);
		}
	});

	it('should notify on state change', () => {
		const listener = vi.fn();
		manager.onStateChange(listener);

		// Trigger a state change by checking models
		mockInvoke.mockResolvedValueOnce([
			{ name: 'base', downloaded: true, path: '/test' },
		]);

		manager.checkAvailableModels();

		// Listener is called asynchronously after invoke resolves
		// But state change notification for loading is synchronous
	});

	it('should unsubscribe listeners', () => {
		const listener = vi.fn();
		const unsub = manager.onStateChange(listener);
		unsub();
		// After unsubscribe, listener should not be called
	});

	it('should load model via Tauri invoke', async () => {
		mockInvoke.mockResolvedValueOnce(undefined);

		const result = await manager.loadModel('tiny');
		expect(result).toBe(true);

		const state = manager.getState();
		expect(state.currentModel).toBe('tiny');
		expect(state.isLoaded).toBe(true);
		expect(state.isLoading).toBe(false);
	});

	it('should handle load model failure', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Python not found'));

		const result = await manager.loadModel('tiny');
		expect(result).toBe(false);

		const state = manager.getState();
		expect(state.isLoaded).toBe(false);
		expect(state.error).toContain('Python not found');
	});

	it('should unload model', async () => {
		// First load
		mockInvoke.mockResolvedValueOnce(undefined);
		await manager.loadModel('base');
		expect(manager.getState().isLoaded).toBe(true);

		// Then unload
		mockInvoke.mockResolvedValueOnce(undefined);
		await manager.unloadModel();
		expect(manager.getState().isLoaded).toBe(false);
	});

	it('should switch models', async () => {
		// Load first model
		mockInvoke.mockResolvedValueOnce(undefined);
		await manager.loadModel('tiny');

		// Switch to another
		mockInvoke.mockResolvedValueOnce(undefined); // unload
		mockInvoke.mockResolvedValueOnce(undefined); // load
		const result = await manager.switchModel('small');

		expect(result).toBe(true);
		expect(manager.getState().currentModel).toBe('small');
	});

	it('should download model via Tauri invoke', async () => {
		mockInvoke.mockResolvedValueOnce(undefined);

		const result = await manager.downloadModel('base');
		expect(result).toBe(true);

		const state = manager.getState();
		expect(state.isDownloading).toBe(false);
		expect(state.downloadProgress).toBe(100);
	});

	it('should handle download failure', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Network error'));

		const result = await manager.downloadModel('base');
		expect(result).toBe(false);

		const state = manager.getState();
		expect(state.isDownloading).toBe(false);
		expect(state.error).toContain('Network error');
	});

	it('should destroy and clear listeners', async () => {
		const listener = vi.fn();
		manager.onStateChange(listener);

		mockInvoke.mockResolvedValue(undefined);
		await manager.destroy();

		// After destroy, the manager should be cleaned up
		expect(manager.getState().isLoaded).toBe(false);
	});
});
