<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived, get } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  
  interface DailyUsage {
    date: string;
    totalMinutes: number;
    sessions: SessionData[];
    peakHour: number;
    channels: Map<string, number>;
  }
  
  interface SessionData {
    start: number;
    end: number | null;
    activeMinutes: number;
  }
  
  interface WeeklyStats {
    averageDaily: number;
    totalWeek: number;
    trend: 'up' | 'down' | 'stable';
    mostActiveDay: string;
    mostActiveHour: number;
  }
  
  // Props
  export let userId: string = '';
  export let showWeeklyGoal: boolean = true;
  export let weeklyGoalMinutes: number = 1200; // 20 hours default
  export let onGoalReached: ((minutes: number) => void) | null = null;
  export let compact: boolean = false;
  
  // Stores
  const currentSession = writable<SessionData | null>(null);
  const todayUsage = writable<DailyUsage>({
    date: new Date().toISOString().split('T')[0],
    totalMinutes: 0,
    sessions: [],
    peakHour: 0,
    channels: new Map()
  });
  const weeklyHistory = writable<DailyUsage[]>([]);
  const isTracking = writable(true);
  const lastActiveTime = writable(Date.now());
  
  // Derived stores
  const weeklyStats = derived(weeklyHistory, ($history): WeeklyStats => {
    if ($history.length === 0) {
      return {
        averageDaily: 0,
        totalWeek: 0,
        trend: 'stable',
        mostActiveDay: '',
        mostActiveHour: 12
      };
    }
    
    const totalWeek = $history.reduce((sum, day) => sum + day.totalMinutes, 0);
    const averageDaily = Math.round(totalWeek / Math.max($history.length, 1));
    
    // Find most active day
    let mostActiveDay = '';
    let maxMinutes = 0;
    const hourCounts = new Array(24).fill(0);
    
    $history.forEach(day => {
      if (day.totalMinutes > maxMinutes) {
        maxMinutes = day.totalMinutes;
        mostActiveDay = day.date;
      }
      // Accumulate hour data
      if (day.peakHour >= 0 && day.peakHour < 24) {
        hourCounts[day.peakHour]++;
      }
    });
    
    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    
    // Calculate trend (compare first half to second half)
    const midpoint = Math.floor($history.length / 2);
    const firstHalf = $history.slice(0, midpoint).reduce((s, d) => s + d.totalMinutes, 0);
    const secondHalf = $history.slice(midpoint).reduce((s, d) => s + d.totalMinutes, 0);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondHalf > firstHalf * 1.1) trend = 'up';
    else if (secondHalf < firstHalf * 0.9) trend = 'down';
    
    return { averageDaily, totalWeek, trend, mostActiveDay, mostActiveHour };
  });
  
  const goalProgress = derived([weeklyHistory, todayUsage], ([$history, $today]) => {
    const weekTotal = $history.reduce((sum, day) => sum + day.totalMinutes, 0) + $today.totalMinutes;
    const percentage = Math.min(100, Math.round((weekTotal / weeklyGoalMinutes) * 100));
    return { weekTotal, percentage, remaining: Math.max(0, weeklyGoalMinutes - weekTotal) };
  });
  
  // Timer tracking
  let trackingInterval: ReturnType<typeof setInterval> | null = null;
  let idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  
  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  function formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  }
  
  function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }
  
  function startSession() {
    const now = Date.now();
    currentSession.set({
      start: now,
      end: null,
      activeMinutes: 0
    });
    lastActiveTime.set(now);
    isTracking.set(true);
    
    // Start tracking interval (updates every minute)
    trackingInterval = setInterval(() => {
      updateActiveTime();
    }, 60000);
    
    // Start idle check (every 30 seconds)
    idleCheckInterval = setInterval(() => {
      checkIdleState();
    }, 30000);
  }
  
  function endSession() {
    const session = get(currentSession);
    if (session) {
      session.end = Date.now();
      const duration = Math.round((session.end - session.start) / 60000);
      session.activeMinutes = duration;
      
      // Add to today's sessions
      todayUsage.update(usage => {
        usage.sessions.push({ ...session });
        usage.totalMinutes += session.activeMinutes;
        return usage;
      });
      
      currentSession.set(null);
    }
    
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
    
    saveUsageData();
  }
  
  function updateActiveTime() {
    if (!get(isTracking)) return;
    
    const now = Date.now();
    const currentHour = new Date().getHours();
    
    todayUsage.update(usage => {
      usage.totalMinutes += 1;
      
      // Update peak hour tracking
      const hourKey = currentHour.toString();
      // Simple peak tracking - just track most recent active hour
      usage.peakHour = currentHour;
      
      return usage;
    });
    
    lastActiveTime.set(now);
    
    // Check goal progress
    const progress = get(goalProgress);
    if (progress.percentage >= 100 && onGoalReached) {
      onGoalReached(progress.weekTotal);
    }
  }
  
  function checkIdleState() {
    const now = Date.now();
    const lastActive = get(lastActiveTime);
    
    if (now - lastActive > IDLE_THRESHOLD_MS) {
      isTracking.set(false);
    }
  }
  
  function recordActivity() {
    lastActiveTime.set(Date.now());
    if (!get(isTracking)) {
      isTracking.set(true);
    }
  }
  
  async function loadUsageData() {
    try {
      const data = await invoke<string>('plugin:store|get', { 
        key: `screen_time_${userId}` 
      });
      
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.weeklyHistory) {
          // Filter to last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const cutoff = sevenDaysAgo.toISOString().split('T')[0];
          
          weeklyHistory.set(
            parsed.weeklyHistory.filter((d: DailyUsage) => d.date >= cutoff)
          );
        }
        
        // Check if today's data exists
        const today = getTodayKey();
        const todayData = parsed.weeklyHistory?.find((d: DailyUsage) => d.date === today);
        if (todayData) {
          todayUsage.set(todayData);
        }
      }
    } catch (err) {
      console.warn('Screen time data not available:', err);
    }
  }
  
  async function saveUsageData() {
    try {
      const today = getTodayKey();
      const currentToday = get(todayUsage);
      currentToday.date = today;
      
      // Update weekly history
      weeklyHistory.update(history => {
        const existingIndex = history.findIndex(d => d.date === today);
        if (existingIndex >= 0) {
          history[existingIndex] = currentToday;
        } else {
          history.push(currentToday);
        }
        
        // Keep only last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoff = sevenDaysAgo.toISOString().split('T')[0];
        
        return history.filter(d => d.date >= cutoff);
      });
      
      await invoke('plugin:store|set', {
        key: `screen_time_${userId}`,
        value: JSON.stringify({
          weeklyHistory: get(weeklyHistory),
          lastUpdated: Date.now()
        })
      });
    } catch (err) {
      console.warn('Could not save screen time data:', err);
    }
  }
  
  function resetWeeklyData() {
    weeklyHistory.set([]);
    todayUsage.set({
      date: getTodayKey(),
      totalMinutes: 0,
      sessions: [],
      peakHour: 0,
      channels: new Map()
    });
    saveUsageData();
  }
  
  // Activity listeners
  function setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, recordActivity, { passive: true });
    });
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, recordActivity);
      });
    };
  }
  
  // Lifecycle
  onMount(async () => {
    await loadUsageData();
    startSession();
    
    const cleanup = setupActivityListeners();
    
    // Handle visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        endSession();
      } else {
        startSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    // Save periodically
    const saveInterval = setInterval(saveUsageData, 5 * 60 * 1000);
    
    return () => {
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(saveInterval);
    };
  });
  
  onDestroy(() => {
    endSession();
  });
  
  // Reactive: day change detection
  $: {
    const currentDay = getTodayKey();
    const storedDay = $todayUsage.date;
    if (currentDay !== storedDay) {
      // New day - archive current and start fresh
      saveUsageData();
      todayUsage.set({
        date: currentDay,
        totalMinutes: 0,
        sessions: [],
        peakHour: 0,
        channels: new Map()
      });
    }
  }
</script>

<div class="screen-time-tracker" class:compact>
  {#if compact}
    <!-- Compact view for status bar -->
    <div class="compact-display">
      <span class="time-icon">⏱️</span>
      <span class="today-time">{formatDuration($todayUsage.totalMinutes)}</span>
      {#if !$isTracking}
        <span class="idle-badge">idle</span>
      {/if}
    </div>
  {:else}
    <!-- Full view -->
    <div class="tracker-header">
      <h3>Screen Time</h3>
      <div class="tracking-status" class:active={$isTracking}>
        {$isTracking ? '● Recording' : '○ Paused'}
      </div>
    </div>
    
    <div class="today-summary">
      <div class="big-number">
        <span class="value">{formatDuration($todayUsage.totalMinutes)}</span>
        <span class="label">Today</span>
      </div>
      
      <div class="session-info">
        <div class="stat">
          <span class="stat-value">{$todayUsage.sessions.length + ($currentSession ? 1 : 0)}</span>
          <span class="stat-label">Sessions</span>
        </div>
        <div class="stat">
          <span class="stat-value">{formatHour($todayUsage.peakHour)}</span>
          <span class="stat-label">Peak Hour</span>
        </div>
      </div>
    </div>
    
    {#if showWeeklyGoal}
      <div class="weekly-goal">
        <div class="goal-header">
          <span>Weekly Goal</span>
          <span class="goal-text">{formatDuration($goalProgress.weekTotal)} / {formatDuration(weeklyGoalMinutes)}</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            class:complete={$goalProgress.percentage >= 100}
            style="width: {$goalProgress.percentage}%"
          ></div>
        </div>
        <div class="goal-remaining">
          {#if $goalProgress.remaining > 0}
            {formatDuration($goalProgress.remaining)} remaining
          {:else}
            ✓ Goal reached!
          {/if}
        </div>
      </div>
    {/if}
    
    <div class="weekly-stats">
      <h4>This Week</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="card-value">{formatDuration($weeklyStats.averageDaily)}</span>
          <span class="card-label">Daily Average</span>
        </div>
        <div class="stat-card">
          <span class="card-value">{formatDuration($weeklyStats.totalWeek)}</span>
          <span class="card-label">Total</span>
        </div>
        <div class="stat-card">
          <span class="card-value trend-{$weeklyStats.trend}">
            {$weeklyStats.trend === 'up' ? '↑' : $weeklyStats.trend === 'down' ? '↓' : '→'}
          </span>
          <span class="card-label">Trend</span>
        </div>
        <div class="stat-card">
          <span class="card-value">{formatHour($weeklyStats.mostActiveHour)}</span>
          <span class="card-label">Peak Hour</span>
        </div>
      </div>
    </div>
    
    {#if $weeklyHistory.length > 0}
      <div class="daily-chart">
        <h4>Daily Usage</h4>
        <div class="chart-bars">
          {#each $weeklyHistory as day}
            {@const maxMinutes = Math.max(...$weeklyHistory.map(d => d.totalMinutes), $todayUsage.totalMinutes, 60)}
            {@const height = Math.max(5, (day.totalMinutes / maxMinutes) * 100)}
            <div class="bar-container">
              <div 
                class="bar" 
                style="height: {height}%"
                title="{day.date}: {formatDuration(day.totalMinutes)}"
              ></div>
              <span class="bar-label">{new Date(day.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0)}</span>
            </div>
          {/each}
          <!-- Today -->
          {@const maxMinutes = Math.max(...$weeklyHistory.map(d => d.totalMinutes), $todayUsage.totalMinutes, 60)}
          {@const todayHeight = Math.max(5, ($todayUsage.totalMinutes / maxMinutes) * 100)}
          <div class="bar-container today">
            <div 
              class="bar" 
              style="height: {todayHeight}%"
              title="Today: {formatDuration($todayUsage.totalMinutes)}"
            ></div>
            <span class="bar-label">T</span>
          </div>
        </div>
      </div>
    {/if}
    
    <div class="tracker-actions">
      <button class="reset-btn" on:click={resetWeeklyData}>
        Reset Data
      </button>
    </div>
  {/if}
</div>

<style>
  .screen-time-tracker {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 16px;
    color: var(--text-primary, #dcddde);
  }
  
  .screen-time-tracker.compact {
    padding: 4px 8px;
    background: transparent;
    border-radius: 4px;
  }
  
  .compact-display {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  
  .time-icon {
    font-size: 14px;
  }
  
  .today-time {
    font-weight: 500;
  }
  
  .idle-badge {
    background: var(--bg-tertiary, #202225);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
    color: var(--text-muted, #72767d);
  }
  
  .tracker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .tracker-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .tracking-status {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }
  
  .tracking-status.active {
    color: var(--status-green, #3ba55c);
  }
  
  .today-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
  }
  
  .big-number {
    display: flex;
    flex-direction: column;
  }
  
  .big-number .value {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-normal, #fff);
  }
  
  .big-number .label {
    font-size: 12px;
    color: var(--text-muted, #72767d);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .session-info {
    display: flex;
    gap: 24px;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 18px;
    font-weight: 600;
  }
  
  .stat-label {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }
  
  .weekly-goal {
    margin-bottom: 20px;
  }
  
  .goal-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
  }
  
  .goal-text {
    color: var(--text-muted, #72767d);
  }
  
  .progress-bar {
    height: 8px;
    background: var(--bg-tertiary, #202225);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: var(--brand-primary, #5865f2);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  
  .progress-fill.complete {
    background: var(--status-green, #3ba55c);
  }
  
  .goal-remaining {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-muted, #72767d);
    text-align: right;
  }
  
  .weekly-stats h4,
  .daily-chart h4 {
    margin: 0 0 12px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted, #72767d);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 20px;
  }
  
  .stat-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
  }
  
  .card-value {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .card-label {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    text-align: center;
  }
  
  .trend-up {
    color: var(--status-red, #ed4245);
  }
  
  .trend-down {
    color: var(--status-green, #3ba55c);
  }
  
  .trend-stable {
    color: var(--text-muted, #72767d);
  }
  
  .daily-chart {
    margin-bottom: 16px;
  }
  
  .chart-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    height: 80px;
    padding: 8px 0;
    gap: 4px;
  }
  
  .bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }
  
  .bar {
    width: 100%;
    max-width: 24px;
    background: var(--brand-primary, #5865f2);
    border-radius: 3px 3px 0 0;
    transition: height 0.3s ease;
    margin-top: auto;
  }
  
  .bar-container.today .bar {
    background: var(--status-green, #3ba55c);
  }
  
  .bar-label {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    margin-top: 4px;
  }
  
  .tracker-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px solid var(--bg-tertiary, #202225);
  }
  
  .reset-btn {
    background: transparent;
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    color: var(--text-muted, #72767d);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .reset-btn:hover {
    background: var(--bg-modifier-hover, #32353b);
    color: var(--text-normal, #dcddde);
  }
</style>
