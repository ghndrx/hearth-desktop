import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	pinnedPanels,
	splitViewEnabled,
	activePanels,
	focusedPanelId,
	panelCount,
	canPinMore,
	type PinnedPanel
} from '../stores/pinnedPanels';

describe('pinnedPanels store', () => {
	beforeEach(() => {
		// Reset store to initial state
		pinnedPanels.reset();
	});

	describe('initial state', () => {
		it('should start with split view disabled', () => {
			expect(get(splitViewEnabled)).toBe(false);
		});

		it('should start with no panels', () => {
			expect(get(activePanels)).toHaveLength(0);
		});

		it('should start with no focused panel', () => {
			expect(get(focusedPanelId)).toBe(null);
		});

		it('should allow pinning initially', () => {
			expect(get(canPinMore)).toBe(true);
		});
	});

	describe('enable/disable split view', () => {
		it('should enable split view', () => {
			pinnedPanels.enable();
			expect(get(splitViewEnabled)).toBe(true);
		});

		it('should disable split view', () => {
			pinnedPanels.enable();
			pinnedPanels.disable();
			expect(get(splitViewEnabled)).toBe(false);
		});

		it('should toggle split view', () => {
			pinnedPanels.toggle();
			expect(get(splitViewEnabled)).toBe(true);
			pinnedPanels.toggle();
			expect(get(splitViewEnabled)).toBe(false);
		});
	});

	describe('pinPanel', () => {
		it('should pin a DM panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			expect(panelId).toBeTruthy();
			expect(get(activePanels)).toHaveLength(1);
			expect(get(splitViewEnabled)).toBe(true);

			const panel = get(activePanels)[0];
			expect(panel.type).toBe('dm');
			expect(panel.targetId).toBe('dm-123');
			expect(panel.title).toBe('John Doe');
		});

		it('should pin a channel panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'channel',
				targetId: 'channel-456',
				title: 'general',
				serverId: 'server-789'
			});

			expect(panelId).toBeTruthy();
			const panel = get(activePanels)[0];
			expect(panel.type).toBe('channel');
			expect(panel.serverId).toBe('server-789');
		});

		it('should pin a thread panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'thread',
				targetId: 'thread-101',
				title: 'Discussion Thread'
			});

			expect(panelId).toBeTruthy();
			const panel = get(activePanels)[0];
			expect(panel.type).toBe('thread');
		});

		it('should not duplicate an already pinned panel', () => {
			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe Updated'
			});

			expect(get(activePanels)).toHaveLength(1);
		});

		it('should focus existing panel when trying to pin duplicate', () => {
			const firstId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			// Pin a second panel
			pinnedPanels.pinPanel({
				type: 'channel',
				targetId: 'channel-456',
				title: 'general'
			});

			// Try to pin the first one again
			const duplicateId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			expect(duplicateId).toBe(firstId);
			expect(get(focusedPanelId)).toBe(firstId);
		});

		it('should respect max panels limit', () => {
			// Pin max panels (default is 3)
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-3', title: 'User 3' });

			expect(get(canPinMore)).toBe(false);

			// Try to pin another
			const result = pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-4', title: 'User 4' });
			expect(result).toBe(null);
			expect(get(activePanels)).toHaveLength(3);
		});

		it('should set default width and minWidth', () => {
			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			const panel = get(activePanels)[0];
			expect(panel.width).toBe(400);
			expect(panel.minWidth).toBe(300);
		});
	});

	describe('unpinPanel', () => {
		it('should remove a pinned panel by ID', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.unpinPanel(panelId!);
			expect(get(activePanels)).toHaveLength(0);
		});

		it('should clear focus when unpinning focused panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			expect(get(focusedPanelId)).toBe(panelId);
			pinnedPanels.unpinPanel(panelId!);
			expect(get(focusedPanelId)).toBe(null);
		});

		it('should auto-disable split view when last panel is unpinned', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			expect(get(splitViewEnabled)).toBe(true);
			pinnedPanels.unpinPanel(panelId!);
			expect(get(splitViewEnabled)).toBe(false);
		});
	});

	describe('unpinByTarget', () => {
		it('should remove panel by type and targetId', () => {
			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.unpinByTarget('dm', 'dm-123');
			expect(get(activePanels)).toHaveLength(0);
		});

		it('should do nothing if target not found', () => {
			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.unpinByTarget('dm', 'dm-999');
			expect(get(activePanels)).toHaveLength(1);
		});
	});

	describe('isPinned', () => {
		it('should return true for pinned target', () => {
			pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			expect(pinnedPanels.isPinned('dm', 'dm-123')).toBe(true);
		});

		it('should return false for non-pinned target', () => {
			expect(pinnedPanels.isPinned('dm', 'dm-123')).toBe(false);
		});
	});

	describe('focusPanel', () => {
		it('should set focused panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.focusPanel(null);
			expect(get(focusedPanelId)).toBe(null);

			pinnedPanels.focusPanel(panelId);
			expect(get(focusedPanelId)).toBe(panelId);
		});
	});

	describe('setPanelWidth', () => {
		it('should update panel width', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.setPanelWidth(panelId!, 500);
			expect(get(activePanels)[0].width).toBe(500);
		});

		it('should respect minimum width', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.setPanelWidth(panelId!, 100); // Below minWidth
			expect(get(activePanels)[0].width).toBe(300); // Should be minWidth
		});
	});

	describe('reorderPanels', () => {
		it('should reorder panels', () => {
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-3', title: 'User 3' });

			const before = get(activePanels).map((p) => p.title);
			expect(before).toEqual(['User 1', 'User 2', 'User 3']);

			pinnedPanels.reorderPanels(2, 0);

			const after = get(activePanels).map((p) => p.title);
			expect(after).toEqual(['User 3', 'User 1', 'User 2']);
		});
	});

	describe('collapse/expand panels', () => {
		it('should collapse a panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.collapsePanel(panelId!);
			const state = get(pinnedPanels);
			expect(state.collapsedPanels).toContain(panelId);
		});

		it('should expand a panel', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.collapsePanel(panelId!);
			pinnedPanels.expandPanel(panelId!);
			const state = get(pinnedPanels);
			expect(state.collapsedPanels).not.toContain(panelId);
		});

		it('should collapse all panels', () => {
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });

			pinnedPanels.collapseAll();
			const state = get(pinnedPanels);
			expect(state.collapsedPanels).toHaveLength(2);
		});

		it('should expand all panels', () => {
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });

			pinnedPanels.collapseAll();
			pinnedPanels.expandAll();
			const state = get(pinnedPanels);
			expect(state.collapsedPanels).toHaveLength(0);
		});
	});

	describe('updatePanelTitle', () => {
		it('should update panel title', () => {
			const panelId = pinnedPanels.pinPanel({
				type: 'dm',
				targetId: 'dm-123',
				title: 'John Doe'
			});

			pinnedPanels.updatePanelTitle(panelId!, 'John D.');
			expect(get(activePanels)[0].title).toBe('John D.');
		});
	});

	describe('clearAll', () => {
		it('should remove all panels and disable split view', () => {
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });

			pinnedPanels.clearAll();

			expect(get(activePanels)).toHaveLength(0);
			expect(get(splitViewEnabled)).toBe(false);
			expect(get(focusedPanelId)).toBe(null);
		});
	});

	describe('derived stores', () => {
		it('should correctly track panel count', () => {
			expect(get(panelCount)).toBe(0);

			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			expect(get(panelCount)).toBe(1);

			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });
			expect(get(panelCount)).toBe(2);
		});

		it('should correctly track canPinMore', () => {
			expect(get(canPinMore)).toBe(true);

			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-1', title: 'User 1' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-2', title: 'User 2' });
			pinnedPanels.pinPanel({ type: 'dm', targetId: 'dm-3', title: 'User 3' });

			expect(get(canPinMore)).toBe(false);
		});
	});
});
