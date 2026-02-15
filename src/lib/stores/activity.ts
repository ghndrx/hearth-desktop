/**
 * Activity detection and rich presence management
 * 
 * Polls system for running applications and idle status,
 * then updates the gateway presence accordingly.
 */

import { writable, get, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { gateway } from './gateway';
import { settings } from './settings';

// =============================================================================
// Types
// =============================================================================

export interface DetectedActivity {
  name: string;
  process_name: string;
  activity_type: number; // 0=Playing, 1=Streaming, 2=Listening, 3=Watching
  window_title?: string;
  started_at: number;
}

export interface IdleStatus {
  idle_seconds: number;
  is_idle: boolean;
  screen_locked: boolean;
}

export interface ActivityState {
  /** Currently detected activities (running apps) */
  activities: DetectedActivity[];
  /** Current idle status */
  idleStatus: IdleStatus;
  /** Whether activity detection is enabled */
  enabled: boolean;
  /** Whether the user has manually set idle (override) */
  manualIdle: boolean;
  /** Last update timestamp */
  lastUpdate: number;
  /** Polling is running */
  polling: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

/** How often to poll for activities (ms) */
const POLL_INTERVAL = 15_000; // 15 seconds

/** Idle threshold before auto-setting status to idle (seconds) */
const IDLE_THRESHOLD = 300; // 5 minutes

/** How long an activity must be running to show (ms) */
const MIN_ACTIVITY_DURATION = 10_000; // 10 seconds

// =============================================================================
// Store
// =============================================================================

function createActivityStore() {
  const state = writable<ActivityState>({
    activities: [],
    idleStatus: { idle_seconds: 0, is_idle: false, screen_locked: false },
    enabled: true,
    manualIdle: false,
    lastUpdate: 0,
    polling: false,
  });

  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let previousStatus: 'online' | 'idle' | null = null;

  /**
   * Get running activities from the system
   */
  async function detectActivities(): Promise<DetectedActivity[]> {
    try {
      const activities = await invoke<DetectedActivity[]>('get_running_activities');
      return activities;
    } catch (error) {
      console.warn('[Activity] Failed to detect activities:', error);
      return [];
    }
  }

  /**
   * Get system idle status
   */
  async function detectIdleStatus(): Promise<IdleStatus> {
    try {
      const status = await invoke<IdleStatus>('get_idle_status_with_threshold', {
        thresholdSeconds: IDLE_THRESHOLD,
      });
      return status;
    } catch (error) {
      console.warn('[Activity] Failed to detect idle status:', error);
      return { idle_seconds: 0, is_idle: false, screen_locked: false };
    }
  }

  /**
   * Poll for activities and idle status
   */
  async function poll() {
    const currentState = get(state);
    if (!currentState.enabled) return;

    const [activities, idleStatus] = await Promise.all([
      detectActivities(),
      detectIdleStatus(),
    ]);

    const now = Date.now();
    
    // Filter activities that have been running long enough
    const filteredActivities = activities.filter(
      a => (now - a.started_at) >= MIN_ACTIVITY_DURATION
    );

    state.update(s => ({
      ...s,
      activities: filteredActivities,
      idleStatus,
      lastUpdate: now,
    }));

    // Update gateway presence based on idle status
    updateGatewayPresence(filteredActivities, idleStatus);
  }

  /**
   * Update gateway presence based on detected state
   */
  function updateGatewayPresence(activities: DetectedActivity[], idleStatus: IdleStatus) {
    const currentState = get(state);
    
    // Skip if manually idle (user set their status)
    if (currentState.manualIdle) return;

    // Determine status
    const shouldBeIdle = idleStatus.is_idle || idleStatus.screen_locked;
    const newStatus = shouldBeIdle ? 'idle' : 'online';

    // Only send update if status changed
    if (previousStatus !== newStatus) {
      previousStatus = newStatus;
      gateway.updatePresence(newStatus, shouldBeIdle);
    }

    // Send activity update if we have activities
    if (activities.length > 0) {
      sendActivityUpdate(activities);
    }
  }

  /**
   * Send activity information to gateway
   */
  function sendActivityUpdate(activities: DetectedActivity[]) {
    // Sort by priority: Games first, then by start time
    const sorted = [...activities].sort((a, b) => {
      // Prioritize games (type 0)
      if (a.activity_type === 0 && b.activity_type !== 0) return -1;
      if (b.activity_type === 0 && a.activity_type !== 0) return 1;
      // Then by start time (oldest first = running longest)
      return a.started_at - b.started_at;
    });

    const primary = sorted[0];
    if (!primary) return;

    // Format activity for gateway
    const gatewayActivity = {
      name: primary.name,
      type: primary.activity_type,
      details: primary.window_title || undefined,
      timestamps: {
        start: primary.started_at,
      },
    };

    // Send presence update with activity
    gateway.send({
      op: 3, // PRESENCE_UPDATE
      d: {
        status: 'online',
        afk: false,
        activities: [gatewayActivity],
      },
    });
  }

  /**
   * Start polling for activities
   */
  function startPolling() {
    const currentState = get(state);
    if (currentState.polling) return;

    state.update(s => ({ ...s, polling: true }));

    // Initial poll
    poll();

    // Set up interval
    pollInterval = setInterval(poll, POLL_INTERVAL);
    console.log('[Activity] Started polling');
  }

  /**
   * Stop polling for activities
   */
  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    state.update(s => ({ ...s, polling: false }));
    console.log('[Activity] Stopped polling');
  }

  /**
   * Enable activity detection
   */
  function enable() {
    state.update(s => ({ ...s, enabled: true }));
    startPolling();
  }

  /**
   * Disable activity detection
   */
  function disable() {
    state.update(s => ({ ...s, enabled: false }));
    stopPolling();
  }

  /**
   * Set manual idle override (user set their status to idle)
   */
  function setManualIdle(idle: boolean) {
    state.update(s => ({ ...s, manualIdle: idle }));
    if (idle) {
      previousStatus = 'idle';
    } else {
      previousStatus = null; // Reset so next poll will update
    }
  }

  /**
   * Get the primary (most important) activity
   */
  function getPrimaryActivity(): DetectedActivity | null {
    const currentState = get(state);
    const activities = currentState.activities;
    
    if (activities.length === 0) return null;

    // Prioritize games
    const game = activities.find(a => a.activity_type === 0);
    if (game) return game;

    // Then streaming
    const streaming = activities.find(a => a.activity_type === 1);
    if (streaming) return streaming;

    // Then music/listening
    const listening = activities.find(a => a.activity_type === 2);
    if (listening) return listening;

    // Then watching
    const watching = activities.find(a => a.activity_type === 3);
    if (watching) return watching;

    return activities[0];
  }

  /**
   * Force a poll immediately
   */
  function forcePoll() {
    return poll();
  }

  return {
    subscribe: state.subscribe,
    startPolling,
    stopPolling,
    enable,
    disable,
    setManualIdle,
    getPrimaryActivity,
    forcePoll,
    detectActivities,
    detectIdleStatus,
  };
}

export const activityStore = createActivityStore();

// =============================================================================
// Derived stores
// =============================================================================

/** Whether the user is currently idle */
export const isIdle = derived(activityStore, $a => $a.idleStatus.is_idle);

/** Whether the screen is locked */
export const isScreenLocked = derived(activityStore, $a => $a.idleStatus.screen_locked);

/** The primary/most important activity */
export const primaryActivity = derived(activityStore, $a => {
  const activities = $a.activities;
  if (activities.length === 0) return null;

  // Prioritize games
  const game = activities.find(a => a.activity_type === 0);
  if (game) return game;

  // Then streaming
  const streaming = activities.find(a => a.activity_type === 1);
  if (streaming) return streaming;

  // Then music/listening
  const listening = activities.find(a => a.activity_type === 2);
  if (listening) return listening;

  // Then watching
  const watching = activities.find(a => a.activity_type === 3);
  if (watching) return watching;

  return activities[0];
});

/** Number of seconds until considered idle */
export const idleIn = derived(activityStore, $a => {
  return Math.max(0, IDLE_THRESHOLD - $a.idleStatus.idle_seconds);
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get a human-readable activity type label
 */
export function getActivityTypeLabel(type: number): string {
  switch (type) {
    case 0: return 'Playing';
    case 1: return 'Streaming';
    case 2: return 'Listening to';
    case 3: return 'Watching';
    case 4: return ''; // Custom status
    case 5: return 'Competing in';
    default: return '';
  }
}

/**
 * Format activity duration
 */
export function formatActivityDuration(startedAt: number): string {
  const now = Date.now();
  const elapsed = now - startedAt;
  
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')} elapsed`;
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')} elapsed`;
  }
  
  return `${seconds}s elapsed`;
}
