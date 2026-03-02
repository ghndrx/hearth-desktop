import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import DNDSyncManager from './DNDSyncManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

const { invoke } = await import('@tauri-apps/api/core');
const mockedInvoke = vi.mocked(invoke);

describe('DNDSyncManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'dndsync_get_os_status') {
				return {
					active: false,
					mode_name: null,
					sync_enabled: true,
					platform: 'linux',
					supported: true
				};
			}
			if (cmd === 'is_dnd_active') return false;
			if (cmd === 'dndsync_start_sync') return undefined;
			if (cmd === 'dndsync_stop_sync') return undefined;
			if (cmd === 'set_dnd') return undefined;
			return undefined;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the DND sync header', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('Desktop DND')).toBeInTheDocument();
		});
	});

	it('shows notification bell when DND is inactive', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('🔔')).toBeInTheDocument();
		});
	});

	it('shows muted bell when DND is active', async () => {
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'dndsync_get_os_status') {
				return {
					active: true,
					mode_name: 'Do Not Disturb',
					sync_enabled: true,
					platform: 'linux',
					supported: true
				};
			}
			if (cmd === 'is_dnd_active') return true;
			if (cmd === 'dndsync_start_sync') return undefined;
			if (cmd === 'dndsync_stop_sync') return undefined;
			return undefined;
		});

		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('🔕')).toBeInTheDocument();
		});
	});

	it('displays platform-specific label', async () => {
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'dndsync_get_os_status') {
				return {
					active: false,
					mode_name: null,
					sync_enabled: false,
					platform: 'macos',
					supported: true
				};
			}
			if (cmd === 'is_dnd_active') return false;
			if (cmd === 'dndsync_start_sync') return undefined;
			if (cmd === 'dndsync_stop_sync') return undefined;
			return undefined;
		});

		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('macOS Focus')).toBeInTheDocument();
		});
	});

	it('shows sync toggle button', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByLabelText(/auto-sync/i)).toBeInTheDocument();
		});
	});

	it('toggles sync on/off', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('On')).toBeInTheDocument();
		});

		const toggleBtn = screen.getByLabelText(/disable auto-sync/i);
		await fireEvent.click(toggleBtn);

		await vi.waitFor(() => {
			expect(screen.getByText('Off')).toBeInTheDocument();
		});
	});

	it('shows detail rows in non-compact mode', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('OS DND')).toBeInTheDocument();
			expect(screen.getByText('Hearth DND')).toBeInTheDocument();
			expect(screen.getByText('Sync')).toBeInTheDocument();
		});
	});

	it('hides details in compact mode', async () => {
		render(DNDSyncManager, { props: { compact: true } });

		await vi.waitFor(() => {
			expect(screen.getByText('Desktop DND')).toBeInTheDocument();
		});

		expect(screen.queryByText('OS DND')).not.toBeInTheDocument();
	});

	it('shows "In Sync" when both states match', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('In Sync')).toBeInTheDocument();
		});
	});

	it('shows "Out of Sync" and manual sync button when states differ', async () => {
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'dndsync_get_os_status') {
				return {
					active: true,
					mode_name: 'Do Not Disturb',
					sync_enabled: true,
					platform: 'linux',
					supported: true
				};
			}
			if (cmd === 'is_dnd_active') return false; // OS on, Hearth off = out of sync
			if (cmd === 'dndsync_start_sync') return undefined;
			if (cmd === 'dndsync_stop_sync') return undefined;
			if (cmd === 'set_dnd') return undefined;
			return undefined;
		});

		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('Out of Sync')).toBeInTheDocument();
			expect(screen.getByText('Sync Now')).toBeInTheDocument();
		});
	});

	it('calls dndsync_start_sync on mount when autoSync is enabled', async () => {
		render(DNDSyncManager, { props: { autoSyncEnabled: true } });

		await vi.waitFor(() => {
			expect(mockedInvoke).toHaveBeenCalledWith('dndsync_start_sync', expect.any(Object));
		});
	});

	it('has correct ARIA attributes', () => {
		render(DNDSyncManager);

		const region = screen.getByRole('region', { name: /do not disturb/i });
		expect(region).toBeInTheDocument();
	});

	it('shows status text when DND active', async () => {
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'dndsync_get_os_status') {
				return {
					active: true,
					mode_name: 'Work Focus',
					sync_enabled: true,
					platform: 'macos',
					supported: true
				};
			}
			if (cmd === 'is_dnd_active') return true;
			if (cmd === 'dndsync_start_sync') return undefined;
			if (cmd === 'dndsync_stop_sync') return undefined;
			return undefined;
		});

		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('Work Focus')).toBeInTheDocument();
		});
	});

	it('shows notifications active when DND is off', async () => {
		render(DNDSyncManager);

		await vi.waitFor(() => {
			expect(screen.getByText('Notifications active')).toBeInTheDocument();
		});
	});
});
