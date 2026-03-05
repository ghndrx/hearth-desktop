<script lang="ts">
  import { onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import { fade, slide } from 'svelte/transition';

  interface SoundAssignment {
    sound_id: string;
    volume: number;
    enabled: boolean;
  }

  interface SoundProfile {
    id: string;
    name: string;
    icon: string;
    is_builtin: boolean;
    message: SoundAssignment;
    mention: SoundAssignment;
    direct_message: SoundAssignment;
    voice_join: SoundAssignment;
    voice_leave: SoundAssignment;
    call_ring: SoundAssignment;
    notification: SoundAssignment;
  }

  interface SoundProfileState {
    active_profile_id: string;
    profiles: SoundProfile[];
  }

  const builtInSounds = [
    { id: 'none', name: 'None' },
    { id: 'pop', name: 'Pop' },
    { id: 'ping', name: 'Ping' },
    { id: 'chime', name: 'Chime' },
    { id: 'bell', name: 'Bell' },
    { id: 'ding', name: 'Ding' },
    { id: 'swoosh', name: 'Swoosh' },
    { id: 'bubble', name: 'Bubble' },
    { id: 'join', name: 'Join' },
    { id: 'leave', name: 'Leave' },
    { id: 'ring', name: 'Ring' },
  ];

  const eventTypes: { key: string; label: string; description: string }[] = [
    { key: 'message', label: 'Message', description: 'New messages in channels' },
    { key: 'mention', label: 'Mention', description: 'When someone mentions you' },
    { key: 'direct_message', label: 'Direct Message', description: 'New DMs received' },
    { key: 'voice_join', label: 'Voice Join', description: 'Someone joins voice chat' },
    { key: 'voice_leave', label: 'Voice Leave', description: 'Someone leaves voice chat' },
    { key: 'call_ring', label: 'Incoming Call', description: 'Someone calls you' },
    { key: 'notification', label: 'General', description: 'Other notifications' },
  ];

  const profileIcons: Record<string, string> = {
    'speaker': '\u{1F50A}',
    'volume-low': '\u{1F509}',
    'target': '\u{1F3AF}',
    'gamepad': '\u{1F3AE}',
    'star': '\u{2B50}',
    'moon': '\u{1F319}',
    'headphones': '\u{1F3A7}',
    'music': '\u{1F3B5}',
  };

  // State
  const state = writable<SoundProfileState | null>(null);
  const editingProfile = writable<SoundProfile | null>(null);
  const showCreateDialog = writable(false);
  const isLoading = writable(true);

  let newProfileName = '';
  let newProfileIcon = 'star';
  let baseProfileId = 'default';

  // Derived
  const activeProfile = derived(state, ($state) => {
    if (!$state) return null;
    return $state.profiles.find(p => p.id === $state.active_profile_id) || $state.profiles[0];
  });

  const profiles = derived(state, ($state) => $state?.profiles || []);

  // API functions
  async function loadState() {
    try {
      const result = await invoke<SoundProfileState>('soundprofile_get_state');
      state.set(result);
    } catch (err) {
      console.error('Failed to load sound profiles:', err);
    } finally {
      isLoading.set(false);
    }
  }

  async function setActiveProfile(profileId: string) {
    try {
      const result = await invoke<SoundProfileState>('soundprofile_set_active', { profileId });
      state.set(result);
    } catch (err) {
      console.error('Failed to set active profile:', err);
    }
  }

  async function createProfile() {
    if (!newProfileName.trim()) return;
    try {
      const result = await invoke<SoundProfileState>('soundprofile_create', {
        name: newProfileName.trim(),
        icon: newProfileIcon,
        baseProfileId,
      });
      state.set(result);
      showCreateDialog.set(false);
      newProfileName = '';
      newProfileIcon = 'star';
    } catch (err) {
      console.error('Failed to create profile:', err);
    }
  }

  async function deleteProfile(profileId: string) {
    try {
      const result = await invoke<SoundProfileState>('soundprofile_delete', { profileId });
      state.set(result);
      if ($editingProfile?.id === profileId) {
        editingProfile.set(null);
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  }

  async function saveProfile(profile: SoundProfile) {
    try {
      const result = await invoke<SoundProfileState>('soundprofile_update', { profile });
      state.set(result);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }

  async function duplicateProfile(profileId: string) {
    const source = $profiles.find(p => p.id === profileId);
    if (!source) return;
    try {
      const result = await invoke<SoundProfileState>('soundprofile_duplicate', {
        profileId,
        newName: `${source.name} (Copy)`,
      });
      state.set(result);
    } catch (err) {
      console.error('Failed to duplicate profile:', err);
    }
  }

  function startEditing(profile: SoundProfile) {
    editingProfile.set(JSON.parse(JSON.stringify(profile)));
  }

  function cancelEditing() {
    editingProfile.set(null);
  }

  async function finishEditing() {
    if ($editingProfile) {
      await saveProfile($editingProfile);
      editingProfile.set(null);
    }
  }

  function updateEditingSound(eventKey: string, field: string, value: any) {
    editingProfile.update(p => {
      if (!p) return p;
      const assignment = p[eventKey as keyof SoundProfile] as SoundAssignment;
      if (field === 'sound_id') assignment.sound_id = value;
      else if (field === 'volume') assignment.volume = parseFloat(value);
      else if (field === 'enabled') assignment.enabled = value;
      return { ...p, [eventKey]: assignment };
    });
  }

  function previewSound(soundId: string, volume: number) {
    if (soundId === 'none') return;
    try {
      const audio = new Audio(`/sounds/${soundId}.mp3`);
      audio.volume = volume;
      audio.play().catch(() => {});
    } catch {
      // Sound preview not available
    }
  }

  onMount(() => {
    loadState();
  });
</script>

<div class="sound-profile-manager">
  <div class="manager-header">
    <h3>Sound Profiles</h3>
    <p class="description">Manage notification sounds for different contexts</p>
  </div>

  {#if $isLoading}
    <div class="loading">Loading profiles...</div>
  {:else if $state}
    <!-- Profile Selector -->
    <div class="profile-selector">
      <span class="selector-label">Active Profile</span>
      <div class="profile-cards">
        {#each $profiles as profile (profile.id)}
          <button
            class="profile-card"
            class:active={$state.active_profile_id === profile.id}
            on:click={() => setActiveProfile(profile.id)}
          >
            <span class="profile-icon">{profileIcons[profile.icon] || profileIcons['speaker']}</span>
            <span class="profile-name">{profile.name}</span>
            {#if $state.active_profile_id === profile.id}
              <span class="active-badge">Active</span>
            {/if}
          </button>
        {/each}
        <button class="profile-card add-card" on:click={() => showCreateDialog.set(true)}>
          <span class="profile-icon">+</span>
          <span class="profile-name">New</span>
        </button>
      </div>
    </div>

    <!-- Active Profile Details -->
    {#if $activeProfile && !$editingProfile}
      <div class="profile-detail" transition:fade={{ duration: 150 }}>
        <div class="detail-header">
          <div class="detail-title">
            <span class="detail-icon">{profileIcons[$activeProfile.icon] || profileIcons['speaker']}</span>
            <h4>{$activeProfile.name}</h4>
          </div>
          <div class="detail-actions">
            <button class="action-btn" on:click={() => startEditing($activeProfile)}>Edit</button>
            <button class="action-btn" on:click={() => duplicateProfile($activeProfile.id)}>Duplicate</button>
            {#if !$activeProfile.is_builtin}
              <button class="action-btn danger" on:click={() => deleteProfile($activeProfile.id)}>Delete</button>
            {/if}
          </div>
        </div>

        <div class="sound-list">
          {#each eventTypes as evt}
            {@const assignment = $activeProfile[evt.key as keyof SoundProfile] as SoundAssignment}
            <div class="sound-row" class:disabled={!assignment.enabled}>
              <div class="sound-info">
                <span class="event-label">{evt.label}</span>
                <span class="event-desc">{evt.description}</span>
              </div>
              <div class="sound-value">
                <span class="sound-name">
                  {#if assignment.enabled}
                    {builtInSounds.find(s => s.id === assignment.sound_id)?.name || assignment.sound_id}
                  {:else}
                    Off
                  {/if}
                </span>
                {#if assignment.enabled}
                  <span class="volume-indicator" title="Volume: {Math.round(assignment.volume * 100)}%">
                    <span class="volume-bar">
                      <span class="volume-fill" style="width: {assignment.volume * 100}%"></span>
                    </span>
                  </span>
                  <button
                    class="preview-btn"
                    on:click|stopPropagation={() => previewSound(assignment.sound_id, assignment.volume)}
                    title="Preview sound"
                  >
                    &#9654;
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Editing Mode -->
    {#if $editingProfile}
      <div class="profile-editor" transition:slide={{ duration: 200 }}>
        <div class="editor-header">
          <h4>Editing: {$editingProfile.name}</h4>
          <div class="editor-actions">
            <button class="action-btn" on:click={cancelEditing}>Cancel</button>
            <button class="action-btn primary" on:click={finishEditing}>Save</button>
          </div>
        </div>

        {#if !$editingProfile.is_builtin}
          <div class="edit-meta">
            <label class="edit-field">
              <span>Name</span>
              <input
                type="text"
                bind:value={$editingProfile.name}
                placeholder="Profile name"
                class="text-input"
              />
            </label>
            <label class="edit-field">
              <span>Icon</span>
              <div class="icon-picker">
                {#each Object.entries(profileIcons) as [key, emoji]}
                  <button
                    class="icon-option"
                    class:selected={$editingProfile.icon === key}
                    on:click={() => { if ($editingProfile) $editingProfile.icon = key; }}
                  >
                    {emoji}
                  </button>
                {/each}
              </div>
            </label>
          </div>
        {/if}

        <div class="sound-editor-list">
          {#each eventTypes as evt}
            {@const assignment = $editingProfile[evt.key as keyof SoundProfile] as SoundAssignment}
            <div class="sound-editor-row">
              <div class="editor-row-header">
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    checked={assignment.enabled}
                    on:change={(e) => updateEditingSound(evt.key, 'enabled', e.currentTarget.checked)}
                  />
                  <span class="event-label">{evt.label}</span>
                </label>
              </div>
              {#if assignment.enabled}
                <div class="editor-row-controls" transition:slide={{ duration: 150 }}>
                  <div class="control-group">
                    <label class="control-label">Sound</label>
                    <select
                      value={assignment.sound_id}
                      on:change={(e) => updateEditingSound(evt.key, 'sound_id', e.currentTarget.value)}
                      class="sound-select"
                    >
                      {#each builtInSounds as sound}
                        <option value={sound.id}>{sound.name}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="control-group volume-group">
                    <label class="control-label">Volume ({Math.round(assignment.volume * 100)}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={assignment.volume}
                      on:input={(e) => updateEditingSound(evt.key, 'volume', e.currentTarget.value)}
                      class="volume-slider"
                    />
                  </div>
                  <button
                    class="preview-btn-editor"
                    on:click={() => previewSound(assignment.sound_id, assignment.volume)}
                    title="Preview"
                  >
                    &#9654; Preview
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Create Dialog -->
    {#if $showCreateDialog}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="overlay" on:click|self={() => showCreateDialog.set(false)} transition:fade={{ duration: 100 }}>
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="create-dialog" on:click|stopPropagation>
          <h4>Create Sound Profile</h4>
          <label class="edit-field">
            <span>Name</span>
            <input
              type="text"
              bind:value={newProfileName}
              placeholder="My Profile"
              class="text-input"
              autofocus
            />
          </label>
          <label class="edit-field">
            <span>Icon</span>
            <div class="icon-picker">
              {#each Object.entries(profileIcons) as [key, emoji]}
                <button
                  class="icon-option"
                  class:selected={newProfileIcon === key}
                  on:click={() => newProfileIcon = key}
                >
                  {emoji}
                </button>
              {/each}
            </div>
          </label>
          <label class="edit-field">
            <span>Based on</span>
            <select bind:value={baseProfileId} class="sound-select">
              {#each $profiles as profile}
                <option value={profile.id}>{profile.name}</option>
              {/each}
            </select>
          </label>
          <div class="dialog-actions">
            <button class="action-btn" on:click={() => showCreateDialog.set(false)}>Cancel</button>
            <button
              class="action-btn primary"
              on:click={createProfile}
              disabled={!newProfileName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .sound-profile-manager {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 20px;
    color: var(--text-primary, #dcddde);
    max-width: 640px;
  }

  .manager-header h3 {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal, #fff);
  }

  .description {
    margin: 0 0 20px 0;
    font-size: 13px;
    color: var(--text-muted, #72767d);
  }

  .loading {
    text-align: center;
    padding: 32px;
    color: var(--text-muted, #72767d);
  }

  /* Profile Selector */
  .profile-selector {
    margin-bottom: 20px;
  }

  .selector-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #72767d);
    margin-bottom: 8px;
  }

  .profile-cards {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    background: var(--bg-tertiary, #202225);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 80px;
    color: var(--text-primary, #dcddde);
    font-family: inherit;
    font-size: inherit;
  }

  .profile-card:hover {
    background: var(--bg-modifier-hover, #32353b);
    border-color: var(--bg-modifier-accent, #4f545c);
  }

  .profile-card.active {
    border-color: var(--brand-primary, #5865f2);
    background: var(--bg-modifier-selected, #393c43);
  }

  .profile-card.add-card {
    border-style: dashed;
    border-color: var(--bg-modifier-accent, #4f545c);
    opacity: 0.7;
  }

  .profile-card.add-card:hover {
    opacity: 1;
  }

  .profile-icon {
    font-size: 20px;
  }

  .profile-name {
    font-size: 12px;
    font-weight: 500;
  }

  .active-badge {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--brand-primary, #5865f2);
    color: #fff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* Profile Detail */
  .profile-detail {
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 16px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .detail-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .detail-icon {
    font-size: 20px;
  }

  .detail-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .detail-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 6px 12px;
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary, #dcddde);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .action-btn:hover {
    background: var(--bg-modifier-hover, #32353b);
  }

  .action-btn.primary {
    background: var(--brand-primary, #5865f2);
    border-color: var(--brand-primary, #5865f2);
    color: #fff;
  }

  .action-btn.primary:hover {
    background: var(--brand-primary-hover, #4752c4);
  }

  .action-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.danger {
    color: var(--status-red, #ed4245);
    border-color: var(--status-red, #ed4245);
  }

  .action-btn.danger:hover {
    background: rgba(237, 66, 69, 0.1);
  }

  /* Sound List */
  .sound-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sound-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 4px;
    transition: background 0.1s;
  }

  .sound-row:hover {
    background: var(--bg-modifier-hover, #32353b);
  }

  .sound-row.disabled {
    opacity: 0.5;
  }

  .sound-info {
    display: flex;
    flex-direction: column;
  }

  .event-label {
    font-size: 13px;
    font-weight: 500;
  }

  .event-desc {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .sound-value {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sound-name {
    font-size: 12px;
    color: var(--text-muted, #72767d);
    min-width: 50px;
    text-align: right;
  }

  .volume-indicator {
    width: 48px;
  }

  .volume-bar {
    display: block;
    height: 4px;
    background: var(--bg-secondary, #2f3136);
    border-radius: 2px;
    overflow: hidden;
  }

  .volume-fill {
    display: block;
    height: 100%;
    background: var(--brand-primary, #5865f2);
    border-radius: 2px;
    transition: width 0.2s;
  }

  .preview-btn {
    width: 24px;
    height: 24px;
    border: none;
    background: var(--bg-secondary, #2f3136);
    border-radius: 50%;
    cursor: pointer;
    font-size: 10px;
    color: var(--text-primary, #dcddde);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .preview-btn:hover {
    background: var(--brand-primary, #5865f2);
    color: #fff;
  }

  /* Profile Editor */
  .profile-editor {
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 16px;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .editor-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .editor-actions {
    display: flex;
    gap: 6px;
  }

  .edit-meta {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--bg-modifier-accent, #4f545c);
  }

  .edit-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .edit-field span {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #72767d);
  }

  .text-input {
    background: var(--bg-secondary, #2f3136);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 8px 12px;
    color: var(--text-normal, #dcddde);
    font-size: 14px;
    font-family: inherit;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--brand-primary, #5865f2);
  }

  .icon-picker {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .icon-option {
    width: 36px;
    height: 36px;
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--bg-secondary, #2f3136);
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .icon-option:hover {
    border-color: var(--bg-modifier-accent, #4f545c);
  }

  .icon-option.selected {
    border-color: var(--brand-primary, #5865f2);
    background: var(--bg-modifier-selected, #393c43);
  }

  /* Sound Editor List */
  .sound-editor-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sound-editor-row {
    background: var(--bg-secondary, #2f3136);
    border-radius: 6px;
    padding: 12px;
  }

  .editor-row-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .toggle-label input[type="checkbox"] {
    accent-color: var(--brand-primary, #5865f2);
  }

  .editor-row-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--bg-tertiary, #202225);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .volume-group {
    flex: 1;
  }

  .control-label {
    font-size: 10px;
    color: var(--text-muted, #72767d);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .sound-select {
    background: var(--bg-tertiary, #202225);
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    padding: 4px 8px;
    color: var(--text-primary, #dcddde);
    font-size: 12px;
    font-family: inherit;
  }

  .sound-select:focus {
    outline: none;
    border-color: var(--brand-primary, #5865f2);
  }

  .volume-slider {
    width: 100%;
    accent-color: var(--brand-primary, #5865f2);
  }

  .preview-btn-editor {
    padding: 4px 10px;
    border: 1px solid var(--bg-modifier-accent, #4f545c);
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary, #dcddde);
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    font-family: inherit;
  }

  .preview-btn-editor:hover {
    background: var(--bg-modifier-hover, #32353b);
  }

  /* Create Dialog Overlay */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .create-dialog {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 24px;
    width: 360px;
    max-width: 90vw;
  }

  .create-dialog h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
  }

  .create-dialog .edit-field {
    margin-bottom: 12px;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }
</style>
