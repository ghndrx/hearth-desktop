<!--
  UsageInsightsPanel - Personal usage analytics dashboard

  Features:
  - Today's stats (messages, voice, reactions)
  - 7-day activity sparkline chart
  - Hourly activity heatmap
  - Lifetime summary with streaks
  - All data stays on-device via Tauri backend
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    usageInsights,
    todayStats,
    weeklySummary,
    lifetimeSummary,
    isInsightsLoading,
  } from '$lib/stores/usageInsights';
  import type { DailyStats, HourlyActivity } from '$lib/stores/usageInsights';

  export let onClose: (() => void) | undefined = undefined;

  let activeTab: 'today' | 'week' | 'lifetime' = 'today';
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    usageInsights.loadAll();
    refreshInterval = setInterval(() => usageInsights.fetchToday(), 30000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  function getBarHeight(value: number, max: number): number {
    if (max === 0) return 4;
    return Math.max(4, (value / max) * 100);
  }

  function getHeatmapColor(count: number, max: number): string {
    if (max === 0 || count === 0) return 'var(--bg-tertiary, #313244)';
    const intensity = count / max;
    if (intensity > 0.75) return '#a6e3a1';
    if (intensity > 0.5) return '#94e2d5';
    if (intensity > 0.25) return '#89b4fa';
    return '#45475a';
  }

  function formatHour(hour: number): string {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  }

  function getDayLabel(dateStr: string): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const d = new Date(dateStr + 'T00:00:00');
    return days[d.getDay()];
  }

  $: weeklyMax = $weeklySummary?.daily_breakdown
    ? Math.max(...$weeklySummary.daily_breakdown.map(d => d.messages_sent + d.messages_received), 1)
    : 1;

  $: hourlyMax = $lifetimeSummary?.hourly_activity
    ? Math.max(...$lifetimeSummary.hourly_activity.map(h => h.count), 1)
    : 1;
</script>

<div class="insights-panel" role="region" aria-label="Usage Insights">
  <div class="panel-header">
    <h3>Usage Insights</h3>
    <div class="header-actions">
      <button
        class="icon-btn"
        on:click={() => usageInsights.refresh()}
        aria-label="Refresh"
        disabled={$isInsightsLoading}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class:spinning={$isInsightsLoading}>
          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
      </button>
      {#if onClose}
        <button class="icon-btn" on:click={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="tab-bar" role="tablist">
    <button
      class="tab" class:active={activeTab === 'today'}
      on:click={() => activeTab = 'today'}
      role="tab" aria-selected={activeTab === 'today'}
    >Today</button>
    <button
      class="tab" class:active={activeTab === 'week'}
      on:click={() => activeTab = 'week'}
      role="tab" aria-selected={activeTab === 'week'}
    >This Week</button>
    <button
      class="tab" class:active={activeTab === 'lifetime'}
      on:click={() => activeTab = 'lifetime'}
      role="tab" aria-selected={activeTab === 'lifetime'}
    >All Time</button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'today'}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon sent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{$todayStats?.messages_sent ?? 0}</span>
            <span class="stat-label">Sent</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon received">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{$todayStats?.messages_received ?? 0}</span>
            <span class="stat-label">Received</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon reactions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{$todayStats?.reactions_sent ?? 0}</span>
            <span class="stat-label">Reactions</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon voice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{($todayStats?.voice_minutes ?? 0).toFixed(0)}</span>
            <span class="stat-label">Voice min</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>Active Time</h4>
        <div class="active-time-display">
          <span class="active-time-value">
            {#if ($todayStats?.active_minutes ?? 0) >= 60}
              {Math.floor(($todayStats?.active_minutes ?? 0) / 60)}h {($todayStats?.active_minutes ?? 0) % 60}m
            {:else}
              {$todayStats?.active_minutes ?? 0}m
            {/if}
          </span>
        </div>
      </div>

    {:else if activeTab === 'week'}
      {#if $weeklySummary}
        <div class="week-summary">
          <div class="week-stat">
            <span class="week-stat-value">{$weeklySummary.total_messages}</span>
            <span class="week-stat-label">messages</span>
          </div>
          <div class="week-stat">
            <span class="week-stat-value">{$weeklySummary.total_voice_minutes.toFixed(0)}</span>
            <span class="week-stat-label">voice min</span>
          </div>
          <div class="week-stat">
            <span class="week-stat-value">{$weeklySummary.total_active_minutes}</span>
            <span class="week-stat-label">active min</span>
          </div>
        </div>

        <div class="section">
          <h4>Daily Activity</h4>
          <div class="bar-chart" role="img" aria-label="Daily message activity chart">
            {#each $weeklySummary.daily_breakdown as day}
              <div class="bar-col">
                <div class="bar-wrapper">
                  <div
                    class="bar received-bar"
                    style="height: {getBarHeight(day.messages_received, weeklyMax)}%"
                    title="{day.messages_received} received"
                  ></div>
                  <div
                    class="bar sent-bar"
                    style="height: {getBarHeight(day.messages_sent, weeklyMax)}%"
                    title="{day.messages_sent} sent"
                  ></div>
                </div>
                <span class="bar-label">{getDayLabel(day.date)}</span>
              </div>
            {/each}
          </div>
          <div class="chart-legend">
            <span class="legend-item"><span class="legend-dot sent"></span> Sent</span>
            <span class="legend-item"><span class="legend-dot received"></span> Received</span>
          </div>
        </div>
      {:else}
        <div class="empty-state">No weekly data yet</div>
      {/if}

    {:else if activeTab === 'lifetime'}
      {#if $lifetimeSummary}
        <div class="lifetime-stats">
          <div class="lifetime-row">
            <span class="lifetime-label">Messages sent</span>
            <span class="lifetime-value">{$lifetimeSummary.total_messages_sent.toLocaleString()}</span>
          </div>
          <div class="lifetime-row">
            <span class="lifetime-label">Messages received</span>
            <span class="lifetime-value">{$lifetimeSummary.total_messages_received.toLocaleString()}</span>
          </div>
          <div class="lifetime-row">
            <span class="lifetime-label">Reactions</span>
            <span class="lifetime-value">{$lifetimeSummary.total_reactions.toLocaleString()}</span>
          </div>
          <div class="lifetime-row">
            <span class="lifetime-label">Voice time</span>
            <span class="lifetime-value">{$lifetimeSummary.total_voice_minutes.toFixed(0)} min</span>
          </div>
          <div class="lifetime-row">
            <span class="lifetime-label">Active time</span>
            <span class="lifetime-value">{$lifetimeSummary.total_active_hours.toFixed(1)} hrs</span>
          </div>
          {#if $lifetimeSummary.current_streak_days > 0}
            <div class="lifetime-row streak">
              <span class="lifetime-label">Current streak</span>
              <span class="lifetime-value">{$lifetimeSummary.current_streak_days} days</span>
            </div>
          {/if}
          <div class="lifetime-row">
            <span class="lifetime-label">Peak hours</span>
            <span class="lifetime-value">{$lifetimeSummary.favorite_time}</span>
          </div>
        </div>

        <div class="section">
          <h4>Hourly Activity</h4>
          <div class="heatmap" role="img" aria-label="Hourly activity heatmap">
            {#each $lifetimeSummary.hourly_activity as slot}
              <div
                class="heatmap-cell"
                style="background: {getHeatmapColor(slot.count, hourlyMax)}"
                title="{formatHour(slot.hour)}: {slot.count} events"
              ></div>
            {/each}
          </div>
          <div class="heatmap-labels">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
          </div>
        </div>
      {:else}
        <div class="empty-state">No lifetime data yet</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .insights-panel {
    background: var(--bg-secondary, #1e1e2e);
    border-radius: 16px;
    padding: 16px;
    width: 320px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-family: system-ui, -apple-system, sans-serif;
    color: var(--text-primary, #cdd6f4);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #a6adc8);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-hover, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Tabs */
  .tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }

  .tab {
    flex: 1;
    padding: 8px 4px;
    background: var(--bg-tertiary, #313244);
    border: none;
    border-radius: 8px;
    color: var(--text-secondary, #a6adc8);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab:hover {
    background: var(--bg-hover, #45475a);
  }

  .tab.active {
    background: var(--accent, #89b4fa);
    color: var(--bg-primary, #1e1e2e);
  }

  /* Today stats grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-tertiary, #313244);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-icon.sent { background: rgba(166, 227, 161, 0.15); color: #a6e3a1; }
  .stat-icon.received { background: rgba(137, 180, 250, 0.15); color: #89b4fa; }
  .stat-icon.reactions { background: rgba(249, 226, 175, 0.15); color: #f9e2af; }
  .stat-icon.voice { background: rgba(203, 166, 247, 0.15); color: #cba6f7; }

  .stat-info {
    display: flex;
    flex-direction: column;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  /* Active time */
  .active-time-display {
    text-align: center;
    padding: 12px;
    background: var(--bg-tertiary, #313244);
    border-radius: 10px;
  }

  .active-time-value {
    font-size: 24px;
    font-weight: 700;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  /* Section */
  .section {
    margin-top: 12px;
  }

  .section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #a6adc8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Week summary */
  .week-summary {
    display: flex;
    justify-content: space-around;
    margin-bottom: 12px;
    padding: 12px;
    background: var(--bg-tertiary, #313244);
    border-radius: 10px;
  }

  .week-stat {
    text-align: center;
  }

  .week-stat-value {
    display: block;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
  }

  .week-stat-label {
    font-size: 11px;
    color: var(--text-secondary, #a6adc8);
  }

  /* Bar chart */
  .bar-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 100px;
    gap: 4px;
    padding: 8px 0;
  }

  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .bar-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 2px;
  }

  .bar {
    width: 80%;
    border-radius: 3px 3px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }

  .sent-bar { background: #a6e3a1; }
  .received-bar { background: #89b4fa; }

  .bar-label {
    font-size: 10px;
    color: var(--text-secondary, #a6adc8);
    margin-top: 4px;
  }

  .chart-legend {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 4px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: var(--text-secondary, #a6adc8);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-dot.sent { background: #a6e3a1; }
  .legend-dot.received { background: #89b4fa; }

  /* Lifetime stats */
  .lifetime-stats {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 12px;
  }

  .lifetime-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-tertiary, #313244);
    font-size: 13px;
  }

  .lifetime-row:first-child { border-radius: 10px 10px 0 0; }
  .lifetime-row:last-child { border-radius: 0 0 10px 10px; }

  .lifetime-row.streak {
    background: rgba(249, 226, 175, 0.1);
  }

  .lifetime-label {
    color: var(--text-secondary, #a6adc8);
  }

  .lifetime-value {
    font-weight: 600;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
  }

  /* Heatmap */
  .heatmap {
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    gap: 2px;
  }

  .heatmap-cell {
    aspect-ratio: 1;
    border-radius: 3px;
    transition: background 0.2s;
  }

  .heatmap-cell:hover {
    outline: 1px solid var(--text-secondary, #a6adc8);
  }

  .heatmap-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 4px;
    font-size: 9px;
    color: var(--text-secondary, #a6adc8);
    padding: 0 2px;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-secondary, #a6adc8);
    font-size: 13px;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinning { animation: none; }
    .bar { transition: none; }
    .heatmap-cell { transition: none; }
  }
</style>
