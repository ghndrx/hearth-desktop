<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';

	interface SharedFile {
		id: string;
		file_name: string;
		file_path: string;
		file_size: number;
		mime_type: string;
		checksum: string;
		shared_at: number;
		expires_at: number | null;
	}

	interface FileShareState {
		files: SharedFile[];
		total_shared: number;
		total_bytes: number;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let state = $state<FileShareState | null>(null);
	let error = $state<string | null>(null);
	let dragOver = $state(false);
	let addFilePath = $state('');
	let showAddForm = $state(false);
	let expiresHours = $state<number | undefined>(undefined);

	onMount(() => {
		if (open) loadState();
	});

	$effect(() => {
		if (open) loadState();
	});

	async function loadState() {
		try {
			error = null;
			state = await invoke<FileShareState>('fileshare_get_state');
		} catch (e) {
			error = String(e);
		}
	}

	async function addFile() {
		if (!addFilePath.trim()) return;
		try {
			error = null;
			await invoke<SharedFile>('fileshare_add_file', {
				filePath: addFilePath.trim(),
				expiresHours: expiresHours,
			});
			addFilePath = '';
			showAddForm = false;
			await loadState();
		} catch (e) {
			error = String(e);
		}
	}

	async function removeFile(id: string) {
		try {
			state = await invoke<FileShareState>('fileshare_remove', { id });
		} catch (e) {
			error = String(e);
		}
	}

	async function openInFolder(filePath: string) {
		try {
			await invoke('fileshare_open_in_folder', { filePath });
		} catch (e) {
			error = String(e);
		}
	}

	async function clearExpired() {
		try {
			state = await invoke<FileShareState>('fileshare_clear_expired');
		} catch (e) {
			error = String(e);
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
		return `${(bytes / 1073741824).toFixed(2)} GB`;
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

	function fileIcon(mime: string): string {
		if (mime.startsWith('image/')) return 'img';
		if (mime.startsWith('video/')) return 'vid';
		if (mime.startsWith('audio/')) return 'aud';
		if (mime.includes('pdf')) return 'pdf';
		if (mime.includes('zip')) return 'zip';
		if (mime.includes('json') || mime.includes('javascript') || mime.includes('css')) return 'src';
		return 'doc';
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
						<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
					<h2>File Quick Share</h2>
				</div>
				<div class="header-actions">
					<button class="action-btn" onclick={clearExpired}>Clean Expired</button>
					<button class="close-btn" onclick={handleClose}>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			{#if error}
				<div class="error-bar">{error}</div>
			{/if}

			<div class="toolbar">
				<button class="add-btn" onclick={() => showAddForm = !showAddForm}>
					{showAddForm ? 'Cancel' : '+ Add File'}
				</button>
			</div>

			{#if showAddForm}
				<div class="add-form" transition:slide={{ duration: 150 }}>
					<label>
						<span class="label-text">File Path</span>
						<input type="text" bind:value={addFilePath} placeholder="/path/to/file" class="form-input" />
					</label>
					<div class="form-row">
						<label>
							<span class="label-text">Expires (hours, optional)</span>
							<input type="number" bind:value={expiresHours} placeholder="Never" class="form-input" min="1" />
						</label>
						<button class="save-btn" onclick={addFile} disabled={!addFilePath.trim()}>Share</button>
					</div>
				</div>
			{/if}

			<div class="file-list">
				{#if state}
					{#each state.files as file (file.id)}
						<div class="file-item" transition:slide={{ duration: 100 }}>
							<div class="file-icon">{fileIcon(file.mime_type)}</div>
							<div class="file-info">
								<div class="file-name">{file.file_name}</div>
								<div class="file-meta">
									<span>{formatSize(file.file_size)}</span>
									<span>{file.mime_type}</span>
									<span>{timeAgo(file.shared_at)}</span>
									{#if file.expires_at}
										<span class="expires">expires {timeAgo(file.expires_at)}</span>
									{/if}
								</div>
							</div>
							<div class="file-actions">
								<button class="icon-btn" onclick={() => openInFolder(file.file_path)} title="Open folder">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
									</svg>
								</button>
								<button class="icon-btn danger" onclick={() => removeFile(file.id)} title="Remove">
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					{:else}
						<div class="empty-state">
							<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
								<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
								<polyline points="14 2 14 8 20 8" />
							</svg>
							<p>No shared files yet</p>
						</div>
					{/each}
				{/if}
			</div>

			{#if state}
				<div class="panel-footer">
					<span class="stats">{state.files.length} files</span>
					<span class="stats">{formatSize(state.total_bytes)} total shared</span>
				</div>
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
	.header-actions { display: flex; align-items: center; gap: 8px; }
	.action-btn { padding: 4px 10px; border: none; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); color: var(--text-muted, #949ba4); }
	.action-btn:hover { color: var(--text-primary, #f2f3f5); }
	.close-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.close-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.error-bar { padding: 8px 16px; background: var(--status-danger, #f23f43); color: white; font-size: 13px; }
	.toolbar { display: flex; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); }
	.add-btn { padding: 6px 14px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
	.add-btn:hover { background: var(--brand-primary-hover, #4752c4); }
	.add-form { padding: 12px 16px; background: var(--bg-tertiary, #1e1f22); border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.06)); display: flex; flex-direction: column; gap: 8px; }
	.form-row { display: flex; gap: 8px; align-items: flex-end; }
	.form-row label { flex: 1; }
	.label-text { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted, #949ba4); margin-bottom: 4px; }
	.form-input { width: 100%; background: var(--bg-secondary, #2b2d31); border: 1px solid var(--border-faint, rgba(255,255,255,0.06)); border-radius: 4px; padding: 6px 10px; color: var(--text-primary, #f2f3f5); font-size: 13px; outline: none; box-sizing: border-box; }
	.form-input:focus { border-color: var(--brand-primary, #5865f2); }
	.save-btn { padding: 6px 16px; background: var(--brand-primary, #5865f2); color: white; border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.file-list { flex: 1; overflow-y: auto; padding: 4px 12px; }
	.file-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 6px; margin-bottom: 4px; background: var(--bg-tertiary, #1e1f22); }
	.file-item:hover { background: var(--bg-modifier-hover, rgba(79,84,92,0.16)); }
	.file-icon { width: 36px; height: 36px; border-radius: 6px; background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-muted, #949ba4); text-transform: uppercase; flex-shrink: 0; }
	.file-info { flex: 1; min-width: 0; }
	.file-name { font-size: 13px; font-weight: 500; color: var(--text-primary, #f2f3f5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.file-meta { display: flex; gap: 8px; font-size: 11px; color: var(--text-muted, #949ba4); margin-top: 2px; flex-wrap: wrap; }
	.expires { color: #f0b232; }
	.file-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.1s; }
	.file-item:hover .file-actions { opacity: 1; }
	.icon-btn { background: none; border: none; color: var(--text-muted, #949ba4); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; }
	.icon-btn:hover { color: var(--text-primary, #f2f3f5); background: var(--bg-modifier-hover, rgba(79,84,92,0.24)); }
	.icon-btn.danger:hover { color: var(--status-danger, #f23f43); }
	.empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px 16px; color: var(--text-muted, #949ba4); gap: 12px; }
	.empty-state p { margin: 0; font-size: 14px; }
	.panel-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border-faint, rgba(255,255,255,0.06)); font-size: 11px; color: var(--text-muted, #949ba4); }
	.stats { font-weight: 500; }
	.file-list::-webkit-scrollbar { width: 6px; }
	.file-list::-webkit-scrollbar-track { background: transparent; }
	.file-list::-webkit-scrollbar-thumb { background: var(--bg-modifier-accent, rgba(79,84,92,0.48)); border-radius: 3px; }
</style>
