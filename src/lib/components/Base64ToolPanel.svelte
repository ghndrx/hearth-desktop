<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Base64Result {
		output: string;
		inputSize: number;
		outputSize: number;
	}

	let inputText = $state('');
	let outputText = $state('');
	let urlSafe = $state(false);
	let error = $state<string | null>(null);
	let lastAction = $state<string | null>(null);
	let inputSize = $state(0);
	let outputSize = $state(0);

	async function encode() {
		if (!inputText.trim()) return;
		error = null;
		try {
			const result = await invoke<Base64Result>('base64_encode', { text: inputText, urlSafe });
			outputText = result.output;
			inputSize = result.inputSize;
			outputSize = result.outputSize;
			lastAction = 'encode';
		} catch (e) {
			error = String(e);
			outputText = '';
		}
	}

	async function decode() {
		if (!inputText.trim()) return;
		error = null;
		try {
			const result = await invoke<Base64Result>('base64_decode', { encoded: inputText, urlSafe });
			outputText = result.output;
			inputSize = result.inputSize;
			outputSize = result.outputSize;
			lastAction = 'decode';
		} catch (e) {
			error = String(e);
			outputText = '';
		}
	}

	async function copyOutput() {
		if (!outputText) return;
		try { await invoke('clipboard_write_text', { text: outputText }); }
		catch { /* ignore */ }
	}

	function swap() {
		if (!outputText) return;
		inputText = outputText;
		outputText = '';
		error = null;
	}

	function clearAll() {
		inputText = '';
		outputText = '';
		error = null;
		lastAction = null;
		inputSize = 0;
		outputSize = 0;
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
</script>

<div class="b64-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">B64</span>
			<h3>Base64 Tool</h3>
		</div>
		<div class="header-actions">
			<label class="url-safe-toggle" title="URL-safe encoding">
				<input type="checkbox" bind:checked={urlSafe} />
				<span>URL</span>
			</label>
			<button class="icon-btn" onclick={clearAll} title="Clear">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	<textarea class="text-area" placeholder="Enter text to encode, or Base64 to decode..." bind:value={inputText} rows="5"></textarea>

	<div class="action-row">
		<button class="action-btn encode" onclick={encode}>Encode</button>
		<button class="action-btn decode" onclick={decode}>Decode</button>
		<button class="action-btn swap" onclick={swap} title="Use output as input">&#x21C5;</button>
	</div>

	{#if error}
		<div class="error-msg">{error}</div>
	{/if}

	{#if outputText}
		<div class="output-section">
			<div class="output-header">
				<span class="output-label">
					{lastAction === 'encode' ? 'Encoded' : 'Decoded'}
					<span class="size-info">{formatSize(inputSize)} → {formatSize(outputSize)}</span>
				</span>
				<button class="small-btn" onclick={copyOutput} title="Copy">&#x1F4CB;</button>
			</div>
			<pre class="output-text">{outputText}</pre>
		</div>
	{/if}
</div>

<style>
	.b64-panel {
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
	.header-icon {
		font-size: 11px; font-weight: 700; color: #fee75c; font-family: monospace;
		padding: 2px 5px; background: rgba(254, 231, 92, 0.15); border-radius: 3px;
	}
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 6px; align-items: center; }

	.url-safe-toggle {
		display: flex; align-items: center; cursor: pointer;
		font-size: 11px; color: var(--text-muted, #6d6f78);
		padding: 2px 6px; border-radius: 3px;
		background: var(--bg-tertiary, #1e1f22);
	}
	.url-safe-toggle input { display: none; }
	.url-safe-toggle input:checked + span { color: #fee75c; font-weight: 600; }

	.icon-btn {
		background: none; border: none; color: var(--text-secondary, #949ba4);
		cursor: pointer; padding: 4px; border-radius: 4px;
	}
	.icon-btn:hover { color: var(--text-primary, #dbdee1); background: var(--bg-tertiary, #1e1f22); }

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
	.text-area:focus { outline: none; border-color: #fee75c; }
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
	.action-btn:hover { color: var(--text-primary, #dbdee1); border-color: #fee75c; }
	.action-btn.encode { background: #fee75c; border-color: #fee75c; color: #1e1f22; font-weight: 600; }
	.action-btn.encode:hover { background: #fdd835; }
	.action-btn.decode { background: #5865f2; border-color: #5865f2; color: #fff; }
	.action-btn.decode:hover { background: #4752c4; }
	.action-btn.swap { font-size: 16px; padding: 4px 10px; }

	.error-msg { font-size: 12px; color: #ed4245; }

	.output-section { display: flex; flex-direction: column; gap: 6px; }
	.output-header { display: flex; justify-content: space-between; align-items: center; }
	.output-label { font-size: 11px; color: var(--text-secondary, #949ba4); text-transform: uppercase; letter-spacing: 0.5px; }
	.size-info { color: var(--text-muted, #6d6f78); margin-left: 8px; text-transform: none; }

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
		white-space: pre-wrap;
		word-break: break-all;
		max-height: 200px;
		overflow: auto;
		user-select: all;
		margin: 0;
	}
</style>
