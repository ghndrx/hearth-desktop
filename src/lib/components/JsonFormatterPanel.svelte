<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface FormatResult {
		output: string;
		inputSize: number;
		outputSize: number;
		valid: boolean;
	}

	interface ValidationResult {
		valid: boolean;
		error: string | null;
		errorLine: number | null;
		errorColumn: number | null;
	}

	interface JsonStats {
		valid: boolean;
		maxDepth: number;
		totalKeys: number;
		totalValues: number;
		typeCounts: {
			objects: number;
			arrays: number;
			strings: number;
			numbers: number;
			booleans: number;
			nulls: number;
		};
		sizeBytes: number;
	}

	interface QueryResult {
		found: boolean;
		value: string | null;
		valueType: string | null;
		path: string;
	}

	let inputText = $state('');
	let outputText = $state('');
	let indentSize = $state(2);
	let error = $state<string | null>(null);
	let validation = $state<ValidationResult | null>(null);
	let stats = $state<JsonStats | null>(null);
	let showStats = $state(false);
	let queryPath = $state('');
	let queryResult = $state<QueryResult | null>(null);
	let showQuery = $state(false);

	async function format() {
		if (!inputText.trim()) return;
		error = null;
		try {
			const result = await invoke<FormatResult>('json_format', { text: inputText, indent: indentSize });
			outputText = result.output;
			validation = { valid: true, error: null, errorLine: null, errorColumn: null };
		} catch (e) {
			error = String(e);
			outputText = '';
		}
	}

	async function minify() {
		if (!inputText.trim()) return;
		error = null;
		try {
			const result = await invoke<FormatResult>('json_minify', { text: inputText });
			outputText = result.output;
			validation = { valid: true, error: null, errorLine: null, errorColumn: null };
		} catch (e) {
			error = String(e);
			outputText = '';
		}
	}

	async function validate() {
		if (!inputText.trim()) return;
		error = null;
		try {
			validation = await invoke<ValidationResult>('json_validate', { text: inputText });
			if (validation.valid) {
				error = null;
			} else {
				error = validation.error;
			}
		} catch (e) {
			error = String(e);
		}
	}

	async function loadStats() {
		if (!inputText.trim()) { stats = null; return; }
		try {
			stats = await invoke<JsonStats>('json_stats', { text: inputText });
		} catch { stats = null; }
	}

	async function runQuery() {
		if (!inputText.trim() || !queryPath.trim()) return;
		try {
			queryResult = await invoke<QueryResult>('json_query', { text: inputText, path: queryPath });
			if (queryResult.found && queryResult.value) {
				outputText = queryResult.value;
			}
		} catch (e) {
			error = String(e);
		}
	}

	function toggleStats() {
		showStats = !showStats;
		if (showStats) loadStats();
	}

	function toggleQuery() {
		showQuery = !showQuery;
	}

	async function copyOutput() {
		if (!outputText) return;
		try { await invoke('clipboard_write_text', { text: outputText }); }
		catch { /* ignore */ }
	}

	function useOutputAsInput() {
		if (!outputText) return;
		inputText = outputText;
		outputText = '';
	}

	function clearAll() {
		inputText = '';
		outputText = '';
		error = null;
		validation = null;
		stats = null;
		queryResult = null;
	}
</script>

<div class="json-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">{'{}'}</span>
			<h3>JSON Formatter</h3>
		</div>
		<div class="header-actions">
			<button class="icon-btn" class:active={showQuery} onclick={toggleQuery} title="JSON path query">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
				</svg>
			</button>
			<button class="icon-btn" class:active={showStats} onclick={toggleStats} title="JSON stats">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 20V10M12 20V4M6 20v-6" />
				</svg>
			</button>
			<button class="icon-btn" onclick={clearAll} title="Clear">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<textarea class="text-area" placeholder="Paste JSON here..." bind:value={inputText} rows="6"></textarea>

	{#if showQuery}
		<div class="query-row">
			<input class="query-input" type="text" placeholder="Path (e.g. data.users.0.name)" bind:value={queryPath}
				onkeydown={(e) => { if (e.key === 'Enter') runQuery(); }} />
			<button class="action-btn" onclick={runQuery}>Query</button>
		</div>
		{#if queryResult}
			<div class="query-result" class:not-found={!queryResult.found}>
				{#if queryResult.found}
					<span class="query-type">{queryResult.valueType}</span>
				{:else}
					<span>Path not found</span>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="action-row">
		<div class="action-group">
			<button class="action-btn primary" onclick={format}>Format</button>
			<button class="action-btn" onclick={minify}>Minify</button>
			<button class="action-btn" onclick={validate}>Validate</button>
		</div>
		<div class="indent-control">
			<label for="indent-select">Indent</label>
			<select id="indent-select" bind:value={indentSize}>
				<option value={2}>2</option>
				<option value={4}>4</option>
				<option value={8}>8</option>
				<option value={1}>1 (tab)</option>
			</select>
		</div>
	</div>

	{#if validation}
		<div class="validation-badge" class:valid={validation.valid} class:invalid={!validation.valid}>
			{#if validation.valid}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
					<path d="M20 6 9 17l-5-5" />
				</svg>
				Valid JSON
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
				Invalid{#if validation.errorLine} (line {validation.errorLine}, col {validation.errorColumn}){/if}
			{/if}
		</div>
	{/if}

	{#if error && !validation}
		<div class="error-msg">{error}</div>
	{/if}

	{#if showStats && stats}
		<div class="stats-grid">
			<div class="stat"><span class="stat-label">Depth</span><span class="stat-value">{stats.maxDepth}</span></div>
			<div class="stat"><span class="stat-label">Keys</span><span class="stat-value">{stats.totalKeys}</span></div>
			<div class="stat"><span class="stat-label">Values</span><span class="stat-value">{stats.totalValues}</span></div>
			<div class="stat"><span class="stat-label">Size</span><span class="stat-value">{stats.sizeBytes}B</span></div>
			<div class="stat"><span class="stat-label">Objects</span><span class="stat-value">{stats.typeCounts.objects}</span></div>
			<div class="stat"><span class="stat-label">Arrays</span><span class="stat-value">{stats.typeCounts.arrays}</span></div>
			<div class="stat"><span class="stat-label">Strings</span><span class="stat-value">{stats.typeCounts.strings}</span></div>
			<div class="stat"><span class="stat-label">Numbers</span><span class="stat-value">{stats.typeCounts.numbers}</span></div>
		</div>
	{/if}

	{#if outputText}
		<div class="output-section">
			<div class="output-header">
				<span class="output-label">Result</span>
				<div class="output-actions">
					<button class="small-btn" onclick={useOutputAsInput} title="Use as input">&#x21C5;</button>
					<button class="small-btn" onclick={copyOutput} title="Copy">&#x1F4CB;</button>
				</div>
			</div>
			<pre class="output-text">{outputText}</pre>
		</div>
	{/if}
</div>

<style>
	.json-panel {
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
	.header-icon { font-size: 16px; font-weight: 700; color: #5865f2; font-family: monospace; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 4px; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover, .icon-btn.active { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

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
		tab-size: 2;
	}
	.text-area:focus { outline: none; border-color: #5865f2; }
	.text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.query-row { display: flex; gap: 6px; }
	.query-input {
		flex: 1;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		font-family: monospace;
	}
	.query-input:focus { outline: none; border-color: #5865f2; }
	.query-input::placeholder { color: var(--text-muted, #6d6f78); }

	.query-result {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		padding: 4px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}
	.query-result.not-found { color: #ed4245; }
	.query-type {
		padding: 1px 6px;
		border-radius: 3px;
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
		font-size: 10px;
	}

	.action-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
	.action-group { display: flex; gap: 4px; }

	.action-btn {
		padding: 6px 14px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		cursor: pointer;
	}
	.action-btn:hover { color: var(--text-primary, #dbdee1); border-color: #5865f2; }
	.action-btn.primary { background: #5865f2; border-color: #5865f2; color: #fff; }
	.action-btn.primary:hover { background: #4752c4; }

	.indent-control { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary, #949ba4); }
	.indent-control select {
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 11px;
	}

	.validation-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		padding: 6px 10px;
		border-radius: 4px;
	}
	.validation-badge.valid { background: rgba(87, 242, 135, 0.1); color: #57f287; }
	.validation-badge.invalid { background: rgba(237, 66, 69, 0.1); color: #ed4245; }

	.error-msg { font-size: 12px; color: #ed4245; }

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
	}
	.stat-label { font-size: 9px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.5px; }
	.stat-value { font-size: 14px; font-weight: 600; color: var(--text-primary, #dbdee1); }

	.output-section { display: flex; flex-direction: column; gap: 6px; }
	.output-header { display: flex; justify-content: space-between; align-items: center; }
	.output-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }
	.output-actions { display: flex; gap: 4px; }

	.small-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 14px;
	}
	.small-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.output-text {
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 12px;
		font-family: monospace;
		white-space: pre;
		max-height: 200px;
		overflow: auto;
		user-select: all;
		margin: 0;
	}
</style>
