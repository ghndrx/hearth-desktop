/**
 * Split View Store
 * FEAT-003: Split View (Desktop)
 * 
 * Manages split view state including:
 * - Pinned panels (DMs, threads, channels)
 * - Panel sizes (with resize persistence)
 * - Panel visibility and ordering
 */
import { writable, get, derived } from 'svelte/store';
import type { Channel } from './channels';
import type { Thread } from './thread';

/**
 * Panel types supported in split view
 */
export type PanelType = 'dm' | 'thread' | 'channel';

/**
 * A pinned panel in the split view
 */
export interface PinnedPanel {
	id: string;
	type: PanelType;
	title: string;
	subtitle?: string;
	// For DMs and channels
	channelId?: string;
	channel?: Channel;
	// For threads
	threadId?: string;
	thread?: Thread;
	parentMessageId?: string;
	// Server context for channels
	serverId?: string;
	// Panel state
	width: number;
	minWidth: number;
	maxWidth: number;
	isCollapsed: boolean;
	createdAt: number;
}

/**
 * Split view configuration
 */
export interface SplitViewConfig {
	enabled: boolean;
	maxPanels: number;
	defaultPanelWidth: number;
	minPanelWidth: number;
	maxPanelWidth: number;
	mainPanelMinWidth: number;
}

/**
 * Split view state
 */
interface SplitViewState {
	panels: PinnedPanel[];
	config: SplitViewConfig;
	resizing: {
		isResizing: boolean;
		panelId: string | null;
		startX: number;
		startWidth: number;
	};
}

// Storage key for persistence
const STORAGE_KEY = 'hearth_split_view';
const STORAGE_CONFIG_KEY = 'hearth_split_view_config';

// Default configuration
const defaultConfig: SplitViewConfig = {
	enabled: true,
	maxPanels: 3,
	defaultPanelWidth: 400,
	minPanelWidth: 280,
	maxPanelWidth: 600,
	mainPanelMinWidth: 400
};

/**
 * Load persisted state from localStorage
 */
function loadPersistedState(): Partial<SplitViewState> {
	if (typeof window === 'undefined') {
		return {};
	}

	try {
		const panelsJson = localStorage.getItem(STORAGE_KEY);
		const configJson = localStorage.getItem(STORAGE_CONFIG_KEY);
		
		const panels = panelsJson ? JSON.parse(panelsJson) : [];
		const config = configJson ? { ...defaultConfig, ...JSON.parse(configJson) } : defaultConfig;
		
		return { panels, config };
	} catch (error) {
		console.warn('Failed to load split view state:', error);
		return {};
	}
}

/**
 * Save state to localStorage
 */
function saveState(state: SplitViewState) {
	if (typeof window === 'undefined') return;

	try {
		// Only persist panel info, not full channel/thread objects
		const panelsToSave = state.panels.map(panel => ({
			id: panel.id,
			type: panel.type,
			title: panel.title,
			subtitle: panel.subtitle,
			channelId: panel.channelId,
			threadId: panel.threadId,
			parentMessageId: panel.parentMessageId,
			serverId: panel.serverId,
			width: panel.width,
			minWidth: panel.minWidth,
			maxWidth: panel.maxWidth,
			isCollapsed: panel.isCollapsed,
			createdAt: panel.createdAt
		}));

		localStorage.setItem(STORAGE_KEY, JSON.stringify(panelsToSave));
		localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(state.config));
	} catch (error) {
		console.warn('Failed to save split view state:', error);
	}
}

/**
 * Generate a unique panel ID
 */
function generatePanelId(): string {
	return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createSplitViewStore() {
	const persisted = loadPersistedState();
	
	const initialState: SplitViewState = {
		panels: persisted.panels || [],
		config: persisted.config || defaultConfig,
		resizing: {
			isResizing: false,
			panelId: null,
			startX: 0,
			startWidth: 0
		}
	};

	const { subscribe, set, update } = writable<SplitViewState>(initialState);

	// Auto-save on state changes
	subscribe(state => {
		saveState(state);
	});

	return {
		subscribe,

		/**
		 * Pin a DM channel to the split view
		 */
		pinDM(channel: Channel, serverId?: string) {
			update(state => {
				// Check if already pinned
				if (state.panels.some(p => p.channelId === channel.id)) {
					return state;
				}

				// Check max panels
				if (state.panels.length >= state.config.maxPanels) {
					console.warn('Maximum panels reached');
					return state;
				}

				const panel: PinnedPanel = {
					id: generatePanelId(),
					type: 'dm',
					title: channel.recipients?.[0]?.display_name || channel.recipients?.[0]?.username || 'Direct Message',
					subtitle: channel.recipients?.[0]?.username,
					channelId: channel.id,
					channel,
					serverId,
					width: state.config.defaultPanelWidth,
					minWidth: state.config.minPanelWidth,
					maxWidth: state.config.maxPanelWidth,
					isCollapsed: false,
					createdAt: Date.now()
				};

				return {
					...state,
					panels: [...state.panels, panel]
				};
			});
		},

		/**
		 * Pin a thread to the split view
		 */
		pinThread(thread: Thread, channelId: string, serverId?: string) {
			update(state => {
				// Check if already pinned
				if (state.panels.some(p => p.threadId === thread.id)) {
					return state;
				}

				// Check max panels
				if (state.panels.length >= state.config.maxPanels) {
					console.warn('Maximum panels reached');
					return state;
				}

				const panel: PinnedPanel = {
					id: generatePanelId(),
					type: 'thread',
					title: thread.name || 'Thread',
					subtitle: thread.parent_message?.content?.slice(0, 50),
					channelId,
					threadId: thread.id,
					thread,
					parentMessageId: thread.parent_message_id,
					serverId,
					width: state.config.defaultPanelWidth,
					minWidth: state.config.minPanelWidth,
					maxWidth: state.config.maxPanelWidth,
					isCollapsed: false,
					createdAt: Date.now()
				};

				return {
					...state,
					panels: [...state.panels, panel]
				};
			});
		},

		/**
		 * Pin a channel to the split view
		 */
		pinChannel(channel: Channel, serverId: string) {
			update(state => {
				// Check if already pinned
				if (state.panels.some(p => p.channelId === channel.id && p.type === 'channel')) {
					return state;
				}

				// Check max panels
				if (state.panels.length >= state.config.maxPanels) {
					console.warn('Maximum panels reached');
					return state;
				}

				const panel: PinnedPanel = {
					id: generatePanelId(),
					type: 'channel',
					title: channel.name || 'Channel',
					subtitle: channel.topic || undefined,
					channelId: channel.id,
					channel,
					serverId,
					width: state.config.defaultPanelWidth,
					minWidth: state.config.minPanelWidth,
					maxWidth: state.config.maxPanelWidth,
					isCollapsed: false,
					createdAt: Date.now()
				};

				return {
					...state,
					panels: [...state.panels, panel]
				};
			});
		},

		/**
		 * Unpin a panel from the split view
		 */
		unpin(panelId: string) {
			update(state => ({
				...state,
				panels: state.panels.filter(p => p.id !== panelId)
			}));
		},

		/**
		 * Unpin by channel or thread ID
		 */
		unpinByTarget(targetId: string, type: PanelType) {
			update(state => ({
				...state,
				panels: state.panels.filter(p => {
					if (type === 'thread') {
						return p.threadId !== targetId;
					}
					return p.channelId !== targetId || p.type !== type;
				})
			}));
		},

		/**
		 * Toggle panel collapsed state
		 */
		toggleCollapse(panelId: string) {
			update(state => ({
				...state,
				panels: state.panels.map(p => 
					p.id === panelId ? { ...p, isCollapsed: !p.isCollapsed } : p
				)
			}));
		},

		/**
		 * Start resizing a panel
		 */
		startResize(panelId: string, clientX: number) {
			update(state => {
				const panel = state.panels.find(p => p.id === panelId);
				if (!panel) return state;

				return {
					...state,
					resizing: {
						isResizing: true,
						panelId,
						startX: clientX,
						startWidth: panel.width
					}
				};
			});
		},

		/**
		 * Update panel width during resize
		 */
		resize(clientX: number) {
			update(state => {
				if (!state.resizing.isResizing || !state.resizing.panelId) {
					return state;
				}

				const delta = state.resizing.startX - clientX;
				const newWidth = Math.max(
					state.config.minPanelWidth,
					Math.min(state.config.maxPanelWidth, state.resizing.startWidth + delta)
				);

				return {
					...state,
					panels: state.panels.map(p =>
						p.id === state.resizing.panelId ? { ...p, width: newWidth } : p
					)
				};
			});
		},

		/**
		 * End resizing
		 */
		endResize() {
			update(state => ({
				...state,
				resizing: {
					isResizing: false,
					panelId: null,
					startX: 0,
					startWidth: 0
				}
			}));
		},

		/**
		 * Set panel width directly
		 */
		setPanelWidth(panelId: string, width: number) {
			update(state => ({
				...state,
				panels: state.panels.map(p =>
					p.id === panelId ? { 
						...p, 
						width: Math.max(p.minWidth, Math.min(p.maxWidth, width))
					} : p
				)
			}));
		},

		/**
		 * Reorder panels
		 */
		reorder(fromIndex: number, toIndex: number) {
			update(state => {
				const panels = [...state.panels];
				const [removed] = panels.splice(fromIndex, 1);
				panels.splice(toIndex, 0, removed);
				return { ...state, panels };
			});
		},

		/**
		 * Update split view configuration
		 */
		updateConfig(config: Partial<SplitViewConfig>) {
			update(state => ({
				...state,
				config: { ...state.config, ...config }
			}));
		},

		/**
		 * Toggle split view on/off
		 */
		toggle() {
			update(state => ({
				...state,
				config: { ...state.config, enabled: !state.config.enabled }
			}));
		},

		/**
		 * Enable split view
		 */
		enable() {
			update(state => ({
				...state,
				config: { ...state.config, enabled: true }
			}));
		},

		/**
		 * Disable split view
		 */
		disable() {
			update(state => ({
				...state,
				config: { ...state.config, enabled: false }
			}));
		},

		/**
		 * Clear all panels
		 */
		clearAll() {
			update(state => ({
				...state,
				panels: []
			}));
		},

		/**
		 * Check if a channel/thread is pinned
		 */
		isPinned(targetId: string, type: PanelType): boolean {
			const state = get({ subscribe });
			return state.panels.some(p => {
				if (type === 'thread') {
					return p.threadId === targetId;
				}
				return p.channelId === targetId && p.type === type;
			});
		},

		/**
		 * Get panel by ID
		 */
		getPanel(panelId: string): PinnedPanel | undefined {
			const state = get({ subscribe });
			return state.panels.find(p => p.id === panelId);
		},

		/**
		 * Get current panel count
		 */
		getPanelCount(): number {
			return get({ subscribe }).panels.length;
		},

		/**
		 * Check if more panels can be added
		 */
		canAddPanel(): boolean {
			const state = get({ subscribe });
			return state.config.enabled && state.panels.length < state.config.maxPanels;
		},

		/**
		 * Update channel data for a pinned panel (e.g., when messages load)
		 */
		updatePanelChannel(channelId: string, channel: Channel) {
			update(state => ({
				...state,
				panels: state.panels.map(p =>
					p.channelId === channelId ? { ...p, channel } : p
				)
			}));
		},

		/**
		 * Update thread data for a pinned panel
		 */
		updatePanelThread(threadId: string, thread: Thread) {
			update(state => ({
				...state,
				panels: state.panels.map(p =>
					p.threadId === threadId ? { ...p, thread } : p
				)
			}));
		}
	};
}

export const splitViewStore = createSplitViewStore();

// Derived stores for convenience
export const splitViewPanels = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.panels
);

export const splitViewConfig = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.config
);

export const splitViewEnabled = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.config.enabled
);

export const splitViewResizing = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.resizing
);

export const splitViewPanelCount = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.panels.length
);

export const canAddSplitPanel = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.config.enabled && $state.panels.length < $state.config.maxPanels
);

// Calculate total width of all pinned panels
export const splitViewTotalWidth = derived(
	{ subscribe: splitViewStore.subscribe },
	$state => $state.panels.reduce((total, panel) => 
		total + (panel.isCollapsed ? 48 : panel.width), 0
	)
);
