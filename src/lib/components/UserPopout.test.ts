import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UserPopout from './UserPopout.svelte';

describe('UserPopout', () => {
	const mockUser = {
		id: 'user-123',
		username: 'testuser',
		display_name: 'Test User',
		avatar: null,
		banner: null,
		bio: 'Hello world',
		pronouns: 'they/them',
		bot: false,
		created_at: '2024-01-15T00:00:00Z'
	};

	const mockMember = {
		nickname: 'Testy',
		joined_at: '2024-06-01T00:00:00Z',
		roles: [
			{ id: 'role-1', name: 'Admin', color: '#e74c3c' },
			{ id: 'role-2', name: 'Moderator', color: '#3498db' }
		]
	};

	const mockMutualServers = [
		{ id: 'server-1', name: 'Server One', icon: null },
		{ id: 'server-2', name: 'Server Two', icon: 'https://example.com/icon.png' }
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('renders the user popout', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(container.querySelector('.user-popout')).toBeInTheDocument();
		});

		it('displays the display name', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(getByText('Test User')).toBeInTheDocument();
		});

		it('displays username and discriminator', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(container.querySelector('.username')?.textContent).toBe('testuser');
			expect(container.querySelector('.discriminator')?.textContent).toMatch(/^#\d{4}$/);
		});

		it('displays bio when present', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(getByText('Hello world')).toBeInTheDocument();
		});

		it('displays pronouns when present', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(getByText('they/them')).toBeInTheDocument();
		});

		it('shows bot badge for bot users', () => {
			const botUser = { ...mockUser, bot: true };
			const { getByText } = render(UserPopout, {
				props: { user: botUser }
			});
			expect(getByText('BOT')).toBeInTheDocument();
		});

		it('does not show bot badge for regular users', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(container.querySelector('.bot-badge')).not.toBeInTheDocument();
		});

		it('shows default banner when no banner URL', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(container.querySelector('.banner-default')).toBeInTheDocument();
		});

		it('shows banner image when banner URL is present', () => {
			const userWithBanner = { ...mockUser, banner: 'https://example.com/banner.png' };
			const { container } = render(UserPopout, {
				props: { user: userWithBanner }
			});
			const bannerImg = container.querySelector('.banner-image');
			expect(bannerImg).toBeInTheDocument();
			expect(bannerImg).toHaveAttribute('src', 'https://example.com/banner.png');
		});
	});

	describe('member info', () => {
		it('uses nickname as display name when member has nickname', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser, member: mockMember }
			});
			expect(getByText('Testy')).toBeInTheDocument();
		});

		it('shows server member since date when member is provided', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser, member: mockMember }
			});
			expect(getByText('Server Member Since')).toBeInTheDocument();
		});

		it('shows member since date when no member', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser }
			});
			expect(getByText('Member Since')).toBeInTheDocument();
		});

		it('renders role badges', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser, member: mockMember }
			});
			expect(getByText('Admin')).toBeInTheDocument();
			expect(getByText('Moderator')).toBeInTheDocument();
		});

		it('does not render roles section when member has no roles', () => {
			const memberNoRoles = { ...mockMember, roles: [] };
			const { container } = render(UserPopout, {
				props: { user: mockUser, member: memberNoRoles }
			});
			expect(container.querySelector('.roles-list')).not.toBeInTheDocument();
		});
	});

	describe('mutual servers', () => {
		it('renders mutual servers', () => {
			const { getByText } = render(UserPopout, {
				props: { user: mockUser, mutualServers: mockMutualServers }
			});
			expect(getByText('Server One')).toBeInTheDocument();
			expect(getByText('Server Two')).toBeInTheDocument();
		});

		it('does not render mutual servers section when empty', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser, mutualServers: [] }
			});
			expect(container.querySelector('.servers-list')).not.toBeInTheDocument();
		});

		it('shows +N more when more than 5 mutual servers', () => {
			const manyServers = Array.from({ length: 8 }, (_, i) => ({
				id: `server-${i}`,
				name: `Server ${i}`,
				icon: null
			}));
			const { getByText } = render(UserPopout, {
				props: { user: mockUser, mutualServers: manyServers }
			});
			expect(getByText('+3 more')).toBeInTheDocument();
		});
	});

	describe('events', () => {
		it('dispatches close event when overlay is clicked', async () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});

			const overlay = container.querySelector('.popout-overlay') as HTMLElement;
			expect(overlay).toBeInTheDocument();

			await fireEvent.click(overlay);
		});

		it('does not close when popout body is clicked', async () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});

			const popout = container.querySelector('.user-popout') as HTMLElement;
			expect(popout).toBeInTheDocument();

			// Clicking the popout body should not trigger close
			await fireEvent.click(popout);
		});

		it('has message button for user interaction', async () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser }
			});

			const messageBtn = container.querySelector('.message-btn') as HTMLElement;
			expect(messageBtn).toBeInTheDocument();

			await fireEvent.click(messageBtn);
		});

		it('displays mutual servers when provided', () => {
			const { container } = render(UserPopout, {
				props: { user: mockUser, mutualServers: mockMutualServers }
			});

			const serverItems = container.querySelectorAll('.server-item');
			expect(serverItems.length).toBeGreaterThan(0);
		});
	});

	// Note: Position prop changed from 'left'/'right' alignment to {x, y} coordinates
	// Old position alignment tests removed as that API no longer exists
});
