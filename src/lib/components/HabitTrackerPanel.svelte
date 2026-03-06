<script lang="ts">
	import { onMount } from 'svelte';
	import {
		habits,
		habitStats,
		loadHabits,
		createHabit,
		deleteHabit,
		completeHabit,
		uncompleteHabit,
		getHabitStats,
		resetHabit
	} from '$lib/stores/habitTracker';

	let showCreateForm = false;
	let newName = '';
	let newDescription = '';
	let newCategory = 'health';
	let newColor = '#4ade80';
	let newFrequency = 'daily';
	let selectedHabitId: string | null = null;
	let loading = false;

	const categories = ['health', 'productivity', 'learning', 'social', 'fitness', 'mindfulness', 'custom'];
	const colors = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa', '#fb923c', '#34d399', '#f87171'];
	const frequencies = ['daily', 'weekdays', 'weekends', 'weekly'];

	$: todayStr = new Date().toISOString().split('T')[0];

	function isCompletedToday(habitId: string): boolean {
		const stats = $habitStats.find((s: any) => s.habit_id === habitId);
		return stats?.completed_today ?? false;
	}

	async function handleCreate() {
		if (!newName.trim()) return;
		loading = true;
		await createHabit(newName.trim(), newDescription.trim(), newCategory, newColor, newFrequency);
		newName = '';
		newDescription = '';
		showCreateForm = false;
		loading = false;
	}

	async function handleToggleComplete(habitId: string) {
		if (isCompletedToday(habitId)) {
			await uncompleteHabit(habitId, todayStr);
		} else {
			await completeHabit(habitId, todayStr);
		}
		await getHabitStats();
	}

	async function handleDelete(habitId: string) {
		await deleteHabit(habitId);
		if (selectedHabitId === habitId) selectedHabitId = null;
	}

	function getStreakDisplay(habitId: string): number {
		const stats = $habitStats.find((s: any) => s.habit_id === habitId);
		return stats?.current_streak ?? 0;
	}

	function getCompletionRate(habitId: string): number {
		const stats = $habitStats.find((s: any) => s.habit_id === habitId);
		return stats?.completion_rate ?? 0;
	}

	function getTotalCompletions(habitId: string): number {
		const stats = $habitStats.find((s: any) => s.habit_id === habitId);
		return stats?.total_completions ?? 0;
	}

	function getLongestStreak(habitId: string): number {
		const stats = $habitStats.find((s: any) => s.habit_id === habitId);
		return stats?.longest_streak ?? 0;
	}

	onMount(async () => {
		await loadHabits();
		await getHabitStats();
	});
</script>

<div class="flex flex-col h-full bg-dark-900 text-gray-100">
	<div class="flex items-center justify-between p-4 border-b border-dark-600">
		<h2 class="text-lg font-semibold">Habit Tracker</h2>
		<button
			class="px-3 py-1.5 bg-hearth-500 hover:bg-hearth-600 text-white rounded-md text-sm font-medium transition-colors"
			on:click={() => (showCreateForm = !showCreateForm)}
		>
			{showCreateForm ? 'Cancel' : '+ New Habit'}
		</button>
	</div>

	{#if showCreateForm}
		<div class="p-4 border-b border-dark-600 bg-dark-800">
			<div class="space-y-3">
				<input
					bind:value={newName}
					placeholder="Habit name..."
					class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
				/>
				<input
					bind:value={newDescription}
					placeholder="Description (optional)"
					class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
				/>
				<div class="flex gap-3">
					<select
						bind:value={newCategory}
						class="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm"
					>
						{#each categories as cat}
							<option value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
						{/each}
					</select>
					<select
						bind:value={newFrequency}
						class="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm"
					>
						{#each frequencies as freq}
							<option value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</option>
						{/each}
					</select>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-sm text-gray-400">Color:</span>
					{#each colors as color}
						<button
							class="w-6 h-6 rounded-full border-2 transition-transform"
							class:border-white={newColor === color}
							class:border-transparent={newColor !== color}
							class:scale-110={newColor === color}
							style="background-color: {color}"
							on:click={() => (newColor = color)}
						/>
					{/each}
				</div>
				<button
					class="w-full py-2 bg-hearth-500 hover:bg-hearth-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
					disabled={!newName.trim() || loading}
					on:click={handleCreate}
				>
					Create Habit
				</button>
			</div>
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{#if $habits.length === 0}
			<div class="text-center py-12 text-gray-500">
				<p class="text-4xl mb-3">&#127919;</p>
				<p class="text-sm">No habits yet. Create one to start tracking!</p>
			</div>
		{:else}
			{#each $habits as habit (habit.id)}
				<div class="bg-dark-800 rounded-lg border border-dark-600 overflow-hidden">
					<div class="flex items-center gap-3 p-3">
						<button
							class="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0"
							style="border-color: {habit.color}; {isCompletedToday(habit.id) ? `background-color: ${habit.color}` : ''}"
							on:click={() => handleToggleComplete(habit.id)}
						>
							{#if isCompletedToday(habit.id)}
								<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</button>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="font-medium text-sm truncate">{habit.name}</span>
								<span class="text-xs px-1.5 py-0.5 rounded bg-dark-700 text-gray-400">{habit.category}</span>
							</div>
							{#if habit.description}
								<p class="text-xs text-gray-500 truncate">{habit.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-2 shrink-0">
							{#if getStreakDisplay(habit.id) > 0}
								<span class="text-sm" title="Current streak">
									&#128293; {getStreakDisplay(habit.id)}
								</span>
							{/if}
							<button
								class="text-gray-500 hover:text-gray-300 p-1"
								on:click={() => (selectedHabitId = selectedHabitId === habit.id ? null : habit.id)}
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
						</div>
					</div>

					<div class="px-3 pb-2">
						<div class="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all duration-300"
								style="width: {getCompletionRate(habit.id)}%; background-color: {habit.color}"
							/>
						</div>
					</div>

					{#if selectedHabitId === habit.id}
						<div class="border-t border-dark-600 p-3 space-y-3">
							<div class="grid grid-cols-3 gap-3 text-center">
								<div class="bg-dark-900 rounded-lg p-2">
									<p class="text-lg font-bold" style="color: {habit.color}">{getTotalCompletions(habit.id)}</p>
									<p class="text-xs text-gray-500">Total</p>
								</div>
								<div class="bg-dark-900 rounded-lg p-2">
									<p class="text-lg font-bold" style="color: {habit.color}">{getStreakDisplay(habit.id)}</p>
									<p class="text-xs text-gray-500">Streak</p>
								</div>
								<div class="bg-dark-900 rounded-lg p-2">
									<p class="text-lg font-bold" style="color: {habit.color}">{getLongestStreak(habit.id)}</p>
									<p class="text-xs text-gray-500">Best</p>
								</div>
							</div>
							<div class="flex gap-2">
								<button
									class="flex-1 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-md transition-colors"
									on:click={() => resetHabit(habit.id)}
								>
									Reset
								</button>
								<button
									class="flex-1 py-1.5 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-md transition-colors"
									on:click={() => handleDelete(habit.id)}
								>
									Delete
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	{#if $habits.length > 0}
		<div class="p-3 border-t border-dark-600 bg-dark-800">
			<div class="flex items-center justify-between text-xs text-gray-500">
				<span>{$habits.length} habit{$habits.length !== 1 ? 's' : ''}</span>
				<span>
					{$habitStats.filter((s) => s.completed_today).length}/{$habits.length} done today
				</span>
			</div>
		</div>
	{/if}
</div>
