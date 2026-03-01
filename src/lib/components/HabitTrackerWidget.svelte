<script lang="ts">
	import { onMount } from 'svelte';

	interface Habit {
		id: string;
		name: string;
		emoji: string;
		streak: number;
		completedToday: boolean;
		lastCompleted: string | null;
		history: string[]; // ISO date strings of completions
	}

	let habits = $state<Habit[]>([]);
	let showAddForm = $state(false);
	let newHabitName = $state('');
	let newHabitEmoji = $state('✨');

	const emojiOptions = ['✨', '💪', '📚', '🧘', '💧', '🏃', '😴', '🥗', '💊', '🎯', '📝', '🎸'];

	onMount(() => {
		loadHabits();
		checkDayReset();
	});

	function loadHabits() {
		try {
			const stored = localStorage.getItem('hearth-habits');
			if (stored) {
				habits = JSON.parse(stored);
				// Check if day has changed and reset completions
				habits = habits.map(h => ({
					...h,
					completedToday: h.lastCompleted === getTodayString()
				}));
			}
		} catch {
			habits = [];
		}
	}

	function saveHabits() {
		localStorage.setItem('hearth-habits', JSON.stringify(habits));
	}

	function getTodayString(): string {
		return new Date().toISOString().split('T')[0];
	}

	function checkDayReset() {
		const today = getTodayString();
		habits = habits.map(habit => {
			if (habit.lastCompleted !== today) {
				// Check if streak should be broken (missed yesterday)
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				const yesterdayStr = yesterday.toISOString().split('T')[0];
				
				if (habit.lastCompleted !== yesterdayStr && habit.streak > 0) {
					return { ...habit, streak: 0, completedToday: false };
				}
				return { ...habit, completedToday: false };
			}
			return habit;
		});
		saveHabits();
	}

	function addHabit() {
		if (!newHabitName.trim()) return;

		const newHabit: Habit = {
			id: Date.now().toString(),
			name: newHabitName.trim(),
			emoji: newHabitEmoji,
			streak: 0,
			completedToday: false,
			lastCompleted: null,
			history: []
		};

		habits = [...habits, newHabit];
		newHabitName = '';
		newHabitEmoji = '✨';
		showAddForm = false;
		saveHabits();
	}

	function toggleHabit(habitId: string) {
		const today = getTodayString();
		habits = habits.map(habit => {
			if (habit.id !== habitId) return habit;

			if (habit.completedToday) {
				// Uncomplete - remove today from history and decrement streak
				return {
					...habit,
					completedToday: false,
					streak: Math.max(0, habit.streak - 1),
					lastCompleted: habit.history.length > 1 ? habit.history[habit.history.length - 2] : null,
					history: habit.history.filter(d => d !== today)
				};
			} else {
				// Complete - add today to history and increment streak
				return {
					...habit,
					completedToday: true,
					streak: habit.streak + 1,
					lastCompleted: today,
					history: [...habit.history.filter(d => d !== today), today]
				};
			}
		});
		saveHabits();
	}

	function deleteHabit(habitId: string) {
		habits = habits.filter(h => h.id !== habitId);
		saveHabits();
	}

	function getStreakColor(streak: number): string {
		if (streak >= 30) return '#ffd700'; // Gold
		if (streak >= 14) return '#c0c0c0'; // Silver
		if (streak >= 7) return '#cd7f32'; // Bronze
		if (streak >= 3) return '#3ba55c'; // Green
		return '#72767d'; // Muted
	}

	function getWeekHistory(habit: Habit): boolean[] {
		const result: boolean[] = [];
		const today = new Date();
		
		for (let i = 6; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			const dateStr = date.toISOString().split('T')[0];
			result.push(habit.history.includes(dateStr));
		}
		
		return result;
	}
</script>

<div class="habit-tracker-widget">
	<div class="widget-header">
		<span class="title">📊 Habits</span>
		<button 
			class="add-btn" 
			onclick={() => showAddForm = !showAddForm}
			title="Add habit"
		>
			{showAddForm ? '×' : '+'}
		</button>
	</div>

	{#if showAddForm}
		<div class="add-form">
			<div class="emoji-picker">
				{#each emojiOptions as emoji}
					<button 
						class="emoji-option"
						class:selected={newHabitEmoji === emoji}
						onclick={() => newHabitEmoji = emoji}
					>
						{emoji}
					</button>
				{/each}
			</div>
			<div class="input-row">
				<input
					type="text"
					placeholder="Habit name..."
					bind:value={newHabitName}
					onkeydown={(e) => e.key === 'Enter' && addHabit()}
				/>
				<button class="confirm-btn" onclick={addHabit}>Add</button>
			</div>
		</div>
	{/if}

	<div class="habits-list">
		{#if habits.length === 0}
			<div class="empty-state">
				<span class="empty-emoji">🎯</span>
				<span class="empty-text">No habits yet</span>
			</div>
		{:else}
			{#each habits as habit (habit.id)}
				<div class="habit-item" class:completed={habit.completedToday}>
					<button 
						class="habit-checkbox"
						class:checked={habit.completedToday}
						onclick={() => toggleHabit(habit.id)}
					>
						{habit.emoji}
					</button>
					<div class="habit-info">
						<span class="habit-name">{habit.name}</span>
						<div class="habit-meta">
							<span 
								class="streak" 
								style="color: {getStreakColor(habit.streak)}"
							>
								🔥 {habit.streak}
							</span>
							<div class="week-dots">
								{#each getWeekHistory(habit) as completed}
									<span class="dot" class:filled={completed}></span>
								{/each}
							</div>
						</div>
					</div>
					<button 
						class="delete-btn"
						onclick={() => deleteHabit(habit.id)}
						title="Delete habit"
					>
						🗑
					</button>
				</div>
			{/each}
		{/if}
	</div>

	{#if habits.length > 0}
		<div class="widget-footer">
			<span class="completion-rate">
				{habits.filter(h => h.completedToday).length}/{habits.length} today
			</span>
		</div>
	{/if}
</div>

<style>
	.habit-tracker-widget {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.widget-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
	}

	.add-btn {
		background: none;
		border: none;
		color: var(--text-secondary, #b9bbbe);
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.add-btn:hover {
		background: var(--bg-primary, #36393f);
		color: var(--accent, #5865f2);
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 6px;
	}

	.emoji-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.emoji-option {
		background: var(--bg-secondary, #2f3136);
		border: 2px solid transparent;
		border-radius: 4px;
		padding: 4px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.emoji-option:hover {
		background: var(--bg-modifier-hover, #4f545c);
	}

	.emoji-option.selected {
		border-color: var(--accent, #5865f2);
		background: var(--bg-modifier-selected, #4f545c);
	}

	.input-row {
		display: flex;
		gap: 4px;
	}

	.input-row input {
		flex: 1;
		background: var(--bg-secondary, #2f3136);
		border: none;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
	}

	.input-row input:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--accent, #5865f2);
	}

	.confirm-btn {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		padding: 6px 12px;
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
	}

	.confirm-btn:hover {
		background: var(--accent-hover, #4752c4);
	}

	.habits-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 180px;
		overflow-y: auto;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px 8px;
		gap: 4px;
	}

	.empty-emoji {
		font-size: 24px;
		opacity: 0.5;
	}

	.empty-text {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.habit-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: var(--bg-primary, #36393f);
		border-radius: 6px;
		transition: all 0.15s ease;
	}

	.habit-item.completed {
		opacity: 0.7;
	}

	.habit-checkbox {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 2px solid var(--bg-modifier-accent, #40444b);
		background: var(--bg-secondary, #2f3136);
		cursor: pointer;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.habit-checkbox:hover {
		border-color: var(--accent, #5865f2);
	}

	.habit-checkbox.checked {
		background: var(--success, #3ba55c);
		border-color: var(--success, #3ba55c);
	}

	.habit-info {
		flex: 1;
		min-width: 0;
	}

	.habit-name {
		display: block;
		font-size: 12px;
		color: var(--text-primary, #dcddde);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.habit-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 2px;
	}

	.streak {
		font-size: 10px;
		font-weight: 600;
	}

	.week-dots {
		display: flex;
		gap: 2px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--bg-modifier-accent, #40444b);
	}

	.dot.filled {
		background: var(--success, #3ba55c);
	}

	.delete-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		cursor: pointer;
		font-size: 12px;
		padding: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.habit-item:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		color: var(--error, #ed4245);
	}

	.widget-footer {
		padding-top: 8px;
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		text-align: center;
	}

	.completion-rate {
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}
</style>
