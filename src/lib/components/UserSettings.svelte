<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { user, auth } from '$lib/stores/auth';
  import { settings, type Theme, type MessageDisplay, type VoiceInputMode } from '$lib/stores/settings';
  import { pushToTalk, isCapturingPTTKey, formatKeyDisplay, getKeyCode } from '$lib/stores/pushToTalk';
  import Avatar from './Avatar.svelte';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let activeSection = 'account';
  let editingProfile = false;
  let saving = false;
  let uploadingAvatar = false;
  let profileForm = {
    display_name: '',
    bio: '',
    pronouns: ''
  };
  
  const sections = [
    { id: 'divider-user', label: 'User Settings', divider: true },
    { id: 'account', label: 'My Account', icon: 'user' },
    { id: 'profile', label: 'User Profile', icon: 'profile' },
    { id: 'privacy', label: 'Privacy & Safety', icon: 'shield' },
    { id: 'divider-app', label: 'App Settings', divider: true },
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'voice', label: 'Voice & Video', icon: 'microphone' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'keybinds', label: 'Keybinds', icon: 'keyboard' },
    { id: 'divider-other', label: '', divider: true },
    { id: 'about', label: 'About Hearth', icon: 'info' },
    { id: 'logout', label: 'Log Out', icon: 'logout', danger: true }
  ];
  
  $: if (open && $user) {
    profileForm = {
      display_name: $user.display_name || '',
      bio: $user.bio || '',
      pronouns: $user.pronouns || ''
    };
  }
  
  $: appSettings = $settings.app;
  
  function close() {
    open = false;
    editingProfile = false;
    dispatch('close');
  }
  
  function handleKeydown(e: KeyboardEvent) {
    // Handle PTT key capture
    if ($isCapturingPTTKey) {
      handlePTTKeyCapture(e);
      return;
    }
    if (e.key === 'Escape') close();
  }
  
  async function handleSectionClick(id: string) {
    if (id === 'logout') {
      if (confirm('Are you sure you want to log out?')) {
        await auth.logout();
        close();
      }
      return;
    }
    
    if (!id.startsWith('divider')) {
      activeSection = id;
    }
  }
  
  async function saveProfile() {
    saving = true;
    try {
      await auth.updateProfile({
        display_name: profileForm.display_name || null,
        bio: profileForm.bio || null,
        pronouns: profileForm.pronouns || null
      });
      editingProfile = false;
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      saving = false;
    }
  }
  
  async function handleAvatarUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    uploadingAvatar = true;
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/users/@me/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('hearth_token')}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      await auth.updateProfile({ avatar: data.avatar_url });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      uploadingAvatar = false;
    }
  }
  
  function setTheme(theme: Theme) {
    settings.updateApp({ theme });
  }
  
  function setMessageDisplay(display: MessageDisplay) {
    settings.updateApp({ messageDisplay: display });
  }
  
  function toggleSetting(key: keyof typeof appSettings) {
    settings.updateApp({ [key]: !appSettings[key] } as any);
  }

  function getThemePreviewClass(theme: Theme) {
    switch (theme) {
      case 'dark': return 'bg-[#313338]';
      case 'light': return 'bg-white';
      case 'midnight': return 'bg-black';
    }
  }

  function getSidebarPreviewClass(theme: Theme) {
    switch (theme) {
      case 'dark': return 'bg-[#1e1f22]';
      case 'light': return 'bg-[#f2f3f5]';
      case 'midnight': return 'bg-[#0a0a0a]';
    }
  }

  function getMessagePreviewClass(theme: Theme) {
    switch (theme) {
      case 'dark': return 'bg-[#2b2d31]';
      case 'light': return 'bg-[#e3e5e8]';
      case 'midnight': return 'bg-[#1a1a1a]';
    }
  }

  // Voice settings
  $: voiceSettings = appSettings.voice;

  function setInputMode(mode: VoiceInputMode) {
    settings.updateVoice({ inputMode: mode });
  }

  function toggleVoiceSetting(key: keyof typeof voiceSettings) {
    const value = voiceSettings[key];
    if (typeof value === 'boolean') {
      settings.updateVoice({ [key]: !value } as any);
    }
  }

  function handlePTTKeyCapture(e: KeyboardEvent) {
    if (!$isCapturingPTTKey) return;
    pushToTalk.captureKey(e);
  }

  function startPTTKeyCapture() {
    pushToTalk.startCapture();
  }

  function cancelPTTKeyCapture() {
    pushToTalk.cancelCapture();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div 
    class="fixed inset-0 bg-[var(--bg-tertiary)] z-[1000] flex"
    transition:fade={{ duration: 150 }}
    on:click|self={close}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <div 
      class="flex w-full h-full"
      transition:fly={{ y: 20, duration: 200 }}
    >
      <!-- Sidebar -->
      <nav class="w-[218px] bg-[var(--bg-secondary)] flex justify-end py-15 px-6 pl-5 flex-shrink-0" aria-label="Settings navigation">
        <div class="w-[192px]">
          {#each sections as section}
            {#if section.divider}
              <div class="px-2.5 pt-2 mt-2">
                {#if section.label}
                  <span class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{section.label}</span>
                {/if}
              </div>
            {:else}
              <button
                class="w-full px-2.5 py-1.5 mb-0.5 rounded bg-transparent border-none text-base text-left cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-modifier-hover)] hover:text-[var(--text-primary)] {activeSection === section.id ? 'bg-[var(--bg-modifier-selected)] text-[var(--text-primary)]' : ''} {section.danger ? 'text-[var(--status-danger)] hover:bg-[rgba(242,63,67,0.1)]' : ''}"
                on:click={() => handleSectionClick(section.id)}
              >
                {section.label}
              </button>
            {/if}
          {/each}
        </div>
      </nav>
      
      <!-- Content -->
      <main class="flex-1 relative flex justify-start py-15 pr-10 pl-10 pb-20">
        <div class="w-full max-w-[740px] overflow-y-auto">
          {#if activeSection === 'account'}
            <section>
              <h1 id="settings-title" class="text-xl font-semibold text-[var(--text-primary)] mb-5">My Account</h1>
              
              <div class="bg-[var(--bg-secondary)] rounded-lg overflow-hidden mb-10">
                <div class="h-[100px] bg-gradient-to-br from-[#5865f2] to-[#eb459e]"></div>
                <div class="flex items-center p-4 gap-4">
                  <div class="relative -mt-10 border-[6px] border-[var(--bg-secondary)] rounded-full">
                    <Avatar 
                      src={$user?.avatar} 
                      alt={$user?.username || ''} 
                      size="lg"
                    />
                    <label 
                      class="absolute bottom-0 right-0 w-8 h-8 bg-[var(--brand-primary)] hover:bg-[var(--brand-hover)] rounded-full flex items-center justify-center cursor-pointer transition-colors"
                      title="Upload avatar"
                    >
                      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                        <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z"/>
                      </svg>
                      <input 
                        type="file" 
                        accept="image/*" 
                        class="hidden" 
                        on:change={handleAvatarUpload}
                        disabled={uploadingAvatar}
                      />
                    </label>
                    {#if uploadingAvatar}
                      <div class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                        <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    {/if}
                  </div>
                  <div class="flex-1">
                    <span class="block text-xl font-semibold text-[var(--text-primary)]">{$user?.display_name || $user?.username}</span>
                    <span class="text-[var(--text-secondary)]">@{$user?.username}</span>
                  </div>
                  <button class="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--brand-hover)]" on:click={() => editingProfile = true}>
                    Edit User Profile
                  </button>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Account Details</h2>
                
                <div class="bg-[var(--bg-secondary)] rounded-lg p-4">
                  <div class="py-3 border-b border-[var(--bg-modifier-accent)]">
                    <label class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-1">Username</label>
                    <div class="flex justify-between items-center">
                      <span class="text-[var(--text-primary)]">{$user?.username}</span>
                      <button class="bg-transparent border-none text-[var(--text-link)] text-sm cursor-pointer hover:underline">Edit</button>
                    </div>
                  </div>
                  
                  <div class="py-3 border-b border-[var(--bg-modifier-accent)]">
                    <label class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-1">Email</label>
                    <div class="flex justify-between items-center">
                      <span class="text-[var(--text-primary)]">{$user?.email}</span>
                      <button class="bg-transparent border-none text-[var(--text-link)] text-sm cursor-pointer hover:underline">Edit</button>
                    </div>
                  </div>
                  
                  <div class="py-3">
                    <label class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-1">Phone Number</label>
                    <div class="flex justify-between items-center">
                      <span class="text-[var(--text-muted)]">Not set</span>
                      <button class="bg-transparent border-none text-[var(--text-link)] text-sm cursor-pointer hover:underline">Add</button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Password and Authentication</h2>
                <button class="px-4 py-2 rounded bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--bg-modifier-selected)]">Change Password</button>
                
                <div class="flex justify-between items-center mt-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
                  <div>
                    <h3 class="text-base font-semibold text-[var(--text-primary)] mb-1">Two-Factor Authentication</h3>
                    <p class="text-[var(--text-secondary)] text-sm">Protect your account with an extra layer of security.</p>
                  </div>
                  <button class="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--brand-hover)]">Enable 2FA</button>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[rgba(242,63,67,0.2)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Account Removal</h2>
                <p class="text-[var(--text-secondary)] text-sm mb-4">Deleting your account is permanent and cannot be undone.</p>
                <button class="px-4 py-2 rounded bg-[var(--status-danger)] text-white text-sm font-medium cursor-pointer transition-colors hover:bg-[#d62f33]">Delete Account</button>
              </div>
            </section>
          
          {:else if activeSection === 'profile'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">User Profile</h1>
              
              <div class="grid grid-cols-[300px_1fr] gap-10">
                <div class="bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
                  <div class="h-[60px] bg-gradient-to-br from-[#5865f2] to-[#eb459e]"></div>
                  <div class="p-4">
                    <div class="-mt-12 mb-2 border-4 border-[var(--bg-secondary)] rounded-full w-fit relative">
                      <Avatar 
                        src={$user?.avatar} 
                        alt={$user?.username || ''} 
                        size="xl"
                      />
                    </div>
                    <div class="mb-3">
                      <span class="block text-xl font-semibold text-[var(--text-primary)]">
                        {profileForm.display_name || $user?.username}
                      </span>
                      <span class="text-[var(--text-secondary)] text-sm">@{$user?.username}</span>
                      {#if profileForm.pronouns}
                        <span class="inline-block ml-2 px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)]">{profileForm.pronouns}</span>
                      {/if}
                    </div>
                    {#if profileForm.bio}
                      <div class="pt-3 border-t border-[var(--bg-modifier-accent)]">
                        <h4 class="text-xs font-bold uppercase text-[var(--text-primary)] mb-2">About Me</h4>
                        <p class="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">{profileForm.bio}</p>
                      </div>
                    {/if}
                  </div>
                </div>
                
                <div>
                  <div class="mb-5">
                    <label for="display-name" class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Display Name</label>
                    <input 
                      type="text" 
                      id="display-name"
                      bind:value={profileForm.display_name}
                      placeholder={$user?.username}
                      maxlength={32}
                      class="w-full px-2.5 py-2.5 bg-[var(--bg-tertiary)] border-none rounded text-base text-[var(--text-primary)] font-inherit focus:outline-2 focus:outline-[var(--brand-primary)]"
                    />
                  </div>
                  
                  <div class="mb-5">
                    <label for="pronouns" class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Pronouns</label>
                    <input 
                      type="text" 
                      id="pronouns"
                      bind:value={profileForm.pronouns}
                      placeholder="Add your pronouns"
                      maxlength={40}
                      class="w-full px-2.5 py-2.5 bg-[var(--bg-tertiary)] border-none rounded text-base text-[var(--text-primary)] font-inherit focus:outline-2 focus:outline-[var(--brand-primary)]"
                    />
                  </div>
                  
                  <div class="mb-5">
                    <label for="bio" class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-2">About Me</label>
                    <textarea 
                      id="bio"
                      bind:value={profileForm.bio}
                      placeholder="Tell us about yourself"
                      maxlength={190}
                      rows={4}
                      spellcheck="true"
                      class="w-full px-2.5 py-2.5 bg-[var(--bg-tertiary)] border-none rounded text-base text-[var(--text-primary)] font-inherit focus:outline-2 focus:outline-[var(--brand-primary)] resize-y min-h-[100px]"
                    ></textarea>
                    <span class="block text-right text-xs text-[var(--text-muted)] mt-1">{profileForm.bio.length}/190</span>
                  </div>

                  <div class="mb-5">
                    <label class="block text-xs font-bold uppercase text-[var(--text-muted)] mb-2">Avatar</label>
                    <div class="flex items-center gap-4">
                      <Avatar src={$user?.avatar} alt={$user?.username || ''} size="lg" />
                      <div>
                        <label class="relative cursor-pointer">
                          <span class="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium hover:bg-[var(--brand-hover)] transition-colors inline-block {uploadingAvatar ? 'opacity-50 cursor-not-allowed' : ''}">
                            {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            class="hidden" 
                            on:change={handleAvatarUpload}
                            disabled={uploadingAvatar}
                          />
                        </label>
                        <p class="text-xs text-[var(--text-muted)] mt-2">Recommended: 128x128px, max 5MB</p>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex justify-end">
                    <button 
                      class="px-4 py-2 rounded bg-[var(--brand-primary)] text-white text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                      on:click={saveProfile}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          
          {:else if activeSection === 'privacy'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Privacy & Safety</h1>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Direct Messages</h2>
                
                <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Allow DMs from server members</span>
                    <span class="text-sm text-[var(--text-muted)]">Allow members from servers you're in to send you direct messages.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input type="checkbox" checked class="opacity-0 w-0 h-0" />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
                
                <div class="flex justify-between items-center py-4">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Allow message requests</span>
                    <span class="text-sm text-[var(--text-muted)]">People you haven't messaged before can send you requests.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input type="checkbox" checked class="opacity-0 w-0 h-0" />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Data & Privacy</h2>
                <button class="px-4 py-2 rounded bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] text-sm font-medium cursor-pointer transition-colors hover:bg-[var(--bg-modifier-selected)]">Request My Data</button>
              </div>
            </section>
          
          {:else if activeSection === 'appearance'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Appearance</h1>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Theme</h2>
                
                <div class="flex gap-4 flex-wrap">
                  <button 
                    class="bg-transparent border-2 {appSettings.theme === 'dark' ? 'border-[var(--brand-primary)]' : 'border-transparent'} rounded-lg p-2 cursor-pointer text-center hover:border-[var(--brand-primary)]"
                    on:click={() => setTheme('dark')}
                  >
                    <div class="w-[120px] h-20 rounded overflow-hidden flex {getThemePreviewClass('dark')}">
                      <div class="w-[30px] {getSidebarPreviewClass('dark')}"></div>
                      <div class="flex-1 p-2 flex flex-col gap-1 justify-center">
                        <div class="h-3 {getMessagePreviewClass('dark')} rounded-sm"></div>
                        <div class="h-3 {getMessagePreviewClass('dark')} rounded-sm w-3/5"></div>
                      </div>
                    </div>
                    <span class="block mt-2 text-[var(--text-primary)] text-sm">Dark</span>
                  </button>
                  
                  <button 
                    class="bg-transparent border-2 {appSettings.theme === 'light' ? 'border-[var(--brand-primary)]' : 'border-transparent'} rounded-lg p-2 cursor-pointer text-center hover:border-[var(--brand-primary)]"
                    on:click={() => setTheme('light')}
                  >
                    <div class="w-[120px] h-20 rounded overflow-hidden flex {getThemePreviewClass('light')}">
                      <div class="w-[30px] {getSidebarPreviewClass('light')}"></div>
                      <div class="flex-1 p-2 flex flex-col gap-1 justify-center">
                        <div class="h-3 {getMessagePreviewClass('light')} rounded-sm"></div>
                        <div class="h-3 {getMessagePreviewClass('light')} rounded-sm w-3/5"></div>
                      </div>
                    </div>
                    <span class="block mt-2 text-[var(--text-primary)] text-sm">Light</span>
                  </button>
                  
                  <button 
                    class="bg-transparent border-2 {appSettings.theme === 'midnight' ? 'border-[var(--brand-primary)]' : 'border-transparent'} rounded-lg p-2 cursor-pointer text-center hover:border-[var(--brand-primary)]"
                    on:click={() => setTheme('midnight')}
                  >
                    <div class="w-[120px] h-20 rounded overflow-hidden flex {getThemePreviewClass('midnight')}">
                      <div class="w-[30px] {getSidebarPreviewClass('midnight')}"></div>
                      <div class="flex-1 p-2 flex flex-col gap-1 justify-center">
                        <div class="h-3 {getMessagePreviewClass('midnight')} rounded-sm"></div>
                        <div class="h-3 {getMessagePreviewClass('midnight')} rounded-sm w-3/5"></div>
                      </div>
                    </div>
                    <span class="block mt-2 text-[var(--text-primary)] text-sm">Midnight</span>
                  </button>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Message Display</h2>
                
                <div class="flex gap-4">
                  <button 
                    class="bg-transparent border-2 {appSettings.messageDisplay === 'cozy' ? 'border-[var(--brand-primary)]' : 'border-transparent'} rounded-lg p-3 cursor-pointer text-center hover:border-[var(--brand-primary)]"
                    on:click={() => setMessageDisplay('cozy')}
                  >
                    <div class="w-[200px] h-[60px] bg-[var(--bg-secondary)] rounded p-2 flex gap-2 items-start">
                      <div class="w-10 h-10 rounded-full bg-[var(--brand-primary)] flex-shrink-0"></div>
                      <div class="flex-1">
                        <div class="h-3.5 w-20 bg-[var(--bg-modifier-accent)] rounded-sm mb-1"></div>
                        <div class="h-3 bg-[var(--bg-modifier-accent)] rounded-sm"></div>
                      </div>
                    </div>
                    <span class="block mt-2 text-[var(--text-primary)] text-sm">Cozy</span>
                  </button>
                  
                  <button 
                    class="bg-transparent border-2 {appSettings.messageDisplay === 'compact' ? 'border-[var(--brand-primary)]' : 'border-transparent'} rounded-lg p-3 cursor-pointer text-center hover:border-[var(--brand-primary)]"
                    on:click={() => setMessageDisplay('compact')}
                  >
                    <div class="w-[200px] h-[60px] bg-[var(--bg-secondary)] rounded p-2 flex gap-2 items-center">
                      <div class="w-10 h-3 bg-[var(--bg-modifier-accent)] rounded-sm"></div>
                      <div class="h-3 w-25 bg-[var(--bg-modifier-accent)] rounded-sm"></div>
                    </div>
                    <span class="block mt-2 text-[var(--text-primary)] text-sm">Compact</span>
                  </button>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Chat Font Size</h2>
                <div class="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="12" 
                    max="24" 
                    step="1"
                    value={appSettings.fontSize}
                    on:input={(e) => settings.updateApp({ fontSize: parseInt(e.currentTarget.value) })}
                    class="flex-1 h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span class="min-w-[40px] text-[var(--text-secondary)]">{appSettings.fontSize}px</span>
                </div>
              </div>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Accessibility</h2>
                
                <div class="flex justify-between items-center py-4">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Enable Animations</span>
                    <span class="text-sm text-[var(--text-muted)]">Show animated avatars, emoji, and stickers.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={appSettings.enableAnimations}
                      on:change={() => toggleSetting('enableAnimations')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
              </div>
            </section>
          
          {:else if activeSection === 'notifications'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Notifications</h1>
              
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Desktop Notifications</h2>
                
                <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Enable Desktop Notifications</span>
                    <span class="text-sm text-[var(--text-muted)]">Receive notifications even when Hearth is minimized.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={appSettings.notificationsEnabled}
                      on:change={() => toggleSetting('notificationsEnabled')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
                
                <div class="flex justify-between items-center py-4">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Enable Sounds</span>
                    <span class="text-sm text-[var(--text-muted)]">Play notification sounds for messages.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={appSettings.enableSounds}
                      on:change={() => toggleSetting('enableSounds')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
              </div>
            </section>
          
          {:else if activeSection === 'voice'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Voice & Video</h1>
              
              <!-- Input Mode Selection -->
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Input Mode</h2>
                
                <div class="flex gap-4">
                  <button 
                    class="flex-1 bg-transparent border-2 {voiceSettings.inputMode === 'voice_activity' ? 'border-[var(--brand-primary)]' : 'border-[var(--bg-modifier-accent)]'} rounded-lg p-4 cursor-pointer text-left hover:border-[var(--brand-primary)] transition-colors"
                    on:click={() => setInputMode('voice_activity')}
                  >
                    <div class="flex items-center gap-3 mb-2">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="text-[var(--text-primary)]">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                      </svg>
                      <span class="text-base font-semibold text-[var(--text-primary)]">Voice Activity</span>
                    </div>
                    <p class="text-sm text-[var(--text-muted)]">Automatically transmit when you speak. Best for most users.</p>
                  </button>
                  
                  <button 
                    class="flex-1 bg-transparent border-2 {voiceSettings.inputMode === 'push_to_talk' ? 'border-[var(--brand-primary)]' : 'border-[var(--bg-modifier-accent)]'} rounded-lg p-4 cursor-pointer text-left hover:border-[var(--brand-primary)] transition-colors"
                    on:click={() => setInputMode('push_to_talk')}
                  >
                    <div class="flex items-center gap-3 mb-2">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" class="text-[var(--text-primary)]">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      <span class="text-base font-semibold text-[var(--text-primary)]">Push to Talk</span>
                    </div>
                    <p class="text-sm text-[var(--text-muted)]">Hold a key to transmit. Reduces background noise.</p>
                  </button>
                </div>
              </div>
              
              <!-- Push to Talk Settings (visible when PTT is selected) -->
              {#if voiceSettings.inputMode === 'push_to_talk'}
                <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                  <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Push to Talk Settings</h2>
                  
                  <div class="bg-[var(--bg-secondary)] rounded-lg p-4">
                    <div class="flex justify-between items-center">
                      <div>
                        <span class="block text-base text-[var(--text-primary)] mb-1">Shortcut</span>
                        <span class="text-sm text-[var(--text-muted)]">Press this key to transmit audio</span>
                      </div>
                      <div class="flex items-center gap-3">
                        {#if $isCapturingPTTKey}
                          <div class="flex items-center gap-2">
                            <span class="px-4 py-2 bg-[var(--brand-primary)] text-white rounded text-sm animate-pulse">
                              Press a key...
                            </span>
                            <button 
                              class="px-3 py-2 bg-[var(--bg-modifier-accent)] text-[var(--text-primary)] rounded text-sm hover:bg-[var(--bg-modifier-selected)] transition-colors"
                              on:click={cancelPTTKeyCapture}
                            >
                              Cancel
                            </button>
                          </div>
                        {:else}
                          <button 
                            class="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-sm font-medium hover:bg-[var(--bg-modifier-selected)] transition-colors flex items-center gap-2"
                            on:click={startPTTKeyCapture}
                          >
                            <kbd class="px-2 py-1 bg-[var(--bg-modifier-accent)] rounded text-xs">{voiceSettings.pushToTalkKeyDisplay}</kbd>
                            <span>Edit Keybind</span>
                          </button>
                        {/if}
                      </div>
                    </div>
                  </div>
                  
                  <p class="text-xs text-[var(--text-muted)] mt-3">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="inline-block mr-1 align-text-bottom">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    The push-to-talk hotkey works when Hearth is focused. Press Escape to cancel keybind capture.
                  </p>
                </div>
              {/if}
              
              <!-- Voice Activity Sensitivity (visible when Voice Activity is selected) -->
              {#if voiceSettings.inputMode === 'voice_activity'}
                <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                  <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Input Sensitivity</h2>
                  
                  <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
                    <div>
                      <span class="block text-base text-[var(--text-primary)] mb-1">Automatically determine input sensitivity</span>
                      <span class="text-sm text-[var(--text-muted)]">Let Hearth decide when you're speaking.</span>
                    </div>
                    <label class="relative inline-block w-10 h-6 flex-shrink-0">
                      <input 
                        type="checkbox" 
                        checked={voiceSettings.automaticallyDetermineInputSensitivity}
                        on:change={() => toggleVoiceSetting('automaticallyDetermineInputSensitivity')}
                        class="opacity-0 w-0 h-0"
                      />
                      <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                    </label>
                  </div>
                  
                  {#if !voiceSettings.automaticallyDetermineInputSensitivity}
                    <div class="py-4">
                      <label class="block text-sm text-[var(--text-secondary)] mb-2">Manual Sensitivity ({voiceSettings.voiceActivitySensitivity}%)</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="1"
                        value={voiceSettings.voiceActivitySensitivity}
                        on:input={(e) => settings.updateVoice({ voiceActivitySensitivity: parseInt(e.currentTarget.value) })}
                        class="w-full h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                      <div class="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                        <span>More sensitive</span>
                        <span>Less sensitive</span>
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
              
              <!-- Voice Processing -->
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-2">Voice Processing</h2>
                
                <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Echo Cancellation</span>
                    <span class="text-sm text-[var(--text-muted)]">Reduces echo from speakers being picked up by your microphone.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={voiceSettings.echoCancellation}
                      on:change={() => toggleVoiceSetting('echoCancellation')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
                
                <div class="flex justify-between items-center py-4 border-b border-[var(--bg-modifier-accent)]">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Noise Suppression</span>
                    <span class="text-sm text-[var(--text-muted)]">Reduces background noise like keyboard clicks and fans.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={voiceSettings.noiseSuppression}
                      on:change={() => toggleVoiceSetting('noiseSuppression')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
                
                <div class="flex justify-between items-center py-4">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Automatic Gain Control</span>
                    <span class="text-sm text-[var(--text-muted)]">Automatically adjusts your microphone volume.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={voiceSettings.automaticGainControl}
                      on:change={() => toggleVoiceSetting('automaticGainControl')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
              </div>
              
              <!-- Volume Settings -->
              <div class="mb-10 pb-10 border-b border-[var(--bg-modifier-accent)]">
                <h2 class="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)] mb-4">Volume</h2>
                
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm text-[var(--text-primary)]">Input Volume</label>
                    <span class="text-sm text-[var(--text-muted)]">{voiceSettings.inputVolume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="200" 
                    step="1"
                    value={voiceSettings.inputVolume}
                    on:input={(e) => settings.updateVoice({ inputVolume: parseInt(e.currentTarget.value) })}
                    class="w-full h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
                
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-sm text-[var(--text-primary)]">Output Volume</label>
                    <span class="text-sm text-[var(--text-muted)]">{voiceSettings.outputVolume}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="200" 
                    step="1"
                    value={voiceSettings.outputVolume}
                    on:input={(e) => settings.updateVoice({ outputVolume: parseInt(e.currentTarget.value) })}
                    class="w-full h-2 bg-[var(--bg-modifier-accent)] rounded outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--brand-primary)] [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              </div>
            </section>
          
          {:else if activeSection === 'keybinds'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">Keybinds</h1>
              
              <div class="bg-[var(--bg-secondary)] rounded-lg py-2 px-4">
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Navigate Up</span>
                  <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">↑</kbd>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Navigate Down</span>
                  <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">↓</kbd>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Focus Message Input</span>
                  <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">Tab</kbd>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Quick Switcher</span>
                  <div class="flex items-center gap-1 text-[var(--text-muted)]">
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">Ctrl</kbd>
                    <span>+</span>
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">K</kbd>
                  </div>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Search</span>
                  <div class="flex items-center gap-1 text-[var(--text-muted)]">
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">Ctrl</kbd>
                    <span>+</span>
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">F</kbd>
                  </div>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Mark as Read</span>
                  <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">Escape</kbd>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-[var(--bg-modifier-accent)]">
                  <span class="text-[var(--text-primary)]">Upload File</span>
                  <div class="flex items-center gap-1 text-[var(--text-muted)]">
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">Ctrl</kbd>
                    <span>+</span>
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">U</kbd>
                  </div>
                </div>
                <div class="flex justify-between items-center py-3">
                  <span class="text-[var(--text-primary)]">Push to Talk</span>
                  <div class="flex items-center gap-2">
                    <kbd class="inline-block px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-primary)] font-inherit">{voiceSettings.pushToTalkKeyDisplay}</kbd>
                    <button 
                      class="text-xs text-[var(--text-link)] hover:underline"
                      on:click={() => { activeSection = 'voice'; }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </section>
          
          {:else if activeSection === 'about'}
            <section>
              <h1 class="text-xl font-semibold text-[var(--text-primary)] mb-5">About Hearth</h1>
              
              <div class="text-center max-w-[400px] mx-auto">
                <div class="mb-4">
                  <span class="text-5xl">🔥</span>
                  <h2 class="text-[32px] text-[var(--text-primary)]">Hearth</h2>
                </div>
                
                <p class="text-[var(--text-secondary)] mb-6">
                  A self-hosted, end-to-end encrypted chat platform. 
                  Your conversations, your data, your servers.
                </p>
                
                <div class="bg-[var(--bg-secondary)] rounded-lg p-4 mb-6">
                  <div class="flex justify-between py-2 border-b border-[var(--bg-modifier-accent)]">
                    <span class="text-[var(--text-muted)]">Version</span>
                    <span class="text-[var(--text-primary)]">0.1.0-alpha</span>
                  </div>
                  <div class="flex justify-between py-2">
                    <span class="text-[var(--text-muted)]">Build</span>
                    <span class="text-[var(--text-primary)]">Development</span>
                  </div>
                </div>
                
                <div class="flex justify-center gap-6 mb-8">
                  <a href="https://github.com/yourusername/hearth" target="_blank" rel="noopener" class="text-[var(--text-link)]">GitHub Repository</a>
                  <a href="/docs" target="_blank" rel="noopener" class="text-[var(--text-link)]">Documentation</a>
                </div>
                
                <div class="flex justify-between items-center py-4 text-left">
                  <div>
                    <span class="block text-base text-[var(--text-primary)] mb-1">Developer Mode</span>
                    <span class="text-sm text-[var(--text-muted)]">Show developer options and debug information.</span>
                  </div>
                  <label class="relative inline-block w-10 h-6 flex-shrink-0">
                    <input 
                      type="checkbox" 
                      checked={appSettings.developerMode}
                      on:change={() => toggleSetting('developerMode')}
                      class="opacity-0 w-0 h-0"
                    />
                    <span class="absolute cursor-pointer inset-0 bg-[var(--bg-modifier-accent)] rounded-full transition-colors before:content-[''] before:absolute before:h-[18px] before:w-[18px] before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform [&:has(input:checked)]:bg-[var(--brand-primary)] [&:has(input:checked)]:before:translate-x-4"></span>
                  </label>
                </div>
              </div>
            </section>
          {/if}
        </div>
        
        <!-- Close button -->
        <button class="absolute top-15 right-10 flex flex-col items-center gap-1 bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]" on:click={close} aria-label="Close settings">
          <div class="w-9 h-9 flex items-center justify-center border-2 border-current rounded-full">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
            </svg>
          </div>
          <span class="text-xs font-semibold">ESC</span>
        </button>
      </main>
    </div>
  </div>
{/if}
