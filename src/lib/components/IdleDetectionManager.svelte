<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getIdleStatusWithThreshold, type IdleStatus } from "$lib/tauri";
  import { presenceStore as presence, type PresenceStatus } from "$lib/stores/presence";
  import { currentUser } from "$lib/stores/user";

  // Configurable settings
  export let enabled: boolean = true;
  export let idleThresholdMinutes: number = 5;
  export let awayThresholdMinutes: number = 15;
  export let pollIntervalSeconds: number = 30;
  export let showSettings: boolean = false;

  // Internal state
  let currentIdleStatus: IdleStatus | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let previousStatus: PresenceStatus | null = null;
  let manualStatus: PresenceStatus | null = null;
  let isMonitoring = false;
  let lastActivity = Date.now();
  let currentPresenceStatus: PresenceStatus = "online";

  // Computed
  $: idleThresholdSeconds = idleThresholdMinutes * 60;
  $: awayThresholdSeconds = awayThresholdMinutes * 60;
  $: formattedIdleTime = currentIdleStatus
    ? formatDuration(currentIdleStatus.idle_seconds)
    : "—";
  $: statusLabel = getStatusLabel();

  function formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  }

  function getStatusLabel(): string {
    if (!currentIdleStatus) return "Unknown";
    if (currentIdleStatus.screen_locked) return "Screen Locked";
    if (currentIdleStatus.idle_seconds >= awayThresholdSeconds) return "Away";
    if (currentIdleStatus.idle_seconds >= idleThresholdSeconds) return "Idle";
    return "Active";
  }

  async function checkIdleStatus() {
    if (!enabled) return;

    try {
      const status = await getIdleStatusWithThreshold(idleThresholdSeconds);
      currentIdleStatus = status;

      // Determine new status based on idle time
      let newStatus: "online" | "idle" | "away" | "dnd" = "online";

      if (status.screen_locked) {
        newStatus = "away";
      } else if (status.idle_seconds >= awayThresholdSeconds) {
        newStatus = "away";
      } else if (status.idle_seconds >= idleThresholdSeconds) {
        newStatus = "idle";
      }

      // Get current presence status
      const currentStatus = $presence.status;

      // Only auto-update if user hasn't manually set DND
      if (currentStatus !== "dnd") {
        // Store the manual status when transitioning to idle/away
        if (
          newStatus !== "online" &&
          previousStatus === "online" &&
          !manualStatus
        ) {
          manualStatus = currentStatus;
        }

        // Update presence if status changed
        if (currentStatus !== newStatus) {
          if (newStatus === "online" && manualStatus) {
            // Restore previous status when becoming active
            presence.setStatus(manualStatus as "online" | "idle" | "away");
            manualStatus = null;
          } else {
            presence.setStatus(newStatus);
          }
        }

        previousStatus = newStatus;
      }

      lastActivity =
        status.idle_seconds === 0 ? Date.now() : lastActivity;
    } catch (error) {
      console.error("Failed to get idle status:", error);
    }
  }

  function startMonitoring() {
    if (pollInterval) return;

    isMonitoring = true;
    checkIdleStatus();
    pollInterval = setInterval(checkIdleStatus, pollIntervalSeconds * 1000);
  }

  function stopMonitoring() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isMonitoring = false;
  }

  // Handle settings changes
  function handleThresholdChange(type: "idle" | "away", value: number) {
    if (type === "idle") {
      idleThresholdMinutes = Math.max(1, Math.min(value, awayThresholdMinutes - 1));
    } else {
      awayThresholdMinutes = Math.max(idleThresholdMinutes + 1, Math.min(value, 120));
    }
  }

  function handlePollIntervalChange(value: number) {
    pollIntervalSeconds = Math.max(10, Math.min(value, 300));
    // Restart monitoring with new interval
    if (isMonitoring) {
      stopMonitoring();
      startMonitoring();
    }
  }

  onMount(() => {
    if (enabled) {
      startMonitoring();
    }
  });

  onDestroy(() => {
    stopMonitoring();
  });

  // React to enabled prop changes
  $: {
    if (enabled && !isMonitoring) {
      startMonitoring();
    } else if (!enabled && isMonitoring) {
      stopMonitoring();
    }
  }
</script>

{#if showSettings}
  <div class="idle-detection-settings">
    <div class="settings-header">
      <h3>Idle Detection</h3>
      <label class="toggle">
        <input type="checkbox" bind:checked={enabled} />
        <span class="toggle-slider"></span>
      </label>
    </div>

    {#if enabled}
      <div class="status-display">
        <div class="status-indicator" class:active={statusLabel === "Active"} class:idle={statusLabel === "Idle"} class:away={statusLabel === "Away" || statusLabel === "Screen Locked"}>
          <span class="status-dot"></span>
          <span class="status-text">{statusLabel}</span>
        </div>
        <span class="idle-time">Inactive: {formattedIdleTime}</span>
      </div>

      <div class="settings-grid">
        <div class="setting-item">
          <label for="idle-threshold">Idle after</label>
          <div class="input-group">
            <input
              type="number"
              id="idle-threshold"
              min="1"
              max={awayThresholdMinutes - 1}
              value={idleThresholdMinutes}
              on:change={(e) => handleThresholdChange("idle", parseInt(e.currentTarget.value))}
            />
            <span class="unit">min</span>
          </div>
        </div>

        <div class="setting-item">
          <label for="away-threshold">Away after</label>
          <div class="input-group">
            <input
              type="number"
              id="away-threshold"
              min={idleThresholdMinutes + 1}
              max="120"
              value={awayThresholdMinutes}
              on:change={(e) => handleThresholdChange("away", parseInt(e.currentTarget.value))}
            />
            <span class="unit">min</span>
          </div>
        </div>

        <div class="setting-item full-width">
          <label for="poll-interval">Check every</label>
          <div class="input-group">
            <input
              type="number"
              id="poll-interval"
              min="10"
              max="300"
              value={pollIntervalSeconds}
              on:change={(e) => handlePollIntervalChange(parseInt(e.currentTarget.value))}
            />
            <span class="unit">sec</span>
          </div>
        </div>
      </div>

      <p class="hint">
        Your status will automatically change to "Idle" or "Away" based on
        inactivity. When you return, your previous status will be restored.
      </p>
    {:else}
      <p class="hint disabled">
        Enable idle detection to automatically update your status when you're
        away from the computer.
      </p>
    {/if}
  </div>
{/if}

<style>
  .idle-detection-settings {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 16px;
    margin: 8px 0;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .settings-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    cursor: pointer;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--bg-tertiary, #202225);
    border-radius: 11px;
    transition: background 0.2s;
  }

  .toggle-slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 2px;
    bottom: 2px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle input:checked + .toggle-slider {
    background: var(--brand-primary, #5865f2);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(18px);
  }

  .status-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--bg-tertiary, #202225);
    border-radius: 6px;
    margin-bottom: 16px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--status-gray, #747f8d);
  }

  .status-indicator.active .status-dot {
    background: var(--status-green, #3ba55c);
  }

  .status-indicator.idle .status-dot {
    background: var(--status-yellow, #faa61a);
  }

  .status-indicator.away .status-dot {
    background: var(--status-red, #ed4245);
  }

  .status-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .idle-time {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  .setting-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-item.full-width {
    grid-column: span 2;
  }

  .setting-item label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #b9bbbe);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .input-group input {
    flex: 1;
    padding: 8px 10px;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #fff);
    font-size: 14px;
    outline: none;
  }

  .input-group input:focus {
    box-shadow: 0 0 0 2px var(--brand-primary, #5865f2);
  }

  .input-group .unit {
    font-size: 12px;
    color: var(--text-muted, #72767d);
    min-width: 24px;
  }

  .hint {
    font-size: 12px;
    color: var(--text-muted, #72767d);
    line-height: 1.4;
    margin: 0;
  }

  .hint.disabled {
    opacity: 0.7;
  }
</style>
