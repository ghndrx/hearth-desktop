<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	interface UuidResult {
		uuid: string;
		format: string;
		version: string;
		timestamp: string;
	}

	let lastUuid = $state<UuidResult | null>(null);
	let copied = $state(false);
	let format = $state('standard');
	let error = $state<string | null>(null);

	const formats = [
		{ value: 'standard', label: 'Standard' },
		{ value: 'uppercase', label: 'UPPER' },
		{ value: 'no-dashes', label: 'No Dashes' },
		{ value: 'braces', label: '{Braces}' },
		{ value: 'urn', label: 'URN' },
	];

	async function generate() {
		error = null;
		try {
			lastUuid = await invoke<UuidResult>('uuid_generate', { format });
		} catch (e) {
			error = String(e);
		}
	}

	async function copyToClipboard() {
		if (!lastUuid) return;
		try {
			await navigator.clipboard.writeText(lastUuid.uuid);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// fallback
		}
	}
</script>

<div class="uuid-widget" class:compact>
	<div class="header">
		<span class="icon">&#x1F511;</span>
		{#if !compact}
			<span class="title">UUID Generator</span>
		{/if}
	</div>

	{#if lastUuid}
		<button class="uuid-display" onclick={copyToClipboard} title="Click to copy">
			<span class="uuid-text">{lastUuid.uuid}</span>
			<span class="copy-hint">{copied ? 'Copied!' : 'Copy'}</span>
		</button>
	{:else}
		<div class="uuid-display placeholder">
			<span class="uuid-text">Click generate</span>
		</div>
	{/if}

	{#if !compact}
		<div class="format-row">
			{#each formats as fmt}
				<button
					class="format-btn"
					class:active={format === fmt.value}
					onclick={() => (format = fmt.value)}
				>
					{fmt.label}
				</button>
			{/each}
		</div>
	{/if}

	<button class="gen-btn" onclick={generate}>Generate</button>

	{#if error}
		<div class="error">{error}</div>
	{/if}
</div>

<style>
	.uuid-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.uuid-widget.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.icon { font-size: 14px; }

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.uuid-display {
		padding: 10px;
		border-radius: 6px;
		background: var(--bg-primary, #36393f);
		border: 1px solid transparent;
		cursor: pointer;
		text-align: center;
		transition: border-color 0.15s ease;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.uuid-display:hover {
		border-color: var(--accent, #5865f2);
	}

	.uuid-display.placeholder {
		cursor: default;
		opacity: 0.5;
	}

	.uuid-text {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		word-break: break-all;
	}

	.compact .uuid-text {
		font-size: 10px;
	}

	.copy-hint {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.format-row {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.format-btn {
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		background: var(--bg-primary, #36393f);
		color: var(--text-secondary, #b9bbbe);
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.format-btn:hover {
		border-color: var(--accent, #5865f2);
		color: var(--text-primary, #dcddde);
	}

	.format-btn.active {
		background: var(--accent, #5865f2);
		color: white;
		border-color: var(--accent, #5865f2);
	}

	.gen-btn {
		padding: 8px;
		border-radius: 6px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.gen-btn:hover { background: #4752c4; }
	.gen-btn:active { transform: scale(0.98); }

	.compact .gen-btn {
		padding: 6px;
		font-size: 11px;
	}

	.error {
		font-size: 11px;
		color: var(--error, #ed4245);
		padding: 4px 8px;
		background: rgba(237, 66, 69, 0.1);
		border-radius: 4px;
	}
</style>
