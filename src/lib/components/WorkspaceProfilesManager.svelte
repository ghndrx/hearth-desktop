<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { writable, derived, get } from 'svelte/store';

  const dispatch = createEventDispatcher();

  // Types
  interface WindowState {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
    fullscreen: boolean;
  }

  interface WorkspaceProfile {
    id: string;
    name: string;
    description: string;
    icon: string;
    createdAt: string;
    updatedAt: string;
    isDefault: boolean;
    config: {
      windowState: WindowState;
      theme: string;
      sidebarWidth: number;
      sidebarCollapsed: boolean;
      activePanels: string[];
      pinnedChannels: string[];
      focusModeEnabled: boolean;
      notificationsEnabled: boolean;
      soundEnabled: boolean;
      zoomLevel: number;
      fontSize: string;
      compactMode: boolean;
      customCSS?: string;
    };
  }

  interface ProfilesState {
    profiles: WorkspaceProfile[];
    activeProfileId: string | null;
    lastSwitched: string | null;
  }

  // Props
  export let visible = false;
  export let autoSave = true;
  export let autoSaveInterval = 30000; // 30 seconds

  // State
  const profiles = writable<WorkspaceProfile[]>([]);
  const activeProfileId = writable<string | null>(null);
  const loading = writable(false);
  const error = writable<string | null>(null);
  const editingProfile = writable<WorkspaceProfile | null>(null);
  const showCreateModal = writable(false);
  const showDeleteConfirm = writable<string | null>(null);
  const searchQuery = writable('');
  const hasUnsavedChanges = writable(false);

  // New profile form
  let newProfileName = '';
  let newProfileDescription = '';
  let newProfileIcon = '💼';

  // Available icons for profiles
  const profileIcons = ['💼', '🏠', '🎮', '📚', '🎨', '💻', '🔧', '🎯', '🌙', '☀️', '🎵', '📝', '🔬', '🚀', '⚡', '🌟'];

  // Derived stores
  const activeProfile = derived(
    [profiles, activeProfileId],
    ([$profiles, $activeProfileId]) => $profiles.find(p => p.id === $activeProfileId) ?? null
  );

  const filteredProfiles = derived(
    [profiles, searchQuery],
    ([$profiles, $query]) => {
      if (!$query.trim()) return $profiles;
      const lower = $query.toLowerCase();
      return $profiles.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
      );
    }
  );

  const sortedProfiles = derived(
    filteredProfiles,
    $filtered => [...$filtered].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
  );

  // Auto-save interval
  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await loadProfiles();
    
    if (autoSave) {
      autoSaveTimer = setInterval(async () => {
        if (get(hasUnsavedChanges) && get(activeProfileId)) {
          await saveCurrentProfile();
        }
      }, autoSaveInterval);
    }

    // Listen for workspace changes
    window.addEventListener('workspace-changed', handleWorkspaceChange);
  });

  onDestroy(() => {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
    }
    window.removeEventListener('workspace-changed', handleWorkspaceChange);
  });

  function handleWorkspaceChange() {
    hasUnsavedChanges.set(true);
  }

  async function loadProfiles() {
    loading.set(true);
    error.set(null);
    
    try {
      const state: ProfilesState = await invoke('load_workspace_profiles');
      profiles.set(state.profiles);
      activeProfileId.set(state.activeProfileId);
      
      dispatch('profiles-loaded', { profiles: state.profiles });
    } catch (err) {
      console.error('Failed to load workspace profiles:', err);
      error.set(`Failed to load profiles: ${err}`);
      
      // Initialize with default profile if none exist
      const defaultProfile = createDefaultProfile();
      profiles.set([defaultProfile]);
      activeProfileId.set(defaultProfile.id);
    } finally {
      loading.set(false);
    }
  }

  function createDefaultProfile(): WorkspaceProfile {
    return {
      id: crypto.randomUUID(),
      name: 'Default',
      description: 'Default workspace configuration',
      icon: '🏠',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: true,
      config: {
        windowState: { x: 100, y: 100, width: 1200, height: 800, maximized: false, fullscreen: false },
        theme: 'system',
        sidebarWidth: 240,
        sidebarCollapsed: false,
        activePanels: ['chat', 'members'],
        pinnedChannels: [],
        focusModeEnabled: false,
        notificationsEnabled: true,
        soundEnabled: true,
        zoomLevel: 100,
        fontSize: 'medium',
        compactMode: false,
      },
    };
  }

  async function captureCurrentWorkspace(): Promise<WorkspaceProfile['config']> {
    try {
      const config = await invoke<WorkspaceProfile['config']>('capture_workspace_state');
      return config;
    } catch (err) {
      console.error('Failed to capture workspace state:', err);
      // Return current active profile config or default
      const active = get(activeProfile);
      return active?.config ?? createDefaultProfile().config;
    }
  }

  async function createProfile() {
    if (!newProfileName.trim()) {
      error.set('Profile name is required');
      return;
    }

    loading.set(true);
    error.set(null);

    try {
      const config = await captureCurrentWorkspace();
      
      const newProfile: WorkspaceProfile = {
        id: crypto.randomUUID(),
        name: newProfileName.trim(),
        description: newProfileDescription.trim(),
        icon: newProfileIcon,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: false,
        config,
      };

      await invoke('save_workspace_profile', { profile: newProfile });
      
      profiles.update(p => [...p, newProfile]);
      
      // Reset form
      newProfileName = '';
      newProfileDescription = '';
      newProfileIcon = '💼';
      showCreateModal.set(false);
      
      dispatch('profile-created', { profile: newProfile });
    } catch (err) {
      console.error('Failed to create profile:', err);
      error.set(`Failed to create profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function switchProfile(profileId: string) {
    if (profileId === get(activeProfileId)) return;

    loading.set(true);
    error.set(null);

    try {
      // Save current profile before switching
      if (get(hasUnsavedChanges)) {
        await saveCurrentProfile();
      }

      const profile = get(profiles).find(p => p.id === profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      await invoke('apply_workspace_profile', { profile });
      
      activeProfileId.set(profileId);
      hasUnsavedChanges.set(false);
      
      await invoke('set_active_profile_id', { profileId });
      
      dispatch('profile-switched', { profile });
    } catch (err) {
      console.error('Failed to switch profile:', err);
      error.set(`Failed to switch profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function saveCurrentProfile() {
    const currentId = get(activeProfileId);
    if (!currentId) return;

    try {
      const config = await captureCurrentWorkspace();
      
      profiles.update(ps => ps.map(p => {
        if (p.id === currentId) {
          return {
            ...p,
            config,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      }));

      const updatedProfile = get(profiles).find(p => p.id === currentId);
      if (updatedProfile) {
        await invoke('save_workspace_profile', { profile: updatedProfile });
      }

      hasUnsavedChanges.set(false);
      dispatch('profile-saved', { profileId: currentId });
    } catch (err) {
      console.error('Failed to save profile:', err);
      error.set(`Failed to save profile: ${err}`);
    }
  }

  async function updateProfile(profile: WorkspaceProfile) {
    loading.set(true);
    error.set(null);

    try {
      const updated = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };

      await invoke('save_workspace_profile', { profile: updated });
      
      profiles.update(ps => ps.map(p => p.id === updated.id ? updated : p));
      editingProfile.set(null);
      
      dispatch('profile-updated', { profile: updated });
    } catch (err) {
      console.error('Failed to update profile:', err);
      error.set(`Failed to update profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function deleteProfile(profileId: string) {
    const profile = get(profiles).find(p => p.id === profileId);
    if (!profile) return;
    
    if (profile.isDefault) {
      error.set('Cannot delete the default profile');
      return;
    }

    loading.set(true);
    error.set(null);

    try {
      await invoke('delete_workspace_profile', { profileId });
      
      profiles.update(ps => ps.filter(p => p.id !== profileId));
      
      // Switch to default if deleted was active
      if (get(activeProfileId) === profileId) {
        const defaultProfile = get(profiles).find(p => p.isDefault);
        if (defaultProfile) {
          await switchProfile(defaultProfile.id);
        }
      }

      showDeleteConfirm.set(null);
      dispatch('profile-deleted', { profileId });
    } catch (err) {
      console.error('Failed to delete profile:', err);
      error.set(`Failed to delete profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function duplicateProfile(profileId: string) {
    const profile = get(profiles).find(p => p.id === profileId);
    if (!profile) return;

    loading.set(true);
    error.set(null);

    try {
      const duplicated: WorkspaceProfile = {
        ...profile,
        id: crypto.randomUUID(),
        name: `${profile.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDefault: false,
      };

      await invoke('save_workspace_profile', { profile: duplicated });
      
      profiles.update(ps => [...ps, duplicated]);
      
      dispatch('profile-duplicated', { original: profile, duplicate: duplicated });
    } catch (err) {
      console.error('Failed to duplicate profile:', err);
      error.set(`Failed to duplicate profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function setDefaultProfile(profileId: string) {
    loading.set(true);
    error.set(null);

    try {
      profiles.update(ps => ps.map(p => ({
        ...p,
        isDefault: p.id === profileId,
        updatedAt: p.id === profileId ? new Date().toISOString() : p.updatedAt,
      })));

      // Save all profiles with updated default status
      for (const profile of get(profiles)) {
        await invoke('save_workspace_profile', { profile });
      }
      
      dispatch('default-changed', { profileId });
    } catch (err) {
      console.error('Failed to set default profile:', err);
      error.set(`Failed to set default profile: ${err}`);
    } finally {
      loading.set(false);
    }
  }

  async function exportProfile(profileId: string) {
    const profile = get(profiles).find(p => p.id === profileId);
    if (!profile) return;

    try {
      const json = JSON.stringify(profile, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-profile-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      dispatch('profile-exported', { profile });
    } catch (err) {
      console.error('Failed to export profile:', err);
      error.set(`Failed to export profile: ${err}`);
    }
  }

  async function importProfile() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        loading.set(true);
        error.set(null);

        try {
          const text = await file.text();
          const imported = JSON.parse(text) as WorkspaceProfile;
          
          // Generate new ID and update timestamps
          const profile: WorkspaceProfile = {
            ...imported,
            id: crypto.randomUUID(),
            name: `${imported.name} (Imported)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDefault: false,
          };

          await invoke('save_workspace_profile', { profile });
          
          profiles.update(ps => [...ps, profile]);
          
          dispatch('profile-imported', { profile });
        } catch (err) {
          console.error('Failed to import profile:', err);
          error.set(`Failed to import profile: Invalid file format`);
        } finally {
          loading.set(false);
        }
      };

      input.click();
    } catch (err) {
      console.error('Failed to import profile:', err);
      error.set(`Failed to import profile: ${err}`);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function close() {
    visible = false;
    dispatch('close');
  }
</script>

{#if visible}
  <div
    class="workspace-profiles-manager"
    role="dialog"
    aria-labelledby="profiles-title"
    aria-modal="true"
  >
    <div class="profiles-overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} />
    
    <div class="profiles-panel">
      <header class="profiles-header">
        <h2 id="profiles-title">
          <span class="header-icon">🗂️</span>
          Workspace Profiles
        </h2>
        <button class="close-btn" on:click={close} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
          </svg>
        </button>
      </header>

      {#if $error}
        <div class="error-banner" role="alert">
          <span>⚠️</span>
          <span>{$error}</span>
          <button on:click={() => error.set(null)}>Dismiss</button>
        </div>
      {/if}

      <div class="profiles-toolbar">
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search profiles..."
            bind:value={$searchQuery}
          />
        </div>
        
        <div class="toolbar-actions">
          <button class="btn btn-secondary" on:click={importProfile}>
            <span>📥</span> Import
          </button>
          <button class="btn btn-primary" on:click={() => showCreateModal.set(true)}>
            <span>➕</span> New Profile
          </button>
        </div>
      </div>

      {#if $hasUnsavedChanges && $activeProfile}
        <div class="unsaved-changes-banner">
          <span>💾</span>
          <span>You have unsaved changes in "{$activeProfile.name}"</span>
          <button class="btn btn-sm" on:click={saveCurrentProfile}>Save Now</button>
        </div>
      {/if}

      <div class="profiles-list">
        {#if $loading}
          <div class="loading-state">
            <div class="spinner" />
            <span>Loading profiles...</span>
          </div>
        {:else if $sortedProfiles.length === 0}
          <div class="empty-state">
            <span class="empty-icon">📁</span>
            <p>No profiles found</p>
            <button class="btn btn-primary" on:click={() => showCreateModal.set(true)}>
              Create your first profile
            </button>
          </div>
        {:else}
          {#each $sortedProfiles as profile (profile.id)}
            <div
              class="profile-card"
              class:active={profile.id === $activeProfileId}
              class:default={profile.isDefault}
            >
              <div class="profile-icon">{profile.icon}</div>
              
              <div class="profile-info">
                <div class="profile-name">
                  {profile.name}
                  {#if profile.isDefault}
                    <span class="default-badge">Default</span>
                  {/if}
                  {#if profile.id === $activeProfileId}
                    <span class="active-badge">Active</span>
                  {/if}
                </div>
                {#if profile.description}
                  <div class="profile-description">{profile.description}</div>
                {/if}
                <div class="profile-meta">
                  Updated {formatDate(profile.updatedAt)}
                </div>
              </div>

              <div class="profile-actions">
                {#if profile.id !== $activeProfileId}
                  <button
                    class="btn btn-primary btn-sm"
                    on:click={() => switchProfile(profile.id)}
                    disabled={$loading}
                  >
                    Switch
                  </button>
                {:else}
                  <button
                    class="btn btn-secondary btn-sm"
                    on:click={saveCurrentProfile}
                    disabled={$loading}
                  >
                    💾 Save
                  </button>
                {/if}
                
                <div class="dropdown">
                  <button class="btn btn-icon" aria-label="More actions">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/>
                    </svg>
                  </button>
                  <div class="dropdown-menu">
                    <button on:click={() => editingProfile.set(profile)}>
                      ✏️ Edit
                    </button>
                    <button on:click={() => duplicateProfile(profile.id)}>
                      📋 Duplicate
                    </button>
                    <button on:click={() => exportProfile(profile.id)}>
                      📤 Export
                    </button>
                    {#if !profile.isDefault}
                      <button on:click={() => setDefaultProfile(profile.id)}>
                        ⭐ Set as Default
                      </button>
                      <hr />
                      <button class="danger" on:click={() => showDeleteConfirm.set(profile.id)}>
                        🗑️ Delete
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <footer class="profiles-footer">
        <span class="profile-count">
          {$profiles.length} profile{$profiles.length !== 1 ? 's' : ''}
        </span>
        {#if autoSave}
          <span class="auto-save-indicator">
            🔄 Auto-save enabled
          </span>
        {/if}
      </footer>
    </div>

    <!-- Create Profile Modal -->
    {#if $showCreateModal}
      <div class="modal-overlay" on:click={() => showCreateModal.set(false)} on:keydown={(e) => e.key === 'Escape' && showCreateModal.set(false)}>
        <div class="modal" on:click|stopPropagation role="dialog" aria-labelledby="create-title">
          <h3 id="create-title">Create New Profile</h3>
          
          <div class="form-group">
            <label for="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              bind:value={newProfileName}
              placeholder="e.g., Work, Gaming, Focus"
            />
          </div>

          <div class="form-group">
            <label for="profile-desc">Description (optional)</label>
            <textarea
              id="profile-desc"
              bind:value={newProfileDescription}
              placeholder="Describe this workspace configuration..."
              rows="2"
            />
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div class="icon-picker">
              {#each profileIcons as icon}
                <button
                  class="icon-option"
                  class:selected={newProfileIcon === icon}
                  on:click={() => newProfileIcon = icon}
                >
                  {icon}
                </button>
              {/each}
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" on:click={() => showCreateModal.set(false)}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              on:click={createProfile}
              disabled={!newProfileName.trim() || $loading}
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Edit Profile Modal -->
    {#if $editingProfile}
      <div class="modal-overlay" on:click={() => editingProfile.set(null)} on:keydown={(e) => e.key === 'Escape' && editingProfile.set(null)}>
        <div class="modal" on:click|stopPropagation role="dialog" aria-labelledby="edit-title">
          <h3 id="edit-title">Edit Profile</h3>
          
          <div class="form-group">
            <label for="edit-name">Name</label>
            <input
              id="edit-name"
              type="text"
              bind:value={$editingProfile.name}
            />
          </div>

          <div class="form-group">
            <label for="edit-desc">Description</label>
            <textarea
              id="edit-desc"
              bind:value={$editingProfile.description}
              rows="2"
            />
          </div>

          <div class="form-group">
            <label>Icon</label>
            <div class="icon-picker">
              {#each profileIcons as icon}
                <button
                  class="icon-option"
                  class:selected={$editingProfile.icon === icon}
                  on:click={() => { if ($editingProfile) $editingProfile.icon = icon; }}
                >
                  {icon}
                </button>
              {/each}
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" on:click={() => editingProfile.set(null)}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              on:click={() => $editingProfile && updateProfile($editingProfile)}
              disabled={$loading}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal -->
    {#if $showDeleteConfirm}
      <div class="modal-overlay" on:click={() => showDeleteConfirm.set(null)} on:keydown={(e) => e.key === 'Escape' && showDeleteConfirm.set(null)}>
        <div class="modal modal-confirm" on:click|stopPropagation role="alertdialog" aria-labelledby="delete-title">
          <h3 id="delete-title">Delete Profile?</h3>
          <p>Are you sure you want to delete this profile? This action cannot be undone.</p>
          
          <div class="modal-actions">
            <button class="btn btn-secondary" on:click={() => showDeleteConfirm.set(null)}>
              Cancel
            </button>
            <button
              class="btn btn-danger"
              on:click={() => $showDeleteConfirm && deleteProfile($showDeleteConfirm)}
              disabled={$loading}
            >
              Delete Profile
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .workspace-profiles-manager {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profiles-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .profiles-panel {
    position: relative;
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    background: var(--bg-primary, #1e1e1e);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .profiles-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .profiles-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    font-size: 24px;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-hover, #333);
    color: var(--text-primary, #fff);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--error-bg, #4a1515);
    color: var(--error-text, #ff6b6b);
    font-size: 14px;
  }

  .error-banner button {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .profiles-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 6px;
    padding: 8px 12px;
  }

  .search-box svg {
    color: var(--text-secondary, #888);
    flex-shrink: 0;
  }

  .search-box input {
    flex: 1;
    background: none;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 14px;
    outline: none;
  }

  .toolbar-actions {
    display: flex;
    gap: 8px;
  }

  .unsaved-changes-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--warning-bg, #3d3520);
    color: var(--warning-text, #f5a623);
    font-size: 13px;
  }

  .profiles-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--text-secondary, #888);
    gap: 12px;
  }

  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color, #333);
    border-top-color: var(--accent, #7289da);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .profile-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-secondary, #2a2a2a);
    border-radius: 8px;
    margin-bottom: 8px;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .profile-card:hover {
    background: var(--bg-hover, #333);
  }

  .profile-card.active {
    border-color: var(--accent, #7289da);
    background: var(--accent-bg, #2d3748);
  }

  .profile-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-name {
    font-weight: 600;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .default-badge,
  .active-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .default-badge {
    background: var(--warning-bg, #3d3520);
    color: var(--warning-text, #f5a623);
  }

  .active-badge {
    background: var(--success-bg, #1a3d1a);
    color: var(--success-text, #4caf50);
  }

  .profile-description {
    font-size: 13px;
    color: var(--text-secondary, #888);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-meta {
    font-size: 11px;
    color: var(--text-tertiary, #666);
    margin-top: 4px;
  }

  .profile-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dropdown {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    margin-top: 4px;
    background: var(--bg-elevated, #333);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    padding: 4px;
    min-width: 160px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-8px);
    transition: all 0.2s;
    z-index: 10;
  }

  .dropdown:hover .dropdown-menu,
  .dropdown:focus-within .dropdown-menu {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .dropdown-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--text-primary, #fff);
    font-size: 13px;
    text-align: left;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dropdown-menu button:hover {
    background: var(--bg-hover, #444);
  }

  .dropdown-menu button.danger {
    color: var(--error-text, #ff6b6b);
  }

  .dropdown-menu hr {
    border: none;
    border-top: 1px solid var(--border-color, #444);
    margin: 4px 0;
  }

  .profiles-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid var(--border-color, #333);
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .auto-save-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--success-text, #4caf50);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent, #7289da);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #5b6eae);
  }

  .btn-secondary {
    background: var(--bg-secondary, #2a2a2a);
    color: var(--text-primary, #fff);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-hover, #333);
  }

  .btn-danger {
    background: var(--error, #e74c3c);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #c0392b;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }

  .btn-icon {
    padding: 6px;
    background: var(--bg-secondary, #2a2a2a);
    color: var(--text-secondary, #888);
    border-radius: 4px;
  }

  .btn-icon:hover {
    background: var(--bg-hover, #333);
    color: var(--text-primary, #fff);
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
  }

  .modal {
    background: var(--bg-primary, #1e1e1e);
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .modal h3 {
    margin: 0 0 20px;
    font-size: 18px;
  }

  .modal-confirm p {
    color: var(--text-secondary, #888);
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
    color: var(--text-secondary, #888);
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-secondary, #2a2a2a);
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    color: var(--text-primary, #fff);
    font-size: 14px;
    resize: vertical;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--accent, #7289da);
  }

  .icon-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .icon-option {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: var(--bg-secondary, #2a2a2a);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-option:hover {
    background: var(--bg-hover, #333);
  }

  .icon-option.selected {
    border-color: var(--accent, #7289da);
    background: var(--accent-bg, #2d3748);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
  }
</style>
