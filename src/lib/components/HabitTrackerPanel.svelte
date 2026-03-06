<script lang="ts">
	import { onMount } from 'svelte';
	import {
		habits,
		habitStats,
		habitCompletions,
		habitCount,
		loadHabits,
		loadAllStats,
		loadCompletionsForWeek,
		createHabit,
		deleteHabit,
		completeHabit,
		uncompleteHabit,
		updateHabit,
		type Habit,
		type HabitStats
	} from '$lib/stores/habitTracker';

	let isOpen = false;
	let showAddForm = false;
	let editingHabitId: string | null = null;
	let confirmDeleteId: string | null = null;
	let selectedView: 'today' | 'week' | 'stats' = 'today';

	// Add form fields
	let newName = '';
	let newDescription = '';
	let newCategory = 'General';
	let newColor = '#cba6f7';
	let newFrequency = 'daily';

	// Edit form fields
	let editName = '';
	let editDescription = '';
	let editCategory = '';
	let editColor = '';
	let editFrequency = '';

	const categoryOptions = ['General', 'Health', 'Fitness', 'Learning', 'Work', 'Mindfulness', 'Social', 'Creative'];
	const colorOptions = [
		'#cba6f7', '#f38ba8', '#fab387', '#f9e2af',
		'#a6e3a1', '#94e2d5', '#89b4fa', '#74c7ec',
		'#f5c2e7', '#b4befe'
	];
	const frequencyOptions = [
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekdays', label: 'Weekdays' },
		{ value: 'weekends', label: 'Weekends' },
		{ value: 'weekly', label: 'Weekly' }
	];

	const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	function getWeekDates(): string[] {
		const today = new Date();
		const dayOfWeek = today.getDay();
		const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
		const monday = new Date(today);
		monday.setDate(today.getDate() + mondayOffset);

		const dates: string[] = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			dates.push(d.toISOString().split('T')[0]);
		}
		return dates;
	}

	$: weekDates = getWeekDates();
	$: todayStr = new Date().toISOString().split('T')[0];

	function isCompletedOn(habitId: string, date: string): boolean {
		const set = $habitCompletions[habitId];
		return set ? set.has(date) : false;
	}

	function getStatsForHabit(habitId: string): HabitStats | undefined {
		return $habitStats.find((s) => s.habitId === habitId);
	}

	function streakDisplay(streak: number): string {
		if (streak === 0) return '0';
		if (streak >= 7) return `${streak}`;
		return `${streak}`;
	}

	function completionRatePercent(rate: number): string {
		return `${Math.round(rate * 100)}%`;
	}

	onMount(async () => {
		await loadHabits();
		await loadAllStats();
	});

	$: if ($habits.length > 0 && isOpen) {
		loadCompletionsForWeek($habits.map((h) => h.id));
	}

	async function handleAdd() {
		if (!newName.trim()) return;
		await createHabit(newName.trim(), newDescription.trim(), newCategory, newColor, newFrequency);
		newName = '';
		newDescription = '';
		newCategory = 'General';
		newColor = '#cba6f7';
		newFrequency = 'daily';
		showAddForm = false;
		await loadAllStats();
		await loadCompletionsForWeek($habits.map((h) => h.id));
	}

	async function handleToggleComplete(habitId: string, date: string) {
		if (isCompletedOn(habitId, date)) {
			await uncompleteHabit(habitId, date);
		} else {
			await completeHabit(habitId, date);
		}
		await loadAllStats();
	}

	async function handleDelete(id: string) {
		if (confirmDeleteId !== id) {
			confirmDeleteId = id;
			return;
		}
		await deleteHabit(id);
		confirmDeleteId = null;
		await loadAllStats();
	}

	function startEdit(habit: Habit) {
		editingHabitId = habit.id;
		editName = habit.name;
		editDescription = habit.description;
		editCategory = habit.category;
		editColor = habit.color;
		editFrequency = habit.frequency;
	}

	async function saveEdit() {
		if (!editingHabitId || !editName.trim()) return;
		await updateHabit(editingHabitId, {
			name: editName.trim(),
			description: editDescription.trim(),
			category: editCategory,
			color: editColor,
			frequency: editFrequency
		});
		editingHabitId = null;
		await loadAllStats();
	}

	function cancelEdit() {
		editingHabitId = null;
	}

	export function toggle() {
		isOpen = !isOpen;
	}

	export function open() {
		isOpen = true;
	}

	export function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" on:click={() => (isOpen = false)}></div>
	<aside class="panel">
		<header class="panel-header">
			<div class="header-left">
				<svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
					<polyline points="22 4 12 14.01 9 11.01" />
				</svg>
				<h2>Habit Tracker</h2>
				{#if $habitCount > 0}
					<span class="badge">{$habitCount}</span>
				{/if}
			</div>
			<div class="header-right">
				<button class="add-btn" on:click={() => (showAddForm = !showAddForm)} title="Add habit">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						{#if showAddForm}
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						{:else}
							<line x1="12" y1="5" x2="12" y2="19" />
							<line x1="5" y1="12" x2="19" y2="12" />
						{/if}
					</svg>
				</button>
				<button class="close-btn" on:click={() => (isOpen = false)} title="Close">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</header>

		<!-- View Tabs -->
		<div class="tabs">
			<button class="tab" class:active={selectedView === 'today'} on:click={() => (selectedView = 'today')}>
				Today
			</button>
			<button class="tab" class:active={selectedView === 'week'} on:click={() => (selectedView = 'week')}>
				Week
			</button>
			<button class="tab" class:active={selectedView === 'stats'} on:click={() => (selectedView = 'stats')}>
				Stats
			</button>
		</div>

		<!-- Add Habit Form -->
		{#if showAddForm}
			<div class="add-form">
				<input
					type="text"
					placeholder="Habit name..."
					bind:value={newName}
					class="form-input"
					on:keydown={(e) => e.key === 'Enter' && handleAdd()}
				/>
				<input
					type="text"
					placeholder="Description (optional)"
					bind:value={newDescription}
					class="form-input"
				/>
				<div class="form-row">
					<select bind:value={newCategory} class="form-select">
						{#each categoryOptions as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
					<select bind:value={newFrequency} class="form-select">
						{#each frequencyOptions as freq}
							<option value={freq.value}>{freq.label}</option>
						{/each}
					</select>
				</div>
				<div class="color-picker">
					{#each colorOptions as c}
						<button
							class="color-swatch"
							class:selected={newColor === c}
							style="background: {c}"
							on:click={() => (newColor = c)}
							title={c}
						></button>
					{/each}
				</div>
				<button class="btn-create" on:click={handleAdd} disabled={!newName.trim()}>
					Create Habit
				</button>
			</div>
		{/if}

		<div class="content">
			{#if $habits.length === 0}
				<div class="empty">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22 4 12 14.01 9 11.01" />
					</svg>
					<p>No habits yet</p>
					<span>Click the + button to add your first habit.</span>
				</div>
			{:else if selectedView === 'today'}
				<!-- Today View -->
				{#each $habits as habit (habit.id)}
					{@const stats = getStatsForHabit(habit.id)}
					{@const completed = isCompletedOn(habit.id, todayStr)}
					<div class="habit-card" style="border-left: 3px solid {habit.color}">
						{#if editingHabitId === habit.id}
							<div class="edit-form">
								<input type="text" bind:value={editName} class="form-input" placeholder="Name" />
								<input type="text" bind:value={editDescription} class="form-input" placeholder="Description" />
								<div class="form-row">
									<select bind:value={editCategory} class="form-select">
										{#each categoryOptions as cat}
											<option value={cat}>{cat}</option>
										{/each}
									</select>
									<select bind:value={editFrequency} class="form-select">
										{#each frequencyOptions as freq}
											<option value={freq.value}>{freq.label}</option>
										{/each}
									</select>
								</div>
								<div class="color-picker">
									{#each colorOptions as c}
										<button
											class="color-swatch"
											class:selected={editColor === c}
											style="background: {c}"
											on:click={() => (editColor = c)}
										></button>
									{/each}
								</div>
								<div class="edit-actions">
									<button class="btn-cancel" on:click={cancelEdit}>Cancel</button>
									<button class="btn-save" on:click={saveEdit}>Save</button>
								</div>
							</div>
						{:else}
							<div class="habit-main">
								<button
									class="check-btn"
									class:checked={completed}
									style="--habit-color: {habit.color}"
									on:click={() => handleToggleComplete(habit.id, todayStr)}
								>
									{#if completed}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									{/if}
								</button>
								<div class="habit-info">
									<div class="habit-name" class:done={completed}>{habit.name}</div>
									{#if habit.description}
										<div class="habit-desc">{habit.description}</div>
									{/if}
									<div class="habit-meta">
										<span class="category-tag" style="color: {habit.color}">{habit.category}</span>
										<span class="freq-tag">{habit.frequency}</span>
										{#if stats && stats.currentStreak > 0}
											<span class="streak-badge" title="Current streak">
												<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
													<path d="M12 23c-3.6 0-8-3.1-8-9.3C4 7.4 10.2 1.2 11.5 1c.2 0 .4.1.5.3.1.2.1.4 0 .6C10.7 4.3 11.3 7.3 13 9c1.6 1.6 3.3 1.1 3.4 1.1.2-.1.4 0 .5.1.2.1.2.3.2.5-.1.6-.2 1.3-.2 2C17 17 16.2 23 12 23z"/>
												</svg>
												{streakDisplay(stats.currentStreak)}
											</span>
										{/if}
									</div>
								</div>
								<div class="habit-actions">
									<button class="action-btn" on:click={() => startEdit(habit)} title="Edit">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									<button
										class="action-btn delete"
										class:confirm={confirmDeleteId === habit.id}
										on:click={() => handleDelete(habit.id)}
										on:blur={() => (confirmDeleteId = null)}
										title="Delete"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="3,6 5,6 21,6" />
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
										</svg>
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}

			{:else if selectedView === 'week'}
				<!-- Week View -->
				<div class="week-header">
					{#each dayLabels as day, i}
						<div class="week-day-label" class:today={weekDates[i] === todayStr}>{day}</div>
					{/each}
				</div>
				{#each $habits as habit (habit.id)}
					<div class="week-row">
						<div class="week-habit-name" style="color: {habit.color}" title={habit.name}>
							{habit.name}
						</div>
						<div class="week-grid">
							{#each weekDates as date, i}
								{@const completed = isCompletedOn(habit.id, date)}
								{@const isFuture = date > todayStr}
								<button
									class="week-cell"
									class:completed
									class:today-cell={date === todayStr}
									class:future={isFuture}
									style="--habit-color: {habit.color}"
									on:click={() => !isFuture && handleToggleComplete(habit.id, date)}
									disabled={isFuture}
									title="{dayLabels[i]} - {date}"
								>
									{#if completed}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
											<polyline points="20 6 9 17 4 12" />
										</svg>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/each}

			{:else if selectedView === 'stats'}
				<!-- Stats View -->
				{#each $habitStats as stats (stats.habitId)}
					<div class="stats-card" style="border-left: 3px solid {stats.habitColor}">
						<div class="stats-header">
							<span class="stats-name">{stats.habitName}</span>
							<span class="stats-category" style="color: {stats.habitColor}">{stats.habitCategory}</span>
						</div>
						<div class="stats-grid">
							<div class="stat-item">
								<div class="stat-value">{stats.totalCompletions}</div>
								<div class="stat-label">Total</div>
							</div>
							<div class="stat-item">
								<div class="stat-value streak-value">
									<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" style="color: #fab387">
										<path d="M12 23c-3.6 0-8-3.1-8-9.3C4 7.4 10.2 1.2 11.5 1c.2 0 .4.1.5.3.1.2.1.4 0 .6C10.7 4.3 11.3 7.3 13 9c1.6 1.6 3.3 1.1 3.4 1.1.2-.1.4 0 .5.1.2.1.2.3.2.5-.1.6-.2 1.3-.2 2C17 17 16.2 23 12 23z"/>
									</svg>
									{stats.currentStreak}
								</div>
								<div class="stat-label">Streak</div>
							</div>
							<div class="stat-item">
								<div class="stat-value">{stats.longestStreak}</div>
								<div class="stat-label">Best</div>
							</div>
							<div class="stat-item">
								<div class="stat-value">{completionRatePercent(stats.completionRate7d)}</div>
								<div class="stat-label">7-day</div>
							</div>
						</div>
						<div class="stats-bar-row">
							<span class="bar-label">This week</span>
							<div class="progress-bar">
								<div
									class="progress-fill"
									style="width: {Math.min(100, (stats.completionsThisWeek / 7) * 100)}%; background: {stats.habitColor}"
								></div>
							</div>
							<span class="bar-count">{stats.completionsThisWeek}/7</span>
						</div>
						<div class="stats-bar-row">
							<span class="bar-label">This month</span>
							<div class="progress-bar">
								<div
									class="progress-fill"
									style="width: {Math.min(100, (stats.completionsThisMonth / 30) * 100)}%; background: {stats.habitColor}"
								></div>
							</div>
							<span class="bar-count">{stats.completionsThisMonth}/30</span>
						</div>
					</div>
				{/each}
				{#if $habitStats.length === 0}
					<div class="empty">
						<p>No stats available</p>
						<span>Add habits and complete them to see statistics.</span>
					</div>
				{/if}
			{/if}
		</div>
	</aside>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 999;
	}

	.panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 440px;
		max-width: 100vw;
		height: 100vh;
		background: var(--bg-primary, #1e1e2e);
		border-left: 1px solid var(--border-color, #313244);
		display: flex;
		flex-direction: column;
		z-index: 1000;
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-icon {
		width: 22px;
		height: 22px;
		color: var(--accent-color, #cba6f7);
	}

	h2 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.badge {
		background: var(--bg-secondary, #313244);
		color: var(--text-secondary, #a6adc8);
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 12px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.add-btn,
	.close-btn {
		background: transparent;
		border: none;
		padding: 6px;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
	}

	.add-btn:hover,
	.close-btn:hover {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	.add-btn svg,
	.close-btn svg {
		width: 18px;
		height: 18px;
	}

	/* Tabs */
	.tabs {
		display: flex;
		padding: 8px 16px;
		gap: 4px;
		border-bottom: 1px solid var(--border-color, #313244);
	}

	.tab {
		flex: 1;
		background: transparent;
		border: none;
		padding: 8px 12px;
		border-radius: 8px;
		color: var(--text-secondary, #a6adc8);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab:hover {
		background: var(--bg-secondary, #313244);
	}

	.tab.active {
		background: var(--bg-secondary, #313244);
		color: var(--text-primary, #cdd6f4);
	}

	/* Add Form */
	.add-form {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border-color, #313244);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-input {
		width: 100%;
		padding: 9px 12px;
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
		box-sizing: border-box;
	}

	.form-input:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.form-input::placeholder {
		color: var(--text-secondary, #a6adc8);
	}

	.form-row {
		display: flex;
		gap: 8px;
	}

	.form-select {
		flex: 1;
		padding: 8px 10px;
		background: var(--bg-secondary, #313244);
		border: 1px solid transparent;
		border-radius: 8px;
		color: var(--text-primary, #cdd6f4);
		font-size: 13px;
		outline: none;
		cursor: pointer;
	}

	.form-select:focus {
		border-color: var(--accent-color, #cba6f7);
	}

	.color-picker {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s;
	}

	.color-swatch:hover {
		transform: scale(1.15);
	}

	.color-swatch.selected {
		border-color: var(--text-primary, #cdd6f4);
		box-shadow: 0 0 0 2px var(--bg-primary, #1e1e2e);
	}

	.btn-create {
		padding: 9px 16px;
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		border: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: filter 0.15s;
	}

	.btn-create:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.btn-create:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Content */
	.content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 16px 16px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 16px;
		text-align: center;
		color: var(--text-secondary, #a6adc8);
	}

	.empty svg {
		width: 48px;
		height: 48px;
		opacity: 0.25;
		margin-bottom: 12px;
	}

	.empty p {
		margin: 0 0 4px;
		font-size: 15px;
		color: var(--text-primary, #cdd6f4);
	}

	.empty span {
		font-size: 13px;
	}

	/* Habit Card (Today View) */
	.habit-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 12px 14px;
		margin-bottom: 8px;
		border: 1px solid transparent;
		transition: border-color 0.15s;
	}

	.habit-card:hover {
		border-color: var(--border-color, #45475a);
	}

	.habit-main {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.check-btn {
		width: 28px;
		height: 28px;
		min-width: 28px;
		border-radius: 50%;
		border: 2px solid var(--habit-color, #cba6f7);
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
		margin-top: 2px;
	}

	.check-btn:hover {
		background: color-mix(in srgb, var(--habit-color, #cba6f7) 20%, transparent);
	}

	.check-btn.checked {
		background: var(--habit-color, #cba6f7);
	}

	.check-btn svg {
		width: 16px;
		height: 16px;
		color: var(--bg-primary, #1e1e2e);
	}

	.habit-info {
		flex: 1;
		min-width: 0;
	}

	.habit-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #cdd6f4);
		transition: all 0.2s;
	}

	.habit-name.done {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.habit-desc {
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
		margin-top: 2px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.habit-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}

	.category-tag {
		font-size: 11px;
		font-weight: 500;
	}

	.freq-tag {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		background: var(--bg-tertiary, #45475a);
		padding: 1px 6px;
		border-radius: 4px;
	}

	.streak-badge {
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 12px;
		font-weight: 600;
		color: #fab387;
	}

	.streak-badge svg {
		width: 12px;
		height: 12px;
	}

	.habit-actions {
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.habit-card:hover .habit-actions {
		opacity: 1;
	}

	.action-btn {
		background: transparent;
		border: none;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.action-btn.delete:hover,
	.action-btn.delete.confirm {
		color: #f38ba8;
	}

	.action-btn svg {
		width: 14px;
		height: 14px;
	}

	/* Edit Form */
	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.btn-cancel,
	.btn-save {
		padding: 6px 14px;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
		transition: filter 0.15s;
	}

	.btn-cancel {
		background: var(--bg-tertiary, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.btn-save {
		background: var(--accent-color, #cba6f7);
		color: var(--bg-primary, #1e1e2e);
		font-weight: 500;
	}

	.btn-save:hover {
		filter: brightness(1.1);
	}

	/* Week View */
	.week-header {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		margin-left: 100px;
		margin-bottom: 6px;
		padding: 0 2px;
	}

	.week-day-label {
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		color: var(--text-secondary, #a6adc8);
		padding: 4px 0;
	}

	.week-day-label.today {
		color: var(--accent-color, #cba6f7);
		font-weight: 700;
	}

	.week-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.week-habit-name {
		width: 92px;
		min-width: 92px;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.week-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		flex: 1;
	}

	.week-cell {
		aspect-ratio: 1;
		border-radius: 6px;
		border: 1.5px solid var(--border-color, #45475a);
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
		padding: 0;
	}

	.week-cell:hover:not(:disabled) {
		border-color: var(--habit-color, #cba6f7);
		background: color-mix(in srgb, var(--habit-color, #cba6f7) 10%, transparent);
	}

	.week-cell.completed {
		background: var(--habit-color, #cba6f7);
		border-color: var(--habit-color, #cba6f7);
	}

	.week-cell.today-cell {
		border-color: var(--accent-color, #cba6f7);
		box-shadow: 0 0 0 1px var(--accent-color, #cba6f7);
	}

	.week-cell.future {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.week-cell svg {
		width: 60%;
		height: 60%;
		color: var(--bg-primary, #1e1e2e);
	}

	/* Stats View */
	.stats-card {
		background: var(--bg-secondary, #313244);
		border-radius: 10px;
		padding: 14px;
		margin-bottom: 10px;
	}

	.stats-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.stats-name {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
	}

	.stats-category {
		font-size: 11px;
		font-weight: 500;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		margin-bottom: 12px;
	}

	.stat-item {
		text-align: center;
		background: var(--bg-tertiary, #45475a);
		border-radius: 8px;
		padding: 8px 4px;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary, #cdd6f4);
		line-height: 1.2;
	}

	.stat-value.streak-value {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
	}

	.stat-value.streak-value svg {
		width: 14px;
		height: 14px;
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-secondary, #a6adc8);
		margin-top: 2px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.stats-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.bar-label {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		width: 72px;
		min-width: 72px;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background: var(--bg-tertiary, #45475a);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.bar-count {
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		width: 32px;
		text-align: right;
	}
</style>
