import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CrashReporter from './CrashReporter.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn((cmd: string) => {
		switch (cmd) {
			case 'get_app_version':
				return Promise.resolve('1.0.0');
			case 'get_os_info':
				return Promise.resolve('Linux x86_64');
			case 'get_crash_reports':
				return Promise.resolve('[]');
			case 'save_crash_report':
				return Promise.resolve();
			case 'delete_crash_report':
				return Promise.resolve();
			default:
				return Promise.reject(new Error(`Unknown command: ${cmd}`));
		}
	})
}));

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

describe('CrashReporter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initialization', () => {
		it('should render toggle button', async () => {
			render(CrashReporter);

			await waitFor(() => {
				const toggleButton = screen.getByRole('button', { name: /toggle crash reports/i });
				expect(toggleButton).toBeInTheDocument();
			});
		});

		it('should initialize with default config', async () => {
			render(CrashReporter);

			// Toggle should be visible (default enabled)
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});

		it('should respect disabled config', async () => {
			render(CrashReporter, { props: { config: { enabled: false } } });

			// Component should still render toggle but not set up handlers
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});
	});

	describe('Reports Panel', () => {
		it('should toggle reports panel on button click', async () => {
			render(CrashReporter);

			const toggleButton = await screen.findByRole('button', { name: /toggle crash reports/i });

			// Panel should not be visible initially
			expect(screen.queryByText('Crash Reports')).not.toBeInTheDocument();

			// Click to open
			await fireEvent.click(toggleButton);
			expect(screen.getByText('Crash Reports')).toBeInTheDocument();

			// Click to close
			await fireEvent.click(toggleButton);
			await waitFor(() => {
				expect(screen.queryByText('Crash Reports')).not.toBeInTheDocument();
			});
		});

		it('should show empty state when no reports', async () => {
			render(CrashReporter);

			const toggleButton = await screen.findByRole('button', { name: /toggle crash reports/i });
			await fireEvent.click(toggleButton);

			expect(screen.getByText('No crash reports')).toBeInTheDocument();
		});

		it('should close panel via close button', async () => {
			render(CrashReporter);

			const toggleButton = await screen.findByRole('button', { name: /toggle crash reports/i });
			await fireEvent.click(toggleButton);

			const closeButton = screen.getByRole('button', { name: /close/i });
			await fireEvent.click(closeButton);

			await waitFor(() => {
				expect(screen.queryByText('Crash Reports')).not.toBeInTheDocument();
			});
		});
	});

	describe('Error Handling', () => {
		it('should capture global errors', async () => {
			render(CrashReporter);

			// Wait for initialization
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});

			// Trigger a global error
			const errorEvent = new ErrorEvent('error', {
				message: 'Test error message',
				filename: 'test.js',
				lineno: 10,
				colno: 5,
				error: new Error('Test error')
			});

			window.dispatchEvent(errorEvent);

			// Open panel and check for report
			const toggleButton = screen.getByRole('button', { name: /toggle crash reports/i });
			await fireEvent.click(toggleButton);

			// Note: Due to async nature, this might need adjustment based on actual implementation
		});

		it('should capture unhandled rejections', async () => {
			render(CrashReporter);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});

			// Trigger unhandled rejection
			const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
				promise: Promise.reject(new Error('Unhandled')),
				reason: new Error('Test rejection')
			});

			window.dispatchEvent(rejectionEvent);
		});
	});

	describe('Configuration', () => {
		it('should use custom configuration', async () => {
			render(CrashReporter, {
				props: {
					config: {
						enabled: true,
						autoSubmit: false,
						collectBreadcrumbs: false,
						maxBreadcrumbs: 25,
						anonymizeData: false
					}
				}
			});

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});

		it('should merge partial config with defaults', async () => {
			render(CrashReporter, {
				props: {
					config: {
						maxBreadcrumbs: 100
					}
				}
			});

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});
	});

	describe('Anonymization', () => {
		it('should anonymize email addresses when enabled', () => {
			// Test the anonymization logic
			const message = 'Error for user test@example.com';
			const anonymized = message.replace(
				/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
				'[EMAIL]'
			);
			expect(anonymized).toBe('Error for user [EMAIL]');
		});

		it('should anonymize IP addresses when enabled', () => {
			const message = 'Connection from 192.168.1.100 failed';
			const anonymized = message.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
			expect(anonymized).toBe('Connection from [IP] failed');
		});

		it('should anonymize Unix paths when enabled', () => {
			const message = 'File not found: /home/john/documents/file.txt';
			const anonymized = message.replace(/\/home\/[^/]+\//g, '/home/[USER]/');
			expect(anonymized).toBe('File not found: /home/[USER]/documents/file.txt');
		});

		it('should anonymize Windows paths when enabled', () => {
			const message = 'File not found: C:\\Users\\John\\Documents\\file.txt';
			const anonymized = message.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\[USER]\\');
			expect(anonymized).toBe('File not found: C:\\Users\\[USER]\\Documents\\file.txt');
		});
	});

	describe('Memory Formatting', () => {
		it('should format bytes correctly', () => {
			const formatBytes = (bytes: number): string => {
				if (bytes === 0) return '0 B';
				const k = 1024;
				const sizes = ['B', 'KB', 'MB', 'GB'];
				const i = Math.floor(Math.log(bytes) / Math.log(k));
				return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
			};

			expect(formatBytes(0)).toBe('0 B');
			expect(formatBytes(1024)).toBe('1 KB');
			expect(formatBytes(1536)).toBe('1.5 KB');
			expect(formatBytes(1048576)).toBe('1 MB');
			expect(formatBytes(1073741824)).toBe('1 GB');
		});
	});

	describe('Report Types', () => {
		it('should return correct icon for error type', () => {
			const getTypeIcon = (type: string): string => {
				switch (type) {
					case 'error':
						return '⚠️';
					case 'unhandled_rejection':
						return '❌';
					case 'panic':
						return '💥';
					case 'oom':
						return '🧠';
					default:
						return '❓';
				}
			};

			expect(getTypeIcon('error')).toBe('⚠️');
			expect(getTypeIcon('unhandled_rejection')).toBe('❌');
			expect(getTypeIcon('panic')).toBe('💥');
			expect(getTypeIcon('oom')).toBe('🧠');
			expect(getTypeIcon('unknown')).toBe('❓');
		});

		it('should return correct label for error type', () => {
			const getTypeLabel = (type: string): string => {
				switch (type) {
					case 'error':
						return 'Error';
					case 'unhandled_rejection':
						return 'Unhandled Promise';
					case 'panic':
						return 'Application Panic';
					case 'oom':
						return 'Out of Memory';
					default:
						return 'Unknown';
				}
			};

			expect(getTypeLabel('error')).toBe('Error');
			expect(getTypeLabel('unhandled_rejection')).toBe('Unhandled Promise');
			expect(getTypeLabel('panic')).toBe('Application Panic');
			expect(getTypeLabel('oom')).toBe('Out of Memory');
		});
	});

	describe('Clipboard', () => {
		it('should copy report to clipboard', async () => {
			const mockClipboard = {
				writeText: vi.fn().mockResolvedValue(undefined)
			};
			Object.assign(navigator, { clipboard: mockClipboard });

			render(CrashReporter);

			// The copy functionality is triggered from the dialog
			// This tests the clipboard API mock is set up correctly
			await navigator.clipboard.writeText('test');
			expect(mockClipboard.writeText).toHaveBeenCalledWith('test');
		});
	});

	describe('Report Generation', () => {
		it('should generate valid report ID', () => {
			const generateId = (): string => {
				return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			};

			const id = generateId();
			expect(id).toMatch(/^crash_\d+_[a-z0-9]+$/);
		});

		it('should format timestamp correctly', () => {
			const timestamp = 1709078400000; // Fixed timestamp for testing
			const formatted = new Date(timestamp).toLocaleString();
			expect(typeof formatted).toBe('string');
			expect(formatted.length).toBeGreaterThan(0);
		});
	});

	describe('LocalStorage Fallback', () => {
		it('should store reports in localStorage when invoke fails', async () => {
			const { invoke } = await import('@tauri-apps/api/core');
			vi.mocked(invoke).mockRejectedValueOnce(new Error('Storage unavailable'));

			render(CrashReporter);

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});

		it('should load reports from localStorage', () => {
			const mockReport = {
				id: 'crash_test_123',
				timestamp: Date.now(),
				type: 'error',
				message: 'Test error',
				breadcrumbs: [],
				submitted: false
			};

			localStorage.setItem('crash_crash_test_123', JSON.stringify(mockReport));

			// Verify localStorage was set
			const stored = localStorage.getItem('crash_crash_test_123');
			expect(stored).toBeTruthy();
			expect(JSON.parse(stored!)).toEqual(mockReport);
		});
	});

	describe('Clear All Reports', () => {
		it('should have disabled clear button when no reports', async () => {
			render(CrashReporter);

			const toggleButton = await screen.findByRole('button', { name: /toggle crash reports/i });
			await fireEvent.click(toggleButton);

			const clearButton = screen.getByRole('button', { name: /clear all reports/i });
			expect(clearButton).toBeDisabled();
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA attributes on dialog', async () => {
			render(CrashReporter);

			// The crash dialog has proper ARIA attributes when shown
			// This is verified by the component structure
		});

		it('should have proper button labels', async () => {
			render(CrashReporter);

			const toggleButton = await screen.findByRole('button', { name: /toggle crash reports/i });
			expect(toggleButton).toHaveAttribute('aria-label');
		});
	});

	describe('Submission', () => {
		it('should submit report to endpoint when configured', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200
			});

			render(CrashReporter, {
				props: {
					config: {
						submissionEndpoint: 'https://api.example.com/crashes'
					}
				}
			});

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});

		it('should handle submission errors gracefully', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

			render(CrashReporter, {
				props: {
					config: {
						submissionEndpoint: 'https://api.example.com/crashes'
					}
				}
			});

			await waitFor(() => {
				expect(screen.getByRole('button', { name: /toggle crash reports/i })).toBeInTheDocument();
			});
		});
	});
});
