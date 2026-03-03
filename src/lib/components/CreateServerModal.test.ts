import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CreateServerModal from './CreateServerModal.svelte';

vi.mock('$lib/stores/servers', () => ({
	createServer: vi.fn(),
	currentServer: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(null);
			return () => {};
		}),
		set: vi.fn()
	}
}));

describe('CreateServerModal', () => {
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

	it('does not render when closed', () => {
		const { container } = render(CreateServerModal, {
			props: { open: false }
		});
		expect(container.querySelector('.modal')).not.toBeInTheDocument();
	});

	it('renders the initial choice step when open', () => {
		render(CreateServerModal, { props: { open: true } });
		expect(screen.getByText('Create My Own')).toBeInTheDocument();
		expect(screen.getByText('Join a Server')).toBeInTheDocument();
	});

	it('shows the title "Add a Server" on initial step', () => {
		render(CreateServerModal, { props: { open: true } });
		expect(screen.getByText('Add a Server')).toBeInTheDocument();
	});

	it('navigates to create step when Create My Own is clicked', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));
		expect(screen.getByText('Customize Your Server')).toBeInTheDocument();
		expect(screen.getByLabelText('SERVER NAME')).toBeInTheDocument();
	});

	it('navigates to join step when Join a Server is clicked', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Join a Server'));
		expect(screen.getByText('Join a Server')).toBeInTheDocument();
		expect(screen.getByLabelText(/INVITE LINK/)).toBeInTheDocument();
	});

	it('shows Back button on create step', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));
		expect(screen.getByText('Back')).toBeInTheDocument();
	});

	it('navigates back to choose step when Back is clicked', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));
		await fireEvent.click(screen.getByText('Back'));
		expect(screen.getByText('Add a Server')).toBeInTheDocument();
	});

	it('disables Create button when server name is empty', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));
		const createBtn = screen.getByText('Create');
		expect(createBtn).toBeDisabled();
	});

	it('enables Create button when server name is entered', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));

		const input = screen.getByLabelText('SERVER NAME');
		await fireEvent.input(input, { target: { value: 'My Server' } });

		const createBtn = screen.getByText('Create');
		expect(createBtn).not.toBeDisabled();
	});

	it('calls createServer when form is submitted', async () => {
		const { createServer } = await import('$lib/stores/servers');
		(createServer as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-123', name: 'My Server' });

		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));

		const input = screen.getByLabelText('SERVER NAME');
		await fireEvent.input(input, { target: { value: 'My Server' } });

		const createBtn = screen.getByText('Create');
		await fireEvent.click(createBtn);

		expect(createServer).toHaveBeenCalledWith('My Server');
	});

	it('shows error when createServer fails', async () => {
		const { createServer } = await import('$lib/stores/servers');
		(createServer as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server limit reached'));

		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));

		const input = screen.getByLabelText('SERVER NAME');
		await fireEvent.input(input, { target: { value: 'My Server' } });

		const createBtn = screen.getByText('Create');
		await fireEvent.click(createBtn);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('Server limit reached');
		});
	});

	it('disables Join Server button when invite code is empty', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Join a Server'));
		const joinBtn = screen.getByText('Join Server');
		expect(joinBtn).toBeDisabled();
	});

	it('shows invite format examples on join step', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Join a Server'));
		expect(screen.getByText('https://hearth.chat/AbCdEf')).toBeInTheDocument();
		expect(screen.getByText('AbCdEf')).toBeInTheDocument();
	});

	it('shows community guidelines hint on create step', async () => {
		render(CreateServerModal, { props: { open: true } });
		await fireEvent.click(screen.getByText('Create My Own'));
		expect(screen.getByText(/Community Guidelines/)).toBeInTheDocument();
	});
});
