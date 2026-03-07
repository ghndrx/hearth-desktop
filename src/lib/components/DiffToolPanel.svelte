<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface DiffLine {
		kind: string;
		content: string;
		leftLine: number | null;
		rightLine: number | null;
	}

	interface DiffResult {
		lines: DiffLine[];
		additions: number;
		deletions: number;
		unchanged: number;
		totalLeft: number;
		totalRight: number;
	}

	interface UnifiedDiffResult {
		diffText: string;
		hasChanges: boolean;
	}

	let leftText = $state('');
	let rightText = $state('');
	let diffResult = $state<DiffResult | null>(null);
	let unifiedResult = $state<UnifiedDiffResult | null>(null);
	let viewMode = $state<'side' | 'unified'>('side');
	let error = $state<string | null>(null);

	async function compare() {
		if (!leftText && !rightText) return;
		error = null;
		try {
			if (viewMode === 'unified') {
				unifiedResult = await invoke<UnifiedDiffResult>('diff_unified', {
					left: leftText,
					right: rightText,
					contextLines: 3
				});
				diffResult = await invoke<DiffResult>('diff_compare', { left: leftText, right: rightText });
			} else {
				diffResult = await invoke<DiffResult>('diff_compare', { left: leftText, right: rightText });
				unifiedResult = null;
			}
		} catch (e) {
			error = String(e);
		}
	}

	function clearAll() {
		leftText = '';
		rightText = '';
		diffResult = null;
		unifiedResult = null;
		error = null;
	}

	async function copyUnified() {
		if (!unifiedResult?.diffText) return;
		try { await invoke('clipboard_write_text', { text: unifiedResult.diffText }); }
		catch { /* ignore */ }
	}

	function swapSides() {
		const tmp = leftText;
		leftText = rightText;
		rightText = tmp;
		diffResult = null;
		unifiedResult = null;
	}
</script>

<div class="diff-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">+/-</span>
			<h3>Diff Viewer</h3>
		</div>
		<div class="header-actions">
			<div class="view-toggle">
				<button class="toggle-btn" class:active={viewMode === 'side'} onclick={() => viewMode = 'side'}>Side</button>
				<button class="toggle-btn" class:active={viewMode === 'unified'} onclick={() => viewMode = 'unified'}>Unified</button>
			</div>
			<button class="icon-btn" onclick={swapSides} title="Swap sides">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
				</svg>
			</button>
			<button class="icon-btn" onclick={clearAll} title="Clear">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<div class="input-grid">
		<div class="input-col">
			<label class="input-label">Original</label>
			<textarea class="text-area" placeholder="Paste original text..." bind:value={leftText} rows="5"></textarea>
		</div>
		<div class="input-col">
			<label class="input-label">Modified</label>
			<textarea class="text-area" placeholder="Paste modified text..." bind:value={rightText} rows="5"></textarea>
		</div>
	</div>

	<div class="action-row">
		<button class="action-btn primary" onclick={compare}>Compare</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if diffResult}
		<div class="stats-bar">
			<span class="stat added">+{diffResult.additions}</span>
			<span class="stat removed">-{diffResult.deletions}</span>
			<span class="stat unchanged">~{diffResult.unchanged}</span>
			<span class="stat-info">{diffResult.totalLeft} → {diffResult.totalRight} lines</span>
		</div>

		{#if viewMode === 'side'}
			<div class="diff-lines">
				{#each diffResult.lines as line}
					<div class="diff-line {line.kind}">
						<span class="line-num left">{line.leftLine ?? ''}</span>
						<span class="line-num right">{line.rightLine ?? ''}</span>
						<span class="line-marker">
							{#if line.kind === 'added'}+{:else if line.kind === 'removed'}-{:else}&nbsp;{/if}
						</span>
						<span class="line-content">{line.content}</span>
					</div>
				{/each}
			</div>
		{:else if unifiedResult}
			<div class="unified-section">
				<div class="unified-header">
					<span class="output-label">Unified Diff</span>
					<button class="small-btn" onclick={copyUnified} title="Copy">&#x1F4CB;</button>
				</div>
				{#if unifiedResult.hasChanges}
					<pre class="unified-text">{unifiedResult.diffText}</pre>
				{:else}
					<div class="no-changes">No differences found</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.diff-panel {
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
	.header-icon { font-size: 13px; font-weight: 700; color: #57f287; font-family: monospace; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 6px; align-items: center; }

	.view-toggle { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--border, #3f4147); }
	.toggle-btn {
		padding: 3px 10px; border: none; background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4); font-size: 11px; cursor: pointer;
	}
	.toggle-btn.active { background: #5865f2; color: #fff; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
	.input-col { display: flex; flex-direction: column; gap: 4px; }
	.input-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }

	.text-area {
		width: 100%;
		padding: 10px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		font-family: monospace;
		resize: vertical;
		box-sizing: border-box;
	}
	.text-area:focus { outline: none; border-color: #5865f2; }
	.text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.action-row { display: flex; gap: 4px; }
	.action-btn {
		padding: 6px 14px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.action-btn.primary { background: #5865f2; border-color: #5865f2; color: #fff; }
	.action-btn.primary:hover { background: #4752c4; }

	.error-msg { font-size: 12px; color: #ed4245; }

	.stats-bar {
		display: flex; align-items: center; gap: 10px;
		font-size: 12px; padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}
	.stat { font-weight: 600; font-family: monospace; }
	.stat.added { color: #57f287; }
	.stat.removed { color: #ed4245; }
	.stat.unchanged { color: var(--text-secondary, #949ba4); }
	.stat-info { color: var(--text-muted, #6d6f78); margin-left: auto; font-size: 11px; }

	.diff-lines {
		display: flex; flex-direction: column;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		max-height: 300px;
		overflow: auto;
		font-family: monospace;
		font-size: 12px;
	}
	.diff-line {
		display: flex; align-items: flex-start; padding: 1px 0;
		border-left: 3px solid transparent;
	}
	.diff-line.added { background: rgba(87, 242, 135, 0.08); border-left-color: #57f287; }
	.diff-line.removed { background: rgba(237, 66, 69, 0.08); border-left-color: #ed4245; }

	.line-num {
		width: 32px; text-align: right; padding: 0 6px;
		color: var(--text-muted, #6d6f78); font-size: 10px;
		user-select: none; flex-shrink: 0;
	}
	.line-marker {
		width: 14px; text-align: center; flex-shrink: 0;
		color: var(--text-muted, #6d6f78); font-weight: 600;
	}
	.diff-line.added .line-marker { color: #57f287; }
	.diff-line.removed .line-marker { color: #ed4245; }
	.line-content { flex: 1; padding-right: 8px; white-space: pre-wrap; word-break: break-all; }

	.unified-section { display: flex; flex-direction: column; gap: 6px; }
	.unified-header { display: flex; justify-content: space-between; align-items: center; }
	.output-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }

	.small-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 14px;
	}
	.small-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.unified-text {
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 12px;
		font-family: monospace;
		white-space: pre;
		max-height: 300px;
		overflow: auto;
		user-select: all;
		margin: 0;
	}

	.no-changes {
		padding: 16px; text-align: center;
		color: var(--text-muted, #6d6f78); font-size: 12px;
	}
</style>
