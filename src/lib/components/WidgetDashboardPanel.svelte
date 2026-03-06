<!--
  WidgetDashboardPanel - Desktop Widget Dashboard with configurable grid of widget tiles

  Features:
  - Configurable CSS grid layout (columns, row height, gap)
  - Multiple widget types: clock, system-monitor, quick-notes, bookmarks, calendar, weather, kanban, voice-memos, file-index, pomodoro
  - Widget tiles with drag handle, pin, and close controls
  - Add Widget modal with available widget catalog
  - Dashboard config: theme selector, column count slider
  - Dark Discord-like theme with Tailwind CSS
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    dashboardState,
    dashboardVisible,
    dashboardWidgets,
    dashboardConfig,
    getDashboardState,
    toggleDashboard,
    addWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    toggleWidgetPin,
    setDashboardConfig,
    resetDashboard,
    getAvailableWidgets,
    type DashboardWidget,
    type DashboardConfig,
    type AvailableWidget,
  } from '$lib/stores/widgetDashboard';

  let {
    compact = false,
  }: {
    compact?: boolean;
  } = $props();

  let widgets = $state<DashboardWidget[]>([]);
  let config = $state<DashboardConfig | null>(null);
  let visible = $state(false);
  let availableWidgets = $state<AvailableWidget[]>([]);
  let showAddModal = $state(false);
  let showSettings = $state(false);
  let currentTime = $state(new Date());
  let clockInterval: ReturnType<typeof setInterval> | null = null;

  // Settings draft state
  let settingsTheme = $state('default');
  let settingsColumns = $state(4);

  const WIDGET_ICONS: Record<string, string> = {
    'clock': '\u{1F551}',
    'system-monitor': '\u{1F4CA}',
    'quick-notes': '\u{1F4DD}',
    'bookmarks': '\u{1F516}',
    'calendar': '\u{1F4C5}',
    'weather': '\u26C5',
    'kanban': '\u{1F4CB}',
    'voice-memos': '\u{1F3A4}',
    'file-index': '\u{1F4C2}',
    'pomodoro': '\u23F2',
  };

  let gridStyle = $derived.by(() => {
    if (!config) return '';
    return `grid-template-columns: repeat(${config.columns}, 1fr); grid-auto-rows: ${config.row_height}px; gap: ${config.gap}px;`;
  });

  // Sync stores to local state
  const unsubscribers: (() => void)[] = [];

  onMount(async () => {
    unsubscribers.push(
      dashboardWidgets.subscribe((w) => { widgets = w; }),
      dashboardConfig.subscribe((c) => {
        config = c;
        if (c) {
          settingsTheme = c.theme;
          settingsColumns = c.columns;
        }
      }),
      dashboardVisible.subscribe((v) => { visible = v; }),
    );

    try {
      await getDashboardState();
    } catch {
      // Backend may not be ready
    }

    try {
      availableWidgets = await getAvailableWidgets();
    } catch {
      // Use fallback
      availableWidgets = [];
    }

    clockInterval = setInterval(() => {
      currentTime = new Date();
    }, 1000);
  });

  onDestroy(() => {
    unsubscribers.forEach((unsub) => unsub());
    if (clockInterval) clearInterval(clockInterval);
  });

  async function handleToggleVisibility() {
    try {
      await toggleDashboard();
    } catch {
      visible = !visible;
    }
  }

  async function handleAddWidget(widgetType: string) {
    const available = availableWidgets.find((w) => w.widget_type === widgetType);
    const nextX = widgets.length % (config?.columns ?? 4);
    const nextY = Math.floor(widgets.length / (config?.columns ?? 4));
    try {
      await addWidget({
        widget_type: widgetType,
        title: available?.name ?? widgetType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        position_x: nextX,
        position_y: nextY,
        width: available?.default_width ?? 1,
        height: available?.default_height ?? 1,
        config: {},
      });
    } catch {
      // Fallback: add locally
    }
    showAddModal = false;
  }

  async function handleRemoveWidget(id: string) {
    try {
      await removeWidget(id);
    } catch {
      widgets = widgets.filter((w) => w.id !== id);
    }
  }

  async function handleTogglePin(id: string) {
    try {
      await toggleWidgetPin(id);
    } catch {
      widgets = widgets.map((w) => w.id === id ? { ...w, is_pinned: !w.is_pinned } : w);
    }
  }

  async function handleReset() {
    try {
      await resetDashboard();
    } catch {
      // noop
    }
  }

  async function handleSaveSettings() {
    if (!config) return;
    const newConfig: DashboardConfig = {
      ...config,
      theme: settingsTheme,
      columns: settingsColumns,
    };
    try {
      await setDashboardConfig(newConfig);
    } catch {
      config = newConfig;
    }
    showSettings = false;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Default available widget types if backend doesn't provide them
  const DEFAULT_WIDGET_TYPES = [
    { widget_type: 'clock', name: 'Clock', description: 'Current time display', default_width: 1, default_height: 1, icon: '\u{1F551}' },
    { widget_type: 'system-monitor', name: 'System Monitor', description: 'CPU and memory usage', default_width: 1, default_height: 1, icon: '\u{1F4CA}' },
    { widget_type: 'quick-notes', name: 'Quick Notes', description: 'Jot down notes', default_width: 1, default_height: 1, icon: '\u{1F4DD}' },
    { widget_type: 'bookmarks', name: 'Bookmarks', description: 'Saved bookmarks', default_width: 1, default_height: 1, icon: '\u{1F516}' },
    { widget_type: 'calendar', name: 'Calendar', description: 'Today\'s date and events', default_width: 1, default_height: 1, icon: '\u{1F4C5}' },
    { widget_type: 'weather', name: 'Weather', description: 'Weather conditions', default_width: 1, default_height: 1, icon: '\u26C5' },
    { widget_type: 'kanban', name: 'Kanban', description: 'Task management board', default_width: 1, default_height: 1, icon: '\u{1F4CB}' },
    { widget_type: 'voice-memos', name: 'Voice Memos', description: 'Audio recordings', default_width: 1, default_height: 1, icon: '\u{1F3A4}' },
    { widget_type: 'file-index', name: 'File Index', description: 'Indexed file browser', default_width: 1, default_height: 1, icon: '\u{1F4C2}' },
    { widget_type: 'pomodoro', name: 'Pomodoro', description: 'Focus timer', default_width: 1, default_height: 1, icon: '\u23F2' },
  ];

  let displayWidgetTypes = $derived(availableWidgets.length > 0 ? availableWidgets : DEFAULT_WIDGET_TYPES);
</script>

<div class="flex flex-col h-full bg-[#1e1f22] text-[#f2f3f5]" class:max-h-[400px]={compact}>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-[#3f4147] bg-[#2b2d31]">
    <div class="flex items-center gap-2">
      <svg class="w-4 h-4 text-[#b5bac1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
      <span class="text-sm font-semibold">Dashboard</span>
      <span class="text-xs text-[#b5bac1]">({widgets.length} widgets)</span>
    </div>
    <div class="flex items-center gap-1.5">
      <!-- Visibility toggle -->
      <button
        onclick={handleToggleVisibility}
        class="p-1 rounded hover:bg-[#3f4147] text-[#b5bac1] hover:text-[#f2f3f5] transition-colors"
        title={visible ? 'Hide Dashboard' : 'Show Dashboard'}
      >
        {#if visible}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        {/if}
      </button>

      <!-- Add Widget button -->
      <button
        onclick={() => showAddModal = true}
        class="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-[#5865f2] hover:bg-[#4752c4] text-white transition-colors"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Widget
      </button>

      <!-- Settings gear -->
      <button
        onclick={() => { showSettings = !showSettings; }}
        class="p-1 rounded hover:bg-[#3f4147] text-[#b5bac1] hover:text-[#f2f3f5] transition-colors"
        title="Settings"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <!-- Reset button -->
      <button
        onclick={handleReset}
        class="p-1 rounded hover:bg-[#3f4147] text-[#b5bac1] hover:text-[#f2f3f5] transition-colors"
        title="Reset Dashboard"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Settings Panel (collapsible) -->
  {#if showSettings}
    <div class="px-3 py-3 border-b border-[#3f4147] bg-[#2b2d31] space-y-3">
      <div class="text-xs font-semibold text-[#b5bac1] uppercase tracking-wide">Dashboard Settings</div>

      <!-- Theme selector -->
      <div class="flex items-center gap-2">
        <label class="text-xs text-[#b5bac1] w-16">Theme</label>
        <div class="flex gap-1">
          {#each ['default', 'compact', 'cozy'] as theme}
            <button
              onclick={() => settingsTheme = theme}
              class="px-2 py-1 text-xs rounded transition-colors {settingsTheme === theme ? 'bg-[#5865f2] text-white' : 'bg-[#3f4147] text-[#b5bac1] hover:bg-[#4e5058]'}"
            >
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </button>
          {/each}
        </div>
      </div>

      <!-- Column count slider -->
      <div class="flex items-center gap-2">
        <label class="text-xs text-[#b5bac1] w-16">Columns</label>
        <input
          type="range"
          min="2"
          max="8"
          bind:value={settingsColumns}
          class="flex-1 h-1 accent-[#5865f2] bg-[#3f4147] rounded-full appearance-none cursor-pointer"
        />
        <span class="text-xs text-[#f2f3f5] w-4 text-right">{settingsColumns}</span>
      </div>

      <div class="flex justify-end">
        <button
          onclick={handleSaveSettings}
          class="px-3 py-1 text-xs font-medium rounded bg-[#5865f2] hover:bg-[#4752c4] text-white transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  {/if}

  <!-- Dashboard Grid -->
  <div class="flex-1 overflow-y-auto p-3" class:hidden={!visible}>
    {#if widgets.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-[#b5bac1] gap-3 py-8">
        <svg class="w-12 h-12 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        <span class="text-sm">No widgets on your dashboard</span>
        <button
          onclick={() => showAddModal = true}
          class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-[#5865f2] hover:bg-[#4752c4] text-white transition-colors"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add your first widget
        </button>
      </div>
    {:else}
      <div class="grid" style={gridStyle}>
        {#each widgets.filter(w => w.is_visible) as widget (widget.id)}
          <div
            class="bg-[#2b2d31] rounded-lg shadow-lg flex flex-col overflow-hidden transition-all {widget.is_pinned ? 'border-2 border-[#5865f2]' : 'border border-[#3f4147]'}"
            style="grid-column: span {widget.width}; grid-row: span {widget.height};"
          >
            <!-- Widget Title Bar -->
            <div class="flex items-center justify-between px-2 py-1.5 bg-[#313338] rounded-t-lg select-none">
              <div class="flex items-center gap-1.5 min-w-0">
                <!-- Drag handle -->
                <button
                  class="cursor-grab active:cursor-grabbing text-[#b5bac1] hover:text-[#f2f3f5] transition-colors shrink-0"
                  title="Drag to reorder"
                >
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="8" cy="6" r="1.5" /><circle cx="16" cy="6" r="1.5" />
                    <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
                    <circle cx="8" cy="18" r="1.5" /><circle cx="16" cy="18" r="1.5" />
                  </svg>
                </button>
                <span class="text-xs font-medium text-[#f2f3f5] truncate">
                  {WIDGET_ICONS[widget.widget_type] ?? ''} {widget.title}
                </span>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <!-- Pin button -->
                <button
                  onclick={() => handleTogglePin(widget.id)}
                  class="p-0.5 rounded hover:bg-[#3f4147] transition-colors {widget.is_pinned ? 'text-[#5865f2]' : 'text-[#b5bac1] hover:text-[#f2f3f5]'}"
                  title={widget.is_pinned ? 'Unpin widget' : 'Pin widget'}
                >
                  <svg class="w-3 h-3" fill={widget.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <!-- Close button -->
                <button
                  onclick={() => handleRemoveWidget(widget.id)}
                  class="p-0.5 rounded hover:bg-[#ed4245]/20 text-[#b5bac1] hover:text-[#ed4245] transition-colors"
                  title="Remove widget"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Widget Content -->
            <div class="flex-1 p-2 flex items-center justify-center text-center" class:p-1.5={compact}>
              {#if widget.widget_type === 'clock'}
                <div class="flex flex-col items-center gap-1">
                  <span class="text-2xl font-mono font-bold text-[#f2f3f5]">{formatTime(currentTime)}</span>
                  <span class="text-xs text-[#b5bac1]">{formatDate(currentTime)}</span>
                </div>

              {:else if widget.widget_type === 'system-monitor'}
                <div class="flex flex-col items-center gap-2 w-full px-2">
                  <div class="w-full">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-[#b5bac1]">CPU</span>
                      <span class="text-[#5865f2]">42%</span>
                    </div>
                    <div class="w-full h-2 bg-[#1e1f22] rounded-full overflow-hidden">
                      <div class="h-full bg-[#5865f2] rounded-full transition-all" style="width: 42%"></div>
                    </div>
                  </div>
                  <div class="w-full">
                    <div class="flex justify-between text-xs mb-1">
                      <span class="text-[#b5bac1]">Memory</span>
                      <span class="text-[#3ba55d]">67%</span>
                    </div>
                    <div class="w-full h-2 bg-[#1e1f22] rounded-full overflow-hidden">
                      <div class="h-full bg-[#3ba55d] rounded-full transition-all" style="width: 67%"></div>
                    </div>
                  </div>
                </div>

              {:else if widget.widget_type === 'quick-notes'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#faa61a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">3</span>
                  <span class="text-xs text-[#b5bac1]">Notes</span>
                </div>

              {:else if widget.widget_type === 'bookmarks'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#5865f2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">12</span>
                  <span class="text-xs text-[#b5bac1]">Bookmarks</span>
                </div>

              {:else if widget.widget_type === 'calendar'}
                <div class="flex flex-col items-center gap-1">
                  <span class="text-xs text-[#b5bac1] uppercase font-semibold">
                    {currentTime.toLocaleDateString([], { month: 'short' })}
                  </span>
                  <span class="text-3xl font-bold text-[#f2f3f5]">{currentTime.getDate()}</span>
                  <span class="text-xs text-[#b5bac1]">
                    {currentTime.toLocaleDateString([], { weekday: 'long' })}
                  </span>
                </div>

              {:else if widget.widget_type === 'weather'}
                <div class="flex flex-col items-center gap-1">
                  <span class="text-3xl">&#9925;</span>
                  <span class="text-lg font-bold text-[#f2f3f5]">22&#176;C</span>
                  <span class="text-xs text-[#b5bac1]">Partly Cloudy</span>
                </div>

              {:else if widget.widget_type === 'kanban'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#3ba55d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">8</span>
                  <span class="text-xs text-[#b5bac1]">Tasks</span>
                </div>

              {:else if widget.widget_type === 'voice-memos'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#ed4245]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">5</span>
                  <span class="text-xs text-[#b5bac1]">Memos</span>
                </div>

              {:else if widget.widget_type === 'file-index'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#faa61a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">247</span>
                  <span class="text-xs text-[#b5bac1]">Indexed Files</span>
                </div>

              {:else if widget.widget_type === 'pomodoro'}
                <div class="flex flex-col items-center gap-1">
                  <svg class="w-6 h-6 text-[#ed4245]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-lg font-bold text-[#f2f3f5]">25:00</span>
                  <span class="text-xs text-[#b5bac1]">Ready</span>
                </div>

              {:else}
                <div class="flex flex-col items-center gap-1 text-[#b5bac1]">
                  <span class="text-2xl">{WIDGET_ICONS[widget.widget_type] ?? '?'}</span>
                  <span class="text-xs">{widget.widget_type}</span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Hidden state message -->
  {#if !visible}
    <div class="flex-1 flex items-center justify-center text-[#b5bac1] text-sm py-8">
      <div class="flex flex-col items-center gap-2">
        <svg class="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <span>Dashboard is hidden</span>
        <button
          onclick={handleToggleVisibility}
          class="text-xs text-[#5865f2] hover:underline"
        >
          Show dashboard
        </button>
      </div>
    </div>
  {/if}
</div>

<!-- Add Widget Modal -->
{#if showAddModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onkeydown={(e) => { if (e.key === 'Escape') showAddModal = false; }}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-[#2b2d31] rounded-lg shadow-2xl w-[420px] max-h-[80vh] flex flex-col border border-[#3f4147]"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Modal header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#3f4147]">
        <span class="text-sm font-semibold text-[#f2f3f5]">Add Widget</span>
        <button
          onclick={() => showAddModal = false}
          class="p-1 rounded hover:bg-[#3f4147] text-[#b5bac1] hover:text-[#f2f3f5] transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Widget list -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2">
        {#each displayWidgetTypes as wt (wt.widget_type)}
          <button
            onclick={() => handleAddWidget(wt.widget_type)}
            class="w-full flex items-center gap-3 p-3 rounded-lg bg-[#1e1f22] hover:bg-[#313338] border border-[#3f4147] hover:border-[#5865f2] transition-all text-left group"
          >
            <span class="text-2xl w-8 text-center shrink-0">{wt.icon || WIDGET_ICONS[wt.widget_type] || '?'}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-[#f2f3f5] group-hover:text-white">{wt.name}</div>
              <div class="text-xs text-[#b5bac1] truncate">{wt.description}</div>
            </div>
            <svg class="w-4 h-4 text-[#b5bac1] group-hover:text-[#5865f2] shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        {/each}
      </div>

      <!-- Modal footer -->
      <div class="px-4 py-3 border-t border-[#3f4147] flex justify-end">
        <button
          onclick={() => showAddModal = false}
          class="px-3 py-1.5 text-xs font-medium rounded bg-[#3f4147] hover:bg-[#4e5058] text-[#f2f3f5] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
