<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Types
  interface AutoReplyRule {
    id: string;
    name: string;
    message: string;
    trigger: 'away' | 'dnd' | 'focus' | 'offline' | 'custom';
    customCondition?: string;
    enabled: boolean;
    delay: number; // seconds before sending
    oncePerContact: boolean;
    excludeContacts: string[];
    includeContacts: string[]; // empty = all
    schedule?: {
      enabled: boolean;
      startTime: string; // HH:MM
      endTime: string;
      days: number[]; // 0-6, Sunday-Saturday
    };
    expiresAt?: string; // ISO date string
    createdAt: string;
    lastTriggered?: string;
    triggerCount: number;
  }

  interface AutoReplyLog {
    id: string;
    ruleId: string;
    ruleName: string;
    contactId: string;
    contactName: string;
    message: string;
    sentAt: string;
  }

  // State
  let rules: AutoReplyRule[] = [];
  let logs: AutoReplyLog[] = [];
  let isOpen = false;
  let activeTab: 'rules' | 'logs' | 'settings' = 'rules';
  let editingRule: AutoReplyRule | null = null;
  let searchQuery = '';
  let currentStatus: 'online' | 'away' | 'dnd' | 'offline' = 'online';
  let globalEnabled = true;
  let maxLogEntries = 100;
  let repliedContacts: Set<string> = new Set();

  // Settings
  let settings = {
    showNotificationOnReply: true,
    playSound: false,
    logReplies: true,
    defaultDelay: 5,
  };

  // Keyboard shortcut
  let unregisterShortcut: (() => void) | null = null;

  const STORAGE_KEY = 'hearth-auto-reply';
  const LOGS_KEY = 'hearth-auto-reply-logs';
  const SETTINGS_KEY = 'hearth-auto-reply-settings';

  onMount(async () => {
    loadData();
    await registerShortcut();
    setupStatusListener();
  });

  onDestroy(() => {
    if (unregisterShortcut) {
      unregisterShortcut();
    }
  });

  function loadData() {
    try {
      const savedRules = localStorage.getItem(STORAGE_KEY);
      if (savedRules) {
        rules = JSON.parse(savedRules);
      }
      const savedLogs = localStorage.getItem(LOGS_KEY);
      if (savedLogs) {
        logs = JSON.parse(savedLogs);
      }
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        settings = { ...settings, ...JSON.parse(savedSettings) };
      }
    } catch (e) {
      console.error('Failed to load auto-reply data:', e);
    }
  }

  function saveRules() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    } catch (e) {
      console.error('Failed to save auto-reply rules:', e);
    }
  }

  function saveLogs() {
    try {
      // Keep only last N entries
      const trimmedLogs = logs.slice(-maxLogEntries);
      localStorage.setItem(LOGS_KEY, JSON.stringify(trimmedLogs));
    } catch (e) {
      console.error('Failed to save auto-reply logs:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save auto-reply settings:', e);
    }
  }

  async function registerShortcut() {
    try {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await register('CommandOrControl+Shift+A', () => {
        isOpen = !isOpen;
      });
      unregisterShortcut = () => unregister('CommandOrControl+Shift+A');
    } catch (e) {
      console.warn('Global shortcut not available:', e);
    }
  }

  function setupStatusListener() {
    // Listen for status changes from SmartStatusManager or other sources
    window.addEventListener('hearth:status-change', ((e: CustomEvent) => {
      currentStatus = e.detail.status;
      checkAndTriggerRules();
    }) as EventListener);

    // Listen for incoming messages
    window.addEventListener('hearth:message-received', ((e: CustomEvent) => {
      handleIncomingMessage(e.detail);
    }) as EventListener);
  }

  function checkAndTriggerRules() {
    if (!globalEnabled) return;

    rules.forEach(rule => {
      if (!rule.enabled) return;
      
      // Check if rule should be active based on trigger
      const shouldBeActive = checkTriggerCondition(rule);
      if (shouldBeActive) {
        // Rule is active, will respond to messages
      }
    });
  }

  function checkTriggerCondition(rule: AutoReplyRule): boolean {
    // Check expiration
    if (rule.expiresAt && new Date(rule.expiresAt) < new Date()) {
      return false;
    }

    // Check schedule
    if (rule.schedule?.enabled) {
      const now = new Date();
      const currentDay = now.getDay();
      if (!rule.schedule.days.includes(currentDay)) {
        return false;
      }

      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime < rule.schedule.startTime || currentTime > rule.schedule.endTime) {
        return false;
      }
    }

    // Check trigger type
    switch (rule.trigger) {
      case 'away':
        return currentStatus === 'away';
      case 'dnd':
        return currentStatus === 'dnd';
      case 'focus':
        return currentStatus === 'dnd'; // Focus mode typically sets DND
      case 'offline':
        return currentStatus === 'offline';
      case 'custom':
        return true; // Custom rules are always checked
      default:
        return false;
    }
  }

  function handleIncomingMessage(messageData: { contactId: string; contactName: string }) {
    if (!globalEnabled) return;

    const eligibleRules = rules.filter(rule => {
      if (!rule.enabled) return false;
      if (!checkTriggerCondition(rule)) return false;

      // Check contact filters
      if (rule.excludeContacts.includes(messageData.contactId)) return false;
      if (rule.includeContacts.length > 0 && !rule.includeContacts.includes(messageData.contactId)) {
        return false;
      }

      // Check once per contact
      if (rule.oncePerContact) {
        const key = `${rule.id}-${messageData.contactId}`;
        if (repliedContacts.has(key)) return false;
      }

      return true;
    });

    // Use highest priority rule (first enabled match)
    if (eligibleRules.length > 0) {
      const rule = eligibleRules[0];
      scheduleAutoReply(rule, messageData);
    }
  }

  function scheduleAutoReply(rule: AutoReplyRule, messageData: { contactId: string; contactName: string }) {
    const delay = rule.delay * 1000 || settings.defaultDelay * 1000;

    setTimeout(() => {
      sendAutoReply(rule, messageData);
    }, delay);
  }

  async function sendAutoReply(rule: AutoReplyRule, messageData: { contactId: string; contactName: string }) {
    // Mark contact as replied for this rule
    if (rule.oncePerContact) {
      repliedContacts.add(`${rule.id}-${messageData.contactId}`);
    }

    // Emit event for message system to send
    window.dispatchEvent(new CustomEvent('hearth:send-auto-reply', {
      detail: {
        contactId: messageData.contactId,
        message: processMessageTemplate(rule.message, messageData),
        ruleId: rule.id,
      }
    }));

    // Update rule stats
    const ruleIndex = rules.findIndex(r => r.id === rule.id);
    if (ruleIndex !== -1) {
      rules[ruleIndex].lastTriggered = new Date().toISOString();
      rules[ruleIndex].triggerCount++;
      rules = [...rules];
      saveRules();
    }

    // Log the reply
    if (settings.logReplies) {
      const logEntry: AutoReplyLog = {
        id: crypto.randomUUID(),
        ruleId: rule.id,
        ruleName: rule.name,
        contactId: messageData.contactId,
        contactName: messageData.contactName,
        message: processMessageTemplate(rule.message, messageData),
        sentAt: new Date().toISOString(),
      };
      logs = [...logs, logEntry];
      saveLogs();
    }

    // Show notification
    if (settings.showNotificationOnReply) {
      try {
        const { sendNotification } = await import('@tauri-apps/plugin-notification');
        await sendNotification({
          title: 'Auto Reply Sent',
          body: `Replied to ${messageData.contactName}: "${rule.message.slice(0, 50)}${rule.message.length > 50 ? '...' : ''}"`,
        });
      } catch (e) {
        console.warn('Notification not available:', e);
      }
    }
  }

  function processMessageTemplate(message: string, data: { contactId: string; contactName: string }): string {
    return message
      .replace(/{name}/g, data.contactName)
      .replace(/{time}/g, new Date().toLocaleTimeString())
      .replace(/{date}/g, new Date().toLocaleDateString());
  }

  function createNewRule() {
    editingRule = {
      id: crypto.randomUUID(),
      name: '',
      message: "Hi! I'm currently away and will get back to you soon.",
      trigger: 'away',
      enabled: true,
      delay: settings.defaultDelay,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      schedule: {
        enabled: false,
        startTime: '09:00',
        endTime: '17:00',
        days: [1, 2, 3, 4, 5],
      },
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };
  }

  function saveRule() {
    if (!editingRule) return;
    
    const existingIndex = rules.findIndex(r => r.id === editingRule!.id);
    if (existingIndex !== -1) {
      rules[existingIndex] = editingRule;
    } else {
      rules = [...rules, editingRule];
    }
    rules = [...rules];
    saveRules();
    editingRule = null;
  }

  function deleteRule(id: string) {
    rules = rules.filter(r => r.id !== id);
    saveRules();
  }

  function toggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (rule) {
      rule.enabled = !rule.enabled;
      rules = [...rules];
      saveRules();
    }
  }

  function clearLogs() {
    logs = [];
    saveLogs();
  }

  function resetRepliedContacts() {
    repliedContacts.clear();
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  function filteredRules(): AutoReplyRule[] {
    if (!searchQuery) return rules;
    const query = searchQuery.toLowerCase();
    return rules.filter(r => 
      r.name.toLowerCase().includes(query) ||
      r.message.toLowerCase().includes(query)
    );
  }

  function getTriggerLabel(trigger: string): string {
    const labels: Record<string, string> = {
      away: '🚶 Away',
      dnd: '🔴 Do Not Disturb',
      focus: '🎯 Focus Mode',
      offline: '⚫ Offline',
      custom: '⚙️ Custom',
    };
    return labels[trigger] || trigger;
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Template suggestions
  const templateSuggestions = [
    { label: 'Basic Away', message: "Hi! I'm currently away and will respond when I'm back." },
    { label: 'In Meeting', message: "I'm in a meeting right now. I'll get back to you as soon as possible." },
    { label: 'Out of Office', message: "I'm out of the office until {date}. For urgent matters, please contact..." },
    { label: 'Focus Time', message: "I'm in focus mode to concentrate on deep work. I'll respond later!" },
    { label: 'Weekend', message: "Thanks for your message! I'm offline for the weekend and will reply on Monday." },
  ];
</script>

<!-- Floating toggle button -->
<button
  class="fixed bottom-20 right-4 z-40 w-12 h-12 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
  class:ring-2={globalEnabled && rules.some(r => r.enabled)}
  class:ring-purple-400={globalEnabled && rules.some(r => r.enabled)}
  class:animate-pulse={globalEnabled && rules.some(r => r.enabled && checkTriggerCondition(r))}
  on:click={() => isOpen = !isOpen}
  title="Auto Reply Manager (Ctrl+Shift+A)"
>
  <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
  {#if rules.filter(r => r.enabled).length > 0}
    <span class="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full text-xs text-white flex items-center justify-center">
      {rules.filter(r => r.enabled).length}
    </span>
  {/if}
</button>

<!-- Main Panel -->
{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click|self={() => isOpen = false}>
    <div class="bg-gray-900 rounded-xl shadow-2xl w-[700px] max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 class="text-lg font-semibold text-white">Auto Reply Manager</h2>
        </div>
        <div class="flex items-center gap-3">
          <!-- Global toggle -->
          <label class="flex items-center gap-2 cursor-pointer">
            <span class="text-sm text-gray-400">Enabled</span>
            <button
              class="relative w-12 h-6 rounded-full transition-colors"
              class:bg-purple-600={globalEnabled}
              class:bg-gray-600={!globalEnabled}
              on:click={() => { globalEnabled = !globalEnabled; }}
            >
              <span
                class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                class:translate-x-6={globalEnabled}
              />
            </button>
          </label>
          <button
            class="text-gray-400 hover:text-white transition-colors"
            on:click={() => isOpen = false}
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700">
        {#each ['rules', 'logs', 'settings'] as tab}
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            class:text-purple-400={activeTab === tab}
            class:border-b-2={activeTab === tab}
            class:border-purple-400={activeTab === tab}
            class:text-gray-400={activeTab !== tab}
            on:click={() => activeTab = tab}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {#if tab === 'rules'}
              <span class="ml-1 text-xs text-gray-500">({rules.length})</span>
            {:else if tab === 'logs'}
              <span class="ml-1 text-xs text-gray-500">({logs.length})</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'rules'}
          <!-- Rules Tab -->
          {#if editingRule}
            <!-- Rule Editor -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-white font-medium">
                  {rules.find(r => r.id === editingRule?.id) ? 'Edit Rule' : 'New Rule'}
                </h3>
                <button
                  class="text-gray-400 hover:text-white"
                  on:click={() => editingRule = null}
                >
                  Cancel
                </button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-sm text-gray-400 mb-1">Rule Name</label>
                  <input
                    type="text"
                    class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Away Message"
                    bind:value={editingRule.name}
                  />
                </div>

                <div>
                  <label class="block text-sm text-gray-400 mb-1">Auto Reply Message</label>
                  <textarea
                    class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                    placeholder="Your automatic reply message..."
                    bind:value={editingRule.message}
                  />
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class="text-xs text-gray-500">Variables:</span>
                    {#each ['{name}', '{time}', '{date}'] as variable}
                      <button
                        class="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300 hover:bg-gray-600"
                        on:click={() => editingRule.message += ` ${variable}`}
                      >
                        {variable}
                      </button>
                    {/each}
                  </div>
                  <div class="mt-2">
                    <span class="text-xs text-gray-500">Templates:</span>
                    <div class="flex flex-wrap gap-2 mt-1">
                      {#each templateSuggestions as template}
                        <button
                          class="text-xs bg-purple-600/30 px-2 py-1 rounded text-purple-300 hover:bg-purple-600/50"
                          on:click={() => editingRule.message = template.message}
                        >
                          {template.label}
                        </button>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-gray-400 mb-1">Trigger When</label>
                    <select
                      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      bind:value={editingRule.trigger}
                    >
                      <option value="away">Away</option>
                      <option value="dnd">Do Not Disturb</option>
                      <option value="focus">Focus Mode</option>
                      <option value="offline">Offline</option>
                      <option value="custom">Custom Schedule</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-sm text-gray-400 mb-1">Delay (seconds)</label>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      bind:value={editingRule.delay}
                    />
                  </div>
                </div>

                <div class="flex items-center gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded bg-gray-800 border-gray-700 text-purple-500 focus:ring-purple-500"
                      bind:checked={editingRule.oncePerContact}
                    />
                    <span class="text-sm text-gray-300">Reply once per contact per session</span>
                  </label>
                </div>

                <!-- Schedule -->
                <div class="bg-gray-800 rounded-lg p-3">
                  <label class="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                      bind:checked={editingRule.schedule.enabled}
                    />
                    <span class="text-sm text-gray-300">Enable schedule</span>
                  </label>
                  
                  {#if editingRule.schedule?.enabled}
                    <div class="space-y-3">
                      <div class="flex gap-4">
                        <div class="flex-1">
                          <label class="block text-xs text-gray-500 mb-1">Start Time</label>
                          <input
                            type="time"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            bind:value={editingRule.schedule.startTime}
                          />
                        </div>
                        <div class="flex-1">
                          <label class="block text-xs text-gray-500 mb-1">End Time</label>
                          <input
                            type="time"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            bind:value={editingRule.schedule.endTime}
                          />
                        </div>
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Days</label>
                        <div class="flex gap-1">
                          {#each dayNames as day, i}
                            <button
                              class="w-10 h-8 rounded text-xs transition-colors"
                              class:bg-purple-600={editingRule.schedule?.days.includes(i)}
                              class:text-white={editingRule.schedule?.days.includes(i)}
                              class:bg-gray-700={!editingRule.schedule?.days.includes(i)}
                              class:text-gray-400={!editingRule.schedule?.days.includes(i)}
                              on:click={() => {
                                if (editingRule.schedule) {
                                  if (editingRule.schedule.days.includes(i)) {
                                    editingRule.schedule.days = editingRule.schedule.days.filter(d => d !== i);
                                  } else {
                                    editingRule.schedule.days = [...editingRule.schedule.days, i];
                                  }
                                }
                              }}
                            >
                              {day}
                            </button>
                          {/each}
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    class="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    on:click={() => editingRule = null}
                  >
                    Cancel
                  </button>
                  <button
                    class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    disabled={!editingRule.name || !editingRule.message}
                    on:click={saveRule}
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </div>
          {:else}
            <!-- Rules List -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <input
                  type="text"
                  class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Search rules..."
                  bind:value={searchQuery}
                />
                <button
                  class="ml-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
                  on:click={createNewRule}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  New Rule
                </button>
              </div>

              {#if filteredRules().length === 0}
                <div class="text-center py-12 text-gray-400">
                  <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p>No auto-reply rules yet</p>
                  <p class="text-sm mt-1">Create one to automatically respond when you're away</p>
                </div>
              {:else}
                {#each filteredRules() as rule (rule.id)}
                  <div
                    class="bg-gray-800 rounded-lg p-4 border transition-colors"
                    class:border-purple-500/50={rule.enabled && checkTriggerCondition(rule)}
                    class:border-gray-700={!rule.enabled || !checkTriggerCondition(rule)}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <h4 class="text-white font-medium">{rule.name}</h4>
                          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                            {getTriggerLabel(rule.trigger)}
                          </span>
                          {#if rule.enabled && checkTriggerCondition(rule)}
                            <span class="text-xs px-2 py-0.5 rounded-full bg-green-600/30 text-green-400">
                              Active
                            </span>
                          {/if}
                        </div>
                        <p class="text-sm text-gray-400 mt-1 line-clamp-2">
                          {rule.message}
                        </p>
                        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Delay: {rule.delay}s</span>
                          {#if rule.oncePerContact}
                            <span>Once per contact</span>
                          {/if}
                          {#if rule.triggerCount > 0}
                            <span>Sent {rule.triggerCount} times</span>
                          {/if}
                        </div>
                      </div>
                      <div class="flex items-center gap-2 ml-4">
                        <button
                          class="p-2 rounded-lg transition-colors"
                          class:bg-purple-600={rule.enabled}
                          class:bg-gray-700={!rule.enabled}
                          on:click={() => toggleRule(rule.id)}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                        >
                          <svg class="w-4 h-4" class:text-white={rule.enabled} class:text-gray-400={!rule.enabled} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {#if rule.enabled}
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            {:else}
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            {/if}
                          </svg>
                        </button>
                        <button
                          class="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                          on:click={() => editingRule = { ...rule }}
                          title="Edit"
                        >
                          <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          class="p-2 bg-gray-700 rounded-lg hover:bg-red-600/50 transition-colors"
                          on:click={() => deleteRule(rule.id)}
                          title="Delete"
                        >
                          <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}

        {:else if activeTab === 'logs'}
          <!-- Logs Tab -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-400">{logs.length} auto-replies sent</span>
              <div class="flex gap-2">
                <button
                  class="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  on:click={resetRepliedContacts}
                >
                  Reset Replied Contacts
                </button>
                <button
                  class="px-3 py-1.5 bg-red-600/30 text-red-400 rounded-lg hover:bg-red-600/50 transition-colors text-sm"
                  on:click={clearLogs}
                >
                  Clear Logs
                </button>
              </div>
            </div>

            {#if logs.length === 0}
              <div class="text-center py-12 text-gray-400">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>No auto-replies sent yet</p>
              </div>
            {:else}
              <div class="space-y-2 max-h-[400px] overflow-y-auto">
                {#each logs.slice().reverse() as log (log.id)}
                  <div class="bg-gray-800 rounded-lg p-3">
                    <div class="flex items-start justify-between">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-white font-medium">{log.contactName}</span>
                          <span class="text-xs text-gray-500">via {log.ruleName}</span>
                        </div>
                        <p class="text-sm text-gray-400 mt-1">{log.message}</p>
                      </div>
                      <span class="text-xs text-gray-500 whitespace-nowrap ml-4">
                        {formatDate(log.sentAt)}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'settings'}
          <!-- Settings Tab -->
          <div class="space-y-4">
            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Notifications</h3>
              
              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-300">Show notification when reply is sent</span>
                <button
                  class="relative w-12 h-6 rounded-full transition-colors"
                  class:bg-purple-600={settings.showNotificationOnReply}
                  class:bg-gray-600={!settings.showNotificationOnReply}
                  on:click={() => { settings.showNotificationOnReply = !settings.showNotificationOnReply; saveSettings(); }}
                >
                  <span
                    class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                    class:translate-x-6={settings.showNotificationOnReply}
                  />
                </button>
              </label>

              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-300">Play sound on auto-reply</span>
                <button
                  class="relative w-12 h-6 rounded-full transition-colors"
                  class:bg-purple-600={settings.playSound}
                  class:bg-gray-600={!settings.playSound}
                  on:click={() => { settings.playSound = !settings.playSound; saveSettings(); }}
                >
                  <span
                    class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                    class:translate-x-6={settings.playSound}
                  />
                </button>
              </label>
            </div>

            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Logging</h3>
              
              <label class="flex items-center justify-between cursor-pointer">
                <span class="text-sm text-gray-300">Log auto-replies</span>
                <button
                  class="relative w-12 h-6 rounded-full transition-colors"
                  class:bg-purple-600={settings.logReplies}
                  class:bg-gray-600={!settings.logReplies}
                  on:click={() => { settings.logReplies = !settings.logReplies; saveSettings(); }}
                >
                  <span
                    class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                    class:translate-x-6={settings.logReplies}
                  />
                </button>
              </label>

              <div>
                <label class="block text-sm text-gray-300 mb-2">Max log entries</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  class="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  bind:value={maxLogEntries}
                />
              </div>
            </div>

            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Defaults</h3>
              
              <div>
                <label class="block text-sm text-gray-300 mb-2">Default delay before sending (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  class="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  bind:value={settings.defaultDelay}
                  on:change={saveSettings}
                />
              </div>
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-2">Keyboard Shortcut</h3>
              <div class="flex items-center gap-2">
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Shift</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">A</kbd>
                <span class="text-gray-400 ml-2">Toggle Auto Reply Manager</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer status -->
      <div class="px-4 py-2 border-t border-gray-700 bg-gray-800/50">
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>
            Status: <span class="capitalize" class:text-green-400={currentStatus === 'online'} class:text-yellow-400={currentStatus === 'away'} class:text-red-400={currentStatus === 'dnd'}>{currentStatus}</span>
          </span>
          <span>
            {rules.filter(r => r.enabled).length} rules active
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
