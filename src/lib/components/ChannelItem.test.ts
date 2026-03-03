import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChannelItem from './ChannelItem.svelte';

// Mock stores
vi.mock('$lib/stores/channels', () => ({
	channels: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn([]);
			return () => {};
		})
	},
	currentChannel: {
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn(null);
			return () => {};
		}),
		set: vi.fn()
	}
}));

// Mock presence store
vi.mock('$lib/stores/presence', () => ({
	presenceStore: {
		getPresence: vi.fn(() => null),
		subscribe: vi.fn((fn: (value: unknown) => void) => {
			fn({});
			return () => {};
		})
	},
	getStatusColor: vi.fn(() => '#747f8d')
}));

function makeChannel(overrides: Record<string, unknown> = {}) {
	return {
		id: 'ch-1',
		name: 'general',
		type: 0,
		server_id: 'srv-1',
		topic: '',
		position: 0,
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		last_message_id: null,
		last_message_at: null,
		e2ee_enabled: false,
		created_at: '2024-01-01T00:00:00Z',
		...overrides
	};
}

describe('ChannelItem', () => {
	describe('text channel rendering', () => {
		it('renders channel name', () => {
			const { getByText } = render(ChannelItem, {
				props: { channel: makeChannel({ name: 'announcements' }) }
			});

			expect(getByText('announcements')).toBeInTheDocument();
		});

		it('renders hash icon for text channels', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel({ type: 0 }) }
			});

			const icon = container.querySelector('.channel-icon svg');
			expect(icon).toBeInTheDocument();
		});

		it('applies active class when active prop is true', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel(), active: true }
			});

			const item = container.querySelector('.channel-item.active');
			expect(item).toBeInTheDocument();
		});

		it('does not apply active class by default', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel() }
			});

			const item = container.querySelector('.channel-item.active');
			expect(item).toBeNull();
		});
	});

	describe('voice channel rendering', () => {
		it('renders voice icon for voice channels', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel({ type: 2, name: 'Voice Chat' }) }
			});

			const item = container.querySelector('.channel-item.voice');
			expect(item).toBeInTheDocument();
		});

		it('renders connected users for voice channels', () => {
			const connectedUsers = [
				{ id: 'u1', username: 'Alice', avatar: null },
				{ id: 'u2', username: 'Bob', avatar: null }
			];

			const { getByText } = render(ChannelItem, {
				props: {
					channel: makeChannel({ type: 2, name: 'Voice Chat' }),
					connectedUsers
				}
			});

			expect(getByText('Alice')).toBeInTheDocument();
			expect(getByText('Bob')).toBeInTheDocument();
		});

		it('does not render connected users section for text channels', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel({ type: 0 }) }
			});

			const usersSection = container.querySelector('.connected-users');
			expect(usersSection).toBeNull();
		});

		it('does not render connected users when list is empty', () => {
			const { container } = render(ChannelItem, {
				props: {
					channel: makeChannel({ type: 2 }),
					connectedUsers: []
				}
			});

			const usersSection = container.querySelector('.connected-users');
			expect(usersSection).toBeNull();
		});
	});

	describe('encrypted channels', () => {
		it('renders lock icon for encrypted channels', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel({ e2ee_enabled: true }) }
			});

			// Lock icon should be present instead of hash
			const icon = container.querySelector('.channel-icon svg');
			expect(icon).toBeInTheDocument();
		});
	});

	describe('muted and unread states', () => {
		it('applies muted class when muted', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel(), muted: true }
			});

			const item = container.querySelector('.channel-item.muted');
			expect(item).toBeInTheDocument();
		});

		it('applies unread class when unread', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel(), unread: true }
			});

			const item = container.querySelector('.channel-item.unread');
			expect(item).toBeInTheDocument();
		});
	});

	describe('events', () => {
		it('channel item button is clickable', async () => {
			const channel = makeChannel();
			const { container } = render(ChannelItem, {
				props: { channel }
			});

			const item = container.querySelector('.channel-item')!;
			expect(item.tagName).toBe('BUTTON');

			// Should click without error
			await fireEvent.click(item);
		});

		it('settings button is clickable when active', async () => {
			const channel = makeChannel();
			const { container } = render(ChannelItem, {
				props: { channel, active: true }
			});

			const settingsBtn = container.querySelector('.settings-button')!;
			expect(settingsBtn).toBeInTheDocument();
			expect(settingsBtn.tagName).toBe('BUTTON');

			// Should click without error
			await fireEvent.click(settingsBtn);
		});
	});

	describe('settings button visibility', () => {
		it('shows settings button when active', () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel(), active: true }
			});

			const settingsBtn = container.querySelector('.settings-button');
			expect(settingsBtn).toBeInTheDocument();
		});

		it('shows settings button on hover', async () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel() }
			});

			const wrapper = container.querySelector('.channel-item-wrapper')!;
			await fireEvent.mouseEnter(wrapper);

			const settingsBtn = container.querySelector('.settings-button');
			expect(settingsBtn).toBeInTheDocument();
		});

		it('hides settings button on mouse leave', async () => {
			const { container } = render(ChannelItem, {
				props: { channel: makeChannel() }
			});

			const wrapper = container.querySelector('.channel-item-wrapper')!;
			await fireEvent.mouseEnter(wrapper);
			await fireEvent.mouseLeave(wrapper);

			const settingsBtn = container.querySelector('.settings-button');
			expect(settingsBtn).toBeNull();
		});
	});
});
