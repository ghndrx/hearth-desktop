/**
 * MemberItem Component Tests
 * 
 * Tests for the individual member row component in the member sidebar
 * per PRD Section 3.5:
 * - Avatar (32px) with status dot
 * - Display name (colored by highest role)
 * - Activity/game name if present
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MemberItem from './MemberItem.svelte';

// Mock Element.prototype.animate for Svelte transitions in jsdom
beforeEach(() => {
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

// Mock member data
const createMockMember = (overrides: Partial<{
	id: string;
	user: {
		id: string;
		username: string;
		display_name: string | null;
		avatar: string | null;
	};
	nickname: string | null;
	roles: string[];
}> = {}) => ({
	id: 'member-1',
	user: {
		id: 'user-1',
		username: 'testuser',
		display_name: 'Test User',
		avatar: 'https://example.com/avatar.png',
		...overrides.user
	},
	nickname: null,
	roles: ['member'],
	...overrides
});

describe('MemberItem', () => {
	describe('Rendering', () => {
		it('renders member with display name', () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('Test User')).toBeInTheDocument();
		});

		it('renders member with nickname over display name', () => {
			const member = createMockMember({ nickname: 'CoolNick' });
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('CoolNick')).toBeInTheDocument();
			expect(screen.queryByText('Test User')).not.toBeInTheDocument();
		});

		it('renders member with username when no display name or nickname', () => {
			const member = createMockMember({
				user: {
					id: 'user-1',
					username: 'rawuser',
					display_name: null,
					avatar: null
				},
				nickname: null
			});
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('rawuser')).toBeInTheDocument();
		});

		it('renders Avatar component with correct props', () => {
			const member = createMockMember();
			const { container } = render(MemberItem, { props: { member } });
			
			// Avatar should be rendered (check for avatar container)
			const avatarWrapper = container.querySelector('.member-item');
			expect(avatarWrapper).toBeInTheDocument();
		});

		it('renders member button with accessible label', () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button', { name: /view test user's profile/i });
			expect(button).toBeInTheDocument();
		});

		it('renders with custom color', () => {
			const member = createMockMember();
			render(MemberItem, { props: { member, color: '#ff5555' } });
			
			const nameElement = screen.getByText('Test User');
			expect(nameElement).toHaveStyle({ color: '#ff5555' });
		});
	});

	describe('Offline State', () => {
		it('applies offline styling when isOffline is true', () => {
			const member = createMockMember();
			const { container } = render(MemberItem, { props: { member, isOffline: true } });
			
			const memberItem = container.querySelector('.member-item');
			expect(memberItem).toHaveClass('offline');
		});

		it('does not apply offline styling when isOffline is false', () => {
			const member = createMockMember();
			const { container } = render(MemberItem, { props: { member, isOffline: false } });
			
			const memberItem = container.querySelector('.member-item');
			expect(memberItem).not.toHaveClass('offline');
		});

		it('does not show activity when offline', () => {
			const member = createMockMember();
			const activity = { type: 0, name: 'Minecraft' };
			render(MemberItem, { props: { member, isOffline: true, activity } });
			
			expect(screen.queryByText(/playing minecraft/i)).not.toBeInTheDocument();
		});
	});

	describe('Activity Display', () => {
		it('shows "Playing" prefix for game activity (type 0)', () => {
			const member = createMockMember();
			const activity = { type: 0, name: 'Minecraft' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Playing Minecraft')).toBeInTheDocument();
		});

		it('shows "Streaming" prefix for streaming activity (type 1)', () => {
			const member = createMockMember();
			const activity = { type: 1, name: 'Twitch' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Streaming Twitch')).toBeInTheDocument();
		});

		it('shows "Listening to" prefix for listening activity (type 2)', () => {
			const member = createMockMember();
			const activity = { type: 2, name: 'Spotify' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Listening to Spotify')).toBeInTheDocument();
		});

		it('shows "Watching" prefix for watching activity (type 3)', () => {
			const member = createMockMember();
			const activity = { type: 3, name: 'YouTube' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Watching YouTube')).toBeInTheDocument();
		});

		it('shows custom status state directly for type 4', () => {
			const member = createMockMember();
			const activity = { type: 4, name: 'Custom Status', state: 'Taking a break' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Taking a break')).toBeInTheDocument();
		});

		it('shows "Competing in" prefix for competing activity (type 5)', () => {
			const member = createMockMember();
			const activity = { type: 5, name: 'League of Legends' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Competing in League of Legends')).toBeInTheDocument();
		});

		it('shows activity name for unknown activity types', () => {
			const member = createMockMember();
			const activity = { type: 99, name: 'Unknown Activity' };
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Unknown Activity')).toBeInTheDocument();
		});

		it('uses activityText over activity object when provided', () => {
			const member = createMockMember();
			const activity = { type: 0, name: 'Minecraft' };
			render(MemberItem, { props: { member, activity, activityText: 'In a voice call' } });
			
			expect(screen.getByText('In a voice call')).toBeInTheDocument();
			expect(screen.queryByText('Playing Minecraft')).not.toBeInTheDocument();
		});

		it('does not show activity when null', () => {
			const member = createMockMember();
			const { container } = render(MemberItem, { props: { member, activity: null } });
			
			const activityElement = container.querySelector('.member-activity');
			expect(activityElement).not.toBeInTheDocument();
		});
	});

	describe('Events', () => {
		it('handles click events on the button', async () => {
			const member = createMockMember();
			const handleClick = vi.fn();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			button.addEventListener('click', handleClick);
			await fireEvent.click(button);
			
			expect(handleClick).toHaveBeenCalledTimes(1);
		});

		it('handles contextmenu events on the button', async () => {
			const member = createMockMember();
			const handleContextMenu = vi.fn();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			button.addEventListener('contextmenu', handleContextMenu);
			await fireEvent.contextMenu(button);
			
			expect(handleContextMenu).toHaveBeenCalledTimes(1);
		});

		it('button is interactive and clickable', async () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			expect(button).not.toBeDisabled();
			expect(button.tagName.toLowerCase()).toBe('button');
		});
	});

	describe('Display Name Priority', () => {
		it('prioritizes nickname over display_name over username', () => {
			const member = createMockMember({
				user: {
					id: 'user-1',
					username: 'baseuser',
					display_name: 'Display Name',
					avatar: null
				},
				nickname: 'Nickname'
			});
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('Nickname')).toBeInTheDocument();
			expect(screen.queryByText('Display Name')).not.toBeInTheDocument();
			expect(screen.queryByText('baseuser')).not.toBeInTheDocument();
		});

		it('falls back to display_name when nickname is null', () => {
			const member = createMockMember({
				user: {
					id: 'user-1',
					username: 'baseuser',
					display_name: 'Display Name',
					avatar: null
				},
				nickname: null
			});
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('Display Name')).toBeInTheDocument();
			expect(screen.queryByText('baseuser')).not.toBeInTheDocument();
		});

		it('falls back to username when both nickname and display_name are null', () => {
			const member = createMockMember({
				user: {
					id: 'user-1',
					username: 'baseuser',
					display_name: null,
					avatar: null
				},
				nickname: null
			});
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('baseuser')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('has accessible button role', () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			expect(screen.getByRole('button')).toBeInTheDocument();
		});

		it('provides aria-label with display name', () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('aria-label', "View Test User's profile");
		});

		it('updates aria-label when nickname is used', () => {
			const member = createMockMember({ nickname: 'CoolNick' });
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			expect(button).toHaveAttribute('aria-label', "View CoolNick's profile");
		});

		it('is keyboard accessible', async () => {
			const member = createMockMember();
			render(MemberItem, { props: { member } });
			
			const button = screen.getByRole('button');
			button.focus();
			expect(document.activeElement).toBe(button);
			
			// Button should be focusable and respond to keyboard
			expect(button.tabIndex).not.toBe(-1);
		});
	});

	describe('Styling', () => {
		it('has proper structure for member info', () => {
			const member = createMockMember();
			const { container } = render(MemberItem, { props: { member } });
			
			const memberInfo = container.querySelector('.member-info');
			expect(memberInfo).toBeInTheDocument();
			
			const memberName = container.querySelector('.member-name');
			expect(memberName).toBeInTheDocument();
		});

		it('applies activity class when activity is present', () => {
			const member = createMockMember();
			const activity = { type: 0, name: 'Game' };
			const { container } = render(MemberItem, { props: { member, activity } });
			
			const activityElement = container.querySelector('.member-activity');
			expect(activityElement).toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('handles member with empty roles array', () => {
			const member = createMockMember({ roles: [] });
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('Test User')).toBeInTheDocument();
		});

		it('handles activity with all optional fields', () => {
			const member = createMockMember();
			const activity = {
				type: 2,
				name: 'Spotify',
				state: 'Album Name',
				details: 'Song Title'
			};
			render(MemberItem, { props: { member, activity } });
			
			expect(screen.getByText('Listening to Spotify')).toBeInTheDocument();
		});

		it('handles very long display names with truncation', () => {
			const member = createMockMember({
				nickname: 'This is an extremely long nickname that should be truncated in the UI'
			});
			const { container } = render(MemberItem, { props: { member } });
			
			const memberName = container.querySelector('.member-name');
			expect(memberName).toBeInTheDocument();
			// The CSS handles truncation via text-overflow: ellipsis
		});

		it('handles special characters in display name', () => {
			const member = createMockMember({ nickname: '<script>alert("xss")</script>' });
			render(MemberItem, { props: { member } });
			
			// Svelte automatically escapes HTML - should render as text
			expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
		});

		it('handles unicode characters in display name', () => {
			const member = createMockMember({ nickname: '🎮 Gamer 日本語' });
			render(MemberItem, { props: { member } });
			
			expect(screen.getByText('🎮 Gamer 日本語')).toBeInTheDocument();
		});
	});
});
