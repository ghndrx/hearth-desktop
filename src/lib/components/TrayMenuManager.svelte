<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { TrayIcon, type TrayIconEvent } from '@tauri-apps/api/tray';
  import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
  import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

  interface TrayMenuItem {
    id: string;
    label: string;
    icon?: string;
    shortcut?: string;
    enabled: boolean;
    visible: boolean;
    action: 'show' | 'hide' | 'toggle' | 'quit' | 'settings' | 'new-chat' | 'quick-note' | 'custom';
    customAction?: string;
  }

  interface TrayConfig {
    showOnClick: boolean;
    hideOnClose: boolean;
    tooltip: string;
    iconStyle: 'default' | 'minimal' | 'colorful';
    showUnreadBadge: boolean;
    quickActions: TrayMenuItem[];
  }

  // Props
  export let showSettings = true;
  export let compact = false;

  // State
  let config: TrayConfig = {
    showOnClick: true,
    hideOnClose: true,
    tooltip: 'Hearth Desktop',
    iconStyle: 'default',
    showUnreadBadge: true,
    quickActions: getDefaultQuickActions()
  };
  
  let trayIcon: TrayIcon | null = null;
  let isInitialized = false;
  let error: string | null = null;
  let editingItem: TrayMenuItem | null = null;
  let unlistenFns: UnlistenFn[] = [];
  let draggedIndex: number | null = null;

  function getDefaultQuickActions(): TrayMenuItem[] {
    return [
      { id: 'show', label: 'Show Hearth', icon: '👁️', enabled: true, visible: true, action: 'show' },
      { id: 'new-chat', label: 'New Chat', icon: '💬', shortcut: 'CmdOrCtrl+N', enabled: true, visible: true, action: 'new-chat' },
      { id: 'quick-note', label: 'Quick Note', icon: '📝', shortcut: 'CmdOrCtrl+Shift+N', enabled: true, visible: true, action: 'quick-note' },
      { id: 'settings', label: 'Settings', icon: '⚙️', shortcut: 'CmdOrCtrl+,', enabled: true, visible: true, action: 'settings' },
      { id: 'quit', label: 'Quit Hearth', icon: '🚪', shortcut: 'CmdOrCtrl+Q', enabled: true, visible: true, action: 'quit' }
    ];
  }

  async function loadConfig(): Promise<void> {
    try {
      const stored = await invoke<string | null>('get_setting', { key: 'tray_config' });
      if (stored) {
        const parsed = JSON.parse(stored);
        config = { ...config, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load tray config, using defaults:', e);
    }
  }

  async function saveConfig(): Promise<void> {
    try {
      await invoke('set_setting', { 
        key: 'tray_config', 
        value: JSON.stringify(config) 
      });
      await rebuildTrayMenu();
    } catch (e) {
      console.error('Failed to save tray config:', e);
      error = 'Failed to save settings';
    }
  }

  async function initTray(): Promise<void> {
    try {
      const iconPath = getIconPath(config.iconStyle);
      
      trayIcon = await TrayIcon.new({
        id: 'hearth-tray',
        icon: iconPath,
        tooltip: config.tooltip,
        iconAsTemplate: config.iconStyle === 'minimal',
        menuOnLeftClick: !config.showOnClick
      });

      await rebuildTrayMenu();
      
      // Listen for tray click events
      const clickUnlisten = await trayIcon.onAction((event: TrayIconEvent) => {
        if (config.showOnClick && event.type === 'click') {
          handleTrayAction('toggle');
        }
      });
      
      unlistenFns.push(clickUnlisten);
      isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize tray:', e);
      error = 'Failed to initialize system tray';
    }
  }

  function getIconPath(style: string): string {
    switch (style) {
      case 'minimal':
        return 'icons/tray-minimal.png';
      case 'colorful':
        return 'icons/tray-colorful.png';
      default:
        return 'icons/tray-default.png';
    }
  }

  async function rebuildTrayMenu(): Promise<void> {
    if (!trayIcon) return;

    try {
      const menuItems: (MenuItem | PredefinedMenuItem)[] = [];
      
      for (const item of config.quickActions) {
        if (!item.visible) continue;
        
        const menuItem = await MenuItem.new({
          id: item.id,
          text: item.icon ? `${item.icon} ${item.label}` : item.label,
          enabled: item.enabled,
          accelerator: item.shortcut,
          action: () => handleTrayAction(item.action, item.customAction)
        });
        
        menuItems.push(menuItem);
        
        // Add separator before quit
        if (item.id === 'settings') {
          const separator = await PredefinedMenuItem.new({ item: 'Separator' });
          menuItems.push(separator);
        }
      }

      const menu = await Menu.new({ items: menuItems });
      await trayIcon.setMenu(menu);
    } catch (e) {
      console.error('Failed to rebuild tray menu:', e);
    }
  }

  async function handleTrayAction(action: string, customAction?: string): Promise<void> {
    try {
      switch (action) {
        case 'show':
          await invoke('show_main_window');
          break;
        case 'hide':
          await invoke('hide_main_window');
          break;
        case 'toggle':
          await invoke('toggle_main_window');
          break;
        case 'quit':
          await invoke('quit_app');
          break;
        case 'settings':
          await emit('open-settings');
          await invoke('show_main_window');
          break;
        case 'new-chat':
          await emit('new-chat');
          await invoke('show_main_window');
          break;
        case 'quick-note':
          await emit('quick-note');
          break;
        case 'custom':
          if (customAction) {
            await emit('tray-custom-action', { action: customAction });
          }
          break;
      }
    } catch (e) {
      console.error('Tray action failed:', e);
    }
  }

  async function updateTooltip(): Promise<void> {
    if (trayIcon) {
      try {
        await trayIcon.setTooltip(config.tooltip);
      } catch (e) {
        console.error('Failed to update tooltip:', e);
      }
    }
  }

  async function updateIcon(): Promise<void> {
    if (trayIcon) {
      try {
        await trayIcon.setIcon(getIconPath(config.iconStyle));
        await trayIcon.setIconAsTemplate(config.iconStyle === 'minimal');
      } catch (e) {
        console.error('Failed to update icon:', e);
      }
    }
  }

  function addQuickAction(): void {
    const newItem: TrayMenuItem = {
      id: `custom-${Date.now()}`,
      label: 'New Action',
      enabled: true,
      visible: true,
      action: 'custom',
      customAction: ''
    };
    config.quickActions = [...config.quickActions.slice(0, -1), newItem, config.quickActions[config.quickActions.length - 1]];
    editingItem = newItem;
  }

  function removeQuickAction(id: string): void {
    config.quickActions = config.quickActions.filter(item => item.id !== id);
    saveConfig();
  }

  function toggleItemEnabled(id: string): void {
    config.quickActions = config.quickActions.map(item => 
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    saveConfig();
  }

  function toggleItemVisible(id: string): void {
    config.quickActions = config.quickActions.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    saveConfig();
  }

  function handleDragStart(index: number): void {
    draggedIndex = index;
  }

  function handleDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      const items = [...config.quickActions];
      const [removed] = items.splice(draggedIndex, 1);
      items.splice(index, 0, removed);
      config.quickActions = items;
      draggedIndex = index;
    }
  }

  function handleDragEnd(): void {
    draggedIndex = null;
    saveConfig();
  }

  function saveEditingItem(): void {
    if (editingItem) {
      config.quickActions = config.quickActions.map(item =>
        item.id === editingItem!.id ? editingItem! : item
      );
      editingItem = null;
      saveConfig();
    }
  }

  function cancelEdit(): void {
    editingItem = null;
  }

  async function resetToDefaults(): Promise<void> {
    config.quickActions = getDefaultQuickActions();
    await saveConfig();
  }

  onMount(async () => {
    await loadConfig();
    await initTray();
    
    // Listen for unread count changes
    const unreadUnlisten = await listen<number>('unread-count-changed', async (event) => {
      if (config.showUnreadBadge && trayIcon) {
        const count = event.payload;
        const tooltip = count > 0 
          ? `${config.tooltip} (${count} unread)` 
          : config.tooltip;
        await trayIcon.setTooltip(tooltip);
      }
    });
    unlistenFns.push(unreadUnlisten);
  });

  onDestroy(() => {
    unlistenFns.forEach(fn => fn());
    if (trayIcon) {
      trayIcon.close();
    }
  });
</script>

<div class="tray-manager" class:compact>
  {#if error}
    <div class="error-banner">
      <span class="error-icon">⚠️</span>
      <span>{error}</span>
      <button class="dismiss" on:click={() => error = null}>×</button>
    </div>
  {/if}

  {#if showSettings}
    <div class="section">
      <h3>System Tray Behavior</h3>
      
      <label class="setting-row">
        <span>Show window on tray click</span>
        <input 
          type="checkbox" 
          bind:checked={config.showOnClick}
          on:change={saveConfig}
        />
      </label>

      <label class="setting-row">
        <span>Hide to tray on close</span>
        <input 
          type="checkbox" 
          bind:checked={config.hideOnClose}
          on:change={saveConfig}
        />
      </label>

      <label class="setting-row">
        <span>Show unread badge</span>
        <input 
          type="checkbox" 
          bind:checked={config.showUnreadBadge}
          on:change={saveConfig}
        />
      </label>

      <div class="setting-row">
        <span>Tooltip text</span>
        <input 
          type="text"
          class="text-input"
          bind:value={config.tooltip}
          on:blur={() => { updateTooltip(); saveConfig(); }}
          placeholder="Hearth Desktop"
        />
      </div>

      <div class="setting-row">
        <span>Icon style</span>
        <select 
          bind:value={config.iconStyle}
          on:change={() => { updateIcon(); saveConfig(); }}
        >
          <option value="default">Default</option>
          <option value="minimal">Minimal (macOS)</option>
          <option value="colorful">Colorful</option>
        </select>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3>Quick Actions</h3>
        <button class="add-btn" on:click={addQuickAction}>
          + Add Action
        </button>
      </div>

      <p class="hint">Drag to reorder. These appear in the tray context menu.</p>

      <ul class="action-list">
        {#each config.quickActions as item, index (item.id)}
          <li 
            class="action-item"
            class:dragging={draggedIndex === index}
            class:disabled={!item.enabled}
            draggable="true"
            on:dragstart={() => handleDragStart(index)}
            on:dragover={(e) => handleDragOver(e, index)}
            on:dragend={handleDragEnd}
          >
            <span class="drag-handle">⠿</span>
            
            {#if editingItem?.id === item.id}
              <div class="edit-form">
                <input 
                  type="text" 
                  bind:value={editingItem.label}
                  placeholder="Label"
                  class="edit-input"
                />
                <input 
                  type="text"
                  bind:value={editingItem.icon}
                  placeholder="Icon (emoji)"
                  class="edit-input small"
                />
                <select bind:value={editingItem.action} class="edit-select">
                  <option value="show">Show Window</option>
                  <option value="hide">Hide Window</option>
                  <option value="toggle">Toggle Window</option>
                  <option value="new-chat">New Chat</option>
                  <option value="quick-note">Quick Note</option>
                  <option value="settings">Open Settings</option>
                  <option value="quit">Quit App</option>
                  <option value="custom">Custom Event</option>
                </select>
                {#if editingItem.action === 'custom'}
                  <input 
                    type="text"
                    bind:value={editingItem.customAction}
                    placeholder="Event name"
                    class="edit-input"
                  />
                {/if}
                <div class="edit-actions">
                  <button class="save-btn" on:click={saveEditingItem}>Save</button>
                  <button class="cancel-btn" on:click={cancelEdit}>Cancel</button>
                </div>
              </div>
            {:else}
              <span class="item-icon">{item.icon || '•'}</span>
              <span class="item-label">{item.label}</span>
              {#if item.shortcut}
                <span class="item-shortcut">{item.shortcut}</span>
              {/if}
              <div class="item-actions">
                <button 
                  class="icon-btn" 
                  title={item.visible ? 'Hide from menu' : 'Show in menu'}
                  on:click={() => toggleItemVisible(item.id)}
                >
                  {item.visible ? '👁️' : '👁️‍🗨️'}
                </button>
                <button 
                  class="icon-btn"
                  title={item.enabled ? 'Disable' : 'Enable'}
                  on:click={() => toggleItemEnabled(item.id)}
                >
                  {item.enabled ? '✓' : '✗'}
                </button>
                {#if item.action === 'custom'}
                  <button 
                    class="icon-btn"
                    title="Edit"
                    on:click={() => editingItem = { ...item }}
                  >
                    ✏️
                  </button>
                  <button 
                    class="icon-btn danger"
                    title="Remove"
                    on:click={() => removeQuickAction(item.id)}
                  >
                    🗑️
                  </button>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>

      <button class="reset-btn" on:click={resetToDefaults}>
        Reset to Defaults
      </button>
    </div>
  {/if}

  <div class="status" class:initialized={isInitialized}>
    <span class="status-dot"></span>
    <span>System tray {isInitialized ? 'active' : 'initializing...'}</span>
  </div>
</div>

<style>
  .tray-manager {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .tray-manager.compact {
    padding: 8px;
    gap: 12px;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: var(--color-error-bg, #fee);
    border: 1px solid var(--color-error, #d00);
    border-radius: 8px;
    color: var(--color-error, #d00);
  }

  .error-banner .dismiss {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: inherit;
  }

  .section {
    background: var(--color-surface, #2a2d35);
    border-radius: 12px;
    padding: 16px;
  }

  .section h3 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary, #fff);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .section-header h3 {
    margin: 0;
  }

  .hint {
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    margin: 0 0 12px 0;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border, #3a3d45);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-row span {
    font-size: 14px;
    color: var(--color-text-primary, #fff);
  }

  .setting-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .text-input {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #3a3d45);
    background: var(--color-bg, #1a1d25);
    color: var(--color-text-primary, #fff);
    font-size: 13px;
    width: 180px;
  }

  select {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #3a3d45);
    background: var(--color-bg, #1a1d25);
    color: var(--color-text-primary, #fff);
    font-size: 13px;
    cursor: pointer;
  }

  .add-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: var(--color-primary, #5865f2);
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: var(--color-primary-hover, #4752c4);
  }

  .action-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--color-bg, #1a1d25);
    border-radius: 8px;
    cursor: grab;
    transition: all 0.2s;
  }

  .action-item:hover {
    background: var(--color-bg-hover, #252830);
  }

  .action-item.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .action-item.disabled {
    opacity: 0.5;
  }

  .drag-handle {
    color: var(--color-text-secondary, #888);
    cursor: grab;
    user-select: none;
  }

  .item-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
  }

  .item-label {
    flex: 1;
    font-size: 14px;
    color: var(--color-text-primary, #fff);
  }

  .item-shortcut {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--color-surface, #2a2d35);
    border-radius: 4px;
    color: var(--color-text-secondary, #888);
    font-family: monospace;
  }

  .item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .action-item:hover .item-actions {
    opacity: 1;
  }

  .icon-btn {
    padding: 4px 6px;
    border-radius: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  }

  .icon-btn:hover {
    background: var(--color-surface, #2a2d35);
  }

  .icon-btn.danger:hover {
    background: var(--color-error-bg, #3d1515);
  }

  .edit-form {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .edit-input {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #3a3d45);
    background: var(--color-surface, #2a2d35);
    color: var(--color-text-primary, #fff);
    font-size: 13px;
    flex: 1;
    min-width: 100px;
  }

  .edit-input.small {
    max-width: 80px;
    flex: 0;
  }

  .edit-select {
    flex: 0;
    min-width: 120px;
  }

  .edit-actions {
    display: flex;
    gap: 6px;
  }

  .save-btn, .cancel-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .save-btn {
    background: var(--color-success, #3ba55c);
    color: white;
  }

  .save-btn:hover {
    background: var(--color-success-hover, #2d8049);
  }

  .cancel-btn {
    background: var(--color-surface, #2a2d35);
    color: var(--color-text-primary, #fff);
  }

  .cancel-btn:hover {
    background: var(--color-bg-hover, #353840);
  }

  .reset-btn {
    margin-top: 12px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #3a3d45);
    background: transparent;
    color: var(--color-text-secondary, #888);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-btn:hover {
    border-color: var(--color-error, #d00);
    color: var(--color-error, #d00);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--color-surface, #2a2d35);
    border-radius: 8px;
    font-size: 12px;
    color: var(--color-text-secondary, #888);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-warning, #faa61a);
    animation: pulse 1.5s infinite;
  }

  .status.initialized .status-dot {
    background: var(--color-success, #3ba55c);
    animation: none;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
