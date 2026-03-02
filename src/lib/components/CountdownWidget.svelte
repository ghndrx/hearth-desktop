<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Props
	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	interface Countdown {
		id: string;
		name: string;
		targetDate: Date;
		color: string;
		emoji: string;
	}

	interface TimeRemaining {
		days: number;
		hours: number;
		minutes: number;
		seconds: number;
		total: number;
		isPast: boolean;
	}

	// State
	let countdowns = $state<Countdown[]>([]);
	let showAddForm = $state(false);
	let newCountdownName = $state('');
	let newCountdownDate = $state('');
	let newCountdownTime = $state('12:00');
	let newCountdownEmoji = $state('🎯');
	let selectedCountdownId = $state<string | null>(null);
	let now = $state(new Date());

	const STORAGE_KEY = 'hearth-countdown-widget';
	const COLORS = [
		'#5865f2', // Discord Blurple
		'#3ba55c', // Green
		'#faa61a', // Yellow
		'#ed4245', // Red
		'#9b59b6', // Purple
		'#e91e63', // Pink
		'#00bcd4', // Cyan
		'#ff9800'  // Orange
	];
	const EMOJIS = ['🎯', '🚀', '🎉', '🎂', '💼', '✈️', '🎄', '💝', '🏆', '📅', '⏰', '🔔'];

	let tickInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		loadCountdowns();
		tickInterval = setInterval(() => {
			now = new Date();
		}, 1000);
	});

	onDestroy(() => {
		if (tickInterval) clearInterval(tickInterval);
	});

	function loadCountdowns() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				countdowns = parsed.map((c: any) => ({
					...c,
					targetDate: new Date(c.targetDate)
				}));
			}
		} catch (e) {
			console.error('Failed to load countdowns:', e);
		}
	}

	function saveCountdowns() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(
				countdowns.map(c => ({
					...c,
					targetDate: c.targetDate.toISOString()
				}))
			));
		} catch (e) {
			console.error('Failed to save countdowns:', e);
		}
	}

	function addCountdown() {
		if (!newCountdownName.trim() || !newCountdownDate) return;

		const targetDate = new Date(`${newCountdownDate}T${newCountdownTime}`);
		if (isNaN(targetDate.getTime())) return;

		const newCountdown: Countdown = {
			id: Date.now().toString(),
			name: newCountdownName.trim(),
			targetDate,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			emoji: newCountdownEmoji
		};

		countdowns = [...countdowns, newCountdown];
		saveCountdowns();
		resetForm();
	}

	function removeCountdown(id: string) {
		countdowns = countdowns.filter(c => c.id !== id);
		saveCountdowns();
		if (selectedCountdownId === id) {
			selectedCountdownId = null;
		}
	}

	function resetForm() {
		showAddForm = false;
		newCountdownName = '';
		newCountdownDate = '';
		newCountdownTime = '12:00';
		newCountdownEmoji = '🎯';
	}

	function getTimeRemaining(targetDate: Date): TimeRemaining {
		const total = targetDate.getTime() - now.getTime();
		const isPast = total < 0;
		const absTotal = Math.abs(total);

		const seconds = Math.floor((absTotal / 1000) % 60);
		const minutes = Math.floor((absTotal / 1000 / 60) % 60);
		const hours = Math.floor((absTotal / (1000 * 60 * 60)) % 24);
		const days = Math.floor(absTotal / (1000 * 60 * 60 * 24));

		return { days, hours, minutes, seconds, total: absTotal, isPast };
	}

	function formatCountdown(remaining: TimeRemaining): string {
		if (remaining.days > 0) {
			return `${remaining.days}d ${remaining.hours}h`;
		} else if (remaining.hours > 0) {
			return `${remaining.hours}h ${remaining.minutes}m`;
		} else if (remaining.minutes > 0) {
			return `${remaining.minutes}m ${remaining.seconds}s`;
		} else {
			return `${remaining.seconds}s`;
		}
	}

	function formatDetailedCountdown(remaining: TimeRemaining): string {
		const parts: string[] = [];
		if (remaining.days > 0) parts.push(`${remaining.days} day${remaining.days !== 1 ? 's' : ''}`);
		if (remaining.hours > 0) parts.push(`${remaining.hours} hour${remaining.hours !== 1 ? 's' : ''}`);
		if (remaining.minutes > 0) parts.push(`${remaining.minutes} min`);
		if (remaining.seconds > 0 || parts.length === 0) parts.push(`${remaining.seconds} sec`);
		return parts.join(', ');
	}

	function getProgressPercent(countdown: Countdown): number {
		// Calculate progress based on time elapsed since creation
		// For now, use a simple visual indicator based on days remaining
		const remaining = getTimeRemaining(countdown.targetDate);
		if (remaining.isPast) return 100;
		
		// Max days we show full progress for is 30
		const maxDays = 30;
		const daysRemaining = remaining.total / (1000 * 60 * 60 * 24);
		return Math.max(0, Math.min(100, 100 - (daysRemaining / maxDays) * 100));
	}

	function getSortedCountdowns(): Countdown[] {
		return [...countdowns].sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
	}

	function selectEmoji(emoji: string) {
		newCountdownEmoji = emoji;
	}

	function toggleCountdown(id: string) {
		selectedCountdownId = selectedCountdownId === id ? null : id;
	}

	function getMinDate(): string {
		const today = new Date();
		return today.toISOString().split('T')[0];
	}
</script>

<div class="countdown-widget" class:compact>
	<div class="widget-header">
		<span class="header-title">⏳ Countdowns</span>
		<button 
			class="add-btn"
			onclick={() => showAddForm = !showAddForm}
			title={showAddForm ? 'Cancel' : 'Add countdown'}
		>
			{showAddForm ? '×' : '+'}
		</button>
	</div>

	{#if showAddForm}
		<div class="add-form">
			<div class="form-row">
				<input
					type="text"
					placeholder="Event name..."
					bind:value={newCountdownName}
					class="name-input"
					maxlength="30"
				/>
			</div>
			<div class="form-row datetime-row">
				<input
					type="date"
					bind:value={newCountdownDate}
					class="date-input"
					min={getMinDate()}
				/>
				<input
					type="time"
					bind:value={newCountdownTime}
					class="time-input"
				/>
			</div>
			<div class="emoji-picker">
				{#each EMOJIS as emoji}
					<button
						class="emoji-btn"
						class:selected={newCountdownEmoji === emoji}
						onclick={() => selectEmoji(emoji)}
					>
						{emoji}
					</button>
				{/each}
			</div>
			<button
				class="submit-btn"
				onclick={addCountdown}
				disabled={!newCountdownName.trim() || !newCountdownDate}
			>
				Create Countdown
			</button>
		</div>
	{/if}

	<div class="countdowns-list">
		{#each getSortedCountdowns() as countdown (countdown.id)}
			{@const remaining = getTimeRemaining(countdown.targetDate)}
			{@const progress = getProgressPercent(countdown)}
			<div 
				class="countdown-item"
				class:past={remaining.isPast}
				class:expanded={selectedCountdownId === countdown.id}
				style="--countdown-color: {countdown.color}"
			>
				<button class="countdown-main" onclick={() => toggleCountdown(countdown.id)}>
					<span class="countdown-emoji">{countdown.emoji}</span>
					<div class="countdown-info">
						<span class="countdown-name">{countdown.name}</span>
						<span class="countdown-time" class:past={remaining.isPast}>
							{#if remaining.isPast}
								{formatCountdown(remaining)} ago
							{:else}
								{formatCountdown(remaining)}
							{/if}
						</span>
					</div>
					{#if !compact}
						<div class="progress-ring">
							<svg viewBox="0 0 36 36">
								<circle
									class="progress-bg"
									cx="18"
									cy="18"
									r="15"
									fill="none"
									stroke-width="3"
								/>
								<circle
									class="progress-fill"
									cx="18"
									cy="18"
									r="15"
									fill="none"
									stroke-width="3"
									stroke-dasharray="{progress}, 100"
									style="stroke: {countdown.color}"
								/>
							</svg>
						</div>
					{/if}
				</button>
				
				{#if selectedCountdownId === countdown.id}
					<div class="countdown-details">
						<div class="detail-row">
							<span class="detail-label">Target:</span>
							<span class="detail-value">
								{countdown.targetDate.toLocaleDateString([], { 
									weekday: 'short', 
									month: 'short', 
									day: 'numeric',
									year: 'numeric'
								})}
								at {countdown.targetDate.toLocaleTimeString([], {
									hour: '2-digit',
									minute: '2-digit'
								})}
							</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Remaining:</span>
							<span class="detail-value">
								{#if remaining.isPast}
									Completed {formatDetailedCountdown(remaining)} ago
								{:else}
									{formatDetailedCountdown(remaining)}
								{/if}
							</span>
						</div>
						<button class="remove-btn" onclick={() => removeCountdown(countdown.id)}>
							🗑️ Remove
						</button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="empty-state">
				<span class="empty-icon">⏳</span>
				<span class="empty-text">No countdowns yet</span>
				<span class="empty-hint">Add one to track upcoming events!</span>
			</div>
		{/each}
	</div>
</div>

<style>
	.countdown-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}

	.countdown-widget.compact {
		font-size: 0.9em;
	}

	.widget-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 4px;
		border-bottom: 1px solid var(--bg-modifier-accent, #40444b);
	}

	.header-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.add-btn {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		width: 22px;
		height: 22px;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.add-btn:hover {
		opacity: 0.9;
	}

	.add-form {
		background: var(--bg-primary, #36393f);
		border-radius: 8px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-row {
		display: flex;
		gap: 6px;
	}

	.datetime-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px;
	}

	.name-input,
	.date-input,
	.time-input {
		background: var(--bg-tertiary, #40444b);
		border: none;
		border-radius: 4px;
		padding: 8px;
		font-size: 12px;
		color: var(--text-primary, #dcddde);
	}

	.name-input {
		width: 100%;
	}

	.date-input {
		min-width: 0;
	}

	.time-input {
		width: 80px;
	}

	.name-input:focus,
	.date-input:focus,
	.time-input:focus {
		outline: 2px solid var(--accent, #5865f2);
		outline-offset: -2px;
	}

	.emoji-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.emoji-btn {
		background: var(--bg-tertiary, #40444b);
		border: none;
		border-radius: 4px;
		padding: 4px 6px;
		cursor: pointer;
		font-size: 14px;
		transition: transform 0.1s;
	}

	.emoji-btn:hover {
		transform: scale(1.15);
	}

	.emoji-btn.selected {
		background: var(--accent, #5865f2);
		box-shadow: 0 0 0 2px var(--accent, #5865f2);
	}

	.submit-btn {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		padding: 8px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.submit-btn:not(:disabled):hover {
		opacity: 0.9;
	}

	.countdowns-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 200px;
		overflow-y: auto;
	}

	.countdown-item {
		background: var(--bg-primary, #36393f);
		border-radius: 8px;
		border-left: 3px solid var(--countdown-color, #5865f2);
		overflow: hidden;
	}

	.countdown-item.past {
		opacity: 0.7;
	}

	.countdown-main {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.countdown-main:hover {
		background: var(--bg-modifier-hover, #4f545c29);
	}

	.countdown-emoji {
		font-size: 20px;
		flex-shrink: 0;
	}

	.countdown-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.countdown-name {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-primary, #dcddde);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.countdown-time {
		font-size: 14px;
		font-weight: 700;
		color: var(--countdown-color, #5865f2);
		font-family: 'SF Mono', Monaco, monospace;
	}

	.countdown-time.past {
		color: var(--text-muted, #72767d);
	}

	.progress-ring {
		width: 32px;
		height: 32px;
		flex-shrink: 0;
	}

	.progress-ring svg {
		transform: rotate(-90deg);
	}

	.progress-bg {
		stroke: var(--bg-tertiary, #40444b);
	}

	.progress-fill {
		stroke-linecap: round;
		transition: stroke-dasharray 0.3s ease;
	}

	.countdown-details {
		padding: 8px;
		padding-top: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		margin-top: 4px;
	}

	.detail-row {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-label {
		font-size: 10px;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
	}

	.detail-value {
		font-size: 11px;
		color: var(--text-secondary, #b9bbbe);
	}

	.remove-btn {
		background: var(--error, #ed4245);
		border: none;
		border-radius: 4px;
		color: white;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 11px;
		align-self: flex-start;
		margin-top: 4px;
	}

	.remove-btn:hover {
		opacity: 0.9;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px;
		gap: 4px;
	}

	.empty-icon {
		font-size: 28px;
		opacity: 0.5;
	}

	.empty-text {
		font-size: 12px;
		color: var(--text-secondary, #b9bbbe);
	}

	.empty-hint {
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	/* Scrollbar styling */
	.countdowns-list::-webkit-scrollbar {
		width: 6px;
	}

	.countdowns-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.countdowns-list::-webkit-scrollbar-thumb {
		background: var(--bg-modifier-accent, #40444b);
		border-radius: 3px;
	}

	.countdowns-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #72767d);
	}
</style>
