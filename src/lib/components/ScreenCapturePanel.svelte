<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface Screenshot {
		id: string;
		file_path: string;
		file_name: string;
		width: number;
		height: number;
		file_size: number;
		captured_at: number;
		annotation: string;
	}

	interface ScreenshotState {
		captures: Screenshot[];
		save_directory: string;
		total_captures: number;
		auto_copy: boolean;
		format: string;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let state = $state<ScreenshotState | null>(null);
	let error = $state<string | null>(null);
	let capturing = $state(false);
	let editingAnnotation = $state<string | null>(null);
	let annotationText = $state('');

	onMount(() => {
		if (open) loadState();
	});

	$effect(() => {
		if (open) loadState();
	});

	async function loadState() {
		try {
			error = null;
			state = await invoke<ScreenshotState>('screenshot_get_state');
		} catch (e) {
			error = String(e);
		}
	}

	async function captureFullscreen() {
		try {
			capturing = true;
			error = null;
			await invoke<Screenshot>('screenshot_capture');
			await loadState();
		} catch (e) {
			error = String(e);
		} finally {
			capturing = false;
		}
	}

	async function captureArea() {
		try {
			capturing = true;
			error = null;
			await invoke<Screenshot>('screenshot_capture_area');
			await loadState();
		} catch (e) {
			error = String(e);
		} finally {
			capturing = false;
		}
	}

	async function openFile(filePath: string) {
		try {
			await invoke('screenshot_open_file', { filePath });
		} catch (e) {
			error = String(e);
		}
	}

	async function deleteCapture(id: string) {
		try {
			state = await invoke<ScreenshotState>('screenshot_delete', { id });
		} catch (e) {
			error = String(e);
		}
	}

	async function saveAnnotation(id: string) {
		try {
			state = await invoke<ScreenshotState>('screenshot_annotate', { id, annotation: annotationText });
			editingAnnotation = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function setFormat(format: string) {
		try {
			state = await invoke<ScreenshotState>('screenshot_set_format', { format });
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleAutoCopy() {
		if (!state) return;
		try {
			state = await invoke<ScreenshotState>('screenshot_set_auto_copy', { autoCopy: !state.auto_copy });
		} catch (e) {
			error = String(e);
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function timeAgo(ts: number): string {
		const diff = Date.now() - ts;
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function handleClose() { open = false; onClose?.(); }
	function handleKeydown(e: KeyboardEvent) { if (e.key === 'Escape') { handleClose(); e.preventDefault(); } }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
{#if open}
	<div class="panel-backdrop" transition:fade={{ duration: 100 }} onclick={handleClose} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="panel" transition:slide={{ duration: 200, axis: 'x' }} onclick={(e) => e.stopPropagation()}>
			<div class="panel-header">
				<div class="header-left">
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
						<circle cx="12" cy="13" r="4" />
					</svg>
					<h2>Screen Capture</h2>
				</div>
				<button class="close-btn" onclick={handleClose}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="capture-actions">
				<button class="capture-btn fullscreen" onclick={captureFullscreen} disabled={capturing}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M8 21h8M12 17v4" />
					</svg>
					{capturing ? 'Capturing...' : 'Full Screen'}
				</button>
				<button class="capture-btn area" onclick={captureArea} disabled={capturing}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2" />
						<path d="M9 9h6v6H9z" />
					</svg>
					{capturing ? 'Selecting...' : 'Area Select'}
				</button>
			</div>

			{#if state}
				<div class="settings-row">
					<div class="setting">
						<span>Format:</span>
						<button class="format-btn" class:active={state.format === 'png'} onclick={() => setFormat('png')}>PNG</button>
						<button class="format-btn" class:active={state.format === 'jpg'} onclick={() => setFormat('jpg')}>JPG</button>
					</div>
					<button class="toggle-btn" class:active={state.auto_copy} onclick={toggleAutoCopy}>
						Auto-copy: {state.auto_copy ? 'ON' : 'OFF'}
					</button>
				</div>

				<div class="capture-list">
					{#each state.captures as cap (cap.id)}
						<div class="capture-item" transition:slide={{ duration: 100 }}>
							<div class="cap-header">
								<span class="cap-name">{cap.file_name}</span>
								<span class="cap-time">{timeAgo(cap.captured_at)}</span>
							</div>
							<div class="cap-meta">
								{#if cap.width > 0}<span>{cap.width}x{cap.height}</span>{/if}
								<span>{formatSize(cap.file_size)}</span>
							</div>
							{#if editingAnnotation === cap.id}
								<div class="annotation-edit">
									<input type="text" bind:value={annotationText} placeholder="Add note..." class="form-input" />
									<button class="save-btn-sm" onclick={() => saveAnnotation(cap.id)}>Save</button>
									<button class="cancel-btn-sm" onclick={() => editingAnnotation = null}>Cancel</button>
								</div>
							{:else if cap.annotation}
								<div class="annotation">{cap.annotation}</div>
							{/if}
							<div class="cap-actions">
								<button class="icon-btn" onclick={() => openFile(cap.file_path)} title="Open">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
										<polyline points="15 3 21 3 21 9" />
										<line x1="10" y1="14" x2="21" y2="3" />
									</svg>
								</button>
								<button class="icon-btn" onclick={() => { editingAnnotation = cap.id; annotationText = cap.annotation; }} title="Annotate">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
								<button class="icon-btn danger" onclick={() => deleteCapture(cap.id)} title="Delete">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
									</svg>
								</button>
							</div>
						</div>
					{:else}
						<div class="empty-state">
							<span class="empty-icon">SS</span>
							<p>No screenshots yet</p>
							<p class="hint-text">Capture your screen to get started</p>
						</div>
					{/each}
				</div>

				<div class="panel-footer">
					<span class="stats">{state.total_captures} total captures</span>
					<span class="hint-text">Saved to {state.save_directory.split('/').pop()}</span>
				</div>
			{:else if !error}
				<div class="loading">Loading...</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: flex-end; }
	.panel { width: 420px; max-width: 90vw; height: 100%; background: var(--bg-secondary, #2b2d31); display: flex; flex-direction: column; box-shadow: -4px 0 16px rgba(0,0,0,0.3); }
	.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.header-left { display: flex; align-items: center; gap: 10px; color: var(--text-primary, #f2f3f5); }
	.header-left h2 { font-size: 16px; font-weight: 600; margin: 0; }
	.close-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.close-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.error-bar { padding: 8px 16px; background: var(--status-danger, #f23f43); color: white; font-size: 13px; }
	.capture-actions { display: flex; gap: 8px; padding: 16px; }
	.capture-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
	.capture-btn.fullscreen { background: var(--brand-primary, #5865f2); color: white; }
	.capture-btn.fullscreen:hover { background: var(--brand-primary-hover, #4752c4); }
	.capture-btn.area { background: var(--bg-tertiary, #1e1f22); color: var(--text-primary, #f2f3f5); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.capture-btn.area:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.capture-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.settings-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.setting { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, #949ba4); }
	.format-btn { padding: 2px 8px; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); }
	.format-btn.active { background: var(--brand-primary, #5865f2); color: white; }
	.toggle-btn { padding: 4px 10px; border: none; border-radius: 12px; font-size: 11px; font-weight: 700; cursor: pointer; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); }
	.toggle-btn.active { background: var(--status-positive, #23a55a); color: white; }
	.capture-list { flex: 1; overflow-y: auto; padding: 4px 12px; }
	.capture-item { padding: 10px 12px; border-radius: 6px; margin-bottom: 4px; background: var(--bg-tertiary, #1e1f22); }
	.capture-item:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); }
	.cap-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
	.cap-name { font-size: 13px; font-weight: 500; color: var(--text-primary, #f2f3f5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.cap-time { font-size: 11px; color: var(--text-muted, #949ba4); flex-shrink: 0; }
	.cap-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-muted, #949ba4); }
	.annotation { font-size: 12px; color: var(--text-secondary, #b5bac1); margin-top: 4px; font-style: italic; }
	.annotation-edit { display: flex; gap: 4px; margin-top: 6px; }
	.form-input { flex: 1; background: var(--bg-secondary, #2b2d31); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); border-radius: 4px; padding: 4px 8px; color: var(--text-primary, #f2f3f5); font-size: 12px; outline: none; }
	.save-btn-sm { padding: 4px 8px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; }
	.cancel-btn-sm { padding: 4px 8px; background: transparent; color: var(--text-muted, #949ba4); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); border-radius: 4px; font-size: 11px; cursor: pointer; }
	.cap-actions { display: flex; gap: 4px; margin-top: 6px; justify-content: flex-end; opacity: 0; transition: opacity 0.1s; }
	.capture-item:hover .cap-actions { opacity: 1; }
	.icon-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.icon-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.icon-btn.danger:hover { color: var(--status-danger, #f23f43); }
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; color: var(--text-muted, #949ba4); gap: 8px; }
	.empty-icon { font-size: 36px; font-weight: 700; opacity: 0.3; color: var(--text-primary, #f2f3f5); }
	.empty-state p { margin: 0; font-size: 14px; }
	.hint-text { opacity: 0.6; font-size: 12px; }
	.panel-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border-faint, rgba(255,255,255,0.06)); font-size: 11px; color: var(--text-muted, #949ba4); }
	.stats { font-weight: 500; }
	.loading { display: flex; align-items: center; justify-content: center; padding: 48px; color: var(--text-muted, #949ba4); }
	.capture-list::-webkit-scrollbar { width: 6px; }
	.capture-list::-webkit-scrollbar-track { background: transparent; }
	.capture-list::-webkit-scrollbar-thumb { background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; }
</style>
