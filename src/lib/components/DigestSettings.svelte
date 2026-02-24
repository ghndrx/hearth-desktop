<script lang="ts">
  /**
   * DigestSettings.svelte
   * Digest notification preferences UI
   */
  import { onMount } from 'svelte';
  import { 
    digest, 
    digestEnabled, 
    digestFrequency, 
    digestPendingCount,
    digestLoading,
    formatDigestFrequency,
    formatDigestStatus,
    getNextDigestText,
    TIMEZONE_OPTIONS,
    DAY_OPTIONS,
    HOUR_OPTIONS,
    type DigestFrequency,
    type DigestAggregationMode
  } from '$lib/stores/digest';

  export let embedded = false;

  let loading = false;
  let error: string | null = null;
  let successMessage: string | null = null;

  $: preferences = $digest.preferences;
  $: preview = $digest.preview;
  $: history = $digest.history;
  $: isLoading = $digestLoading;

  onMount(async () => {
    try {
      await Promise.all([
        digest.loadPreferences(),
        digest.loadPreview(),
        digest.loadHistory(5)
      ]);
    } catch (err) {
      console.error('Failed to load digest settings:', err);
    }
  });

  async function toggleEnabled() {
    if (!preferences) return;
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ enabled: !preferences.enabled });
      successMessage = preferences.enabled ? 'Digest notifications disabled' : 'Digest notifications enabled';
      setTimeout(() => successMessage = null, 3000);
    } catch (err) {
      error = 'Failed to update setting';
    } finally {
      loading = false;
    }
  }

  async function updateFrequency(frequency: DigestFrequency) {
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ frequency });
      await digest.loadPreview();
    } catch (err) {
      error = 'Failed to update frequency';
    } finally {
      loading = false;
    }
  }

  async function updatePreferredHour(e: Event) {
    const target = e.target as HTMLSelectElement;
    const hour = parseInt(target.value);
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ preferred_hour: hour });
      await digest.loadPreview();
    } catch (err) {
      error = 'Failed to update preferred time';
    } finally {
      loading = false;
    }
  }

  async function updatePreferredDay(e: Event) {
    const target = e.target as HTMLSelectElement;
    const day = parseInt(target.value);
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ preferred_day: day });
      await digest.loadPreview();
    } catch (err) {
      error = 'Failed to update preferred day';
    } finally {
      loading = false;
    }
  }

  async function updateTimezone(e: Event) {
    const target = e.target as HTMLSelectElement;
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ timezone: target.value });
      await digest.loadPreview();
    } catch (err) {
      error = 'Failed to update timezone';
    } finally {
      loading = false;
    }
  }

  async function updateAggregationMode(mode: DigestAggregationMode) {
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ aggregation_mode: mode });
    } catch (err) {
      error = 'Failed to update aggregation mode';
    } finally {
      loading = false;
    }
  }

  async function updateMaxMessages(e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    if (value < 1 || value > 200) return;
    
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ max_messages_per_source: value });
    } catch (err) {
      error = 'Failed to update max messages';
    } finally {
      loading = false;
    }
  }

  async function toggleMutedOnly() {
    if (!preferences) return;
    loading = true;
    error = null;
    
    try {
      await digest.updatePreferences({ muted_channels_only: !preferences.muted_channels_only });
    } catch (err) {
      error = 'Failed to update setting';
    } finally {
      loading = false;
    }
  }

  async function handleClearQueue() {
    if (!confirm('Clear all pending digest items? This cannot be undone.')) return;
    
    loading = true;
    error = null;
    
    try {
      const count = await digest.clearQueue();
      successMessage = `Cleared ${count} pending items`;
      await digest.loadPreview();
      setTimeout(() => successMessage = null, 3000);
    } catch (err) {
      error = 'Failed to clear queue';
    } finally {
      loading = false;
    }
  }

  async function handleGenerateNow() {
    if (!confirm('Generate and send digest now?')) return;
    
    loading = true;
    error = null;
    
    try {
      await digest.generateDigestNow();
      await Promise.all([
        digest.loadPreview(),
        digest.loadHistory(5)
      ]);
      successMessage = 'Digest generated successfully';
      setTimeout(() => successMessage = null, 3000);
    } catch (err) {
      error = 'Failed to generate digest';
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }
</script>

<section class={embedded ? '' : 'p-6'}>
  {#if !embedded}
    <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Digest Notifications</h1>
  {/if}

  {#if error}
    <div class="mb-4 p-3 rounded-lg bg-[var(--status-danger)] bg-opacity-20 text-[var(--status-danger)]">
      {error}
    </div>
  {/if}

  {#if successMessage}
    <div class="mb-4 p-3 rounded-lg bg-[var(--status-positive)] bg-opacity-20 text-[var(--status-positive)]">
      {successMessage}
    </div>
  {/if}

  <!-- Main Toggle Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Digest Summary</h2>
    
    <!-- Enable Digest Toggle -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Enable Digest Notifications</span>
        <span class="text-sm text-[var(--text-muted)]">Batch notifications into periodic summaries instead of receiving them instantly.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={preferences?.enabled ?? false}
          on:change={toggleEnabled}
          disabled={loading || isLoading}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4 [&:has(input:disabled)]:opacity-50 [&:has(input:disabled)]:cursor-not-allowed"></span>
      </label>
    </div>

    <!-- Preview Stats -->
    {#if preferences?.enabled && preview}
      <div class="mt-4 p-4 rounded-lg bg-[var(--bg-secondary)]">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium text-[var(--text-primary)]">Pending Digest</span>
          <span class="text-sm text-[var(--text-muted)]">Next: {getNextDigestText(preview, preferences)}</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div class="text-2xl font-bold text-[var(--text-primary)]">{preview.pending_count}</div>
            <div class="text-xs text-[var(--text-muted)]">Messages</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-[var(--status-warning)]">{preview.pending_mentions}</div>
            <div class="text-xs text-[var(--text-muted)]">Mentions</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-[var(--text-primary)]">{preview.pending_servers}</div>
            <div class="text-xs text-[var(--text-muted)]">Servers</div>
          </div>
          <div>
            <div class="text-2xl font-bold text-[var(--text-primary)]">{preview.pending_channels}</div>
            <div class="text-xs text-[var(--text-muted)]">Channels</div>
          </div>
        </div>
        {#if preview.pending_count > 0}
          <div class="mt-4 flex gap-2 justify-end">
            <button 
              class="px-3 py-1.5 rounded text-sm bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] hover:bg-[var(--bg-modifier-selected)] transition-colors disabled:opacity-50"
              on:click={handleClearQueue}
              disabled={loading}
            >
              Clear Queue
            </button>
            <button 
              class="px-3 py-1.5 rounded text-sm bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-hover)] transition-colors disabled:opacity-50"
              on:click={handleGenerateNow}
              disabled={loading}
            >
              Send Now
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Frequency Settings -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)] {!preferences?.enabled ? 'opacity-50 pointer-events-none' : ''}">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Frequency</h2>
    
    <!-- Frequency Selection -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)]">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Digest Frequency</span>
        <span class="text-sm text-[var(--text-muted)]">How often to receive digest summaries.</span>
      </div>
      <div class="flex flex-col gap-2">
        {#each ['hourly', 'daily', 'weekly'] as freq}
          <label 
            class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors"
            class:ring-2={preferences?.frequency === freq}
            class:ring-[var(--brand-primary)]={preferences?.frequency === freq}
          >
            <input 
              type="radio" 
              name="digestFrequency" 
              value={freq}
              checked={preferences?.frequency === freq}
              on:change={() => updateFrequency(freq as DigestFrequency)}
              disabled={loading}
              class="w-4 h-4 accent-[var(--brand-primary)]"
            />
            <div class="flex-1">
              <span class="block text-[var(--text-primary)] font-medium">{formatDigestFrequency(freq as DigestFrequency)}</span>
              <span class="text-sm text-[var(--text-muted)]">
                {#if freq === 'hourly'}
                  Receive a summary every hour
                {:else if freq === 'daily'}
                  Receive a summary once per day
                {:else}
                  Receive a summary once per week
                {/if}
              </span>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <!-- Preferred Time -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)]">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Preferred Time</span>
        <span class="text-sm text-[var(--text-muted)]">When to receive your digest.</span>
      </div>
      <div class="flex flex-wrap gap-4">
        {#if preferences?.frequency === 'weekly'}
          <div class="flex-1 min-w-[150px]">
            <label class="block text-sm text-[var(--text-muted)] mb-1">Day</label>
            <select 
              class="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--bg-modifier-accent)] focus:border-[var(--brand-primary)] outline-none"
              value={preferences?.preferred_day ?? 1}
              on:change={updatePreferredDay}
              disabled={loading}
            >
              {#each DAY_OPTIONS as day}
                <option value={day.value}>{day.label}</option>
              {/each}
            </select>
          </div>
        {/if}
        {#if preferences?.frequency !== 'hourly'}
          <div class="flex-1 min-w-[150px]">
            <label class="block text-sm text-[var(--text-muted)] mb-1">Time</label>
            <select 
              class="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--bg-modifier-accent)] focus:border-[var(--brand-primary)] outline-none"
              value={preferences?.preferred_hour ?? 9}
              on:change={updatePreferredHour}
              disabled={loading}
            >
              {#each HOUR_OPTIONS as hour}
                <option value={hour.value}>{hour.label}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm text-[var(--text-muted)] mb-1">Timezone</label>
          <select 
            class="w-full px-3 py-2 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--bg-modifier-accent)] focus:border-[var(--brand-primary)] outline-none"
            value={preferences?.timezone ?? 'UTC'}
            on:change={updateTimezone}
            disabled={loading}
          >
            {#each TIMEZONE_OPTIONS as tz}
              <option value={tz.value}>{tz.label}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Content Settings -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)] {!preferences?.enabled ? 'opacity-50 pointer-events-none' : ''}">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Content</h2>
    
    <!-- Aggregation Mode -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)]">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Group By</span>
        <span class="text-sm text-[var(--text-muted)]">How to organize messages in your digest.</span>
      </div>
      <div class="flex gap-4">
        <label 
          class="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors flex-1"
          class:ring-2={preferences?.aggregation_mode === 'server'}
          class:ring-[var(--brand-primary)]={preferences?.aggregation_mode === 'server'}
        >
          <input 
            type="radio" 
            name="aggregationMode" 
            value="server"
            checked={preferences?.aggregation_mode === 'server'}
            on:change={() => updateAggregationMode('server')}
            disabled={loading}
            class="w-4 h-4 accent-[var(--brand-primary)]"
          />
          <span class="text-[var(--text-primary)]">By Server</span>
        </label>
        <label 
          class="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors flex-1"
          class:ring-2={preferences?.aggregation_mode === 'channel'}
          class:ring-[var(--brand-primary)]={preferences?.aggregation_mode === 'channel'}
        >
          <input 
            type="radio" 
            name="aggregationMode" 
            value="channel"
            checked={preferences?.aggregation_mode === 'channel'}
            on:change={() => updateAggregationMode('channel')}
            disabled={loading}
            class="w-4 h-4 accent-[var(--brand-primary)]"
          />
          <span class="text-[var(--text-primary)]">By Channel</span>
        </label>
      </div>
    </div>

    <!-- Max Messages -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)]">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Max Messages Per Source</span>
        <span class="text-sm text-[var(--text-muted)]">Maximum messages to include from each channel or server.</span>
      </div>
      <div class="flex items-center gap-4">
        <input 
          type="range" 
          min="10" 
          max="200" 
          step="10"
          value={preferences?.max_messages_per_source ?? 50}
          on:change={updateMaxMessages}
          disabled={loading}
          class="flex-1 h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <span class="min-w-[40px] text-right text-[var(--text-secondary)]">{preferences?.max_messages_per_source ?? 50}</span>
      </div>
    </div>

    <!-- Muted Channels Only -->
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Muted Channels Only</span>
        <span class="text-sm text-[var(--text-muted)]">Only include messages from channels you've muted.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={preferences?.muted_channels_only ?? true}
          on:change={toggleMutedOnly}
          disabled={loading}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>
  </div>

  <!-- History Section -->
  <div class="mb-6 {!preferences?.enabled ? 'opacity-50' : ''}">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Recent Digests</h2>
    
    {#if history.length === 0}
      <div class="p-4 rounded-lg bg-[var(--bg-secondary)] text-center text-[var(--text-muted)]">
        No digests sent yet
      </div>
    {:else}
      <div class="space-y-2">
        {#each history as item}
          <div class="p-3 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[var(--text-primary)]">{formatDate(item.sent_at)}</span>
                <span 
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  class:bg-[var(--status-positive)]={item.status === 'sent'}
                  class:bg-opacity-20={true}
                  class:text-[var(--status-positive)]={item.status === 'sent'}
                  class:bg-[var(--status-danger)]={item.status === 'failed'}
                  class:text-[var(--status-danger)]={item.status === 'failed'}
                  class:bg-[var(--text-muted)]={item.status === 'skipped' || item.status === 'pending'}
                  class:text-[var(--text-muted)]={item.status === 'skipped' || item.status === 'pending'}
                >
                  {formatDigestStatus(item.status)}
                </span>
              </div>
              <div class="text-sm text-[var(--text-muted)]">
                {item.total_messages} messages, {item.total_mentions} mentions
              </div>
            </div>
            <div class="text-sm text-[var(--text-muted)]">
              {formatDigestFrequency(item.frequency)}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>
