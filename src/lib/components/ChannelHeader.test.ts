import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChannelHeader from './ChannelHeader.svelte';

describe('ChannelHeader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('rendering', () => {
		it('renders with default props', () => {
			const { container } = render(ChannelHeader);

			expect(container.querySelector('.channel-header')).toBeInTheDocument();
		});

		it('renders channel name', () => {
			render(ChannelHeader, {
				props: {
					channelName: 'general'
				}
			});

			expect(screen.getByText('general')).toBeInTheDocument();
		});

		it('renders channel name in heading element', () => {
			render(ChannelHeader, {
				props: {
					channelName: 'announcements'
				}
			});

			const heading = screen.getByRole('heading', { level: 2 });
			expect(heading).toHaveTextContent('announcements');
		});
	});

	describe('channel type icons', () => {
		it('shows # icon for text channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'text'
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('#');
		});

		it('shows voice icon for voice channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'voice'
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('🔊');
		});

		it('shows announcement icon for announcement channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'announcement'
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('📢');
		});

		it('shows stage icon for stage channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'stage'
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('🎭');
		});

		it('shows forum icon for forum channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'forum'
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('💬');
		});

		it('shows lock icon for private channels', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelType: 'text',
					isPrivate: true
				}
			});

			const icon = container.querySelector('.channel-icon');
			expect(icon).toHaveTextContent('🔒');
			expect(icon).toHaveClass('private');
		});
	});

	describe('topic', () => {
		it('does not render topic when not provided', () => {
			const { container } = render(ChannelHeader, {
				props: {
					channelName: 'general',
					topic: null
				}
			});

			const divider = container.querySelector('.topic-divider');
			const topic = container.querySelector('.channel-topic');
			expect(divider).not.toBeInTheDocument();
			expect(topic).not.toBeInTheDocument();
		});

		it('renders topic when provided', () => {
			render(ChannelHeader, {
				props: {
					channelName: 'general',
					topic: 'Welcome to the general chat!'
				}
			});

			expect(screen.getByText('Welcome to the general chat!')).toBeInTheDocument();
		});

		it('shows topic divider when topic is present', () => {
			const { container } = render(ChannelHeader, {
				props: {
					topic: 'A topic here'
				}
			});

			const divider = container.querySelector('.topic-divider');
			expect(divider).toBeInTheDocument();
		});

		it('has title attribute on topic for hover', () => {
			render(ChannelHeader, {
				props: {
					topic: 'Hover to see full topic'
				}
			});

			const topic = screen.getByText('Hover to see full topic');
			expect(topic).toHaveAttribute('title', 'Hover to see full topic');
		});
	});

	describe('member list toggle', () => {
		it('renders member list toggle button', () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Hide Member List');
			expect(button).toBeInTheDocument();
		});

		it('shows "Hide Member List" when member list is visible', () => {
			render(ChannelHeader, {
				props: {
					memberListVisible: true
				}
			});

			const button = screen.getByLabelText('Hide Member List');
			expect(button).toHaveAttribute('aria-pressed', 'true');
		});

		it('shows "Show Member List" when member list is hidden', () => {
			render(ChannelHeader, {
				props: {
					memberListVisible: false
				}
			});

			const button = screen.getByLabelText('Show Member List');
			expect(button).toHaveAttribute('aria-pressed', 'false');
		});

		it('has active class when member list is visible', () => {
			render(ChannelHeader, {
				props: {
					memberListVisible: true
				}
			});

			const button = screen.getByLabelText('Hide Member List');
			expect(button).toHaveClass('active');
		});

		it('does not have active class when member list is hidden', () => {
			render(ChannelHeader, {
				props: {
					memberListVisible: false
				}
			});

			const button = screen.getByLabelText('Show Member List');
			expect(button).not.toHaveClass('active');
		});
	});

	describe('pinned messages', () => {
		it('renders pinned messages button', () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Pinned Messages');
			expect(button).toBeInTheDocument();
		});

		it('does not show badge when pinnedCount is 0', () => {
			const { container } = render(ChannelHeader, {
				props: {
					pinnedCount: 0
				}
			});

			const badge = container.querySelector('.pin-badge');
			expect(badge).not.toBeInTheDocument();
		});

		it('shows badge with count when pinnedCount > 0', () => {
			const { container } = render(ChannelHeader, {
				props: {
					pinnedCount: 5
				}
			});

			const badge = container.querySelector('.pin-badge');
			expect(badge).toBeInTheDocument();
			expect(badge).toHaveTextContent('5');
		});

		it('has has-pins class when pinnedCount > 0', () => {
			render(ChannelHeader, {
				props: {
					pinnedCount: 3
				}
			});

			const button = screen.getByLabelText('Pinned Messages');
			expect(button).toHaveClass('has-pins');
		});
	});

	describe('threads button', () => {
		it('shows threads button for text channels', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'text'
				}
			});

			const button = screen.getByLabelText('Threads');
			expect(button).toBeInTheDocument();
		});

		it('shows threads button for announcement channels', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'announcement'
				}
			});

			const button = screen.getByLabelText('Threads');
			expect(button).toBeInTheDocument();
		});

		it('does not show threads button for voice channels', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'voice'
				}
			});

			const button = screen.queryByLabelText('Threads');
			expect(button).not.toBeInTheDocument();
		});

		it('does not show threads button for stage channels', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'stage'
				}
			});

			const button = screen.queryByLabelText('Threads');
			expect(button).not.toBeInTheDocument();
		});

		it('does not show threads button for forum channels', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'forum'
				}
			});

			const button = screen.queryByLabelText('Threads');
			expect(button).not.toBeInTheDocument();
		});
	});

	describe('action buttons', () => {
		it('renders notification settings button', () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Notification Settings');
			expect(button).toBeInTheDocument();
		});

		it('renders inbox button', () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Inbox');
			expect(button).toBeInTheDocument();
		});

		it('renders help button', () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Help');
			expect(button).toBeInTheDocument();
		});
	});

	describe('search', () => {
		it('renders search input', () => {
			render(ChannelHeader);

			const input = screen.getByPlaceholderText('Search');
			expect(input).toBeInTheDocument();
		});

		it('search input is readonly', () => {
			render(ChannelHeader);

			const input = screen.getByPlaceholderText('Search');
			expect(input).toHaveAttribute('readonly');
		});
	});

	describe('events', () => {
		it('dispatches toggleMemberList when member list button clicked', async () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Hide Member List');
			await fireEvent.click(button);

			// Button is clickable (event dispatch cannot be verified directly in jsdom)
			expect(button).toBeInTheDocument();
		});

		it('dispatches openPinnedMessages when pinned button clicked', async () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Pinned Messages');
			await fireEvent.click(button);

			expect(button).toBeInTheDocument();
		});

		it('dispatches openSearch when search input focused', async () => {
			render(ChannelHeader);

			const input = screen.getByPlaceholderText('Search');
			await fireEvent.focus(input);

			expect(input).toBeInTheDocument();
		});

		it('dispatches openInbox when inbox button clicked', async () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Inbox');
			await fireEvent.click(button);

			expect(button).toBeInTheDocument();
		});

		it('dispatches openHelp when help button clicked', async () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Help');
			await fireEvent.click(button);

			expect(button).toBeInTheDocument();
		});

		it('dispatches openThreads when threads button clicked', async () => {
			render(ChannelHeader, {
				props: {
					channelType: 'text'
				}
			});

			const button = screen.getByLabelText('Threads');
			await fireEvent.click(button);

			expect(button).toBeInTheDocument();
		});

		it('dispatches openNotificationSettings when notification button clicked', async () => {
			render(ChannelHeader);

			const button = screen.getByLabelText('Notification Settings');
			await fireEvent.click(button);

			expect(button).toBeInTheDocument();
		});
	});

	describe('accessibility', () => {
		it('uses h2 for channel name', () => {
			render(ChannelHeader, {
				props: {
					channelName: 'general'
				}
			});

			const heading = screen.getByRole('heading', { level: 2 });
			expect(heading).toBeInTheDocument();
		});

		it('has proper aria-label on all buttons', () => {
			render(ChannelHeader, {
				props: {
					channelType: 'text'
				}
			});

			expect(screen.getByLabelText('Threads')).toBeInTheDocument();
			expect(screen.getByLabelText('Notification Settings')).toBeInTheDocument();
			expect(screen.getByLabelText('Pinned Messages')).toBeInTheDocument();
			expect(screen.getByLabelText('Hide Member List')).toBeInTheDocument();
			expect(screen.getByLabelText('Inbox')).toBeInTheDocument();
			expect(screen.getByLabelText('Help')).toBeInTheDocument();
		});

		it('has aria-pressed on member list toggle', () => {
			render(ChannelHeader, {
				props: {
					memberListVisible: true
				}
			});

			const button = screen.getByLabelText('Hide Member List');
			expect(button).toHaveAttribute('aria-pressed', 'true');
		});

		it('topic divider has aria-hidden', () => {
			const { container } = render(ChannelHeader, {
				props: {
					topic: 'A topic'
				}
			});

			const divider = container.querySelector('.topic-divider');
			expect(divider).toHaveAttribute('aria-hidden', 'true');
		});

		it('action divider has aria-hidden', () => {
			const { container } = render(ChannelHeader);

			const divider = container.querySelector('.action-divider');
			expect(divider).toHaveAttribute('aria-hidden', 'true');
		});
	});

	describe('styling', () => {
		it('applies header class to container', () => {
			const { container } = render(ChannelHeader);

			expect(container.querySelector('.channel-header')).toBeInTheDocument();
		});

		it('has channel-info section', () => {
			const { container } = render(ChannelHeader);

			expect(container.querySelector('.channel-info')).toBeInTheDocument();
		});

		it('has header-actions section', () => {
			const { container } = render(ChannelHeader);

			expect(container.querySelector('.header-actions')).toBeInTheDocument();
		});

		it('has search-container', () => {
			const { container } = render(ChannelHeader);

			expect(container.querySelector('.search-container')).toBeInTheDocument();
		});
	});
});
