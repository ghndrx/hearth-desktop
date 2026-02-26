import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import BackupManager from './BackupManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
	save: vi.fn(),
	open: vi.fn()
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	writeTextFile: vi.fn(),
	readTextFile: vi.fn(),
	BaseDirectory: { AppData: 'AppData' }
}));

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

const mockInvoke = vi.mocked(invoke);
const mockSave = vi.mocked(save);
const mockOpen = vi.mocked(open);
const mockWriteTextFile = vi.mocked(writeTextFile);
const mockReadTextFile = vi.mocked(readTextFile);

describe('BackupManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Default mock implementations
		mockInvoke.mockImplementation(async (cmd: string) => {
			switch (cmd) {
				case 'get_backup_history':
					return [];
				case 'get_backup_schedule':
					return {
						enabled: false,
						frequency: 'weekly',
						last_backup: null,
						next_backup: null,
						keep_count: 5
					};
				case 'get_app_version':
					return '1.0.0';
				case 'get_platform':
					return 'linux';
				case 'export_settings':
					return { theme: 'dark', notifications: true };
				case 'export_themes':
					return { custom: { primary: '#5865f2' } };
				case 'export_shortcuts':
					return { 'ctrl+n': 'newMessage' };
				case 'export_layouts':
					return { default: { sidebar: 250 } };
				default:
					return null;
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the backup manager header', async () => {
		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Backup & Restore')).toBeInTheDocument();
		});
	});

	it('shows loading state initially', () => {
		render(BackupManager);
		expect(screen.getByText('Loading backup information...')).toBeInTheDocument();
	});

	it('displays export options after loading', async () => {
		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Settings & Preferences')).toBeInTheDocument();
			expect(screen.getByText('Custom Themes')).toBeInTheDocument();
			expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
			expect(screen.getByText('Window Layouts')).toBeInTheDocument();
		});
	});

	it('displays export button', async () => {
		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Export Backup')).toBeInTheDocument();
		});
	});

	it('displays import section', async () => {
		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Import Backup')).toBeInTheDocument();
			expect(screen.getByText('Select Backup File')).toBeInTheDocument();
		});
	});

	it('disables export when no categories selected', async () => {
		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Export Backup')).toBeInTheDocument();
		});

		// Uncheck all options
		const checkboxes = screen.getAllByRole('checkbox');
		for (const checkbox of checkboxes) {
			if ((checkbox as HTMLInputElement).checked) {
				await fireEvent.click(checkbox);
			}
		}

		const exportButton = screen.getByText('Export Backup').closest('button');
		expect(exportButton).toBeDisabled();
	});

	it('exports backup when button clicked', async () => {
		mockSave.mockResolvedValue('/path/to/backup.json');
		mockWriteTextFile.mockResolvedValue(undefined);
		mockInvoke.mockImplementation(async (cmd: string) => {
			switch (cmd) {
				case 'get_backup_history':
					return [];
				case 'get_backup_schedule':
					return { enabled: false, frequency: 'weekly', last_backup: null, next_backup: null, keep_count: 5 };
				case 'get_app_version':
					return '1.0.0';
				case 'get_platform':
					return 'linux';
				case 'export_settings':
					return { theme: 'dark' };
				case 'export_themes':
					return {};
				case 'export_shortcuts':
					return {};
				case 'export_layouts':
					return {};
				case 'register_backup':
					return null;
				default:
					return null;
			}
		});

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Export Backup')).toBeInTheDocument();
		});

		const exportButton = screen.getByText('Export Backup').closest('button')!;
		await fireEvent.click(exportButton);

		await waitFor(() => {
			expect(mockSave).toHaveBeenCalled();
			expect(mockWriteTextFile).toHaveBeenCalled();
		});
	});

	it('shows import confirmation modal when file selected', async () => {
		const mockBackupData = {
			metadata: {
				version: '1.0',
				created_at: '2024-01-15T10:00:00Z',
				app_version: '1.0.0',
				platform: 'linux',
				categories: ['settings', 'themes']
			},
			settings: { theme: 'dark' },
			themes: {},
			shortcuts: {},
			layouts: {}
		};

		mockOpen.mockResolvedValue('/path/to/backup.json');
		mockReadTextFile.mockResolvedValue(JSON.stringify(mockBackupData));

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Select Backup File')).toBeInTheDocument();
		});

		const importButton = screen.getByText('Select Backup File').closest('button')!;
		await fireEvent.click(importButton);

		await waitFor(() => {
			expect(screen.getByText('Confirm Import')).toBeInTheDocument();
			expect(screen.getByText('Restore Backup')).toBeInTheDocument();
		});
	});

	it('cancels import when cancel button clicked', async () => {
		const mockBackupData = {
			metadata: {
				version: '1.0',
				created_at: '2024-01-15T10:00:00Z',
				app_version: '1.0.0',
				platform: 'linux',
				categories: ['settings']
			},
			settings: { theme: 'dark' },
			themes: {},
			shortcuts: {},
			layouts: {}
		};

		mockOpen.mockResolvedValue('/path/to/backup.json');
		mockReadTextFile.mockResolvedValue(JSON.stringify(mockBackupData));

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Select Backup File')).toBeInTheDocument();
		});

		const importButton = screen.getByText('Select Backup File').closest('button')!;
		await fireEvent.click(importButton);

		await waitFor(() => {
			expect(screen.getByText('Confirm Import')).toBeInTheDocument();
		});

		const cancelButton = screen.getByText('Cancel');
		await fireEvent.click(cancelButton);

		await waitFor(() => {
			expect(screen.queryByText('Confirm Import')).not.toBeInTheDocument();
		});
	});

	it('displays backup history when available', async () => {
		mockInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'get_backup_history') {
				return [
					{
						version: '1.0',
						created_at: '2024-01-15T10:00:00Z',
						app_version: '1.0.0',
						platform: 'linux',
						categories: ['settings', 'themes']
					}
				];
			}
			if (cmd === 'get_backup_schedule') {
				return { enabled: false, frequency: 'weekly', last_backup: null, next_backup: null, keep_count: 5 };
			}
			return null;
		});

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Backup History')).toBeInTheDocument();
		});
	});

	it('shows automatic backup schedule section', async () => {
		render(BackupManager, { props: { showSchedule: true } });
		
		await waitFor(() => {
			expect(screen.getByText('Automatic Backups')).toBeInTheDocument();
			expect(screen.getByText('Enable automatic backups')).toBeInTheDocument();
		});
	});

	it('hides schedule section in compact mode', async () => {
		render(BackupManager, { props: { compact: true } });
		
		await waitFor(() => {
			expect(screen.getByText('Export Backup')).toBeInTheDocument();
		});

		expect(screen.queryByText('Automatic Backups')).not.toBeInTheDocument();
	});

	it('shows schedule config when enabled', async () => {
		mockInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'get_backup_history') {
				return [];
			}
			if (cmd === 'get_backup_schedule') {
				return { enabled: true, frequency: 'weekly', last_backup: null, next_backup: null, keep_count: 5 };
			}
			return null;
		});

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Frequency:')).toBeInTheDocument();
			expect(screen.getByText('Keep backups:')).toBeInTheDocument();
			expect(screen.getByText('Run Backup Now')).toBeInTheDocument();
		});
	});

	it('handles export error gracefully', async () => {
		mockSave.mockResolvedValue('/path/to/backup.json');
		mockWriteTextFile.mockRejectedValue(new Error('Write failed'));

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Export Backup')).toBeInTheDocument();
		});

		const exportButton = screen.getByText('Export Backup').closest('button')!;
		await fireEvent.click(exportButton);

		await waitFor(() => {
			expect(screen.getByText(/Export failed/)).toBeInTheDocument();
		});
	});

	it('handles invalid backup file format', async () => {
		mockOpen.mockResolvedValue('/path/to/backup.json');
		mockReadTextFile.mockResolvedValue('{ "invalid": "format" }');

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Select Backup File')).toBeInTheDocument();
		});

		const importButton = screen.getByText('Select Backup File').closest('button')!;
		await fireEvent.click(importButton);

		await waitFor(() => {
			expect(screen.getByText(/Invalid backup file format/)).toBeInTheDocument();
		});
	});

	it('deletes backup from history', async () => {
		const mockMetadata = {
			version: '1.0',
			created_at: '2024-01-15T10:00:00Z',
			app_version: '1.0.0',
			platform: 'linux',
			categories: ['settings']
		};

		let historyReturned = false;
		mockInvoke.mockImplementation(async (cmd: string) => {
			if (cmd === 'get_backup_history') {
				if (!historyReturned) {
					historyReturned = true;
					return [mockMetadata];
				}
				return [];
			}
			if (cmd === 'get_backup_schedule') {
				return { enabled: false, frequency: 'weekly', last_backup: null, next_backup: null, keep_count: 5 };
			}
			if (cmd === 'delete_backup') {
				return null;
			}
			return null;
		});

		render(BackupManager);
		
		await waitFor(() => {
			expect(screen.getByText('Backup History')).toBeInTheDocument();
		});

		const deleteButton = screen.getByTitle('Delete backup');
		await fireEvent.click(deleteButton);

		await waitFor(() => {
			expect(mockInvoke).toHaveBeenCalledWith('delete_backup', { createdAt: mockMetadata.created_at });
		});
	});
});
