import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { Channel } from '$lib/stores/channels';
import { goto } from '$app/navigation';

// Create mock stores before the vi.mock calls
const mockChannelsStore = writable<Channel[]>([]);
const mockCurrentChannelStore = writable<Channel | null>(null);
const mockCurrentServerStore = writable<any>(null);
const mockUserStore = writable<any>(null);
const mockSettingsStore = {
	openServerSettings: vi.fn()
};
const mockCreateChannel = vi.fn();
const mockLeaveServer = vi.fn();
const mockCreateInvite = vi.fn();

vi.mock('$lib/stores/channels', () => {
	return {
		channels: mockChannelsStore,
		currentChannel: mockCurrentChannelStore,
		createChannel: mockCreateChannel
	};
});

vi.mock('$lib/stores/servers', () => {
	return {
		currentServer: mockCurrentServerStore,
		leaveServer: mockLeaveServer
	};
});

vi.mock('$lib/stores/auth', () => {
	return {
		user: mockUserStore
	};
});

vi.mock('$lib/stores/settings', () => {
	return {
		settings: mockSettingsStore
	};
});

vi.mock('$lib/stores/invites', () => {
	return {
		createInvite: mockCreateInvite
	};
});

function createMockChannel(overrides: Partial<Channel> = {}): Channel {
	const base: Channel = {
		id: `channel-${Math.random().toString(36).slice(2)}`,
		name: 'general',
		type: 0,
		server_id: 'server-1',
		position: 0,
		topic: null,
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		recipients: undefined,
		e2ee_enabled: false,
		last_message_id: null,
		last_message_at: null
	};
	return { ...base, ...overrides } as Channel;
}

function createMockServer(overrides: any = {}) {
	return {
		id: 'server-1',
		name: 'Test Server',
		icon: null,
		owner_id: 'user-1',
		...overrides
	};
}

function createMockDM(overrides: Partial<Channel> = {}): Channel {
	const base: Channel = {
		id: `dm-${Math.random().toString(36).slice(2)}`,
		name: '',
		type: 1,
		server_id: null,
		position: 0,
		topic: null,
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		last_message_id: null,
		last_message_at: null,
		recipients: [{ id: 'user-2', username: 'friend', display_name: null, avatar: null }],
		e2ee_enabled: false
	};
	return { ...base, ...overrides } as Channel;
}

describe('ChannelList', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		mockChannelsStore.set([]);
		mockCurrentChannelStore.set(null);
		mockCurrentServerStore.set(null);
		mockUserStore.set({ id: 'user-1', username: 'testuser' });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('DM list view', () => {
		it('should show DM search when no server selected', async () => {
			mockCurrentServerStore.set(null);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('Find or start a conversation')).toBeTruthy();
		});

		it('should show DIRECT MESSAGES header', async () => {
			mockCurrentServerStore.set(null);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('DIRECT MESSAGES')).toBeTruthy();
		});

		it('should render DM channels in DM mode', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({
				recipients: [{ id: 'user-2', username: 'alice', display_name: 'Alice', avatar: null }]
			});
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('Alice')).toBeTruthy();
		});

		it('should show username if no display_name for DM', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({
				recipients: [{ id: 'user-2', username: 'bobuser', display_name: null, avatar: null }]
			});
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('bobuser')).toBeTruthy();
		});

		it('should show E2EE indicator for encrypted DMs', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({ e2ee_enabled: true });
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('🔒')).toBeTruthy();
		});

		it('should show avatar initial when no avatar', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({
				recipients: [{ id: 'user-2', username: 'charlie', display_name: null, avatar: null }]
			});
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			// Should show 'C' for charlie
			expect(container.querySelector('.avatar-placeholder')?.textContent).toBe('C');
		});

		it('should show avatar image when recipient has avatar', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({
				recipients: [
					{
						id: 'user-2',
						username: 'charlie',
						display_name: null,
						avatar: 'https://example.com/avatar.png'
					}
				]
			});
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			const img = container.querySelector('.dm-avatar img');
			expect(img).toBeTruthy();
			expect(img?.getAttribute('src')).toBe('https://example.com/avatar.png');
		});

		it('should filter only DM channels (type 1 and 3)', async () => {
			mockCurrentServerStore.set(null);
			const textChannel = createMockChannel({ id: 'c1', type: 0, server_id: 'server-1' });
			const dm = createMockDM({ id: 'dm1' });
			const groupDm = createMockDM({
				id: 'gdm1',
				type: 3,
				recipients: [
					{ id: 'u2', username: 'user2', display_name: null, avatar: null },
					{ id: 'u3', username: 'user3', display_name: null, avatar: null }
				]
			});
			mockChannelsStore.set([textChannel, dm, groupDm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			const dmItems = container.querySelectorAll('.dm-item');
			expect(dmItems.length).toBe(2); // Only DM and Group DM
		});

		it('should navigate when clicking a DM', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({
				id: 'dm-123',
				recipients: [{ id: 'user-2', username: 'friend', display_name: 'Friend', avatar: null }]
			});
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			const dmButton = screen.getByText('Friend').closest('button');
			await fireEvent.click(dmButton!);

			expect(goto).toHaveBeenCalledWith('/channels/@me/dm-123');
		});

		it('should highlight active DM', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({ id: 'dm-active' });
			mockChannelsStore.set([dm]);
			mockCurrentChannelStore.set(dm);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			const activeDm = container.querySelector('.dm-item.active');
			expect(activeDm).toBeTruthy();
		});
	});

	describe('server channel view', () => {
		it('should show text channels category when server is selected', async () => {
			const server = createMockServer();
			mockCurrentServerStore.set(server);
			const textChannel = createMockChannel({ name: 'general', type: 0, server_id: 'server-1' });
			mockChannelsStore.set([textChannel]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('TEXT CHANNELS')).toBeTruthy();
			expect(screen.getByText('general')).toBeTruthy();
		});

		it('should show voice channels category', async () => {
			const server = createMockServer();
			mockCurrentServerStore.set(server);
			const voiceChannel = createMockChannel({
				name: 'voice-chat',
				type: 2,
				server_id: 'server-1'
			});
			mockChannelsStore.set([voiceChannel]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('VOICE CHANNELS')).toBeTruthy();
			expect(screen.getByText('voice-chat')).toBeTruthy();
		});

		it('should filter channels by current server', async () => {
			const server = createMockServer({ id: 'server-1' });
			mockCurrentServerStore.set(server);
			const channel1 = createMockChannel({ id: 'c1', name: 'channel-1', server_id: 'server-1' });
			const channel2 = createMockChannel({ id: 'c2', name: 'other-server', server_id: 'server-2' });
			mockChannelsStore.set([channel1, channel2]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('channel-1')).toBeTruthy();
			expect(screen.queryByText('other-server')).toBeFalsy();
		});

		it('should navigate when clicking a server channel', async () => {
			const server = createMockServer({ id: 'srv-1' });
			mockCurrentServerStore.set(server);
			const channel = createMockChannel({ id: 'ch-123', name: 'general', server_id: 'srv-1' });
			mockChannelsStore.set([channel]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			const channelName = screen.getByText('general');
			await fireEvent.click(channelName);

			expect(goto).toHaveBeenCalledWith('/channels/srv-1/ch-123');
		});

		it('should show text channels category even if no text channels (for creation)', async () => {
			const server = createMockServer();
			mockCurrentServerStore.set(server);
			const voiceChannel = createMockChannel({ type: 2, server_id: 'server-1' });
			mockChannelsStore.set([voiceChannel]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			// Category is always shown to allow creating first channel (CSS uppercase)
			expect(screen.queryByText('TEXT CHANNELS')).toBeTruthy();
		});

		it('should show voice channels category even if no voice channels (for creation)', async () => {
			const server = createMockServer();
			mockCurrentServerStore.set(server);
			const textChannel = createMockChannel({ type: 0, server_id: 'server-1' });
			mockChannelsStore.set([textChannel]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			// Category is always shown to allow creating first channel (CSS uppercase)
			expect(screen.queryByText('VOICE CHANNELS')).toBeTruthy();
		});
	});

	describe('layout and styling', () => {
		it('should have correct width class', async () => {
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			const channelList = container.querySelector('.channel-list');
			expect(channelList).toBeTruthy();
		});

		it('should have scrollable content area', async () => {
			const ChannelList = (await import('./ChannelList.svelte')).default;

			const { container } = render(ChannelList);

			const contentArea = container.querySelector('.channel-list-content');
			expect(contentArea).toBeTruthy();
		});
	});

	describe('UserPanel integration', () => {
		it('should render UserPanel component', async () => {
			mockUserStore.set({ id: 'user-1', username: 'testuser' });
			const ChannelList = (await import('./ChannelList.svelte')).default;

			// UserPanel will be rendered within ChannelList
			expect(() => render(ChannelList)).not.toThrow();
		});
	});

	describe('edge cases', () => {
		it('should handle empty channels list', async () => {
			mockCurrentServerStore.set(null);
			mockChannelsStore.set([]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			// Should render without error
			expect(() => render(ChannelList)).not.toThrow();
		});

		it('should handle DM with undefined recipients', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({ recipients: undefined as any });
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			expect(() => render(ChannelList)).not.toThrow();
		});

		it('should handle DM with empty recipients', async () => {
			mockCurrentServerStore.set(null);
			const dm = createMockDM({ recipients: [] });
			mockChannelsStore.set([dm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			expect(() => render(ChannelList)).not.toThrow();
		});

		it('should handle server with no channels', async () => {
			const server = createMockServer();
			mockCurrentServerStore.set(server);
			mockChannelsStore.set([]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			// Should render without error
			expect(() => render(ChannelList)).not.toThrow();
		});
	});

	describe('group DMs', () => {
		it('should display multiple recipient names for group DMs', async () => {
			mockCurrentServerStore.set(null);
			const groupDm = createMockDM({
				type: 3,
				name: undefined,
				recipients: [
					{ id: 'u2', username: 'user2', display_name: 'Alice', avatar: null },
					{ id: 'u3', username: 'user3', display_name: 'Bob', avatar: null }
				]
			});
			mockChannelsStore.set([groupDm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('Alice, Bob')).toBeTruthy();
		});

		it('should use custom name for group DMs if set', async () => {
			mockCurrentServerStore.set(null);
			const groupDm = createMockDM({
				type: 3,
				name: 'Project Team',
				recipients: [{ id: 'u2', username: 'user2', display_name: 'Alice', avatar: null }]
			});
			mockChannelsStore.set([groupDm]);
			const ChannelList = (await import('./ChannelList.svelte')).default;

			render(ChannelList);

			expect(screen.getByText('Project Team')).toBeTruthy();
		});
	});
});
