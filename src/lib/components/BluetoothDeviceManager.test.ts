import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BluetoothDeviceManager from './BluetoothDeviceManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

const { invoke } = await import('@tauri-apps/api/core');
const mockedInvoke = vi.mocked(invoke);

describe('BluetoothDeviceManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'bluetooth_get_status') {
				return {
					available: true,
					enabled: true,
					discovering: false,
					devices: [
						{
							name: 'AirPods Pro',
							address: 'AA:BB:CC:DD:EE:FF',
							device_type: 'Headphones',
							connected: true,
							paired: true,
							battery_level: 85,
							signal_strength: null
						},
						{
							name: 'Magic Keyboard',
							address: '11:22:33:44:55:66',
							device_type: 'Keyboard',
							connected: true,
							paired: true,
							battery_level: null,
							signal_strength: null
						},
						{
							name: 'Old Speaker',
							address: 'FF:EE:DD:CC:BB:AA',
							device_type: 'Speaker',
							connected: false,
							paired: true,
							battery_level: null,
							signal_strength: null
						}
					]
				};
			}
			if (cmd === 'bluetooth_start_monitor') return undefined;
			if (cmd === 'bluetooth_stop_monitor') return undefined;
			return undefined;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the Bluetooth header', async () => {
		render(BluetoothDeviceManager);

		expect(screen.getByText('Bluetooth')).toBeInTheDocument();
		expect(screen.getByText('📶')).toBeInTheDocument();
	});

	it('shows connected device count badge', async () => {
		render(BluetoothDeviceManager);

		// Wait for data to load
		await vi.waitFor(() => {
			expect(screen.getByText('2')).toBeInTheDocument();
		});
	});

	it('renders in collapsed state by default in compact mode', () => {
		render(BluetoothDeviceManager, { props: { compact: true } });

		// In compact mode, content should not be visible by default
		expect(screen.queryByText('Connected')).not.toBeInTheDocument();
	});

	it('expands when header is clicked', async () => {
		render(BluetoothDeviceManager, { props: { compact: true } });

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('Connected')).toBeInTheDocument();
		});
	});

	it('displays connected devices', async () => {
		render(BluetoothDeviceManager);

		// Expand by default (non-compact)
		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('AirPods Pro')).toBeInTheDocument();
			expect(screen.getByText('Magic Keyboard')).toBeInTheDocument();
		});
	});

	it('displays battery level when available', async () => {
		render(BluetoothDeviceManager);

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('85%')).toBeInTheDocument();
		});
	});

	it('shows disconnected devices when enabled', async () => {
		render(BluetoothDeviceManager, {
			props: { showDisconnected: true }
		});

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('Old Speaker')).toBeInTheDocument();
			expect(screen.getByText('Paired')).toBeInTheDocument();
		});
	});

	it('hides disconnected devices when disabled', async () => {
		render(BluetoothDeviceManager, {
			props: { showDisconnected: false }
		});

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('AirPods Pro')).toBeInTheDocument();
			expect(screen.queryByText('Old Speaker')).not.toBeInTheDocument();
		});
	});

	it('shows unavailable message when Bluetooth is not available', async () => {
		mockedInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'bluetooth_get_status') {
				return {
					available: false,
					enabled: false,
					discovering: false,
					devices: []
				};
			}
			return undefined;
		});

		render(BluetoothDeviceManager);

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			expect(screen.getByText('Bluetooth not available')).toBeInTheDocument();
		});
	});

	it('shows device type icons', async () => {
		render(BluetoothDeviceManager);

		const header = screen.getByRole('button', { name: /bluetooth/i });
		await fireEvent.click(header);

		await vi.waitFor(() => {
			// Headphones icon
			expect(screen.getByText('🎧')).toBeInTheDocument();
			// Keyboard icon
			expect(screen.getByText('⌨️')).toBeInTheDocument();
		});
	});

	it('has correct ARIA attributes', () => {
		render(BluetoothDeviceManager);

		const region = screen.getByRole('region', { name: /bluetooth/i });
		expect(region).toBeInTheDocument();
	});

	it('calls bluetooth_start_monitor on mount', async () => {
		render(BluetoothDeviceManager);

		await vi.waitFor(() => {
			expect(mockedInvoke).toHaveBeenCalledWith('bluetooth_start_monitor', expect.any(Object));
		});
	});
});
