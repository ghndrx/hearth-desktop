<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface Task {
		id: number;
		title: string;
		completed: boolean;
		priority: 'low' | 'medium' | 'high';
		createdAt: string;
		completedAt: string | null;
		dueDate: string | null;
	}

	interface TaskListStats {
		tasks: Task[];
		total: number;
		completed: number;
		pending: number;
	}

	let tasks = $state<Task[]>([]);
	let total = $state(0);
	let completed = $state(0);
	let pending = $state(0);
	let newTitle = $state('');
	let newPriority = $state<'low' | 'medium' | 'high'>('medium');
	let newDueDate = $state('');
	let editingId = $state<number | null>(null);
	let editTitle = $state('');
	let filter = $state<'all' | 'pending' | 'completed'>('all');
	let error = $state<string | null>(null);

	onMount(load);

	function applyStats(stats: TaskListStats) {
		tasks = stats.tasks;
		total = stats.total;
		completed = stats.completed;
		pending = stats.pending;
	}

	async function load() {
		try {
			applyStats(await invoke<TaskListStats>('tasklist_get'));
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function addTask() {
		const title = newTitle.trim();
		if (!title) return;
		try {
			applyStats(await invoke<TaskListStats>('tasklist_add', {
				title,
				priority: newPriority,
				dueDate: newDueDate || null,
			}));
			newTitle = '';
			newDueDate = '';
			newPriority = 'medium';
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function toggle(id: number) {
		try {
			applyStats(await invoke<TaskListStats>('tasklist_toggle', { id }));
		} catch (e) {
			error = String(e);
		}
	}

	async function remove(id: number) {
		try {
			applyStats(await invoke<TaskListStats>('tasklist_remove', { id }));
		} catch (e) {
			error = String(e);
		}
	}

	async function clearCompleted() {
		try {
			applyStats(await invoke<TaskListStats>('tasklist_clear_completed'));
		} catch (e) {
			error = String(e);
		}
	}

	function startEdit(task: Task) {
		editingId = task.id;
		editTitle = task.title;
	}

	async function saveEdit(id: number) {
		if (!editTitle.trim()) return;
		try {
			applyStats(await invoke<TaskListStats>('tasklist_update', {
				id,
				title: editTitle.trim(),
				priority: null,
				dueDate: null,
			}));
			editingId = null;
			editTitle = '';
		} catch (e) {
			error = String(e);
		}
	}

	async function cyclePriority(task: Task) {
		const next = task.priority === 'low' ? 'medium' : task.priority === 'medium' ? 'high' : 'low';
		try {
			applyStats(await invoke<TaskListStats>('tasklist_update', {
				id: task.id,
				title: null,
				priority: next,
				dueDate: null,
			}));
		} catch (e) {
			error = String(e);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addTask();
	}

	function handleEditKeydown(e: KeyboardEvent, id: number) {
		if (e.key === 'Enter') saveEdit(id);
		if (e.key === 'Escape') { editingId = null; editTitle = ''; }
	}

	function priorityColor(p: string): string {
		switch (p) {
			case 'high': return '#ed4245';
			case 'medium': return '#faa61a';
			case 'low': return '#3ba55d';
			default: return '#949ba4';
		}
	}

	function timeAgo(timestamp: string): string {
		const diff = Date.now() - new Date(timestamp).getTime();
		const secs = Math.floor(diff / 1000);
		if (secs < 60) return 'just now';
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
		return `${Math.floor(secs / 86400)}d ago`;
	}

	function isDueSoon(dueDate: string | null): boolean {
		if (!dueDate) return false;
		const due = new Date(dueDate).getTime();
		const now = Date.now();
		return due > now && due - now < 86400000; // within 24h
	}

	function isOverdue(dueDate: string | null): boolean {
		if (!dueDate) return false;
		return new Date(dueDate).getTime() < Date.now();
	}

	let filteredTasks = $derived(
		filter === 'all' ? tasks
			: filter === 'pending' ? tasks.filter(t => !t.completed)
			: tasks.filter(t => t.completed)
	);

	let progressPct = $derived(total > 0 ? Math.round((completed / total) * 100) : 0);
</script>

<div class="tasklist-panel">
	<div class="panel-header">
		<div class="header-left">
			<h3>Tasks</h3>
			{#if total > 0}
				<span class="badge">{pending}</span>
			{/if}
		</div>
		{#if completed > 0}
			<button class="text-btn" onclick={clearCompleted}>Clear done</button>
		{/if}
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if total > 0}
		<div class="progress-bar">
			<div class="progress-fill" style="width: {progressPct}%"></div>
		</div>
		<div class="progress-label">{completed}/{total} completed ({progressPct}%)</div>
	{/if}

	<div class="add-form">
		<input
			type="text"
			class="add-input"
			placeholder="Add a task..."
			bind:value={newTitle}
			onkeydown={handleKeydown}
		/>
		<div class="add-options">
			<select class="priority-select" bind:value={newPriority}>
				<option value="low">Low</option>
				<option value="medium">Med</option>
				<option value="high">High</option>
			</select>
			<input type="date" class="date-input" bind:value={newDueDate} />
			<button class="add-btn" onclick={addTask} disabled={!newTitle.trim()}>Add</button>
		</div>
	</div>

	{#if total > 0}
		<div class="filter-bar">
			{#each (['all', 'pending', 'completed'] as const) as f}
				<button
					class="filter-btn"
					class:active={filter === f}
					onclick={() => filter = f}
				>
					{f === 'all' ? `All (${total})` : f === 'pending' ? `To do (${pending})` : `Done (${completed})`}
				</button>
			{/each}
		</div>
	{/if}

	<div class="task-list">
		{#each filteredTasks as task (task.id)}
			<div class="task-item" class:done={task.completed} class:overdue={!task.completed && isOverdue(task.dueDate)}>
				<button
					class="check-btn"
					onclick={() => toggle(task.id)}
					title={task.completed ? 'Mark incomplete' : 'Mark complete'}
				>
					{#if task.completed}
						<span class="check-mark">&#x2713;</span>
					{:else}
						<span class="check-empty"></span>
					{/if}
				</button>

				<div class="task-body">
					{#if editingId === task.id}
						<input
							type="text"
							class="edit-input"
							bind:value={editTitle}
							onkeydown={(e) => handleEditKeydown(e, task.id)}
							onblur={() => saveEdit(task.id)}
						/>
					{:else}
						<span class="task-title" ondblclick={() => startEdit(task)}>{task.title}</span>
					{/if}
					<div class="task-meta">
						<button
							class="priority-dot"
							style="background: {priorityColor(task.priority)}"
							onclick={() => cyclePriority(task)}
							title={`Priority: ${task.priority}`}
						></button>
						<span class="meta-text">{timeAgo(task.createdAt)}</span>
						{#if task.dueDate}
							<span class="due-tag" class:due-soon={isDueSoon(task.dueDate)} class:due-overdue={isOverdue(task.dueDate)}>
								Due {task.dueDate}
							</span>
						{/if}
					</div>
				</div>

				<button class="remove-btn" onclick={() => remove(task.id)} title="Delete">&#x2715;</button>
			</div>
		{:else}
			<div class="empty-state">
				{filter === 'all' ? 'No tasks yet. Add one above.' : `No ${filter} tasks.`}
			</div>
		{/each}
	</div>
</div>

<style>
	.tasklist-panel {
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
	h3 { margin: 0; font-size: 14px; font-weight: 600; }

	.badge {
		font-size: 10px; font-weight: 700;
		background: #5865f2; color: white;
		padding: 1px 6px; border-radius: 10px;
		min-width: 16px; text-align: center;
	}

	.text-btn {
		background: none; border: none;
		color: var(--text-muted, #6d6f78);
		font-size: 11px; cursor: pointer;
	}
	.text-btn:hover { color: var(--text-primary, #dbdee1); }

	.error { font-size: 12px; color: #ed4245; }

	.progress-bar {
		height: 4px; border-radius: 2px;
		background: var(--bg-tertiary, #1e1f22);
		overflow: hidden;
	}
	.progress-fill {
		height: 100%; border-radius: 2px;
		background: #3ba55d;
		transition: width 0.3s ease;
	}
	.progress-label {
		font-size: 10px; color: var(--text-muted, #6d6f78);
		text-align: right;
	}

	.add-form {
		display: flex; flex-direction: column; gap: 6px;
	}
	.add-input {
		width: 100%; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 13px;
		box-sizing: border-box;
	}
	.add-input:focus { outline: none; border-color: #5865f2; }

	.add-options { display: flex; gap: 6px; align-items: center; }
	.priority-select, .date-input {
		padding: 4px 6px; border-radius: 4px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4); font-size: 11px;
	}
	.date-input { flex: 1; }
	.date-input::-webkit-calendar-picker-indicator { filter: invert(0.7); }

	.add-btn {
		padding: 4px 12px; border-radius: 4px; border: none;
		background: #5865f2; color: white;
		font-size: 12px; font-weight: 500; cursor: pointer;
	}
	.add-btn:hover { background: #4752c4; }
	.add-btn:disabled { opacity: 0.4; cursor: default; }

	.filter-bar { display: flex; gap: 4px; }
	.filter-btn {
		padding: 4px 8px; border-radius: 12px; border: none;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px; cursor: pointer;
	}
	.filter-btn:hover { color: var(--text-primary, #dbdee1); }
	.filter-btn.active { background: #5865f2; color: white; }

	.task-list {
		display: flex; flex-direction: column; gap: 4px;
		max-height: 400px; overflow-y: auto;
	}

	.task-item {
		display: flex; align-items: flex-start; gap: 8px;
		padding: 8px 10px; border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		transition: background 0.15s;
	}
	.task-item:hover { background: rgba(88, 101, 242, 0.06); }
	.task-item.done { opacity: 0.55; }
	.task-item.overdue { border-left: 3px solid #ed4245; }

	.check-btn {
		background: none; border: none; cursor: pointer;
		padding: 2px; margin-top: 1px; flex-shrink: 0;
	}
	.check-empty {
		display: block; width: 16px; height: 16px;
		border: 2px solid var(--text-muted, #6d6f78);
		border-radius: 4px;
	}
	.check-mark {
		display: flex; align-items: center; justify-content: center;
		width: 16px; height: 16px;
		background: #3ba55d; color: white;
		border-radius: 4px; font-size: 11px; font-weight: 700;
	}

	.task-body { flex: 1; min-width: 0; }
	.task-title {
		font-size: 13px; line-height: 1.3;
		word-break: break-word; cursor: default;
	}
	.task-item.done .task-title { text-decoration: line-through; }

	.edit-input {
		width: 100%; padding: 4px 6px; border-radius: 4px;
		border: 1px solid #5865f2;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 13px; box-sizing: border-box;
	}
	.edit-input:focus { outline: none; }

	.task-meta {
		display: flex; align-items: center; gap: 6px; margin-top: 4px;
	}
	.priority-dot {
		width: 8px; height: 8px; border-radius: 50%;
		border: none; cursor: pointer; flex-shrink: 0;
	}
	.meta-text { font-size: 10px; color: var(--text-muted, #6d6f78); }

	.due-tag {
		font-size: 10px; padding: 1px 5px; border-radius: 3px;
		background: rgba(88, 101, 242, 0.1); color: #8b9cfa;
	}
	.due-tag.due-soon { background: rgba(250, 166, 26, 0.15); color: #faa61a; }
	.due-tag.due-overdue { background: rgba(237, 66, 69, 0.15); color: #ed4245; }

	.remove-btn {
		background: none; border: none;
		color: var(--text-muted, #6d6f78);
		font-size: 12px; cursor: pointer;
		padding: 2px 4px; border-radius: 3px;
		opacity: 0; transition: opacity 0.15s;
	}
	.task-item:hover .remove-btn { opacity: 1; }
	.remove-btn:hover { color: #ed4245; }

	.empty-state {
		text-align: center; padding: 24px 16px;
		font-size: 12px; color: var(--text-muted, #6d6f78);
	}
</style>
