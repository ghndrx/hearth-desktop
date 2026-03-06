import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface JournalEntry {
  date: string;
  content: string;
  mood: number | null;
  tags: string[];
  updatedAt: number;
  wordCount: number;
}

export interface JournalStats {
  totalEntries: number;
  currentStreak: number;
  longestStreak: number;
  totalWords: number;
  moodAverage: number | null;
  entriesThisMonth: number;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function createJournalStore() {
  const entry = writable<JournalEntry>({
    date: todayString(),
    content: '',
    mood: null,
    tags: [],
    updatedAt: 0,
    wordCount: 0
  });

  const stats = writable<JournalStats>({
    totalEntries: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalWords: 0,
    moodAverage: null,
    entriesThisMonth: 0
  });

  const dates = writable<string[]>([]);
  const selectedDate = writable<string>(todayString());
  const saving = writable<boolean>(false);

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    subscribe: entry.subscribe,
    stats: { subscribe: stats.subscribe },
    dates: { subscribe: dates.subscribe },
    selectedDate: { subscribe: selectedDate.subscribe },
    saving: { subscribe: saving.subscribe },

    async init() {
      try {
        await this.loadEntry(todayString());
        await this.loadStats();
        await this.loadDates();
      } catch (error) {
        console.error('Failed to initialize journal:', error);
      }
    },

    async loadEntry(date: string) {
      try {
        selectedDate.set(date);
        const result = await invoke<JournalEntry>('journal_get_entry', { date });
        entry.set(result);
      } catch (error) {
        console.error('Failed to load journal entry:', error);
        entry.set({ date, content: '', mood: null, tags: [], updatedAt: 0, wordCount: 0 });
      }
    },

    async save() {
      try {
        saving.set(true);
        const current = get(entry);
        await invoke('journal_save_entry', { entry: current });
        await this.loadStats();
        await this.loadDates();
      } catch (error) {
        console.error('Failed to save journal entry:', error);
      } finally {
        saving.set(false);
      }
    },

    debouncedSave() {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => this.save(), 1000);
    },

    updateContent(content: string) {
      entry.update(e => ({
        ...e,
        content,
        wordCount: content.split(/\s+/).filter(w => w.length > 0).length
      }));
      this.debouncedSave();
    },

    setMood(mood: number | null) {
      entry.update(e => ({ ...e, mood }));
      this.save();
    },

    addTag(tag: string) {
      entry.update(e => {
        if (e.tags.includes(tag)) return e;
        return { ...e, tags: [...e.tags, tag] };
      });
      this.save();
    },

    removeTag(tag: string) {
      entry.update(e => ({
        ...e,
        tags: e.tags.filter(t => t !== tag)
      }));
      this.save();
    },

    async deleteEntry(date: string) {
      try {
        await invoke('journal_delete_entry', { date });
        if (get(selectedDate) === date) {
          entry.set({ date, content: '', mood: null, tags: [], updatedAt: 0, wordCount: 0 });
        }
        await this.loadStats();
        await this.loadDates();
      } catch (error) {
        console.error('Failed to delete journal entry:', error);
      }
    },

    async loadStats() {
      try {
        const result = await invoke<JournalStats>('journal_get_stats');
        stats.set(result);
      } catch (error) {
        console.error('Failed to load journal stats:', error);
      }
    },

    async loadDates() {
      try {
        const result = await invoke<string[]>('journal_list_dates');
        dates.set(result);
      } catch (error) {
        console.error('Failed to load journal dates:', error);
      }
    },

    async goToDate(date: string) {
      // Flush any pending save
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
        await this.save();
      }
      await this.loadEntry(date);
    },

    async goToPreviousDay() {
      const current = get(selectedDate);
      const d = new Date(current + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await this.goToDate(prev);
    },

    async goToNextDay() {
      const current = get(selectedDate);
      const today = todayString();
      if (current >= today) return; // Don't go past today
      const d = new Date(current + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await this.goToDate(next);
    },

    async goToToday() {
      await this.goToDate(todayString());
    },

    cleanup() {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        // Fire final save synchronously
        const current = get(entry);
        if (current.content) {
          invoke('journal_save_entry', { entry: current }).catch(() => {});
        }
      }
    }
  };
}

export const journal = createJournalStore();

export const journalWordCount = derived(
  { subscribe: journal.subscribe },
  $entry => $entry.wordCount
);

export const journalIsToday = derived(
  journal.selectedDate,
  $date => $date === todayString()
);
