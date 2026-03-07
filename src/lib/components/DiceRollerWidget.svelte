<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

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

	let expression = $state('d20');
	let lastRoll = $state<DiceRoll | null>(null);
	let history = $state<DiceRoll[]>([]);
	let rolling = $state(false);
	let error = $state<string | null>(null);

	const quickDice = [4, 6, 8, 10, 12, 20, 100];

	async function roll() {
		if (!expression.trim()) return;
		error = null;
		rolling = true;
		try {
			const result = await invoke<DiceRoll>('dice_roll', { expression: expression.trim() });
			lastRoll = result;
			history = [result, ...history.slice(0, 19)];
		} catch (e) {
			error = String(e);
		} finally {
			rolling = false;
		}
	}

	async function quickRoll(sides: number) {
		error = null;
		rolling = true;
		try {
			const result = await invoke<DiceRoll>('dice_roll_quick', { sides });
			lastRoll = result;
			expression = `d${sides}`;
			history = [result, ...history.slice(0, 19)];
		} catch (e) {
			error = String(e);
		} finally {
			rolling = false;
		}
	}

	function clearHistory() {
		history = [];
		invoke('dice_clear_history').catch(() => {});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') roll();
	}
</script>

<div class="dice-widget" class:compact>
	<div class="header">
		<span class="icon">🎲</span>
		{#if !compact}
			<span class="title">Dice Roller</span>
		{/if}
	</div>

	{#if lastRoll}
		<div class="result" class:rolling>
			<span class="total">{lastRoll.total}</span>
			<span class="detail">
				{lastRoll.expression}
				{#if lastRoll.rolls.length > 1}
					= [{lastRoll.rolls.map(r => r.value).join(', ')}]{#if lastRoll.modifier !== 0}{lastRoll.modifier > 0 ? '+' : ''}{lastRoll.modifier}{/if}
				{/if}
			</span>
		</div>
	{:else}
		<div class="result placeholder">
			<span class="total">?</span>
			<span class="detail">Roll some dice!</span>
		</div>
	{/if}

	<div class="quick-dice">
		{#each quickDice as sides}
			<button
				class="quick-btn"
				onclick={() => quickRoll(sides)}
				title="Roll d{sides}"
				disabled={rolling}
			>
				d{sides}
			</button>
		{/each}
	</div>

	{#if !compact}
		<div class="expression-input">
			<input
				type="text"
				bind:value={expression}
				onkeydown={handleKeydown}
				placeholder="e.g. 2d6+3"
				disabled={rolling}
			/>
			<button class="roll-btn" onclick={roll} disabled={rolling}>
				Roll
			</button>
		</div>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		{#if history.length > 0}
			<div class="history">
				<div class="history-header">
					<span>History ({history.length})</span>
					<button class="clear-btn" onclick={clearHistory} title="Clear history">x</button>
				</div>
				<div class="history-list">
					{#each history as roll, i}
						<div class="history-item" class:latest={i === 0}>
							<span class="hist-expr">{roll.expression}</span>
							<span class="hist-rolls">
								[{roll.rolls.map(r => r.value).join(', ')}]{#if roll.modifier !== 0}{roll.modifier > 0 ? '+' : ''}{roll.modifier}{/if}
							</span>
							<span class="hist-total">= {roll.total}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.dice-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.dice-widget.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.icon {
		font-size: 14px;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.result {
		text-align: center;
		padding: 10px 0;
		border-radius: 6px;
		background: var(--bg-primary, #36393f);
		transition: transform 0.15s ease;
	}

	.result.rolling {
		animation: shake 0.3s ease;
	}

	.result.placeholder {
		opacity: 0.5;
	}

	.compact .result {
		padding: 6px 0;
	}

	@keyframes shake {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-8deg); }
		50% { transform: rotate(8deg); }
		75% { transform: rotate(-4deg); }
	}

	.total {
		display: block;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 32px;
		font-weight: 700;
		color: var(--text-primary, #fff);
	}

	.compact .total {
		font-size: 24px;
	}

	.detail {
		display: block;
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-top: 2px;
	}

	.quick-dice {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.quick-btn {
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		background: var(--bg-primary, #36393f);
		color: var(--text-secondary, #b9bbbe);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.compact .quick-btn {
		padding: 3px 6px;
		font-size: 10px;
	}

	.quick-btn:hover:not(:disabled) {
		background: var(--accent, #5865f2);
		color: white;
		border-color: var(--accent, #5865f2);
		transform: scale(1.05);
	}

	.quick-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.quick-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.expression-input {
		display: flex;
		gap: 6px;
	}

	input {
		flex: 1;
		padding: 6px 10px;
		border-radius: 4px;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		background: var(--bg-primary, #36393f);
		color: var(--text-primary, #dcddde);
		font-size: 13px;
		font-family: 'SF Mono', 'Fira Code', monospace;
		outline: none;
	}

	input:focus {
		border-color: var(--accent, #5865f2);
	}

	input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.roll-btn {
		padding: 6px 14px;
		border-radius: 4px;
		border: none;
		background: var(--accent, #5865f2);
		color: white;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease, transform 0.1s ease;
	}

	.roll-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.roll-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.roll-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		font-size: 11px;
		color: var(--error, #ed4245);
		padding: 4px 8px;
		background: rgba(237, 66, 69, 0.1);
		border-radius: 4px;
	}

	.history {
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		padding-top: 8px;
	}

	.history-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-bottom: 6px;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 14px;
		padding: 0 4px;
	}

	.clear-btn:hover {
		color: var(--error, #ed4245);
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
		max-height: 120px;
		overflow-y: auto;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 4px;
		font-size: 11px;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.history-item.latest {
		background: rgba(88, 101, 242, 0.1);
		border-left: 2px solid var(--accent, #5865f2);
	}

	.hist-expr {
		color: var(--text-muted, #72767d);
		min-width: 40px;
	}

	.hist-rolls {
		flex: 1;
		color: var(--text-secondary, #b9bbbe);
	}

	.hist-total {
		color: var(--text-primary, #dcddde);
		font-weight: 600;
	}
</style>
