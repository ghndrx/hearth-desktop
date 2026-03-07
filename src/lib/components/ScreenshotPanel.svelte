<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import { onMount } from 'svelte';

	type CaptureMode = 'fullscreen' | 'window' | 'region';

	let mode: CaptureMode = $state('fullscreen');
	let capturing = $state(false);
	let lastCapture = $state<string | null>(null);
	let screenshots = $state<string[]>([]);
	let error = $state<string | null>(null);
	let screenshotsDir = $state('');

	onMount(async () => {
		await loadScreenshots();
		try {
			screenshotsDir = await invoke<string>('get_screenshots_dir');
		} catch { /* ignore */ }
	});

	async function capture() {
		capturing = true;
		error = null;
		try {
			let result: string;
			switch (mode) {
				case 'fullscreen':
					result = await invoke<string>('capture_fullscreen_screenshot');
					break;
				case 'window':
					result = await invoke<string>('capture_window_screenshot');
					break;
				case 'region':
					result = await invoke<string>('capture_region_screenshot');
					break;
			}
			lastCapture = result;
			await loadScreenshots();
		} catch (e) {
			error = String(e);
		} finally {
			capturing = false;
		}
	}

	async function saveScreenshot() {
		if (!lastCapture) return;
		try {
			const path = await invoke<string>('save_screenshot', { dataUrl: lastCapture });
			await loadScreenshots();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function loadScreenshots() {
		try {
			screenshots = await invoke<string[]>('list_screenshots');
		} catch { /* ignore */ }
	}

	async function deleteScreenshot(path: string) {
		try {
			await invoke('delete_screenshot', { path });
			await loadScreenshots();
		} catch (e) {
			error = String(e);
		}
	}

	async function copyToClipboard() {
		if (!lastCapture) return;
		try {
			await invoke('clipboard_write_text', { text: lastCapture });
		} catch { /* ignore */ }
	}

	function getFilename(path: string): string {
		return path.split('/').pop()?.split('\\').pop() || path;
	}
</script>

<div class="screenshot-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<rect x="3" y="3" width="18" height="18" rx="2" />
					<circle cx="8.5" cy="8.5" r="1.5" />
					<path d="m21 15-5-5L5 21" />
				</svg>
			</span>
			<h3>Screenshot</h3>
		</div>
		<div class="header-actions">
			{#if screenshotsDir}
				<span class="dir-hint" title={screenshotsDir}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
					</svg>
				</span>
			{/if}
		</div>
	</div>

	<div class="mode-selector">
		<button class="mode-btn" class:active={mode === 'fullscreen'} onclick={() => mode = 'fullscreen'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<path d="M8 21h8M12 17v4" />
			</svg>
			Full Screen
		</button>
		<button class="mode-btn" class:active={mode === 'window'} onclick={() => mode = 'window'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M3 9h18" />
			</svg>
			Window
		</button>
		<button class="mode-btn" class:active={mode === 'region'} onclick={() => mode = 'region'}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<path d="M6 2v4M18 2v4M6 18v4M18 18v4M2 6h4M2 18h4M18 6h4M18 18h4" />
			</svg>
			Region
		</button>
	</div>

	<button class="capture-btn" onclick={capture} disabled={capturing}>
		{#if capturing}
			<span class="spinner"></span> Capturing...
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
				<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
				<circle cx="12" cy="13" r="4" />
			</svg>
			Capture {mode === 'fullscreen' ? 'Screen' : mode === 'window' ? 'Window' : 'Region'}
		{/if}
	</button>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if lastCapture}
		<div class="preview-section">
			<div class="preview-header">
				<span class="label">Preview</span>
				<div class="preview-actions">
					<button class="small-btn" onclick={copyToClipboard} title="Copy">Copy</button>
					<button class="small-btn save" onclick={saveScreenshot} title="Save">Save</button>
				</div>
			</div>
			<img src={lastCapture} alt="Screenshot preview" class="preview-img" />
		</div>
	{/if}

	{#if screenshots.length > 0}
		<div class="history-section">
			<span class="label">Saved ({screenshots.length})</span>
			<div class="history-list">
				{#each screenshots.slice(0, 8) as path}
					<div class="history-item">
						<span class="file-name" title={path}>{getFilename(path)}</span>
						<button class="delete-btn" onclick={() => deleteScreenshot(path)} title="Delete">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.screenshot-panel {
		display: flex; flex-direction: column; gap: 12px; padding: 16px;
		background: var(--bg-secondary, #2b2d31); border-radius: 8px;
		color: var(--text-primary, #dbdee1); font-family: inherit;
	}
	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { color: #57f287; display: flex; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 6px; align-items: center; }
	.dir-hint { color: var(--text-muted, #6d6f78); cursor: help; }

	.mode-selector { display: flex; gap: 4px; }
	.mode-btn {
		flex: 1; padding: 6px 8px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px; cursor: pointer;
		display: flex; align-items: center; gap: 4px; justify-content: center;
	}
	.mode-btn:hover { color: var(--text-primary, #dbdee1); }
	.mode-btn.active { background: #57f287; color: #1e1f22; border-color: #57f287; font-weight: 600; }

	.capture-btn {
		padding: 10px; border-radius: 6px; border: none;
		background: #57f287; color: #1e1f22; font-size: 13px; font-weight: 600;
		cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center;
	}
	.capture-btn:hover { background: #3ba55d; }
	.capture-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.spinner {
		width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2);
		border-top-color: #1e1f22; border-radius: 50%;
		animation: spin 0.6s linear infinite; display: inline-block;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-msg { font-size: 12px; color: #ed4245; }

	.preview-section { display: flex; flex-direction: column; gap: 6px; }
	.preview-header { display: flex; justify-content: space-between; align-items: center; }
	.preview-actions { display: flex; gap: 4px; }
	.label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }

	.small-btn {
		padding: 3px 8px; font-size: 11px; border-radius: 3px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4); cursor: pointer;
	}
	.small-btn:hover { color: var(--text-primary, #dbdee1); }
	.small-btn.save { background: #5865f2; border-color: #5865f2; color: #fff; }
	.small-btn.save:hover { background: #4752c4; }

	.preview-img {
		width: 100%; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		max-height: 200px; object-fit: contain;
		background: var(--bg-tertiary, #1e1f22);
	}

	.history-section { display: flex; flex-direction: column; gap: 6px; }
	.history-list { display: flex; flex-direction: column; gap: 2px; }
	.history-item {
		display: flex; align-items: center; justify-content: space-between;
		padding: 4px 8px; border-radius: 4px; font-size: 11px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.file-name {
		flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
		color: var(--text-secondary, #949ba4); font-family: monospace;
	}
	.delete-btn {
		background: none; border: none; color: var(--text-muted, #6d6f78);
		cursor: pointer; padding: 2px; border-radius: 3px; display: flex;
	}
	.delete-btn:hover { color: #ed4245; }
</style>
