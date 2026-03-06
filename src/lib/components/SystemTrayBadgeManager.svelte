<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  // Props
  export let unreadCount: number = 0;
  export let urgentCount: number = 0;
  export let showBadge: boolean = true;
  export let badgeColor: string = '#ff3b30';
  export let urgentColor: string = '#ff9500';
  export let maxDisplayCount: number = 99;
  export let flashOnUrgent: boolean = true;
  export let flashIntervalMs: number = 500;
  export let autoHideZero: boolean = true;
  export let iconStyle: 'dot' | 'count' | 'both' = 'count';
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';

  const dispatch = createEventDispatcher<{
    badgeClick: { count: number; urgent: number };
    badgeUpdate: { count: number; urgent: number; display: string };
    urgentFlash: { flashing: boolean };
    error: { message: string; code: string };
  }>();

  // State
  let isFlashing = false;
  let flashVisible = true;
  let flashIntervalId: ReturnType<typeof setInterval> | null = null;
  let lastBadgeValue = '';
  let tauriAvailable = false;
  let isUpdating = false;
  let mounted = false;

  // Tauri imports (lazy loaded)
  let tauriWindow: typeof import('@tauri-apps/api/window') | null = null;
  let tauriApp: typeof import('@tauri-apps/api/app') | null = null;

  $: displayCount = getDisplayCount(unreadCount, urgentCount);
  $: shouldShow = showBadge && (unreadCount > 0 || urgentCount > 0 || !autoHideZero);
  $: isUrgent = urgentCount > 0;

  $: if (mounted && isUrgent && flashOnUrgent && !isFlashing) {
    startFlashing();
  } else if (mounted && !isUrgent && isFlashing) {
    stopFlashing();
  }

  $: if (mounted && shouldShow !== undefined) {
    updateTrayBadge();
  }

  function getDisplayCount(unread: number, urgent: number): string {
    const total = unread + urgent;
    if (total <= 0) return '';
    if (total > maxDisplayCount) return `${maxDisplayCount}+`;
    return total.toString();
  }

  function startFlashing(): void {
    if (isFlashing) return;
    isFlashing = true;
    flashVisible = true;

    flashIntervalId = setInterval(() => {
      flashVisible = !flashVisible;
      updateTrayBadge();
    }, flashIntervalMs);

    dispatch('urgentFlash', { flashing: true });
  }

  function stopFlashing(): void {
    if (!isFlashing) return;
    isFlashing = false;
    flashVisible = true;

    if (flashIntervalId) {
      clearInterval(flashIntervalId);
      flashIntervalId = null;
    }

    dispatch('urgentFlash', { flashing: false });
    updateTrayBadge();
  }

  async function initTauri(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        tauriWindow = await import('@tauri-apps/api/window');
        tauriApp = await import('@tauri-apps/api/app');
        tauriAvailable = true;
      }
    } catch (err) {
      console.warn('Tauri API not available for system tray badge:', err);
      tauriAvailable = false;
    }
  }

  async function updateTrayBadge(): Promise<void> {
    if (isUpdating || !mounted) return;

    const newBadgeValue = shouldShow && flashVisible ? displayCount : '';
    if (newBadgeValue === lastBadgeValue) return;

    isUpdating = true;
    lastBadgeValue = newBadgeValue;

    try {
      if (tauriAvailable) {
        await setNativeBadge(newBadgeValue);
      }

      dispatch('badgeUpdate', {
        count: unreadCount,
        urgent: urgentCount,
        display: newBadgeValue
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      dispatch('error', { message, code: 'BADGE_UPDATE_FAILED' });
    } finally {
      isUpdating = false;
    }
  }

  async function setNativeBadge(value: string): Promise<void> {
    if (!tauriWindow) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const count = value ? parseInt(value.replace('+', '')) || 0 : 0;
      await invoke('set_tray_badge', { count });
    } catch (err) {
      console.debug('Tray badge API not available:', err);
    }
  }

  async function clearBadge(): Promise<void> {
    stopFlashing();
    unreadCount = 0;
    urgentCount = 0;
    await updateTrayBadge();
  }

  function handleBadgeClick(): void {
    dispatch('badgeClick', {
      count: unreadCount,
      urgent: urgentCount
    });
  }

  // Exported methods for external control
  export function setBadgeCount(count: number, urgent: number = 0): void {
    unreadCount = Math.max(0, count);
    urgentCount = Math.max(0, urgent);
  }

  export function incrementBadge(amount: number = 1, isUrgentMsg: boolean = false): void {
    if (isUrgentMsg) {
      urgentCount = Math.max(0, urgentCount + amount);
    } else {
      unreadCount = Math.max(0, unreadCount + amount);
    }
  }

  export function decrementBadge(amount: number = 1): void {
    const total = unreadCount + urgentCount;
    const newTotal = Math.max(0, total - amount);
    
    // Decrement urgent first, then regular
    if (urgentCount > 0) {
      const urgentDecrement = Math.min(urgentCount, amount);
      urgentCount -= urgentDecrement;
      amount -= urgentDecrement;
    }
    if (amount > 0 && unreadCount > 0) {
      unreadCount = Math.max(0, unreadCount - amount);
    }
  }

  export async function flash(durationMs: number = 3000): Promise<void> {
    startFlashing();
    setTimeout(() => stopFlashing(), durationMs);
  }

  export { clearBadge };

  onMount(async () => {
    mounted = true;
    await initTauri();
    await updateTrayBadge();
  });

  onDestroy(() => {
    mounted = false;
    stopFlashing();
  });
</script>

<!-- Visual preview component (for development/testing) -->
{#if $$slots.default}
  <div 
    class="tray-badge-preview"
    class:urgent={isUrgent}
    class:flashing={isFlashing && !flashVisible}
    on:click={handleBadgeClick}
    on:keydown={(e) => e.key === 'Enter' && handleBadgeClick()}
    role="button"
    tabindex="0"
    aria-label="System tray badge: {displayCount || 'no'} notifications"
  >
    <slot />
    
    {#if shouldShow && flashVisible}
      <div 
        class="badge"
        class:dot-only={iconStyle === 'dot'}
        class:position-top-right={position === 'top-right'}
        class:position-top-left={position === 'top-left'}
        class:position-bottom-right={position === 'bottom-right'}
        class:position-bottom-left={position === 'bottom-left'}
        style:background-color={isUrgent ? urgentColor : badgeColor}
      >
        {#if iconStyle !== 'dot'}
          <span class="count">{displayCount}</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .tray-badge-preview {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }

  .tray-badge-preview:focus {
    outline: 2px solid var(--focus-ring-color, #007aff);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .tray-badge-preview.flashing {
    opacity: 0.7;
  }

  .badge {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transform: translate(50%, -50%);
    transition: transform 0.15s ease, opacity 0.15s ease;
    z-index: 10;
  }

  .badge.dot-only {
    min-width: 10px;
    width: 10px;
    height: 10px;
    padding: 0;
    border-radius: 50%;
  }

  .badge.position-top-right {
    top: 0;
    right: 0;
    transform: translate(40%, -40%);
  }

  .badge.position-top-left {
    top: 0;
    left: 0;
    transform: translate(-40%, -40%);
  }

  .badge.position-bottom-right {
    bottom: 0;
    right: 0;
    transform: translate(40%, 40%);
  }

  .badge.position-bottom-left {
    bottom: 0;
    left: 0;
    transform: translate(-40%, 40%);
  }

  .count {
    line-height: 1;
    letter-spacing: -0.5px;
  }

  .tray-badge-preview.urgent .badge {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      transform: translate(40%, -40%) scale(1);
    }
    50% {
      transform: translate(40%, -40%) scale(1.1);
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .badge {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .badge {
      transition: none;
    }

    .tray-badge-preview.urgent .badge {
      animation: none;
    }
  }
</style>
