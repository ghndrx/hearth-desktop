import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import Modal from './Modal.svelte';

describe('Modal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock Element.prototype.animate for Svelte transitions in jsdom
		Element.prototype.animate = vi.fn().mockImplementation(() => {
			const animation = {
				onfinish: null as (() => void) | null,
				cancel: vi.fn(),
				finish: vi.fn(),
				play: vi.fn(),
				pause: vi.fn(),
				reverse: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
				finished: Promise.resolve(),
				currentTime: 0,
				playbackRate: 1,
				playState: 'finished',
				startTime: 0,
				timeline: null,
				effect: null,
				id: '',
				pending: false,
				replaceState: 'active',
				persist: vi.fn(),
				commitStyles: vi.fn(),
				updatePlaybackRate: vi.fn()
			};
			Promise.resolve().then(() => {
				if (animation.onfinish) animation.onfinish();
			});
			return animation;
		});
	});

	describe('rendering', () => {
		it('does not render when open is false', () => {
			const { container } = render(Modal, {
				props: { open: false }
			});

			expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
		});

		it('renders when open is true', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();
			expect(container.querySelector('.modal')).toBeInTheDocument();
		});

		it('renders title when provided', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test Title' }
			});

			const title = container.querySelector('#modal-title');
			expect(title).toBeInTheDocument();
			expect(title).toHaveTextContent('Test Title');
		});

		it('renders subtitle when provided', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Title', subtitle: 'Subtitle text' }
			});

			const subtitle = container.querySelector('#modal-subtitle');
			expect(subtitle).toBeInTheDocument();
			expect(subtitle).toHaveTextContent('Subtitle text');
		});

		it('does not render title when not provided', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			expect(container.querySelector('#modal-title')).not.toBeInTheDocument();
		});

		it('renders close button by default', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test' }
			});

			const closeBtn = container.querySelector('.close-btn');
			expect(closeBtn).toBeInTheDocument();
			expect(closeBtn).toHaveAttribute('aria-label', 'Close modal');
		});

		it('hides close button when showCloseButton is false', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test', showCloseButton: false }
			});

			expect(container.querySelector('.close-btn')).not.toBeInTheDocument();
		});
	});

	describe('sizes', () => {
		it('renders small size by default', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			const modal = container.querySelector('.modal');
			expect(modal).toHaveClass('small');
		});

		it('renders large size when specified', () => {
			const { container } = render(Modal, {
				props: { open: true, size: 'large' }
			});

			const modal = container.querySelector('.modal');
			expect(modal).toHaveClass('large');
		});
	});

	describe('accessibility', () => {
		it('has dialog role', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			const modal = container.querySelector('[role="dialog"]');
			expect(modal).toBeInTheDocument();
		});

		it('has aria-modal attribute', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			const modal = container.querySelector('[aria-modal="true"]');
			expect(modal).toBeInTheDocument();
		});

		it('links aria-labelledby to title', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'My Modal' }
			});

			const modal = container.querySelector('[role="dialog"]');
			expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
		});

		it('does not set aria-labelledby without title', () => {
			const { container } = render(Modal, {
				props: { open: true }
			});

			const modal = container.querySelector('[role="dialog"]');
			expect(modal).not.toHaveAttribute('aria-labelledby');
		});

		it('links aria-describedby to subtitle', () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Title', subtitle: 'Description' }
			});

			const modal = container.querySelector('[role="dialog"]');
			expect(modal).toHaveAttribute('aria-describedby', 'modal-subtitle');
		});
	});

	describe('closing', () => {
		it('closes when close button is clicked', async () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test' }
			});

			const closeBtn = container.querySelector('.close-btn') as HTMLButtonElement;
			expect(closeBtn).toBeInTheDocument();

			await fireEvent.click(closeBtn);

			await waitFor(() => {
				expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			});
		});

		it('closes when backdrop is clicked', async () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test' }
			});

			const backdrop = container.querySelector('.modal-backdrop') as HTMLElement;
			await fireEvent.click(backdrop);

			await waitFor(() => {
				expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			});
		});

		it('does not close when modal content is clicked', async () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test' }
			});

			const modal = container.querySelector('.modal') as HTMLElement;
			await fireEvent.click(modal);

			// Modal should still be open
			expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();
		});

		it('closes on Escape key', async () => {
			const { container } = render(Modal, {
				props: { open: true, title: 'Test' }
			});

			await fireEvent.keyDown(window, { key: 'Escape' });

			await waitFor(() => {
				expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			});
		});
	});
});
