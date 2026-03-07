<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface RegexMatch {
		fullMatch: string;
		start: number;
		end: number;
		groups: (string | null)[];
	}

	interface RegexTestResult {
		valid: boolean;
		matches: RegexMatch[];
		matchCount: number;
		executionTimeUs: number;
	}

	interface RegexReplaceResult {
		output: string;
		replacements: number;
	}

	let pattern = $state('');
	let testText = $state('');
	let replacement = $state('');
	let caseInsensitive = $state(false);
	let globalReplace = $state(true);
	let showReplace = $state(false);
	let error = $state<string | null>(null);
	let result = $state<RegexTestResult | null>(null);
	let replaceResult = $state<RegexReplaceResult | null>(null);

	async function testPattern() {
		if (!pattern.trim() || !testText.trim()) return;
		error = null;
		replaceResult = null;
		try {
			result = await invoke<RegexTestResult>('regex_test', {
				pattern,
				text: testText,
				caseInsensitive
			});
		} catch (e) {
			error = String(e);
			result = null;
		}
	}

	async function doReplace() {
		if (!pattern.trim() || !testText.trim()) return;
		error = null;
		try {
			replaceResult = await invoke<RegexReplaceResult>('regex_replace', {
				pattern,
				text: testText,
				replacement,
				global: globalReplace,
				caseInsensitive
			});
		} catch (e) {
			error = String(e);
			replaceResult = null;
		}
	}

	function clearAll() {
		pattern = '';
		testText = '';
		replacement = '';
		error = null;
		result = null;
		replaceResult = null;
	}

	function highlightMatches(text: string, matches: RegexMatch[]): string {
		if (!matches.length) return escapeHtml(text);
		let out = '';
		let last = 0;
		for (const m of matches) {
			out += escapeHtml(text.slice(last, m.start));
			out += `<mark class="match-highlight">${escapeHtml(m.fullMatch)}</mark>`;
			last = m.end;
		}
		out += escapeHtml(text.slice(last));
		return out;
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
</script>

<div class="regex-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">.*</span>
			<h3>Regex Tester</h3>
		</div>
		<div class="header-actions">
			<button class="icon-btn" class:active={showReplace} onclick={() => showReplace = !showReplace} title="Replace mode">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
					<path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
				</svg>
			</button>
			<button class="icon-btn" onclick={clearAll} title="Clear">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<div class="pattern-row">
		<span class="pattern-delim">/</span>
		<input class="pattern-input" type="text" placeholder="Enter regex pattern..." bind:value={pattern}
			onkeydown={(e) => { if (e.key === 'Enter') testPattern(); }} />
		<span class="pattern-delim">/</span>
		<label class="flag-toggle" title="Case insensitive">
			<input type="checkbox" bind:checked={caseInsensitive} />
			<span>i</span>
		</label>
	</div>

	<textarea class="text-area" placeholder="Enter test string..." bind:value={testText} rows="4"></textarea>

	{#if showReplace}
		<div class="replace-row">
			<input class="replace-input" type="text" placeholder="Replacement text..." bind:value={replacement} />
			<label class="flag-toggle" title="Global replace">
				<input type="checkbox" bind:checked={globalReplace} />
				<span>g</span>
			</label>
		</div>
	{/if}

	<div class="action-row">
		<button class="action-btn primary" onclick={testPattern}>Test</button>
		{#if showReplace}
			<button class="action-btn" onclick={doReplace}>Replace</button>
		{/if}
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if result}
		<div class="result-bar">
			<span class="match-count">{result.matchCount} match{result.matchCount !== 1 ? 'es' : ''}</span>
			<span class="exec-time">{result.executionTimeUs}us</span>
		</div>

		{#if result.matchCount > 0}
			<div class="highlighted-text">{@html highlightMatches(testText, result.matches)}</div>

			<div class="matches-list">
				{#each result.matches as match, i}
					<div class="match-item">
						<span class="match-index">#{i + 1}</span>
						<code class="match-text">{match.fullMatch}</code>
						<span class="match-pos">[{match.start}:{match.end}]</span>
						{#if match.groups.length > 0}
							<div class="match-groups">
								{#each match.groups as group, gi}
									<span class="group-badge">
										${gi + 1}: {group ?? 'null'}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	{#if replaceResult}
		<div class="output-section">
			<div class="output-header">
				<span class="output-label">Result ({replaceResult.replacements} replacement{replaceResult.replacements !== 1 ? 's' : ''})</span>
			</div>
			<pre class="output-text">{replaceResult.output}</pre>
		</div>
	{/if}
</div>

<style>
	.regex-panel {
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
	.header-icon { font-size: 14px; font-weight: 700; color: #ed4245; font-family: monospace; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 4px; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover, .icon-btn.active { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

	.pattern-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
	}
	.pattern-row:focus-within { border-color: #ed4245; }
	.pattern-delim { color: #ed4245; font-family: monospace; font-weight: 600; font-size: 14px; }
	.pattern-input {
		flex: 1;
		background: none; border: none; color: var(--text-primary, #dbdee1);
		font-family: monospace; font-size: 13px; outline: none;
	}
	.pattern-input::placeholder { color: var(--text-muted, #6d6f78); }

	.flag-toggle {
		display: flex; align-items: center; cursor: pointer;
		font-family: monospace; font-size: 13px; color: var(--text-muted, #6d6f78);
	}
	.flag-toggle input { display: none; }
	.flag-toggle input:checked + span { color: #ed4245; font-weight: 700; }

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
	.text-area:focus { outline: none; border-color: #ed4245; }
	.text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.replace-row {
		display: flex; gap: 6px; align-items: center;
	}
	.replace-input {
		flex: 1;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 12px;
		font-family: monospace;
	}
	.replace-input:focus { outline: none; border-color: #ed4245; }
	.replace-input::placeholder { color: var(--text-muted, #6d6f78); }

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
	.action-btn:hover { color: var(--text-primary, #dbdee1); border-color: #ed4245; }
	.action-btn.primary { background: #ed4245; border-color: #ed4245; color: #fff; }
	.action-btn.primary:hover { background: #d63638; }

	.error-msg { font-size: 12px; color: #ed4245; }

	.result-bar {
		display: flex; justify-content: space-between; align-items: center;
		font-size: 11px; color: var(--text-secondary, #949ba4);
	}
	.match-count { font-weight: 600; color: #57f287; }
	.exec-time { color: var(--text-muted, #6d6f78); }

	.highlighted-text {
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-family: monospace;
		font-size: 12px;
		white-space: pre-wrap;
		word-break: break-all;
		line-height: 1.6;
	}
	:global(.match-highlight) {
		background: rgba(237, 66, 69, 0.25);
		color: #ed4245;
		border-radius: 2px;
		padding: 1px 2px;
	}

	.matches-list { display: flex; flex-direction: column; gap: 4px; }
	.match-item {
		display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
		padding: 4px 8px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 4px;
		font-size: 11px;
	}
	.match-index { color: var(--text-muted, #6d6f78); font-weight: 600; }
	.match-text { color: #ed4245; }
	.match-pos { color: var(--text-muted, #6d6f78); font-family: monospace; }
	.match-groups { display: flex; gap: 4px; flex-wrap: wrap; }
	.group-badge {
		padding: 1px 6px; border-radius: 3px;
		background: rgba(88, 101, 242, 0.15); color: #5865f2;
		font-size: 10px; font-family: monospace;
	}

	.output-section { display: flex; flex-direction: column; gap: 6px; }
	.output-header { display: flex; justify-content: space-between; align-items: center; }
	.output-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }

	.output-text {
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 12px;
		font-family: monospace;
		white-space: pre-wrap;
		max-height: 200px;
		overflow: auto;
		user-select: all;
		margin: 0;
	}
</style>
