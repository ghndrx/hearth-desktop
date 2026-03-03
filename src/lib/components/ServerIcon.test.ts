import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ServerIcon from './ServerIcon.svelte';
import type { Server } from '$lib/stores/servers';

describe('ServerIcon', () => {
	const mockServer: Server = {
		id: '123',
		name: 'Test Server',
		icon: null,
		banner: null,
		description: null,
		owner_id: 'user1',
		created_at: '2024-01-01T00:00:00Z'
	};

	const mockServerWithIcon: Server = {
		...mockServer,
		icon: 'https://example.com/icon.png'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('renders with server prop', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer }
			});

			expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
			expect(container.querySelector('.server-icon')).toBeInTheDocument();
		});

		it('renders server icon when server has icon', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServerWithIcon }
			});

			const img = container.querySelector('.server-image');
			expect(img).toBeInTheDocument();
			expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
			expect(img).toHaveAttribute('alt', 'Test Server');
		});

		it('renders initials when server has no icon', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer }
			});

			const initials = container.querySelector('.server-initials');
			expect(initials).toBeInTheDocument();
			expect(initials?.textContent).toBe('TS');
		});

		it('renders initials for multi-word server name', () => {
			const serverWithLongName: Server = {
				...mockServer,
				name: 'My Awesome Server'
			};

			const { container } = render(ServerIcon, {
				props: { server: serverWithLongName }
			});

			const initials = container.querySelector('.server-initials');
			expect(initials?.textContent).toBe('MAS');
		});

		it('renders home icon when isHome is true', () => {
			const { container } = render(ServerIcon, {
				props: { isHome: true }
			});

			expect(container.querySelector('.server-icon.home')).toBeInTheDocument();
			expect(container.querySelector('svg')).toBeInTheDocument();
		});

		it('renders add icon when isAdd is true', () => {
			const { container } = render(ServerIcon, {
				props: { isAdd: true }
			});

			expect(container.querySelector('.server-icon.add')).toBeInTheDocument();
			expect(container.querySelector('.add-icon')).toBeInTheDocument();
		});

		it('displays tooltip with server name', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer }
			});

			const tooltip = container.querySelector('.tooltip');
			expect(tooltip).toBeInTheDocument();
			expect(tooltip?.textContent).toBe('Test Server');
		});

		it('displays tooltip for home button', () => {
			const { container } = render(ServerIcon, {
				props: { isHome: true }
			});

			const tooltip = container.querySelector('.tooltip');
			expect(tooltip?.textContent).toBe('Direct Messages');
		});

		it('displays tooltip for add button', () => {
			const { container } = render(ServerIcon, {
				props: { isAdd: true }
			});

			const tooltip = container.querySelector('.tooltip');
			expect(tooltip?.textContent).toBe('Add a Server');
		});
	});

	describe('selection state', () => {
		it('shows selected state when isSelected is true', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, isSelected: true }
			});

			expect(container.querySelector('.server-icon.selected')).toBeInTheDocument();
		});

		it('shows pill indicator when selected', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, isSelected: true }
			});

			const pill = container.querySelector('.pill-indicator');
			expect(pill).toHaveClass('pill-selected');
			expect(pill).toHaveStyle('height: 40px');
		});

		it('does not show pill when not selected and no unread', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, isSelected: false, hasUnread: false }
			});

			const pill = container.querySelector('.pill-indicator');
			expect(pill).not.toHaveClass('pill-selected');
			expect(pill).not.toHaveClass('pill-visible');
		});
	});

	describe('unread state', () => {
		it('shows unread indicator when hasUnread is true', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, hasUnread: true }
			});

			expect(container.querySelector('.unread-dot')).toBeInTheDocument();
		});

		it('shows pill indicator for unread messages', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, hasUnread: true, isSelected: false }
			});

			const pill = container.querySelector('.pill-indicator');
			expect(pill).toHaveClass('pill-visible');
			expect(pill).toHaveStyle('height: 8px');
		});

		it('does not show unread dot when selected', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, hasUnread: true, isSelected: true }
			});

			expect(container.querySelector('.unread-dot')).not.toBeInTheDocument();
		});
	});

	describe('mention badge', () => {
		it('shows mention badge when mentionCount > 0', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, mentionCount: 5 }
			});

			const badge = container.querySelector('.mention-badge');
			expect(badge).toBeInTheDocument();
			expect(badge?.textContent).toBe('5');
		});

		it('does not show mention badge when mentionCount is 0', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, mentionCount: 0 }
			});

			expect(container.querySelector('.mention-badge')).not.toBeInTheDocument();
		});

		it('caps mention count at 99+', () => {
			const { container } = render(ServerIcon, {
				props: { server: mockServer, mentionCount: 150 }
			});

			const badge = container.querySelector('.mention-badge');
			expect(badge?.textContent).toBe('99+');
		});
	});

	describe('events', () => {
		it('dispatches click event when clicked', async () => {
			const handleClick = vi.fn();
			const { container } = render(ServerIcon, {
				props: { server: mockServer }
			});

			const button = container.querySelector('.server-icon');
			button?.addEventListener('click', handleClick);

			if (button) {
				await fireEvent.click(button);
			}

			expect(handleClick).toHaveBeenCalledTimes(1);
		});

		it('dispatches click event for home button', async () => {
			const handleClick = vi.fn();
			const { container } = render(ServerIcon, {
				props: { isHome: true }
			});

			const button = container.querySelector('.server-icon');
			button?.addEventListener('click', handleClick);

			if (button) {
				await fireEvent.click(button);
			}

			expect(handleClick).toHaveBeenCalledTimes(1);
		});

		it('dispatches click event for add button', async () => {
			const handleClick = vi.fn();
			const { container } = render(ServerIcon, {
				props: { isAdd: true }
			});

			const button = container.querySelector('.server-icon');
			button?.addEventListener('click', handleClick);

			if (button) {
				await fireEvent.click(button);
			}

			expect(handleClick).toHaveBeenCalledTimes(1);
		});
	});

	describe('edge cases', () => {
		it('handles empty server name gracefully', () => {
			const serverWithEmptyName: Server = {
				...mockServer,
				name: ''
			};

			const { container } = render(ServerIcon, {
				props: { server: serverWithEmptyName }
			});

			// Should render without crashing
			expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
		});

		it('handles single character server name', () => {
			const serverWithShortName: Server = {
				...mockServer,
				name: 'A'
			};

			const { container } = render(ServerIcon, {
				props: { server: serverWithShortName }
			});

			const initials = container.querySelector('.server-initials');
			expect(initials?.textContent).toBe('A');
		});

		it('handles server with special characters in name', () => {
			const serverWithSpecialName: Server = {
				...mockServer,
				name: 'Server @ #123'
			};

			const { container } = render(ServerIcon, {
				props: { server: serverWithSpecialName }
			});

			const initials = container.querySelector('.server-initials');
			// Takes first char of each word: "Server" -> "S", "@" -> "@", "#123" -> "#"
			expect(initials?.textContent).toBe('S@#');
		});

		it('does not render tooltip when server is null and not home/add', () => {
			const { container } = render(ServerIcon, {
				props: { server: null, isHome: false, isAdd: false }
			});

			// Tooltip should not be rendered
			const tooltip = container.querySelector('.tooltip');
			expect(tooltip).not.toBeInTheDocument();
		});
	});
});
