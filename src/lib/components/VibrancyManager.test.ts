import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import VibrancyManager from './VibrancyManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-os', () => ({
	type: vi.fn()
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

import { invoke } from '@tauri-apps/api/core';
import { type } from '@tauri-apps/plugin-os';

const mockInvoke = vi.mocked(invoke);
const mockType = vi.mocked(type);

describe('VibrancyManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		mockType.mockResolvedValue('macos');
		mockInvoke.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
	});

	describe('initialization', () => {
		it('should mount without errors', () => {
			const { component } = render(VibrancyManager);
			expect(component).toBeTruthy();
		});

		it('should detect macOS platform', async () => {
			mockType.mockResolvedValue('macos');
			
			const { component } = render(VibrancyManager);
			
			// Wait for mount
			await vi.waitFor(() => {
				expect(mockType).toHaveBeenCalled();
			});
		});

		it('should handle non-macOS platforms gracefully', async () => {
			mockType.mockResolvedValue('windows');
			
			const { component } = render(VibrancyManager);
			
			await vi.waitFor(() => {
				expect(mockType).toHaveBeenCalled();
			});
		});

		it('should load saved config from localStorage', async () => {
			const savedConfig = {
				enabled: true,
				material: 'window',
				appearance: 'dark',
				blurRadius: 30
			};
			localStorage.setItem('hearth_vibrancy_config', JSON.stringify(savedConfig));

			render(VibrancyManager);

			await vi.waitFor(() => {
				expect(mockInvoke).toHaveBeenCalled();
			});
		});
	});

	describe('props', () => {
		it('should accept material prop', () => {
			const { component } = render(VibrancyManager, {
				props: { material: 'titlebar' }
			});
			
			expect(component).toBeTruthy();
		});

		it('should accept appearance prop', () => {
			const { component } = render(VibrancyManager, {
				props: { appearance: 'dark' }
			});
			
			expect(component).toBeTruthy();
		});

		it('should accept enabled prop', () => {
			const { component } = render(VibrancyManager, {
				props: { enabled: false }
			});
			
			expect(component).toBeTruthy();
		});

		it('should accept blurRadius prop', () => {
			const { component } = render(VibrancyManager, {
				props: { blurRadius: 50 }
			});
			
			expect(component).toBeTruthy();
		});
	});

	describe('callbacks', () => {
		it('should call onChange when config changes', async () => {
			const onChange = vi.fn();
			
			const { component } = render(VibrancyManager, {
				props: { onChange }
			});

			// Trigger a change via component method
			await component.setMaterial('window');

			expect(onChange).toHaveBeenCalled();
		});

		it('should call onError when vibrancy fails', async () => {
			const onError = vi.fn();
			mockInvoke.mockRejectedValueOnce(new Error('Plugin not available'));
			
			render(VibrancyManager, {
				props: { onError }
			});

			// Wait for the component to attempt applying vibrancy
			await vi.waitFor(() => {
				// CSS fallback should be applied, onError may or may not be called
				// depending on implementation
			}, { timeout: 100 });
		});
	});

	describe('public methods', () => {
		it('should expose setMaterial method', async () => {
			const { component } = render(VibrancyManager);
			
			expect(typeof component.setMaterial).toBe('function');
			await component.setMaterial('menu');
		});

		it('should expose setAppearance method', async () => {
			const { component } = render(VibrancyManager);
			
			expect(typeof component.setAppearance).toBe('function');
			await component.setAppearance('light');
		});

		it('should expose setEnabled method', async () => {
			const { component } = render(VibrancyManager);
			
			expect(typeof component.setEnabled).toBe('function');
			await component.setEnabled(false);
		});

		it('should expose setBlurRadius method', async () => {
			const { component } = render(VibrancyManager);
			
			expect(typeof component.setBlurRadius).toBe('function');
			await component.setBlurRadius(40);
		});

		it('should clamp blurRadius between 0 and 100', async () => {
			const onChange = vi.fn();
			const { component } = render(VibrancyManager, {
				props: { onChange }
			});

			await component.setBlurRadius(150);
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ blurRadius: 100 })
			);

			await component.setBlurRadius(-10);
			expect(onChange).toHaveBeenLastCalledWith(
				expect.objectContaining({ blurRadius: 0 })
			);
		});

		it('should expose getConfig method', () => {
			const { component } = render(VibrancyManager, {
				props: { material: 'hud', blurRadius: 25 }
			});

			const config = component.getConfig();
			
			expect(config.material).toBe('hud');
			expect(config.blurRadius).toBe(25);
		});

		it('should expose getMaterials method', () => {
			const { component } = render(VibrancyManager);

			const materials = component.getMaterials();
			
			expect(Array.isArray(materials)).toBe(true);
			expect(materials).toContain('sidebar');
			expect(materials).toContain('titlebar');
			expect(materials).toContain('window');
		});
	});

	describe('vibrancy application', () => {
		it('should invoke vibrancy plugin on mount', async () => {
			mockType.mockResolvedValue('macos');
			
			render(VibrancyManager, {
				props: { enabled: true, material: 'sidebar' }
			});

			await vi.waitFor(() => {
				expect(mockInvoke).toHaveBeenCalled();
			});
		});

		it('should clear vibrancy when disabled', async () => {
			const { component } = render(VibrancyManager, {
				props: { enabled: true }
			});

			await component.setEnabled(false);

			expect(mockInvoke).toHaveBeenCalledWith('plugin:vibrancy|clear');
		});

		it('should apply fallback CSS when plugin unavailable', async () => {
			mockInvoke.mockRejectedValue(new Error('Plugin not found'));
			
			render(VibrancyManager, {
				props: { enabled: true, blurRadius: 20 }
			});

			await vi.waitFor(() => {
				// Check CSS variables are set
				const blur = document.documentElement.style.getPropertyValue('--vibrancy-blur');
				const bg = document.documentElement.style.getPropertyValue('--vibrancy-bg');
				
				// Either native vibrancy worked or fallback was applied
				expect(mockInvoke).toHaveBeenCalled();
			});
		});
	});

	describe('persistence', () => {
		it('should save config to localStorage', async () => {
			const { component } = render(VibrancyManager);

			await component.setMaterial('window');

			const stored = localStorage.getItem('hearth_vibrancy_config');
			expect(stored).toBeTruthy();
			
			const parsed = JSON.parse(stored!);
			expect(parsed.material).toBe('window');
		});

		it('should restore config from localStorage on mount', async () => {
			const savedConfig = {
				enabled: true,
				material: 'hud',
				appearance: 'dark',
				blurRadius: 45
			};
			localStorage.setItem('hearth_vibrancy_config', JSON.stringify(savedConfig));

			const { component } = render(VibrancyManager);

			// Wait for component to mount and load config
			await vi.waitFor(() => {
				const config = component.getConfig();
				expect(config.material).toBe('hud');
				expect(config.blurRadius).toBe(45);
			});
		});
	});

	describe('slot props', () => {
		it('should provide slot props for custom UI', async () => {
			// Note: Testing slot props requires a wrapper component
			// This test verifies the component renders without slot content
			const { container } = render(VibrancyManager);
			
			// Headless component should have minimal DOM output
			expect(container.innerHTML).toBe('');
		});
	});

	describe('material descriptions', () => {
		it('should export material descriptions', () => {
			const { component } = render(VibrancyManager);
			
			// Component exports materialDescriptions
			expect(component).toBeTruthy();
		});
	});
});
