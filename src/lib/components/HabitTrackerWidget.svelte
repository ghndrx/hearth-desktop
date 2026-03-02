<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  // Props
  let {
    compact = false
  }: {
    compact?: boolean;
  } = $props();

  // Types
  interface Habit {
    id: string;
    name: string;
    emoji: string;
    completedDates: string[];
    createdAt: string;
    currentStreak: number;
    longestStreak: number;
    color: string;
  }

  // State
  let habits = $state<Habit[]>([]);
  let showAddForm = $state(false);
  let newHabitName = $state('');
  let newHabitEmoji = $state('✅');
  let newHabitColor = $state('#5865f2');
  let expanded = $state(false);
  let editingHabit = $state<string | null>(null);
  let today = $state(getToday());

  // Predefined colors
  const COLORS = ['#5865f2', '#57f287', '#fee75c', '#ed4245', '#eb459e', '#9b59b6', '#3498db', '#1abc9c'];
  
  // Emoji quick picks
  const EMOJIS = ['✅', '💪', '🏃', '📚', '💧', '🧘', '🌅', '💊', '🎯', '🎨', '✍️', '🧠'];

  function getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function saveHabits() {
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
  }

  function loadHabits() {
    const stored = localStorage.getItem('hearth-habits');
    if (stored) {
      habits = JSON.parse(stored);
      recalculateStreaks();
    }
  }

  function recalculateStreaks() {
    const todayDate = new Date(today);
    
    habits = habits.map(habit => {
      let streak = 0;
      let checkDate = new Date(todayDate);
      
      // Check if completed today
      if (habit.completedDates.includes(today)) {
        streak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      // Count consecutive days
      while (habit.completedDates.includes(checkDate.toISOString().split('T')[0])) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      return {
        ...habit,
        currentStreak: streak,
        longestStreak: Math.max(habit.longestStreak, streak)
      };
    });
    
    saveHabits();
  }

  function addHabit() {
    if (!newHabitName.trim()) return;
    
    const habit: Habit = {
      id: generateId(),
      name: newHabitName.trim(),
      emoji: newHabitEmoji,
      completedDates: [],
      createdAt: new Date().toISOString(),
      currentStreak: 0,
      longestStreak: 0,
      color: newHabitColor
    };
    
    habits = [...habits, habit];
    saveHabits();
    
    newHabitName = '';
    newHabitEmoji = '✅';
    newHabitColor = '#5865f2';
    showAddForm = false;
  }

  function toggleHabit(habitId: string) {
    habits = habits.map(habit => {
      if (habit.id !== habitId) return habit;
      
      const completed = habit.completedDates.includes(today);
      const newDates = completed
        ? habit.completedDates.filter(d => d !== today)
        : [...habit.completedDates, today];
      
      return { ...habit, completedDates: newDates };
    });
    
    recalculateStreaks();
    
    // Native notification for completion
    const habit = habits.find(h => h.id === habitId);
    if (habit && habit.completedDates.includes(today)) {
      try {
        invoke('show_notification', {
          title: `${habit.emoji} Habit Complete!`,
          body: habit.currentStreak > 1 
            ? `${habit.name} - ${habit.currentStreak} day streak! 🔥`
            : `${habit.name} completed for today!`
        }).catch(() => {});
      } catch {}
    }
  }

  function deleteHabit(habitId: string) {
    habits = habits.filter(h => h.id !== habitId);
    saveHabits();
    editingHabit = null;
  }

  function isCompletedToday(habit: Habit): boolean {
    return habit.completedDates.includes(today);
  }

  function getCompletionRate(habit: Habit): number {
    const startDate = new Date(habit.createdAt);
    const todayDate = new Date(today);
    const daysSinceCreation = Math.max(1, Math.ceil((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    return Math.round((habit.completedDates.length / daysSinceCreation) * 100);
  }

  function getWeekProgress(habit: Habit): boolean[] {
    const result: boolean[] = [];
    const todayDate = new Date(today);
    
    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      result.push(habit.completedDates.includes(dateStr));
    }
    
    return result;
  }

  // Update today at midnight
  let midnightTimer: ReturnType<typeof setTimeout>;
  
  function scheduleMidnightUpdate() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    midnightTimer = setTimeout(() => {
      today = getToday();
      recalculateStreaks();
      scheduleMidnightUpdate();
    }, msUntilMidnight);
  }

  onMount(() => {
    loadHabits();
    scheduleMidnightUpdate();
  });

  onDestroy(() => {
    clearTimeout(midnightTimer);
  });

  // Derived
  let completedCount = $derived(habits.filter(h => isCompletedToday(h)).length);
  let totalCount = $derived(habits.length);
  let allCompletedToday = $derived(totalCount > 0 && completedCount === totalCount);
</script>

<div class="habit-tracker" class:compact class:expanded>
  <div class="widget-header" onclick={() => !compact && (expanded = !expanded)}>
    <div class="header-left">
      <span class="header-icon">📋</span>
      {#if compact}
        <span class="header-title">Habits</span>
      {:else}
        <span class="header-title">Habit Tracker</span>
      {/if}
    </div>
    <div class="header-right">
      <span class="progress-badge" class:all-done={allCompletedToday}>
        {completedCount}/{totalCount}
      </span>
      {#if !compact}
        <button class="expand-btn" onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}>
          {expanded ? '▼' : '▶'}
        </button>
      {/if}
    </div>
  </div>

  {#if expanded || compact}
    <div class="habits-list">
      {#if habits.length === 0}
        <div class="empty-state">
          <span class="empty-icon">🎯</span>
          <span class="empty-text">No habits yet</span>
        </div>
      {:else}
        {#each habits as habit (habit.id)}
          <div 
            class="habit-item"
            class:completed={isCompletedToday(habit)}
            style="--habit-color: {habit.color}"
          >
            <button 
              class="habit-check"
              onclick={() => toggleHabit(habit.id)}
              title={isCompletedToday(habit) ? 'Mark incomplete' : 'Mark complete'}
            >
              {#if isCompletedToday(habit)}
                <span class="check-mark">✓</span>
              {:else}
                <span class="check-empty"></span>
              {/if}
            </button>
            
            <div class="habit-info" onclick={() => editingHabit = editingHabit === habit.id ? null : habit.id}>
              <span class="habit-emoji">{habit.emoji}</span>
              <span class="habit-name">{habit.name}</span>
            </div>
            
            {#if habit.currentStreak > 0}
              <span class="streak-badge" title="{habit.currentStreak} day streak">
                🔥 {habit.currentStreak}
              </span>
            {/if}

            {#if editingHabit === habit.id}
              <div class="habit-details">
                <div class="week-progress">
                  {#each getWeekProgress(habit) as completed, i}
                    <span 
                      class="day-dot" 
                      class:completed
                      title={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                    ></span>
                  {/each}
                </div>
                <div class="habit-stats">
                  <span class="stat">
                    <span class="stat-value">{getCompletionRate(habit)}%</span>
                    <span class="stat-label">rate</span>
                  </span>
                  <span class="stat">
                    <span class="stat-value">{habit.longestStreak}</span>
                    <span class="stat-label">best</span>
                  </span>
                </div>
                <button class="delete-btn" onclick={() => deleteHabit(habit.id)}>
                  🗑️
                </button>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    {#if showAddForm}
      <div class="add-form">
        <div class="form-row">
          <select class="emoji-select" bind:value={newHabitEmoji}>
            {#each EMOJIS as emoji}
              <option value={emoji}>{emoji}</option>
            {/each}
          </select>
          <input
            type="text"
            class="habit-input"
            placeholder="New habit..."
            bind:value={newHabitName}
            onkeypress={(e) => e.key === 'Enter' && addHabit()}
          />
        </div>
        <div class="color-row">
          {#each COLORS as color}
            <button
              class="color-btn"
              class:selected={newHabitColor === color}
              style="background: {color}"
              onclick={() => newHabitColor = color}
            ></button>
          {/each}
        </div>
        <div class="form-actions">
          <button class="cancel-btn" onclick={() => showAddForm = false}>Cancel</button>
          <button class="save-btn" onclick={addHabit}>Add</button>
        </div>
      </div>
    {:else}
      <button class="add-btn" onclick={() => showAddForm = true}>
        + Add Habit
      </button>
    {/if}
  {/if}
</div>

<style>
  .habit-tracker {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
  }

  .habit-tracker.compact {
    padding: 8px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    margin-bottom: 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-icon {
    font-size: 14px;
  }

  .header-title {
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress-badge {
    background: var(--bg-tertiary, #1e1f22);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    color: var(--text-muted, #949ba4);
  }

  .progress-badge.all-done {
    background: #57f287;
    color: #000;
    font-weight: 600;
  }

  .expand-btn {
    background: none;
    border: none;
    color: var(--text-muted, #949ba4);
    cursor: pointer;
    font-size: 10px;
    padding: 2px;
  }

  .habits-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .empty-state {
    text-align: center;
    padding: 16px;
    color: var(--text-muted, #949ba4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .empty-icon {
    font-size: 24px;
  }

  .habit-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    border-left: 3px solid var(--habit-color, #5865f2);
    flex-wrap: wrap;
  }

  .habit-item.completed {
    opacity: 0.7;
  }

  .habit-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--habit-color, #5865f2);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .habit-item.completed .habit-check {
    background: var(--habit-color, #5865f2);
  }

  .check-mark {
    color: white;
    font-size: 12px;
    font-weight: bold;
  }

  .check-empty {
    width: 100%;
    height: 100%;
  }

  .habit-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    min-width: 0;
  }

  .habit-emoji {
    font-size: 14px;
  }

  .habit-name {
    color: var(--text-primary, #f2f3f5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .habit-item.completed .habit-name {
    text-decoration: line-through;
    color: var(--text-muted, #949ba4);
  }

  .streak-badge {
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(237, 66, 69, 0.2);
    border-radius: 10px;
    color: #ed4245;
    flex-shrink: 0;
  }

  .habit-details {
    width: 100%;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--bg-secondary, #2b2d31);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .week-progress {
    display: flex;
    gap: 3px;
  }

  .day-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--bg-secondary, #2b2d31);
    border: 1px solid var(--habit-color, #5865f2);
  }

  .day-dot.completed {
    background: var(--habit-color, #5865f2);
  }

  .habit-stats {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
    font-size: 11px;
  }

  .stat-label {
    font-size: 9px;
    color: var(--text-muted, #949ba4);
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .delete-btn:hover {
    opacity: 1;
  }

  .add-form {
    margin-top: 8px;
    padding: 8px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
  }

  .form-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }

  .emoji-select {
    width: 40px;
    padding: 4px;
    background: var(--bg-secondary, #2b2d31);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #f2f3f5);
    font-size: 14px;
    cursor: pointer;
  }

  .habit-input {
    flex: 1;
    padding: 6px 10px;
    background: var(--bg-secondary, #2b2d31);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #f2f3f5);
    font-size: 12px;
  }

  .habit-input::placeholder {
    color: var(--text-muted, #949ba4);
  }

  .color-row {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .color-btn {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .color-btn.selected {
    border-color: white;
    transform: scale(1.1);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .cancel-btn, .save-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  }

  .cancel-btn {
    background: transparent;
    color: var(--text-muted, #949ba4);
  }

  .cancel-btn:hover {
    color: var(--text-primary, #f2f3f5);
  }

  .save-btn {
    background: #5865f2;
    color: white;
  }

  .save-btn:hover {
    background: #4752c4;
  }

  .add-btn {
    width: 100%;
    margin-top: 8px;
    padding: 6px;
    background: transparent;
    border: 1px dashed var(--text-muted, #949ba4);
    border-radius: 6px;
    color: var(--text-muted, #949ba4);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .add-btn:hover {
    border-color: #5865f2;
    color: #5865f2;
  }
</style>
