<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	type CoinSide = 'heads' | 'tails';

	interface CoinFlipStats {
		total: number;
		heads: number;
		tails: number;
		currentStreak: number;
		currentStreakSide: CoinSide | null;
		longestStreak: number;
		longestStreakSide: CoinSide | null;
		history: { side: CoinSide; timestamp: string }[];
	}

	let stats = $state<CoinFlipStats | null>(null);
	let lastSide = $state<CoinSide | null>(null);
	let flipping = $state(false);
	let flipCount = $state(0);

	async function flip() {
		flipping = true;
		flipCount++;
		try {
			const result = await invoke<CoinFlipStats>('coinflip_flip');
			stats = result;
			lastSide = result.history[0]?.side ?? null;
		} catch {
			// silently ignore
		} finally {
			setTimeout(() => {
				flipping = false;
			}, 400);
		}
	}

	function clearHistory() {
		invoke('coinflip_clear').catch(() => {});
		stats = null;
		lastSide = null;
	}

	function headsPercent(): string {
		if (!stats || stats.total === 0) return '50';
		return ((stats.heads / stats.total) * 100).toFixed(1);
	}
</script>

<div class="coin-widget" class:compact>
	<div class="header">
		<span class="title">Coin Flip</span>
	</div>

	<button class="coin" class:flipping onclick={flip} disabled={flipping} style="--flip-count: {flipCount}">
		<div class="coin-face">
			{#if lastSide === 'heads'}
				<span class="coin-symbol">H</span>
			{:else if lastSide === 'tails'}
				<span class="coin-symbol">T</span>
			{:else}
				<span class="coin-symbol">?</span>
			{/if}
		</div>
	</button>

	{#if lastSide}
		<div class="result-label">{lastSide === 'heads' ? 'Heads' : 'Tails'}!</div>
	{:else}
		<div class="result-label muted">Tap to flip</div>
	{/if}

	{#if stats && stats.total > 0 && !compact}
		<div class="stats">
			<div class="stat-bar">
				<div class="bar-fill heads" style="width: {headsPercent()}%"></div>
			</div>
			<div class="stat-row">
				<span class="stat heads-text">H: {stats.heads}</span>
				<span class="stat">{stats.total} flips</span>
				<span class="stat tails-text">T: {stats.tails}</span>
			</div>
			{#if stats.currentStreak > 1}
				<div class="streak">
					{stats.currentStreak}x {stats.currentStreakSide === 'heads' ? 'Heads' : 'Tails'} streak
				</div>
			{/if}
			{#if stats.longestStreak > 1}
				<div class="streak best">
					Best: {stats.longestStreak}x {stats.longestStreakSide === 'heads' ? 'Heads' : 'Tails'}
				</div>
			{/if}
		</div>

		<div class="history-strip">
			{#each stats.history.slice(0, 20) as flip, i}
				<span class="dot" class:heads={flip.side === 'heads'} class:latest={i === 0} title={flip.side}></span>
			{/each}
		</div>

		<button class="clear-btn" onclick={clearHistory}>Reset</button>
	{/if}
</div>

<style>
	.coin-widget {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 12px;
		background: var(--bg-tertiary, #40444b);
		border-radius: 8px;
	}

	.coin-widget.compact {
		padding: 8px;
		gap: 6px;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.coin {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		border: 3px solid var(--accent, #5865f2);
		background: linear-gradient(135deg, var(--bg-primary, #36393f), var(--bg-secondary, #2f3136));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s ease, box-shadow 0.15s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		perspective: 400px;
	}

	.compact .coin {
		width: 56px;
		height: 56px;
	}

	.coin:hover:not(:disabled) {
		box-shadow: 0 4px 16px rgba(88, 101, 242, 0.3);
		transform: scale(1.05);
	}

	.coin:active:not(:disabled) {
		transform: scale(0.95);
	}

	.coin:disabled {
		cursor: not-allowed;
	}

	.coin.flipping {
		animation: coinFlip 0.4s ease;
	}

	@keyframes coinFlip {
		0% { transform: rotateY(0deg) scale(1); }
		50% { transform: rotateY(540deg) scale(1.15); }
		100% { transform: rotateY(1080deg) scale(1); }
	}

	.coin-face {
		pointer-events: none;
	}

	.coin-symbol {
		font-size: 28px;
		font-weight: 800;
		color: var(--accent, #5865f2);
		font-family: 'SF Mono', 'Fira Code', monospace;
		user-select: none;
	}

	.compact .coin-symbol {
		font-size: 22px;
	}

	.result-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.result-label.muted {
		color: var(--text-muted, #72767d);
		font-weight: 400;
		font-size: 12px;
	}

	.stats {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat-bar {
		width: 100%;
		height: 4px;
		background: var(--bg-primary, #36393f);
		border-radius: 2px;
		overflow: hidden;
	}

	.bar-fill.heads {
		height: 100%;
		background: var(--accent, #5865f2);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.heads-text {
		color: var(--accent, #5865f2);
	}

	.tails-text {
		color: var(--text-secondary, #b9bbbe);
	}

	.streak {
		text-align: center;
		font-size: 11px;
		color: var(--warning, #faa61a);
		font-weight: 500;
	}

	.streak.best {
		color: var(--text-muted, #72767d);
		font-weight: 400;
	}

	.history-strip {
		display: flex;
		gap: 3px;
		flex-wrap: wrap;
		justify-content: center;
		max-width: 100%;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted, #72767d);
		transition: transform 0.15s ease;
	}

	.dot.heads {
		background: var(--accent, #5865f2);
	}

	.dot.latest {
		transform: scale(1.3);
		box-shadow: 0 0 4px rgba(88, 101, 242, 0.5);
	}

	.clear-btn {
		background: none;
		border: 1px solid var(--bg-modifier-accent, #4f545c);
		color: var(--text-muted, #72767d);
		font-size: 11px;
		padding: 3px 10px;
		border-radius: 4px;
		cursor: pointer;
	}

	.clear-btn:hover {
		color: var(--text-primary, #dcddde);
		border-color: var(--text-muted, #72767d);
	}
</style>
