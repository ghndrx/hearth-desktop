import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import UserStatusPicker from './UserStatusPicker.svelte';

// Mock the gateway store
vi.mock('$lib/stores/gateway', () => ({
	gateway: {
		updatePresence: vi.fn(),
	},
}));

// Mock the presence store
vi.mock('$lib/stores/presence', () => ({
	presenceStore: {
		setStatus: vi.fn(),
	},
	getStatusColor: (status: string) => {
		const colors: Record<string, string> = {
			online: '#23a559',
			idle: '#f0b232',
			dnd: '#f23f43',
			invisible: '#80848e',
			offline: '#80848e',
		};
		return colors[status] || '#80848e';
	},
	getStatusLabel: (status: string) => {
		const labels: Record<string, string> = {
			online: 'Online',
			idle: 'Idle',
			dnd: 'Do Not Disturb',
			invisible: 'Invisible',
			offline: 'Offline',
		};
		return labels[status] || 'Offline';
	},
}));

describe('UserStatusPicker', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it('renders when show is true', async () => {
		const { container } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		const menu = container.querySelector('[role="menu"]');
		expect(menu).toBeInTheDocument();
	});

	it('does not render when show is false', async () => {
		const { container } = render(UserStatusPicker, {
			props: {
				show: false,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		const menu = container.querySelector('[role="menu"]');
		expect(menu).not.toBeInTheDocument();
	});

	it('displays all status options', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		expect(getByText('Online')).toBeInTheDocument();
		expect(getByText('Idle')).toBeInTheDocument();
		expect(getByText('Do Not Disturb')).toBeInTheDocument();
		expect(getByText('Invisible')).toBeInTheDocument();
	});

	it('shows custom status button', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		expect(getByText('Set Custom Status')).toBeInTheDocument();
	});

	it('highlights the current status', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'idle',
			},
		});

		const idleOption = getByText('Idle').closest('button');
		expect(idleOption).toHaveClass('selected');
	});

	it('calls gateway.updatePresence when selecting a status', async () => {
		const { gateway } = await import('$lib/stores/gateway');

		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		const dndOption = getByText('Do Not Disturb');
		await fireEvent.click(dndOption);

		expect(gateway.updatePresence).toHaveBeenCalledWith('dnd', false);
	});

	it('sets afk=true when selecting idle status', async () => {
		const { gateway } = await import('$lib/stores/gateway');

		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		const idleOption = getByText('Idle');
		await fireEvent.click(idleOption);

		expect(gateway.updatePresence).toHaveBeenCalledWith('idle', true);
	});

	it('opens custom status input view when clicking custom status button', async () => {
		const { getByText, getByPlaceholderText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		expect(getByPlaceholderText("What's happening?")).toBeInTheDocument();
	});

	it('shows back button in custom status view', async () => {
		const { getByText, getByLabelText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		// Navigate to custom status view
		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		expect(getByLabelText('Back')).toBeInTheDocument();
	});

	it('returns to main view when clicking back button', async () => {
		const { getByText, getByLabelText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		// Navigate to custom status view
		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		// Click back
		const backBtn = getByLabelText('Back');
		await fireEvent.click(backBtn);

		// Should be back on main view with status options
		expect(getByText('Online')).toBeInTheDocument();
		expect(getByText('Idle')).toBeInTheDocument();
	});

	it('allows typing custom status text', async () => {
		const { getByText, getByPlaceholderText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		// Navigate to custom status view
		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		const input = getByPlaceholderText("What's happening?") as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Working on Hearth' } });

		expect(input.value).toBe('Working on Hearth');
	});

	it('shows save button in custom status view', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		// Navigate to custom status view
		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		expect(getByText('Save')).toBeInTheDocument();
	});

	it('shows emoji picker button', async () => {
		const { getByText, getByLabelText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
			},
		});

		// Navigate to custom status view
		const customStatusBtn = getByText('Set Custom Status');
		await fireEvent.click(customStatusBtn);

		expect(getByLabelText('Pick emoji')).toBeInTheDocument();
	});

	it('displays existing custom status text', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
				currentCustomStatus: 'Already busy',
			},
		});

		expect(getByText('Already busy')).toBeInTheDocument();
	});

	it('displays existing emoji', async () => {
		const { getByText } = render(UserStatusPicker, {
			props: {
				show: true,
				anchorX: 100,
				anchorY: 100,
				currentStatus: 'online',
				currentEmoji: '🎮',
			},
		});

		expect(getByText('🎮')).toBeInTheDocument();
	});
});
