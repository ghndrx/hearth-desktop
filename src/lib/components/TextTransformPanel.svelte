<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface TransformResult {
		inputLength: number;
		output: string;
		outputLength: number;
		transformType: string;
	}

	interface TextStats {
		characters: number;
		charactersNoSpaces: number;
		words: number;
		lines: number;
		sentences: number;
		paragraphs: number;
		bytes: number;
	}

	const transforms = [
		{ id: 'upper', name: 'UPPER', group: 'case' },
		{ id: 'lower', name: 'lower', group: 'case' },
		{ id: 'title', name: 'Title', group: 'case' },
		{ id: 'snake', name: 'snake_case', group: 'case' },
		{ id: 'camel', name: 'camelCase', group: 'case' },
		{ id: 'kebab', name: 'kebab-case', group: 'case' },
		{ id: 'reverse', name: 'Reverse', group: 'case' },
		{ id: 'base64_encode', name: 'Base64 Enc', group: 'encode' },
		{ id: 'base64_decode', name: 'Base64 Dec', group: 'encode' },
		{ id: 'url_encode', name: 'URL Enc', group: 'encode' },
		{ id: 'url_decode', name: 'URL Dec', group: 'encode' },
		{ id: 'sha256', name: 'SHA-256', group: 'hash' },
		{ id: 'sha1', name: 'SHA-1', group: 'hash' },
		{ id: 'md5', name: 'MD5', group: 'hash' },
	];

	let inputText = $state('');
	let outputText = $state('');
	let activeTransform = $state<string | null>(null);
	let stats = $state<TextStats | null>(null);
	let showStats = $state(false);
	let error = $state<string | null>(null);

	async function applyTransform(id: string) {
		if (!inputText.trim()) return;
		activeTransform = id;
		error = null;

		try {
			if (['upper', 'lower', 'title', 'snake', 'camel', 'kebab', 'reverse'].includes(id)) {
				const result = await invoke<TransformResult>('text_transform_case', { text: inputText, caseType: id });
				outputText = result.output;
			} else if (id === 'base64_encode') {
				const result = await invoke<TransformResult>('text_base64_encode', { text: inputText });
				outputText = result.output;
			} else if (id === 'base64_decode') {
				const result = await invoke<TransformResult>('text_base64_decode', { text: inputText });
				outputText = result.output;
			} else if (id === 'url_encode') {
				const result = await invoke<TransformResult>('text_url_encode', { text: inputText });
				outputText = result.output;
			} else if (id === 'url_decode') {
				const result = await invoke<TransformResult>('text_url_decode', { text: inputText });
				outputText = result.output;
			} else if (['sha256', 'sha1', 'md5'].includes(id)) {
				const result = await invoke<{ algorithm: string; hash: string; inputLength: number }>('text_hash', { text: inputText, algorithm: id });
				outputText = result.hash;
			}
		} catch (e) {
			error = String(e);
			outputText = '';
		}
	}

	async function loadStats() {
		if (!inputText) { stats = null; return; }
		try {
			stats = await invoke<TextStats>('text_get_stats', { text: inputText });
		} catch { stats = null; }
	}

	function toggleStats() {
		showStats = !showStats;
		if (showStats) loadStats();
	}

	async function copyOutput() {
		if (!outputText) return;
		try { await invoke('clipboard_write_text', { text: outputText }); }
		catch { /* ignore */ }
	}

	function swapTexts() {
		const tmp = inputText;
		inputText = outputText;
		outputText = tmp;
	}
</script>

<div class="transform-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F504;</span>
			<h3>Text Transform</h3>
		</div>
		<button class="icon-btn" class:active={showStats} onclick={toggleStats} title="Text stats">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<path d="M18 20V10M12 20V4M6 20v-6" />
			</svg>
		</button>
	</div>

	<textarea class="text-area" placeholder="Enter text to transform..." bind:value={inputText} rows="4"></textarea>

	{#if showStats && stats}
		<div class="stats-row">
			<span>{stats.characters} chars</span>
			<span>{stats.words} words</span>
			<span>{stats.lines} lines</span>
			<span>{stats.bytes} bytes</span>
		</div>
	{/if}

	<div class="transform-groups">
		<div class="group">
			<span class="group-label">Case</span>
			<div class="group-btns">
				{#each transforms.filter(t => t.group === 'case') as t}
					<button class="transform-btn" class:active={activeTransform === t.id} onclick={() => applyTransform(t.id)}>{t.name}</button>
				{/each}
			</div>
		</div>
		<div class="group">
			<span class="group-label">Encode</span>
			<div class="group-btns">
				{#each transforms.filter(t => t.group === 'encode') as t}
					<button class="transform-btn" class:active={activeTransform === t.id} onclick={() => applyTransform(t.id)}>{t.name}</button>
				{/each}
			</div>
		</div>
		<div class="group">
			<span class="group-label">Hash</span>
			<div class="group-btns">
				{#each transforms.filter(t => t.group === 'hash') as t}
					<button class="transform-btn" class:active={activeTransform === t.id} onclick={() => applyTransform(t.id)}>{t.name}</button>
				{/each}
			</div>
		</div>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if outputText}
		<div class="output-section">
			<div class="output-header">
				<span class="output-label">Result</span>
				<div class="output-actions">
					<button class="small-btn" onclick={swapTexts} title="Use as input">&#x21C5;</button>
					<button class="small-btn" onclick={copyOutput} title="Copy">&#x1F4CB;</button>
				</div>
			</div>
			<div class="output-text">{outputText}</div>
		</div>
	{/if}
</div>

<style>
	.transform-panel {
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
		font-size: 13px;
		font-family: monospace;
		resize: vertical;
		box-sizing: border-box;
	}
	.text-area:focus { outline: none; border-color: #5865f2; }
	.text-area::placeholder { color: var(--text-muted, #6d6f78); }

	.stats-row {
		display: flex;
		gap: 12px;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		padding: 4px 0;
	}

	.transform-groups { display: flex; flex-direction: column; gap: 8px; }
	.group { display: flex; flex-direction: column; gap: 4px; }
	.group-label { font-size: 10px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.5px; }
	.group-btns { display: flex; flex-wrap: wrap; gap: 4px; }

	.transform-btn {
		padding: 5px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		cursor: pointer;
		font-family: monospace;
	}
	.transform-btn:hover { color: var(--text-primary, #dbdee1); border-color: #5865f2; }
	.transform-btn.active { background: rgba(88, 101, 242, 0.15); border-color: #5865f2; color: #5865f2; }

	.error-msg { font-size: 12px; color: #ed4245; }

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
		word-break: break-all;
		max-height: 150px;
		overflow-y: auto;
		user-select: all;
	}
</style>
