<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface EpochConversion {
		epochSeconds: number;
		epochMillis: number;
		utcIso: string;
		utcReadable: string;
		localIso: string;
		localReadable: string;
		relative: string;
		dayOfWeek: string;
		dayOfYear: number;
		weekNumber: number;
		isLeapYear: boolean;
	}

	let mode = $state<'now' | 'timestamp' | 'date'>('now');
	let timestampInput = $state('');
	let dateInput = $state('');
	let result = $state<EpochConversion | null>(null);
	let history = $state<EpochConversion[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let copiedField = $state<string | null>(null);

	onMount(async () => {
		await getCurrentTime();
		try {
			history = await invoke<EpochConversion[]>('epoch_get_history');
		} catch {}
	});

	async function getCurrentTime() {
		loading = true;
		error = null;
		try {
			result = await invoke<EpochConversion>('epoch_get_now');
			history = await invoke<EpochConversion[]>('epoch_get_history');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function convertTimestamp() {
		if (!timestampInput.trim()) return;
		loading = true;
		error = null;
		try {
			const ts = parseInt(timestampInput.trim(), 10);
			if (isNaN(ts)) throw 'Invalid number';
			result = await invoke<EpochConversion>('epoch_from_timestamp', { timestamp: ts });
			history = await invoke<EpochConversion[]>('epoch_get_history');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function convertDate() {
		if (!dateInput.trim()) return;
		loading = true;
		error = null;
		try {
			result = await invoke<EpochConversion>('epoch_from_date', { dateString: dateInput.trim() });
			history = await invoke<EpochConversion[]>('epoch_get_history');
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function clearHistory() {
		await invoke('epoch_clear_history');
		history = [];
	}

	function copyValue(label: string, value: string) {
		navigator.clipboard.writeText(value);
		copiedField = label;
		setTimeout(() => { copiedField = null; }, 1500);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (mode === 'timestamp') convertTimestamp();
			else if (mode === 'date') convertDate();
		}
	}
</script>

<div class="epoch-panel">
	<div class="panel-header">
		<h3>Epoch Converter</h3>
		<button class="btn-refresh" onclick={getCurrentTime} title="Current time">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
		</button>
	</div>

	<div class="mode-tabs">
		<button class="tab" class:active={mode === 'now'} onclick={() => { mode = 'now'; getCurrentTime(); }}>Now</button>
		<button class="tab" class:active={mode === 'timestamp'} onclick={() => mode = 'timestamp'}>Timestamp</button>
		<button class="tab" class:active={mode === 'date'} onclick={() => mode = 'date'}>Date String</button>
	</div>

	{#if mode === 'timestamp'}
		<div class="input-row">
			<input
				type="text"
				bind:value={timestampInput}
				placeholder="Enter epoch (seconds or milliseconds)"
				onkeydown={handleKeydown}
			/>
			<button class="btn-primary" onclick={convertTimestamp} disabled={loading || !timestampInput.trim()}>Convert</button>
		</div>
	{:else if mode === 'date'}
		<div class="input-row">
			<input
				type="text"
				bind:value={dateInput}
				placeholder="e.g. 2024-01-15 14:30:00"
				onkeydown={handleKeydown}
			/>
			<button class="btn-primary" onclick={convertDate} disabled={loading || !dateInput.trim()}>Convert</button>
		</div>
	{/if}

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if result}
		<div class="result-card">
			<div class="result-grid">
				<button class="field" onclick={() => copyValue('epoch', String(result!.epochSeconds))}>
					<span class="label">Epoch (seconds)</span>
					<code class="value">{result.epochSeconds}</code>
					{#if copiedField === 'epoch'}<span class="copied">Copied!</span>{/if}
				</button>
				<button class="field" onclick={() => copyValue('millis', String(result!.epochMillis))}>
					<span class="label">Epoch (ms)</span>
					<code class="value">{result.epochMillis}</code>
					{#if copiedField === 'millis'}<span class="copied">Copied!</span>{/if}
				</button>
				<button class="field" onclick={() => copyValue('utc', result!.utcReadable)}>
					<span class="label">UTC</span>
					<code class="value">{result.utcReadable}</code>
					{#if copiedField === 'utc'}<span class="copied">Copied!</span>{/if}
				</button>
				<button class="field" onclick={() => copyValue('local', result!.localReadable)}>
					<span class="label">Local</span>
					<code class="value">{result.localReadable}</code>
					{#if copiedField === 'local'}<span class="copied">Copied!</span>{/if}
				</button>
				<button class="field" onclick={() => copyValue('iso', result!.utcIso)}>
					<span class="label">ISO 8601</span>
					<code class="value">{result.utcIso}</code>
					{#if copiedField === 'iso'}<span class="copied">Copied!</span>{/if}
				</button>
				<button class="field" onclick={() => copyValue('relative', result!.relative)}>
					<span class="label">Relative</span>
					<code class="value">{result.relative}</code>
					{#if copiedField === 'relative'}<span class="copied">Copied!</span>{/if}
				</button>
			</div>

			<div class="extra-info">
				<span>{result.dayOfWeek}</span>
				<span>Day {result.dayOfYear}</span>
				<span>Week {result.weekNumber}</span>
				{#if result.isLeapYear}<span class="badge">Leap Year</span>{/if}
			</div>
		</div>
	{/if}

	{#if history.length > 1}
		<div class="history-section">
			<div class="history-header">
				<span>Recent ({history.length})</span>
				<button class="btn-text" onclick={clearHistory}>Clear</button>
			</div>
			<div class="history-list">
				{#each history.slice(1, 10) as entry}
					<button class="history-item" onclick={() => { timestampInput = String(entry.epochSeconds); mode = 'timestamp'; convertTimestamp(); }}>
						<code>{entry.epochSeconds}</code>
						<span class="history-date">{entry.utcReadable}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.epoch-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}
	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.btn-refresh {
		background: none;
		border: none;
		color: var(--text-muted, #6c7086);
		cursor: pointer;
		padding: 6px;
		border-radius: 6px;
	}
	.btn-refresh:hover {
		color: var(--text-primary, #cdd6f4);
		background: var(--bg-secondary, #181825);
	}
	.mode-tabs {
		display: flex;
		gap: 4px;
		background: var(--bg-secondary, #181825);
		border-radius: 8px;
		padding: 4px;
	}
	.tab {
		flex: 1;
		padding: 8px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #a6adc8);
		border-radius: 6px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.15s;
	}
	.tab.active {
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		font-weight: 500;
	}
	.input-row {
		display: flex;
		gap: 8px;
	}
	input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		background: var(--bg-secondary, #181825);
		color: var(--text-primary, #cdd6f4);
		font-size: 14px;
		outline: none;
	}
	input:focus {
		border-color: var(--brand-primary, #8b94f7);
	}
	.btn-primary {
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		background: var(--brand-primary, #8b94f7);
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		padding: 10px;
		border-radius: 8px;
		background: rgba(243, 139, 168, 0.15);
		color: #f38ba8;
		font-size: 13px;
	}
	.result-card {
		background: var(--bg-secondary, #181825);
		border-radius: 10px;
		padding: 14px;
		border: 1px solid var(--border-color, #313244);
	}
	.result-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		background: var(--bg-primary, #1e1e2e);
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: border-color 0.15s;
		width: 100%;
		position: relative;
	}
	.field:hover {
		border-color: var(--brand-primary, #8b94f7);
	}
	.label {
		font-size: 11px;
		color: var(--text-muted, #6c7086);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.value {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 13px;
		word-break: break-all;
	}
	.copied {
		position: absolute;
		top: 4px;
		right: 8px;
		font-size: 10px;
		color: #a6e3a1;
	}
	.extra-info {
		display: flex;
		gap: 12px;
		padding-top: 12px;
		margin-top: 12px;
		border-top: 1px solid var(--border-color, #313244);
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}
	.badge {
		background: rgba(166, 227, 161, 0.15);
		color: #a6e3a1;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
	}
	.history-section {
		margin-top: 4px;
	}
	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: var(--text-muted, #6c7086);
		margin-bottom: 8px;
	}
	.btn-text {
		background: none;
		border: none;
		color: var(--brand-primary, #8b94f7);
		cursor: pointer;
		font-size: 12px;
	}
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.history-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: var(--bg-secondary, #181825);
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		cursor: pointer;
		color: inherit;
		transition: border-color 0.15s;
		width: 100%;
	}
	.history-item:hover {
		border-color: var(--brand-primary, #8b94f7);
	}
	.history-item code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 13px;
	}
	.history-date {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}
</style>
