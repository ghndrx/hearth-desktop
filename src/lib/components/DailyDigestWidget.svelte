<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { fade, slide } from 'svelte/transition';
  import { quartOut } from 'svelte/easing';

  // Types
  interface DigestEvent {
    id: string;
    title: string;
    time: string;
    type: 'meeting' | 'reminder' | 'task' | 'message';
    priority: 'low' | 'normal' | 'high';
  }

  interface DigestSummary {
    unreadMessages: number;
    unreadMentions: number;
    upcomingEvents: number;
    activeTasks: number;
    focusTimeToday: number; // minutes
    pomodoroSessions: number;
  }

  interface QuickAction {
    id: string;
    label: string;
    icon: string;
    action: () => void;
    color?: string;
  }

  // Props
  export let isOpen = false;
  export let onClose: () => void = () => {};

  // State
  let summary: DigestSummary = {
    unreadMessages: 0,
    unreadMentions: 0,
    upcomingEvents: 0,
    activeTasks: 0,
    focusTimeToday: 0,
    pomodoroSessions: 0
  };
  
  let events: DigestEvent[] = [];
  let focusModeActive = false;
  let dndActive = false;
  let loading = true;
  let currentTime = new Date();
  let greeting = '';
  let refreshInterval: ReturnType<typeof setInterval>;

  // Quick actions
  let quickActions: QuickAction[] = [];

  function updateGreeting() {
    const hour = currentTime.getHours();
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  async function loadDigestData() {
    try {
      // Get notification summary
      const unreadCount = await invoke<number>('get_unread_notification_count');
      
      // Get focus mode status
      const focusStatus = await invoke<boolean>('is_focus_mode_active');
      
      // Get DND status
      const dndStatus = await invoke<boolean>('is_dnd_active');
      
      // Get calendar events
      const calendarEvents = await invoke<DigestEvent[]>('calendar_get_upcoming_events', { 
        limit: 5 
      }).catch(() => []);
      
      // Get pomodoro state
      const pomodoroState = await invoke<{ sessionsCompleted: number; totalFocusMinutes: number }>(
        'pomodoro_get_state'
      ).catch(() => ({ sessionsCompleted: 0, totalFocusMinutes: 0 }));

      summary = {
        unreadMessages: unreadCount || 0,
        unreadMentions: 0, // Would come from message store
        upcomingEvents: calendarEvents?.length || 0,
        activeTasks: 0, // Would come from task store
        focusTimeToday: pomodoroState.totalFocusMinutes || 0,
        pomodoroSessions: pomodoroState.sessionsCompleted || 0
      };

      events = calendarEvents || [];
      focusModeActive = focusStatus;
      dndActive = dndStatus;
      
      setupQuickActions();
    } catch (error) {
      console.error('Failed to load digest data:', error);
    } finally {
      loading = false;
    }
  }

  function setupQuickActions() {
    quickActions = [
      {
        id: 'focus',
        label: focusModeActive ? 'Exit Focus' : 'Enter Focus',
        icon: focusModeActive ? '🔕' : '🎯',
        action: toggleFocusMode,
        color: focusModeActive ? 'var(--danger)' : 'var(--brand-primary)'
      },
      {
        id: 'dnd',
        label: dndActive ? 'Disable DND' : 'Enable DND',
        icon: dndActive ? '🔔' : '🔕',
        action: toggleDND,
        color: dndActive ? 'var(--warning)' : 'var(--text-muted)'
      },
      {
        id: 'pomodoro',
        label: 'Start Pomodoro',
        icon: '🍅',
        action: startPomodoro,
        color: '#ff6b6b'
      },
      {
        id: 'compose',
        label: 'Quick Message',
        icon: '✏️',
        action: openQuickCompose,
        color: 'var(--success)'
      }
    ];
  }

  async function toggleFocusMode() {
    try {
      const newState = await invoke<boolean>('toggle_focus_mode');
      focusModeActive = newState;
      setupQuickActions();
    } catch (error) {
      console.error('Failed to toggle focus mode:', error);
    }
  }

  async function toggleDND() {
    try {
      await invoke('toggle_dnd');
      dndActive = !dndActive;
      setupQuickActions();
    } catch (error) {
      console.error('Failed to toggle DND:', error);
    }
  }

  async function startPomodoro() {
    try {
      await invoke('pomodoro_start');
      // Show success feedback
      events = [...events, {
        id: 'pomodoro-start',
        title: 'Pomodoro session started',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'reminder',
        priority: 'normal'
      }];
    } catch (error) {
      console.error('Failed to start pomodoro:', error);
    }
  }

  function openQuickCompose() {
    // Emit event to open quick compose
    window.dispatchEvent(new CustomEvent('open-quick-compose', { 
      detail: { source: 'daily-digest' } 
    }));
  }

  function getEventIcon(type: string): string {
    switch (type) {
      case 'meeting': return '📅';
      case 'reminder': return '⏰';
      case 'task': return '✓';
      case 'message': return '💬';
      default: return '📌';
    }
  }

  function getPriorityClass(priority: string): string {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'normal': return 'priority-normal';
      case 'low': return 'priority-low';
      default: return '';
    }
  }

  onMount(() => {
    updateGreeting();
    loadDigestData();
    
    // Update time every minute
    refreshInterval = setInterval(() => {
      currentTime = new Date();
      updateGreeting();
    }, 60000);

    // Listen for focus mode changes
    const unsubscribeFocus = listen('focus-mode-changed', (event: any) => {
      focusModeActive = event.payload?.active ?? false;
      setupQuickActions();
    });

    // Listen for pomodoro events
    const unsubscribePomodoro = listen('pomodoro:state-changed', () => {
      loadDigestData();
    });

    return () => {
      unsubscribeFocus.then(u => u());
      unsubscribePomodoro.then(u => u());
    };
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  $: if (isOpen) {
    loadDigestData();
  }
</script>

{#if isOpen}
  <div 
    class="daily-digest-overlay"
    on:click={onClose}
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="daily-digest"
      on:click|stopPropagation
      transition:slide={{ duration: 300, easing: quartOut }}
    >
      <!-- Header -->
      <div class="digest-header">
        <div class="greeting">
          <h2>{greeting}</h2>
          <span class="date">{currentTime.toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
        <button class="close-btn" on:click={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading your daily digest...</span>
        </div>
      {:else}
        <!-- Summary Cards -->
        <div class="summary-grid">
          <div class="summary-card messages">
            <div class="card-icon">💬</div>
            <div class="card-content">
              <span class="card-value">{summary.unreadMessages}</span>
              <span class="card-label">Unread Messages</span>
            </div>
          </div>
          
          <div class="summary-card focus">
            <div class="card-icon">🎯</div>
            <div class="card-content">
              <span class="card-value">{formatDuration(summary.focusTimeToday)}</span>
              <span class="card-label">Focus Time Today</span>
            </div>
          </div>
          
          <div class="summary-card events">
            <div class="card-icon">📅</div>
            <div class="card-content">
              <span class="card-value">{summary.upcomingEvents}</span>
              <span class="card-label">Upcoming Events</span>
            </div>
          </div>
          
          <div class="summary-card pomodoro">
            <div class="card-icon">🍅</div>
            <div class="card-content">
              <span class="card-value">{summary.pomodoroSessions}</span>
              <span class="card-label">Pomodoro Sessions</span>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <h3>Quick Actions</h3>
          <div class="actions-grid">
            {#each quickActions as action}
              <button 
                class="action-btn"
                on:click={action.action}
                style="--action-color: {action.color}"
              >
                <span class="action-icon">{action.icon}</span>
                <span class="action-label">{action.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Events List -->
        {#if events.length > 0}
          <div class="events-section">
            <h3>Today's Schedule</h3>
            <div class="events-list">
              {#each events as event (event.id)}
                <div class="event-item {getPriorityClass(event.priority)}">
                  <span class="event-icon">{getEventIcon(event.type)}</span>
                  <div class="event-details">
                    <span class="event-title">{event.title}</span>
                    <span class="event-time">{event.time}</span>
                  </div>
                  {#if event.priority === 'high'}
                    <span class="priority-badge">High</span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Status Bar -->
        <div class="status-bar">
          {#if focusModeActive}
            <span class="status-badge focus-active">
              🎯 Focus mode active
            </span>
          {/if}
          {#if dndActive}
            <span class="status-badge dnd-active">
              🔕 Do Not Disturb
            </span>
          {/if}
          {#if !focusModeActive && !dndActive}
            <span class="status-badge all-clear">
              ✓ All notifications enabled
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .daily-digest-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .daily-digest {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid var(--border-color);
  }

  .digest-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .greeting h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .greeting .date {
    font-size: 14px;
    color: var(--text-muted);
    margin-top: 4px;
    display: block;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    gap: 16px;
    color: var(--text-muted);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--brand-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    padding: 20px 24px;
  }

  .summary-card {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .summary-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .card-icon {
    font-size: 24px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: 10px;
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .card-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .quick-actions {
    padding: 0 24px 20px;
  }

  .quick-actions h3,
  .events-section h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 12px;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .action-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--action-color, var(--border-color));
    transform: translateY(-1px);
  }

  .action-icon {
    font-size: 18px;
  }

  .action-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .events-section {
    padding: 0 24px 20px;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .event-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 10px;
    border-left: 3px solid transparent;
    transition: background 0.15s ease;
  }

  .event-item:hover {
    background: var(--bg-tertiary);
  }

  .event-item.priority-high {
    border-left-color: var(--danger);
    background: rgba(var(--danger-rgb), 0.1);
  }

  .event-icon {
    font-size: 16px;
  }

  .event-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .event-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .event-time {
    font-size: 12px;
    color: var(--text-muted);
  }

  .priority-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 4px 8px;
    background: var(--danger);
    color: white;
    border-radius: 4px;
  }

  .status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-secondary);
    border-radius: 0 0 16px 16px;
  }

  .status-badge {
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-badge.focus-active {
    background: rgba(var(--brand-primary-rgb), 0.15);
    color: var(--brand-primary);
  }

  .status-badge.dnd-active {
    background: rgba(var(--warning-rgb), 0.15);
    color: var(--warning);
  }

  .status-badge.all-clear {
    background: rgba(var(--success-rgb), 0.15);
    color: var(--success);
  }

  /* Scrollbar styling */
  .daily-digest::-webkit-scrollbar {
    width: 8px;
  }

  .daily-digest::-webkit-scrollbar-track {
    background: transparent;
  }

  .daily-digest::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  .daily-digest::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
</style>