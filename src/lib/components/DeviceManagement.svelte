<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  
  interface Session {
    id: string;
    device_name: string;
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser: string;
    browser_version: string;
    os: string;
    os_version: string;
    location_city: string;
    location_country: string;
    is_current: boolean;
    last_used: string | null;
    created_at: string;
  }
  
  let sessions: Session[] = [];
  let loading = true;
  let error: string | null = null;
  let revokingSession: string | null = null;
  let revokingAll = false;
  
  onMount(async () => {
    await loadSessions();
  });
  
  async function loadSessions() {
    loading = true;
    error = null;
    try {
      const response = await api.get<{ sessions: Session[] }>('/auth/sessions');
      sessions = response.sessions || [];
    } catch (err) {
      console.error('Failed to load sessions:', err);
      error = 'Failed to load active sessions';
    } finally {
      loading = false;
    }
  }
  
  async function revokeSession(sessionId: string) {
    revokingSession = sessionId;
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      sessions = sessions.filter(s => s.id !== sessionId);
    } catch (err) {
      console.error('Failed to revoke session:', err);
      error = 'Failed to log out of session';
    } finally {
      revokingSession = null;
    }
  }
  
  async function revokeAllSessions() {
    if (!confirm('Are you sure you want to log out of all other devices? You will remain logged in on this device.')) {
      return;
    }
    
    revokingAll = true;
    try {
      await api.delete('/auth/sessions');
      // Keep only the current session
      sessions = sessions.filter(s => s.is_current);
    } catch (err) {
      console.error('Failed to revoke all sessions:', err);
      error = 'Failed to log out of all sessions';
    } finally {
      revokingAll = false;
    }
  }
  
  function getDeviceIcon(type: string): string {
    switch (type) {
      case 'mobile': return '📱';
      case 'tablet': return '📲';
      case 'desktop': return '🖥️';
      default: return '💻';
    }
  }
  
  function formatLastUsed(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString();
  }
  
  function getLocation(session: Session): string {
    if (session.location_city && session.location_country) {
      return `${session.location_city}, ${session.location_country}`;
    }
    if (session.location_country) {
      return session.location_country;
    }
    return 'Unknown location';
  }
</script>

<div class="device-management">
  <div class="flex justify-between items-center mb-4">
    <div>
      <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Active Sessions</h2>
      <p class="text-sm text-[var(--text-secondary)] mt-1">
        Manage your active sessions across devices. Logging out will require you to sign in again on that device.
      </p>
    </div>
    {#if sessions.length > 1}
      <button
        class="px-4 py-2 rounded text-sm font-medium text-white bg-[var(--status-danger)] hover:bg-[#d62f33] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        on:click={revokeAllSessions}
        disabled={revokingAll}
      >
        {revokingAll ? 'Logging out...' : 'Log Out All Other Devices'}
      </button>
    {/if}
  </div>
  
  {#if error}
    <div class="bg-[rgba(242,63,67,0.1)] border border-[var(--status-danger)] rounded-lg p-4 mb-4 text-[var(--status-danger)]">
      {error}
      <button class="ml-2 underline" on:click={loadSessions}>Retry</button>
    </div>
  {/if}
  
  {#if loading}
    <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center">
      <div class="w-6 h-6 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
      <span class="text-[var(--text-muted)]">Loading sessions...</span>
    </div>
  {:else if sessions.length === 0}
    <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center">
      <span class="text-2xl mb-2">🔐</span>
      <p class="text-[var(--text-muted)]">No active sessions found</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each sessions as session (session.id)}
        <div class="bg-[var(--bg-secondary)] rounded-lg p-4 {session.is_current ? 'ring-2 ring-[var(--brand-primary)]' : ''}">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span class="text-2xl flex-shrink-0 mt-1" role="img" aria-label={session.device_type}>
                {getDeviceIcon(session.device_type)}
              </span>
              
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-medium text-[var(--text-primary)]">{session.device_name}</h3>
                  {#if session.is_current}
                    <span class="px-2 py-0.5 bg-[var(--brand-primary)] text-white text-xs rounded-full">
                      Current
                    </span>
                  {/if}
                </div>
                
                <div class="mt-1 text-sm text-[var(--text-secondary)]">
                  {#if session.browser && session.os}
                    <span>{session.browser}</span>
                    {#if session.browser_version}
                      <span class="text-[var(--text-muted)]"> v{session.browser_version}</span>
                    {/if}
                    <span class="mx-1">·</span>
                    <span>{session.os}</span>
                    {#if session.os_version}
                      <span class="text-[var(--text-muted)]"> {session.os_version}</span>
                    {/if}
                  {/if}
                </div>
                
                <div class="mt-1 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span title="Last active">
                    🕐 {formatLastUsed(session.last_used)}
                  </span>
                  {#if session.location_city || session.location_country}
                    <span title="Location">
                      📍 {getLocation(session)}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            
            {#if !session.is_current}
              <button
                class="px-3 py-1.5 rounded text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-modifier-accent)] hover:bg-[var(--bg-modifier-selected)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                on:click={() => revokeSession(session.id)}
                disabled={revokingSession === session.id}
              >
                {revokingSession === session.id ? 'Logging out...' : 'Log Out'}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  
  <div class="mt-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
    <h3 class="font-medium text-[var(--text-primary)] mb-2">Security Tips</h3>
    <ul class="text-sm text-[var(--text-secondary)] space-y-1">
      <li>• If you see a device you don't recognize, log it out immediately</li>
      <li>• Consider changing your password if you notice suspicious activity</li>
      <li>• Enable Two-Factor Authentication for additional security</li>
    </ul>
  </div>
</div>
