<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface MoodEntry {
		id: string;
		mood: number;
		label: string;
		emoji: string;
		note: string;
		tags: string[];
		createdAt: string;
	}

	interface MoodStats {
		totalEntries: number;
		averageMood: number;
		mostCommonLabel: string;
		streakDays: number;
		entriesThisWeek: number;
		weeklyAverage: number;
		moodDistribution: number[];
	}

	const moods = [
		{ value: 1, emoji: '\u{1F629}', label: 'Awful' },
		{ value: 2, emoji: '\u{1F61E}', label: 'Bad' },
		{ value: 3, emoji: '\u{1F610}', label: 'Okay' },
		{ value: 4, emoji: '\u{1F60A}', label: 'Good' },
		{ value: 5, emoji: '\u{1F929}', label: 'Great' }
	];

	let todayEntries = $state<MoodEntry[]>([]);
	let stats = $state<MoodStats | null>(null);
	let history = $state<MoodEntry[]>([]);
	let selectedMood = $state<number | null>(null);
	let noteText = $state('');
	let showHistory = $state(false);
	let showStats = $state(false);
	let isLogging = $state(false);

	onMount(() => {
		loadToday();
		loadStats();
	});

	async function loadToday() {
		try {
			todayEntries = await invoke<MoodEntry[]>('mood_get_today');
		} catch {
			todayEntries = [];
		}
	}

	async function loadStats() {
		try {
			stats = await invoke<MoodStats>('mood_get_stats');
		} catch {
			stats = null;
		}
	}

	async function loadHistory() {
		try {
			history = await invoke<MoodEntry[]>('mood_get_history', { limit: 30 });
			history = history.reverse();
		} catch {
			history = [];
		}
	}

	async function logMood() {
		if (selectedMood === null) return;
		const mood = moods.find((m) => m.value === selectedMood);
		if (!mood) return;

		isLogging = true;
		try {
			await invoke('mood_log', {
				mood: mood.value,
				label: mood.label,
				emoji: mood.emoji,
				note: noteText || null,
				tags: null
			});
			selectedMood = null;
			noteText = '';
			await loadToday();
			await loadStats();
			if (showHistory) await loadHistory();
		} finally {
			isLogging = false;
		}
	}

	async function deleteEntry(id: string) {
		await invoke('mood_delete', { id });
		await loadToday();
		await loadStats();
		if (showHistory) await loadHistory();
	}

	function toggleHistory() {
		showHistory = !showHistory;
		showStats = false;
		if (showHistory) loadHistory();
	}

	function toggleStats() {
		showStats = !showStats;
		showHistory = false;
		if (showStats) loadStats();
	}

	function formatTime(isoString: string): string {
		try {
			const d = new Date(isoString);
			return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	function formatDate(isoString: string): string {
		try {
			const d = new Date(isoString);
			return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}

	let latestMood = $derived(todayEntries.length > 0 ? todayEntries[todayEntries.length - 1] : null);

	let maxDistribution = $derived(
		stats ? Math.max(...stats.moodDistribution, 1) : 1
	);
</script>

<div class="mood-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">&#x1F3AF;</span>
			<h3>Mood Tracker</h3>
		</div>
		<div class="header-actions">
			<button
				class="icon-btn"
				class:active={showStats}
				onclick={toggleStats}
				title="Statistics"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<path d="M18 20V10M12 20V4M6 20v-6" />
				</svg>
			</button>
			<button
				class="icon-btn"
				class:active={showHistory}
				onclick={toggleHistory}
				title="History"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</svg>
			</button>
		</div>
	</div>

	{#if showStats && stats}
		<div class="stats-section">
			<div class="stat-grid">
				<div class="stat-card">
					<span class="stat-value">{stats.totalEntries}</span>
					<span class="stat-label">Total</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{stats.averageMood.toFixed(1)}</span>
					<span class="stat-label">Average</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{stats.streakDays}d</span>
					<span class="stat-label">Streak</span>
				</div>
				<div class="stat-card">
					<span class="stat-value">{stats.entriesThisWeek}</span>
					<span class="stat-label">This Week</span>
				</div>
			</div>

			{#if stats.totalEntries > 0}
				<div class="distribution">
					<span class="distribution-title">Mood Distribution</span>
					<div class="distribution-bars">
						{#each moods as mood, i}
							<div class="dist-bar-group">
								<div class="dist-bar-wrapper">
									<div
										class="dist-bar"
										style="height: {(stats.moodDistribution[i] / maxDistribution) * 100}%"
									></div>
								</div>
								<span class="dist-emoji">{mood.emoji}</span>
								<span class="dist-count">{stats.moodDistribution[i]}</span>
							</div>
						{/each}
					</div>
				</div>

				{#if stats.mostCommonLabel}
					<div class="common-mood">
						Most common: <strong>{stats.mostCommonLabel}</strong>
					</div>
				{/if}
			{/if}
		</div>
	{:else if showHistory}
		<div class="history-section">
			{#if history.length === 0}
				<p class="empty-message">No mood entries yet. Start tracking!</p>
			{:else}
				<div class="history-list">
					{#each history as entry (entry.id)}
						<div class="history-item">
							<span class="history-emoji">{entry.emoji}</span>
							<div class="history-info">
								<span class="history-label">{entry.label}</span>
								{#if entry.note}
									<span class="history-note">{entry.note}</span>
								{/if}
							</div>
							<div class="history-meta">
								<span class="history-date">{formatDate(entry.createdAt)}</span>
								<span class="history-time">{formatTime(entry.createdAt)}</span>
							</div>
							<button
								class="delete-btn"
								onclick={() => deleteEntry(entry.id)}
								title="Delete entry"
							>
								&times;
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="main-view">
			{#if latestMood}
				<div class="last-checkin">
					<span class="last-emoji">{latestMood.emoji}</span>
					<div class="last-info">
						<span class="last-label">Feeling <strong>{latestMood.label.toLowerCase()}</strong></span>
						<span class="last-time">{formatTime(latestMood.createdAt)}</span>
					</div>
				</div>
			{/if}

			<div class="mood-selector">
				<span class="selector-label">How are you feeling?</span>
				<div class="mood-buttons">
					{#each moods as mood}
						<button
							class="mood-btn"
							class:selected={selectedMood === mood.value}
							onclick={() => { selectedMood = mood.value; }}
							title={mood.label}
						>
							<span class="mood-emoji">{mood.emoji}</span>
							<span class="mood-label">{mood.label}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if selectedMood !== null}
				<div class="note-section">
					<input
						type="text"
						class="note-input"
						placeholder="Add a note (optional)..."
						bind:value={noteText}
						onkeydown={(e) => { if (e.key === 'Enter') logMood(); }}
					/>
					<button class="log-btn" onclick={logMood} disabled={isLogging}>
						{isLogging ? 'Logging...' : 'Log Mood'}
					</button>
				</div>
			{/if}

			{#if todayEntries.length > 1}
				<div class="today-summary">
					<span class="summary-label">Today's check-ins</span>
					<div class="summary-emojis">
						{#each todayEntries as entry}
							<span class="summary-emoji" title="{entry.label} at {formatTime(entry.createdAt)}">
								{entry.emoji}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if stats && stats.streakDays > 1}
				<div class="streak-badge">
					&#x1F525; {stats.streakDays} day streak
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.mood-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		font-size: 18px;
	}

	h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #949ba4);
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}
	.icon-btn:hover,
	.icon-btn.active {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-tertiary, #1e1f22);
	}

	/* Mood Selector */
	.selector-label {
		font-size: 13px;
		color: var(--text-secondary, #949ba4);
	}

	.mood-selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mood-buttons {
		display: flex;
		gap: 6px;
		justify-content: space-between;
	}

	.mood-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 4px;
		border-radius: 8px;
		border: 2px solid transparent;
		background: var(--bg-tertiary, #1e1f22);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.mood-btn:hover {
		border-color: var(--border, #3f4147);
		transform: translateY(-2px);
	}

	.mood-btn.selected {
		border-color: #5865f2;
		background: rgba(88, 101, 242, 0.15);
	}

	.mood-emoji {
		font-size: 24px;
		line-height: 1;
	}

	.mood-label {
		font-size: 10px;
		color: var(--text-secondary, #949ba4);
	}

	.mood-btn.selected .mood-label {
		color: #5865f2;
		font-weight: 600;
	}

	/* Note input */
	.note-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.note-input {
		width: 100%;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		font-family: inherit;
		box-sizing: border-box;
	}

	.note-input:focus {
		outline: none;
		border-color: #5865f2;
	}

	.note-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}

	.log-btn {
		padding: 8px;
		border-radius: 6px;
		border: none;
		background: #5865f2;
		color: white;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.log-btn:hover:not(:disabled) {
		background: #4752c4;
	}

	.log-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Last check-in */
	.last-checkin {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
	}

	.last-emoji {
		font-size: 28px;
		line-height: 1;
	}

	.last-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.last-label {
		font-size: 13px;
	}

	.last-time {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	/* Today summary */
	.today-summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.summary-label {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.summary-emojis {
		display: flex;
		gap: 6px;
	}

	.summary-emoji {
		font-size: 18px;
		cursor: default;
	}

	/* Streak */
	.streak-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		background: rgba(250, 166, 26, 0.12);
		border-radius: 12px;
		font-size: 12px;
		font-weight: 600;
		color: #faa61a;
		align-self: flex-start;
	}

	/* Stats */
	.stats-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 10px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
	}

	.stat-value {
		font-size: 20px;
		font-weight: 700;
		color: #5865f2;
	}

	.stat-label {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.distribution {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.distribution-title {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.distribution-bars {
		display: flex;
		gap: 8px;
		justify-content: space-between;
		align-items: flex-end;
		height: 80px;
	}

	.dist-bar-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		height: 100%;
	}

	.dist-bar-wrapper {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.dist-bar {
		width: 100%;
		max-width: 24px;
		min-height: 2px;
		background: #5865f2;
		border-radius: 3px 3px 0 0;
		transition: height 0.3s ease;
	}

	.dist-emoji {
		font-size: 14px;
	}

	.dist-count {
		font-size: 10px;
		color: var(--text-secondary, #949ba4);
	}

	.common-mood {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		text-align: center;
	}

	/* History */
	.history-section {
		max-height: 300px;
		overflow-y: auto;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
	}

	.history-item:hover {
		background: rgba(79, 84, 92, 0.3);
	}

	.history-emoji {
		font-size: 18px;
		flex-shrink: 0;
	}

	.history-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.history-label {
		font-size: 13px;
		font-weight: 500;
	}

	.history-note {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.history-meta {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
	}

	.history-date {
		font-size: 11px;
		color: var(--text-secondary, #949ba4);
	}

	.history-time {
		font-size: 10px;
		color: var(--text-muted, #6d6f78);
	}

	.delete-btn {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #6d6f78);
		cursor: pointer;
		font-size: 14px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.history-item:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		color: var(--danger, #ed4245);
		background: rgba(237, 66, 69, 0.1);
	}

	.empty-message {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted, #6d6f78);
		padding: 20px 0;
	}
</style>
