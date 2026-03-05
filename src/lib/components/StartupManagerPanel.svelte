<script lang="ts">
	import { onMount } from 'svelte';
	import {
		startupState,
		startupTasks,
		startupProfiles,
		startupMetrics,
		enabledTasks,
		loadStartupState,
		toggleStartupTask,
		setTaskDefer,
		setTaskPriority,
		setActiveProfile,
		createStartupProfile,
		deleteStartupProfile,
		setLazyLoad,
		setStartupOptimization,
		resetStartupMetrics
	} from '$lib/stores/startupManager';

	let showCreateProfile = false;
	let newProfileName = '';
	let newProfileDesc = '';
	let selectedTaskIds: string[] = [];

	onMount(() => {
		loadStartupState();
	});

	async function handleToggle(taskId: string) {
		await toggleStartupTask(taskId);
	}

	async function handleDeferChange(taskId: string, value: string) {
		await setTaskDefer(taskId, parseInt(value) || 0);
	}

	async function handleCreateProfile() {
		if (!newProfileName.trim()) return;
		await createStartupProfile(newProfileName.trim(), newProfileDesc.trim(), selectedTaskIds);
		showCreateProfile = false;
		newProfileName = '';
		newProfileDesc = '';
		selectedTaskIds = [];
	}

	function formatMs(ms: number): string {
		if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
		return ms.toFixed(0) + 'ms';
	}

	function tasksByCategory(tasks: typeof $startupTasks): Record<string, typeof $startupTasks> {
		const cats: Record<string, typeof $startupTasks> = {};
		for (const task of tasks) {
			if (!cats[task.category]) cats[task.category] = [];
			cats[task.category].push(task);
		}
		return cats;
	}

	$: categorized = tasksByCategory($startupTasks);
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
			</svg>
			<h2 class="text-lg font-semibold">Startup Manager</h2>
		</div>
		<div class="flex gap-2">
			<button
				onclick={() => { showCreateProfile = true; }}
				class="rounded bg-dark-600 px-3 py-1 text-xs hover:bg-dark-500"
			>New Profile</button>
			<button
				onclick={resetStartupMetrics}
				class="rounded bg-dark-600 px-3 py-1 text-xs hover:bg-dark-500"
			>Reset Metrics</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if $startupMetrics.startupCount > 0}
			<div class="mb-4 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-2 text-sm font-medium text-dark-200">Startup Performance</h3>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<div class="text-center">
						<p class="text-2xl font-bold text-hearth-400">{formatMs($startupMetrics.averageStartupMs)}</p>
						<p class="text-xs text-dark-400">Average</p>
					</div>
					<div class="text-center">
						<p class="text-2xl font-bold text-green-400">{formatMs($startupMetrics.fastestStartupMs)}</p>
						<p class="text-xs text-dark-400">Fastest</p>
					</div>
					<div class="text-center">
						<p class="text-lg font-semibold text-yellow-400">{formatMs($startupMetrics.slowestStartupMs)}</p>
						<p class="text-xs text-dark-400">Slowest</p>
					</div>
					<div class="text-center">
						<p class="text-lg font-semibold text-dark-200">{$startupMetrics.startupCount}</p>
						<p class="text-xs text-dark-400">Total Boots</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="mb-4 rounded-lg bg-dark-700 p-4">
			<h3 class="mb-3 text-sm font-medium text-dark-200">Quick Settings</h3>
			<div class="flex flex-col gap-2">
				<label class="flex items-center justify-between text-sm">
					<span>Startup Optimization</span>
					<input
						type="checkbox"
						checked={$startupState.startupOptimizationEnabled}
						onchange={(e) => setStartupOptimization((e.target as HTMLInputElement).checked)}
						class="rounded"
					/>
				</label>
				<label class="flex items-center justify-between text-sm">
					<span>Lazy Loading</span>
					<input
						type="checkbox"
						checked={$startupState.lazyLoadEnabled}
						onchange={(e) => setLazyLoad((e.target as HTMLInputElement).checked)}
						class="rounded"
					/>
				</label>
			</div>
		</div>

		{#if $startupProfiles.length > 0}
			<div class="mb-4 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-3 text-sm font-medium text-dark-200">Startup Profiles</h3>
				<div class="flex flex-col gap-2">
					{#each $startupProfiles as profile}
						<div class="flex items-center justify-between rounded bg-dark-600 px-3 py-2">
							<div>
								<span class="text-sm">{profile.name}</span>
								<span class="ml-2 text-xs text-dark-400">{profile.taskIds.length} tasks</span>
							</div>
							<div class="flex gap-2">
								<button
									onclick={() => setActiveProfile(profile.id)}
									class="rounded px-2 py-1 text-xs {profile.isActive ? 'bg-hearth-500 text-white' : 'bg-dark-500 hover:bg-dark-400'}"
								>{profile.isActive ? 'Active' : 'Activate'}</button>
								{#if !profile.isActive}
									<button
										onclick={() => deleteStartupProfile(profile.id)}
										class="rounded bg-dark-500 px-2 py-1 text-xs hover:bg-red-600"
									>Delete</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if showCreateProfile}
			<div class="mb-4 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-3 text-sm font-medium text-dark-200">Create Profile</h3>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateProfile(); }} class="flex flex-col gap-3">
					<input bind:value={newProfileName} placeholder="Profile name" class="rounded bg-dark-600 px-3 py-2 text-sm" />
					<input bind:value={newProfileDesc} placeholder="Description" class="rounded bg-dark-600 px-3 py-2 text-sm" />
					<div class="flex justify-end gap-2">
						<button type="button" onclick={() => { showCreateProfile = false; }} class="rounded bg-dark-600 px-3 py-1 text-sm">Cancel</button>
						<button type="submit" class="rounded bg-hearth-500 px-3 py-1 text-sm">Create</button>
					</div>
				</form>
			</div>
		{/if}

		<div class="rounded-lg bg-dark-700 p-4">
			<h3 class="mb-3 text-sm font-medium text-dark-200">
				Startup Tasks ({$enabledTasks.length}/{$startupTasks.length} enabled)
			</h3>
			{#each Object.entries(categorized) as [category, tasks]}
				<div class="mb-3">
					<h4 class="mb-2 text-xs font-medium uppercase text-dark-400">{category}</h4>
					{#each tasks as task}
						<div class="mb-1 flex items-center justify-between rounded bg-dark-600 px-3 py-2">
							<div class="flex items-center gap-3">
								<input
									type="checkbox"
									checked={task.enabled}
									onchange={() => handleToggle(task.id)}
									class="rounded"
								/>
								<div>
									<span class="text-sm {task.enabled ? '' : 'text-dark-400'}">{task.name}</span>
									{#if task.averageDurationMs > 0}
										<span class="ml-2 text-xs text-dark-400">{formatMs(task.averageDurationMs)}</span>
									{/if}
								</div>
							</div>
							<div class="flex items-center gap-2">
								<label class="text-xs text-dark-400">
									Defer:
									<input
										type="number"
										value={task.deferMs}
										onchange={(e) => handleDeferChange(task.id, (e.target as HTMLInputElement).value)}
										class="ml-1 w-16 rounded bg-dark-500 px-2 py-0.5 text-xs"
										min="0"
										step="100"
									/>ms
								</label>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>
