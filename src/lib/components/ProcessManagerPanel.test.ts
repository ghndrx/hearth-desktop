import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ProcessManagerPanel from './ProcessManagerPanel.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

const { invoke } = await import('@tauri-apps/api/core');
const mockedInvoke = vi.mocked(invoke);

const mockSummary = {
	total_processes: 245,
	total_threads: 0,
	total_cpu_usage: 34.5,
	total_memory_bytes: 8589934592, // 8 GB
	top_cpu: [
		{ pid: 1001, name: 'chrome', cpu_usage: 12.5, memory_bytes: 536870912, status: 'Run', start_time: 1000, parent_pid: null },
		{ pid: 1002, name: 'node', cpu_usage: 8.3, memory_bytes: 268435456, status: 'Run', start_time: 2000, parent_pid: null },
		{ pid: 1003, name: 'code', cpu_usage: 5.1, memory_bytes: 402653184, status: 'Run', start_time: 3000, parent_pid: null },
	],
	top_memory: [
		{ pid: 1001, name: 'chrome', cpu_usage: 12.5, memory_bytes: 536870912, status: 'Run', start_time: 1000, parent_pid: null },
		{ pid: 1003, name: 'code', cpu_usage: 5.1, memory_bytes: 402653184, status: 'Run', start_time: 3000, parent_pid: null },
		{ pid: 1002, name: 'node', cpu_usage: 8.3, memory_bytes: 268435456, status: 'Run', start_time: 2000, parent_pid: null },
	],
	timestamp: Date.now()
};

const mockCommApps = [
	{ app_name: 'zoom', running: true, pid: 2001, cpu_usage: 3.2, memory_bytes: 134217728 },
	{ app_name: 'slack', running: true, pid: 2002, cpu_usage: 1.1, memory_bytes: 268435456 },
	{ app_name: 'teams', running: false, pid: null, cpu_usage: null, memory_bytes: null },
];

const mockGamingApps = [
	{ app_name: 'steam', running: true, pid: 3001, cpu_usage: 0.5, memory_bytes: 67108864 },
	{ app_name: 'epic', running: false, pid: null, cpu_usage: null, memory_bytes: null },
];

describe('ProcessManagerPanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'process_get_summary') return mockSummary;
			if (cmd === 'process_detect_communication_apps') return mockCommApps;
			if (cmd === 'process_detect_gaming_apps') return mockGamingApps;
			return undefined;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the header with process count', async () => {
		render(ProcessManagerPanel);

		expect(screen.getByText('Processes')).toBeInTheDocument();

		await vi.waitFor(() => {
			expect(screen.getByText('245')).toBeInTheDocument();
		});
	});

	it('renders compact summary when collapsed', async () => {
		render(ProcessManagerPanel, { props: { compact: true } });

		await vi.waitFor(() => {
			const summary = screen.getByText(/CPU.*34.*RAM/);
			expect(summary).toBeInTheDocument();
		});
	});

	it('displays process list when expanded', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('chrome')).toBeInTheDocument();
			expect(screen.getByText('node')).toBeInTheDocument();
			expect(screen.getByText('code')).toBeInTheDocument();
		});
	});

	it('shows CPU usage values', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('12.5%')).toBeInTheDocument();
			expect(screen.getByText('8.3%')).toBeInTheDocument();
		});
	});

	it('switches to memory tab', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByRole('tab', { name: 'Memory' })).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));

		// Memory tab should show memory values
		await vi.waitFor(() => {
			expect(screen.getByText(/512.*MB/)).toBeInTheDocument();
		});
	});

	it('switches to apps tab and shows detected apps', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByRole('tab', { name: /Apps/ })).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByRole('tab', { name: /Apps/ }));

		await vi.waitFor(() => {
			expect(screen.getByText('Communication Apps')).toBeInTheDocument();
			expect(screen.getByText('zoom')).toBeInTheDocument();
			expect(screen.getByText('slack')).toBeInTheDocument();
		});
	});

	it('shows running app count badge on apps tab', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			// 2 comm apps + 1 gaming app = 3
			expect(screen.getByText('3')).toBeInTheDocument();
		});
	});

	it('filters processes by search query', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByPlaceholderText('Filter processes...')).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText('Filter processes...');
		await fireEvent.input(searchInput, { target: { value: 'chrome' } });

		await vi.waitFor(() => {
			expect(screen.getByText('chrome')).toBeInTheDocument();
			expect(screen.queryByText('node')).not.toBeInTheDocument();
		});
	});

	it('shows summary stats', async () => {
		render(ProcessManagerPanel);

		const header = screen.getByRole('button', { name: /process/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('34.5%')).toBeInTheDocument();
		});
	});

	it('has correct ARIA attributes', () => {
		render(ProcessManagerPanel);

		const region = screen.getByRole('region', { name: /process/i });
		expect(region).toBeInTheDocument();
	});

	it('fetches data on mount', async () => {
		render(ProcessManagerPanel);

		await vi.waitFor(() => {
			expect(mockedInvoke).toHaveBeenCalledWith('process_get_summary', expect.any(Object));
			expect(mockedInvoke).toHaveBeenCalledWith('process_detect_communication_apps');
			expect(mockedInvoke).toHaveBeenCalledWith('process_detect_gaming_apps');
		});
	});
});
