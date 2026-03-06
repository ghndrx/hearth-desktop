import { writable, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  color: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  color: string | null;
}

export interface KanbanBoardState {
  columns: KanbanColumn[];
}

const defaultBoard: KanbanBoardState = { columns: [] };

function createKanbanStore() {
  const { subscribe, set, update } = writable<KanbanBoardState>(defaultBoard);
  const loading = writable(false);

  return {
    subscribe,
    loading,

    async load() {
      loading.set(true);
      try {
        const board = await invoke<KanbanBoardState>('kanban_get_board');
        set(board);
      } catch (e) {
        console.error('Failed to load kanban board:', e);
      } finally {
        loading.set(false);
      }
    },

    async addCard(
      columnId: string,
      title: string,
      description?: string,
      priority?: TaskPriority,
      color?: string,
      tags?: string[]
    ) {
      try {
        const card = await invoke<KanbanCard>('kanban_add_card', {
          columnId,
          title,
          description: description ?? null,
          priority: priority ?? null,
          color: color ?? null,
          tags: tags ?? null
        });
        update((board) => {
          const col = board.columns.find((c) => c.id === columnId);
          if (col) col.cards.push(card);
          return board;
        });
        return card;
      } catch (e) {
        console.error('Failed to add card:', e);
        throw e;
      }
    },

    async updateCard(
      cardId: string,
      updates: {
        title?: string;
        description?: string;
        priority?: TaskPriority;
        color?: string;
        tags?: string[];
      }
    ) {
      try {
        const card = await invoke<KanbanCard>('kanban_update_card', {
          cardId,
          title: updates.title ?? null,
          description: updates.description ?? null,
          priority: updates.priority ?? null,
          color: updates.color ?? null,
          tags: updates.tags ?? null
        });
        update((board) => {
          for (const col of board.columns) {
            const idx = col.cards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              col.cards[idx] = card;
              break;
            }
          }
          return board;
        });
        return card;
      } catch (e) {
        console.error('Failed to update card:', e);
        throw e;
      }
    },

    async deleteCard(cardId: string) {
      try {
        await invoke('kanban_delete_card', { cardId });
        update((board) => {
          for (const col of board.columns) {
            col.cards = col.cards.filter((c) => c.id !== cardId);
          }
          return board;
        });
      } catch (e) {
        console.error('Failed to delete card:', e);
        throw e;
      }
    },

    async moveCard(cardId: string, targetColumnId: string, targetIndex: number) {
      try {
        const board = await invoke<KanbanBoardState>('kanban_move_card', {
          cardId,
          targetColumnId,
          targetIndex
        });
        set(board);
      } catch (e) {
        console.error('Failed to move card:', e);
        throw e;
      }
    },

    async addColumn(title: string, color?: string) {
      try {
        const col = await invoke<KanbanColumn>('kanban_add_column', {
          title,
          color: color ?? null
        });
        update((board) => {
          board.columns.push(col);
          return board;
        });
        return col;
      } catch (e) {
        console.error('Failed to add column:', e);
        throw e;
      }
    },

    async deleteColumn(columnId: string) {
      try {
        await invoke('kanban_delete_column', { columnId });
        update((board) => {
          board.columns = board.columns.filter((c) => c.id !== columnId);
          return board;
        });
      } catch (e) {
        console.error('Failed to delete column:', e);
        throw e;
      }
    },

    async renameColumn(columnId: string, title: string) {
      try {
        await invoke<KanbanColumn>('kanban_rename_column', { columnId, title });
        update((board) => {
          const col = board.columns.find((c) => c.id === columnId);
          if (col) col.title = title;
          return board;
        });
      } catch (e) {
        console.error('Failed to rename column:', e);
        throw e;
      }
    }
  };
}

export const kanban = createKanbanStore();
