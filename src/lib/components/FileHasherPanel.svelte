<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface FileHashResult {
		path: string;
		fileName: string;
		sizeBytes: number;
		md5: string;
		sha1: string;
		sha256: string;
		durationMs: number;
	}

	let results: FileHashResult[] = $state([]);
	let dragging = $state(false);
	let processing = $state(false);
	let error: string | null = $state(null);
	let copiedField: string | null = $state(null);

	function formatBytes(bytes: number): string {
		if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
		if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
		if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
		return bytes + ' B';
	}

	async function hashFiles(paths: string[]) {
		processing = true;
		error = null;
		try {
			const batch = await invoke<FileHashResult[]>('filehasher_hash_batch', { paths });
			results = [...batch, ...results];
		} catch (e) {
			error = String(e);
		} finally {
			processing = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const paths: string[] = [];
			for (let i = 0; i < files.length; i++) {
				// In Tauri, dropped files have a path property
				const file = files[i] as File & { path?: string };
				if (file.path) {
					paths.push(file.path);
				}
			}
			if (paths.length > 0) {
				hashFiles(paths);
			}
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragging = true;
	}

	function handleDragLeave() {
		dragging = false;
	}

	async function copyToClipboard(text: string, field: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedField = field;
			setTimeout(() => (copiedField = null), 1500);
		} catch {
			// fallback
		}
	}

	function clearResults() {
		results = [];
	}

	function truncateHash(hash: string): string {
		if (hash.length <= 16) return hash;
		return hash.slice(0, 8) + '...' + hash.slice(-8);
	}
</script>

<div
	class="hasher-panel"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="application"
>
	<div class="panel-header">
		<h3>File Hasher</h3>
		{#if results.length > 0}
			<button class="clear-btn" onclick={clearResults}>Clear</button>
		{/if}
	</div>

	<div class="drop-zone" class:active={dragging} class:processing>
		{#if processing}
			<div class="drop-icon">...</div>
			<span>Hashing files...</span>
		{:else}
			<div class="drop-icon">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="12" y1="18" x2="12" y2="12" />
					<polyline points="9 15 12 12 15 15" />
				</svg>
			</div>
			<span>Drop files here to hash</span>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if results.length > 0}
		<div class="results">
			{#each results as result}
				<div class="result-card">
					<div class="file-header">
						<span class="file-name">{result.fileName}</span>
						<span class="file-meta">{formatBytes(result.sizeBytes)} | {result.durationMs}ms</span>
					</div>
					<div class="hash-list">
						{#each [['MD5', result.md5], ['SHA1', result.sha1], ['SHA256', result.sha256]] as [label, hash]}
							<div class="hash-row">
								<span class="hash-label">{label}</span>
								<button
									class="hash-value"
									class:copied={copiedField === `${result.path}-${label}`}
									onclick={() => copyToClipboard(hash, `${result.path}-${label}`)}
									title="Click to copy"
								>
									{truncateHash(hash)}
									<span class="copy-hint">{copiedField === `${result.path}-${label}` ? 'Copied!' : 'Copy'}</span>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.hasher-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #313338);
		color: var(--text-normal, #dbdee1);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
	}

	.clear-btn {
		padding: 4px 10px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-muted, #949ba4);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.clear-btn:hover {
		color: var(--text-normal, #dbdee1);
	}

	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 32px;
		border: 2px dashed rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-muted, #949ba4);
		transition: all 0.2s;
		font-size: 13px;
	}

	.drop-zone.active {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.08);
		color: #5865f2;
	}

	.drop-zone.processing {
		border-color: #faa61a;
	}

	.drop-icon {
		font-size: 24px;
	}

	.error-msg {
		padding: 8px 12px;
		background: rgba(240, 71, 71, 0.1);
		border: 1px solid rgba(240, 71, 71, 0.3);
		border-radius: 4px;
		color: #f04747;
		font-size: 12px;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.result-card {
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.file-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.file-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--header-primary, #f2f3f5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.file-meta {
		font-size: 11px;
		color: var(--text-muted, #949ba4);
		white-space: nowrap;
	}

	.hash-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.hash-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.hash-label {
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted, #949ba4);
		min-width: 44px;
		text-transform: uppercase;
	}

	.hash-value {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 11px;
		color: var(--text-normal, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 3px;
		padding: 2px 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s;
	}

	.hash-value:hover {
		border-color: #5865f2;
	}

	.hash-value.copied {
		border-color: #43b581;
	}

	.copy-hint {
		font-size: 9px;
		color: var(--text-muted, #949ba4);
		font-family: inherit;
	}

	.hash-value.copied .copy-hint {
		color: #43b581;
	}
</style>
