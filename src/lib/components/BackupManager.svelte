<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { invoke } from '@tauri-apps/api/core';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { writeTextFile, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

	export let compact = false;
	export let showSchedule = true;

	interface BackupMetadata {
		version: string;
		created_at: string;
		app_version: string;
		platform: string;
		categories: string[];
	}

	interface BackupData {
		metadata: BackupMetadata;
		settings: Record<string, unknown>;
		themes: Record<string, unknown>;
		shortcuts: Record<string, unknown>;
		layouts: Record<string, unknown>;
	}

	interface ScheduledBackup {
		enabled: boolean;
		frequency: 'daily' | 'weekly' | 'monthly';
		last_backup: string | null;
		next_backup: string | null;
		keep_count: number;
	}

	let loading = true;
	let exporting = false;
	let importing = false;
	let error: string | null = null;
	let success: string | null = null;
	let backupHistory: BackupMetadata[] = [];
	let schedule: ScheduledBackup = {
		enabled: false,
		frequency: 'weekly',
		last_backup: null,
		next_backup: null,
		keep_count: 5
	};

	// Export options
	let exportSettings = true;
	let exportThemes = true;
	let exportShortcuts = true;
	let exportLayouts = true;

	// Import preview
	let importPreview: BackupData | null = null;
	let showImportConfirm = false;

	$: selectedCategories = [
		exportSettings && 'settings',
		exportThemes && 'themes',
		exportShortcuts && 'shortcuts',
		exportLayouts && 'layouts'
	].filter(Boolean) as string[];

	onMount(async () => {
		await loadBackupHistory();
		await loadSchedule();
		loading = false;
	});

	async function loadBackupHistory(): Promise<void> {
		try {
			backupHistory = await invoke<BackupMetadata[]>('get_backup_history');
		} catch (e) {
			console.warn('Failed to load backup history:', e);
			backupHistory = [];
		}
	}

	async function loadSchedule(): Promise<void> {
		try {
			schedule = await invoke<ScheduledBackup>('get_backup_schedule');
		} catch (e) {
			console.warn('Failed to load backup schedule:', e);
		}
	}

	async function exportBackup(): Promise<void> {
		if (selectedCategories.length === 0) {
			error = 'Please select at least one category to export';
			return;
		}

		exporting = true;
		error = null;
		success = null;

		try {
			// Gather data from each selected category
			const backupData: BackupData = {
				metadata: {
					version: '1.0',
					created_at: new Date().toISOString(),
					app_version: await invoke<string>('get_app_version'),
					platform: await invoke<string>('get_platform'),
					categories: selectedCategories
				},
				settings: exportSettings ? await invoke<Record<string, unknown>>('export_settings') : {},
				themes: exportThemes ? await invoke<Record<string, unknown>>('export_themes') : {},
				shortcuts: exportShortcuts ? await invoke<Record<string, unknown>>('export_shortcuts') : {},
				layouts: exportLayouts ? await invoke<Record<string, unknown>>('export_layouts') : {}
			};

			// Prompt for save location
			const filePath = await save({
				defaultPath: `hearth-backup-${formatDate(new Date())}.json`,
				filters: [
					{ name: 'Hearth Backup', extensions: ['json'] },
					{ name: 'All Files', extensions: ['*'] }
				]
			});

			if (filePath) {
				await writeTextFile(filePath, JSON.stringify(backupData, null, 2));
				
				// Register in backup history
				await invoke('register_backup', { metadata: backupData.metadata });
				await loadBackupHistory();
				
				success = `Backup saved successfully to ${filePath}`;
			}
		} catch (e) {
			error = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			exporting = false;
		}
	}

	async function selectImportFile(): Promise<void> {
		error = null;
		success = null;

		try {
			const filePath = await open({
				multiple: false,
				filters: [
					{ name: 'Hearth Backup', extensions: ['json'] },
					{ name: 'All Files', extensions: ['*'] }
				]
			});

			if (filePath && typeof filePath === 'string') {
				const content = await readTextFile(filePath);
				const data = JSON.parse(content) as BackupData;
				
				// Validate backup format
				if (!data.metadata?.version || !data.metadata?.created_at) {
					throw new Error('Invalid backup file format');
				}

				importPreview = data;
				showImportConfirm = true;
			}
		} catch (e) {
			error = `Failed to read backup file: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	async function confirmImport(): Promise<void> {
		if (!importPreview) return;

		importing = true;
		error = null;
		showImportConfirm = false;

		try {
			// Import each category that exists in the backup
			if (Object.keys(importPreview.settings).length > 0) {
				await invoke('import_settings', { data: importPreview.settings });
			}
			if (Object.keys(importPreview.themes).length > 0) {
				await invoke('import_themes', { data: importPreview.themes });
			}
			if (Object.keys(importPreview.shortcuts).length > 0) {
				await invoke('import_shortcuts', { data: importPreview.shortcuts });
			}
			if (Object.keys(importPreview.layouts).length > 0) {
				await invoke('import_layouts', { data: importPreview.layouts });
			}

			success = 'Backup restored successfully! Some changes may require a restart.';
			importPreview = null;
		} catch (e) {
			error = `Import failed: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			importing = false;
		}
	}

	function cancelImport(): void {
		showImportConfirm = false;
		importPreview = null;
	}

	async function updateSchedule(): Promise<void> {
		try {
			await invoke('set_backup_schedule', { schedule });
			success = 'Backup schedule updated';
			setTimeout(() => success = null, 3000);
		} catch (e) {
			error = `Failed to update schedule: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	async function runScheduledBackup(): Promise<void> {
		exporting = true;
		error = null;

		try {
			await invoke('run_scheduled_backup');
			await loadBackupHistory();
			await loadSchedule();
			success = 'Scheduled backup completed';
		} catch (e) {
			error = `Backup failed: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			exporting = false;
		}
	}

	async function deleteBackup(metadata: BackupMetadata): Promise<void> {
		try {
			await invoke('delete_backup', { createdAt: metadata.created_at });
			await loadBackupHistory();
			success = 'Backup deleted';
			setTimeout(() => success = null, 3000);
		} catch (e) {
			error = `Failed to delete backup: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return d.toISOString().split('T')[0];
	}

	function formatDateTime(date: string): string {
		return new Date(date).toLocaleString();
	}

	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'settings': return '⚙️';
			case 'themes': return '🎨';
			case 'shortcuts': return '⌨️';
			case 'layouts': return '📐';
			default: return '📁';
		}
	}
</script>

<div class="backup-manager" class:compact transition:fade={{ duration: 200 }}>
	<div class="header">
		<h3>
			<span class="icon">💾</span>
			Backup & Restore
		</h3>
		<p class="description">Export and import your settings, themes, and preferences</p>
	</div>

	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<span>Loading backup information...</span>
		</div>
	{:else}
		{#if error}
			<div class="alert error" transition:slide={{ duration: 200 }}>
				<span class="alert-icon">❌</span>
				<span>{error}</span>
				<button class="dismiss" on:click={() => error = null}>×</button>
			</div>
		{/if}

		{#if success}
			<div class="alert success" transition:slide={{ duration: 200 }}>
				<span class="alert-icon">✅</span>
				<span>{success}</span>
				<button class="dismiss" on:click={() => success = null}>×</button>
			</div>
		{/if}

		<!-- Export Section -->
		<section class="section">
			<h4>Export Backup</h4>
			<div class="export-options">
				<label class="checkbox-option">
					<input type="checkbox" bind:checked={exportSettings} />
					<span class="icon">⚙️</span>
					<span class="label">Settings & Preferences</span>
				</label>
				<label class="checkbox-option">
					<input type="checkbox" bind:checked={exportThemes} />
					<span class="icon">🎨</span>
					<span class="label">Custom Themes</span>
				</label>
				<label class="checkbox-option">
					<input type="checkbox" bind:checked={exportShortcuts} />
					<span class="icon">⌨️</span>
					<span class="label">Keyboard Shortcuts</span>
				</label>
				<label class="checkbox-option">
					<input type="checkbox" bind:checked={exportLayouts} />
					<span class="icon">📐</span>
					<span class="label">Window Layouts</span>
				</label>
			</div>
			<button 
				class="primary-button"
				on:click={exportBackup}
				disabled={exporting || selectedCategories.length === 0}
			>
				{#if exporting}
					<span class="spinner small"></span>
					Exporting...
				{:else}
					<span class="icon">📤</span>
					Export Backup
				{/if}
			</button>
		</section>

		<!-- Import Section -->
		<section class="section">
			<h4>Import Backup</h4>
			<p class="hint">Select a previously exported backup file to restore your settings</p>
			<button 
				class="secondary-button"
				on:click={selectImportFile}
				disabled={importing}
			>
				{#if importing}
					<span class="spinner small"></span>
					Importing...
				{:else}
					<span class="icon">📥</span>
					Select Backup File
				{/if}
			</button>
		</section>

		<!-- Import Confirmation Modal -->
		{#if showImportConfirm && importPreview}
			<div class="modal-overlay" transition:fade={{ duration: 150 }}>
				<div class="modal" transition:slide={{ duration: 200 }}>
					<h4>Confirm Import</h4>
					<div class="import-preview">
						<div class="preview-item">
							<span class="label">Created:</span>
							<span class="value">{formatDateTime(importPreview.metadata.created_at)}</span>
						</div>
						<div class="preview-item">
							<span class="label">App Version:</span>
							<span class="value">{importPreview.metadata.app_version}</span>
						</div>
						<div class="preview-item">
							<span class="label">Platform:</span>
							<span class="value">{importPreview.metadata.platform}</span>
						</div>
						<div class="preview-item">
							<span class="label">Includes:</span>
							<span class="value categories">
								{#each importPreview.metadata.categories as category}
									<span class="category-tag">
										{getCategoryIcon(category)} {category}
									</span>
								{/each}
							</span>
						</div>
					</div>
					<p class="warning">
						⚠️ This will overwrite your current settings. This action cannot be undone.
					</p>
					<div class="modal-actions">
						<button class="secondary-button" on:click={cancelImport}>Cancel</button>
						<button class="danger-button" on:click={confirmImport}>
							<span class="icon">📥</span>
							Restore Backup
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Scheduled Backups -->
		{#if showSchedule && !compact}
			<section class="section">
				<h4>Automatic Backups</h4>
				<div class="schedule-options">
					<label class="checkbox-option">
						<input type="checkbox" bind:checked={schedule.enabled} on:change={updateSchedule} />
						<span class="label">Enable automatic backups</span>
					</label>
					
					{#if schedule.enabled}
						<div class="schedule-config" transition:slide={{ duration: 200 }}>
							<div class="config-row">
								<label for="frequency">Frequency:</label>
								<select id="frequency" bind:value={schedule.frequency} on:change={updateSchedule}>
									<option value="daily">Daily</option>
									<option value="weekly">Weekly</option>
									<option value="monthly">Monthly</option>
								</select>
							</div>
							<div class="config-row">
								<label for="keep-count">Keep backups:</label>
								<select id="keep-count" bind:value={schedule.keep_count} on:change={updateSchedule}>
									<option value={3}>Last 3</option>
									<option value={5}>Last 5</option>
									<option value={10}>Last 10</option>
									<option value={20}>Last 20</option>
								</select>
							</div>
							{#if schedule.last_backup}
								<div class="schedule-info">
									<span class="label">Last backup:</span>
									<span class="value">{formatDateTime(schedule.last_backup)}</span>
								</div>
							{/if}
							{#if schedule.next_backup}
								<div class="schedule-info">
									<span class="label">Next backup:</span>
									<span class="value">{formatDateTime(schedule.next_backup)}</span>
								</div>
							{/if}
							<button 
								class="secondary-button small"
								on:click={runScheduledBackup}
								disabled={exporting}
							>
								Run Backup Now
							</button>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Backup History -->
		{#if backupHistory.length > 0 && !compact}
			<section class="section">
				<h4>Backup History</h4>
				<div class="history-list">
					{#each backupHistory as backup}
						<div class="history-item" transition:slide={{ duration: 150 }}>
							<div class="history-info">
								<span class="date">{formatDateTime(backup.created_at)}</span>
								<span class="categories">
									{#each backup.categories as category}
										<span class="mini-tag">{getCategoryIcon(category)}</span>
									{/each}
								</span>
							</div>
							<div class="history-meta">
								<span class="version">v{backup.app_version}</span>
								<span class="platform">{backup.platform}</span>
							</div>
							<button 
								class="icon-button danger"
								on:click={() => deleteBackup(backup)}
								title="Delete backup"
							>
								🗑️
							</button>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</div>

<style>
	.backup-manager {
		padding: 1.5rem;
		background: var(--background-secondary, #2f3136);
		border-radius: 8px;
		color: var(--text-normal, #dcddde);
	}

	.backup-manager.compact {
		padding: 1rem;
	}

	.header h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.25rem 0;
		font-size: 1.25rem;
		color: var(--header-primary, #fff);
	}

	.header .icon {
		font-size: 1.5rem;
	}

	.header .description {
		margin: 0;
		color: var(--text-muted, #72767d);
		font-size: 0.875rem;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 2rem;
		color: var(--text-muted, #72767d);
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid var(--background-modifier-accent, #4f545c);
		border-top-color: var(--brand-experiment, #5865f2);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner.small {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.alert {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin: 1rem 0;
	}

	.alert.error {
		background: rgba(237, 66, 69, 0.15);
		border: 1px solid var(--status-danger, #ed4245);
	}

	.alert.success {
		background: rgba(59, 165, 92, 0.15);
		border: 1px solid var(--status-positive, #3ba55c);
	}

	.alert .dismiss {
		margin-left: auto;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 1.25rem;
		opacity: 0.7;
	}

	.alert .dismiss:hover {
		opacity: 1;
	}

	.section {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--background-modifier-accent, #4f545c);
	}

	.section:first-of-type {
		margin-top: 1rem;
		padding-top: 0;
		border-top: none;
	}

	.section h4 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: var(--header-secondary, #b9bbbe);
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.section .hint {
		margin: 0 0 1rem 0;
		color: var(--text-muted, #72767d);
		font-size: 0.875rem;
	}

	.export-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: var(--background-tertiary, #202225);
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.checkbox-option:hover {
		background: var(--background-modifier-hover, #32353b);
	}

	.checkbox-option input[type="checkbox"] {
		width: 18px;
		height: 18px;
		accent-color: var(--brand-experiment, #5865f2);
	}

	.checkbox-option .icon {
		font-size: 1.25rem;
	}

	.checkbox-option .label {
		flex: 1;
	}

	.primary-button,
	.secondary-button,
	.danger-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.primary-button {
		background: var(--brand-experiment, #5865f2);
		color: white;
	}

	.primary-button:hover:not(:disabled) {
		background: var(--brand-experiment-560, #4752c4);
	}

	.secondary-button {
		background: var(--background-tertiary, #202225);
		color: var(--text-normal, #dcddde);
	}

	.secondary-button:hover:not(:disabled) {
		background: var(--background-modifier-hover, #32353b);
	}

	.danger-button {
		background: var(--status-danger, #ed4245);
		color: white;
	}

	.danger-button:hover:not(:disabled) {
		background: #d93235;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	button.small {
		padding: 0.5rem 1rem;
		font-size: 0.8125rem;
	}

	.icon-button {
		background: none;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.icon-button:hover {
		opacity: 1;
	}

	.icon-button.danger:hover {
		color: var(--status-danger, #ed4245);
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--background-primary, #36393f);
		border-radius: 8px;
		padding: 1.5rem;
		max-width: 480px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.modal h4 {
		margin: 0 0 1rem 0;
		color: var(--header-primary, #fff);
	}

	.import-preview {
		background: var(--background-secondary, #2f3136);
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.preview-item,
	.schedule-info {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--background-modifier-accent, #4f545c);
	}

	.preview-item:last-child,
	.schedule-info:last-of-type {
		border-bottom: none;
	}

	.preview-item .label,
	.schedule-info .label {
		color: var(--text-muted, #72767d);
		font-size: 0.875rem;
	}

	.preview-item .value,
	.schedule-info .value {
		text-align: right;
	}

	.preview-item .categories {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.category-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: var(--background-tertiary, #202225);
		border-radius: 4px;
		font-size: 0.8125rem;
	}

	.warning {
		padding: 0.75rem;
		background: rgba(250, 166, 26, 0.15);
		border-radius: 6px;
		color: var(--text-warning, #faa61a);
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.schedule-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.schedule-config {
		padding: 1rem;
		background: var(--background-tertiary, #202225);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.config-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.config-row label {
		color: var(--text-muted, #72767d);
	}

	.config-row select {
		padding: 0.5rem;
		background: var(--background-secondary, #2f3136);
		border: 1px solid var(--background-modifier-accent, #4f545c);
		border-radius: 4px;
		color: var(--text-normal, #dcddde);
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--background-tertiary, #202225);
		border-radius: 6px;
	}

	.history-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.history-info .date {
		font-size: 0.875rem;
	}

	.history-info .categories {
		display: flex;
		gap: 0.25rem;
	}

	.mini-tag {
		font-size: 0.875rem;
	}

	.history-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted, #72767d);
	}
</style>
