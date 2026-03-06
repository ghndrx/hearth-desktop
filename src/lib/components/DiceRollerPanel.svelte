<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface SingleDie {
		sides: number;
		value: number;
	}

	interface DiceRoll {
		expression: string;
		rolls: SingleDie[];
		modifier: number;
		total: number;
		timestamp: string;
	}

	let result = $state<DiceRoll | null>(null);
	let error = $state<string | null>(null);
	let expression = $state('');
	let history = $state<DiceRoll[]>([]);
	let rolling = $state(false);

	const presets = [
		{ label: 'd4', expr: 'd4' },
		{ label: 'd6', expr: 'd6' },
		{ label: 'd8', expr: 'd8' },
		{ label: 'd10', expr: 'd10' },
		{ label: 'd12', expr: 'd12' },
		{ label: 'd20', expr: 'd20' },
		{ label: 'd100', expr: 'd100' },
		{ label: '2d6', expr: '2d6' },
	];

	onMount(async () => {
		try {
			history = await invoke<DiceRoll[]>('dice_get_history');
		} catch {
			// No history yet
		}
	});

	async function roll(expr: string) {
		error = null;
		rolling = true;
		try {
			result = await invoke<DiceRoll>('dice_roll', { expression: expr });
			history = [result, ...history.slice(0, 19)];
		} catch (e) {
			error = String(e);
			result = null;
		}
		rolling = false;
	}

	async function rollCustom() {
		if (!expression.trim()) return;
		await roll(expression.trim());
	}

	async function clearHistory() {
		try {
			await invoke('dice_clear_history');
			history = [];
		} catch (e) {
			error = String(e);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			rollCustom();
		}
	}

	function maxValue(sides: number): boolean {
		return false; // helper used in template
	}
</script>

<div class="dice-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F3B2;</span>
			<h3>Dice Roller</h3>
		</div>
	</div>

	<div class="presets-grid">
		{#each presets as preset}
			<button class="preset-btn" onclick={() => roll(preset.expr)} disabled={rolling}>
				{preset.label}
			</button>
		{/each}
	</div>

	<div class="custom-row">
		<input
			type="text"
			class="expr-input"
			placeholder="e.g. 3d6+2, 2d10-1"
			bind:value={expression}
			onkeydown={handleKeydown}
		/>
		<button class="roll-btn" onclick={rollCustom} disabled={rolling || !expression.trim()}>
			Roll
		</button>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if result}
		<div class="result-box">
			<div class="result-expr">{result.expression}</div>
			<div class="dice-row">
				{#each result.rolls as die}
					<div class="die" class:crit={die.value === die.sides} class:min={die.value === 1}>
						{die.value}
					</div>
				{/each}
				{#if result.modifier !== 0}
					<span class="modifier">{result.modifier > 0 ? '+' : ''}{result.modifier}</span>
				{/if}
			</div>
			<div class="total">= {result.total}</div>
		</div>
	{/if}

	{#if history.length > 0}
		<div class="history-section">
			<div class="history-header">
				<span class="section-label">History</span>
				<button class="clear-btn" onclick={clearHistory}>Clear</button>
			</div>
			{#each history.slice(result ? 1 : 0, 10) as roll}
				<div class="history-item">
					<span class="hist-expr">{roll.expression}</span>
					<span class="hist-dice">
						[{roll.rolls.map(d => d.value).join(', ')}]{roll.modifier ? (roll.modifier > 0 ? '+' + roll.modifier : roll.modifier) : ''}
					</span>
					<span class="hist-total">= {roll.total}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dice-panel {
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

	.presets-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
	}

	.preset-btn {
		padding: 8px 4px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.preset-btn:hover:not(:disabled) {
		background: #5865f2;
		color: white;
		border-color: #5865f2;
	}
	.preset-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.custom-row {
		display: flex;
		gap: 6px;
	}

	.expr-input {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid var(--border, #3f4147);
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: monospace;
	}
	.expr-input::placeholder { color: var(--text-muted, #6d6f78); }
	.expr-input:focus { outline: none; border-color: #5865f2; }

	.roll-btn {
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		background: #5865f2;
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.roll-btn:hover:not(:disabled) { background: #4752c4; }
	.roll-btn:disabled { opacity: 0.5; cursor: not-allowed; }

	.error { font-size: 12px; color: #ed4245; }

	.result-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px;
		border-radius: 8px;
		background: var(--bg-tertiary, #1e1f22);
		border: 1px solid var(--border, #3f4147);
	}

	.result-expr {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase;
		letter-spacing: 1px;
		font-weight: 600;
	}

	.dice-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.die {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--bg-secondary, #2b2d31);
		border: 2px solid var(--border, #3f4147);
		font-size: 16px;
		font-weight: 700;
		font-family: monospace;
	}

	.die.crit {
		border-color: #57f287;
		color: #57f287;
		background: rgba(87, 242, 135, 0.1);
	}

	.die.min {
		border-color: #ed4245;
		color: #ed4245;
		background: rgba(237, 66, 69, 0.1);
	}

	.modifier {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-secondary, #949ba4);
	}

	.total {
		font-size: 28px;
		font-weight: 700;
		color: #5865f2;
	}

	.history-section { display: flex; flex-direction: column; gap: 4px; }

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.section-label {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
		text-transform: uppercase;
		letter-spacing: 0.5px;
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

	.history-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		font-size: 12px;
	}

	.hist-expr {
		font-weight: 600;
		color: var(--text-secondary, #949ba4);
		min-width: 50px;
	}

	.hist-dice {
		flex: 1;
		font-family: monospace;
		color: var(--text-muted, #6d6f78);
		font-size: 11px;
	}

	.hist-total {
		font-weight: 700;
		color: var(--text-primary, #dbdee1);
	}
</style>
