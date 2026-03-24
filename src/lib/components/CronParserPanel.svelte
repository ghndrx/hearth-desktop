<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface CronFields {
		minute: string;
		hour: string;
		dayOfMonth: string;
		month: string;
		dayOfWeek: string;
		minuteDesc: string;
		hourDesc: string;
		domDesc: string;
		monthDesc: string;
		dowDesc: string;
	}

	interface CronParseResult {
		expression: string;
		isValid: boolean;
		description: string;
		nextRuns: string[];
		fields: CronFields;
	}

	let expression = $state('');
	let result = $state<CronParseResult | null>(null);
	let presets = $state<[string, string][]>([]);
	let history = $state<CronParseResult[]>([]);
	let error = $state<string | null>(null);
	let showPresets = $state(false);

	onMount(async () => {
		try {
			presets = await invoke<[string, string][]>('cron_get_presets');
			history = await invoke<CronParseResult[]>('cron_get_history');
		} catch {}
	});

	async function parseCron() {
		if (!expression.trim()) return;
		error = null;
		try {
			result = await invoke<CronParseResult>('cron_parse', { expression: expression.trim() });
			history = await invoke<CronParseResult[]>('cron_get_history');
		} catch (e) {
			error = String(e);
		}
	}

	function applyPreset(expr: string) {
		expression = expr;
		showPresets = false;
		parseCron();
	}

	async function clearHistory() {
		await invoke('cron_clear_history');
		history = [];
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') parseCron();
	}

	function handleFieldInput(field: string, value: string) {
		const parts = (expression || '* * * * *').trim().split(/\s+/);
		while (parts.length < 5) parts.push('*');

		const idx = { minute: 0, hour: 1, dom: 2, month: 3, dow: 4 }[field] ?? 0;
		parts[idx] = value || '*';
		expression = parts.join(' ');
		parseCron();
	}
</script>

<div class="cron-panel">
	<div class="panel-header">
		<h3>Cron Expression Parser</h3>
	</div>

	<div class="input-section">
		<div class="input-row">
			<input
				type="text"
				bind:value={expression}
				placeholder="* * * * * (min hour dom mon dow)"
				onkeydown={handleKeydown}
				class="cron-input"
			/>
			<button class="btn-primary" onclick={parseCron} disabled={!expression.trim()}>Parse</button>
		</div>
		<div class="input-actions">
			<button class="btn-text" onclick={() => showPresets = !showPresets}>
				{showPresets ? 'Hide' : 'Show'} Presets
			</button>
		</div>
	</div>

	{#if showPresets}
		<div class="presets-grid">
			{#each presets as [expr, desc]}
				<button class="preset-item" onclick={() => applyPreset(expr)}>
					<code>{expr}</code>
					<span>{desc}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if result}
		<div class="result-card" class:invalid={!result.isValid}>
			<div class="description">
				{#if result.isValid}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a6e3a1" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f38ba8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
				{/if}
				<span>{result.description}</span>
			</div>

			{#if result.isValid}
				<div class="fields-grid">
					<div class="field-item">
						<label>Minute</label>
						<input type="text" value={result.fields.minute}
							oninput={(e) => handleFieldInput('minute', (e.target as HTMLInputElement).value)} />
						<span class="field-desc">{result.fields.minuteDesc}</span>
					</div>
					<div class="field-item">
						<label>Hour</label>
						<input type="text" value={result.fields.hour}
							oninput={(e) => handleFieldInput('hour', (e.target as HTMLInputElement).value)} />
						<span class="field-desc">{result.fields.hourDesc}</span>
					</div>
					<div class="field-item">
						<label>Day (Month)</label>
						<input type="text" value={result.fields.dayOfMonth}
							oninput={(e) => handleFieldInput('dom', (e.target as HTMLInputElement).value)} />
						<span class="field-desc">{result.fields.domDesc}</span>
					</div>
					<div class="field-item">
						<label>Month</label>
						<input type="text" value={result.fields.month}
							oninput={(e) => handleFieldInput('month', (e.target as HTMLInputElement).value)} />
						<span class="field-desc">{result.fields.monthDesc}</span>
					</div>
					<div class="field-item">
						<label>Day (Week)</label>
						<input type="text" value={result.fields.dayOfWeek}
							oninput={(e) => handleFieldInput('dow', (e.target as HTMLInputElement).value)} />
						<span class="field-desc">{result.fields.dowDesc}</span>
					</div>
				</div>

				{#if result.nextRuns.length > 0}
					<div class="next-runs">
						<h4>Next Runs</h4>
						{#each result.nextRuns as run, i}
							<div class="run-item">
								<span class="run-index">{i + 1}</span>
								<code>{run}</code>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	{#if history.length > 0}
		<div class="history-section">
			<div class="history-header">
				<span>History ({history.length})</span>
				<button class="btn-text" onclick={clearHistory}>Clear</button>
			</div>
			<div class="history-list">
				{#each history.slice(0, 8) as entry}
					<button class="history-item" onclick={() => { expression = entry.expression; parseCron(); }}>
						<code>{entry.expression}</code>
						<span class="history-desc">{entry.description}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.cron-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		padding: 16px;
		gap: 12px;
		overflow-y: auto;
	}
	.panel-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}
	.input-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.input-row {
		display: flex;
		gap: 8px;
	}
	.cron-input {
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		background: var(--bg-secondary, #181825);
		color: var(--text-primary, #cdd6f4);
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 15px;
		letter-spacing: 2px;
		outline: none;
	}
	.cron-input:focus {
		border-color: var(--brand-primary, #8b94f7);
	}
	.input-actions {
		display: flex;
		justify-content: flex-end;
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
	}
	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-text {
		background: none;
		border: none;
		color: var(--brand-primary, #8b94f7);
		cursor: pointer;
		font-size: 12px;
	}
	.presets-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	.preset-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		background: var(--bg-secondary, #181825);
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: border-color 0.15s;
		width: 100%;
	}
	.preset-item:hover {
		border-color: var(--brand-primary, #8b94f7);
	}
	.preset-item code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 12px;
		color: var(--brand-primary, #8b94f7);
	}
	.preset-item span {
		font-size: 11px;
		color: var(--text-muted, #6c7086);
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
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.result-card.invalid {
		border-color: rgba(243, 139, 168, 0.4);
	}
	.description {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 500;
	}
	.fields-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 8px;
	}
	.field-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.field-item label {
		font-size: 10px;
		color: var(--text-muted, #6c7086);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.field-item input {
		padding: 6px 8px;
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		background: var(--bg-primary, #1e1e2e);
		color: var(--text-primary, #cdd6f4);
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 14px;
		text-align: center;
		outline: none;
		width: 100%;
		box-sizing: border-box;
	}
	.field-item input:focus {
		border-color: var(--brand-primary, #8b94f7);
	}
	.field-desc {
		font-size: 10px;
		color: var(--text-muted, #6c7086);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.next-runs {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.next-runs h4 {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted, #6c7086);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.run-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 10px;
		background: var(--bg-primary, #1e1e2e);
		border-radius: 6px;
	}
	.run-index {
		font-size: 11px;
		color: var(--text-muted, #6c7086);
		min-width: 16px;
	}
	.run-item code {
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 13px;
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
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.history-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		background: var(--bg-secondary, #181825);
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
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
		color: var(--brand-primary, #8b94f7);
	}
	.history-desc {
		font-size: 12px;
		color: var(--text-muted, #6c7086);
	}
</style>
