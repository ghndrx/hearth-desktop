import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ServerFolder from './ServerFolder.svelte';
import type { Server } from '$lib/stores/servers';

describe('ServerFolder', () => {
	const mockServers: Server[] = [
		{
			id: '1',
			name: 'Server One',
			icon: null,
			banner: null,
			description: null,
			owner_id: 'user1',
			created_at: '2024-01-01T00:00:00Z'
		},
		{
			id: '2',
			name: 'Server Two',
			icon: 'https://example.com/icon2.png',
			banner: null,
			description: null,
			owner_id: 'user2',
			created_at: '2024-01-02T00:00:00Z'
		}
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('collapsed state', () => {
		it('renders folder in collapsed state by default', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: false
				}
			});

			expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
			expect(container.querySelector('.folder-icon')).toBeInTheDocument();
		});

		it('displays folder name in tooltip when collapsed', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'My Folder',
					servers: mockServers,
					expanded: false
				}
			});

			const tooltip = container.querySelector('.tooltip');
			expect(tooltip?.textContent).toBe('My Folder');
		});

		it('shows preview icons in collapsed state', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: false
				}
			});

			const previewIcons = container.querySelectorAll('.preview-icon');
			expect(previewIcons.length).toBe(2);
		});

		it('expands folder when clicked in collapsed state', async () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: false
				}
			});

			const folderButton = container.querySelector('.folder-icon');
			if (folderButton) {
				await fireEvent.click(folderButton);
			}

			// After click, it should re-render with expanded state
			// Note: We need to check the updated state
			expect(container.querySelector('.folder-expanded')).toBeInTheDocument();
		});

		it('shows selected pill when a server in folder is selected', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: false,
					selectedServerId: '1'
				}
			});

			const pill = container.querySelector('.pill-indicator');
			expect(pill).toHaveClass('pill-selected');
		});

		it('shows unread pill when a server has unread messages', () => {
			const serversWithUnread = [
				{ ...mockServers[0], hasUnread: true },
				mockServers[1]
			];

			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: serversWithUnread,
					expanded: false,
					selectedServerId: null
				}
			});

			const pill = container.querySelector('.pill-indicator');
			expect(pill).toHaveClass('pill-unread');
		});

		it('shows mention badge with total mentions', () => {
			const serversWithMentions = [
				{ ...mockServers[0], mentionCount: 5 },
				{ ...mockServers[1], mentionCount: 3 }
			];

			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: serversWithMentions,
					expanded: false
				}
			});

			const badge = container.querySelector('.mention-badge');
			expect(badge?.textContent).toBe('8');
		});

		it('caps mention badge at 99+', () => {
			const serversWithManyMentions = [
				{ ...mockServers[0], mentionCount: 80 },
				{ ...mockServers[1], mentionCount: 50 }
			];

			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: serversWithManyMentions,
					expanded: false
				}
			});

			const badge = container.querySelector('.mention-badge');
			expect(badge?.textContent).toBe('99+');
		});

		it('does not show mention badge when total is 0', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: false
				}
			});

			expect(container.querySelector('.mention-badge')).not.toBeInTheDocument();
		});
	});

	describe('expanded state', () => {
		it('renders folder in expanded state', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: true
				}
			});

			expect(container.querySelector('.folder-expanded')).toBeInTheDocument();
			expect(container.querySelector('.folder-header')).toBeInTheDocument();
		});

		it('displays folder name in header', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'My Games',
					servers: mockServers,
					expanded: true
				}
			});

			const folderName = container.querySelector('.folder-name');
			expect(folderName?.textContent).toBe('My Games');
		});

		it('shows all servers in expanded state', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: true
				}
			});

			const serverIcons = container.querySelectorAll('.folder-servers .server-icon');
			expect(serverIcons.length).toBeGreaterThan(0);
		});

		it('collapses folder when header is clicked', async () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: true
				}
			});

			const header = container.querySelector('.folder-header');
			if (header) {
				await fireEvent.click(header);
			}

			// Should switch to collapsed view
			expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
		});

		it('supports keyboard navigation on header', async () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: true
				}
			});

			const header = container.querySelector('.folder-header');
			if (header) {
				await fireEvent.keyDown(header, { key: 'Enter' });
				expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
			}
		});
	});

	describe('events', () => {
		it('dispatches select event when server is clicked in expanded folder', async () => {
			const handleSelect = vi.fn();
			const { container } = render(ServerFolder, {
				props: {
					name: 'Test Folder',
					servers: mockServers,
					expanded: true
				},
				events: { select: handleSelect }
			} as any);

			// Find and click on a server icon button within the expanded folder
			const serverIconButton = container.querySelector('.folder-servers .server-icon');
			expect(serverIconButton).toBeInTheDocument();
			await fireEvent.click(serverIconButton!);

			expect(handleSelect).toHaveBeenCalledTimes(1);
			expect(handleSelect.mock.calls[0][0].detail).toEqual({
				server: mockServers[0]
			});
		});
	});

	describe('edge cases', () => {
		it('handles empty servers array', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Empty Folder',
					servers: [],
					expanded: false
				}
			});

			expect(container.querySelector('.server-icon-wrapper')).toBeInTheDocument();
			expect(container.querySelector('.folder-preview')).toBeInTheDocument();
		});

		it('handles single server', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Single Folder',
					servers: [mockServers[0]],
					expanded: false
				}
			});

			const previewIcons = container.querySelectorAll('.preview-icon');
			expect(previewIcons.length).toBe(1);
		});

		it('limits preview icons to 4 servers', () => {
			const manyServers: Server[] = Array.from({ length: 6 }, (_, i) => ({
				id: `${i}`,
				name: `Server ${i}`,
				icon: null,
				banner: null,
				description: null,
				owner_id: 'user1',
				created_at: '2024-01-01T00:00:00Z'
			}));

			const { container } = render(ServerFolder, {
				props: {
					name: 'Many Servers',
					servers: manyServers,
					expanded: false
				}
			});

			const previewIcons = container.querySelectorAll('.preview-icon');
			expect(previewIcons.length).toBe(4);
		});

		it('applies custom color when provided', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Colored Folder',
					servers: mockServers,
					expanded: false,
					color: '#ff0000'
				}
			});

			const folderIcon = container.querySelector('.folder-icon');
			expect(folderIcon).toHaveStyle('--folder-color: #ff0000');
		});

		it('uses default color when not provided', () => {
			const { container } = render(ServerFolder, {
				props: {
					name: 'Default Folder',
					servers: mockServers,
					expanded: false
				}
			});

			const folderIcon = container.querySelector('.folder-icon');
			expect(folderIcon).toHaveStyle('--folder-color: #5865f2');
		});
	});
});
