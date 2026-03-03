import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { splitViewStore } from './splitView';
import type { Channel, User } from './channels';
import type { Thread } from './thread';

/**
 * Mock factory for DM channels
 * Creates a properly typed partial Channel for DM testing
 */
function createMockDMChannel(
	id: string,
	recipients: Array<{ id: string; username: string; display_name?: string }>
): Partial<Channel> & Pick<Channel, 'id' | 'name'> {
	return {
		id,
		name: null as unknown as string, // DMs have null name
		recipients: recipients.map((r) => ({
			id: r.id,
			username: r.username,
			display_name: r.display_name ?? null,
			avatar: null
		})) as User[]
	};
}

/**
 * Mock factory for regular server channels
 */
function createMockChannel(
	id: string,
	name: string,
	topic?: string
): Partial<Channel> & Pick<Channel, 'id' | 'name'> {
	return {
		id,
		name,
		topic: topic ?? null
	};
}

/**
 * Mock factory for threads
 */
function createMockThread(
	id: string,
	name?: string,
	parentMessageContent?: string
): Partial<Thread> & Pick<Thread, 'id'> {
	return {
		id,
		name,
		...(parentMessageContent && {
			parent_message: { content: parentMessageContent } as Thread['parent_message']
		})
	};
}

describe('splitViewStore', () => {
	const mockLocalStorage = new Map<string, string>();

	beforeEach(() => {
		mockLocalStorage.clear();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => mockLocalStorage.get(key) ?? null,
			setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
			removeItem: (key: string) => mockLocalStorage.delete(key)
		});

		splitViewStore.clearAll();
		splitViewStore.updateConfig({ enabled: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('initial state', () => {
		it('should have empty panels', () => {
			const state = get(splitViewStore);
			expect(state.panels).toEqual([]);
		});

		it('should have default config', () => {
			const state = get(splitViewStore);
			expect(state.config.enabled).toBe(true);
			expect(state.config.maxPanels).toBe(3);
			expect(state.config.defaultPanelWidth).toBe(400);
		});

		it('should not be resizing', () => {
			const state = get(splitViewStore);
			expect(state.resizing.isResizing).toBe(false);
			expect(state.resizing.panelId).toBeNull();
		});
	});

	describe('pinDM', () => {
		it('should pin a DM channel', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'testuser', display_name: 'Test User' }
			]);

			splitViewStore.pinDM(mockChannel as Channel);

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(1);
			expect(state.panels[0].type).toBe('dm');
			expect(state.panels[0].title).toBe('Test User');
			expect(state.panels[0].subtitle).toBe('testuser');
		});

		it('should not pin duplicate DM', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'testuser' }
			]);

			splitViewStore.pinDM(mockChannel as Channel);
			splitViewStore.pinDM(mockChannel as Channel);

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(1);
		});

		it('should not exceed max panels', () => {
			splitViewStore.pinDM(
				createMockDMChannel('1', [{ id: 'user-1', username: 'user1' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('2', [{ id: 'user-2', username: 'user2' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('3', [{ id: 'user-3', username: 'user3' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('4', [{ id: 'user-4', username: 'user4' }]) as Channel
			);

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(3);
		});
	});

	describe('pinThread', () => {
		it('should pin a thread', () => {
			const mockThread = createMockThread('thread-1', 'Test Thread', 'Parent message content');

			splitViewStore.pinThread(mockThread as Thread, 'channel-1');

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(1);
			expect(state.panels[0].type).toBe('thread');
			expect(state.panels[0].title).toBe('Test Thread');
			expect(state.panels[0].threadId).toBe('thread-1');
		});

		it('should not pin duplicate thread', () => {
			const mockThread = createMockThread('thread-1', 'Test Thread');

			splitViewStore.pinThread(mockThread as Thread, 'channel-1');
			splitViewStore.pinThread(mockThread as Thread, 'channel-1');

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(1);
		});
	});

	describe('pinChannel', () => {
		it('should pin a channel', () => {
			const mockChannel = createMockChannel('channel-1', 'general', 'General discussion');

			splitViewStore.pinChannel(mockChannel as Channel, 'server-1');

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(1);
			expect(state.panels[0].type).toBe('channel');
			expect(state.panels[0].title).toBe('general');
			expect(state.panels[0].subtitle).toBe('General discussion');
		});
	});

	describe('unpin', () => {
		it('should unpin a panel by ID', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const stateBefore = get(splitViewStore);
			const panelId = stateBefore.panels[0].id;

			splitViewStore.unpin(panelId);

			const stateAfter = get(splitViewStore);
			expect(stateAfter.panels).toHaveLength(0);
		});

		it('should unpin by target ID and type', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			splitViewStore.unpinByTarget('channel-1', 'dm');

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(0);
		});
	});

	describe('toggleCollapse', () => {
		it('should toggle panel collapsed state', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panelId = get(splitViewStore).panels[0].id;

			splitViewStore.toggleCollapse(panelId);
			expect(get(splitViewStore).panels[0].isCollapsed).toBe(true);

			splitViewStore.toggleCollapse(panelId);
			expect(get(splitViewStore).panels[0].isCollapsed).toBe(false);
		});
	});

	describe('resize', () => {
		it('should start resize', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panel = get(splitViewStore).panels[0];
			splitViewStore.startResize(panel.id, 500);

			const state = get(splitViewStore);
			expect(state.resizing.isResizing).toBe(true);
			expect(state.resizing.panelId).toBe(panel.id);
			expect(state.resizing.startX).toBe(500);
		});

		it('should resize panel', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panel = get(splitViewStore).panels[0];
			splitViewStore.startResize(panel.id, 500);
			splitViewStore.resize(400);

			const state = get(splitViewStore);
			expect(state.panels[0].width).toBeGreaterThan(panel.width);
		});

		it('should end resize', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panel = get(splitViewStore).panels[0];
			splitViewStore.startResize(panel.id, 500);
			splitViewStore.endResize();

			const state = get(splitViewStore);
			expect(state.resizing.isResizing).toBe(false);
			expect(state.resizing.panelId).toBeNull();
		});
	});

	describe('setPanelWidth', () => {
		it('should set panel width within bounds', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panelId = get(splitViewStore).panels[0].id;
			splitViewStore.setPanelWidth(panelId, 500);

			expect(get(splitViewStore).panels[0].width).toBe(500);
		});

		it('should clamp width to min/max', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panelId = get(splitViewStore).panels[0].id;
			splitViewStore.setPanelWidth(panelId, 50);

			const state = get(splitViewStore);
			expect(state.panels[0].width).toBe(state.panels[0].minWidth);
		});
	});

	describe('reorder', () => {
		it('should reorder panels', () => {
			splitViewStore.pinDM(
				createMockDMChannel('1', [{ id: 'user-1', username: 'user1' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('2', [{ id: 'user-2', username: 'user2' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('3', [{ id: 'user-3', username: 'user3' }]) as Channel
			);

			splitViewStore.reorder(0, 2);

			const state = get(splitViewStore);
			expect(state.panels[0].channelId).toBe('2');
			expect(state.panels[1].channelId).toBe('3');
			expect(state.panels[2].channelId).toBe('1');
		});
	});

	describe('config', () => {
		it('should update config', () => {
			splitViewStore.updateConfig({ maxPanels: 5 });

			const state = get(splitViewStore);
			expect(state.config.maxPanels).toBe(5);
		});

		it('should toggle enabled', () => {
			splitViewStore.toggle();

			let state = get(splitViewStore);
			expect(state.config.enabled).toBe(false);

			splitViewStore.toggle();

			state = get(splitViewStore);
			expect(state.config.enabled).toBe(true);
		});

		it('should enable', () => {
			splitViewStore.disable();
			splitViewStore.enable();

			expect(get(splitViewStore).config.enabled).toBe(true);
		});

		it('should disable', () => {
			splitViewStore.disable();

			expect(get(splitViewStore).config.enabled).toBe(false);
		});
	});

	describe('clearAll', () => {
		it('should clear all panels', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);
			splitViewStore.clearAll();

			const state = get(splitViewStore);
			expect(state.panels).toHaveLength(0);
		});
	});

	describe('utility methods', () => {
		it('should check if pinned', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			expect(splitViewStore.isPinned('channel-1', 'dm')).toBe(true);
			expect(splitViewStore.isPinned('channel-2', 'dm')).toBe(false);
		});

		it('should get panel', () => {
			const mockChannel = createMockDMChannel('channel-1', [
				{ id: 'user-1', username: 'test' }
			]);
			splitViewStore.pinDM(mockChannel as Channel);

			const panelId = get(splitViewStore).panels[0].id;
			const panel = splitViewStore.getPanel(panelId);

			expect(panel).toBeDefined();
			expect(panel?.channelId).toBe('channel-1');
		});

		it('should get panel count', () => {
			expect(splitViewStore.getPanelCount()).toBe(0);

			splitViewStore.pinDM(
				createMockDMChannel('1', [{ id: 'user-1', username: 'user1' }]) as Channel
			);
			expect(splitViewStore.getPanelCount()).toBe(1);

			splitViewStore.pinDM(
				createMockDMChannel('2', [{ id: 'user-2', username: 'user2' }]) as Channel
			);
			expect(splitViewStore.getPanelCount()).toBe(2);
		});

		it('should check if can add panel', () => {
			expect(splitViewStore.canAddPanel()).toBe(true);

			splitViewStore.disable();
			expect(splitViewStore.canAddPanel()).toBe(false);

			splitViewStore.enable();
			splitViewStore.updateConfig({ maxPanels: 3 });

			splitViewStore.pinDM(
				createMockDMChannel('channel-1', [{ id: 'user-1', username: 'user1' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('channel-2', [{ id: 'user-2', username: 'user2' }]) as Channel
			);
			splitViewStore.pinDM(
				createMockDMChannel('channel-3', [{ id: 'user-3', username: 'user3' }]) as Channel
			);

			expect(splitViewStore.getPanelCount()).toBe(3);
			expect(splitViewStore.canAddPanel()).toBe(false);
		});
	});
});
