<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface TypingSession {
		start_time: number;
		end_time: number;
		char_count: number;
		word_count: number;
		wpm: number;
		accuracy: number;
	}

	interface TypingStats {
		current_wpm: number;
		peak_wpm: number;
		average_wpm: number;
		total_words_typed: number;
		total_chars_typed: number;
		total_sessions: number;
		average_accuracy: number;
		today_words: number;
		today_sessions: number;
		today_date: string;
		recent_sessions: TypingSession[];
	}

	let stats: TypingStats | null = null;
	let isExpanded = false;
	let pollInterval: ReturnType<typeof setInterval>;
	let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

	async function loadStats() {
		if (!invoke) return;
		try {
			stats = (await invoke('typing_speed_get_stats')) as TypingStats;
		} catch {
			// Backend not available
		}
	}

	async function resetStats() {
		if (!invoke) return;
		try {
			await invoke('typing_speed_reset');
			await loadStats();
		} catch {
			// ignore
		}
	}

	onMount(async () => {
		try {
			const tauri = await import('@tauri-apps/api/core');
			invoke = tauri.invoke;
		} catch {
			return;
		}
		await loadStats();
		pollInterval = setInterval(loadStats, 2000);
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	function formatAccuracy(acc: number): string {
		return `${(acc * 100).toFixed(1)}%`;
	}

	function wpmColor(wpm: number): string {
		if (wpm >= 80) return '#43b581';
		if (wpm >= 50) return '#faa61a';
		if (wpm >= 30) return '#f47b67';
		return '#949ba4';
	}

	function sessionTime(session: TypingSession): string {
		const d = new Date(session.start_time);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

{#if stats}
	<div class="typing-speed-tracker">
		<button class="tracker-header" on:click={() => (isExpanded = !isExpanded)}>
			<div class="wpm-display">
				<span class="wpm-value" style="color: {wpmColor(stats.current_wpm)}">
					{stats.current_wpm > 0 ? stats.current_wpm.toFixed(0) : '--'}
				</span>
				<span class="wpm-label">WPM</span>
			</div>
			<div class="quick-stats">
				<span class="stat-chip" title="Peak WPM">
					Peak: {stats.peak_wpm.toFixed(0)}
				</span>
				<span class="stat-chip" title="Average WPM">
					Avg: {stats.average_wpm.toFixed(0)}
				</span>
			</div>
			<svg
				class="chevron"
				class:expanded={isExpanded}
				viewBox="0 0 24 24"
				width="14"
				height="14"
			>
				<path d="M7 10l5 5 5-5z" fill="currentColor" />
			</svg>
		</button>

		{#if isExpanded}
			<div class="tracker-body">
				<div class="stats-grid">
					<div class="stat-item">
						<span class="stat-value">{stats.today_words.toLocaleString()}</span>
						<span class="stat-label">Words Today</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{stats.total_chars_typed.toLocaleString()}</span>
						<span class="stat-label">Total Chars</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{formatAccuracy(stats.average_accuracy)}</span>
						<span class="stat-label">Accuracy</span>
					</div>
					<div class="stat-item">
						<span class="stat-value">{stats.today_sessions}</span>
						<span class="stat-label">Sessions Today</span>
					</div>
				</div>

				{#if stats.recent_sessions.length > 0}
					<div class="recent-header">Recent Bursts</div>
					<div class="recent-list">
						{#each stats.recent_sessions.slice(-8).reverse() as session}
							<div class="recent-item">
								<span class="recent-time">{sessionTime(session)}</span>
								<span class="recent-wpm" style="color: {wpmColor(session.wpm)}">
									{session.wpm.toFixed(0)} WPM
								</span>
								<span class="recent-words">{session.word_count}w</span>
								<span class="recent-acc">{formatAccuracy(session.accuracy)}</span>
							</div>
						{/each}
					</div>
				{/if}

				<button class="reset-btn" on:click|stopPropagation={resetStats}> Reset Stats </button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.typing-speed-tracker {
		background: #2b2d31;
		border-radius: 8px;
		overflow: hidden;
		font-size: 12px;
	}

	.tracker-header {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: #dbdee1;
		cursor: pointer;
		transition: background 0.15s;
	}

	.tracker-header:hover {
		background: #35373c;
	}

	.wpm-display {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.wpm-value {
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		min-width: 32px;
	}

	.wpm-label {
		font-size: 10px;
		color: #949ba4;
		text-transform: uppercase;
		font-weight: 600;
	}

	.quick-stats {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.stat-chip {
		color: #949ba4;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.chevron {
		color: #949ba4;
		transition: transform 0.2s;
		flex-shrink: 0;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.tracker-body {
		padding: 0 12px 12px;
		border-top: 1px solid #1e1f22;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 10px 0;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.stat-value {
		font-size: 16px;
		font-weight: 600;
		color: #dbdee1;
		font-variant-numeric: tabular-nums;
	}

	.stat-label {
		font-size: 10px;
		color: #949ba4;
		text-transform: uppercase;
	}

	.recent-header {
		font-size: 10px;
		font-weight: 600;
		color: #949ba4;
		text-transform: uppercase;
		padding: 8px 0 4px;
		border-top: 1px solid #1e1f22;
	}

	.recent-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.recent-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 0;
		font-variant-numeric: tabular-nums;
	}

	.recent-time {
		color: #949ba4;
		font-size: 11px;
		min-width: 48px;
	}

	.recent-wpm {
		font-weight: 600;
		font-size: 11px;
		min-width: 56px;
	}

	.recent-words {
		color: #949ba4;
		font-size: 11px;
	}

	.recent-acc {
		color: #949ba4;
		font-size: 11px;
		margin-left: auto;
	}

	.reset-btn {
		display: block;
		width: 100%;
		margin-top: 10px;
		padding: 6px;
		background: #1e1f22;
		border: none;
		border-radius: 4px;
		color: #949ba4;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.reset-btn:hover {
		background: #383a40;
		color: #dbdee1;
	}
</style>
