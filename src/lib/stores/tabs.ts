/**
 * Channel Tabs Store
 *
 * Manages open channel tabs with:
 * - Opening/closing tabs
 * - Drag-to-reorder
 * - Active tab tracking
 * - localStorage persistence across restarts
 */
import { writable, derived, get } from 'svelte/store';
import { currentChannel, type Channel } from './channels';
import { currentServer } from './servers';
import { goto } from '$app/navigation';

export interface Tab {
	channelId: string;
	serverId: string | null;
	name: string;
	type: number; // 0=text, 1=dm, 2=voice, etc.
}

interface TabsState {
	tabs: Tab[];
	activeTabId: string | null;
}

const STORAGE_KEY = 'hearth_channel_tabs';

function loadPersistedTabs(): TabsState {
	if (typeof window === 'undefined') {
		return { tabs: [], activeTabId: null };
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
				activeTabId: parsed.activeTabId ?? null
			};
		}
	} catch (e) {
		console.warn('Failed to load tabs state:', e);
	}
	return { tabs: [], activeTabId: null };
}

function saveTabs(state: TabsState) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn('Failed to save tabs state:', e);
	}
}

function createTabsStore() {
	const initial = loadPersistedTabs();
	const { subscribe, set, update } = writable<TabsState>(initial);

	// Persist on every change
	subscribe(state => {
		saveTabs(state);
	});

	return {
		subscribe,

		/**
		 * Open a channel as a tab (or activate if already open).
		 * Navigates to the channel.
		 */
		openTab(channel: Channel, serverId: string | null) {
			update(state => {
				const existing = state.tabs.find(t => t.channelId === channel.id);
				if (existing) {
					return { ...state, activeTabId: channel.id };
				}

				const tab: Tab = {
					channelId: channel.id,
					serverId,
					name: channel.type === 1
						? (channel.recipients?.[0]?.display_name || channel.recipients?.[0]?.username || channel.name)
						: channel.name,
					type: channel.type
				};

				return {
					tabs: [...state.tabs, tab],
					activeTabId: channel.id
				};
			});
		},

		/**
		 * Close a tab. If it was active, activate an adjacent tab.
		 */
		closeTab(channelId: string) {
			update(state => {
				const idx = state.tabs.findIndex(t => t.channelId === channelId);
				if (idx === -1) return state;

				const newTabs = state.tabs.filter(t => t.channelId !== channelId);

				let newActiveId = state.activeTabId;
				if (state.activeTabId === channelId) {
					if (newTabs.length === 0) {
						newActiveId = null;
					} else {
						// Activate the tab to the left, or the first one
						const newIdx = Math.min(idx, newTabs.length - 1);
						newActiveId = newTabs[newIdx].channelId;
					}
				}

				// Navigate to new active tab or home
				if (newActiveId) {
					const tab = newTabs.find(t => t.channelId === newActiveId);
					if (tab) {
						const path = tab.serverId
							? `/channels/${tab.serverId}/${tab.channelId}`
							: `/channels/@me/${tab.channelId}`;
						goto(path);
					}
				} else if (state.activeTabId === channelId) {
					goto('/channels/@me');
				}

				return { tabs: newTabs, activeTabId: newActiveId };
			});
		},

		/**
		 * Set the active tab (and navigate to it).
		 */
		activateTab(channelId: string) {
			const state = get({ subscribe });
			const tab = state.tabs.find(t => t.channelId === channelId);
			if (!tab) return;

			update(s => ({ ...s, activeTabId: channelId }));

			const path = tab.serverId
				? `/channels/${tab.serverId}/${tab.channelId}`
				: `/channels/@me/${tab.channelId}`;
			goto(path);
		},

		/**
		 * Reorder tabs via drag-and-drop.
		 */
		reorderTabs(fromIndex: number, toIndex: number) {
			update(state => {
				if (fromIndex === toIndex) return state;
				const tabs = [...state.tabs];
				const [moved] = tabs.splice(fromIndex, 1);
				tabs.splice(toIndex, 0, moved);
				return { ...state, tabs };
			});
		},

		/**
		 * Update tab name when channel data changes.
		 */
		updateTabName(channelId: string, name: string) {
			update(state => ({
				...state,
				tabs: state.tabs.map(t =>
					t.channelId === channelId ? { ...t, name } : t
				)
			}));
		},

		/**
		 * Remove tabs for a deleted channel.
		 */
		handleChannelDelete(channelId: string) {
			const state = get({ subscribe });
			if (state.tabs.some(t => t.channelId === channelId)) {
				this.closeTab(channelId);
			}
		},

		/**
		 * Remove all tabs for a server (e.g., on leave).
		 */
		handleServerRemove(serverId: string) {
			update(state => {
				const newTabs = state.tabs.filter(t => t.serverId !== serverId);
				let newActiveId = state.activeTabId;

				if (state.activeTabId && !newTabs.find(t => t.channelId === state.activeTabId)) {
					newActiveId = newTabs.length > 0 ? newTabs[0].channelId : null;
					if (!newActiveId) {
						goto('/channels/@me');
					}
				}

				return { tabs: newTabs, activeTabId: newActiveId };
			});
		},

		/**
		 * Close all tabs.
		 */
		closeAll() {
			set({ tabs: [], activeTabId: null });
			goto('/channels/@me');
		},

		/**
		 * Close all tabs except the given one.
		 */
		closeOthers(channelId: string) {
			update(state => {
				const tab = state.tabs.find(t => t.channelId === channelId);
				if (!tab) return state;
				return { tabs: [tab], activeTabId: channelId };
			});
		}
	};
}

export const tabsStore = createTabsStore();

// Derived convenience stores
export const tabs = derived(
	{ subscribe: tabsStore.subscribe },
	$state => $state.tabs
);

export const activeTabId = derived(
	{ subscribe: tabsStore.subscribe },
	$state => $state.activeTabId
);

export const tabCount = derived(
	{ subscribe: tabsStore.subscribe },
	$state => $state.tabs.length
);
