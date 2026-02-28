/**
 * SplitView.test.ts
 * FEAT-003: Split View (Desktop)
 * 
 * Comprehensive tests for split view store and component functionality.
 * Tests cover:
 * - Store state management
 * - Panel pinning/unpinning
 * - Resize behavior
 * - Persistence
 * - Accessibility
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { 
	splitViewStore, 
	splitViewPanels, 
	splitViewEnabled,
	splitViewConfig,
	splitViewResizing,
	canAddSplitPanel,
	splitViewTotalWidth
} from '$lib/stores/splitView';
import type { Channel } from '$lib/stores/channels';
import type { Thread } from '$lib/stores/thread';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	};
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { 
	value: { innerWidth: 1920 },
	writable: true 
});

describe('Split View Store', () => {
	// Mock channel data
	const mockDMChannel: Channel = {
		id: 'dm-123',
		type: 1, // DM
		name: '',
		topic: null,
		position: 0,
		server_id: null,
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		e2ee_enabled: false,
		last_message_id: null,
		last_message_at: null,
		recipients: [
			{
				id: 'user-456',
				username: 'testuser',
				display_name: 'Test User',
				avatar: null
			}
		]
	};

	const mockServerChannel: Channel = {
		id: 'channel-789',
		type: 0, // Text
		name: 'general',
		topic: 'General discussion',
		position: 0,
		server_id: 'server-001',
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		e2ee_enabled: false,
		last_message_id: null,
		last_message_at: null
	};

	const mockThread: Thread = {
		id: 'thread-abc',
		channel_id: 'channel-789',
		parent_message_id: 'msg-001',
		name: 'Discussion Thread',
		message_count: 5,
		created_at: '2024-01-01T00:00:00Z',
		parent_message: {
			id: 'msg-001',
			channel_id: 'channel-789',
			author_id: 'user-123',
			content: 'This is the thread starter message',
			encrypted: false,
			attachments: [],
			reactions: [],
			reply_to: null,
			pinned: false,
			created_at: '2024-01-01T00:00:00Z',
			edited_at: null,
			author: {
				id: 'user-123',
				username: 'author',
				display_name: 'Thread Author',
				avatar: null
			}
		}
	};

	beforeEach(() => {
		// Reset store state
		splitViewStore.clearAll();
		splitViewStore.enable();
		localStorageMock.clear();
	});

	describe('Initial state', () => {
		it('should start with empty panels', () => {
			splitViewStore.clearAll();
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(0);
		});

		it('should start with split view enabled by default', () => {
			const enabled = get(splitViewEnabled);
			expect(enabled).toBe(true);
		});

		it('should have default config values', () => {
			const config = get(splitViewConfig);
			expect(config.maxPanels).toBe(3);
			expect(config.defaultPanelWidth).toBe(400);
			expect(config.minPanelWidth).toBe(280);
			expect(config.maxPanelWidth).toBe(600);
			expect(config.mainPanelMinWidth).toBe(400);
		});
	});

	describe('Pinning DMs', () => {
		it('should pin a DM channel', () => {
			splitViewStore.pinDM(mockDMChannel);
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].type).toBe('dm');
			expect(panels[0].channelId).toBe('dm-123');
			expect(panels[0].title).toBe('Test User');
		});

		it('should not duplicate pinned DMs', () => {
			splitViewStore.pinDM(mockDMChannel);
			splitViewStore.pinDM(mockDMChannel);
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
		});

		it('should respect max panels limit', () => {
			const config = get(splitViewConfig);
			
			for (let i = 0; i < config.maxPanels + 2; i++) {
				const channel = { ...mockDMChannel, id: `dm-${i}` };
				splitViewStore.pinDM(channel);
			}
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(config.maxPanels);
		});

		it('should use display_name as title when available', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panels = get(splitViewPanels);
			expect(panels[0].title).toBe('Test User');
		});

		it('should fall back to username when display_name is not available', () => {
			const channel = {
				...mockDMChannel,
				recipients: [{ id: 'user', username: 'justuser', display_name: null, avatar: null }]
			};
			splitViewStore.pinDM(channel);
			const panels = get(splitViewPanels);
			expect(panels[0].title).toBe('justuser');
		});
	});

	describe('Pinning channels', () => {
		it('should pin a server channel', () => {
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].type).toBe('channel');
			expect(panels[0].channelId).toBe('channel-789');
			expect(panels[0].title).toBe('general');
			expect(panels[0].serverId).toBe('server-001');
		});

		it('should set subtitle from channel topic', () => {
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			const panels = get(splitViewPanels);
			expect(panels[0].subtitle).toBe('General discussion');
		});
	});

	describe('Pinning threads', () => {
		it('should pin a thread', () => {
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].type).toBe('thread');
			expect(panels[0].threadId).toBe('thread-abc');
			expect(panels[0].title).toBe('Discussion Thread');
		});

		it('should include parent message ID', () => {
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			const panels = get(splitViewPanels);
			expect(panels[0].parentMessageId).toBe('msg-001');
		});

		it('should set subtitle from parent message content', () => {
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			const panels = get(splitViewPanels);
			expect(panels[0].subtitle).toBe('This is the thread starter message');
		});
	});

	describe('Unpinning', () => {
		it('should unpin by panel ID', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panels = get(splitViewPanels);
			const panelId = panels[0].id;
			
			splitViewStore.unpin(panelId);
			
			expect(get(splitViewPanels)).toHaveLength(0);
		});

		it('should unpin by target ID and type', () => {
			splitViewStore.pinDM(mockDMChannel);
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			
			splitViewStore.unpinByTarget('dm-123', 'dm');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].type).toBe('channel');
		});

		it('should not affect other panel types when unpinning', () => {
			// Pin both a DM and channel with same ID (edge case)
			splitViewStore.pinDM(mockDMChannel);
			splitViewStore.pinChannel({ ...mockServerChannel, id: 'dm-123' }, 'server-001');
			
			// Unpin only the DM type
			splitViewStore.unpinByTarget('dm-123', 'dm');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].type).toBe('channel');
		});
	});

	describe('Panel state', () => {
		it('should toggle panel collapse', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			
			expect(get(splitViewPanels)[0].isCollapsed).toBe(false);
			
			splitViewStore.toggleCollapse(panelId);
			expect(get(splitViewPanels)[0].isCollapsed).toBe(true);
			
			splitViewStore.toggleCollapse(panelId);
			expect(get(splitViewPanels)[0].isCollapsed).toBe(false);
		});

		it('should set panel width', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			
			splitViewStore.setPanelWidth(panelId, 500);
			
			expect(get(splitViewPanels)[0].width).toBe(500);
		});

		it('should clamp panel width to min/max', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			const config = get(splitViewConfig);
			
			// Try to set below minimum
			splitViewStore.setPanelWidth(panelId, 100);
			expect(get(splitViewPanels)[0].width).toBe(config.minPanelWidth);
			
			// Try to set above maximum
			splitViewStore.setPanelWidth(panelId, 1000);
			expect(get(splitViewPanels)[0].width).toBe(config.maxPanelWidth);
		});

		it('should initialize panel with default width', () => {
			const config = get(splitViewConfig);
			splitViewStore.pinDM(mockDMChannel);
			expect(get(splitViewPanels)[0].width).toBe(config.defaultPanelWidth);
		});
	});

	describe('Split view toggle', () => {
		it('should toggle split view on/off', () => {
			expect(get(splitViewEnabled)).toBe(true);
			
			splitViewStore.toggle();
			expect(get(splitViewEnabled)).toBe(false);
			
			splitViewStore.toggle();
			expect(get(splitViewEnabled)).toBe(true);
		});

		it('should enable split view', () => {
			splitViewStore.disable();
			expect(get(splitViewEnabled)).toBe(false);
			
			splitViewStore.enable();
			expect(get(splitViewEnabled)).toBe(true);
		});

		it('should disable split view', () => {
			splitViewStore.enable();
			expect(get(splitViewEnabled)).toBe(true);
			
			splitViewStore.disable();
			expect(get(splitViewEnabled)).toBe(false);
		});
	});

	describe('Derived stores', () => {
		it('should calculate if more panels can be added', () => {
			expect(get(canAddSplitPanel)).toBe(true);
			
			const config = get(splitViewConfig);
			for (let i = 0; i < config.maxPanels; i++) {
				const channel = { ...mockDMChannel, id: `dm-${i}` };
				splitViewStore.pinDM(channel);
			}
			
			expect(get(canAddSplitPanel)).toBe(false);
		});

		it('should return false for canAddSplitPanel when disabled', () => {
			splitViewStore.disable();
			expect(get(canAddSplitPanel)).toBe(false);
		});

		it('should calculate total width of panels', () => {
			splitViewStore.pinDM(mockDMChannel);
			const config = get(splitViewConfig);
			
			expect(get(splitViewTotalWidth)).toBe(config.defaultPanelWidth);
			
			// Add another panel
			const channel2 = { ...mockDMChannel, id: 'dm-456' };
			splitViewStore.pinDM(channel2);
			
			expect(get(splitViewTotalWidth)).toBe(config.defaultPanelWidth * 2);
		});

		it('should use collapsed width for collapsed panels', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			const config = get(splitViewConfig);
			
			expect(get(splitViewTotalWidth)).toBe(config.defaultPanelWidth);
			
			splitViewStore.toggleCollapse(panelId);
			
			// Collapsed panels are 48px wide
			expect(get(splitViewTotalWidth)).toBe(48);
		});
	});

	describe('Panel reordering', () => {
		it('should reorder panels', () => {
			splitViewStore.pinDM(mockDMChannel);
			const channel2 = { ...mockDMChannel, id: 'dm-456', recipients: [{ ...mockDMChannel.recipients![0], username: 'user2' }] };
			splitViewStore.pinDM(channel2);
			const channel3 = { ...mockDMChannel, id: 'dm-789', recipients: [{ ...mockDMChannel.recipients![0], username: 'user3' }] };
			splitViewStore.pinDM(channel3);
			
			const originalPanels = get(splitViewPanels);
			const firstPanelId = originalPanels[0].id;
			
			// Move first panel to last position
			splitViewStore.reorder(0, 2);
			
			const reorderedPanels = get(splitViewPanels);
			expect(reorderedPanels[2].id).toBe(firstPanelId);
		});

		it('should maintain panel count after reorder', () => {
			splitViewStore.pinDM(mockDMChannel);
			const channel2 = { ...mockDMChannel, id: 'dm-456' };
			splitViewStore.pinDM(channel2);
			
			const originalCount = get(splitViewPanels).length;
			splitViewStore.reorder(0, 1);
			
			expect(get(splitViewPanels).length).toBe(originalCount);
		});
	});

	describe('isPinned helper', () => {
		it('should return true for pinned items', () => {
			splitViewStore.pinDM(mockDMChannel);
			
			expect(splitViewStore.isPinned('dm-123', 'dm')).toBe(true);
			expect(splitViewStore.isPinned('dm-123', 'channel')).toBe(false);
			expect(splitViewStore.isPinned('dm-999', 'dm')).toBe(false);
		});

		it('should work for threads', () => {
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			
			expect(splitViewStore.isPinned('thread-abc', 'thread')).toBe(true);
			expect(splitViewStore.isPinned('thread-xyz', 'thread')).toBe(false);
		});

		it('should work for channels', () => {
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			
			expect(splitViewStore.isPinned('channel-789', 'channel')).toBe(true);
			expect(splitViewStore.isPinned('channel-999', 'channel')).toBe(false);
		});
	});

	describe('Configuration updates', () => {
		it('should update configuration', () => {
			splitViewStore.updateConfig({ maxPanels: 5, defaultPanelWidth: 450 });
			
			const config = get(splitViewConfig);
			expect(config.maxPanels).toBe(5);
			expect(config.defaultPanelWidth).toBe(450);
		});

		it('should preserve other config values when updating', () => {
			const originalConfig = get(splitViewConfig);
			splitViewStore.updateConfig({ maxPanels: 5 });
			
			const config = get(splitViewConfig);
			expect(config.maxPanels).toBe(5);
			expect(config.minPanelWidth).toBe(originalConfig.minPanelWidth);
			expect(config.maxPanelWidth).toBe(originalConfig.maxPanelWidth);
		});
	});

	describe('Clear all', () => {
		it('should clear all panels', () => {
			splitViewStore.pinDM(mockDMChannel);
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			
			expect(get(splitViewPanels)).toHaveLength(3);
			
			splitViewStore.clearAll();
			
			expect(get(splitViewPanels)).toHaveLength(0);
		});
	});

	describe('Resize functionality', () => {
		it('should start resize with correct initial values', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			const initialWidth = get(splitViewPanels)[0].width;

			splitViewStore.startResize(panelId, 500);

			const resizing = get(splitViewResizing);
			expect(resizing.isResizing).toBe(true);
			expect(resizing.panelId).toBe(panelId);
			expect(resizing.startX).toBe(500);
			expect(resizing.startWidth).toBe(initialWidth);
		});

		it('should update panel width during resize', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			const config = get(splitViewConfig);
			
			// Start resize at position 600
			splitViewStore.startResize(panelId, 600);
			
			// Move to position 500 (delta = 100, increasing width)
			splitViewStore.resize(500);
			
			const newWidth = get(splitViewPanels)[0].width;
			expect(newWidth).toBe(config.defaultPanelWidth + 100);
		});

		it('should respect min/max during resize', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			const config = get(splitViewConfig);
			
			// Start resize
			splitViewStore.startResize(panelId, 500);
			
			// Try to resize way bigger than max
			splitViewStore.resize(-500);
			
			const widthAfterBig = get(splitViewPanels)[0].width;
			expect(widthAfterBig).toBe(config.maxPanelWidth);
			
			// End and start new resize for min test
			splitViewStore.endResize();
			splitViewStore.startResize(panelId, 500);
			
			// Try to resize way smaller than min
			splitViewStore.resize(1000);
			
			const widthAfterSmall = get(splitViewPanels)[0].width;
			expect(widthAfterSmall).toBe(config.minPanelWidth);
		});

		it('should end resize properly', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			
			splitViewStore.startResize(panelId, 500);
			expect(get(splitViewResizing).isResizing).toBe(true);
			
			splitViewStore.endResize();
			
			const resizing = get(splitViewResizing);
			expect(resizing.isResizing).toBe(false);
			expect(resizing.panelId).toBe(null);
		});

		it('should not resize when not in resize mode', () => {
			splitViewStore.pinDM(mockDMChannel);
			const originalWidth = get(splitViewPanels)[0].width;
			
			// Try to resize without starting
			splitViewStore.resize(100);
			
			expect(get(splitViewPanels)[0].width).toBe(originalWidth);
		});

		it('should not start resize for non-existent panel', () => {
			splitViewStore.startResize('non-existent-id', 500);
			
			const resizing = get(splitViewResizing);
			expect(resizing.isResizing).toBe(false);
		});
	});

	describe('Panel data updates', () => {
		it('should update channel data for pinned panel', () => {
			splitViewStore.pinDM(mockDMChannel);
			
			const updatedChannel = { ...mockDMChannel, name: 'Updated Name' };
			splitViewStore.updatePanelChannel('dm-123', updatedChannel);
			
			const panel = get(splitViewPanels)[0];
			expect(panel.channel?.name).toBe('Updated Name');
		});

		it('should update thread data for pinned panel', () => {
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			
			const updatedThread = { ...mockThread, name: 'Updated Thread' };
			splitViewStore.updatePanelThread('thread-abc', updatedThread);
			
			const panel = get(splitViewPanels)[0];
			expect(panel.thread?.name).toBe('Updated Thread');
		});

		it('should get panel by ID', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			
			const panel = splitViewStore.getPanel(panelId);
			expect(panel).toBeDefined();
			expect(panel?.id).toBe(panelId);
			expect(panel?.channelId).toBe('dm-123');
		});

		it('should return undefined for non-existent panel', () => {
			const panel = splitViewStore.getPanel('non-existent');
			expect(panel).toBeUndefined();
		});

		it('should get correct panel count', () => {
			expect(splitViewStore.getPanelCount()).toBe(0);
			
			splitViewStore.pinDM(mockDMChannel);
			expect(splitViewStore.getPanelCount()).toBe(1);
			
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			expect(splitViewStore.getPanelCount()).toBe(2);
		});

		it('should check if panel can be added', () => {
			expect(splitViewStore.canAddPanel()).toBe(true);
			
			// Fill up to max
			const config = get(splitViewConfig);
			for (let i = 0; i < config.maxPanels; i++) {
				splitViewStore.pinDM({ ...mockDMChannel, id: `dm-${i}` });
			}
			
			expect(splitViewStore.canAddPanel()).toBe(false);
		});

		it('should return false for canAddPanel when disabled', () => {
			splitViewStore.disable();
			expect(splitViewStore.canAddPanel()).toBe(false);
		});
	});

	describe('Persistence', () => {
		it('should call localStorage.setItem when state changes', () => {
			splitViewStore.pinDM(mockDMChannel);
			
			// localStorage.setItem should have been called
			expect(localStorageMock.setItem).toHaveBeenCalled();
		});

		it('should persist panel widths', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			splitViewStore.setPanelWidth(panelId, 500);
			
			// Check that localStorage was called with the panel data
			const calls = localStorageMock.setItem.mock.calls;
			// Find the LAST call that saved the panels (not the config)
			const panelCalls = calls.filter(call => {
				try {
					const data = JSON.parse(call[1]);
					return Array.isArray(data) && data[0]?.width !== undefined;
				} catch {
					return false;
				}
			});
			
			expect(panelCalls.length).toBeGreaterThan(0);
			const lastPanelCall = panelCalls[panelCalls.length - 1];
			const savedData = JSON.parse(lastPanelCall[1]);
			expect(savedData[0].width).toBe(500);
		});

		it('should persist collapsed state', () => {
			splitViewStore.pinDM(mockDMChannel);
			const panelId = get(splitViewPanels)[0].id;
			splitViewStore.toggleCollapse(panelId);
			
			// Check that localStorage was called with the panel data
			const calls = localStorageMock.setItem.mock.calls;
			// Find the call that saved the panels with collapsed state
			const panelCall = calls.find(call => {
				try {
					const data = JSON.parse(call[1]);
					return Array.isArray(data) && data[0]?.isCollapsed === true;
				} catch {
					return false;
				}
			});
			
			expect(panelCall).toBeDefined();
			if (panelCall) {
				const savedData = JSON.parse(panelCall[1]);
				expect(savedData[0].isCollapsed).toBe(true);
			}
		});
	});

	describe('Edge cases', () => {
		it('should handle pinning with empty recipients', () => {
			const channel = { ...mockDMChannel, recipients: [] };
			splitViewStore.pinDM(channel);
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].title).toBe('Direct Message');
		});

		it('should handle thread with no parent message', () => {
			const thread = { ...mockThread, parent_message: undefined };
			splitViewStore.pinThread(thread, 'channel-789', 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].subtitle).toBeUndefined();
		});

		it('should handle pinning same channel as different types', () => {
			// This is a theoretical edge case
			splitViewStore.pinDM({ ...mockDMChannel, id: 'same-id' });
			splitViewStore.pinChannel({ ...mockServerChannel, id: 'same-id' }, 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(2);
			expect(panels[0].type).toBe('dm');
			expect(panels[1].type).toBe('channel');
		});

		it('should generate unique panel IDs', () => {
			splitViewStore.pinDM(mockDMChannel);
			splitViewStore.pinChannel(mockServerChannel, 'server-001');
			splitViewStore.pinThread(mockThread, 'channel-789', 'server-001');
			
			const panels = get(splitViewPanels);
			const ids = panels.map(p => p.id);
			const uniqueIds = new Set(ids);
			
			expect(uniqueIds.size).toBe(3);
		});
	});
});

describe('ResizeHandle behavior', () => {
	it('should calculate correct delta for width increase', () => {
		// When dragging left (decreasing clientX), width should increase
		splitViewStore.pinDM({
			id: 'dm-test',
			type: 1,
			name: '',
			topic: null,
			position: 0,
			server_id: null,
			parent_id: null,
			slowmode: 0,
			nsfw: false,
			e2ee_enabled: false,
			last_message_id: null,
			last_message_at: null,
			recipients: [{ id: 'u1', username: 'user', display_name: 'User', avatar: null }]
		});
		
		const panelId = get(splitViewPanels)[0].id;
		const config = get(splitViewConfig);
		
		// Start at 500
		splitViewStore.startResize(panelId, 500);
		
		// Move left to 450 (delta = 50, width increases by 50)
		splitViewStore.resize(450);
		
		expect(get(splitViewPanels)[0].width).toBe(config.defaultPanelWidth + 50);
	});
});
