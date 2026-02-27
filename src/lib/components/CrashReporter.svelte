<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { writable, derived } from 'svelte/store';
	import { fade, fly } from 'svelte/transition';

	// Types
	interface CrashReport {
		id: string;
		timestamp: number;
		type: 'error' | 'unhandled_rejection' | 'panic' | 'oom';
		message: string;
		stack?: string;
		componentStack?: string;
		userAgent: string;
		appVersion: string;
		osInfo: string;
		memoryUsage?: MemoryInfo;
		breadcrumbs: Breadcrumb[];
		metadata?: Record<string, unknown>;
		submitted: boolean;
		submittedAt?: number;
	}

	interface Breadcrumb {
		timestamp: number;
		category: 'navigation' | 'action' | 'network' | 'console' | 'error';
		message: string;
		data?: Record<string, unknown>;
	}

	interface MemoryInfo {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	}

	interface CrashReporterConfig {
		enabled: boolean;
		autoSubmit: boolean;
		collectBreadcrumbs: boolean;
		maxBreadcrumbs: number;
		includeScreenshot: boolean;
		anonymizeData: boolean;
		submissionEndpoint?: string;
	}

	// Props
	export let config: Partial<CrashReporterConfig> = {};

	// Default configuration
	const defaultConfig: CrashReporterConfig = {
		enabled: true,
		autoSubmit: false,
		collectBreadcrumbs: true,
		maxBreadcrumbs: 50,
		includeScreenshot: false,
		anonymizeData: true,
		submissionEndpoint: undefined
	};

	// Merged configuration
	$: mergedConfig = { ...defaultConfig, ...config };

	// Stores
	const crashReports = writable<CrashReport[]>([]);
	const breadcrumbs = writable<Breadcrumb[]>([]);
	const showCrashDialog = writable(false);
	const currentCrash = writable<CrashReport | null>(null);
	const isSubmitting = writable(false);
	const submissionError = writable<string | null>(null);

	// Derived stores
	const unsubmittedCount = derived(crashReports, ($reports) =>
		$reports.filter((r) => !r.submitted).length
	);

	const recentCrashes = derived(crashReports, ($reports) =>
		$reports.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
	);

	// State
	let unlisteners: UnlistenFn[] = [];
	let appVersion = '1.0.0';
	let osInfo = '';

	// Initialize
	onMount(async () => {
		if (!mergedConfig.enabled) return;

		try {
			// Get app info
			appVersion = await invoke<string>('get_app_version').catch(() => '1.0.0');
			osInfo = await invoke<string>('get_os_info').catch(() => navigator.userAgent);

			// Load stored crash reports
			await loadStoredReports();

			// Set up error handlers
			setupErrorHandlers();

			// Set up breadcrumb collection
			if (mergedConfig.collectBreadcrumbs) {
				setupBreadcrumbCollection();
			}

			// Listen for Tauri panic events
			const panicUnlisten = await listen('tauri://panic', (event) => {
				handlePanic(event.payload as string);
			});
			unlisteners.push(panicUnlisten);

			// Listen for backend crash reports
			const crashUnlisten = await listen<CrashReport>('crash-report', (event) => {
				addCrashReport(event.payload);
			});
			unlisteners.push(crashUnlisten);
		} catch (error) {
			console.error('Failed to initialize crash reporter:', error);
		}
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
		removeErrorHandlers();
	});

	// Error handlers
	let originalOnError: OnErrorEventHandler | null = null;
	let originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;

	function setupErrorHandlers(): void {
		// Global error handler
		originalOnError = window.onerror;
		window.onerror = (message, source, lineno, colno, error) => {
			handleError({
				type: 'error',
				message: String(message),
				stack: error?.stack,
				source,
				lineno,
				colno
			});

			if (originalOnError) {
				return originalOnError.call(window, message, source, lineno, colno, error);
			}
			return false;
		};

		// Unhandled rejection handler
		originalOnUnhandledRejection = window.onunhandledrejection?.bind(window) ?? null;
		window.onunhandledrejection = (event: PromiseRejectionEvent) => {
			handleError({
				type: 'unhandled_rejection',
				message: event.reason?.message || String(event.reason),
				stack: event.reason?.stack
			});

			if (originalOnUnhandledRejection) {
				originalOnUnhandledRejection(event);
			}
		};
	}

	function removeErrorHandlers(): void {
		if (originalOnError !== null) {
			window.onerror = originalOnError;
		}
		if (originalOnUnhandledRejection !== null) {
			window.onunhandledrejection = originalOnUnhandledRejection;
		}
	}

	function setupBreadcrumbCollection(): void {
		// Navigation breadcrumbs
		window.addEventListener('popstate', () => {
			addBreadcrumb({
				category: 'navigation',
				message: `Navigated to ${window.location.pathname}`
			});
		});

		// Click breadcrumbs
		document.addEventListener(
			'click',
			(event) => {
				const target = event.target as HTMLElement;
				const selector = getElementSelector(target);
				addBreadcrumb({
					category: 'action',
					message: `Clicked ${selector}`,
					data: {
						tagName: target.tagName,
						className: target.className,
						id: target.id
					}
				});
			},
			true
		);

		// Console breadcrumbs
		const originalConsoleError = console.error;
		console.error = (...args) => {
			addBreadcrumb({
				category: 'console',
				message: args.map((a) => String(a)).join(' ')
			});
			originalConsoleError.apply(console, args);
		};

		// Network breadcrumbs (fetch)
		const originalFetch = window.fetch;
		window.fetch = async (...args) => {
			const url = typeof args[0] === 'string' ? args[0] : args[0].url;
			const startTime = Date.now();

			try {
				const response = await originalFetch.apply(window, args);
				addBreadcrumb({
					category: 'network',
					message: `${response.ok ? '✓' : '✗'} ${args[1]?.method || 'GET'} ${url}`,
					data: {
						status: response.status,
						duration: Date.now() - startTime
					}
				});
				return response;
			} catch (error) {
				addBreadcrumb({
					category: 'network',
					message: `✗ ${args[1]?.method || 'GET'} ${url} - ${error}`,
					data: { duration: Date.now() - startTime }
				});
				throw error;
			}
		};
	}

	function getElementSelector(element: HTMLElement): string {
		if (element.id) return `#${element.id}`;
		if (element.className) {
			const classes = element.className.split(' ').filter(Boolean).slice(0, 2).join('.');
			return `${element.tagName.toLowerCase()}.${classes}`;
		}
		return element.tagName.toLowerCase();
	}

	// Breadcrumb management
	function addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
		breadcrumbs.update((crumbs) => {
			const newCrumb: Breadcrumb = {
				...crumb,
				timestamp: Date.now()
			};
			const updated = [...crumbs, newCrumb];
			return updated.slice(-mergedConfig.maxBreadcrumbs);
		});
	}

	// Error handling
	interface ErrorInfo {
		type: 'error' | 'unhandled_rejection';
		message: string;
		stack?: string;
		source?: string;
		lineno?: number;
		colno?: number;
	}

	function handleError(errorInfo: ErrorInfo): void {
		const report = createCrashReport(
			errorInfo.type,
			errorInfo.message,
			errorInfo.stack
		);
		addCrashReport(report);
	}

	function handlePanic(message: string): void {
		const report = createCrashReport('panic', message);
		addCrashReport(report);
	}

	function createCrashReport(
		type: CrashReport['type'],
		message: string,
		stack?: string,
		componentStack?: string
	): CrashReport {
		let memoryUsage: MemoryInfo | undefined;
		if ('memory' in performance) {
			const memory = (performance as Performance & { memory: MemoryInfo }).memory;
			memoryUsage = {
				usedJSHeapSize: memory.usedJSHeapSize,
				totalJSHeapSize: memory.totalJSHeapSize,
				jsHeapSizeLimit: memory.jsHeapSizeLimit
			};
		}

		let currentBreadcrumbs: Breadcrumb[] = [];
		breadcrumbs.subscribe((b) => (currentBreadcrumbs = b))();

		const report: CrashReport = {
			id: generateId(),
			timestamp: Date.now(),
			type,
			message: mergedConfig.anonymizeData ? anonymizeMessage(message) : message,
			stack: stack ? (mergedConfig.anonymizeData ? anonymizeStack(stack) : stack) : undefined,
			componentStack,
			userAgent: navigator.userAgent,
			appVersion,
			osInfo,
			memoryUsage,
			breadcrumbs: currentBreadcrumbs,
			submitted: false
		};

		return report;
	}

	function generateId(): string {
		return `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	function anonymizeMessage(message: string): string {
		// Remove potential PII (emails, IPs, paths with usernames)
		return message
			.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
			.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
			.replace(/\/Users\/[^/]+\//g, '/Users/[USER]/')
			.replace(/\/home\/[^/]+\//g, '/home/[USER]/')
			.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\[USER]\\');
	}

	function anonymizeStack(stack: string): string {
		return stack
			.split('\n')
			.map((line) => anonymizeMessage(line))
			.join('\n');
	}

	// Crash report management
	async function addCrashReport(report: CrashReport): Promise<void> {
		crashReports.update((reports) => [...reports, report]);
		await saveReport(report);

		// Show dialog for critical errors
		if (report.type === 'panic' || report.type === 'oom') {
			currentCrash.set(report);
			showCrashDialog.set(true);
		}

		// Auto-submit if enabled
		if (mergedConfig.autoSubmit && mergedConfig.submissionEndpoint) {
			await submitReport(report);
		}
	}

	async function saveReport(report: CrashReport): Promise<void> {
		try {
			await invoke('save_crash_report', { report: JSON.stringify(report) });
		} catch (error) {
			console.error('Failed to save crash report:', error);
			// Fallback to localStorage
			localStorage.setItem(`crash_${report.id}`, JSON.stringify(report));
		}
	}

	async function loadStoredReports(): Promise<void> {
		try {
			const stored = await invoke<string>('get_crash_reports');
			const reports = JSON.parse(stored) as CrashReport[];
			crashReports.set(reports);
		} catch {
			// Load from localStorage fallback
			const reports: CrashReport[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith('crash_')) {
					try {
						const report = JSON.parse(localStorage.getItem(key) || '');
						reports.push(report);
					} catch {
						// Ignore invalid entries
					}
				}
			}
			crashReports.set(reports);
		}
	}

	async function submitReport(report: CrashReport): Promise<boolean> {
		if (!mergedConfig.submissionEndpoint) return false;

		isSubmitting.set(true);
		submissionError.set(null);

		try {
			const response = await fetch(mergedConfig.submissionEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(report)
			});

			if (!response.ok) {
				throw new Error(`Submission failed: ${response.status}`);
			}

			// Mark as submitted
			crashReports.update((reports) =>
				reports.map((r) =>
					r.id === report.id ? { ...r, submitted: true, submittedAt: Date.now() } : r
				)
			);

			return true;
		} catch (error) {
			submissionError.set(error instanceof Error ? error.message : 'Unknown error');
			return false;
		} finally {
			isSubmitting.set(false);
		}
	}

	async function deleteReport(reportId: string): Promise<void> {
		crashReports.update((reports) => reports.filter((r) => r.id !== reportId));

		try {
			await invoke('delete_crash_report', { reportId });
		} catch {
			localStorage.removeItem(`crash_${reportId}`);
		}
	}

	async function clearAllReports(): Promise<void> {
		const currentReports = $crashReports;

		for (const report of currentReports) {
			await deleteReport(report.id);
		}
	}

	function copyReportToClipboard(report: CrashReport): void {
		const text = formatReportForCopy(report);
		navigator.clipboard.writeText(text);
	}

	function formatReportForCopy(report: CrashReport): string {
		return `
## Crash Report
**ID:** ${report.id}
**Time:** ${new Date(report.timestamp).toISOString()}
**Type:** ${report.type}
**App Version:** ${report.appVersion}
**OS:** ${report.osInfo}

### Error
${report.message}

${report.stack ? `### Stack Trace\n\`\`\`\n${report.stack}\n\`\`\`` : ''}

${
	report.memoryUsage
		? `### Memory
- Used: ${formatBytes(report.memoryUsage.usedJSHeapSize)}
- Total: ${formatBytes(report.memoryUsage.totalJSHeapSize)}
- Limit: ${formatBytes(report.memoryUsage.jsHeapSizeLimit)}`
		: ''
}

### Breadcrumbs
${report.breadcrumbs.map((b) => `- [${new Date(b.timestamp).toISOString()}] [${b.category}] ${b.message}`).join('\n')}
`.trim();
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function formatTimestamp(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}

	function getTypeIcon(type: CrashReport['type']): string {
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
	}

	function getTypeLabel(type: CrashReport['type']): string {
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
	}

	// View state
	let selectedReport: CrashReport | null = null;
	let showReportList = false;

	function selectReport(report: CrashReport): void {
		selectedReport = report;
	}

	function closeCrashDialog(): void {
		showCrashDialog.set(false);
		currentCrash.set(null);
	}
</script>

<!-- Crash Dialog (shown for critical crashes) -->
{#if $showCrashDialog && $currentCrash}
	<div
		class="crash-overlay"
		transition:fade={{ duration: 200 }}
		on:click|self={closeCrashDialog}
		on:keydown={(e) => e.key === 'Escape' && closeCrashDialog()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="crash-dialog-title"
	>
		<div class="crash-dialog" transition:fly={{ y: 20, duration: 300 }}>
			<div class="crash-header">
				<span class="crash-icon">💥</span>
				<h2 id="crash-dialog-title">Application Error</h2>
			</div>

			<div class="crash-content">
				<p class="crash-message">
					An unexpected error occurred. We apologize for the inconvenience.
				</p>

				<div class="crash-details">
					<div class="detail-row">
						<span class="detail-label">Error Type:</span>
						<span class="detail-value">{getTypeLabel($currentCrash.type)}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">Time:</span>
						<span class="detail-value">{formatTimestamp($currentCrash.timestamp)}</span>
					</div>
					<div class="detail-row">
						<span class="detail-label">Message:</span>
						<span class="detail-value error-message">{$currentCrash.message}</span>
					</div>
				</div>

				{#if $currentCrash.stack}
					<details class="stack-trace">
						<summary>Stack Trace</summary>
						<pre>{$currentCrash.stack}</pre>
					</details>
				{/if}

				{#if $submissionError}
					<div class="submission-error">
						Failed to submit report: {$submissionError}
					</div>
				{/if}
			</div>

			<div class="crash-actions">
				<button class="btn-secondary" on:click={() => copyReportToClipboard($currentCrash)}>
					📋 Copy Report
				</button>

				{#if mergedConfig.submissionEndpoint && !$currentCrash.submitted}
					<button
						class="btn-primary"
						on:click={() => submitReport($currentCrash)}
						disabled={$isSubmitting}
					>
						{#if $isSubmitting}
							Submitting...
						{:else}
							📤 Submit Report
						{/if}
					</button>
				{/if}

				<button class="btn-close" on:click={closeCrashDialog}>
					Continue
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Crash Reports Panel (optional, for viewing history) -->
{#if showReportList}
	<div class="reports-panel" transition:fly={{ x: 300, duration: 200 }}>
		<div class="panel-header">
			<h3>Crash Reports</h3>
			<div class="header-actions">
				{#if $unsubmittedCount > 0}
					<span class="badge">{$unsubmittedCount} unsubmitted</span>
				{/if}
				<button class="btn-icon" on:click={() => (showReportList = false)} aria-label="Close">
					✕
				</button>
			</div>
		</div>

		<div class="reports-list">
			{#if $recentCrashes.length === 0}
				<div class="empty-state">
					<span class="empty-icon">✨</span>
					<p>No crash reports</p>
				</div>
			{:else}
				{#each $recentCrashes as report (report.id)}
					<button
						class="report-item"
						class:selected={selectedReport?.id === report.id}
						on:click={() => selectReport(report)}
					>
						<span class="report-icon">{getTypeIcon(report.type)}</span>
						<div class="report-info">
							<span class="report-type">{getTypeLabel(report.type)}</span>
							<span class="report-time">{formatTimestamp(report.timestamp)}</span>
							<span class="report-message">{report.message.slice(0, 50)}...</span>
						</div>
						{#if report.submitted}
							<span class="submitted-badge" title="Report submitted">✓</span>
						{/if}
					</button>
				{/each}
			{/if}
		</div>

		{#if selectedReport}
			<div class="report-detail">
				<div class="detail-header">
					<h4>{getTypeLabel(selectedReport.type)}</h4>
					<div class="detail-actions">
						<button
							class="btn-icon"
							on:click={() => copyReportToClipboard(selectedReport)}
							title="Copy report"
						>
							📋
						</button>
						<button
							class="btn-icon danger"
							on:click={() => {
								deleteReport(selectedReport.id);
								selectedReport = null;
							}}
							title="Delete report"
						>
							🗑️
						</button>
					</div>
				</div>

				<div class="detail-content">
					<p class="detail-message">{selectedReport.message}</p>

					{#if selectedReport.stack}
						<details open>
							<summary>Stack Trace</summary>
							<pre class="stack">{selectedReport.stack}</pre>
						</details>
					{/if}

					{#if selectedReport.breadcrumbs.length > 0}
						<details>
							<summary>Breadcrumbs ({selectedReport.breadcrumbs.length})</summary>
							<div class="breadcrumbs">
								{#each selectedReport.breadcrumbs as crumb}
									<div class="breadcrumb">
										<span class="crumb-category">[{crumb.category}]</span>
										<span class="crumb-message">{crumb.message}</span>
									</div>
								{/each}
							</div>
						</details>
					{/if}

					{#if selectedReport.memoryUsage}
						<details>
							<summary>Memory Usage</summary>
							<div class="memory-info">
								<div>Used: {formatBytes(selectedReport.memoryUsage.usedJSHeapSize)}</div>
								<div>Total: {formatBytes(selectedReport.memoryUsage.totalJSHeapSize)}</div>
								<div>Limit: {formatBytes(selectedReport.memoryUsage.jsHeapSizeLimit)}</div>
							</div>
						</details>
					{/if}
				</div>
			</div>
		{/if}

		<div class="panel-footer">
			<button class="btn-danger" on:click={clearAllReports} disabled={$crashReports.length === 0}>
				Clear All Reports
			</button>
		</div>
	</div>
{/if}

<!-- Toggle button (always visible) -->
<button
	class="crash-reporter-toggle"
	class:has-unsubmitted={$unsubmittedCount > 0}
	on:click={() => (showReportList = !showReportList)}
	title="Crash Reports"
	aria-label="Toggle crash reports panel"
>
	🐛
	{#if $unsubmittedCount > 0}
		<span class="toggle-badge">{$unsubmittedCount}</span>
	{/if}
</button>

<style>
	/* Crash Dialog Overlay */
	.crash-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		backdrop-filter: blur(4px);
	}

	.crash-dialog {
		background: var(--bg-primary, #1e1e2e);
		border-radius: 12px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
	}

	.crash-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px 24px;
		background: var(--bg-danger, #f38ba8);
		color: var(--text-on-danger, #1e1e2e);
	}

	.crash-icon {
		font-size: 32px;
	}

	.crash-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}

	.crash-content {
		padding: 24px;
		overflow-y: auto;
		max-height: 400px;
	}

	.crash-message {
		margin: 0 0 16px;
		color: var(--text-secondary, #a6adc8);
	}

	.crash-details {
		background: var(--bg-secondary, #313244);
		border-radius: 8px;
		padding: 12px;
	}

	.detail-row {
		display: flex;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border-color, #45475a);
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-label {
		color: var(--text-muted, #6c7086);
		min-width: 100px;
	}

	.detail-value {
		color: var(--text-primary, #cdd6f4);
		flex: 1;
	}

	.error-message {
		font-family: monospace;
		word-break: break-all;
	}

	.stack-trace {
		margin-top: 16px;
	}

	.stack-trace summary {
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		padding: 8px 0;
	}

	.stack-trace pre {
		background: var(--bg-tertiary, #11111b);
		padding: 12px;
		border-radius: 6px;
		overflow-x: auto;
		font-size: 12px;
		color: var(--text-primary, #cdd6f4);
	}

	.submission-error {
		margin-top: 16px;
		padding: 12px;
		background: rgba(243, 139, 168, 0.2);
		border: 1px solid var(--bg-danger, #f38ba8);
		border-radius: 6px;
		color: var(--bg-danger, #f38ba8);
	}

	.crash-actions {
		display: flex;
		gap: 12px;
		padding: 16px 24px;
		background: var(--bg-secondary, #313244);
		justify-content: flex-end;
	}

	/* Buttons */
	button {
		cursor: pointer;
		border: none;
		border-radius: 6px;
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn-primary {
		background: var(--accent-color, #89b4fa);
		color: var(--text-on-accent, #1e1e2e);
	}

	.btn-primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.btn-secondary:hover {
		background: var(--bg-hover, #585b70);
	}

	.btn-close {
		background: transparent;
		color: var(--text-secondary, #a6adc8);
	}

	.btn-close:hover {
		color: var(--text-primary, #cdd6f4);
	}

	.btn-danger {
		background: var(--bg-danger, #f38ba8);
		color: var(--text-on-danger, #1e1e2e);
	}

	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-icon {
		background: transparent;
		padding: 6px;
		font-size: 16px;
	}

	.btn-icon.danger:hover {
		color: var(--bg-danger, #f38ba8);
	}

	/* Reports Panel */
	.reports-panel {
		position: fixed;
		right: 0;
		top: 0;
		bottom: 0;
		width: 400px;
		background: var(--bg-primary, #1e1e2e);
		border-left: 1px solid var(--border-color, #45475a);
		display: flex;
		flex-direction: column;
		z-index: 9999;
		box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--border-color, #45475a);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		color: var(--text-primary, #cdd6f4);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.badge {
		background: var(--accent-color, #89b4fa);
		color: var(--text-on-accent, #1e1e2e);
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 12px;
	}

	.reports-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: var(--text-muted, #6c7086);
	}

	.empty-icon {
		font-size: 48px;
		margin-bottom: 12px;
	}

	.report-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		width: 100%;
		padding: 12px;
		background: var(--bg-secondary, #313244);
		border-radius: 8px;
		margin-bottom: 8px;
		text-align: left;
	}

	.report-item:hover {
		background: var(--bg-hover, #45475a);
	}

	.report-item.selected {
		outline: 2px solid var(--accent-color, #89b4fa);
	}

	.report-icon {
		font-size: 20px;
	}

	.report-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.report-type {
		font-weight: 500;
		color: var(--text-primary, #cdd6f4);
	}

	.report-time {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}

	.report-message {
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.submitted-badge {
		color: var(--color-success, #a6e3a1);
		font-size: 16px;
	}

	.report-detail {
		border-top: 1px solid var(--border-color, #45475a);
		padding: 16px;
		max-height: 300px;
		overflow-y: auto;
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.detail-header h4 {
		margin: 0;
		color: var(--text-primary, #cdd6f4);
	}

	.detail-actions {
		display: flex;
		gap: 4px;
	}

	.detail-content details {
		margin-top: 12px;
	}

	.detail-content summary {
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		padding: 4px 0;
	}

	.detail-message {
		font-family: monospace;
		font-size: 13px;
		color: var(--text-primary, #cdd6f4);
		word-break: break-word;
	}

	.stack {
		font-size: 11px;
		background: var(--bg-tertiary, #11111b);
		padding: 8px;
		border-radius: 4px;
		overflow-x: auto;
	}

	.breadcrumbs {
		max-height: 150px;
		overflow-y: auto;
		font-size: 11px;
	}

	.breadcrumb {
		padding: 4px 0;
		border-bottom: 1px solid var(--border-color, #45475a);
	}

	.crumb-category {
		color: var(--accent-color, #89b4fa);
		margin-right: 8px;
	}

	.crumb-message {
		color: var(--text-secondary, #a6adc8);
	}

	.memory-info {
		font-family: monospace;
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
	}

	.panel-footer {
		padding: 12px 16px;
		border-top: 1px solid var(--border-color, #45475a);
	}

	/* Toggle Button */
	.crash-reporter-toggle {
		position: fixed;
		bottom: 80px;
		right: 20px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--bg-secondary, #313244);
		border: 1px solid var(--border-color, #45475a);
		font-size: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9998;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		transition: all 0.2s;
	}

	.crash-reporter-toggle:hover {
		background: var(--bg-hover, #45475a);
		transform: scale(1.05);
	}

	.crash-reporter-toggle.has-unsubmitted {
		background: var(--bg-warning, #f9e2af);
	}

	.toggle-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		background: var(--bg-danger, #f38ba8);
		color: var(--text-on-danger, #1e1e2e);
		font-size: 10px;
		font-weight: bold;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 16px;
		text-align: center;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.reports-panel {
			width: 100%;
		}

		.crash-dialog {
			width: 95%;
			max-height: 90vh;
		}
	}
</style>
