<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface HashResult {
		id: string;
		filePath: string;
		fileName: string;
		fileSize: number;
		md5: string | null;
		sha1: string | null;
		sha256: string | null;
		sha512: string | null;
		durationMs: number;
		computedAt: string;
	}

	interface HashVerifyResult {
		matches: boolean;
		expected: string;
		actual: string;
		algorithm: string;
		filePath: string;
		fileName: string;
	}

	interface FileCompareResult {
		path1: string;
		path2: string;
		name1: string;
		name2: string;
		size1: number;
		size2: number;
		identical: boolean;
		md5Match: boolean;
		sha256Match: boolean;
	}

	type TabId = 'compute' | 'verify' | 'compare' | 'history';

	let activeTab = $state<TabId>('compute');
	let isProcessing = $state(false);
	let error = $state<string | null>(null);
	let copiedHash = $state<string | null>(null);

	// Compute state
	let computePath = $state('');
	let algoMd5 = $state(true);
	let algoSha1 = $state(true);
	let algoSha256 = $state(true);
	let algoSha512 = $state(false);
	let computeResult = $state<HashResult | null>(null);

	// Verify state
	let verifyPath = $state('');
	let verifyExpected = $state('');
	let verifyAlgo = $state('auto');
	let verifyResult = $state<HashVerifyResult | null>(null);

	// Compare state
	let comparePath1 = $state('');
	let comparePath2 = $state('');
	let compareResult = $state<FileCompareResult | null>(null);

	// History
	let history = $state<HashResult[]>([]);

	onMount(loadHistory);

	async function browseFile(target: 'compute' | 'verify' | 'compare1' | 'compare2') {
		try {
			const selected = await invoke<string | null>('open_file_dialog', {
				title: 'Select file',
				filters: []
			});
			if (!selected) return;
			if (target === 'compute') computePath = selected;
			else if (target === 'verify') verifyPath = selected;
			else if (target === 'compare1') comparePath1 = selected;
			else if (target === 'compare2') comparePath2 = selected;
		} catch {
			/* dialog not available, user types path manually */
		}
	}

	function getSelectedAlgorithms(): string[] {
		const algos: string[] = [];
		if (algoMd5) algos.push('md5');
		if (algoSha1) algos.push('sha1');
		if (algoSha256) algos.push('sha256');
		if (algoSha512) algos.push('sha512');
		return algos;
	}

	async function computeHash() {
		if (!computePath.trim()) return;
		const algos = getSelectedAlgorithms();
		if (algos.length === 0) {
			error = 'Select at least one algorithm';
			return;
		}

		isProcessing = true;
		error = null;
		computeResult = null;

		try {
			computeResult = await invoke<HashResult>('filehash_compute', {
				path: computePath,
				algorithms: algos
			});
			await loadHistory();
		} catch (e) {
			error = String(e);
		} finally {
			isProcessing = false;
		}
	}

	async function verifyFile() {
		if (!verifyPath.trim() || !verifyExpected.trim()) return;

		isProcessing = true;
		error = null;
		verifyResult = null;

		try {
			const algoParam = verifyAlgo === 'auto' ? null : verifyAlgo;
			verifyResult = await invoke<HashVerifyResult>('filehash_verify', {
				path: verifyPath,
				expectedHash: verifyExpected,
				algorithm: algoParam
			});
		} catch (e) {
			error = String(e);
		} finally {
			isProcessing = false;
		}
	}

	async function compareFiles() {
		if (!comparePath1.trim() || !comparePath2.trim()) return;

		isProcessing = true;
		error = null;
		compareResult = null;

		try {
			compareResult = await invoke<FileCompareResult>('filehash_compare_files', {
				path1: comparePath1,
				path2: comparePath2
			});
		} catch (e) {
			error = String(e);
		} finally {
			isProcessing = false;
		}
	}

	async function loadHistory() {
		try {
			history = await invoke<HashResult[]>('filehash_get_history');
		} catch {
			history = [];
		}
	}

	async function clearHistory() {
		try {
			await invoke('filehash_clear_history');
			history = [];
		} catch {
			/* ignore */
		}
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedHash = text;
			setTimeout(() => {
				copiedHash = null;
			}, 2000);
		} catch {
			try {
				await invoke('clipboard_write_text', { text });
				copiedHash = text;
				setTimeout(() => {
					copiedHash = null;
				}, 2000);
			} catch {
				/* ignore */
			}
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
	}

	function truncateHash(hash: string): string {
		if (hash.length <= 24) return hash;
		return hash.slice(0, 12) + '...' + hash.slice(-12);
	}

	function detectAlgoLabel(hash: string): string {
		switch (hash.trim().length) {
			case 32:
				return 'MD5';
			case 40:
				return 'SHA-1';
			case 64:
				return 'SHA-256';
			case 128:
				return 'SHA-512';
			default:
				return 'Unknown';
		}
	}

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return mins + 'm ago';
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return hrs + 'h ago';
		return Math.floor(hrs / 24) + 'd ago';
	}
</script>

<div class="fhv-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">#</span>
			<h3>File Hash Verifier</h3>
		</div>
	</div>

	<div class="tabs">
		{#each [
			['compute', 'Compute'],
			['verify', 'Verify'],
			['compare', 'Compare'],
			['history', 'History']
		] as [id, label]}
			<button
				class="tab"
				class:active={activeTab === id}
				onclick={() => {
					activeTab = id as TabId;
					error = null;
				}}
			>
				{label}
			</button>
		{/each}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if activeTab === 'compute'}
		<div class="section">
			<div class="input-row">
				<input
					type="text"
					class="input flex-1"
					placeholder="File path..."
					bind:value={computePath}
				/>
				<button class="browse-btn" onclick={() => browseFile('compute')}>Browse</button>
			</div>

			<div class="algo-checks">
				<label class="check-label">
					<input type="checkbox" bind:checked={algoMd5} />
					<span>MD5</span>
				</label>
				<label class="check-label">
					<input type="checkbox" bind:checked={algoSha1} />
					<span>SHA-1</span>
				</label>
				<label class="check-label">
					<input type="checkbox" bind:checked={algoSha256} />
					<span>SHA-256</span>
				</label>
				<label class="check-label">
					<input type="checkbox" bind:checked={algoSha512} />
					<span>SHA-512</span>
				</label>
			</div>

			<button
				class="action-btn"
				onclick={computeHash}
				disabled={isProcessing || !computePath.trim()}
			>
				{isProcessing ? 'Computing...' : 'Compute Hashes'}
			</button>

			{#if computeResult}
				<div class="result-card">
					<div class="file-info">
						<span class="file-name">{computeResult.fileName}</span>
						<div class="file-meta">
							<span class="file-size">{formatBytes(computeResult.fileSize)}</span>
							<span class="duration">{computeResult.durationMs}ms</span>
						</div>
					</div>
					<div class="hash-list">
						{#if computeResult.md5}
							<div class="hash-row">
								<span class="hash-algo">MD5</span>
								<span class="hash-value" title={computeResult.md5}
									>{truncateHash(computeResult.md5)}</span
								>
								<button
									class="copy-btn"
									class:copied={copiedHash === computeResult.md5}
									onclick={() => copyToClipboard(computeResult!.md5!)}
									title="Copy"
								>
									{copiedHash === computeResult.md5 ? 'Copied' : 'Copy'}
								</button>
							</div>
						{/if}
						{#if computeResult.sha1}
							<div class="hash-row">
								<span class="hash-algo">SHA-1</span>
								<span class="hash-value" title={computeResult.sha1}
									>{truncateHash(computeResult.sha1)}</span
								>
								<button
									class="copy-btn"
									class:copied={copiedHash === computeResult.sha1}
									onclick={() => copyToClipboard(computeResult!.sha1!)}
									title="Copy"
								>
									{copiedHash === computeResult.sha1 ? 'Copied' : 'Copy'}
								</button>
							</div>
						{/if}
						{#if computeResult.sha256}
							<div class="hash-row">
								<span class="hash-algo">SHA-256</span>
								<span class="hash-value" title={computeResult.sha256}
									>{truncateHash(computeResult.sha256)}</span
								>
								<button
									class="copy-btn"
									class:copied={copiedHash === computeResult.sha256}
									onclick={() => copyToClipboard(computeResult!.sha256!)}
									title="Copy"
								>
									{copiedHash === computeResult.sha256 ? 'Copied' : 'Copy'}
								</button>
							</div>
						{/if}
						{#if computeResult.sha512}
							<div class="hash-row">
								<span class="hash-algo">SHA-512</span>
								<span class="hash-value" title={computeResult.sha512}
									>{truncateHash(computeResult.sha512)}</span
								>
								<button
									class="copy-btn"
									class:copied={copiedHash === computeResult.sha512}
									onclick={() => copyToClipboard(computeResult!.sha512!)}
									title="Copy"
								>
									{copiedHash === computeResult.sha512 ? 'Copied' : 'Copy'}
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'verify'}
		<div class="section">
			<div class="input-row">
				<input
					type="text"
					class="input flex-1"
					placeholder="File path..."
					bind:value={verifyPath}
				/>
				<button class="browse-btn" onclick={() => browseFile('verify')}>Browse</button>
			</div>

			<textarea
				class="text-area"
				placeholder="Paste expected hash here..."
				bind:value={verifyExpected}
				rows="2"
			></textarea>

			{#if verifyExpected.trim()}
				<div class="detected-algo">
					Detected: <strong>{detectAlgoLabel(verifyExpected)}</strong>
				</div>
			{/if}

			<div class="algo-row">
				<select class="algo-select" bind:value={verifyAlgo}>
					<option value="auto">Auto-detect</option>
					<option value="md5">MD5</option>
					<option value="sha1">SHA-1</option>
					<option value="sha256">SHA-256</option>
					<option value="sha512">SHA-512</option>
				</select>
				<button
					class="action-btn flex-1"
					onclick={verifyFile}
					disabled={isProcessing || !verifyPath.trim() || !verifyExpected.trim()}
				>
					{isProcessing ? 'Verifying...' : 'Verify Hash'}
				</button>
			</div>

			{#if verifyResult}
				<div
					class="verify-result"
					class:match={verifyResult.matches}
					class:mismatch={!verifyResult.matches}
				>
					<div class="verify-status">
						{verifyResult.matches
							? 'MATCH - File integrity verified'
							: 'MISMATCH - File does not match expected hash'}
					</div>
					<div class="verify-details">
						<div class="verify-detail-row">
							<span class="detail-label">File:</span>
							<span class="detail-value">{verifyResult.fileName}</span>
						</div>
						<div class="verify-detail-row">
							<span class="detail-label">Algorithm:</span>
							<span class="detail-value">{verifyResult.algorithm.toUpperCase()}</span>
						</div>
						{#if !verifyResult.matches}
							<div class="verify-detail-row">
								<span class="detail-label">Expected:</span>
								<span class="detail-value mono">{truncateHash(verifyResult.expected)}</span
								>
							</div>
							<div class="verify-detail-row">
								<span class="detail-label">Actual:</span>
								<span class="detail-value mono">{truncateHash(verifyResult.actual)}</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{:else if activeTab === 'compare'}
		<div class="section">
			<div class="compare-label">File 1</div>
			<div class="input-row">
				<input
					type="text"
					class="input flex-1"
					placeholder="First file path..."
					bind:value={comparePath1}
				/>
				<button class="browse-btn" onclick={() => browseFile('compare1')}>Browse</button>
			</div>

			<div class="compare-label">File 2</div>
			<div class="input-row">
				<input
					type="text"
					class="input flex-1"
					placeholder="Second file path..."
					bind:value={comparePath2}
				/>
				<button class="browse-btn" onclick={() => browseFile('compare2')}>Browse</button>
			</div>

			<button
				class="action-btn"
				onclick={compareFiles}
				disabled={isProcessing || !comparePath1.trim() || !comparePath2.trim()}
			>
				{isProcessing ? 'Comparing...' : 'Compare Files'}
			</button>

			{#if compareResult}
				<div
					class="compare-result"
					class:match={compareResult.identical}
					class:mismatch={!compareResult.identical}
				>
					<div class="compare-status">
						{compareResult.identical ? 'IDENTICAL - Files match' : 'DIFFERENT - Files do not match'}
					</div>
					<div class="compare-details">
						<div class="compare-file-row">
							<span class="cmp-name">{compareResult.name1}</span>
							<span class="cmp-size">{formatBytes(compareResult.size1)}</span>
						</div>
						<div class="compare-file-row">
							<span class="cmp-name">{compareResult.name2}</span>
							<span class="cmp-size">{formatBytes(compareResult.size2)}</span>
						</div>
						<div class="compare-hash-rows">
							<div class="cmp-hash-row">
								<span class="cmp-algo">MD5</span>
								<span class="cmp-status" class:cmp-match={compareResult.md5Match} class:cmp-diff={!compareResult.md5Match}>
									{compareResult.md5Match ? 'Match' : 'Different'}
								</span>
							</div>
							<div class="cmp-hash-row">
								<span class="cmp-algo">SHA-256</span>
								<span class="cmp-status" class:cmp-match={compareResult.sha256Match} class:cmp-diff={!compareResult.sha256Match}>
									{compareResult.sha256Match ? 'Match' : 'Different'}
								</span>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="section">
			{#if history.length === 0}
				<div class="empty-state">No hash history yet. Compute a file hash to get started.</div>
			{:else}
				<div class="history-header">
					<span class="history-count">{history.length} entries</span>
					<button class="clear-btn" onclick={clearHistory}>Clear All</button>
				</div>
				<div class="history-list">
					{#each [...history].reverse() as item}
						<div class="history-item">
							<div class="hist-top">
								<span class="hist-name" title={item.filePath}>{item.fileName}</span>
								<span class="hist-time">{timeAgo(item.computedAt)}</span>
							</div>
							<div class="hist-meta">
								<span class="hist-size">{formatBytes(item.fileSize)}</span>
								<span class="hist-duration">{item.durationMs}ms</span>
							</div>
							<div class="hist-hashes">
								{#if item.sha256}
									<div class="hist-hash-row">
										<span class="hist-algo">SHA-256</span>
										<span class="hist-hash">{truncateHash(item.sha256)}</span>
										<button class="copy-btn-sm" onclick={() => copyToClipboard(item.sha256!)}>Copy</button>
									</div>
								{/if}
								{#if item.md5}
									<div class="hist-hash-row">
										<span class="hist-algo">MD5</span>
										<span class="hist-hash">{truncateHash(item.md5)}</span>
										<button class="copy-btn-sm" onclick={() => copyToClipboard(item.md5!)}>Copy</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.fhv-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.header-icon {
		font-size: 16px;
		font-weight: 700;
		color: #5865f2;
		font-family: monospace;
	}
	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.tabs {
		display: flex;
		gap: 4px;
	}
	.tab {
		flex: 1;
		padding: 6px;
		border: none;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}
	.tab.active {
		background: #5865f2;
		color: white;
	}
	.tab:hover:not(.active) {
		color: var(--text-primary, #dbdee1);
	}

	.error-msg {
		font-size: 12px;
		color: #ed4245;
		padding: 8px 10px;
		background: rgba(237, 66, 69, 0.1);
		border-radius: 6px;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.input-row {
		display: flex;
		gap: 6px;
	}
	.flex-1 {
		flex: 1;
	}

	.input {
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: inherit;
		box-sizing: border-box;
	}
	.input:focus {
		outline: none;
		border-color: #5865f2;
	}
	.input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.browse-btn {
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
		white-space: nowrap;
	}
	.browse-btn:hover {
		color: var(--text-primary, #dbdee1);
		border-color: #5865f2;
	}

	.algo-checks {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.check-label {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
	}
	.check-label input[type='checkbox'] {
		accent-color: #5865f2;
	}

	.action-btn {
		padding: 10px;
		border-radius: 6px;
		border: none;
		background: #5865f2;
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		width: 100%;
	}
	.action-btn:hover:not(:disabled) {
		background: #4752c4;
	}
	.action-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.result-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.file-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.file-name {
		font-size: 13px;
		font-weight: 500;
	}
	.file-meta {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.file-size {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
	}
	.duration {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
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
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.hash-algo {
		font-size: 10px;
		font-weight: 700;
		color: #5865f2;
		min-width: 50px;
	}
	.hash-value {
		flex: 1;
		font-size: 11px;
		font-family: monospace;
		color: var(--text-secondary, #949ba4);
		overflow: hidden;
		text-overflow: ellipsis;
		user-select: all;
	}

	.copy-btn {
		background: none;
		border: 1px solid var(--border, #3f4147);
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		white-space: nowrap;
	}
	.copy-btn:hover {
		color: var(--text-primary, #dbdee1);
		border-color: #5865f2;
	}
	.copy-btn.copied {
		color: #3ba55d;
		border-color: #3ba55d;
	}

	.text-area {
		width: 100%;
		padding: 10px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: monospace;
		resize: vertical;
		box-sizing: border-box;
	}
	.text-area:focus {
		outline: none;
		border-color: #5865f2;
	}
	.text-area::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.detected-algo {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		padding: 4px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.detected-algo strong {
		color: #5865f2;
	}

	.algo-row {
		display: flex;
		gap: 6px;
	}
	.algo-select {
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
	}

	.verify-result,
	.compare-result {
		padding: 12px;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.verify-result.match,
	.compare-result.match {
		background: rgba(59, 165, 93, 0.12);
		border: 1px solid rgba(59, 165, 93, 0.3);
	}
	.verify-result.mismatch,
	.compare-result.mismatch {
		background: rgba(237, 66, 69, 0.12);
		border: 1px solid rgba(237, 66, 69, 0.3);
	}

	.verify-status,
	.compare-status {
		font-size: 13px;
		font-weight: 600;
		text-align: center;
	}
	.match .verify-status,
	.match .compare-status {
		color: #3ba55d;
	}
	.mismatch .verify-status,
	.mismatch .compare-status {
		color: #ed4245;
	}

	.verify-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.verify-detail-row {
		display: flex;
		gap: 8px;
		font-size: 12px;
	}
	.detail-label {
		color: var(--text-muted, #6d6f78);
		min-width: 70px;
	}
	.detail-value {
		color: var(--text-secondary, #949ba4);
	}
	.detail-value.mono {
		font-family: monospace;
		font-size: 11px;
	}

	.compare-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.compare-details {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.compare-file-row {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 4px;
	}
	.cmp-name {
		color: var(--text-secondary, #949ba4);
	}
	.cmp-size {
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
	}

	.compare-hash-rows {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.cmp-hash-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 3px 8px;
		font-size: 12px;
	}
	.cmp-algo {
		font-weight: 600;
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
	}
	.cmp-status {
		font-weight: 600;
		font-size: 11px;
	}
	.cmp-match {
		color: #3ba55d;
	}
	.cmp-diff {
		color: #ed4245;
	}

	.empty-state {
		text-align: center;
		color: var(--text-muted, #6d6f78);
		font-size: 13px;
		padding: 20px;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.history-count {
		font-size: 12px;
		color: var(--text-muted, #6d6f78);
	}
	.clear-btn {
		background: none;
		border: 1px solid var(--border, #3f4147);
		color: #ed4245;
		cursor: pointer;
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 11px;
	}
	.clear-btn:hover {
		background: rgba(237, 66, 69, 0.1);
		border-color: #ed4245;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 400px;
		overflow-y: auto;
	}
	.history-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
	}
	.hist-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.hist-name {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-primary, #dbdee1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}
	.hist-time {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}
	.hist-meta {
		display: flex;
		gap: 10px;
	}
	.hist-size {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}
	.hist-duration {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}
	.hist-hashes {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.hist-hash-row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}
	.hist-algo {
		font-weight: 700;
		color: #5865f2;
		font-size: 10px;
		min-width: 45px;
	}
	.hist-hash {
		flex: 1;
		font-family: monospace;
		color: var(--text-muted, #6d6f78);
		font-size: 10px;
	}
	.copy-btn-sm {
		background: none;
		border: none;
		color: var(--text-muted, #6d6f78);
		cursor: pointer;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 10px;
	}
	.copy-btn-sm:hover {
		color: var(--text-primary, #dbdee1);
		background: rgba(255, 255, 255, 0.06);
	}
</style>
