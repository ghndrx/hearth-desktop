<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, fly, scale } from 'svelte/transition';
  import { quintOut, elasticOut, backOut } from 'svelte/easing';
  import { invoke } from '@tauri-apps/api/core';

  // ============================================================================
  // Types
  // ============================================================================

  export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'loading';
  export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  export type ToastAnimation = 'slide' | 'fade' | 'scale' | 'bounce';

  export interface ToastAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }

  export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration: number;
    dismissible: boolean;
    actions?: ToastAction[];
    icon?: string;
    progress?: boolean;
    timestamp: number;
    pausedAt?: number;
    remainingTime?: number;
  }

  export interface ToastOptions {
    type?: ToastType;
    title: string;
    message?: string;
    duration?: number;
    dismissible?: boolean;
    actions?: ToastAction[];
    icon?: string;
    progress?: boolean;
    id?: string;
  }

  interface ToastState {
    toasts: Toast[];
    pausedToasts: Set<string>;
    history: Toast[];
  }

  // ============================================================================
  // Props
  // ============================================================================

  /** Position of toast container */
  export let position: ToastPosition = 'bottom-right';

  /** Maximum number of visible toasts */
  export let maxVisible: number = 5;

  /** Gap between toasts in pixels */
  export let gap: number = 12;

  /** Default toast duration in ms */
  export let defaultDuration: number = 4000;

  /** Animation style */
  export let animation: ToastAnimation = 'slide';

  /** Pause timers on hover */
  export let pauseOnHover: boolean = true;

  /** Pause timers when window loses focus */
  export let pauseOnFocusLoss: boolean = true;

  /** Show close button on all toasts */
  export let showCloseButton: boolean = true;

  /** Enable stacking animation */
  export let stackAnimation: boolean = true;

  /** Native notification fallback for background */
  export let nativeFallback: boolean = true;

  /** Maximum history size */
  export let maxHistory: number = 50;

  /** Enable sound effects */
  export let enableSounds: boolean = false;

  /** Custom sound URLs */
  export let sounds: Partial<Record<ToastType, string>> = {};

  // ============================================================================
  // State
  // ============================================================================

  const state: Writable<ToastState> = writable({
    toasts: [],
    pausedToasts: new Set(),
    history: []
  });

  const visibleToasts = derived(state, $state => 
    $state.toasts.slice(0, maxVisible)
  );

  const hiddenCount = derived(state, $state => 
    Math.max(0, $state.toasts.length - maxVisible)
  );

  let containerRef: HTMLDivElement;
  let timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  let progressIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  let isWindowFocused = true;
  let audioContext: AudioContext | null = null;

  // ============================================================================
  // Toast Management
  // ============================================================================

  function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  export function show(options: ToastOptions): string {
    const id = options.id || generateId();
    
    const toast: Toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      duration: options.duration ?? defaultDuration,
      dismissible: options.dismissible ?? true,
      actions: options.actions,
      icon: options.icon,
      progress: options.progress ?? false,
      timestamp: Date.now(),
      remainingTime: options.duration ?? defaultDuration
    };

    state.update(s => {
      // Remove duplicate if updating
      const filtered = s.toasts.filter(t => t.id !== id);
      return {
        ...s,
        toasts: [...filtered, toast]
      };
    });

    // Play sound
    if (enableSounds) {
      playSound(toast.type);
    }

    // Start timer if duration > 0
    if (toast.duration > 0) {
      startTimer(toast);
    }

    // Native notification fallback when window is not focused
    if (nativeFallback && !isWindowFocused && toast.type !== 'loading') {
      sendNativeNotification(toast);
    }

    return id;
  }

  export function dismiss(id: string): void {
    clearTimer(id);
    clearProgressInterval(id);
    
    state.update(s => {
      const toast = s.toasts.find(t => t.id === id);
      const history = toast 
        ? [...s.history, { ...toast, timestamp: Date.now() }].slice(-maxHistory)
        : s.history;
      
      return {
        ...s,
        toasts: s.toasts.filter(t => t.id !== id),
        history
      };
    });
  }

  export function dismissAll(): void {
    state.update(s => {
      // Clear all timers
      s.toasts.forEach(t => {
        clearTimer(t.id);
        clearProgressInterval(t.id);
      });

      return {
        ...s,
        toasts: [],
        history: [...s.history, ...s.toasts].slice(-maxHistory)
      };
    });
  }

  export function update(id: string, options: Partial<ToastOptions>): void {
    state.update(s => ({
      ...s,
      toasts: s.toasts.map(t => {
        if (t.id !== id) return t;
        
        const updated = {
          ...t,
          ...options,
          type: options.type ?? t.type,
          title: options.title ?? t.title,
          message: options.message ?? t.message
        };

        // Restart timer if duration changed
        if (options.duration !== undefined && options.duration > 0) {
          clearTimer(id);
          startTimer(updated);
        }

        return updated;
      })
    }));
  }

  // Convenience methods
  export const info = (title: string, options?: Partial<ToastOptions>) => 
    show({ ...options, title, type: 'info' });
  
  export const success = (title: string, options?: Partial<ToastOptions>) => 
    show({ ...options, title, type: 'success' });
  
  export const warning = (title: string, options?: Partial<ToastOptions>) => 
    show({ ...options, title, type: 'warning' });
  
  export const error = (title: string, options?: Partial<ToastOptions>) => 
    show({ ...options, title, type: 'error' });
  
  export const loading = (title: string, options?: Partial<ToastOptions>) => 
    show({ ...options, title, type: 'loading', duration: 0, dismissible: false });

  export function promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ): Promise<T> {
    const id = loading(messages.loading);

    promise
      .then((data) => {
        const msg = typeof messages.success === 'function' 
          ? messages.success(data) 
          : messages.success;
        update(id, { type: 'success', title: msg, duration: defaultDuration, dismissible: true });
      })
      .catch((err) => {
        const msg = typeof messages.error === 'function' 
          ? messages.error(err) 
          : messages.error;
        update(id, { type: 'error', title: msg, duration: defaultDuration * 1.5, dismissible: true });
      });

    return promise;
  }

  // ============================================================================
  // Timer Management
  // ============================================================================

  function startTimer(toast: Toast): void {
    if (toast.duration <= 0) return;

    const remaining = toast.remainingTime ?? toast.duration;
    
    // Progress tracking
    if (toast.progress) {
      startProgressInterval(toast.id, remaining);
    }

    const timer = setTimeout(() => {
      dismiss(toast.id);
    }, remaining);

    timers.set(toast.id, timer);
  }

  function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  }

  function startProgressInterval(id: string, duration: number): void {
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      state.update(s => ({
        ...s,
        toasts: s.toasts.map(t => {
          if (t.id !== id) return t;
          const elapsed = Date.now() - startTime;
          return { ...t, remainingTime: Math.max(0, duration - elapsed) };
        })
      }));
    }, 50);

    progressIntervals.set(id, interval);
  }

  function clearProgressInterval(id: string): void {
    const interval = progressIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      progressIntervals.delete(id);
    }
  }

  function pauseToast(id: string): void {
    const toast = $state.toasts.find(t => t.id === id);
    if (!toast || toast.duration <= 0) return;

    clearTimer(id);
    clearProgressInterval(id);

    state.update(s => ({
      ...s,
      toasts: s.toasts.map(t => 
        t.id === id ? { ...t, pausedAt: Date.now() } : t
      ),
      pausedToasts: new Set([...s.pausedToasts, id])
    }));
  }

  function resumeToast(id: string): void {
    const toast = $state.toasts.find(t => t.id === id);
    if (!toast || !toast.pausedAt) return;

    state.update(s => {
      const newPaused = new Set(s.pausedToasts);
      newPaused.delete(id);
      return {
        ...s,
        toasts: s.toasts.map(t => 
          t.id === id ? { ...t, pausedAt: undefined } : t
        ),
        pausedToasts: newPaused
      };
    });

    startTimer(toast);
  }

  function pauseAllToasts(): void {
    $state.toasts.forEach(t => pauseToast(t.id));
  }

  function resumeAllToasts(): void {
    $state.toasts.forEach(t => resumeToast(t.id));
  }

  // ============================================================================
  // Native Notifications
  // ============================================================================

  async function sendNativeNotification(toast: Toast): Promise<void> {
    try {
      await invoke('plugin:notification|notify', {
        title: toast.title,
        body: toast.message || '',
        icon: getIconPath(toast.type)
      });
    } catch (err) {
      console.warn('Failed to send native notification:', err);
    }
  }

  function getIconPath(type: ToastType): string {
    const icons: Record<ToastType, string> = {
      info: 'icons/info.png',
      success: 'icons/success.png',
      warning: 'icons/warning.png',
      error: 'icons/error.png',
      loading: 'icons/loading.png'
    };
    return icons[type];
  }

  // ============================================================================
  // Sound Effects
  // ============================================================================

  function playSound(type: ToastType): void {
    if (!enableSounds) return;

    const soundUrl = sounds[type];
    if (!soundUrl) {
      playDefaultSound(type);
      return;
    }

    const audio = new Audio(soundUrl);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }

  function playDefaultSound(type: ToastType): void {
    if (!audioContext) {
      try {
        audioContext = new AudioContext();
      } catch {
        return;
      }
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different sounds for different types
    const settings: Record<ToastType, { freq: number; duration: number; type: OscillatorType }> = {
      info: { freq: 440, duration: 0.1, type: 'sine' },
      success: { freq: 523, duration: 0.15, type: 'sine' },
      warning: { freq: 349, duration: 0.2, type: 'triangle' },
      error: { freq: 220, duration: 0.25, type: 'square' },
      loading: { freq: 392, duration: 0.08, type: 'sine' }
    };

    const s = settings[type];
    oscillator.type = s.type;
    oscillator.frequency.value = s.freq;
    gainNode.gain.value = 0.1;
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + s.duration);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + s.duration);
  }

  // ============================================================================
  // Window Focus Handling
  // ============================================================================

  function handleFocus(): void {
    isWindowFocused = true;
    if (pauseOnFocusLoss) {
      resumeAllToasts();
    }
  }

  function handleBlur(): void {
    isWindowFocused = false;
    if (pauseOnFocusLoss) {
      pauseAllToasts();
    }
  }

  // ============================================================================
  // Animation Helpers
  // ============================================================================

  function getEnterTransition(node: HTMLElement) {
    const isTop = position.startsWith('top');
    const isLeft = position.endsWith('left');
    const isCenter = position.endsWith('center');

    switch (animation) {
      case 'slide':
        return fly(node, {
          duration: 300,
          y: isTop ? -50 : 50,
          x: isCenter ? 0 : (isLeft ? -50 : 50),
          easing: quintOut
        });
      case 'fade':
        return fade(node, { duration: 200 });
      case 'scale':
        return scale(node, { duration: 250, start: 0.8, easing: backOut });
      case 'bounce':
        return scale(node, { duration: 400, start: 0.5, easing: elasticOut });
      default:
        return fade(node, { duration: 200 });
    }
  }

  function getExitTransition(node: HTMLElement) {
    return fade(node, { duration: 150 });
  }

  // ============================================================================
  // Icon Rendering
  // ============================================================================

  const typeIcons: Record<ToastType, string> = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="toast-spinner"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`
  };

  // ============================================================================
  // Position Styles
  // ============================================================================

  $: positionStyles = (() => {
    const styles: Record<string, string> = {
      position: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      gap: `${gap}px`,
      zIndex: '9999',
      pointerEvents: 'none',
      padding: '16px'
    };

    if (position.startsWith('top')) {
      styles.top = '0';
      styles.flexDirection = 'column';
    } else {
      styles.bottom = '0';
      styles.flexDirection = 'column-reverse';
    }

    if (position.endsWith('left')) {
      styles.left = '0';
      styles.alignItems = 'flex-start';
    } else if (position.endsWith('right')) {
      styles.right = '0';
      styles.alignItems = 'flex-end';
    } else {
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
      styles.alignItems = 'center';
    }

    return Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ');
  })();

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onMount(() => {
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Expose toast API globally
    (window as any).__toastManager = {
      show, dismiss, dismissAll, update,
      info, success, warning, error, loading, promise
    };
  });

  onDestroy(() => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('blur', handleBlur);

    // Clear all timers
    timers.forEach(t => clearTimeout(t));
    progressIntervals.forEach(i => clearInterval(i));

    delete (window as any).__toastManager;
  });
</script>

<div 
  bind:this={containerRef}
  class="toast-container"
  style={positionStyles}
  role="region"
  aria-label="Notifications"
  aria-live="polite"
>
  {#each $visibleToasts as toast, index (toast.id)}
    <div
      class="toast toast--{toast.type}"
      class:toast--stacked={stackAnimation && index > 0}
      style:--stack-offset="{stackAnimation ? index * 4 : 0}px"
      style:--stack-scale="{stackAnimation ? 1 - index * 0.02 : 1}"
      in:getEnterTransition
      out:getExitTransition
      on:mouseenter={() => pauseOnHover && pauseToast(toast.id)}
      on:mouseleave={() => pauseOnHover && resumeToast(toast.id)}
      role="alert"
      aria-atomic="true"
    >
      <div class="toast__icon">
        {#if toast.icon}
          <span class="toast__custom-icon">{toast.icon}</span>
        {:else}
          {@html typeIcons[toast.type]}
        {/if}
      </div>

      <div class="toast__content">
        <div class="toast__title">{toast.title}</div>
        {#if toast.message}
          <div class="toast__message">{toast.message}</div>
        {/if}

        {#if toast.actions && toast.actions.length > 0}
          <div class="toast__actions">
            {#each toast.actions as action}
              <button
                class="toast__action toast__action--{action.variant || 'secondary'}"
                on:click={() => {
                  action.onClick();
                  if (toast.dismissible) dismiss(toast.id);
                }}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if showCloseButton && toast.dismissible}
        <button
          class="toast__close"
          on:click={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      {/if}

      {#if toast.progress && toast.duration > 0}
        <div 
          class="toast__progress"
          style:width="{((toast.remainingTime ?? toast.duration) / toast.duration) * 100}%"
        />
      {/if}
    </div>
  {/each}

  {#if $hiddenCount > 0}
    <div class="toast-overflow" transition:fade={{ duration: 150 }}>
      +{$hiddenCount} more notification{$hiddenCount > 1 ? 's' : ''}
    </div>
  {/if}
</div>

<style>
  .toast-container {
    max-width: min(420px, calc(100vw - 32px));
  }

  .toast {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 300px;
    max-width: 100%;
    padding: 14px 16px;
    background: var(--toast-bg, #2d2d2d);
    border-radius: 8px;
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.2);
    pointer-events: auto;
    overflow: hidden;
    border-left: 4px solid var(--toast-accent);
    transform-origin: center top;
  }

  .toast--stacked {
    transform: translateY(var(--stack-offset)) scale(var(--stack-scale));
    opacity: 0.95;
  }

  .toast--info {
    --toast-accent: #3b82f6;
    --toast-icon-color: #60a5fa;
  }

  .toast--success {
    --toast-accent: #22c55e;
    --toast-icon-color: #4ade80;
  }

  .toast--warning {
    --toast-accent: #f59e0b;
    --toast-icon-color: #fbbf24;
  }

  .toast--error {
    --toast-accent: #ef4444;
    --toast-icon-color: #f87171;
  }

  .toast--loading {
    --toast-accent: #8b5cf6;
    --toast-icon-color: #a78bfa;
  }

  .toast__icon {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    color: var(--toast-icon-color);
  }

  .toast__icon :global(svg) {
    width: 100%;
    height: 100%;
  }

  .toast__icon :global(.toast-spinner) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .toast__custom-icon {
    font-size: 20px;
    line-height: 1;
  }

  .toast__content {
    flex: 1;
    min-width: 0;
  }

  .toast__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--toast-title-color, #f5f5f5);
    line-height: 1.4;
    word-wrap: break-word;
  }

  .toast__message {
    margin-top: 4px;
    font-size: 13px;
    color: var(--toast-message-color, #a3a3a3);
    line-height: 1.4;
    word-wrap: break-word;
  }

  .toast__actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .toast__action {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    background: var(--toast-action-bg, rgba(255, 255, 255, 0.1));
    color: var(--toast-action-color, #e5e5e5);
  }

  .toast__action:hover {
    background: var(--toast-action-hover-bg, rgba(255, 255, 255, 0.15));
  }

  .toast__action--primary {
    background: var(--toast-accent);
    color: white;
  }

  .toast__action--primary:hover {
    filter: brightness(1.1);
  }

  .toast__action--danger {
    background: #ef4444;
    color: white;
  }

  .toast__action--danger:hover {
    background: #dc2626;
  }

  .toast__close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--toast-close-color, #737373);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast__close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--toast-close-hover-color, #a3a3a3);
  }

  .toast__close svg {
    width: 16px;
    height: 16px;
  }

  .toast__progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: var(--toast-accent);
    opacity: 0.6;
    transition: width 50ms linear;
  }

  .toast-overflow {
    padding: 8px 16px;
    font-size: 12px;
    color: var(--toast-overflow-color, #737373);
    background: var(--toast-overflow-bg, rgba(45, 45, 45, 0.9));
    border-radius: 6px;
    pointer-events: auto;
    text-align: center;
  }

  /* Light theme support */
  @media (prefers-color-scheme: light) {
    .toast {
      --toast-bg: #ffffff;
      --toast-title-color: #171717;
      --toast-message-color: #525252;
      --toast-close-color: #a3a3a3;
      --toast-close-hover-color: #525252;
      --toast-action-bg: rgba(0, 0, 0, 0.05);
      --toast-action-color: #171717;
      --toast-action-hover-bg: rgba(0, 0, 0, 0.1);
      --toast-overflow-bg: rgba(255, 255, 255, 0.95);
      --toast-overflow-color: #525252;
      box-shadow: 
        0 4px 12px rgba(0, 0, 0, 0.15),
        0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .toast__icon :global(.toast-spinner) {
      animation: none;
    }

    .toast__progress {
      transition: none;
    }
  }
</style>
