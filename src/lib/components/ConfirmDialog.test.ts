import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog.svelte';

describe('ConfirmDialog', () => {
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

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('default props rendering', () => {
		it('renders with default title and button texts when open', () => {
			render(ConfirmDialog, {
				props: { open: true }
			});

			expect(screen.getByText('Are you sure?')).toBeInTheDocument();
			expect(screen.getByText('Cancel')).toBeInTheDocument();
			expect(screen.getByText('Confirm')).toBeInTheDocument();
		});

		it('does not render when open is false', () => {
			const { container } = render(ConfirmDialog, {
				props: { open: false }
			});

			expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
		});
	});

	describe('custom props', () => {
		it('renders custom title', () => {
			render(ConfirmDialog, {
				props: { open: true, title: 'Delete Item?' }
			});

			expect(screen.getByText('Delete Item?')).toBeInTheDocument();
		});

		it('renders custom confirm and cancel text', () => {
			render(ConfirmDialog, {
				props: {
					open: true,
					confirmText: 'Yes, delete',
					cancelText: 'No, go back'
				}
			});

			expect(screen.getByText('Yes, delete')).toBeInTheDocument();
			expect(screen.getByText('No, go back')).toBeInTheDocument();
		});

		it('renders message text when provided', () => {
			render(ConfirmDialog, {
				props: {
					open: true,
					message: 'This action cannot be undone.'
				}
			});

			expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
		});
	});

	describe('message visibility', () => {
		it('displays message paragraph when message is provided', () => {
			const { container } = render(ConfirmDialog, {
				props: {
					open: true,
					message: 'Are you sure you want to proceed?'
				}
			});

			const messageParagraph = container.querySelector('.message');
			expect(messageParagraph).toBeInTheDocument();
			expect(messageParagraph).toHaveTextContent('Are you sure you want to proceed?');
		});

		it('does not render message paragraph when message is empty', () => {
			const { container } = render(ConfirmDialog, {
				props: {
					open: true,
					message: ''
				}
			});

			const messageParagraph = container.querySelector('.message');
			expect(messageParagraph).not.toBeInTheDocument();
		});

		it('does not render message paragraph with default props', () => {
			const { container } = render(ConfirmDialog, {
				props: { open: true }
			});

			const messageParagraph = container.querySelector('.message');
			expect(messageParagraph).not.toBeInTheDocument();
		});
	});

	describe('confirm event', () => {
		it('dispatches confirm event when confirm button is clicked', async () => {
			const user = userEvent.setup();
			const confirmHandler = vi.fn();

			render(ConfirmDialog, {
				props: { open: true },
				events: { confirm: confirmHandler }
			} as any);

			const confirmButton = screen.getByText('Confirm');
			await user.click(confirmButton);

			expect(confirmHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('cancel event', () => {
		it('dispatches cancel event when cancel button is clicked', async () => {
			const user = userEvent.setup();
			const cancelHandler = vi.fn();

			render(ConfirmDialog, {
				props: { open: true },
				events: { cancel: cancelHandler }
			} as any);

			const cancelButton = screen.getByText('Cancel');
			await user.click(cancelButton);

			expect(cancelHandler).toHaveBeenCalledTimes(1);
		});

		it('closes the modal when cancel button is clicked', async () => {
			const user = userEvent.setup();

			const { container } = render(ConfirmDialog, {
				props: { open: true }
			});

			expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();

			const cancelButton = screen.getByText('Cancel');
			await user.click(cancelButton);

			await waitFor(() => {
				expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument();
			});
		});
	});

	describe('danger variant', () => {
		it('adds danger class to confirm button when danger is true', () => {
			const { container } = render(ConfirmDialog, {
				props: { open: true, danger: true }
			});

			const buttons = container.querySelectorAll('.btn');
			const confirmButton = buttons[buttons.length - 1];
			expect(confirmButton).toHaveClass('danger');
			expect(confirmButton).not.toHaveClass('primary');
		});

		it('adds primary class to confirm button when danger is false', () => {
			const { container } = render(ConfirmDialog, {
				props: { open: true, danger: false }
			});

			const buttons = container.querySelectorAll('.btn');
			const confirmButton = buttons[buttons.length - 1];
			expect(confirmButton).toHaveClass('primary');
			expect(confirmButton).not.toHaveClass('danger');
		});
	});

	describe('loading state', () => {
		it('shows "Please wait..." text when loading', () => {
			render(ConfirmDialog, {
				props: { open: true, loading: true }
			});

			expect(screen.getByText('Please wait...')).toBeInTheDocument();
			expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
		});

		it('disables both buttons when loading', () => {
			render(ConfirmDialog, {
				props: { open: true, loading: true }
			});

			const cancelButton = screen.getByText('Cancel');
			const confirmArea = screen.getByText('Please wait...');
			const confirmButton = confirmArea.closest('button');

			expect(cancelButton).toBeDisabled();
			expect(confirmButton).toBeDisabled();
		});

		it('does not dispatch confirm event when loading', async () => {
			const user = userEvent.setup();
			const confirmHandler = vi.fn();

			render(ConfirmDialog, {
				props: { open: true, loading: true },
				events: { confirm: confirmHandler }
			} as any);

			const confirmArea = screen.getByText('Please wait...');
			const confirmButton = confirmArea.closest('button') as HTMLElement;
			await user.click(confirmButton);

			expect(confirmHandler).not.toHaveBeenCalled();
		});

		it('does not dispatch cancel event when loading', async () => {
			const user = userEvent.setup();
			const cancelHandler = vi.fn();

			render(ConfirmDialog, {
				props: { open: true, loading: true },
				events: { cancel: cancelHandler }
			} as any);

			const cancelButton = screen.getByText('Cancel');
			await user.click(cancelButton);

			expect(cancelHandler).not.toHaveBeenCalled();
		});
	});
});
