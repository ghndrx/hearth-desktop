import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AppearanceSettings from './AppearanceSettings.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockRejectedValue(new Error('not in tauri'))
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn().mockRejectedValue(new Error('not in tauri'))
}));

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
	browser: true
}));

describe('AppearanceSettings', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('renders the heading', () => {
		render(AppearanceSettings);
		expect(screen.getByText('Appearance')).toBeTruthy();
	});

	it('renders all three theme options', () => {
		render(AppearanceSettings);
		expect(screen.getByText('Dark')).toBeTruthy();
		expect(screen.getByText('Light')).toBeTruthy();
		expect(screen.getByText('Midnight')).toBeTruthy();
	});

	it('renders message display options', () => {
		render(AppearanceSettings);
		expect(screen.getByText('Cozy')).toBeTruthy();
		expect(screen.getByText('Compact')).toBeTruthy();
	});

	it('renders font size slider', () => {
		render(AppearanceSettings);
		const slider = screen.getByLabelText('Font size');
		expect(slider).toBeTruthy();
		expect(slider).toHaveAttribute('type', 'range');
		expect(slider).toHaveAttribute('min', '12');
		expect(slider).toHaveAttribute('max', '24');
	});

	it('renders toggle switches', () => {
		render(AppearanceSettings);
		expect(screen.getByText('Compact Mode')).toBeTruthy();
		expect(screen.getByText('Enable Animations')).toBeTruthy();
	});

	it('renders font preview text', () => {
		render(AppearanceSettings);
		expect(screen.getByText('The quick brown fox jumps over the lazy dog.')).toBeTruthy();
	});

	it('renders reset button', () => {
		render(AppearanceSettings);
		expect(screen.getByText('Reset to Defaults')).toBeTruthy();
	});

	it('renders window opacity slider', () => {
		render(AppearanceSettings);
		const slider = screen.getByLabelText('Window opacity');
		expect(slider).toBeTruthy();
		expect(slider).toHaveAttribute('min', '50');
		expect(slider).toHaveAttribute('max', '100');
	});

	it('has accessible theme buttons with aria-pressed', () => {
		render(AppearanceSettings);
		const darkBtn = screen.getByLabelText('Select Dark theme');
		expect(darkBtn).toHaveAttribute('aria-pressed');
	});

	it('has accessible toggle switches with role=switch', () => {
		render(AppearanceSettings);
		const switches = screen.getAllByRole('switch');
		expect(switches.length).toBe(2);
	});
});
