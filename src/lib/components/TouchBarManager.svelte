<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, get } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { platform } from '@tauri-apps/plugin-os';

  const dispatch = createEventDispatcher();

  // Touch Bar item types
  type TouchBarItemType = 'button' | 'label' | 'slider' | 'popover' | 'group' | 'spacer' | 'colorPicker' | 'scrubber';

  interface TouchBarButton {
    type: 'button';
    id: string;
    label?: string;
    icon?: string;
    iconPosition?: 'left' | 'right' | 'overlay';
    backgroundColor?: string;
    accessibilityLabel?: string;
    enabled?: boolean;
  }

  interface TouchBarLabel {
    type: 'label';
    id: string;
    label: string;
    textColor?: string;
    accessibilityLabel?: string;
  }

  interface TouchBarSlider {
    type: 'slider';
    id: string;
    label?: string;
    minValue: number;
    maxValue: number;
    value: number;
    accessibilityLabel?: string;
  }

  interface TouchBarSpacer {
    type: 'spacer';
    id: string;
    size: 'small' | 'large' | 'flexible';
  }

  interface TouchBarColorPicker {
    type: 'colorPicker';
    id: string;
    selectedColor?: string;
    accessibilityLabel?: string;
  }

  interface TouchBarScrubberItem {
    label?: string;
    icon?: string;
  }

  interface TouchBarScrubber {
    type: 'scrubber';
    id: string;
    items: TouchBarScrubberItem[];
    selectedIndex?: number;
    mode: 'fixed' | 'free';
    showArrowButtons?: boolean;
    accessibilityLabel?: string;
  }

  interface TouchBarGroup {
    type: 'group';
    id: string;
    items: TouchBarItem[];
  }

  interface TouchBarPopover {
    type: 'popover';
    id: string;
    label?: string;
    icon?: string;
    items: TouchBarItem[];
    showCloseButton?: boolean;
  }

  type TouchBarItem = 
    | TouchBarButton 
    | TouchBarLabel 
    | TouchBarSlider 
    | TouchBarSpacer 
    | TouchBarColorPicker 
    | TouchBarScrubber 
    | TouchBarGroup 
    | TouchBarPopover;

  interface TouchBarContext {
    id: string;
    name: string;
    items: TouchBarItem[];
    priority: number;
    escapeItem?: TouchBarItem;
    principalItem?: string; // ID of the principal item
  }

  interface TouchBarEvent {
    itemId: string;
    eventType: 'click' | 'valueChange' | 'colorChange' | 'scrubberSelect';
    value?: number | string;
    index?: number;
  }

  // Props
  export let enabled = true;
  export let defaultContext: TouchBarContext | null = null;
  export let customizationAllowed = true;
  export let showEscapeKey = true;

  // State
  const isMacOS = writable(false);
  const isSupported = writable(false);
  const contexts = writable<Map<string, TouchBarContext>>(new Map());
  const activeContextId = writable<string | null>(null);
  const contextStack = writable<string[]>([]);
  const isCustomizing = writable(false);
  const touchBarVisible = writable(true);
  const itemStates = writable<Map<string, Record<string, unknown>>>(new Map());

  // Derived stores
  const activeContext = derived(
    [contexts, activeContextId],
    ([$contexts, $activeContextId]) => {
      if (!$activeContextId) return null;
      return $contexts.get($activeContextId) || null;
    }
  );

  const sortedContexts = derived(
    contexts,
    ($contexts) => {
      return Array.from($contexts.values()).sort((a, b) => b.priority - a.priority);
    }
  );

  // Event listeners
  let unlistenFns: UnlistenFn[] = [];

  // Preset contexts
  const presetContexts: Record<string, () => TouchBarContext> = {
    chat: () => ({
      id: 'chat',
      name: 'Chat',
      priority: 100,
      items: [
        { type: 'button', id: 'emoji', icon: '😊', accessibilityLabel: 'Insert emoji' },
        { type: 'button', id: 'gif', icon: '🎬', accessibilityLabel: 'Insert GIF' },
        { type: 'button', id: 'attach', icon: '📎', accessibilityLabel: 'Attach file' },
        { type: 'spacer', id: 'spacer1', size: 'flexible' },
        { type: 'button', id: 'send', label: 'Send', backgroundColor: '#5865F2', accessibilityLabel: 'Send message' }
      ]
    }),
    voiceCall: () => ({
      id: 'voiceCall',
      name: 'Voice Call',
      priority: 200,
      items: [
        { type: 'button', id: 'mute', icon: '🔇', accessibilityLabel: 'Toggle mute' },
        { type: 'button', id: 'deafen', icon: '🔈', accessibilityLabel: 'Toggle deafen' },
        { type: 'spacer', id: 'spacer1', size: 'small' },
        { type: 'slider', id: 'volume', label: 'Volume', minValue: 0, maxValue: 100, value: 80, accessibilityLabel: 'Adjust volume' },
        { type: 'spacer', id: 'spacer2', size: 'flexible' },
        { type: 'button', id: 'screenshare', icon: '🖥️', accessibilityLabel: 'Share screen' },
        { type: 'button', id: 'video', icon: '📹', accessibilityLabel: 'Toggle video' },
        { type: 'spacer', id: 'spacer3', size: 'small' },
        { type: 'button', id: 'endCall', label: 'End', backgroundColor: '#ED4245', accessibilityLabel: 'End call' }
      ]
    }),
    mediaPlayer: () => ({
      id: 'mediaPlayer',
      name: 'Media Player',
      priority: 150,
      items: [
        { type: 'button', id: 'prev', icon: '⏮️', accessibilityLabel: 'Previous track' },
        { type: 'button', id: 'playPause', icon: '⏯️', accessibilityLabel: 'Play or pause' },
        { type: 'button', id: 'next', icon: '⏭️', accessibilityLabel: 'Next track' },
        { type: 'spacer', id: 'spacer1', size: 'small' },
        { type: 'slider', id: 'progress', minValue: 0, maxValue: 100, value: 0, accessibilityLabel: 'Playback progress' },
        { type: 'spacer', id: 'spacer2', size: 'flexible' },
        { type: 'slider', id: 'volume', label: '🔊', minValue: 0, maxValue: 100, value: 80, accessibilityLabel: 'Volume' }
      ]
    }),
    navigation: () => ({
      id: 'navigation',
      name: 'Navigation',
      priority: 50,
      items: [
        { type: 'button', id: 'home', icon: '🏠', accessibilityLabel: 'Go to home' },
        { type: 'button', id: 'search', icon: '🔍', accessibilityLabel: 'Search' },
        { type: 'button', id: 'quickSwitcher', icon: '⌘K', accessibilityLabel: 'Quick switcher' },
        { type: 'spacer', id: 'spacer1', size: 'flexible' },
        {
          type: 'scrubber',
          id: 'servers',
          items: [],
          mode: 'free',
          showArrowButtons: true,
          accessibilityLabel: 'Server list'
        }
      ]
    }),
    formatting: () => ({
      id: 'formatting',
      name: 'Text Formatting',
      priority: 90,
      items: [
        { type: 'button', id: 'bold', label: 'B', accessibilityLabel: 'Bold' },
        { type: 'button', id: 'italic', label: 'I', accessibilityLabel: 'Italic' },
        { type: 'button', id: 'underline', label: 'U', accessibilityLabel: 'Underline' },
        { type: 'button', id: 'strikethrough', label: 'S', accessibilityLabel: 'Strikethrough' },
        { type: 'spacer', id: 'spacer1', size: 'small' },
        { type: 'button', id: 'code', label: '</>', accessibilityLabel: 'Code' },
        { type: 'button', id: 'codeBlock', label: '```', accessibilityLabel: 'Code block' },
        { type: 'spacer', id: 'spacer2', size: 'small' },
        { type: 'button', id: 'link', icon: '🔗', accessibilityLabel: 'Insert link' },
        { type: 'button', id: 'spoiler', label: '|||', accessibilityLabel: 'Spoiler' }
      ]
    })
  };

  // Initialize Touch Bar support
  async function initialize(): Promise<void> {
    try {
      const os = await platform();
      isMacOS.set(os === 'macos');

      if (!get(isMacOS)) {
        console.log('Touch Bar: Not on macOS, skipping initialization');
        return;
      }

      // Check if Touch Bar is supported
      const supported = await invoke<boolean>('touchbar_is_supported').catch(() => false);
      isSupported.set(supported);

      if (!supported) {
        console.log('Touch Bar: Not supported on this device');
        return;
      }

      // Set up event listeners
      const unlistenClick = await listen<TouchBarEvent>('touchbar:item-click', (event) => {
        handleTouchBarEvent(event.payload);
      });
      unlistenFns.push(unlistenClick);

      const unlistenValueChange = await listen<TouchBarEvent>('touchbar:value-change', (event) => {
        handleTouchBarEvent(event.payload);
      });
      unlistenFns.push(unlistenValueChange);

      const unlistenCustomize = await listen('touchbar:customize-start', () => {
        isCustomizing.set(true);
        dispatch('customizeStart');
      });
      unlistenFns.push(unlistenCustomize);

      const unlistenCustomizeEnd = await listen('touchbar:customize-end', () => {
        isCustomizing.set(false);
        dispatch('customizeEnd');
      });
      unlistenFns.push(unlistenCustomizeEnd);

      // Load saved configuration
      await loadConfiguration();

      // Set default context if provided
      if (defaultContext) {
        registerContext(defaultContext);
        activateContext(defaultContext.id);
      }

      console.log('Touch Bar: Initialized successfully');
      dispatch('initialized', { supported: true });
    } catch (error) {
      console.error('Touch Bar: Initialization failed:', error);
      dispatch('error', { error });
    }
  }

  // Handle Touch Bar events
  function handleTouchBarEvent(event: TouchBarEvent): void {
    const { itemId, eventType, value, index } = event;

    // Update item state
    const states = get(itemStates);
    const currentState = states.get(itemId) || {};

    if (eventType === 'valueChange' && value !== undefined) {
      currentState.value = value;
    } else if (eventType === 'colorChange' && value !== undefined) {
      currentState.selectedColor = value;
    } else if (eventType === 'scrubberSelect' && index !== undefined) {
      currentState.selectedIndex = index;
    }

    states.set(itemId, currentState);
    itemStates.set(states);

    // Dispatch event
    dispatch('itemAction', {
      itemId,
      eventType,
      value,
      index,
      context: get(activeContextId)
    });
  }

  // Register a Touch Bar context
  export function registerContext(context: TouchBarContext): void {
    const currentContexts = get(contexts);
    currentContexts.set(context.id, context);
    contexts.set(currentContexts);
    dispatch('contextRegistered', { contextId: context.id });
  }

  // Unregister a Touch Bar context
  export function unregisterContext(contextId: string): void {
    const currentContexts = get(contexts);
    currentContexts.delete(contextId);
    contexts.set(currentContexts);

    // If this was the active context, activate the next highest priority one
    if (get(activeContextId) === contextId) {
      const sorted = get(sortedContexts);
      if (sorted.length > 0) {
        activateContext(sorted[0].id);
      } else {
        activeContextId.set(null);
        updateTouchBar();
      }
    }

    dispatch('contextUnregistered', { contextId });
  }

  // Activate a context
  export async function activateContext(contextId: string): Promise<void> {
    if (!get(isSupported) || !enabled) return;

    const context = get(contexts).get(contextId);
    if (!context) {
      console.warn(`Touch Bar: Context '${contextId}' not found`);
      return;
    }

    // Push current context to stack
    const currentId = get(activeContextId);
    if (currentId && currentId !== contextId) {
      const stack = get(contextStack);
      stack.push(currentId);
      contextStack.set(stack);
    }

    activeContextId.set(contextId);
    await updateTouchBar();
    dispatch('contextActivated', { contextId });
  }

  // Pop and return to previous context
  export async function popContext(): Promise<void> {
    const stack = get(contextStack);
    if (stack.length === 0) return;

    const previousContextId = stack.pop();
    contextStack.set(stack);

    if (previousContextId) {
      activeContextId.set(previousContextId);
      await updateTouchBar();
      dispatch('contextPopped', { contextId: previousContextId });
    }
  }

  // Update Touch Bar with current context
  async function updateTouchBar(): Promise<void> {
    if (!get(isSupported) || !enabled) return;

    const context = get(activeContext);
    if (!context) {
      // Clear Touch Bar
      await invoke('touchbar_clear').catch(console.error);
      return;
    }

    try {
      await invoke('touchbar_set_items', {
        items: context.items,
        escapeItem: context.escapeItem,
        principalItemId: context.principalItem,
        customizationAllowed,
        showEscapeKey
      });
    } catch (error) {
      console.error('Touch Bar: Failed to update:', error);
    }
  }

  // Update a single item
  export async function updateItem(itemId: string, updates: Partial<TouchBarItem>): Promise<void> {
    if (!get(isSupported) || !enabled) return;

    const context = get(activeContext);
    if (!context) return;

    // Find and update the item
    const updateItems = (items: TouchBarItem[]): boolean => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === itemId) {
          items[i] = { ...items[i], ...updates } as TouchBarItem;
          return true;
        }
        if (items[i].type === 'group' || items[i].type === 'popover') {
          const nested = (items[i] as TouchBarGroup | TouchBarPopover).items;
          if (updateItems(nested)) return true;
        }
      }
      return false;
    };

    if (updateItems(context.items)) {
      const currentContexts = get(contexts);
      currentContexts.set(context.id, context);
      contexts.set(currentContexts);
      await updateTouchBar();
    }
  }

  // Set slider value
  export async function setSliderValue(itemId: string, value: number): Promise<void> {
    if (!get(isSupported) || !enabled) return;

    try {
      await invoke('touchbar_set_slider_value', { itemId, value });

      const states = get(itemStates);
      const currentState = states.get(itemId) || {};
      currentState.value = value;
      states.set(itemId, currentState);
      itemStates.set(states);
    } catch (error) {
      console.error('Touch Bar: Failed to set slider value:', error);
    }
  }

  // Set label text
  export async function setLabelText(itemId: string, text: string): Promise<void> {
    await updateItem(itemId, { label: text } as Partial<TouchBarLabel>);
  }

  // Enable/disable item
  export async function setItemEnabled(itemId: string, itemEnabled: boolean): Promise<void> {
    await updateItem(itemId, { enabled: itemEnabled } as Partial<TouchBarButton>);
  }

  // Update scrubber items
  export async function updateScrubberItems(itemId: string, items: TouchBarScrubberItem[]): Promise<void> {
    await updateItem(itemId, { items } as Partial<TouchBarScrubber>);
  }

  // Load a preset context
  export function loadPreset(presetId: keyof typeof presetContexts): TouchBarContext {
    const preset = presetContexts[presetId];
    if (!preset) {
      throw new Error(`Touch Bar: Unknown preset '${presetId}'`);
    }
    return preset();
  }

  // Register and activate a preset
  export async function usePreset(presetId: keyof typeof presetContexts): Promise<void> {
    const context = loadPreset(presetId);
    registerContext(context);
    await activateContext(context.id);
  }

  // Show/hide Touch Bar
  export async function setVisible(visible: boolean): Promise<void> {
    if (!get(isSupported)) return;

    touchBarVisible.set(visible);

    try {
      if (visible) {
        await updateTouchBar();
      } else {
        await invoke('touchbar_clear');
      }
    } catch (error) {
      console.error('Touch Bar: Failed to set visibility:', error);
    }
  }

  // Enter customization mode
  export async function enterCustomizationMode(): Promise<void> {
    if (!get(isSupported) || !customizationAllowed) return;

    try {
      await invoke('touchbar_enter_customization');
    } catch (error) {
      console.error('Touch Bar: Failed to enter customization mode:', error);
    }
  }

  // Save current configuration
  async function saveConfiguration(): Promise<void> {
    const config = {
      contexts: Array.from(get(contexts).entries()),
      activeContextId: get(activeContextId),
      itemStates: Array.from(get(itemStates).entries())
    };

    try {
      await invoke('touchbar_save_config', { config: JSON.stringify(config) });
    } catch (error) {
      console.error('Touch Bar: Failed to save configuration:', error);
    }
  }

  // Load saved configuration
  async function loadConfiguration(): Promise<void> {
    try {
      const configStr = await invoke<string>('touchbar_load_config');
      if (!configStr) return;

      const config = JSON.parse(configStr);

      if (config.contexts) {
        contexts.set(new Map(config.contexts));
      }

      if (config.itemStates) {
        itemStates.set(new Map(config.itemStates));
      }

      // Don't restore active context here - let the app decide
    } catch (error) {
      // No saved config or parse error - that's fine
      console.log('Touch Bar: No saved configuration found');
    }
  }

  // Get available presets
  export function getAvailablePresets(): string[] {
    return Object.keys(presetContexts);
  }

  // Get current item state
  export function getItemState(itemId: string): Record<string, unknown> | undefined {
    return get(itemStates).get(itemId);
  }

  // Clean up
  async function cleanup(): Promise<void> {
    // Save configuration before cleanup
    if (get(isSupported)) {
      await saveConfiguration();
      await invoke('touchbar_clear').catch(() => {});
    }

    // Unsubscribe from events
    for (const unlisten of unlistenFns) {
      unlisten();
    }
    unlistenFns = [];
  }

  // Lifecycle
  onMount(() => {
    initialize();
  });

  onDestroy(() => {
    cleanup();
  });

  // React to enabled prop changes
  $: if (get(isSupported)) {
    if (enabled && get(touchBarVisible)) {
      updateTouchBar();
    } else {
      invoke('touchbar_clear').catch(() => {});
    }
  }
</script>

<!-- Touch Bar Manager is headless - no visual UI -->
<!-- All configuration happens through props and methods -->

{#if $isMacOS && $isSupported}
  <slot
    supported={$isSupported}
    activeContext={$activeContext}
    isCustomizing={$isCustomizing}
    contexts={$sortedContexts}
    {registerContext}
    {unregisterContext}
    {activateContext}
    {popContext}
    {updateItem}
    {setSliderValue}
    {setLabelText}
    {setItemEnabled}
    {updateScrubberItems}
    {usePreset}
    {loadPreset}
    {setVisible}
    {enterCustomizationMode}
    {getAvailablePresets}
    {getItemState}
  />
{:else}
  <slot
    supported={false}
    activeContext={null}
    isCustomizing={false}
    contexts={[]}
    registerContext={() => {}}
    unregisterContext={() => {}}
    activateContext={async () => {}}
    popContext={async () => {}}
    updateItem={async () => {}}
    setSliderValue={async () => {}}
    setLabelText={async () => {}}
    setItemEnabled={async () => {}}
    updateScrubberItems={async () => {}}
    usePreset={async () => {}}
    loadPreset={() => ({ id: '', name: '', items: [], priority: 0 })}
    setVisible={async () => {}}
    enterCustomizationMode={async () => {}}
    getAvailablePresets={() => []}
    getItemState={() => undefined}
  />
{/if}
</script>
