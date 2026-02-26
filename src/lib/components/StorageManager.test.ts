import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import StorageManager from './StorageManager.svelte';

// Mock tauri storage functions
const mockStorageInfo = {
	app_data: {
		path: '/home/user/.local/share/hearth',
		name: 'Application Data',
		size_bytes: 52428800, // 50 MB
		size_formatted: '50.00 MB',
		file_count: 150,
		exists: true
	},
	app_cache: {
		path: '/home/user/.cache/hearth',
		name: 'Cache',
		size_bytes: 104857600, // 100 MB
		size_formatted: '100.00 MB',
		file_count: 500,
		exists: true
	},
	app_config: {
		path: '/home/user/.config/hearth',
		name: 'Configuration',
		size_bytes: 1048576, // 1 MB
		size_formatted: '1.00 MB',
		file_count: 10,
		exists: true
	},
	app_log: {
		path: '/home/user/.local/share/hearth/logs',
		name: 'Logs',
		size_bytes: 20971520, // 20 MB
		size_formatted: '20.00 MB',
		file_count: 50,
		exists: true
	},
	total_size_bytes: 179306496,
	total_size_formatted: '170.99 MB',
	total_files: 710
};

const mockCleanupResult = {
	success: true,
	freed_bytes: 104857600,
	freed_formatted: '100.00 MB',
	deleted_files: 500,
	errors: []
};

vi.mock('$lib/tauri', () => ({
	storage: {
		getInfo: vi.fn().mockResolvedValue(mockStorageInfo),
		clear: vi.fn().mockResolvedValue(mockCleanupResult),
		getPath: vi.fn().mockResolvedValue('/home/user/.cache/hearth'),
		openLocation: vi.fn().mockResolvedValue(undefined)
	}
}));

import { storage } from '$lib/tauri';

describe('StorageManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders loading state initially', () => {
		render(StorageManager);
		expect(screen.getByText('Loading storage info...')).toBeInTheDocument();
	});

	it('displays storage information after loading', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('💾 Storage Usage')).toBeInTheDocument();
		});
		
		expect(screen.getByText('170.99 MB')).toBeInTheDocument();
		expect(screen.getByText('710 files')).toBeInTheDocument();
	});

	it('displays all storage categories', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		expect(screen.getByText('Logs')).toBeInTheDocument();
		expect(screen.getByText('App Data')).toBeInTheDocument();
		expect(screen.getByText('Configuration')).toBeInTheDocument();
	});

	it('displays category sizes correctly', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('100.00 MB')).toBeInTheDocument();
		});
		
		expect(screen.getByText('20.00 MB')).toBeInTheDocument();
		expect(screen.getByText('50.00 MB')).toBeInTheDocument();
		expect(screen.getByText('1.00 MB')).toBeInTheDocument();
	});

	it('shows confirmation modal when clearing storage', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Find and click the clear button for cache
		const clearButtons = screen.getAllByTitle('Clear cache');
		await fireEvent.click(clearButtons[0]);
		
		// Confirmation modal should appear
		expect(screen.getByText('Confirm Cleanup')).toBeInTheDocument();
		expect(screen.getByText(/Are you sure you want to clear/)).toBeInTheDocument();
	});

	it('cancels cleanup when cancel button is clicked', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Open confirmation modal
		const clearButtons = screen.getAllByTitle('Clear cache');
		await fireEvent.click(clearButtons[0]);
		
		// Click cancel
		const cancelButton = screen.getByText('Cancel');
		await fireEvent.click(cancelButton);
		
		// Modal should be closed
		expect(screen.queryByText('Confirm Cleanup')).not.toBeInTheDocument();
		
		// Clear should not have been called
		expect(storage.clear).not.toHaveBeenCalled();
	});

	it('clears storage when confirmed', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Open confirmation modal
		const clearButtons = screen.getAllByTitle('Clear cache');
		await fireEvent.click(clearButtons[0]);
		
		// Click confirm
		const confirmButton = screen.getByText(/Clear$/);
		await fireEvent.click(confirmButton);
		
		await waitFor(() => {
			expect(storage.clear).toHaveBeenCalledWith('cache');
		});
	});

	it('shows cleanup result after successful cleanup', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Open confirmation modal
		const clearButtons = screen.getAllByTitle('Clear cache');
		await fireEvent.click(clearButtons[0]);
		
		// Confirm cleanup
		const confirmButton = screen.getByText(/Clear$/);
		await fireEvent.click(confirmButton);
		
		await waitFor(() => {
			expect(screen.getByText(/Freed 100.00 MB/)).toBeInTheDocument();
		});
	});

	it('opens storage location when open button is clicked', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Find and click the open button for cache
		const openButtons = screen.getAllByTitle('Open in file manager');
		await fireEvent.click(openButtons[0]);
		
		expect(storage.openLocation).toHaveBeenCalledWith('cache');
	});

	it('clears all temporary data when clear all button is clicked', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Clear All Temporary Data')).toBeInTheDocument();
		});
		
		// Click clear all button
		const clearAllButton = screen.getByText('Clear All Temporary Data');
		await fireEvent.click(clearAllButton.closest('button')!);
		
		// Confirmation modal should appear
		expect(screen.getByText('Confirm Cleanup')).toBeInTheDocument();
		
		// Confirm
		const confirmButton = screen.getByText(/Clear$/);
		await fireEvent.click(confirmButton);
		
		await waitFor(() => {
			expect(storage.clear).toHaveBeenCalledWith('all');
		});
	});

	it('refreshes storage info when refresh button is clicked', async () => {
		render(StorageManager);
		
		await waitFor(() => {
			expect(storage.getInfo).toHaveBeenCalledTimes(1);
		});
		
		// Click refresh button
		const refreshButton = screen.getByTitle('Refresh storage info');
		await fireEvent.click(refreshButton);
		
		await waitFor(() => {
			expect(storage.getInfo).toHaveBeenCalledTimes(2);
		});
	});

	it('respects compact mode prop', async () => {
		const { container } = render(StorageManager, { props: { compact: true } });
		
		await waitFor(() => {
			expect(screen.getByText('💾 Storage Usage')).toBeInTheDocument();
		});
		
		expect(container.querySelector('.storage-manager.compact')).toBeInTheDocument();
	});

	it('hides details when showDetails is false', async () => {
		render(StorageManager, { props: { showDetails: false } });
		
		await waitFor(() => {
			expect(screen.getByText('💾 Storage Usage')).toBeInTheDocument();
		});
		
		// Category details should not be visible
		expect(screen.queryByText('Cache')).not.toBeInTheDocument();
		expect(screen.queryByText('Clear All Temporary Data')).not.toBeInTheDocument();
	});

	it('handles errors gracefully', async () => {
		(storage.getInfo as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
		
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Network error')).toBeInTheDocument();
		});
		
		// Retry button should be visible
		expect(screen.getByText('Retry')).toBeInTheDocument();
	});

	it('retries loading when retry button is clicked', async () => {
		(storage.getInfo as ReturnType<typeof vi.fn>)
			.mockRejectedValueOnce(new Error('Network error'))
			.mockResolvedValueOnce(mockStorageInfo);
		
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Retry')).toBeInTheDocument();
		});
		
		// Click retry
		const retryButton = screen.getByText('Retry');
		await fireEvent.click(retryButton);
		
		await waitFor(() => {
			expect(screen.getByText('💾 Storage Usage')).toBeInTheDocument();
		});
	});

	it('disables clear buttons when size is 0', async () => {
		const emptyStorageInfo = {
			...mockStorageInfo,
			app_cache: { ...mockStorageInfo.app_cache, size_bytes: 0, size_formatted: '0 B' },
			app_log: { ...mockStorageInfo.app_log, size_bytes: 0, size_formatted: '0 B' }
		};
		
		(storage.getInfo as ReturnType<typeof vi.fn>).mockResolvedValueOnce(emptyStorageInfo);
		
		render(StorageManager);
		
		await waitFor(() => {
			expect(screen.getByText('Cache')).toBeInTheDocument();
		});
		
		// Clear button should be disabled
		const clearButtons = screen.getAllByTitle('Clear cache');
		expect(clearButtons[0]).toBeDisabled();
	});

	it('auto-refreshes when autoRefresh is enabled', async () => {
		vi.useFakeTimers();
		
		render(StorageManager, { props: { autoRefresh: true, refreshInterval: 1000 } });
		
		await waitFor(() => {
			expect(storage.getInfo).toHaveBeenCalledTimes(1);
		});
		
		// Advance timer
		vi.advanceTimersByTime(1000);
		
		await waitFor(() => {
			expect(storage.getInfo).toHaveBeenCalledTimes(2);
		});
	});
});
