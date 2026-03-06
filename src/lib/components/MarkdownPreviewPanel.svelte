<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface MarkdownResult {
		html: string;
		wordCount: number;
		lineCount: number;
		charCount: number;
	}

	let input = $state('# Hello World\n\nType some **Markdown** here and see a *live preview*.\n\n- Item one\n- Item two\n- Item three\n\n> Blockquotes work too!\n\n```js\nconsole.log("code blocks!");\n```\n\n---\n\n1. Ordered lists\n2. Are supported\n3. As well\n\nVisit [Hearth](https://hearth.chat) for more info.');
	let result = $state<MarkdownResult | null>(null);
	let error = $state<string | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let viewMode = $state<'split' | 'edit' | 'preview'>('split');

	onMount(() => {
		render();
	});

	async function render() {
		error = null;
		try {
			result = await invoke<MarkdownResult>('markdown_render', { text: input });
		} catch (e) {
			error = String(e);
		}
	}

	function onInput(e: Event) {
		input = (e.target as HTMLTextAreaElement).value;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(render, 150);
	}
</script>

<div class="md-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F4DD;</span>
			<h3>Markdown Preview</h3>
		</div>
		<div class="view-tabs">
			<button class="view-tab" class:active={viewMode === 'edit'} onclick={() => viewMode = 'edit'}>Edit</button>
			<button class="view-tab" class:active={viewMode === 'split'} onclick={() => viewMode = 'split'}>Split</button>
			<button class="view-tab" class:active={viewMode === 'preview'} onclick={() => viewMode = 'preview'}>Preview</button>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="editor-container" class:split={viewMode === 'split'} class:edit-only={viewMode === 'edit'} class:preview-only={viewMode === 'preview'}>
		{#if viewMode !== 'preview'}
			<div class="editor-pane">
				<textarea
					class="md-input"
					value={input}
					oninput={onInput}
					placeholder="Type Markdown here..."
					spellcheck="false"
				></textarea>
			</div>
		{/if}
		{#if viewMode !== 'edit'}
			<div class="preview-pane">
				{#if result}
					<div class="md-rendered">{@html result.html}</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if result}
		<div class="stats-bar">
			<span>{result.wordCount} words</span>
			<span>{result.lineCount} lines</span>
			<span>{result.charCount} chars</span>
		</div>
	{/if}
</div>

<style>
	.md-panel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
		height: 100%;
		min-height: 400px;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.error { font-size: 12px; color: #ed4245; }

	.view-tabs { display: flex; gap: 2px; }
	.view-tab {
		padding: 4px 10px;
		border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.view-tab:hover { border-color: #5865f2; color: #5865f2; }
	.view-tab.active { background: #5865f2; border-color: #5865f2; color: white; }

	.editor-container {
		display: flex;
		flex: 1;
		gap: 10px;
		min-height: 0;
		overflow: hidden;
	}
	.editor-container.split .editor-pane,
	.editor-container.split .preview-pane { flex: 1; min-width: 0; }
	.editor-container.edit-only .editor-pane { flex: 1; }
	.editor-container.preview-only .preview-pane { flex: 1; }

	.editor-pane { display: flex; flex-direction: column; }

	.md-input {
		flex: 1;
		resize: none;
		padding: 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 13px;
		line-height: 1.6;
		tab-size: 2;
	}
	.md-input:focus { outline: none; border-color: #5865f2; }

	.preview-pane {
		overflow-y: auto;
		padding: 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
	}

	.stats-bar {
		display: flex;
		gap: 16px;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		padding-top: 4px;
		border-top: 1px solid var(--border, #3f4147);
	}

	/* Rendered markdown styles */
	.md-rendered :global(h1) { font-size: 22px; font-weight: 700; margin: 0 0 12px; border-bottom: 1px solid var(--border, #3f4147); padding-bottom: 6px; }
	.md-rendered :global(h2) { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
	.md-rendered :global(h3) { font-size: 15px; font-weight: 600; margin: 12px 0 6px; }
	.md-rendered :global(h4) { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
	.md-rendered :global(h5) { font-size: 12px; font-weight: 600; margin: 8px 0 4px; }
	.md-rendered :global(h6) { font-size: 11px; font-weight: 600; margin: 8px 0 4px; color: var(--text-secondary, #949ba4); }

	.md-rendered :global(p) { margin: 0 0 10px; line-height: 1.6; font-size: 13px; }
	.md-rendered :global(strong) { font-weight: 700; }
	.md-rendered :global(em) { font-style: italic; }
	.md-rendered :global(del) { text-decoration: line-through; opacity: 0.7; }

	.md-rendered :global(a) { color: #5865f2; text-decoration: none; }
	.md-rendered :global(a:hover) { text-decoration: underline; }

	.md-rendered :global(code) {
		background: rgba(88, 101, 242, 0.15);
		padding: 2px 6px;
		border-radius: 3px;
		font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 12px;
	}
	.md-rendered :global(pre) {
		background: #1a1b1e;
		padding: 12px;
		border-radius: 6px;
		overflow-x: auto;
		margin: 0 0 10px;
	}
	.md-rendered :global(pre code) { background: none; padding: 0; font-size: 12px; line-height: 1.5; }

	.md-rendered :global(blockquote) {
		border-left: 3px solid #5865f2;
		margin: 0 0 10px;
		padding: 6px 12px;
		color: var(--text-secondary, #949ba4);
		font-size: 13px;
	}

	.md-rendered :global(ul),
	.md-rendered :global(ol) {
		margin: 0 0 10px;
		padding-left: 24px;
		font-size: 13px;
		line-height: 1.6;
	}
	.md-rendered :global(li) { margin-bottom: 2px; }

	.md-rendered :global(hr) {
		border: none;
		border-top: 1px solid var(--border, #3f4147);
		margin: 12px 0;
	}

	.md-rendered :global(img) {
		max-width: 100%;
		border-radius: 6px;
		margin: 4px 0;
	}
</style>
