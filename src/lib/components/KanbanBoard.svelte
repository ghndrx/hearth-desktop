<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  let {
    compact = false
  }: {
    compact?: boolean;
  } = $props();

  interface KanbanCard {
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    color: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  }

  interface KanbanColumn {
    id: string;
    title: string;
    cards: KanbanCard[];
    color: string | null;
  }

  interface KanbanBoardState {
    columns: KanbanColumn[];
  }

  let columns = $state<KanbanColumn[]>([]);
  let draggedCard = $state<{ cardId: string; sourceColumnId: string } | null>(null);
  let dropTarget = $state<{ columnId: string; index: number } | null>(null);
  let showAddCard = $state<string | null>(null);
  let newCardTitle = $state('');
  let newCardPriority = $state<'low' | 'medium' | 'high' | 'urgent'>('medium');
  let editingCard = $state<string | null>(null);
  let editTitle = $state('');
  let editDescription = $state('');
  let showAddColumn = $state(false);
  let newColumnTitle = $state('');

  const PRIORITY_COLORS: Record<string, string> = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#f97316',
    urgent: '#ef4444',
  };

  const PRIORITY_LABELS: Record<string, string> = {
    low: 'Low',
    medium: 'Med',
    high: 'High',
    urgent: 'Urgent',
  };

  onMount(async () => {
    await loadBoard();
  });

  async function loadBoard() {
    try {
      const board = await invoke<KanbanBoardState>('kanban_get_board');
      columns = board.columns;
    } catch {
      columns = [
        { id: 'todo', title: 'To Do', cards: [], color: '#5865f2' },
        { id: 'in-progress', title: 'In Progress', cards: [], color: '#f59e0b' },
        { id: 'done', title: 'Done', cards: [], color: '#22c55e' },
      ];
    }
  }

  async function addCard(columnId: string) {
    if (!newCardTitle.trim()) return;
    try {
      const card = await invoke<KanbanCard>('kanban_add_card', {
        columnId,
        title: newCardTitle.trim(),
        priority: newCardPriority,
      });
      const col = columns.find(c => c.id === columnId);
      if (col) col.cards = [...col.cards, card];
      newCardTitle = '';
      newCardPriority = 'medium';
      showAddCard = null;
    } catch (e) {
      console.error('Failed to add card:', e);
    }
  }

  async function deleteCard(cardId: string) {
    try {
      await invoke('kanban_delete_card', { cardId });
      for (const col of columns) {
        col.cards = col.cards.filter(c => c.id !== cardId);
      }
    } catch (e) {
      console.error('Failed to delete card:', e);
    }
  }

  async function saveCardEdit(cardId: string) {
    try {
      await invoke('kanban_update_card', {
        cardId,
        title: editTitle.trim() || undefined,
        description: editDescription.trim(),
      });
      for (const col of columns) {
        const card = col.cards.find(c => c.id === cardId);
        if (card) {
          if (editTitle.trim()) card.title = editTitle.trim();
          card.description = editDescription.trim();
        }
      }
      editingCard = null;
    } catch (e) {
      console.error('Failed to update card:', e);
    }
  }

  async function moveCard(cardId: string, targetColumnId: string, targetIndex: number) {
    try {
      const board = await invoke<KanbanBoardState>('kanban_move_card', {
        cardId,
        targetColumnId,
        targetIndex,
      });
      columns = board.columns;
    } catch (e) {
      console.error('Failed to move card:', e);
    }
  }

  async function addColumn() {
    if (!newColumnTitle.trim()) return;
    try {
      const col = await invoke<KanbanColumn>('kanban_add_column', {
        title: newColumnTitle.trim(),
      });
      columns = [...columns, col];
      newColumnTitle = '';
      showAddColumn = false;
    } catch (e) {
      console.error('Failed to add column:', e);
    }
  }

  async function deleteColumn(columnId: string) {
    try {
      await invoke('kanban_delete_column', { columnId });
      columns = columns.filter(c => c.id !== columnId);
    } catch (e) {
      console.error('Failed to delete column:', e);
    }
  }

  function handleDragStart(cardId: string, columnId: string) {
    draggedCard = { cardId, sourceColumnId: columnId };
  }

  function handleDragOver(e: DragEvent, columnId: string, index: number) {
    e.preventDefault();
    dropTarget = { columnId, index };
  }

  function handleDragLeave() {
    dropTarget = null;
  }

  async function handleDrop(e: DragEvent, columnId: string, index: number) {
    e.preventDefault();
    if (draggedCard) {
      await moveCard(draggedCard.cardId, columnId, index);
    }
    draggedCard = null;
    dropTarget = null;
  }

  function handleColumnDrop(e: DragEvent, columnId: string) {
    e.preventDefault();
    if (draggedCard) {
      const col = columns.find(c => c.id === columnId);
      moveCard(draggedCard.cardId, columnId, col?.cards.length ?? 0);
    }
    draggedCard = null;
    dropTarget = null;
  }

  function startEdit(card: KanbanCard) {
    editingCard = card.id;
    editTitle = card.title;
    editDescription = card.description;
  }

  function totalCards(): number {
    return columns.reduce((sum, col) => sum + col.cards.length, 0);
  }
</script>

<div class="kanban-board" class:compact>
  <div class="kanban-header">
    <div class="kanban-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="4" rx="1" />
        <rect x="14" y="11" width="7" height="10" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
      <span>Task Board</span>
      <span class="task-count">{totalCards()} tasks</span>
    </div>
  </div>

  <div class="columns-container">
    {#each columns as column (column.id)}
      <div
        class="column"
        ondragover={(e) => handleColumnDrop(e, column.id)}
      >
        <div class="column-header">
          <div class="column-title-row">
            <span
              class="column-dot"
              style="background-color: {column.color || '#888'}"
            ></span>
            <span class="column-title">{column.title}</span>
            <span class="column-count">{column.cards.length}</span>
          </div>
          <div class="column-actions">
            <button
              class="icon-btn"
              title="Add card"
              onclick={() => { showAddCard = column.id; newCardTitle = ''; }}
            >+</button>
            {#if columns.length > 1}
              <button
                class="icon-btn danger"
                title="Delete column"
                onclick={() => deleteColumn(column.id)}
              >&times;</button>
            {/if}
          </div>
        </div>

        <div class="cards-list">
          {#each column.cards as card, index (card.id)}
            <div
              class="card"
              class:dragging={draggedCard?.cardId === card.id}
              class:drop-above={dropTarget?.columnId === column.id && dropTarget?.index === index}
              draggable="true"
              ondragstart={() => handleDragStart(card.id, column.id)}
              ondragover={(e) => handleDragOver(e, column.id, index)}
              ondragleave={handleDragLeave}
              ondrop={(e) => handleDrop(e, column.id, index)}
              role="listitem"
            >
              {#if editingCard === card.id}
                <div class="card-edit">
                  <input
                    type="text"
                    bind:value={editTitle}
                    class="edit-input"
                    placeholder="Title"
                    onkeydown={(e) => e.key === 'Enter' && saveCardEdit(card.id)}
                  />
                  <textarea
                    bind:value={editDescription}
                    class="edit-textarea"
                    placeholder="Description (optional)"
                    rows="2"
                  ></textarea>
                  <div class="edit-actions">
                    <button class="btn-save" onclick={() => saveCardEdit(card.id)}>Save</button>
                    <button class="btn-cancel" onclick={() => { editingCard = null; }}>Cancel</button>
                  </div>
                </div>
              {:else}
                <div class="card-content" ondblclick={() => startEdit(card)}>
                  <div class="card-top-row">
                    <span
                      class="priority-badge"
                      style="background-color: {PRIORITY_COLORS[card.priority]}"
                    >{PRIORITY_LABELS[card.priority]}</span>
                    <button
                      class="card-delete"
                      title="Delete"
                      onclick={() => deleteCard(card.id)}
                    >&times;</button>
                  </div>
                  <div class="card-title">{card.title}</div>
                  {#if card.description}
                    <div class="card-desc">{card.description}</div>
                  {/if}
                  {#if card.tags.length > 0}
                    <div class="card-tags">
                      {#each card.tags as tag}
                        <span class="tag">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}

          <!-- Drop zone at end of list -->
          <div
            class="drop-zone"
            class:active={dropTarget?.columnId === column.id && dropTarget?.index === column.cards.length}
            ondragover={(e) => handleDragOver(e, column.id, column.cards.length)}
            ondragleave={handleDragLeave}
            ondrop={(e) => handleDrop(e, column.id, column.cards.length)}
            role="listitem"
          ></div>
        </div>

        {#if showAddCard === column.id}
          <div class="add-card-form">
            <input
              type="text"
              bind:value={newCardTitle}
              placeholder="Task title..."
              class="add-input"
              onkeydown={(e) => e.key === 'Enter' && addCard(column.id)}
            />
            <div class="add-card-options">
              <select bind:value={newCardPriority} class="priority-select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <button class="btn-add" onclick={() => addCard(column.id)}>Add</button>
              <button class="btn-cancel" onclick={() => { showAddCard = null; }}>Cancel</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}

    <!-- Add column button -->
    <div class="add-column">
      {#if showAddColumn}
        <div class="add-column-form">
          <input
            type="text"
            bind:value={newColumnTitle}
            placeholder="Column name..."
            class="add-input"
            onkeydown={(e) => e.key === 'Enter' && addColumn()}
          />
          <div class="add-column-actions">
            <button class="btn-add" onclick={addColumn}>Add</button>
            <button class="btn-cancel" onclick={() => { showAddColumn = false; }}>Cancel</button>
          </div>
        </div>
      {:else}
        <button class="add-column-btn" onclick={() => { showAddColumn = true; newColumnTitle = ''; }}>
          + Add Column
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .kanban-board {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1e1e2e);
    border-radius: 8px;
    overflow: hidden;
  }

  .kanban-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #2e2e3e);
  }

  .kanban-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary, #cdd6f4);
  }

  .task-count {
    font-size: 12px;
    color: var(--text-secondary, #6c7086);
    font-weight: 400;
  }

  .columns-container {
    display: flex;
    gap: 12px;
    padding: 12px;
    overflow-x: auto;
    flex: 1;
    align-items: flex-start;
  }

  .column {
    flex: 0 0 260px;
    background: var(--bg-secondary, #181825);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    max-height: 100%;
  }

  .compact .column {
    flex: 0 0 220px;
  }

  .column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color, #2e2e3e);
  }

  .column-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .column-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .column-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .column-count {
    font-size: 11px;
    color: var(--text-secondary, #6c7086);
    background: var(--bg-tertiary, #11111b);
    padding: 1px 6px;
    border-radius: 8px;
  }

  .column-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-secondary, #6c7086);
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }

  .icon-btn:hover {
    background: var(--bg-tertiary, #11111b);
    color: var(--text-primary, #cdd6f4);
  }

  .icon-btn.danger:hover {
    color: #ef4444;
  }

  .cards-list {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    min-height: 40px;
  }

  .card {
    background: var(--bg-primary, #1e1e2e);
    border-radius: 6px;
    border: 1px solid var(--border-color, #2e2e3e);
    cursor: grab;
    transition: opacity 0.15s, box-shadow 0.15s;
  }

  .card:active {
    cursor: grabbing;
  }

  .card.dragging {
    opacity: 0.4;
  }

  .card.drop-above {
    box-shadow: 0 -2px 0 0 #5865f2;
  }

  .card-content {
    padding: 8px 10px;
  }

  .card-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .priority-badge {
    font-size: 10px;
    font-weight: 600;
    color: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .card-delete {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-secondary, #6c7086);
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .card:hover .card-delete {
    opacity: 1;
  }

  .card-delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .card-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #cdd6f4);
    line-height: 1.3;
  }

  .card-desc {
    font-size: 11px;
    color: var(--text-secondary, #6c7086);
    margin-top: 4px;
    line-height: 1.3;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .tag {
    font-size: 10px;
    background: var(--bg-tertiary, #11111b);
    color: var(--text-secondary, #6c7086);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .card-edit {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .edit-input,
  .add-input {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    background: var(--bg-tertiary, #11111b);
    border: 1px solid var(--border-color, #2e2e3e);
    border-radius: 4px;
    color: var(--text-primary, #cdd6f4);
    outline: none;
    box-sizing: border-box;
  }

  .edit-input:focus,
  .add-input:focus {
    border-color: #5865f2;
  }

  .edit-textarea {
    width: 100%;
    padding: 6px 8px;
    font-size: 12px;
    background: var(--bg-tertiary, #11111b);
    border: 1px solid var(--border-color, #2e2e3e);
    border-radius: 4px;
    color: var(--text-primary, #cdd6f4);
    outline: none;
    resize: vertical;
    font-family: inherit;
    box-sizing: border-box;
  }

  .edit-actions,
  .add-card-options,
  .add-column-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .btn-save,
  .btn-add {
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    background: #5865f2;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-save:hover,
  .btn-add:hover {
    background: #4752c4;
  }

  .btn-cancel {
    padding: 4px 12px;
    font-size: 12px;
    background: transparent;
    color: var(--text-secondary, #6c7086);
    border: 1px solid var(--border-color, #2e2e3e);
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-cancel:hover {
    color: var(--text-primary, #cdd6f4);
  }

  .priority-select {
    padding: 4px 6px;
    font-size: 11px;
    background: var(--bg-tertiary, #11111b);
    color: var(--text-primary, #cdd6f4);
    border: 1px solid var(--border-color, #2e2e3e);
    border-radius: 4px;
    outline: none;
  }

  .add-card-form {
    padding: 8px;
    border-top: 1px solid var(--border-color, #2e2e3e);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .drop-zone {
    min-height: 4px;
    border-radius: 4px;
    transition: min-height 0.15s, background 0.15s;
  }

  .drop-zone.active {
    min-height: 32px;
    background: rgba(88, 101, 242, 0.15);
    border: 1px dashed rgba(88, 101, 242, 0.4);
  }

  .add-column {
    flex: 0 0 200px;
  }

  .add-column-btn {
    width: 100%;
    padding: 10px;
    font-size: 13px;
    color: var(--text-secondary, #6c7086);
    background: var(--bg-secondary, #181825);
    border: 1px dashed var(--border-color, #2e2e3e);
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .add-column-btn:hover {
    color: var(--text-primary, #cdd6f4);
    border-color: #5865f2;
  }

  .add-column-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-secondary, #181825);
    border-radius: 8px;
    padding: 10px;
  }
</style>
