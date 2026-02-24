/**
 * SplitViewPinButton.test.ts
 * FEAT-003: Split View (Desktop)
 * 
 * Component tests for SplitViewPinButton.svelte
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { 
	splitViewStore, 
	splitViewPanels, 
	splitViewEnabled,
	canAddSplitPanel
} from '$lib/stores/splitView';
import type { Channel } from '$lib/stores/channels';
import type { Thread } from '$lib/stores/thread';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; })
	};
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { value: { innerWidth: 1920 }, writable: true });

describe('SplitViewPinButton logic', () => {
	const mockChannel: Channel = {
		id: 'channel-123',
		type: 0,
		name: 'general',
		topic: 'General chat',
		position: 0,
		server_id: 'server-001',
		parent_id: null,
		slowmode: 0,
		nsfw: false,
		e2ee_enabled: false,
		last_message_id: null,
		last_message_at: null
	};

	const mockDMChannel: Channel = {
		id: 'dm-456',
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
		recipients: [{
			id: 'user-789',
			username: 'testuser',
			display_name: 'Test User',
			avatar: null
		}]
	};

	const mockThread: Thread = {
		id: 'thread-abc',
		channel_id: 'channel-123',
		parent_message_id: 'msg-001',
		name: 'Test Thread',
		message_count: 5,
		created_at: '2024-01-01T00:00:00Z'
	};

	beforeEach(() => {
		splitViewStore.clearAll();
		splitViewStore.enable();
		localStorageMock.clear();
	});

	describe('Button state', () => {
		it('should show as not pinned initially', () => {
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			expect(isPinned).toBe(false);
		});

		it('should show as pinned after pinning', () => {
			splitViewStore.pinChannel(mockChannel, 'server-001');
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			expect(isPinned).toBe(true);
		});

		it('should allow pinning when under max panels', () => {
			expect(get(canAddSplitPanel)).toBe(true);
		});

		it('should not allow pinning when at max panels', () => {
			// Fill to max
			for (let i = 0; i < 3; i++) {
				splitViewStore.pinChannel({ ...mockChannel, id: `channel-${i}` }, 'server-001');
			}
			expect(get(canAddSplitPanel)).toBe(false);
		});

		it('should not allow pinning when split view is disabled', () => {
			splitViewStore.disable();
			expect(get(canAddSplitPanel)).toBe(false);
		});
	});

	describe('Pin action', () => {
		it('should pin a channel', () => {
			splitViewStore.pinChannel(mockChannel, 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].channelId).toBe(mockChannel.id);
			expect(panels[0].type).toBe('channel');
		});

		it('should pin a DM', () => {
			splitViewStore.pinDM(mockDMChannel, 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].channelId).toBe(mockDMChannel.id);
			expect(panels[0].type).toBe('dm');
		});

		it('should pin a thread', () => {
			splitViewStore.pinThread(mockThread, 'channel-123', 'server-001');
			
			const panels = get(splitViewPanels);
			expect(panels).toHaveLength(1);
			expect(panels[0].threadId).toBe(mockThread.id);
			expect(panels[0].type).toBe('thread');
		});
	});

	describe('Unpin action', () => {
		it('should unpin a channel', () => {
			splitViewStore.pinChannel(mockChannel, 'server-001');
			expect(get(splitViewPanels)).toHaveLength(1);
			
			splitViewStore.unpinByTarget(mockChannel.id, 'channel');
			expect(get(splitViewPanels)).toHaveLength(0);
		});

		it('should unpin a DM', () => {
			splitViewStore.pinDM(mockDMChannel, 'server-001');
			expect(get(splitViewPanels)).toHaveLength(1);
			
			splitViewStore.unpinByTarget(mockDMChannel.id, 'dm');
			expect(get(splitViewPanels)).toHaveLength(0);
		});

		it('should unpin a thread', () => {
			splitViewStore.pinThread(mockThread, 'channel-123', 'server-001');
			expect(get(splitViewPanels)).toHaveLength(1);
			
			splitViewStore.unpinByTarget(mockThread.id, 'thread');
			expect(get(splitViewPanels)).toHaveLength(0);
		});
	});

	describe('Tooltip text', () => {
		it('should show "Pin to Split View" when not pinned', () => {
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			const canPin = get(canAddSplitPanel);
			const enabled = get(splitViewEnabled);
			
			let tooltipText: string;
			if (isPinned) {
				tooltipText = 'Unpin from Split View';
			} else if (canPin) {
				tooltipText = 'Pin to Split View';
			} else if (!enabled) {
				tooltipText = 'Split View is disabled';
			} else {
				tooltipText = 'Maximum panels reached';
			}
			
			expect(tooltipText).toBe('Pin to Split View');
		});

		it('should show "Unpin from Split View" when pinned', () => {
			splitViewStore.pinChannel(mockChannel, 'server-001');
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			
			const tooltipText = isPinned ? 'Unpin from Split View' : 'Pin to Split View';
			expect(tooltipText).toBe('Unpin from Split View');
		});

		it('should show "Split View is disabled" when disabled', () => {
			splitViewStore.disable();
			const enabled = get(splitViewEnabled);
			
			const tooltipText = !enabled ? 'Split View is disabled' : 'Pin to Split View';
			expect(tooltipText).toBe('Split View is disabled');
		});

		it('should show "Maximum panels reached" when at limit', () => {
			// Fill to max
			for (let i = 0; i < 3; i++) {
				splitViewStore.pinChannel({ ...mockChannel, id: `channel-${i}` }, 'server-001');
			}
			
			const isPinned = splitViewStore.isPinned('channel-new', 'channel');
			const canPin = get(canAddSplitPanel);
			const enabled = get(splitViewEnabled);
			
			let tooltipText: string;
			if (isPinned) {
				tooltipText = 'Unpin from Split View';
			} else if (canPin) {
				tooltipText = 'Pin to Split View';
			} else if (!enabled) {
				tooltipText = 'Split View is disabled';
			} else {
				tooltipText = 'Maximum panels reached';
			}
			
			expect(tooltipText).toBe('Maximum panels reached');
		});
	});

	describe('Button disabled state', () => {
		it('should not be disabled when can pin', () => {
			const enabled = get(splitViewEnabled);
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			const canPin = get(canAddSplitPanel);
			
			const isDisabled = !enabled || (!canPin && !isPinned);
			expect(isDisabled).toBe(false);
		});

		it('should not be disabled when already pinned (can unpin)', () => {
			splitViewStore.pinChannel(mockChannel, 'server-001');
			
			// Fill remaining slots
			splitViewStore.pinChannel({ ...mockChannel, id: 'channel-2' }, 'server-001');
			splitViewStore.pinChannel({ ...mockChannel, id: 'channel-3' }, 'server-001');
			
			const enabled = get(splitViewEnabled);
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			const canPin = get(canAddSplitPanel);
			
			const isDisabled = !enabled || (!canPin && !isPinned);
			// Should NOT be disabled because isPinned is true (can still unpin)
			expect(isDisabled).toBe(false);
		});

		it('should be disabled when split view is disabled', () => {
			splitViewStore.disable();
			
			const enabled = get(splitViewEnabled);
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			const canPin = get(canAddSplitPanel);
			
			const isDisabled = !enabled || (!canPin && !isPinned);
			expect(isDisabled).toBe(true);
		});

		it('should be disabled when at limit and not pinned', () => {
			// Fill to max with other channels
			for (let i = 0; i < 3; i++) {
				splitViewStore.pinChannel({ ...mockChannel, id: `other-${i}` }, 'server-001');
			}
			
			const enabled = get(splitViewEnabled);
			const isPinned = splitViewStore.isPinned(mockChannel.id, 'channel');
			const canPin = get(canAddSplitPanel);
			
			const isDisabled = !enabled || (!canPin && !isPinned);
			expect(isDisabled).toBe(true);
		});
	});
});
