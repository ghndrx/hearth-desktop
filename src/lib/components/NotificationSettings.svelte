<script lang="ts">
  /**
   * NotificationSettings.svelte
   * FEAT-001: Added Thread Notifications section
   */
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { settings, notificationSettings, type NotificationSettings, type ThreadNotificationLevel } from '$lib/stores/settings';

  export let embedded = false;

  let permissionState: NotificationPermission = 'default';
  let testSoundPlaying = false;

  $: notifications = $notificationSettings;

  onMount(() => {
    if (browser && 'Notification' in window) {
      permissionState = Notification.permission;
    }
  });

  async function requestNotificationPermission() {
    if (!browser || !('Notification' in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      permissionState = permission;
      
      if (permission === 'granted') {
        new Notification('Hearth Notifications Enabled', {
          body: 'You will now receive desktop notifications.',
          icon: '/favicon.png'
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  }

  function toggleSetting(key: keyof NotificationSettings) {
    const currentValue = notifications[key];
    if (typeof currentValue === 'boolean') {
      settings.updateNotifications({ [key]: !currentValue });
    }
  }

  function updateThreadNotificationLevel(level: ThreadNotificationLevel) {
    settings.updateNotifications({ threadNotifications: level });
  }

  function updateVolume(e: Event) {
    const target = e.target as HTMLInputElement;
    settings.updateNotifications({ soundVolume: parseInt(target.value) });
  }

  async function playTestSound() {
    if (testSoundPlaying) return;
    testSoundPlaying = true;
    
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = notifications.soundVolume / 100;
      await audio.play();
    } catch (error) {
      console.error('Failed to play test sound:', error);
    } finally {
      setTimeout(() => {
        testSoundPlaying = false;
      }, 500);
    }
  }

  function showTestNotification() {
    if (!browser || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    new Notification('Test Notification', {
      body: 'This is what your notifications will look like.',
      icon: '/favicon.png'
    });
  }
</script>

<section class={embedded ? '' : 'p-6'}>
  {#if !embedded}
    <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Notifications</h1>
  {/if}

  <!-- Desktop Notifications Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Desktop Notifications</h2>
    
    <!-- Permission Status Banner -->
    {#if permissionState !== 'granted'}
      <div class="mb-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--status-warning)]">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-[var(--status-warning)] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <div class="flex-1">
            <p class="text-[var(--text-primary)] font-medium mb-1">
              {permissionState === 'denied' ? 'Notifications Blocked' : 'Enable Desktop Notifications'}
            </p>
            <p class="text-[var(--text-secondary)] text-sm mb-3">
              {permissionState === 'denied' 
                ? 'You have blocked notifications. Please update your browser settings to enable them.'
                : 'Allow Hearth to send you desktop notifications when you receive new messages.'}
            </p>
            {#if permissionState !== 'denied'}
              <button 
                class="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--brand-hover)]"
                on:click={requestNotificationPermission}
              >
                Enable Notifications
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Enable Desktop Notifications Toggle -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Enable Desktop Notifications</span>
        <span class="text-sm text-[var(--text-muted)]">Receive notifications even when Hearth is minimized or in the background.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.desktopEnabled}
          on:change={() => toggleSetting('desktopEnabled')}
          disabled={permissionState === 'denied'}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4 [&:has(input:disabled)]:opacity-50 [&:has(input:disabled)]:cursor-not-allowed"></span>
      </label>
    </div>

    <!-- Show Message Previews -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Show Message Previews</span>
        <span class="text-sm text-[var(--text-muted)]">Display message content in desktop notifications.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.showPreviews}
          on:change={() => toggleSetting('showPreviews')}
          disabled={!notifications.desktopEnabled}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4 [&:has(input:disabled)]:opacity-50 [&:has(input:disabled)]:cursor-not-allowed"></span>
      </label>
    </div>

    <!-- Flash Taskbar -->
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Flash Taskbar</span>
        <span class="text-sm text-[var(--text-muted)]">Flash the taskbar icon when you receive a notification.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.flashTaskbar}
          on:change={() => toggleSetting('flashTaskbar')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- Test Notification Button -->
    {#if permissionState === 'granted'}
      <div class="mt-4">
        <button 
          class="px-4 py-2 rounded bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--bg-modifier-selected)]"
          on:click={showTestNotification}
        >
          Send Test Notification
        </button>
      </div>
    {/if}
  </div>

  <!-- Sound Settings Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Sounds</h2>
    
    <!-- Enable Sounds Toggle -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Enable Notification Sounds</span>
        <span class="text-sm text-[var(--text-muted)]">Play sounds for notifications and messages.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.soundsEnabled}
          on:change={() => toggleSetting('soundsEnabled')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- Sound Volume -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)] {!notifications.soundsEnabled ? 'opacity-50' : ''}">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Notification Volume</span>
        <span class="text-sm text-[var(--text-muted)]">Adjust the volume of notification sounds.</span>
      </div>
      <div class="flex items-center gap-4">
        <svg class="w-5 h-5 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
        <input 
          type="range" 
          min="0" 
          max="100" 
          step="5"
          value={notifications.soundVolume}
          on:input={updateVolume}
          disabled={!notifications.soundsEnabled}
          class="flex-1 h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span class="min-w-[40px] text-right text-[var(--text-secondary)]">{notifications.soundVolume}%</span>
        <button 
          class="px-3 py-1.5 rounded bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] text-sm cursor-pointer transition-colors hover:bg-[var(--bg-modifier-selected)] disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={playTestSound}
          disabled={!notifications.soundsEnabled || testSoundPlaying}
        >
          {testSoundPlaying ? '...' : 'Test'}
        </button>
      </div>
    </div>

    <!-- Message Sounds -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)] {!notifications.soundsEnabled ? 'opacity-50' : ''}">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Message Sounds</span>
        <span class="text-sm text-[var(--text-muted)]">Play a sound when you receive a message.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.messageSound}
          on:change={() => toggleSetting('messageSound')}
          disabled={!notifications.soundsEnabled}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4 [&:has(input:disabled)]:opacity-50 [&:has(input:disabled)]:cursor-not-allowed"></span>
      </label>
    </div>

    <!-- Mention Sounds -->
    <div class="flex justify-between items-center py-4 {!notifications.soundsEnabled ? 'opacity-50' : ''}">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Mention Sounds</span>
        <span class="text-sm text-[var(--text-muted)]">Play a distinct sound when someone mentions you.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.mentionSound}
          on:change={() => toggleSetting('mentionSound')}
          disabled={!notifications.soundsEnabled}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4 [&:has(input:disabled)]:opacity-50 [&:has(input:disabled)]:cursor-not-allowed"></span>
      </label>
    </div>
  </div>

  <!-- Mention Settings Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Mentions</h2>
    
    <!-- Highlight Mentions -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Highlight Mentions</span>
        <span class="text-sm text-[var(--text-muted)]">Visually highlight messages that mention you.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.mentionHighlight}
          on:change={() => toggleSetting('mentionHighlight')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- @everyone and @here -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Suppress @everyone and @here</span>
        <span class="text-sm text-[var(--text-muted)]">Don't receive notifications for @everyone and @here mentions.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={!notifications.mentionEveryone}
          on:change={() => toggleSetting('mentionEveryone')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- Role Mentions -->
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Suppress All Role @mentions</span>
        <span class="text-sm text-[var(--text-muted)]">Don't receive notifications when your roles are mentioned.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={!notifications.mentionRoles}
          on:change={() => toggleSetting('mentionRoles')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>
  </div>

  <!-- FEAT-001: Thread Notifications Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Threads</h2>
    
    <!-- Thread Notification Level -->
    <div class="py-4 border-b border-[var(--bg-modifier-accent)]">
      <div class="mb-3">
        <span class="block text-base text-[var(--text-primary)] mb-1">Thread Notification Level</span>
        <span class="text-sm text-[var(--text-muted)]">Choose when to receive notifications for threads you're following.</span>
      </div>
      <div class="flex flex-col gap-2">
        <label class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors" class:ring-2={notifications.threadNotifications === 'all'} class:ring-[var(--brand-primary)]={notifications.threadNotifications === 'all'}>
          <input 
            type="radio" 
            name="threadNotifications" 
            value="all"
            checked={notifications.threadNotifications === 'all'}
            on:change={() => updateThreadNotificationLevel('all')}
            class="w-4 h-4 accent-[var(--brand-primary)]"
          />
          <div class="flex-1">
            <span class="block text-[var(--text-primary)] font-medium">All Messages</span>
            <span class="text-sm text-[var(--text-muted)]">Receive notifications for all new replies in threads you follow</span>
          </div>
        </label>
        <label class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors" class:ring-2={notifications.threadNotifications === 'mentions'} class:ring-[var(--brand-primary)]={notifications.threadNotifications === 'mentions'}>
          <input 
            type="radio" 
            name="threadNotifications" 
            value="mentions"
            checked={notifications.threadNotifications === 'mentions'}
            on:change={() => updateThreadNotificationLevel('mentions')}
            class="w-4 h-4 accent-[var(--brand-primary)]"
          />
          <div class="flex-1">
            <span class="block text-[var(--text-primary)] font-medium">Only @mentions</span>
            <span class="text-sm text-[var(--text-muted)]">Only receive notifications when you are mentioned</span>
          </div>
        </label>
        <label class="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] cursor-pointer hover:bg-[var(--bg-modifier-hover)] transition-colors" class:ring-2={notifications.threadNotifications === 'none'} class:ring-[var(--brand-primary)]={notifications.threadNotifications === 'none'}>
          <input 
            type="radio" 
            name="threadNotifications" 
            value="none"
            checked={notifications.threadNotifications === 'none'}
            on:change={() => updateThreadNotificationLevel('none')}
            class="w-4 h-4 accent-[var(--brand-primary)]"
          />
          <div class="flex-1">
            <span class="block text-[var(--text-primary)] font-medium">Nothing</span>
            <span class="text-sm text-[var(--text-muted)]">Don't receive any thread notifications by default</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Auto-follow Threads -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Automatically Follow Threads</span>
        <span class="text-sm text-[var(--text-muted)]">Automatically follow threads when you're mentioned or added.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.threadAutoFollow}
          on:change={() => toggleSetting('threadAutoFollow')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- Follow on Reply -->
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Follow on Reply</span>
        <span class="text-sm text-[var(--text-muted)]">Automatically follow threads when you reply to them.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.threadFollowOnReply}
          on:change={() => toggleSetting('threadFollowOnReply')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>
  </div>

  <!-- Direct Messages Section -->
  <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Direct Messages</h2>
    
    <!-- Mute DMs -->
    <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Mute Direct Messages</span>
        <span class="text-sm text-[var(--text-muted)]">Don't receive notifications for direct messages.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.muteDMs}
          on:change={() => toggleSetting('muteDMs')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>

    <!-- Mute Group DMs -->
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Mute Group Direct Messages</span>
        <span class="text-sm text-[var(--text-muted)]">Don't receive notifications for group direct messages.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.muteGroupDMs}
          on:change={() => toggleSetting('muteGroupDMs')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>
  </div>

  <!-- Do Not Disturb Section -->
  <div class="mb-6">
    <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Do Not Disturb</h2>
    
    <div class="flex justify-between items-center py-4">
      <div>
        <span class="block text-base text-[var(--text-primary)] mb-1">Allow Critical Notifications</span>
        <span class="text-sm text-[var(--text-muted)]">Receive notifications even when Do Not Disturb is enabled.</span>
      </div>
      <label class="relative inline-block w-10 h-6 flex-shrink-0">
        <input 
          type="checkbox" 
          checked={notifications.suppressDND}
          on:change={() => toggleSetting('suppressDND')}
          class="opacity-0 w-0 h-0"
        />
        <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
      </label>
    </div>
  </div>
</section>
