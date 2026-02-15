import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface UIState {
	sidebarOpen: boolean;
	sidebarWidth: number;
	memberListOpen: boolean;
	searchOpen: boolean;
	helpOpen: boolean;
	connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
	windowFocused: boolean;
}

const initialState: UIState = {
	sidebarOpen: true,
	sidebarWidth: 240,
	memberListOpen: true,
	searchOpen: false,
	helpOpen: false,
	connectionStatus: 'disconnected',
	windowFocused: true
};

function createUIStore() {
	// Load persisted state
	let persistedState = initialState;
	if (browser) {
		try {
			const saved = localStorage.getItem('hearth_ui');
			if (saved) {
				const parsed = JSON.parse(saved);
				persistedState = { ...initialState, ...parsed };
			}
		} catch {
			// Invalid JSON, use defaults
		}
	}

	const { subscribe, update } = writable<UIState>(persistedState);

	// Persist UI state on change
	if (browser) {
		subscribe((state) => {
			const toPersist = {
				sidebarOpen: state.sidebarOpen,
				sidebarWidth: state.sidebarWidth,
				memberListOpen: state.memberListOpen
			};
			localStorage.setItem('hearth_ui', JSON.stringify(toPersist));
		});
	}

	return {
		subscribe,

		toggleSidebar() {
			update((s) => ({ ...s, sidebarOpen: !s.sidebarOpen }));
		},

		setSidebarOpen(open: boolean) {
			update((s) => ({ ...s, sidebarOpen: open }));
		},

		setSidebarWidth(width: number) {
			update((s) => ({ ...s, sidebarWidth: Math.max(200, Math.min(400, width)) }));
		},

		toggleMemberList() {
			update((s) => ({ ...s, memberListOpen: !s.memberListOpen }));
		},

		setMemberListOpen(open: boolean) {
			update((s) => ({ ...s, memberListOpen: open }));
		},

		toggleSearch() {
			update((s) => ({ ...s, searchOpen: !s.searchOpen }));
		},

		setSearchOpen(open: boolean) {
			update((s) => ({ ...s, searchOpen: open }));
		},

		toggleHelp() {
			update((s) => ({ ...s, helpOpen: !s.helpOpen }));
		},

		setHelpOpen(open: boolean) {
			update((s) => ({ ...s, helpOpen: open }));
		},

		closeAllModals() {
			update((s) => ({ ...s, searchOpen: false, helpOpen: false }));
		},

		setConnectionStatus(status: UIState['connectionStatus']) {
			update((s) => ({ ...s, connectionStatus: status }));
		},

		setWindowFocused(focused: boolean) {
			update((s) => ({ ...s, windowFocused: focused }));
		}
	};
}

export const ui = createUIStore();

// Derived stores
export const sidebarOpen = derived(ui, ($ui) => $ui.sidebarOpen);
export const memberListOpen = derived(ui, ($ui) => $ui.memberListOpen);
export const searchOpen = derived(ui, ($ui) => $ui.searchOpen);
export const helpOpen = derived(ui, ($ui) => $ui.helpOpen);
export const connectionStatus = derived(ui, ($ui) => $ui.connectionStatus);
export const isConnected = derived(ui, ($ui) => $ui.connectionStatus === 'connected');
