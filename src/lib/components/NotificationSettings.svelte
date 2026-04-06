<script lang="ts">
  import { notificationStore, notificationSettings } from '$lib/notifications';
  import type { NotificationCategory, NotificationPriority } from '$lib/notifications';

  const categories: { key: NotificationCategory; label: string; description: string }[] = [
    { key: 'message', label: 'Messages', description: 'New messages in channels and DMs' },
    { key: 'mention', label: 'Mentions', description: 'When someone mentions you' },
    { key: 'voice_call', label: 'Voice Calls', description: 'Incoming voice calls' },
    { key: 'friend_request', label: 'Friend Requests', description: 'New friend requests' },
    { key: 'server_update', label: 'Server Updates', description: 'Server changes and updates' },
    { key: 'system', label: 'System', description: 'System notifications and alerts' }
  ];

  const priorities: { key: NotificationPriority; label: string }[] = [
    { key: 'urgent', label: 'Urgent' },
    { key: 'high', label: 'High' },
    { key: 'normal', label: 'Normal' },
    { key: 'low', label: 'Low' }
  ];

  function toggleNotifications() {
    notificationStore.updateSettings({
      enabled: !$notificationSettings.enabled
    });
  }

  function toggleCategoryEnabled(category: NotificationCategory) {
    notificationStore.updateCategorySettings(category, {
      enabled: !$notificationSettings.categories[category].enabled
    });
  }

  function updateCategoryPriority(category: NotificationCategory, priority: NotificationPriority) {
    notificationStore.updateCategorySettings(category, { priority });
  }

  function toggleCategorySound(category: NotificationCategory) {
    notificationStore.updateCategorySettings(category, {
      sound: !$notificationSettings.categories[category].sound
    });
  }

  function toggleCategoryBatching(category: NotificationCategory) {
    notificationStore.updateCategorySettings(category, {
      batchingEnabled: !$notificationSettings.categories[category].batchingEnabled
    });
  }

  function updateCategoryBatchDelay(category: NotificationCategory, delay: number) {
    notificationStore.updateCategorySettings(category, {
      batchDelay: delay
    });
  }

  function toggleQuietHours() {
    notificationStore.updateSettings({
      quietHours: {
        ...$notificationSettings.quietHours,
        enabled: !$notificationSettings.quietHours.enabled
      }
    });
  }

  function updateQuietHours(start: string, end: string) {
    notificationStore.updateSettings({
      quietHours: {
        ...$notificationSettings.quietHours,
        start,
        end
      }
    });
  }

  function updateMaxBatchSize(size: number) {
    notificationStore.updateSettings({
      maxBatchSize: size
    });
  }

  function updateGlobalBatchingDelay(delay: number) {
    notificationStore.updateSettings({
      batchingDelay: delay
    });
  }
</script>

<div class="notification-settings">
  <h2 class="text-xl font-bold mb-6">Notification Settings</h2>

  <!-- Global Settings -->
  <div class="mb-8">
    <h3 class="text-lg font-semibold mb-4">General</h3>

    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium">Enable Notifications</label>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Turn all notifications on or off
          </p>
        </div>
        <button
          type="button"
          class="toggle {$notificationSettings.enabled ? 'enabled' : ''}"
          on:click={toggleNotifications}
        >
          <span class="toggle-switch"></span>
        </button>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium">Max Batch Size</label>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Maximum number of notifications to group together
          </p>
        </div>
        <select
          class="px-3 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
          value={$notificationSettings.maxBatchSize}
          on:change={(e) => updateMaxBatchSize(parseInt(e.currentTarget.value))}
        >
          <option value={3}>3</option>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
        </select>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium">Default Batching Delay</label>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            How long to wait before sending batched notifications
          </p>
        </div>
        <select
          class="px-3 py-1 border rounded dark:bg-gray-800 dark:border-gray-600"
          value={$notificationSettings.batchingDelay}
          on:change={(e) => updateGlobalBatchingDelay(parseInt(e.currentTarget.value))}
        >
          <option value={1000}>1 second</option>
          <option value={2000}>2 seconds</option>
          <option value={5000}>5 seconds</option>
          <option value={10000}>10 seconds</option>
        </select>
      </div>
    </div>
  </div>

  <!-- Quiet Hours -->
  <div class="mb-8">
    <h3 class="text-lg font-semibold mb-4">Quiet Hours</h3>

    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium">Enable Quiet Hours</label>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Suppress notifications during specified hours
          </p>
        </div>
        <button
          type="button"
          class="toggle {$notificationSettings.quietHours.enabled ? 'enabled' : ''}"
          on:click={toggleQuietHours}
        >
          <span class="toggle-switch"></span>
        </button>
      </div>

      {#if $notificationSettings.quietHours.enabled}
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              class="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600"
              value={$notificationSettings.quietHours.start}
              on:change={(e) => updateQuietHours(e.currentTarget.value, $notificationSettings.quietHours.end)}
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              class="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-600"
              value={$notificationSettings.quietHours.end}
              on:change={(e) => updateQuietHours($notificationSettings.quietHours.start, e.currentTarget.value)}
            />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Category Settings -->
  <div class="mb-8">
    <h3 class="text-lg font-semibold mb-4">Notification Categories</h3>

    <div class="space-y-6">
      {#each categories as category}
        {@const settings = $notificationSettings.categories[category.key]}
        <div class="border rounded-lg p-4 dark:border-gray-700">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="font-medium">{category.label}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">{category.description}</p>
            </div>
            <button
              type="button"
              class="toggle {settings.enabled ? 'enabled' : ''}"
              on:click={() => toggleCategoryEnabled(category.key)}
            >
              <span class="toggle-switch"></span>
            </button>
          </div>

          {#if settings.enabled}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Priority</label>
                <select
                  class="w-full px-3 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                  value={settings.priority}
                  on:change={(e) => updateCategoryPriority(category.key, e.currentTarget.value as NotificationPriority)}
                >
                  {#each priorities as priority}
                    <option value={priority.key}>{priority.label}</option>
                  {/each}
                </select>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="sound-{category.key}"
                  checked={settings.sound}
                  on:change={() => toggleCategorySound(category.key)}
                  class="mr-2"
                />
                <label for="sound-{category.key}" class="text-sm">Sound</label>
              </div>

              <div class="flex items-center">
                <input
                  type="checkbox"
                  id="batch-{category.key}"
                  checked={settings.batchingEnabled}
                  on:change={() => toggleCategoryBatching(category.key)}
                  class="mr-2"
                  disabled={category.key === 'voice_call'}
                />
                <label for="batch-{category.key}" class="text-sm">
                  Batch
                  {#if category.key === 'voice_call'}
                    <span class="text-xs text-gray-500">(disabled)</span>
                  {/if}
                </label>
              </div>

              {#if settings.batchingEnabled && category.key !== 'voice_call'}
                <div>
                  <label class="block text-sm font-medium mb-1">Batch Delay</label>
                  <select
                    class="w-full px-3 py-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-600"
                    value={settings.batchDelay}
                    on:change={(e) => updateCategoryBatchDelay(category.key, parseInt(e.currentTarget.value))}
                  >
                    <option value={500}>0.5s</option>
                    <option value={1000}>1s</option>
                    <option value={2000}>2s</option>
                    <option value={5000}>5s</option>
                    <option value={10000}>10s</option>
                    <option value={30000}>30s</option>
                  </select>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .toggle {
    @apply relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-700;
  }

  .toggle.enabled {
    @apply bg-blue-600;
  }

  .toggle-switch {
    @apply inline-block h-4 w-4 transform rounded-full bg-white transition-transform;
    transform: translateX(2px);
  }

  .toggle.enabled .toggle-switch {
    transform: translateX(26px);
  }

  .notification-settings {
    @apply max-w-4xl mx-auto p-6;
  }
</style>