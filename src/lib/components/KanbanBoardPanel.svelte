<script lang="ts">
	import { onMount } from 'svelte';
	import { kanban, type TaskPriority, type KanbanCard, type KanbanColumn } from '$lib/stores/kanban';

	let adding: { columnId: string; title: string } | null = null;
	let editing: { cardId: string; title: string; description: string; priority: TaskPriority } | null = null;
	let dragging: { cardId: string; sourceColumnId: string } | null = null;
	let dragOverColumn: string | null = null;
	let addingColumn = false;
	let newColumnTitle = '';
	let renamingColumn: { id: string; title: string } | null = null;

	const priorities: { value: TaskPriority; label: string; color: string }[] = [
		{ value: 'low', label: 'Low', color: '#6b7280' },
		{ value: 'medium', label: 'Med', color: '#3b82f6' },
		{ value: 'high', label: 'High', color: '#f59e0b' },
		{ value: 'urgent', label: 'Urgent', color: '#ef4444' }
	];

	onMount(() => {
		kanban.load();
	});

	function priorityColor(p: TaskPriority): string {
		return priorities.find((x) => x.value === p)?.color ?? '#6b7280';
	}

	function startAdd(columnId: string) {
		adding = { columnId, title: '' };
	}

	async function submitAdd() {
		if (!adding || !adding.title.trim()) return;
		await kanban.addCard(adding.columnId, adding.title.trim());
		adding = null;
	}

	function startEdit(card: KanbanCard) {
		editing = {
			cardId: card.id,
			title: card.title,
			description: card.description,
			priority: card.priority
		};
	}

	async function submitEdit() {
		if (!editing) return;
		await kanban.updateCard(editing.cardId, {
			title: editing.title,
			description: editing.description,
			priority: editing.priority
		});
		editing = null;
	}

	function handleDragStart(e: DragEvent, cardId: string, columnId: string) {
		dragging = { cardId, sourceColumnId: columnId };
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', cardId);
		}
	}

	function handleDragOver(e: DragEvent, columnId: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverColumn = columnId;
	}

	function handleDragLeave() {
		dragOverColumn = null;
	}

	async function handleDrop(e: DragEvent, columnId: string) {
		e.preventDefault();
		dragOverColumn = null;
		if (!dragging) return;
		const col = $kanban.columns.find((c) => c.id === columnId);
		const targetIndex = col ? col.cards.length : 0;
		await kanban.moveCard(dragging.cardId, columnId, targetIndex);
		dragging = null;
	}

	async function handleAddColumn() {
		if (!newColumnTitle.trim()) return;
		await kanban.addColumn(newColumnTitle.trim());
		newColumnTitle = '';
		addingColumn = false;
	}

	async function handleRenameColumn() {
		if (!renamingColumn || !renamingColumn.title.trim()) return;
		await kanban.renameColumn(renamingColumn.id, renamingColumn.title.trim());
		renamingColumn = null;
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Kanban Board</h3>
		<button
			class="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
			onclick={() => (addingColumn = !addingColumn)}
		>
			+ Column
		</button>
	</div>

	{#if addingColumn}
		<div class="flex gap-2">
			<input
				type="text"
				class="flex-1 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
				placeholder="Column name..."
				bind:value={newColumnTitle}
				onkeydown={(e) => e.key === 'Enter' && handleAddColumn()}
			/>
			<button
				class="rounded bg-[var(--brand-500)] px-2 py-1 text-xs text-white hover:bg-[var(--brand-560)]"
				onclick={handleAddColumn}
			>
				Add
			</button>
			<button
				class="text-xs text-[var(--text-muted)]"
				onclick={() => {
					addingColumn = false;
					newColumnTitle = '';
				}}
			>
				Cancel
			</button>
		</div>
	{/if}

	<!-- Edit Card Modal -->
	{#if editing}
		<div class="space-y-2 rounded border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-3">
			<input
				type="text"
				class="w-full rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
				bind:value={editing.title}
				onkeydown={(e) => e.key === 'Enter' && submitEdit()}
			/>
			<textarea
				class="w-full resize-none rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
				rows="2"
				placeholder="Description..."
				bind:value={editing.description}
			></textarea>
			<div class="flex gap-1">
				{#each priorities as p}
					<button
						class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
						style="background: {editing.priority === p.value ? p.color : 'var(--bg-tertiary)'}; color: {editing.priority === p.value ? 'white' : 'var(--text-muted)'}"
						onclick={() => editing && (editing.priority = p.value)}
					>
						{p.label}
					</button>
				{/each}
			</div>
			<div class="flex gap-2">
				<button
					class="rounded bg-[var(--brand-500)] px-3 py-1 text-xs text-white hover:bg-[var(--brand-560)]"
					onclick={submitEdit}
				>
					Save
				</button>
				<button
					class="text-xs text-[var(--text-muted)]"
					onclick={() => (editing = null)}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Board Columns -->
	<div class="flex gap-2 overflow-x-auto pb-1">
		{#each $kanban.columns as column (column.id)}
			<div
				class="flex min-w-[180px] flex-1 flex-col gap-1.5 rounded-lg p-2 transition-colors"
				style="background: {dragOverColumn === column.id ? 'var(--bg-modifier-hover)' : 'var(--bg-tertiary)'}"
				ondragover={(e) => handleDragOver(e, column.id)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, column.id)}
				role="list"
			>
				<!-- Column Header -->
				<div class="mb-1 flex items-center justify-between">
					{#if renamingColumn?.id === column.id}
						<input
							type="text"
							class="w-full rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-[11px] font-semibold text-[var(--text-primary)] focus:outline-none"
							bind:value={renamingColumn.title}
							onkeydown={(e) => e.key === 'Enter' && handleRenameColumn()}
							onblur={handleRenameColumn}
						/>
					{:else}
						<button
							class="flex items-center gap-1.5 text-left"
							ondblclick={() => (renamingColumn = { id: column.id, title: column.title })}
						>
							<span
								class="inline-block h-2 w-2 rounded-full"
								style="background: {column.color ?? '#6b7280'}"
							></span>
							<span class="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
								{column.title}
							</span>
							<span class="text-[10px] text-[var(--text-muted)]">{column.cards.length}</span>
						</button>
					{/if}
					<div class="flex gap-1">
						<button
							class="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
							onclick={() => startAdd(column.id)}
							title="Add card"
						>
							+
						</button>
						{#if $kanban.columns.length > 1}
							<button
								class="text-[10px] text-[var(--text-muted)] hover:text-red-400"
								onclick={() => kanban.deleteColumn(column.id)}
								title="Delete column"
							>
								x
							</button>
						{/if}
					</div>
				</div>

				<!-- Add Card Form -->
				{#if adding?.columnId === column.id}
					<div class="rounded bg-[var(--bg-secondary)] p-2">
						<input
							type="text"
							class="w-full rounded bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
							placeholder="Card title..."
							bind:value={adding.title}
							onkeydown={(e) => {
								if (e.key === 'Enter') submitAdd();
								if (e.key === 'Escape') adding = null;
							}}
						/>
						<div class="mt-1.5 flex gap-1.5">
							<button
								class="rounded bg-[var(--brand-500)] px-2 py-0.5 text-[10px] text-white hover:bg-[var(--brand-560)]"
								onclick={submitAdd}
							>
								Add
							</button>
							<button
								class="text-[10px] text-[var(--text-muted)]"
								onclick={() => (adding = null)}
							>
								Cancel
							</button>
						</div>
					</div>
				{/if}

				<!-- Cards -->
				{#each column.cards as card (card.id)}
					<div
						class="group cursor-grab rounded bg-[var(--bg-secondary)] p-2 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
						draggable="true"
						ondragstart={(e) => handleDragStart(e, card.id, column.id)}
						role="listitem"
					>
						<div class="flex items-start justify-between gap-1">
							<button
								class="flex-1 text-left text-xs font-medium text-[var(--text-primary)]"
								onclick={() => startEdit(card)}
							>
								{card.title}
							</button>
							<button
								class="shrink-0 text-[10px] text-[var(--text-muted)] opacity-0 hover:text-red-400 group-hover:opacity-100"
								onclick={() => kanban.deleteCard(card.id)}
							>
								x
							</button>
						</div>
						{#if card.description}
							<p class="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
								{card.description.length > 80
									? card.description.slice(0, 80) + '...'
									: card.description}
							</p>
						{/if}
						<div class="mt-1.5 flex items-center gap-1.5">
							<span
								class="rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
								style="background: {priorityColor(card.priority)}"
							>
								{card.priority}
							</span>
							{#each card.tags.slice(0, 2) as tag}
								<span class="rounded bg-[var(--bg-tertiary)] px-1 py-0.5 text-[9px] text-[var(--text-muted)]">
									{tag}
								</span>
							{/each}
						</div>
					</div>
				{/each}

				{#if column.cards.length === 0 && adding?.columnId !== column.id}
					<div class="py-4 text-center text-[10px] text-[var(--text-muted)]">
						No cards yet
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Stats Footer -->
	{#if $kanban.columns.length > 0}
		{@const totalCards = $kanban.columns.reduce((sum, col) => sum + col.cards.length, 0)}
		<div class="flex items-center justify-between border-t border-[var(--bg-tertiary)] pt-2">
			<span class="text-[10px] text-[var(--text-muted)]">
				{totalCards} card{totalCards !== 1 ? 's' : ''} across {$kanban.columns.length} column{$kanban.columns.length !== 1 ? 's' : ''}
			</span>
			<span class="text-[10px] text-[var(--text-muted)]">
				Drag cards to move
			</span>
		</div>
	{/if}
</div>
