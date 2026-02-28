<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { quintOut, elasticOut } from 'svelte/easing';

  interface WheelAction {
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
    color?: string;
    disabled?: boolean;
  }

  export let isOpen = false;
  export let position: { x: number; y: number } = { x: 0, y: 0 };
  export let actions: WheelAction[] = [
    { id: 'new-message', label: 'New Message', icon: '✉️', shortcut: 'N', color: '#3b82f6' },
    { id: 'search', label: 'Search', icon: '🔍', shortcut: 'S', color: '#8b5cf6' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', shortcut: 'B', color: '#f59e0b' },
    { id: 'settings', label: 'Settings', icon: '⚙️', shortcut: 'P', color: '#6b7280' },
    { id: 'focus-mode', label: 'Focus Mode', icon: '🎯', shortcut: 'F', color: '#10b981' },
    { id: 'quick-note', label: 'Quick Note', icon: '📝', shortcut: 'Q', color: '#ec4899' },
    { id: 'screenshot', label: 'Screenshot', icon: '📷', shortcut: 'C', color: '#06b6d4' },
    { id: 'voice-call', label: 'Voice Call', icon: '📞', shortcut: 'V', color: '#22c55e' },
  ];
  export let radius = 140;
  export let itemSize = 56;
  export let hotkey = 'Alt+Space';
  export let centerAction: WheelAction | null = null;

  const dispatch = createEventDispatcher<{
    action: { id: string; action: WheelAction };
    open: void;
    close: void;
  }>();

  let containerRef: HTMLDivElement;
  let hoveredIndex = -1;
  let selectedIndex = -1;
  let isAnimating = false;
  let mousePosition = { x: 0, y: 0 };
  let keyboardNavigation = false;

  $: itemAngle = (2 * Math.PI) / actions.length;
  $: startAngle = -Math.PI / 2; // Start from top

  $: itemPositions = actions.map((_, index) => {
    const angle = startAngle + index * itemAngle;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle: angle * (180 / Math.PI),
    };
  });

  function getItemStyle(index: number): string {
    const pos = itemPositions[index];
    const isHovered = hoveredIndex === index;
    const isSelected = selectedIndex === index;
    const scale = isHovered ? 1.15 : isSelected ? 1.1 : 1;
    const zIndex = isHovered ? 20 : isSelected ? 15 : 10;

    return `
      transform: translate(${pos.x}px, ${pos.y}px) scale(${scale});
      z-index: ${zIndex};
      --item-color: ${actions[index]?.color || '#6b7280'};
    `;
  }

  function handleItemClick(index: number) {
    const action = actions[index];
    if (action && !action.disabled) {
      selectedIndex = index;
      dispatch('action', { id: action.id, action });
      close();
    }
  }

  function handleCenterClick() {
    if (centerAction && !centerAction.disabled) {
      dispatch('action', { id: centerAction.id, action: centerAction });
      close();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isOpen || keyboardNavigation) return;

    const rect = containerRef?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    mousePosition = { x: event.clientX, y: event.clientY };

    // If within center zone, highlight center action
    if (distance < 40) {
      hoveredIndex = -1;
      return;
    }

    // Calculate angle and find closest item
    let angle = Math.atan2(dy, dx);
    angle = (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
    const index = Math.round(angle / itemAngle) % actions.length;
    hoveredIndex = index;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isOpen) return;

    keyboardNavigation = true;

    switch (event.key) {
      case 'Escape':
        close();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        hoveredIndex = (hoveredIndex + 1) % actions.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        hoveredIndex = hoveredIndex <= 0 ? actions.length - 1 : hoveredIndex - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (hoveredIndex >= 0) {
          handleItemClick(hoveredIndex);
        } else if (centerAction) {
          handleCenterClick();
        }
        break;
      default:
        // Check for shortcut keys
        const shortcut = event.key.toUpperCase();
        const actionIndex = actions.findIndex(
          (a) => a.shortcut?.toUpperCase() === shortcut
        );
        if (actionIndex >= 0) {
          event.preventDefault();
          handleItemClick(actionIndex);
        }
    }
  }

  function handleGlobalKeyDown(event: KeyboardEvent) {
    // Parse hotkey
    const keys = hotkey.toLowerCase().split('+');
    const requireAlt = keys.includes('alt');
    const requireCtrl = keys.includes('ctrl') || keys.includes('control');
    const requireShift = keys.includes('shift');
    const requireMeta = keys.includes('meta') || keys.includes('cmd');
    const mainKey = keys.find(
      (k) => !['alt', 'ctrl', 'control', 'shift', 'meta', 'cmd'].includes(k)
    );

    const matches =
      event.altKey === requireAlt &&
      event.ctrlKey === requireCtrl &&
      event.shiftKey === requireShift &&
      event.metaKey === requireMeta &&
      event.key.toLowerCase() === mainKey;

    if (matches) {
      event.preventDefault();
      toggle();
    }
  }

  function open() {
    if (isOpen || isAnimating) return;
    isAnimating = true;
    isOpen = true;
    hoveredIndex = -1;
    selectedIndex = -1;
    keyboardNavigation = false;
    dispatch('open');
    setTimeout(() => {
      isAnimating = false;
    }, 300);
  }

  function close() {
    if (!isOpen || isAnimating) return;
    isAnimating = true;
    isOpen = false;
    dispatch('close');
    setTimeout(() => {
      isAnimating = false;
      hoveredIndex = -1;
      selectedIndex = -1;
    }, 200);
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      // Center on screen if no position specified
      if (position.x === 0 && position.y === 0) {
        position = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
      }
      open();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  // Export methods for external control
  export { open, close, toggle };
</script>

<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
  <div
    class="quick-actions-wheel-backdrop"
    on:click={handleBackdropClick}
    on:mousemove={handleMouseMove}
    transition:fade={{ duration: 150 }}
    role="dialog"
    aria-modal="true"
    aria-label="Quick Actions Wheel"
  >
    <div
      bind:this={containerRef}
      class="quick-actions-wheel"
      style="left: {position.x}px; top: {position.y}px;"
      transition:scale={{ duration: 250, easing: elasticOut, start: 0.5 }}
    >
      <!-- Center button -->
      <button
        class="wheel-center"
        class:has-action={centerAction !== null}
        class:hovered={hoveredIndex === -1 && centerAction}
        on:click={handleCenterClick}
        disabled={!centerAction || centerAction.disabled}
        aria-label={centerAction?.label || 'Close'}
      >
        {#if centerAction}
          <span class="center-icon">{centerAction.icon}</span>
          <span class="center-label">{centerAction.label}</span>
        {:else}
          <span class="center-close">✕</span>
        {/if}
      </button>

      <!-- Connecting lines -->
      <svg class="wheel-connections" viewBox="-200 -200 400 400">
        {#each itemPositions as pos, index}
          <line
            x1="0"
            y1="0"
            x2={pos.x}
            y2={pos.y}
            class="connection-line"
            class:hovered={hoveredIndex === index}
            style="--delay: {index * 30}ms"
          />
        {/each}
        <circle cx="0" cy="0" r={radius} class="wheel-ring" />
      </svg>

      <!-- Action items -->
      {#each actions as action, index}
        <button
          class="wheel-item"
          class:hovered={hoveredIndex === index}
          class:selected={selectedIndex === index}
          class:disabled={action.disabled}
          style={getItemStyle(index)}
          on:click={() => handleItemClick(index)}
          on:mouseenter={() => {
            if (!keyboardNavigation) hoveredIndex = index;
          }}
          disabled={action.disabled}
          aria-label="{action.label}{action.shortcut
            ? ` (${action.shortcut})`
            : ''}"
          data-index={index}
        >
          <span class="item-icon">{action.icon}</span>
          {#if action.shortcut}
            <span class="item-shortcut">{action.shortcut}</span>
          {/if}
        </button>
      {/each}

      <!-- Tooltip for hovered item -->
      {#if hoveredIndex >= 0}
        <div
          class="wheel-tooltip"
          style="--angle: {itemPositions[hoveredIndex].angle}deg"
          in:fade={{ duration: 100 }}
        >
          <span class="tooltip-label">{actions[hoveredIndex].label}</span>
          {#if actions[hoveredIndex].shortcut}
            <span class="tooltip-shortcut"
              >Press {actions[hoveredIndex].shortcut}</span
            >
          {/if}
        </div>
      {/if}

      <!-- Hotkey hint -->
      <div class="hotkey-hint">
        Press <kbd>{hotkey}</kbd> to toggle
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-actions-wheel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .quick-actions-wheel {
    position: absolute;
    width: 0;
    height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translate(-50%, -50%);
  }

  .wheel-connections {
    position: absolute;
    width: 400px;
    height: 400px;
    pointer-events: none;
    overflow: visible;
  }

  .connection-line {
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 1;
    transition:
      stroke 0.2s ease,
      stroke-width 0.2s ease;
    animation: drawLine 0.3s ease-out forwards;
    animation-delay: var(--delay);
    stroke-dasharray: 200;
    stroke-dashoffset: 200;
  }

  .connection-line.hovered {
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 2;
  }

  @keyframes drawLine {
    to {
      stroke-dashoffset: 0;
    }
  }

  .wheel-ring {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .wheel-center {
    position: absolute;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: linear-gradient(145deg, #1f2937, #111827);
    border: 2px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    z-index: 30;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .wheel-center:hover,
  .wheel-center.hovered {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .wheel-center:disabled {
    cursor: default;
  }

  .wheel-center.has-action {
    background: linear-gradient(145deg, #3b82f6, #2563eb);
  }

  .center-icon {
    font-size: 1.5rem;
  }

  .center-label {
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.8);
    margin-top: 2px;
  }

  .center-close {
    font-size: 1.25rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .wheel-item {
    position: absolute;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(145deg, #374151, #1f2937);
    border: 2px solid var(--item-color, #6b7280);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      0 0 0 0 var(--item-color);
    animation: popIn 0.3s ease-out backwards;
    animation-delay: calc(var(--index, 0) * 30ms);
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translate(var(--x, 0), var(--y, 0)) scale(0);
    }
  }

  .wheel-item:hover,
  .wheel-item.hovered {
    background: linear-gradient(145deg, var(--item-color), color-mix(in srgb, var(--item-color) 80%, black));
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.3),
      0 0 20px color-mix(in srgb, var(--item-color) 40%, transparent);
    border-color: white;
  }

  .wheel-item.selected {
    animation: pulse 0.3s ease-out;
  }

  @keyframes pulse {
    0% {
      transform: translate(var(--x), var(--y)) scale(1.15);
    }
    50% {
      transform: translate(var(--x), var(--y)) scale(1.3);
    }
    100% {
      transform: translate(var(--x), var(--y)) scale(0);
      opacity: 0;
    }
  }

  .wheel-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    filter: grayscale(0.8);
  }

  .item-icon {
    font-size: 1.5rem;
    transition: transform 0.2s ease;
  }

  .wheel-item:hover .item-icon,
  .wheel-item.hovered .item-icon {
    transform: scale(1.1);
  }

  .item-shortcut {
    position: absolute;
    bottom: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid var(--item-color);
    font-size: 0.65rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .wheel-tooltip {
    position: absolute;
    bottom: -100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 16px;
    text-align: center;
    white-space: nowrap;
    z-index: 40;
  }

  .tooltip-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
  }

  .tooltip-shortcut {
    display: block;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
  }

  .hotkey-hint {
    position: absolute;
    bottom: -140px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
  }

  .hotkey-hint kbd {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.7rem;
  }

  /* Dark mode adjustments */
  :global(.dark) .wheel-center {
    background: linear-gradient(145deg, #1f2937, #0f1419);
  }

  :global(.dark) .wheel-item {
    background: linear-gradient(145deg, #2d3748, #1a202c);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .wheel-item,
    .wheel-center,
    .connection-line {
      animation: none;
      transition: none;
    }
  }
</style>
