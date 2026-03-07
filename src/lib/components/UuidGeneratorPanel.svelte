<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface UuidResult {
		uuid: string;
		format: string;
		version: string;
		timestamp: string;
	}

	let results = $state<UuidResult[]>([]);
	let history = $state<UuidResult[]>([]);
	let format = $state('standard');
	let batchCount = $state(5);
	let error = $state<string | null>(null);
	let copied = $state<string | null>(null);
	let validateInput = $state('');
	let validateResult = $state<boolean | null>(null);

	const formats = [
		{ value: 'standard', label: 'Standard', example: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' },
		{ value: 'uppercase', label: 'Uppercase', example: 'XXXXXXXX-XXXX-4XXX-YXXX-XXXXXXXXXXXX' },
		{ value: 'no-dashes', label: 'No Dashes', example: 'xxxxxxxx4xxxyxxxxxxxxxxxxxxx' },
		{ value: 'braces', label: 'Braces', example: '{xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx}' },
		{ value: 'urn', label: 'URN', example: 'urn:uuid:xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' },
	];

	onMount(async () => {
		try {
			history = await invoke<UuidResult[]>('uuid_get_history');
		} catch {
			// No history yet
		}
	});

	async function generate() {
		error = null;
		try {
			const result = await invoke<UuidResult>('uuid_generate', { format });
			results = [result];
			history = [result, ...history.slice(0, 49)];
		} catch (e) {
			error = String(e);
		}
	}

	async function generateBatch() {
		error = null;
		try {
			const batch = await invoke<UuidResult[]>('uuid_generate_batch', {
				count: batchCount,
				format,
			});
			results = batch;
			history = [...batch, ...history].slice(0, 50);
		} catch (e) {
			error = String(e);
		}
	}

	async function validate() {
		if (!validateInput.trim()) return;
		try {
			validateResult = await invoke<boolean>('uuid_validate', { input: validateInput.trim() });
		} catch (e) {
			error = String(e);
		}
	}

	async function copyUuid(uuid: string) {
		try {
			await navigator.clipboard.writeText(uuid);
			copied = uuid;
			setTimeout(() => (copied = null), 1500);
		} catch {
			// fallback
		}
	}

	async function copyAll() {
		const text = results.map((r) => r.uuid).join('\n');
		try {
			await navigator.clipboard.writeText(text);
			copied = '__all__';
			setTimeout(() => (copied = null), 1500);
		} catch {
			// fallback
		}
	}

	async function clearHistory() {
		try {
			await invoke('uuid_clear_history');
			history = [];
		} catch (e) {
			error = String(e);
		}
	}

	function handleValidateKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') validate();
	}
</script>

<div class="uuid-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F511;</span>
			<h3>UUID Generator</h3>
		</div>
		<span class="version-badge">v4 (Random)</span>
	</div>

	<div class="format-section">
		<span class="section-label">Format</span>
		<div class="format-grid">
			{#each formats as fmt}
				<button
					class="format-btn"
					class:active={format === fmt.value}
					onclick={() => (format = fmt.value)}
					title={fmt.example}
				>
					{fmt.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="actions-row">
		<button class="action-btn primary" onclick={generate}>Generate One</button>
		<div class="batch-group">
			<input
				type="number"
				class="batch-input"
				bind:value={batchCount}
				min="2"
				max="100"
			/>
			<button class="action-btn" onclick={generateBatch}>Batch</button>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if results.length > 0}
		<div class="results-section">
			<div class="results-header">
				<span class="section-label">Generated ({results.length})</span>
				{#if results.length > 1}
					<button class="copy-all-btn" onclick={copyAll}>
						{copied === '__all__' ? 'Copied!' : 'Copy All'}
					</button>
				{/if}
			</div>
			<div class="results-list">
				{#each results as result}
					<button class="result-row" onclick={() => copyUuid(result.uuid)}>
						<span class="uuid-val">{result.uuid}</span>
						<span class="copy-label">{copied === result.uuid ? 'Copied!' : 'Copy'}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="validate-section">
		<span class="section-label">Validate UUID</span>
		<div class="validate-row">
			<input
				type="text"
				class="validate-input"
				placeholder="Paste a UUID to validate..."
				bind:value={validateInput}
				onkeydown={handleValidateKeydown}
			/>
			<button class="action-btn" onclick={validate} disabled={!validateInput.trim()}>
				Check
			</button>
		</div>
		{#if validateResult !== null}
			<div class="validate-result" class:valid={validateResult} class:invalid={!validateResult}>
				{validateResult ? 'Valid UUID' : 'Invalid UUID'}
			</div>
		{/if}
	</div>

	{#if history.length > 0}
		<div class="history-section">
			<div class="history-header">
				<span class="section-label">History ({history.length})</span>
				<button class="clear-btn" onclick={clearHistory}>Clear</button>
			</div>
			<div class="history-list">
				{#each history.slice(0, 15) as entry}
					<button class="history-item" onclick={() => copyUuid(entry.uuid)}>
						<span class="hist-uuid">{entry.uuid}</span>
						<span class="hist-format">{entry.format}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.uuid-panel {
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

	.version-badge {
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 10px;
		background: rgba(88, 101, 242, 0.15);
		color: #5865f2;
		font-weight: 600;
	}

	.section-label {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}

	.format-section { display: flex; flex-direction: column; gap: 6px; }

	.format-grid {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.format-btn {
		padding: 6px 10px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.format-btn:hover {
		border-color: #5865f2;
		color: var(--text-primary, #dbdee1);
	}
	.format-btn.active {
		background: #5865f2;
		color: white;
		border-color: #5865f2;
	}

	.actions-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.batch-group {
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.batch-input {
		width: 50px;
		padding: 8px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		text-align: center;
	}
	.batch-input:focus { outline: none; border-color: #5865f2; }

	.action-btn {
		padding: 8px 14px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.action-btn:hover:not(:disabled) { border-color: #5865f2; }
	.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.action-btn.primary {
		background: #5865f2;
		border-color: #5865f2;
		color: white;
		flex: 1;
	}
	.action-btn.primary:hover { background: #4752c4; }

	.error { font-size: 12px; color: #ed4245; }

	.results-section { display: flex; flex-direction: column; gap: 6px; }

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.copy-all-btn {
		background: none;
		border: none;
		color: #5865f2;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		padding: 2px 6px;
	}
	.copy-all-btn:hover { text-decoration: underline; }

	.results-list { display: flex; flex-direction: column; gap: 3px; }

	.result-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		cursor: pointer;
		transition: border-color 0.15s ease;
		text-align: left;
	}
	.result-row:hover { border-color: #5865f2; }

	.uuid-val {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 12px;
		color: var(--text-primary, #dbdee1);
		word-break: break-all;
	}

	.copy-label {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		white-space: nowrap;
		margin-left: 8px;
	}

	.validate-section { display: flex; flex-direction: column; gap: 6px; }

	.validate-row { display: flex; gap: 6px; }

	.validate-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: monospace;
	}
	.validate-input::placeholder { color: var(--text-muted, #6d6f78); }
	.validate-input:focus { outline: none; border-color: #5865f2; }

	.validate-result {
		font-size: 12px;
		font-weight: 600;
		padding: 6px 10px;
		border-radius: 6px;
	}
	.validate-result.valid {
		color: #57f287;
		background: rgba(87, 242, 135, 0.1);
	}
	.validate-result.invalid {
		color: #ed4245;
		background: rgba(237, 66, 69, 0.1);
	}

	.history-section { display: flex; flex-direction: column; gap: 4px; }

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
		cursor: pointer;
		padding: 2px 6px;
	}
	.clear-btn:hover { color: #ed4245; }

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 180px;
		overflow-y: auto;
	}

	.history-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 5px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s ease;
	}
	.history-item:hover { background: rgba(88, 101, 242, 0.1); }

	.hist-uuid {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.hist-format {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
	}
</style>
