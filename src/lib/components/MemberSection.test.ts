/**
 * MemberSection Component Tests
 * 
 * Tests for the collapsible member section component
 * per PRD Section 3.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import MemberSection from './MemberSection.svelte';

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
const mockMembers = [
	{
		id: 'member-1',
		user: {
			id: 'user-1',
			username: 'alice',
			display_name: 'Alice',
			avatar: 'https://example.com/alice.png'
		},
		nickname: null,
		roles: ['admin']
	},
	{
		id: 'member-2',
		user: {
			id: 'user-2',
			username: 'bob',
			display_name: null,
			avatar: null
		},
		nickname: 'Bob the Builder',
		roles: ['member']
	},
	{
		id: 'member-3',
		user: {
			id: 'user-3',
			username: 'charlie',
			display_name: 'Charlie',
			avatar: 'https://example.com/charlie.png'
		},
		nickname: null,
		roles: ['moderator', 'member']
	}
];

describe('MemberSection', () => {
	describe('Rendering', () => {
		it('renders section with label and count', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 5,
					members: []
				}
			});
			
			expect(screen.getByText('ONLINE')).toBeInTheDocument();
			expect(screen.getByText(/5/)).toBeInTheDocument();
		});
		
		it('renders member items when provided', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers
				}
			});
			
			// Members should be rendered (by their display names)
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
			expect(screen.getByLabelText("View Bob the Builder's profile")).toBeInTheDocument();
			expect(screen.getByLabelText("View Charlie's profile")).toBeInTheDocument();
		});
		
		it('renders with custom role name label', () => {
			render(MemberSection, {
				props: {
					label: 'Moderators',
					count: 2,
					members: []
				}
			});
			
			expect(screen.getByText('Moderators')).toBeInTheDocument();
			expect(screen.getByText(/2/)).toBeInTheDocument();
		});
		
		it('displays zero count correctly', () => {
			render(MemberSection, {
				props: {
					label: 'OFFLINE',
					count: 0,
					members: []
				}
			});
			
			expect(screen.getByText(/0/)).toBeInTheDocument();
		});
	});
	
	describe('Collapsible functionality', () => {
		it('shows collapse icon when collapsible is true', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true
				}
			});
			
			const svg = document.querySelector('.collapse-icon');
			expect(svg).toBeInTheDocument();
		});
		
		it('hides collapse icon when collapsible is false', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: false
				}
			});
			
			const svg = document.querySelector('.collapse-icon');
			expect(svg).not.toBeInTheDocument();
		});
		
		it('toggles collapsed state on header click when collapsible', async () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true,
					collapsed: false
				}
			});
			
			// Initially members should be visible
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			await fireEvent.click(header);
			
			// After toggle, members should be hidden
			expect(screen.queryByLabelText("View Alice's profile")).not.toBeInTheDocument();
		});
		
		it('does not toggle when collapsible is false', async () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: false,
					collapsed: false
				}
			});
			
			// Members should be visible
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			await fireEvent.click(header);
			
			// Should still be visible (not collapsed) since collapsible is false
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
		});
		
		it('hides members when collapsed', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true,
					collapsed: true
				}
			});
			
			// Members should not be visible
			expect(screen.queryByLabelText("View Alice's profile")).not.toBeInTheDocument();
			expect(screen.queryByLabelText("View Bob the Builder's profile")).not.toBeInTheDocument();
		});
		
		it('shows members when not collapsed', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true,
					collapsed: false
				}
			});
			
			// Members should be visible
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
		});
		
		it('rotates collapse icon when collapsed', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true,
					collapsed: true
				}
			});
			
			const svg = document.querySelector('.collapse-icon');
			expect(svg).toHaveClass('collapsed');
		});
	});
	
	describe('Accessibility', () => {
		it('sets aria-expanded when collapsible', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: [],
					collapsible: true,
					collapsed: false
				}
			});
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			expect(header).toHaveAttribute('aria-expanded', 'true');
		});
		
		it('sets aria-expanded to false when collapsed', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: [],
					collapsible: true,
					collapsed: true
				}
			});
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			expect(header).toHaveAttribute('aria-expanded', 'false');
		});
		
		it('does not set aria-expanded when not collapsible', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: [],
					collapsible: false
				}
			});
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			expect(header).not.toHaveAttribute('aria-expanded');
		});
		
		it('sets aria-controls for collapsible sections', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					collapsible: true,
					collapsed: false
				}
			});
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			expect(header).toHaveAttribute('aria-controls', 'section-online');
		});
		
		it('generates correct aria-controls id for multi-word labels', () => {
			render(MemberSection, {
				props: {
					label: 'Super Admins',
					count: 2,
					members: mockMembers.slice(0, 2),
					collapsible: true,
					collapsed: false
				}
			});
			
			const header = screen.getByRole('button', { name: /Super Admins/ });
			expect(header).toHaveAttribute('aria-controls', 'section-super-admins');
		});
		
		it('disables header button when not collapsible', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: [],
					collapsible: false
				}
			});
			
			const header = screen.getByRole('button', { name: /ONLINE/ });
			expect(header).toBeDisabled();
		});
	});
	
	describe('Member interactions', () => {
		it('renders clickable member items', async () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers
				}
			});
			
			// Members should be clickable buttons
			const memberButton = screen.getByLabelText("View Alice's profile");
			expect(memberButton.tagName).toBe('BUTTON');
			
			// Should be able to click without errors
			await fireEvent.click(memberButton);
		});
		
		it('renders all member items from the members array', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers
				}
			});
			
			// All members should be rendered
			expect(screen.getByLabelText("View Alice's profile")).toBeInTheDocument();
			expect(screen.getByLabelText("View Bob the Builder's profile")).toBeInTheDocument();
			expect(screen.getByLabelText("View Charlie's profile")).toBeInTheDocument();
		});
		
		it('handles context menu on member items', async () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers
				}
			});
			
			const memberButton = screen.getByLabelText("View Bob the Builder's profile");
			
			// Context menu should not throw errors
			await fireEvent.contextMenu(memberButton);
		});
	});
	
	describe('Offline mode', () => {
		it('passes isOffline prop to member items', () => {
			render(MemberSection, {
				props: {
					label: 'OFFLINE',
					count: 3,
					members: mockMembers,
					isOffline: true
				}
			});
			
			// Offline members should have the offline class (applied via MemberItem)
			const memberItems = document.querySelectorAll('.member-item');
			memberItems.forEach(item => {
				expect(item).toHaveClass('offline');
			});
		});
	});
	
	describe('Custom member color', () => {
		it('applies custom color from getMemberColor function', () => {
			const getMemberColor = vi.fn().mockReturnValue('#ff0000');
			
			render(MemberSection, {
				props: {
					label: 'Admins',
					count: 1,
					members: [mockMembers[0]],
					getMemberColor
				}
			});
			
			expect(getMemberColor).toHaveBeenCalledWith(mockMembers[0]);
		});
		
		it('calls getMemberColor for each member', () => {
			const getMemberColor = vi.fn().mockReturnValue('var(--text-normal)');
			
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					getMemberColor
				}
			});
			
			expect(getMemberColor).toHaveBeenCalledTimes(3);
			expect(getMemberColor).toHaveBeenCalledWith(mockMembers[0]);
			expect(getMemberColor).toHaveBeenCalledWith(mockMembers[1]);
			expect(getMemberColor).toHaveBeenCalledWith(mockMembers[2]);
		});
	});
	
	describe('Activity display', () => {
		it('calls getMemberActivity for each member', () => {
			const getMemberActivity = vi.fn().mockReturnValue(null);
			
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					getMemberActivity
				}
			});
			
			expect(getMemberActivity).toHaveBeenCalledTimes(3);
			expect(getMemberActivity).toHaveBeenCalledWith('user-1');
			expect(getMemberActivity).toHaveBeenCalledWith('user-2');
			expect(getMemberActivity).toHaveBeenCalledWith('user-3');
		});
		
		it('calls getActivityText for each member', () => {
			const getActivityText = vi.fn().mockReturnValue(null);
			
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 3,
					members: mockMembers,
					getActivityText
				}
			});
			
			expect(getActivityText).toHaveBeenCalledTimes(3);
			expect(getActivityText).toHaveBeenCalledWith('user-1');
			expect(getActivityText).toHaveBeenCalledWith('user-2');
			expect(getActivityText).toHaveBeenCalledWith('user-3');
		});
	});
	
	describe('CSS classes', () => {
		it('has member-section class on container', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 0,
					members: []
				}
			});
			
			expect(document.querySelector('.member-section')).toBeInTheDocument();
		});
		
		it('has collapsed class when collapsed', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 0,
					members: [],
					collapsible: true,
					collapsed: true
				}
			});
			
			expect(document.querySelector('.member-section')).toHaveClass('collapsed');
		});
		
		it('has collapsible class on header when collapsible', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 0,
					members: [],
					collapsible: true
				}
			});
			
			expect(document.querySelector('.section-header')).toHaveClass('collapsible');
		});
	});
	
	describe('Edge cases', () => {
		it('handles empty members array', () => {
			render(MemberSection, {
				props: {
					label: 'EMPTY',
					count: 0,
					members: []
				}
			});
			
			expect(screen.getByText('EMPTY')).toBeInTheDocument();
			expect(document.querySelectorAll('.member-item')).toHaveLength(0);
		});
		
		it('handles large member counts', () => {
			render(MemberSection, {
				props: {
					label: 'ONLINE',
					count: 9999,
					members: []
				}
			});
			
			expect(screen.getByText(/9999/)).toBeInTheDocument();
		});
		
		it('handles special characters in label', () => {
			render(MemberSection, {
				props: {
					label: '👑 VIP Members',
					count: 1,
					members: []
				}
			});
			
			expect(screen.getByText('👑 VIP Members')).toBeInTheDocument();
		});
	});
});
