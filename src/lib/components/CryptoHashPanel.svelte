<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface FileHashResult {
		id: string;
		filePath: string;
		fileName: string;
		fileSize: number;
		sha256: string;
		sha1: string;
		md5: string;
		createdAt: string;
	}

	type TabId = 'file' | 'text' | 'verify';

	let activeTab = $state<TabId>('file');
	let isProcessing = $state(false);
	let error = $state<string | null>(null);

	// File hash state
	let fileResult = $state<FileHashResult | null>(null);
	let history = $state<FileHashResult[]>([]);

	// Text hash state
	let hashInput = $state('');
	let hashAlgorithm = $state('sha256');
	let textHashResult = $state('');

	// Verify state
	let verifyPath = $state('');
	let verifyHash = $state('');
	let verifyAlgo = $state('sha256');
	let verifyResult = $state<boolean | null>(null);

	onMount(loadHistory);

	async function hashFile() {
		try {
			const selected = await invoke<string | null>('open_file_dialog', {
				title: 'Select file to hash',
				filters: []
			});
			if (!selected) return;

			isProcessing = true;
			error = null;
			fileResult = await invoke<FileHashResult>('hash_file', { path: selected });
			await loadHistory();
		} catch (e) {
			error = String(e);
		} finally {
			isProcessing = false;
		}
	}

	async function hashText() {
		if (!hashInput.trim()) return;
		isProcessing = true;
		error = null;
		try {
			textHashResult = await invoke<string>('hash_text', { text: hashInput, algorithm: hashAlgorithm });
		} catch (e) {
			error = String(e);
			textHashResult = '';
		} finally {
			isProcessing = false;
		}
	}

	async function verifyFile() {
		if (!verifyPath.trim() || !verifyHash.trim()) return;
		isProcessing = true;
		error = null;
		verifyResult = null;
		try {
			verifyResult = await invoke<boolean>('hash_verify', {
				path: verifyPath, expectedHash: verifyHash, algorithm: verifyAlgo
			});
		} catch (e) {
			error = String(e);
		} finally {
			isProcessing = false;
		}
	}

	async function loadHistory() {
		try { history = await invoke<FileHashResult[]>('hash_get_history'); }
		catch { history = []; }
	}

	async function copyHash(hash: string) {
		try { await invoke('clipboard_write_text', { text: hash }); }
		catch { /* ignore */ }
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
	}

	function truncateHash(hash: string): string {
		if (hash.length <= 20) return hash;
		return hash.slice(0, 10) + '...' + hash.slice(-10);
	}
</script>

<div class="hash-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F512;</span>
			<h3>Crypto Hash</h3>
		</div>
	</div>

	<div class="tabs">
		{#each [['file', 'File Hash'], ['text', 'Text Hash'], ['verify', 'Verify']] as [id, label]}
			<button class="tab" class:active={activeTab === id} onclick={() => { activeTab = id as TabId; }}>
				{label}
			</button>
		{/each}
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if activeTab === 'file'}
		<button class="action-btn" onclick={hashFile} disabled={isProcessing}>
			{isProcessing ? 'Hashing...' : 'Select File to Hash'}
		</button>

		{#if fileResult}
			<div class="file-result">
				<div class="file-info">
					<span class="file-name">{fileResult.fileName}</span>
					<span class="file-size">{formatBytes(fileResult.fileSize)}</span>
				</div>
				<div class="hash-list">
					{#each [['SHA-256', fileResult.sha256], ['SHA-1', fileResult.sha1], ['MD5', fileResult.md5]] as [algo, hash]}
						<div class="hash-row">
							<span class="hash-algo">{algo}</span>
							<span class="hash-value" title={hash}>{truncateHash(hash)}</span>
							<button class="copy-btn" onclick={() => copyHash(hash)} title="Copy">&#x1F4CB;</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if history.length > 1}
			<div class="history-section">
				<span class="section-label">Recent</span>
				{#each history.slice(0, -1).reverse().slice(0, 5) as item}
					<div class="history-item">
						<span class="hist-name">{item.fileName}</span>
						<span class="hist-size">{formatBytes(item.fileSize)}</span>
					</div>
				{/each}
			</div>
		{/if}

	{:else if activeTab === 'text'}
		<textarea class="text-area" placeholder="Enter text to hash..." bind:value={hashInput} rows="3"></textarea>
		<div class="algo-row">
			<select class="algo-select" bind:value={hashAlgorithm}>
				<option value="sha256">SHA-256</option>
				<option value="sha1">SHA-1</option>
				<option value="md5">MD5</option>
			</select>
			<button class="action-btn" onclick={hashText} disabled={isProcessing || !hashInput.trim()}>
				{isProcessing ? '...' : 'Hash'}
			</button>
		</div>

		{#if textHashResult}
			<div class="result-box">
				<span class="result-text">{textHashResult}</span>
				<button class="copy-btn" onclick={() => copyHash(textHashResult)} title="Copy">&#x1F4CB;</button>
			</div>
		{/if}

	{:else}
		<input type="text" class="input" placeholder="File path..." bind:value={verifyPath} />
		<input type="text" class="input" placeholder="Expected hash..." bind:value={verifyHash} />
		<div class="algo-row">
			<select class="algo-select" bind:value={verifyAlgo}>
				<option value="sha256">SHA-256</option>
				<option value="sha1">SHA-1</option>
				<option value="md5">MD5</option>
			</select>
			<button class="action-btn" onclick={verifyFile} disabled={isProcessing || !verifyPath.trim() || !verifyHash.trim()}>
				{isProcessing ? '...' : 'Verify'}
			</button>
		</div>

		{#if verifyResult !== null}
			<div class="verify-result" class:match={verifyResult} class:mismatch={!verifyResult}>
				{verifyResult ? 'MATCH - Hash verified successfully' : 'MISMATCH - Hash does not match'}
			</div>
		{/if}
	{/if}
</div>

<style>
	.hash-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.tabs { display: flex; gap: 4px; }
	.tab {
		flex: 1; padding: 6px; border: none; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22); color: var(--text-secondary, #949ba4);
		font-size: 12px; font-weight: 500; cursor: pointer;
	}
	.tab.active { background: #5865f2; color: white; }
	.tab:hover:not(.active) { color: var(--text-primary, #dbdee1); }

	.error { font-size: 12px; color: #ed4245; }

	.action-btn {
		padding: 10px; border-radius: 6px; border: none;
		background: #5865f2; color: white; font-size: 13px;
		font-weight: 500; cursor: pointer; width: 100%;
	}
	.action-btn:hover:not(:disabled) { background: #4752c4; }
	.action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.file-result { display: flex; flex-direction: column; gap: 8px; }
	.file-info {
		display: flex; justify-content: space-between; align-items: center;
		padding: 8px 10px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px;
	}
	.file-name { font-size: 13px; font-weight: 500; }
	.file-size { font-size: 12px; color: var(--text-secondary, #949ba4); }

	.hash-list { display: flex; flex-direction: column; gap: 4px; }
	.hash-row {
		display: flex; align-items: center; gap: 8px;
		padding: 6px 10px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px;
	}
	.hash-algo { font-size: 10px; font-weight: 700; color: #5865f2; min-width: 50px; }
	.hash-value { flex: 1; font-size: 11px; font-family: monospace; color: var(--text-secondary, #949ba4); overflow: hidden; text-overflow: ellipsis; }

	.copy-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 2px 4px; border-radius: 4px; font-size: 12px;
	}
	.copy-btn:hover { color: var(--text-primary, #dbdee1); background: rgba(255, 255, 255, 0.06); }

	.text-area {
		width: 100%; padding: 10px 12px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147); background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px; font-family: monospace;
		resize: vertical; box-sizing: border-box;
	}
	.text-area:focus { outline: none; border-color: #5865f2; }
	.text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.input {
		width: 100%; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147); background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px; font-family: inherit;
		box-sizing: border-box;
	}
	.input:focus { outline: none; border-color: #5865f2; }
	.input::placeholder { color: var(--text-muted, #6d6f78); }

	.algo-row { display: flex; gap: 6px; }
	.algo-select {
		padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147); background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px;
	}

	.result-box {
		display: flex; align-items: center; gap: 8px;
		padding: 10px 12px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px;
	}
	.result-text { flex: 1; font-size: 11px; font-family: monospace; word-break: break-all; user-select: all; }

	.verify-result {
		padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 600; text-align: center;
	}
	.verify-result.match { background: rgba(59, 165, 93, 0.15); color: #3ba55d; }
	.verify-result.mismatch { background: rgba(237, 66, 69, 0.15); color: #ed4245; }

	.history-section { display: flex; flex-direction: column; gap: 4px; }
	.section-label { font-size: 10px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.5px; }
	.history-item {
		display: flex; justify-content: space-between;
		padding: 6px 10px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px; font-size: 12px;
	}
	.hist-name { color: var(--text-secondary, #949ba4); }
	.hist-size { color: var(--text-muted, #6d6f78); font-size: 11px; }
</style>
