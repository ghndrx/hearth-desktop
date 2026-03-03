import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import LoadingSpinner from './LoadingSpinner.svelte';

describe('LoadingSpinner', () => {
	describe('rendering', () => {
		it('renders inline spinner by default', () => {
			const { container } = render(LoadingSpinner);

			expect(container.querySelector('.loading-inline')).toBeInTheDocument();
			expect(container.querySelector('.spinner')).toBeInTheDocument();
			expect(container.querySelector('.loading-container')).not.toBeInTheDocument();
		});

		it('renders full screen spinner when fullScreen is true', () => {
			const { container } = render(LoadingSpinner, {
				props: { fullScreen: true }
			});

			expect(container.querySelector('.loading-container')).toBeInTheDocument();
			expect(container.querySelector('.loading-inline')).not.toBeInTheDocument();
		});

		it('renders overlay when overlay is true', () => {
			const { container } = render(LoadingSpinner, {
				props: { fullScreen: true, overlay: true }
			});

			const loadingContainer = container.querySelector('.loading-container');
			expect(loadingContainer).toHaveClass('overlay');
		});
	});

	describe('sizes', () => {
		const sizeTests = [
			{ size: 'xs' as const, spinner: 16, border: 2 },
			{ size: 'sm' as const, spinner: 24, border: 2 },
			{ size: 'md' as const, spinner: 32, border: 3 },
			{ size: 'lg' as const, spinner: 48, border: 3 },
			{ size: 'xl' as const, spinner: 64, border: 4 }
		];

		sizeTests.forEach(({ size, spinner, border }) => {
			it(`renders ${size} size with correct dimensions`, () => {
				const { container } = render(LoadingSpinner, {
					props: { size }
				});

				const spinnerEl = container.querySelector('.spinner') as HTMLElement;
				expect(spinnerEl.style.width).toContain(`${spinner}px`);
				expect(spinnerEl.style.height).toContain(`${spinner}px`);
				expect(spinnerEl.style.borderWidth).toContain(`${border}px`);
			});
		});
	});

	describe('text', () => {
		it('does not render text by default', () => {
			const { container } = render(LoadingSpinner);

			expect(container.querySelector('.loading-text-inline')).not.toBeInTheDocument();
		});

		it('renders text when provided (inline)', () => {
			const { container } = render(LoadingSpinner, {
				props: { text: 'Loading messages...' }
			});

			const text = container.querySelector('.loading-text-inline');
			expect(text).toBeInTheDocument();
			expect(text).toHaveTextContent('Loading messages...');
		});

		it('renders text when provided (fullScreen)', () => {
			const { container } = render(LoadingSpinner, {
				props: { fullScreen: true, text: 'Please wait...' }
			});

			const text = container.querySelector('.loading-text');
			expect(text).toBeInTheDocument();
			expect(text).toHaveTextContent('Please wait...');
		});
	});

	describe('accessibility', () => {
		it('has status role', () => {
			const { container } = render(LoadingSpinner);

			expect(container.querySelector('[role="status"]')).toBeInTheDocument();
		});

		it('has aria-live polite', () => {
			const { container } = render(LoadingSpinner);

			expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
		});

		it('has aria-hidden on spinner element', () => {
			const { container } = render(LoadingSpinner);

			const spinner = container.querySelector('.spinner');
			expect(spinner).toHaveAttribute('aria-hidden', 'true');
		});

		it('has screen reader text with default "Loading"', () => {
			const { container } = render(LoadingSpinner);

			const srOnly = container.querySelector('.sr-only');
			expect(srOnly).toBeInTheDocument();
			expect(srOnly).toHaveTextContent('Loading');
		});

		it('uses custom text for screen reader when provided', () => {
			const { container } = render(LoadingSpinner, {
				props: { text: 'Fetching data' }
			});

			const srOnly = container.querySelector('.sr-only');
			expect(srOnly).toHaveTextContent('Fetching data');
		});
	});
});
