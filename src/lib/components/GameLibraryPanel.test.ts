import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import GameLibraryPanel from './GameLibraryPanel.svelte';

// Mock Web Animations API for Svelte transitions
Element.prototype.animate = vi.fn(() => ({
	finish: vi.fn(),
	oncancel: null,
	onfinish: null,
	cancel: vi.fn(),
	pause: vi.fn(),
	play: vi.fn(),
	reverse: vi.fn(),
	persist: vi.fn(),
	ready: Promise.resolve(),
	startTime: 0,
	currentTime: 0,
	playbackRate: 1,
	timeline: null,
	updatePlaybackRate: vi.fn(),
	pending: false,
	effect: null,
	dispatchEvent: vi.fn(),
})) as any;

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
	invoke: (cmd: string, args?: object) => (args !== undefined ? mockInvoke(cmd, args) : mockInvoke(cmd)),
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn().mockResolvedValue(() => {}),
}));

const mockGames = [
	{
		app_id: '730',
		name: 'Counter-Strike 2',
		process_name: 'cs2.exe',
		is_running: false,
		last_detected: Math.floor(Date.now() / 1000) - 3600,
		total_playtime_seconds: 7200,
	},
	{
		app_id: '570',
		name: 'Dota 2',
		process_name: 'dota2.exe',
		is_running: true,
		last_detected: Math.floor(Date.now() / 1000) - 120,
		total_playtime_seconds: 14400,
	},
	{
		app_id: '440',
		name: 'Team Fortress 2',
		process_name: 'tf2.exe',
		is_running: false,
		last_detected: Math.floor(Date.now() / 1000) - 86400 * 3,
		total_playtime_seconds: 3600,
	},
];

describe('GameLibraryPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockInvoke.mockResolvedValue(mockGames);
	});

	it('renders the panel when open', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		expect(screen.getByText('Game Library')).toBeInTheDocument();
	});

	it('loads games on mount', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('get_game_library');
		});
	});

	it('displays game cards when loaded', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
			expect(screen.getByText('Dota 2')).toBeInTheDocument();
			expect(screen.getByText('Team Fortress 2')).toBeInTheDocument();
		});
	});

	it('shows running count badge when games are running', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('1 running')).toBeInTheDocument();
		});
	});

	it('filters games by search query', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search games...');
		await fireEvent.input(searchInput, { target: { value: 'Dota' } });

		await waitFor(() => {
			expect(screen.getByText('Dota 2')).toBeInTheDocument();
			expect(screen.queryByText('Counter-Strike 2')).not.toBeInTheDocument();
		});
	});

	it('shows only running games when Running tab is selected', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Dota 2')).toBeInTheDocument();
		});

		const runningTab = screen.getByText('Playing');
		await fireEvent.click(runningTab);

		await waitFor(() => {
			expect(screen.getByText('Dota 2')).toBeInTheDocument();
			expect(screen.queryByText('Counter-Strike 2')).not.toBeInTheDocument();
		});
	});

	it('shows recently played games when Recent tab is selected', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});

		const recentTab = screen.getByText('Recent');
		await fireEvent.click(recentTab);

		await waitFor(() => {
			// CS2 and TF2 should appear (within 7 days), but some games might be filtered
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});
	});

	it('calls launch_game when Play button is clicked', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});

		// Use getAllByTitle since there are multiple game cards with Play buttons
		const playButtons = screen.getAllByTitle('Launch via Steam');
		await fireEvent.click(playButtons[0]);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('launch_game', { appId: '730' });
		});
	});

	it('shows Focus button for running games', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Dota 2')).toBeInTheDocument();
		});

		const focusButton = screen.getByTitle('Focus game');
		expect(focusButton).toBeInTheDocument();
		expect(screen.getByText('Focus')).toBeInTheDocument();
	});

	it('displays game stats bar with total games and playtime', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('3 games')).toBeInTheDocument();
			expect(screen.getByText('7h total playtime')).toBeInTheDocument();
		});
	});

	it('shows error message when loading fails', async () => {
		mockInvoke.mockRejectedValueOnce(new Error('Failed to load'));

		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
		});
	});

	it('closes panel when close button is clicked', async () => {
		const onClose = vi.fn();
		render(GameLibraryPanel, {
			props: { open: true, onClose },
		});

		const closeButton = screen.getByLabelText('Close');
		await fireEvent.click(closeButton);

		expect(onClose).toHaveBeenCalled();
	});

	it('closes panel when Escape key is pressed', async () => {
		const onClose = vi.fn();
		render(GameLibraryPanel, {
			props: { open: true, onClose },
		});

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toBeInTheDocument();
		});

		const dialog = screen.getByRole('dialog');
		await fireEvent.keyDown(dialog, { key: 'Escape' });

		expect(onClose).toHaveBeenCalled();
	});

	it('formats playtime correctly', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			// 7200 seconds = 2h
			expect(screen.getByText('2h')).toBeInTheDocument();
		});
	});

	it('refreshes library when refresh button is clicked', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});

		mockInvoke.mockClear();
		const refreshButton = screen.getByText('Refresh');
		await fireEvent.click(refreshButton);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('get_game_library');
		});
	});

	it('shows empty state when no games found in search', async () => {
		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Counter-Strike 2')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Search games...');
		await fireEvent.input(searchInput, { target: { value: 'NonexistentGame' } });

		await waitFor(() => {
			expect(screen.getByText(/No games match/i)).toBeInTheDocument();
		});
	});

	it('shows empty state for running tab when no games running', async () => {
		mockInvoke.mockResolvedValueOnce([
			{
				app_id: '999',
				name: 'Idle Game',
				process_name: 'idle.exe',
				is_running: false,
				last_detected: 0,
				total_playtime_seconds: 0,
			},
		]);

		render(GameLibraryPanel, {
			props: { open: true },
		});

		await waitFor(() => {
			expect(screen.getByText('Idle Game')).toBeInTheDocument();
		});

		const runningTab = screen.getByText('Playing');
		await fireEvent.click(runningTab);

		await waitFor(() => {
			expect(screen.getByText(/No games currently running/i)).toBeInTheDocument();
		});
	});
});
