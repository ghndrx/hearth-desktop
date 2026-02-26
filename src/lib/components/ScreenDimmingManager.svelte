<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived, type Writable, type Readable } from 'svelte/store';

  // Types
  interface DimmingSchedule {
    enabled: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    transitionMinutes: number;
  }

  interface DimmingSettings {
    enabled: boolean;
    intensity: number; // 0-100, percentage of dimming
    schedule: DimmingSchedule;
    warmthEnabled: boolean;
    warmth: number; // 0-100, color temperature shift
    excludeFullscreen: boolean;
    pauseOnActivity: boolean;
    activityTimeoutMs: number;
  }

  interface DimmingState {
    active: boolean;
    currentIntensity: number;
    currentWarmth: number;
    scheduledActive: boolean;
    pausedByActivity: boolean;
    pausedByFullscreen: boolean;
  }

  // Props
  export let initialSettings: Partial<DimmingSettings> = {};
  export let onSettingsChange: ((settings: DimmingSettings) => void) | undefined = undefined;
  export let onStateChange: ((state: DimmingState) => void) | undefined = undefined;

  // Default settings
  const defaultSettings: DimmingSettings = {
    enabled: true,
    intensity: 30,
    schedule: {
      enabled: true,
      startHour: 20,
      startMinute: 0,
      endHour: 7,
      endMinute: 0,
      transitionMinutes: 30,
    },
    warmthEnabled: true,
    warmth: 40,
    excludeFullscreen: true,
    pauseOnActivity: false,
    activityTimeoutMs: 60000,
  };

  // Stores
  const settings: Writable<DimmingSettings> = writable({
    ...defaultSettings,
    ...initialSettings,
  });

  const state: Writable<DimmingState> = writable({
    active: false,
    currentIntensity: 0,
    currentWarmth: 0,
    scheduledActive: false,
    pausedByActivity: false,
    pausedByFullscreen: false,
  });

  // Derived stores
  const effectiveIntensity: Readable<number> = derived(
    [settings, state],
    ([$settings, $state]) => {
      if (!$settings.enabled || !$state.active) return 0;
      if ($state.pausedByActivity || $state.pausedByFullscreen) return 0;
      return $state.currentIntensity;
    }
  );

  const effectiveWarmth: Readable<number> = derived(
    [settings, state],
    ([$settings, $state]) => {
      if (!$settings.enabled || !$settings.warmthEnabled || !$state.active) return 0;
      if ($state.pausedByActivity || $state.pausedByFullscreen) return 0;
      return $state.currentWarmth;
    }
  );

  // Local state
  let overlayElement: HTMLDivElement | null = null;
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  let activityTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastActivityTime = Date.now();

  // Helper functions
  function timeToMinutes(hour: number, minute: number): number {
    return hour * 60 + minute;
  }

  function getCurrentTimeMinutes(): number {
    const now = new Date();
    return timeToMinutes(now.getHours(), now.getMinutes());
  }

  function isWithinSchedule(schedule: DimmingSchedule): boolean {
    if (!schedule.enabled) return true;

    const current = getCurrentTimeMinutes();
    const start = timeToMinutes(schedule.startHour, schedule.startMinute);
    const end = timeToMinutes(schedule.endHour, schedule.endMinute);

    // Handle overnight schedules (e.g., 20:00 to 07:00)
    if (start > end) {
      return current >= start || current <= end;
    }
    return current >= start && current <= end;
  }

  function calculateTransitionProgress(schedule: DimmingSchedule): number {
    if (!schedule.enabled || schedule.transitionMinutes === 0) {
      return isWithinSchedule(schedule) ? 1 : 0;
    }

    const current = getCurrentTimeMinutes();
    const start = timeToMinutes(schedule.startHour, schedule.startMinute);
    const end = timeToMinutes(schedule.endHour, schedule.endMinute);
    const transition = schedule.transitionMinutes;

    // Calculate fade-in at start
    let fadeInStart = start;
    let fadeInEnd = start + transition;
    
    // Handle day boundary
    if (fadeInEnd >= 1440) fadeInEnd -= 1440;

    // Calculate fade-out at end
    let fadeOutStart = end - transition;
    let fadeOutEnd = end;
    
    if (fadeOutStart < 0) fadeOutStart += 1440;

    // Check if we're in fade-in period
    if (start <= fadeInEnd) {
      // Normal case
      if (current >= start && current <= fadeInEnd) {
        return (current - start) / transition;
      }
    } else {
      // Crossing midnight
      if (current >= start || current <= fadeInEnd) {
        const elapsed = current >= start ? current - start : current + (1440 - start);
        return Math.min(1, elapsed / transition);
      }
    }

    // Check if we're in fade-out period
    if (fadeOutStart <= end) {
      // Normal case
      if (current >= fadeOutStart && current <= end) {
        return 1 - (current - fadeOutStart) / transition;
      }
    } else {
      // Crossing midnight
      if (current >= fadeOutStart || current <= end) {
        const elapsed = current >= fadeOutStart ? current - fadeOutStart : current + (1440 - fadeOutStart);
        return Math.max(0, 1 - elapsed / transition);
      }
    }

    // In the middle of the schedule
    if (isWithinSchedule(schedule)) {
      return 1;
    }

    return 0;
  }

  function updateDimmingState(): void {
    settings.update(s => {
      const schedule = s.schedule;
      const withinSchedule = isWithinSchedule(schedule);
      const progress = calculateTransitionProgress(schedule);

      state.update(st => ({
        ...st,
        scheduledActive: withinSchedule,
        active: s.enabled && (withinSchedule || progress > 0),
        currentIntensity: s.intensity * progress,
        currentWarmth: s.warmth * progress,
      }));

      return s;
    });
  }

  function applyOverlay(intensity: number, warmth: number): void {
    if (!overlayElement) return;

    if (intensity === 0 && warmth === 0) {
      overlayElement.style.display = 'none';
      return;
    }

    overlayElement.style.display = 'block';
    
    // Calculate overlay color
    // Dimming: dark gray overlay
    // Warmth: orange-red tint
    const dimAlpha = intensity / 100 * 0.7; // Max 70% opacity for dimming
    const warmAlpha = warmth / 100 * 0.15; // Max 15% opacity for warmth
    
    // Combine effects
    const r = Math.round(warmth * 2.55); // 0-255 based on warmth
    const g = Math.round(warmth * 1.2); // Less green for warm tint
    const b = 0;
    
    overlayElement.style.background = `
      linear-gradient(
        rgba(${r}, ${g}, ${b}, ${warmAlpha}),
        rgba(${r}, ${g}, ${b}, ${warmAlpha})
      ),
      rgba(0, 0, 0, ${dimAlpha})
    `;
  }

  function handleActivity(): void {
    lastActivityTime = Date.now();
    
    settings.update(s => {
      if (!s.pauseOnActivity) return s;

      state.update(st => ({ ...st, pausedByActivity: true }));

      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }

      activityTimeout = setTimeout(() => {
        state.update(st => ({ ...st, pausedByActivity: false }));
      }, s.activityTimeoutMs);

      return s;
    });
  }

  function checkFullscreen(): void {
    settings.update(s => {
      if (!s.excludeFullscreen) return s;

      const isFullscreen = !!document.fullscreenElement;
      state.update(st => ({ ...st, pausedByFullscreen: isFullscreen }));

      return s;
    });
  }

  // Public API
  export function enable(): void {
    settings.update(s => ({ ...s, enabled: true }));
  }

  export function disable(): void {
    settings.update(s => ({ ...s, enabled: false }));
  }

  export function toggle(): void {
    settings.update(s => ({ ...s, enabled: !s.enabled }));
  }

  export function setIntensity(value: number): void {
    settings.update(s => ({ 
      ...s, 
      intensity: Math.max(0, Math.min(100, value)) 
    }));
  }

  export function setWarmth(value: number): void {
    settings.update(s => ({ 
      ...s, 
      warmth: Math.max(0, Math.min(100, value)) 
    }));
  }

  export function setSchedule(schedule: Partial<DimmingSchedule>): void {
    settings.update(s => ({
      ...s,
      schedule: { ...s.schedule, ...schedule },
    }));
  }

  export function temporaryDisable(durationMs: number): void {
    disable();
    setTimeout(() => enable(), durationMs);
  }

  export function getSettings(): DimmingSettings {
    let currentSettings: DimmingSettings = defaultSettings;
    settings.subscribe(s => { currentSettings = s; })();
    return currentSettings;
  }

  export function getState(): DimmingState {
    let currentState: DimmingState = {
      active: false,
      currentIntensity: 0,
      currentWarmth: 0,
      scheduledActive: false,
      pausedByActivity: false,
      pausedByFullscreen: false,
    };
    state.subscribe(s => { currentState = s; })();
    return currentState;
  }

  // Lifecycle
  onMount(() => {
    // Create overlay element
    overlayElement = document.createElement('div');
    overlayElement.id = 'screen-dimming-overlay';
    overlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 999999;
      display: none;
      transition: background 1s ease;
    `;
    document.body.appendChild(overlayElement);

    // Set up update interval
    updateInterval = setInterval(updateDimmingState, 60000); // Update every minute
    updateDimmingState(); // Initial update

    // Set up event listeners
    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('fullscreenchange', checkFullscreen);

    // Subscribe to stores for callbacks
    const unsubSettings = settings.subscribe(s => {
      onSettingsChange?.(s);
    });

    const unsubState = state.subscribe(s => {
      onStateChange?.(s);
    });

    const unsubEffective = derived(
      [effectiveIntensity, effectiveWarmth],
      ([$intensity, $warmth]) => ({ intensity: $intensity, warmth: $warmth })
    ).subscribe(({ intensity, warmth }) => {
      applyOverlay(intensity, warmth);
    });

    return () => {
      unsubSettings();
      unsubState();
      unsubEffective();
    };
  });

  onDestroy(() => {
    if (overlayElement) {
      overlayElement.remove();
    }
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }
    document.removeEventListener('mousemove', handleActivity);
    document.removeEventListener('keydown', handleActivity);
    document.removeEventListener('fullscreenchange', checkFullscreen);
  });
</script>

<div class="screen-dimming-manager" data-testid="screen-dimming-manager">
  <slot 
    enabled={$settings.enabled}
    intensity={$settings.intensity}
    warmth={$settings.warmth}
    active={$state.active}
    scheduledActive={$state.scheduledActive}
    currentIntensity={$state.currentIntensity}
    currentWarmth={$state.currentWarmth}
    {enable}
    {disable}
    {toggle}
    {setIntensity}
    {setWarmth}
    {setSchedule}
    {temporaryDisable}
  />
</div>

<style>
  .screen-dimming-manager {
    display: contents;
  }
</style>
