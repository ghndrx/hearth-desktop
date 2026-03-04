import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ThemePreviewCard from './ThemePreviewCard.svelte';

describe('ThemePreviewCard', () => {
	it('renders with default props', () => {
		const { container } = render(ThemePreviewCard);
		expect(container.querySelector('.theme-preview-card')).toBeTruthy();
		expect(container.querySelector('.theme-name')?.textContent).toBe('Dark');
	});

	it('renders light theme correctly', () => {
		const { container } = render(ThemePreviewCard, {
			props: { theme: 'light' }
		});
		expect(container.querySelector('.theme-name')?.textContent).toBe('Light');
	});

	it('renders midnight theme correctly', () => {
		const { container } = render(ThemePreviewCard, {
			props: { theme: 'midnight' }
		});
		expect(container.querySelector('.theme-name')?.textContent).toBe('Midnight');
	});

	it('shows selected state', () => {
		const { container } = render(ThemePreviewCard, {
			props: { selected: true }
		});
		expect(container.querySelector('.theme-preview-card')?.classList.contains('selected')).toBe(true);
		expect(container.querySelector('.theme-check')).toBeTruthy();
	});

	it('emits select event on click when interactive', async () => {
		const { component, container } = render(ThemePreviewCard, {
			props: { theme: 'light', interactive: true }
		});
		
		const mockHandler = vi.fn();
		component.$on('select', mockHandler);
		
		const card = container.querySelector('.theme-preview-card');
		await fireEvent.click(card!);
		
		expect(mockHandler).toHaveBeenCalled();
		expect(mockHandler.mock.calls[0][0].detail.theme).toBe('light');
	});

	it('does not emit event when not interactive', async () => {
		const { component, container } = render(ThemePreviewCard, {
			props: { interactive: false }
		});
		
		const mockHandler = vi.fn();
		component.$on('select', mockHandler);
		
		const card = container.querySelector('.theme-preview-card');
		await fireEvent.click(card!);
		
		expect(mockHandler).not.toHaveBeenCalled();
	});

	it('applies compact mode styles', () => {
		const { container } = render(ThemePreviewCard, {
			props: { compactMode: true, messageDisplay: 'compact' }
		});
		expect(container.querySelector('.preview-messages')?.classList.contains('compact')).toBe(true);
	});

	it('has correct ARIA attributes', () => {
		const { container } = render(ThemePreviewCard, {
			props: { theme: 'dark', selected: true, interactive: true }
		});
		const card = container.querySelector('.theme-preview-card');
		expect(card?.getAttribute('role')).toBe('button');
		expect(card?.getAttribute('aria-pressed')).toBe('true');
		expect(card?.getAttribute('aria-label')).toBe('Select Dark theme');
	});
});
