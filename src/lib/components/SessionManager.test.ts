import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import SessionManager from './SessionManager.svelte';

const mockSessions = [
	{
		id: '1',
		name: 'General Chat',
		type: 'chat' as const,
		lastMessage: 'Hello everyone!',
		lastActivity: new Date(Date.now() - 60000), // 1 minute ago
		unreadCount: 5,
		isPinned: true,
		isActive: false
	},
	{
		id: '2',
		name: 'John Doe',
		type: 'dm' as const,
		lastMessage: 'See you tomorrow',
		lastActivity: new Date(Date.now() - 3600000), // 1 hour ago
		unreadCount: 0,
		isPinned: false,
		isActive: false
	},
	{
		id: '3',
		name: 'Project Team',
		type: 'group' as const,
		lastMessage: 'Meeting at 3pm',
		lastActivity: new Date(Date.now() - 86400000), // 1 day ago
		unreadCount: 12,
		isPinned: false,
		isActive: false,
		participants: ['Alice', 'Bob', 'Charlie']
	},
	{
		id: '4',
		name: 'AI Assistant',
		type: 'ai' as const,
		lastMessage: 'How can I help?',
		lastActivity: new Date(Date.now() - 300000), // 5 minutes ago
		unreadCount: 1,
		isPinned: false,
		isActive: true
	}
];

describe('SessionManager', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders when open', () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: '4'
			}
		});

		expect(screen.getByRole('dialog')).toBeInTheDocument();
		expect(screen.getByText('Sessions')).toBeInTheDocument();
	});

	it('does not render when closed', () => {
		render(SessionManager, {
			props: {
				isOpen: false,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('displays all sessions', () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		expect(screen.getByText('General Chat')).toBeInTheDocument();
		expect(screen.getByText('John Doe')).toBeInTheDocument();
		expect(screen.getByText('Project Team')).toBeInTheDocument();
		expect(screen.getByText('AI Assistant')).toBeInTheDocument();
	});

	it('shows unread badges', () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		expect(screen.getByText('5')).toBeInTheDocument();
		expect(screen.getByText('12')).toBeInTheDocument();
		expect(screen.getByText('1')).toBeInTheDocument();
	});

	it('filters sessions by search query', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const searchInput = screen.getByPlaceholderText('Search sessions...');
		await fireEvent.input(searchInput, { target: { value: 'John' } });

		expect(screen.getByText('John Doe')).toBeInTheDocument();
		expect(screen.queryByText('General Chat')).not.toBeInTheDocument();
	});

	it('filters sessions by type', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const typeSelect = screen.getByLabelText('Type:');
		await fireEvent.change(typeSelect, { target: { value: 'dm' } });

		expect(screen.getByText('John Doe')).toBeInTheDocument();
		expect(screen.queryByText('General Chat')).not.toBeInTheDocument();
		expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
	});

	it('filters to show pinned only', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const pinnedCheckbox = screen.getByText('Pinned only').previousElementSibling as HTMLInputElement;
		await fireEvent.click(pinnedCheckbox);

		expect(screen.getByText('General Chat')).toBeInTheDocument();
		expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
	});

	it('sorts sessions by unread count', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const sortSelect = screen.getByLabelText('Sort:');
		await fireEvent.change(sortSelect, { target: { value: 'unread' } });

		const sessionItems = screen.getAllByRole('option');
		// Pinned items come first, then sorted by unread
		expect(sessionItems[0]).toHaveTextContent('General Chat'); // pinned
		expect(sessionItems[1]).toHaveTextContent('Project Team'); // 12 unread
	});

	it('emits session-switch event on selection', async () => {
		const { component } = render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const switchHandler = vi.fn();
		component.$on('session-switch', switchHandler);

		const johnSession = screen.getByText('John Doe').closest('[data-session-item]');
		await fireEvent.click(johnSession!);

		expect(switchHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { sessionId: '2' }
			})
		);
	});

	it('emits session-new event when clicking new button', async () => {
		const { component } = render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const newHandler = vi.fn();
		component.$on('session-new', newHandler);

		const newButton = screen.getByTitle('New Session (⌘N)');
		await fireEvent.click(newButton);

		expect(newHandler).toHaveBeenCalled();
	});

	it('emits close event when clicking backdrop', async () => {
		const { component } = render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const closeHandler = vi.fn();
		component.$on('close', closeHandler);

		const backdrop = document.querySelector('.session-manager-backdrop');
		await fireEvent.click(backdrop!);

		expect(closeHandler).toHaveBeenCalled();
	});

	it('handles keyboard navigation', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		await fireEvent.keyDown(document, { key: 'ArrowDown' });
		await fireEvent.keyDown(document, { key: 'ArrowDown' });

		const sessionItems = screen.getAllByRole('option');
		expect(sessionItems[2]).toHaveClass('selected');
	});

	it('closes on Escape key', async () => {
		const { component } = render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const closeHandler = vi.fn();
		component.$on('close', closeHandler);

		await fireEvent.keyDown(document, { key: 'Escape' });

		expect(closeHandler).toHaveBeenCalled();
	});

	it('shows empty state when no sessions match filter', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const searchInput = screen.getByPlaceholderText('Search sessions...');
		await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

		expect(screen.getByText('No sessions found')).toBeInTheDocument();
	});

	it('highlights current active session', () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: '4'
			}
		});

		const aiSession = screen.getByText('AI Assistant').closest('[data-session-item]');
		expect(aiSession).toHaveClass('active');
	});

	it('formats last activity correctly', () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		expect(screen.getByText('1m ago')).toBeInTheDocument();
		expect(screen.getByText('1h ago')).toBeInTheDocument();
		expect(screen.getByText('1d ago')).toBeInTheDocument();
	});

	it('searches within participant names', async () => {
		render(SessionManager, {
			props: {
				isOpen: true,
				sessions: mockSessions,
				currentSessionId: null
			}
		});

		const searchInput = screen.getByPlaceholderText('Search sessions...');
		await fireEvent.input(searchInput, { target: { value: 'Alice' } });

		expect(screen.getByText('Project Team')).toBeInTheDocument();
		expect(screen.queryByText('General Chat')).not.toBeInTheDocument();
	});
});
