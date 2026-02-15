<script lang="ts">
  import { 
    primaryActivity, 
    getActivityTypeLabel, 
    formatActivityDuration,
    type DetectedActivity 
  } from '$lib/stores/activity';
  import type { Activity } from '$lib/stores/presence';

  /** Activity from local detection (for current user) */
  export let localActivity: DetectedActivity | null = null;
  
  /** Activity from presence system (for other users) */
  export let remoteActivity: Activity | null = null;
  
  /** Whether to show elapsed time */
  export let showTime = true;
  
  /** Compact mode (single line) */
  export let compact = false;

  // Normalize to common format
  $: activity = localActivity || (remoteActivity ? {
    name: remoteActivity.name,
    activity_type: remoteActivity.type,
    window_title: remoteActivity.details || remoteActivity.state,
    started_at: remoteActivity.timestamps?.start || Date.now(),
    process_name: '',
  } as DetectedActivity : null);

  $: typeLabel = activity ? getActivityTypeLabel(activity.activity_type) : '';
  $: elapsedTime = activity && showTime ? formatActivityDuration(activity.started_at) : '';

  // Activity type icons
  function getActivityIcon(type: number): string {
    switch (type) {
      case 0: return '🎮'; // Playing
      case 1: return '📺'; // Streaming
      case 2: return '🎵'; // Listening
      case 3: return '📽️'; // Watching
      case 5: return '🏆'; // Competing
      default: return '✨';
    }
  }
</script>

{#if activity}
  <div class="user-activity" class:compact>
    <span class="activity-icon">{getActivityIcon(activity.activity_type)}</span>
    
    <div class="activity-content">
      {#if compact}
        <span class="activity-line">
          <span class="activity-type">{typeLabel}</span>
          <strong class="activity-name">{activity.name}</strong>
        </span>
      {:else}
        <div class="activity-type">{typeLabel}</div>
        <div class="activity-name">{activity.name}</div>
        
        {#if activity.window_title}
          <div class="activity-details">{activity.window_title}</div>
        {/if}
        
        {#if showTime && elapsedTime}
          <div class="activity-time">{elapsedTime}</div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .user-activity {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    font-size: 12px;
  }

  .user-activity.compact {
    padding: 4px 8px;
    align-items: center;
    background: transparent;
  }

  .activity-icon {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
  }

  .compact .activity-icon {
    font-size: 12px;
  }

  .activity-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .compact .activity-content {
    flex-direction: row;
    align-items: center;
    gap: 0;
  }

  .activity-type {
    color: #b5bac1;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .compact .activity-type {
    text-transform: none;
    font-size: 12px;
  }

  .compact .activity-type::after {
    content: ' ';
  }

  .activity-name {
    color: #f2f3f5;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .compact .activity-name {
    font-weight: 500;
  }

  .activity-details {
    color: #b5bac1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .activity-time {
    color: #949ba4;
    font-size: 11px;
  }

  .activity-line {
    display: flex;
    align-items: center;
    gap: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
