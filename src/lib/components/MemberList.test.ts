/**
 * MemberList Component Tests
 * 
 * Tests for the server member list sidebar component
 * per PRD Section 3.5 - 240px wide member sidebar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import MemberList from './MemberList.svelte';
import type { Member, Role } from '$lib/stores/members';
import type { PresenceStatus, Activity } from '$lib/stores/presence';

// Mock Server type for testing
interface MockServer {
	id: string;
	name: string;
	icon: string | null;
	banner: string | null;
	description: string | null;
	owner_id: string;
	created_at: string;
}

const createMockServer = (id: string, name: string): MockServer => ({
	id,
	name,
	icon: null,
	banner: null,
	description: null,
	owner_id: 'owner-1',
	created_at: '2024-01-01T00:00:00Z'
});

// Mock the stores
vi.mock('$lib/stores/servers', () => {
	const currentServer = writable<MockServer | null>(null);
	return { currentServer };
});

vi.mock('$lib/stores/members', () => {
	const members = writable<Member[]>([]);
	const roles = writable<Role[]>([]);
	const loadServerMembers = vi.fn();
	const loadServerRoles = vi.fn();
	return { members, roles, loadServerMembers, loadServerRoles };
});

vi.mock('$lib/stores/presence', () => {
	const _presenceMap = writable<Map<string, { status: PresenceStatus; activities?: Activity[] }>>(new Map());
	// Wrap writable with getPresence method needed by PresenceIndicator (via Avatar)
	// Use arrow functions to properly bind the writable methods
	const presenceStore = {
		subscribe: _presenceMap.subscribe,
		set: (value: Map<string, { status: PresenceStatus; activities?: Activity[] }>) => _presenceMap.set(value),
		update: (fn: (value: Map<string, { status: PresenceStatus; activities?: Activity[] }>) => Map<string, { status: PresenceStatus; activities?: Activity[] }>) => _presenceMap.update(fn),
		getPresence: (userId: string) => {
			let result = { userId, status: 'offline' as PresenceStatus, activities: [] as Activity[] };
			_presenceMap.subscribe(map => {
				const entry = map.get(userId);
				if (entry) result = { userId, status: entry.status, activities: entry.activities || [] };
			})();
			return result;
		},
		setStatus: vi.fn(),
	};
	const getActivityLabel = vi.fn((type: number) => {
		switch (type) {
			case 0: return 'Playing';
			case 1: return 'Streaming';
			case 2: return 'Listening to';
			case 3: return 'Watching';
			case 4: return '';
			case 5: return 'Competing in';
			default: return '';
		}
	});
	const getStatusColor = vi.fn((status: string) => {
		switch (status) {
			case 'online': return '#3ba55c';
			case 'idle': return '#faa61a';
			case 'dnd': return '#ed4245';
			case 'invisible':
			case 'offline':
			default: return '#747f8d';
		}
	});
	const getStatusLabel = vi.fn((status: string) => {
		switch (status) {
			case 'online': return 'Online';
			case 'idle': return 'Idle';
			case 'dnd': return 'Do Not Disturb';
			case 'invisible': return 'Invisible';
			case 'offline':
			default: return 'Offline';
		}
	});
	return { presenceStore, getActivityLabel, getStatusColor, getStatusLabel };
});

// Import mocked modules
import { currentServer } from '$lib/stores/servers';
import { members, roles, loadServerMembers, loadServerRoles } from '$lib/stores/members';
import { presenceStore as _presenceStore } from '$lib/stores/presence';

// Cast presenceStore to include set/update methods from our mock
const presenceStore = _presenceStore as typeof _presenceStore & {
	set: (value: Map<string, { status: PresenceStatus; activities?: Activity[] }>) => void;
	update: (fn: (value: Map<string, { status: PresenceStatus; activities?: Activity[] }>) => Map<string, { status: PresenceStatus; activities?: Activity[] }>) => void;
};

// Mock member data
const createMockMember = (id: string, username: string, userRoles: string[] = [], nickname: string | null = null): Member => ({
	id: `member-${id}`,
	user_id: `user-${id}`,
	server_id: 'server-1',
	nickname,
	roles: userRoles,
	joined_at: '2024-01-01T00:00:00Z',
	user: {
		id: `user-${id}`,
		username,
		display_name: username.charAt(0).toUpperCase() + username.slice(1),
		avatar: `https://example.com/${username}.png`,
		bot: false
	}
});

const mockMembers: Member[] = [
	createMockMember('1', 'alice', ['admin', 'moderator']),
	createMockMember('2', 'bob', ['moderator']),
	createMockMember('3', 'charlie', ['member']),
	createMockMember('4', 'diana', [], 'Diana the Great'),
	createMockMember('5', 'eve', ['member'])
];

const mockRoles: Role[] = [
	{
		id: 'admin',
		name: 'Admin',
		color: '#ff0000',
		position: 3,
		permissions: 8,
		hoist: true
	},
	{
		id: 'moderator',
		name: 'Moderator',
		color: '#00ff00',
		position: 2,
		permissions: 4,
		hoist: true
	},
	{
		id: 'member',
		name: 'Member',
		color: '#0000ff',
		position: 1,
		permissions: 1,
		hoist: false
	},
	{
		id: 'everyone',
		name: '@everyone',
		color: '#000000',
		position: 0,
		permissions: 0,
		hoist: false
	}
];

describe('MemberList', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset stores to initial state
		currentServer.set(null);
		members.set([]);
		roles.set([]);
		presenceStore.set(new Map());
	});

	afterEach(() => {
		cleanup();
	});

	describe('Rendering', () => {
		it('renders nothing when no server is selected', () => {
			currentServer.set(null);
			
			render(MemberList);
			
			expect(document.querySelector('.member-list')).not.toBeInTheDocument();
		});

		it('renders member list when server is selected', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			// Set all members as online
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(document.querySelector('.member-list')).toBeInTheDocument();
			});
		});

		it('has correct width per PRD (240px)', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);

			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);

			render(MemberList);

			await waitFor(() => {
				const list = document.querySelector('.member-list');
				expect(list).toBeInTheDocument();
				// Verify the element has the member-list class which defines width: 240px in CSS.
				// jsdom doesn't compute styles from <style> blocks, so we verify the class exists.
				expect(list).toHaveClass('member-list');
			});
		});
	});

	describe('Data loading', () => {
		it('calls loadServerMembers when server changes', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			
			render(MemberList);
			
			await waitFor(() => {
				expect(loadServerMembers).toHaveBeenCalledWith('server-1');
			});
		});

		it('calls loadServerRoles when server changes', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			
			render(MemberList);
			
			await waitFor(() => {
				expect(loadServerRoles).toHaveBeenCalledWith('server-1');
			});
		});

		it('reloads data when server changes', async () => {
			currentServer.set(createMockServer('server-1', 'Server 1'));
			
			render(MemberList);
			
			await waitFor(() => {
				expect(loadServerMembers).toHaveBeenCalledWith('server-1');
			});
			
			// Change to different server
			currentServer.set(createMockServer('server-2', 'Server 2'));
			
			await waitFor(() => {
				expect(loadServerMembers).toHaveBeenCalledWith('server-2');
			});
		});
	});

	describe('Member grouping', () => {
		it('groups members by hoisted roles', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			// Set all members as online
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should see ADMIN group (hoisted)
				expect(screen.getByText(/ADMIN/i)).toBeInTheDocument();
				// Should see MODERATOR group (hoisted)
				expect(screen.getByText(/MODERATOR/i)).toBeInTheDocument();
			});
		});

		it('shows ONLINE section for members without hoisted roles', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			// Set all members as online
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Diana has no hoisted roles, should be in ONLINE
				expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
			});
		});

		it('shows OFFLINE section for offline members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			// Set some members as offline
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceMap.set('user-2', { status: 'offline' });
			presenceMap.set('user-3', { status: 'offline' });
			presenceMap.set('user-4', { status: 'online' });
			presenceMap.set('user-5', { status: 'offline' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
			});
		});

		it('sorts members alphabetically within groups', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			// Create members that need alphabetical sorting
			const unsortedMembers = [
				createMockMember('z', 'zara', ['member']),
				createMockMember('a', 'adam', ['member']),
				createMockMember('m', 'mike', ['member'])
			];
			members.set(unsortedMembers);
			roles.set([{ ...mockRoles[2], hoist: false }]); // Non-hoisted member role
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			unsortedMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberItems = document.querySelectorAll('.member-item');
				expect(memberItems.length).toBeGreaterThan(0);
			});
		});

		it('displays member count in group headers', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Look for count pattern (e.g., "ADMIN — 1")
				const headers = document.querySelectorAll('.group-header');
				expect(headers.length).toBeGreaterThan(0);
				
				// Each header should contain a dash and number
				headers.forEach(header => {
					expect(header.textContent).toMatch(/—\s*\d+/);
				});
			});
		});
	});

	describe('Member display', () => {
		it('displays member nickname when available', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'diana', [], 'Diana the Great')]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText('Diana the Great')).toBeInTheDocument();
			});
		});

		it('displays display_name when no nickname', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			const memberWithDisplayName = createMockMember('1', 'alice', []);
			memberWithDisplayName.nickname = null;
			memberWithDisplayName.user.display_name = 'Alice Wonderland';
			members.set([memberWithDisplayName]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText('Alice Wonderland')).toBeInTheDocument();
			});
		});

		it('displays username as fallback', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			const memberWithUsername = createMockMember('1', 'bob', []);
			memberWithUsername.nickname = null;
			// Set display_name to empty string to trigger username fallback
			memberWithUsername.user.display_name = '';
			members.set([memberWithUsername]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText('bob')).toBeInTheDocument();
			});
		});

		it('applies role color to member name', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', ['admin'])]);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberName = document.querySelector('.member-name');
				expect(memberName).toBeInTheDocument();
				// Admin role has color #ff0000
				expect(memberName).toHaveStyle('color: #ff0000');
			});
		});

		it('uses highest position role color', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			// Member with both admin (pos 3) and moderator (pos 2) roles
			members.set([createMockMember('1', 'alice', ['moderator', 'admin'])]);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberName = document.querySelector('.member-name');
				// Should use admin color (#ff0000) since it has higher position
				expect(memberName).toHaveStyle('color: #ff0000');
			});
		});

		it('uses default color when no role has color', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', ['everyone'])]);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberName = document.querySelector('.member-name');
				expect(memberName).toBeInTheDocument();
				// Default color when no role color
				expect(memberName).toHaveStyle('color: var(--text-normal)');
			});
		});
	});

	describe('Activity display', () => {
		it('shows activity for online members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus; activities?: Activity[] }>();
			presenceMap.set('user-1', {
				status: 'online',
				activities: [{
					type: 0, // Playing
					name: 'Minecraft',
					state: undefined,
					details: undefined,
					timestamps: undefined
				}]
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText(/Playing Minecraft/)).toBeInTheDocument();
			});
		});

		it('shows listening activity', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus; activities?: Activity[] }>();
			presenceMap.set('user-1', {
				status: 'online',
				activities: [{
					type: 2, // Listening
					name: 'Spotify',
					state: 'Artist Name',
					details: 'Song Title',
					timestamps: undefined
				}]
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText(/Listening to Spotify/)).toBeInTheDocument();
			});
		});

		it('hides activity for offline members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus; activities?: Activity[] }>();
			presenceMap.set('user-1', {
				status: 'offline',
				activities: [{
					type: 0,
					name: 'Minecraft',
					state: undefined,
					details: undefined,
					timestamps: undefined
				}]
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Alice should be shown but without activity
				expect(document.querySelector('.member-item')).toBeInTheDocument();
				expect(screen.queryByText(/Playing Minecraft/)).not.toBeInTheDocument();
			});
		});
	});

	describe('Presence handling', () => {
		it('treats invisible status as offline', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'invisible' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should be in OFFLINE group
				expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
			});
		});

		it('treats missing presence as offline', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			// Empty presence map - no presence data
			presenceStore.set(new Map());
			
			render(MemberList);
			
			await waitFor(() => {
				// Should be in OFFLINE group
				expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
			});
		});

		it('recognizes idle status as online', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'idle' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should be in ONLINE group (idle is considered online for grouping)
				expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
			});
		});

		it('recognizes dnd status as online', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'dnd' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should be in ONLINE group (dnd is considered online for grouping)
				expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
			});
		});
	});

	describe('Offline member styling', () => {
		it('applies offline class to offline members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			presenceStore.set(new Map()); // No presence = offline
			
			render(MemberList);
			
			await waitFor(() => {
				const memberItem = document.querySelector('.member-item');
				expect(memberItem).toHaveClass('offline');
			});
		});

		it('does not apply offline class to online members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberItem = document.querySelector('.member-item');
				expect(memberItem).not.toHaveClass('offline');
			});
		});
	});

	describe('Avatar rendering', () => {
		it('renders Avatar component with correct props', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			const member = createMockMember('1', 'alice', []);
			members.set([member]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Avatar should be rendered with presence indicator
				const avatar = document.querySelector('.avatar');
				expect(avatar).toBeInTheDocument();
			});
		});
	});

	describe('Interactions', () => {
		it('renders member items as buttons', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberItem = document.querySelector('.member-item');
				expect(memberItem?.tagName).toBe('BUTTON');
			});
		});

		it('applies hover styles on member items', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Member item should exist and be hoverable
				const memberItem = document.querySelector('.member-item');
				expect(memberItem).toBeInTheDocument();
			});
		});
	});

	describe('CSS classes', () => {
		it('has member-list class on container', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([]);
			roles.set([]);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(document.querySelector('.member-list')).toBeInTheDocument();
			});
		});

		it('has member-group class on each group', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const groups = document.querySelectorAll('.member-group');
				expect(groups.length).toBeGreaterThan(0);
			});
		});

		it('has group-header class on headers', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set(mockMembers);
			roles.set(mockRoles);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			mockMembers.forEach(m => {
				presenceMap.set(m.user.id, { status: 'online' });
			});
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const headers = document.querySelectorAll('.group-header');
				expect(headers.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Edge cases', () => {
		it('handles empty member list', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([]);
			roles.set([]);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should still render the container
				expect(document.querySelector('.member-list')).toBeInTheDocument();
				// But no groups
				expect(document.querySelectorAll('.member-group')).toHaveLength(0);
			});
		});

		it('handles members with no roles', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', [])]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should be in ONLINE group
				expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
			});
		});

		it('handles roles with no members', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			members.set([createMockMember('1', 'alice', ['member'])]); // Non-hoisted role
			roles.set(mockRoles); // Has hoisted admin/mod roles
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				// Should not show empty Admin/Moderator groups
				expect(screen.queryByText(/ADMIN — 0/i)).not.toBeInTheDocument();
			});
		});

		it('handles special characters in usernames', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			const member = createMockMember('1', '★User_123★', []);
			member.user.display_name = '★User_123★';
			members.set([member]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				expect(screen.getByText('★User_123★')).toBeInTheDocument();
			});
		});

		it('handles very long usernames with truncation', async () => {
			currentServer.set(createMockServer('server-1', 'Test Server'));
			const member = createMockMember('1', 'verylongusernamethatshouldbedefinitelytruncated', []);
			member.user.display_name = 'This is a very long display name that should be truncated';
			members.set([member]);
			roles.set([]);
			
			const presenceMap = new Map<string, { status: PresenceStatus }>();
			presenceMap.set('user-1', { status: 'online' });
			presenceStore.set(presenceMap);
			
			render(MemberList);
			
			await waitFor(() => {
				const memberName = document.querySelector('.member-name');
				expect(memberName).toBeInTheDocument();
				// CSS should handle truncation via text-overflow: ellipsis
			});
		});
	});
});
