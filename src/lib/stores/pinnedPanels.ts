import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Panel types that can be pinned
 */
export type PanelType = 'dm' | 'channel' | 'thread';

/**
 * Represents a pinned panel in split view
 */
export interface PinnedPanel {
	id: string;
	type: PanelType;
	/** ID of the DM, channel, or thread */
	targetId: string;
	/** Display name for the panel tab */
	title: string;
	/** Server ID (for channels) */
	serverId?: string;
	/** Optional icon/avatar URL */
	iconUrl?: string;
	/** Panel width (percentage or pixels) */
	width: number;
	/** Minimum width */
	minWidth: number;
	/** Creation timestamp for ordering */
	createdAt: number;
}

/**
 * Split view configuration
 */
export interface SplitViewState {
	/** Whether split view is enabled */
	enabled: boolean;
	/** List of pinned panels */
	panels: PinnedPanel[];
	/** Currently focused panel ID (null = main view) */
	focusedPanelId: string | null;
	/** Maximum allowed pinned panels */
	maxPanels: number;
	/** Collapsed panel IDs (for mobile/responsive) */
	collapsedPanels: string[];
}

const DEFAULT_PANEL_WIDTH = 400;
const MIN_PANEL_WIDTH = 300;
const MAX_PANELS = 3;

const initialState: SplitViewState = {
	enabled: false,
	panels: [],
	focusedPanelId: null,
	maxPanels: MAX_PANELS,
	collapsedPanels: []
};

function createPinnedPanelsStore() {
	// Load persisted state
	let persistedState = initialState;
	if (browser) {
		try {
			const saved = localStorage.getItem('hearth_split_view');
			if (saved) {
				const parsed = JSON.parse(saved);
				persistedState = { ...initialState, ...parsed };
			}
		} catch {
			// Invalid JSON, use defaults
		}
	}

	const { subscribe, update, set } = writable<SplitViewState>(persistedState);

	// Persist on change
	if (browser) {
		subscribe((state) => {
			localStorage.setItem('hearth_split_view', JSON.stringify(state));
		});
	}

	/**
	 * Generate unique panel ID
	 */
	function generatePanelId(): string {
		return `panel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	return {
		subscribe,

		/**
		 * Enable split view mode
		 */
		enable() {
			update((s) => ({ ...s, enabled: true }));
		},

		/**
		 * Disable split view mode
		 */
		disable() {
			update((s) => ({ ...s, enabled: false }));
		},

		/**
		 * Toggle split view mode
		 */
		toggle() {
			update((s) => ({ ...s, enabled: !s.enabled }));
		},

		/**
		 * Pin a new panel
		 */
		pinPanel(params: {
			type: PanelType;
			targetId: string;
			title: string;
			serverId?: string;
			iconUrl?: string;
		}): string | null {
			const state = get({ subscribe });

			// Check if already pinned
			const existing = state.panels.find(
				(p) => p.type === params.type && p.targetId === params.targetId
			);
			if (existing) {
				// Focus the existing panel instead
				update((s) => ({ ...s, focusedPanelId: existing.id, enabled: true }));
				return existing.id;
			}

			// Check max panels
			if (state.panels.length >= state.maxPanels) {
				console.warn(`Cannot pin more than ${state.maxPanels} panels`);
				return null;
			}

			const newPanel: PinnedPanel = {
				id: generatePanelId(),
				type: params.type,
				targetId: params.targetId,
				title: params.title,
				serverId: params.serverId,
				iconUrl: params.iconUrl,
				width: DEFAULT_PANEL_WIDTH,
				minWidth: MIN_PANEL_WIDTH,
				createdAt: Date.now()
			};

			update((s) => ({
				...s,
				enabled: true,
				panels: [...s.panels, newPanel],
				focusedPanelId: newPanel.id
			}));

			return newPanel.id;
		},

		/**
		 * Unpin a panel by ID
		 */
		unpinPanel(panelId: string) {
			update((s) => {
				const newPanels = s.panels.filter((p) => p.id !== panelId);
				return {
					...s,
					panels: newPanels,
					focusedPanelId: s.focusedPanelId === panelId ? null : s.focusedPanelId,
					// Auto-disable if no panels left
					enabled: newPanels.length > 0 ? s.enabled : false
				};
			});
		},

		/**
		 * Unpin a panel by target (type + targetId)
		 */
		unpinByTarget(type: PanelType, targetId: string) {
			const state = get({ subscribe });
			const panel = state.panels.find((p) => p.type === type && p.targetId === targetId);
			if (panel) {
				this.unpinPanel(panel.id);
			}
		},

		/**
		 * Check if a target is pinned
		 */
		isPinned(type: PanelType, targetId: string): boolean {
			const state = get({ subscribe });
			return state.panels.some((p) => p.type === type && p.targetId === targetId);
		},

		/**
		 * Focus a specific panel
		 */
		focusPanel(panelId: string | null) {
			update((s) => ({ ...s, focusedPanelId: panelId }));
		},

		/**
		 * Update panel width
		 */
		setPanelWidth(panelId: string, width: number) {
			update((s) => ({
				...s,
				panels: s.panels.map((p) =>
					p.id === panelId ? { ...p, width: Math.max(p.minWidth, width) } : p
				)
			}));
		},

		/**
		 * Reorder panels
		 */
		reorderPanels(fromIndex: number, toIndex: number) {
			update((s) => {
				const panels = [...s.panels];
				const [removed] = panels.splice(fromIndex, 1);
				panels.splice(toIndex, 0, removed);
				return { ...s, panels };
			});
		},

		/**
		 * Collapse a panel (for responsive)
		 */
		collapsePanel(panelId: string) {
			update((s) => ({
				...s,
				collapsedPanels: [...new Set([...s.collapsedPanels, panelId])]
			}));
		},

		/**
		 * Expand a panel
		 */
		expandPanel(panelId: string) {
			update((s) => ({
				...s,
				collapsedPanels: s.collapsedPanels.filter((id) => id !== panelId)
			}));
		},

		/**
		 * Collapse all panels (mobile view)
		 */
		collapseAll() {
			update((s) => ({
				...s,
				collapsedPanels: s.panels.map((p) => p.id)
			}));
		},

		/**
		 * Expand all panels (desktop view)
		 */
		expandAll() {
			update((s) => ({
				...s,
				collapsedPanels: []
			}));
		},

		/**
		 * Update panel title
		 */
		updatePanelTitle(panelId: string, title: string) {
			update((s) => ({
				...s,
				panels: s.panels.map((p) => (p.id === panelId ? { ...p, title } : p))
			}));
		},

		/**
		 * Clear all pinned panels
		 */
		clearAll() {
			update(() => initialState);
		},

		/**
		 * Reset to defaults
		 */
		reset() {
			set(initialState);
		}
	};
}

export const pinnedPanels = createPinnedPanelsStore();

// Derived stores for convenience
export const splitViewEnabled = derived(pinnedPanels, ($s) => $s.enabled);
export const activePanels = derived(pinnedPanels, ($s) => $s.panels);
export const focusedPanelId = derived(pinnedPanels, ($s) => $s.focusedPanelId);
export const panelCount = derived(pinnedPanels, ($s) => $s.panels.length);
export const canPinMore = derived(pinnedPanels, ($s) => $s.panels.length < $s.maxPanels);

// Helper to check if specific target is pinned
export function createIsPinnedStore(type: PanelType, targetId: string) {
	return derived(pinnedPanels, ($s) =>
		$s.panels.some((p) => p.type === type && p.targetId === targetId)
	);
}
