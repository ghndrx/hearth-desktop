<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ConversionResult {
		fromValue: number;
		fromUnit: string;
		toValue: number;
		toUnit: string;
		category: string;
	}

	interface UnitCategory {
		name: string;
		units: string[];
	}

	let categories = $state<UnitCategory[]>([]);
	let selectedCategory = $state('Length');
	let fromUnit = $state('m');
	let toUnit = $state('km');
	let inputValue = $state('1');
	let result = $state<ConversionResult | null>(null);
	let error = $state<string | null>(null);
	let history = $state<ConversionResult[]>([]);

	$effect(() => {
		const cat = categories.find(c => c.name === selectedCategory);
		if (cat && cat.units.length >= 2) {
			fromUnit = cat.units[0];
			toUnit = cat.units[1];
			result = null;
		}
	});

	onMount(async () => {
		try {
			categories = await invoke<UnitCategory[]>('unit_get_categories');
		} catch {
			categories = [];
		}
	});

	async function convert() {
		const val = parseFloat(inputValue);
		if (isNaN(val)) {
			error = 'Enter a valid number';
			return;
		}
		error = null;
		try {
			result = await invoke<ConversionResult>('unit_convert', {
				value: val, from: fromUnit, to: toUnit, category: selectedCategory
			});
			history = [result, ...history.slice(0, 9)];
		} catch (e) {
			error = String(e);
			result = null;
		}
	}

	function swap() {
		const tmp = fromUnit;
		fromUnit = toUnit;
		toUnit = tmp;
		if (result) {
			inputValue = formatNumber(result.toValue);
			convert();
		}
	}

	function formatNumber(n: number): string {
		if (Number.isInteger(n)) return n.toString();
		if (Math.abs(n) < 0.001 || Math.abs(n) > 1e9) return n.toExponential(4);
		return parseFloat(n.toPrecision(8)).toString();
	}

	function currentUnits(): string[] {
		return categories.find(c => c.name === selectedCategory)?.units ?? [];
	}
</script>

<div class="converter-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F4CF;</span>
			<h3>Unit Converter</h3>
		</div>
	</div>

	<div class="category-row">
		{#each categories as cat}
			<button
				class="cat-btn"
				class:active={selectedCategory === cat.name}
				onclick={() => { selectedCategory = cat.name; }}
			>
				{cat.name}
			</button>
		{/each}
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="convert-row">
		<div class="input-group">
			<input
				type="text"
				class="value-input"
				bind:value={inputValue}
				placeholder="Value"
				onkeydown={(e) => { if (e.key === 'Enter') convert(); }}
			/>
			<select class="unit-select" bind:value={fromUnit}>
				{#each currentUnits() as u}
					<option value={u}>{u}</option>
				{/each}
			</select>
		</div>

		<button class="swap-btn" onclick={swap} title="Swap units">&#x21C4;</button>

		<div class="input-group">
			<input
				type="text"
				class="value-input result-input"
				value={result ? formatNumber(result.toValue) : ''}
				readonly
				placeholder="Result"
			/>
			<select class="unit-select" bind:value={toUnit}>
				{#each currentUnits() as u}
					<option value={u}>{u}</option>
				{/each}
			</select>
		</div>
	</div>

	<button class="action-btn" onclick={convert}>Convert</button>

	{#if result}
		<div class="result-display">
			{formatNumber(result.fromValue)} {result.fromUnit} = {formatNumber(result.toValue)} {result.toUnit}
		</div>
	{/if}

	{#if history.length > 0}
		<div class="history-section">
			<span class="section-label">History</span>
			{#each history as item}
				<div class="history-item">
					<span>{formatNumber(item.fromValue)} {item.fromUnit}</span>
					<span class="arrow">&#x2192;</span>
					<span>{formatNumber(item.toValue)} {item.toUnit}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.converter-panel {
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

	.category-row { display: flex; gap: 4px; flex-wrap: wrap; }
	.cat-btn {
		padding: 5px 10px; border: none; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22); color: var(--text-secondary, #949ba4);
		font-size: 11px; font-weight: 500; cursor: pointer;
	}
	.cat-btn.active { background: #5865f2; color: white; }
	.cat-btn:hover:not(.active) { color: var(--text-primary, #dbdee1); }

	.error { font-size: 12px; color: #ed4245; }

	.convert-row { display: flex; align-items: center; gap: 8px; }
	.input-group { flex: 1; display: flex; flex-direction: column; gap: 4px; }

	.value-input {
		width: 100%; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147); background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 14px; font-family: monospace;
		box-sizing: border-box;
	}
	.value-input:focus { outline: none; border-color: #5865f2; }
	.value-input::placeholder { color: var(--text-muted, #6d6f78); }
	.result-input { background: rgba(88, 101, 242, 0.08); border-color: rgba(88, 101, 242, 0.3); }

	.unit-select {
		width: 100%; padding: 6px 8px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147); background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
	}

	.swap-btn {
		background: var(--bg-tertiary, #1e1f22); border: 1px solid var(--border, #3f4147);
		color: var(--text-secondary, #949ba4); border-radius: 6px;
		padding: 8px; cursor: pointer; font-size: 16px; flex-shrink: 0;
		margin-top: -20px;
	}
	.swap-btn:hover { color: #5865f2; border-color: #5865f2; }

	.action-btn {
		padding: 10px; border-radius: 6px; border: none;
		background: #5865f2; color: white; font-size: 13px;
		font-weight: 500; cursor: pointer; width: 100%;
	}
	.action-btn:hover { background: #4752c4; }

	.result-display {
		padding: 12px; border-radius: 6px; text-align: center;
		background: rgba(88, 101, 242, 0.1); color: #5865f2;
		font-size: 15px; font-weight: 600; font-family: monospace;
	}

	.history-section { display: flex; flex-direction: column; gap: 4px; }
	.section-label { font-size: 10px; color: var(--text-muted, #6d6f78); text-transform: uppercase; letter-spacing: 0.5px; }
	.history-item {
		display: flex; align-items: center; gap: 6px;
		padding: 6px 10px; background: var(--bg-tertiary, #1e1f22); border-radius: 6px;
		font-size: 12px; font-family: monospace; color: var(--text-secondary, #949ba4);
	}
	.arrow { color: var(--text-muted, #6d6f78); }
</style>
