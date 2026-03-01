<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Types
  interface AudioDevice {
    id: string;
    name: string;
    type: 'input' | 'output';
    isDefault: boolean;
    isActive: boolean;
    volume: number;
  }

  interface AudioRoute {
    id: string;
    name: string;
    source: string; // 'voice' | 'notifications' | 'media' | 'effects'
    deviceId: string;
    volume: number;
    enabled: boolean;
  }

  interface AudioProfile {
    id: string;
    name: string;
    routes: AudioRoute[];
    isActive: boolean;
  }

  // State
  let isOpen = false;
  let activeTab: 'devices' | 'routes' | 'profiles' = 'devices';
  let inputDevices: AudioDevice[] = [];
  let outputDevices: AudioDevice[] = [];
  let routes: AudioRoute[] = [];
  let profiles: AudioProfile[] = [];
  let editingProfile: AudioProfile | null = null;
  let masterVolume = 100;
  let muteAll = false;

  const STORAGE_KEY = 'hearth-audio-router';
  const audioSources = ['voice', 'notifications', 'media', 'effects'] as const;

  let unregisterShortcut: (() => void) | null = null;

  onMount(async () => {
    loadData();
    await enumerateDevices();
    await registerShortcut();
  });

  onDestroy(() => {
    if (unregisterShortcut) unregisterShortcut();
  });

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        routes = data.routes || getDefaultRoutes();
        profiles = data.profiles || [];
        masterVolume = data.masterVolume ?? 100;
      } else {
        routes = getDefaultRoutes();
      }
    } catch (e) {
      console.error('Failed to load audio router data:', e);
      routes = getDefaultRoutes();
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        routes,
        profiles,
        masterVolume,
      }));
    } catch (e) {
      console.error('Failed to save audio router data:', e);
    }
  }

  function getDefaultRoutes(): AudioRoute[] {
    return audioSources.map(source => ({
      id: crypto.randomUUID(),
      name: source.charAt(0).toUpperCase() + source.slice(1),
      source,
      deviceId: 'default',
      volume: 100,
      enabled: true,
    }));
  }

  async function enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      inputDevices = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, i) => ({
          id: d.deviceId || `input-${i}`,
          name: d.label || `Microphone ${i + 1}`,
          type: 'input' as const,
          isDefault: d.deviceId === 'default' || i === 0,
          isActive: false,
          volume: 100,
        }));
      outputDevices = devices
        .filter(d => d.kind === 'audiooutput')
        .map((d, i) => ({
          id: d.deviceId || `output-${i}`,
          name: d.label || `Speaker ${i + 1}`,
          type: 'output' as const,
          isDefault: d.deviceId === 'default' || i === 0,
          isActive: false,
          volume: 100,
        }));
    } catch (e) {
      console.warn('Could not enumerate audio devices:', e);
      outputDevices = [{ id: 'default', name: 'Default Output', type: 'output', isDefault: true, isActive: true, volume: 100 }];
      inputDevices = [{ id: 'default', name: 'Default Input', type: 'input', isDefault: true, isActive: true, volume: 100 }];
    }
  }

  async function registerShortcut() {
    try {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await register('CommandOrControl+Shift+U', () => {
        isOpen = !isOpen;
      });
      unregisterShortcut = () => unregister('CommandOrControl+Shift+U');
    } catch (e) {
      console.warn('Global shortcut not available:', e);
    }
  }

  function setRouteDevice(routeId: string, deviceId: string) {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      route.deviceId = deviceId;
      routes = [...routes];
      saveData();
      broadcastRoutes();
    }
  }

  function setRouteVolume(routeId: string, volume: number) {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      route.volume = volume;
      routes = [...routes];
      saveData();
      broadcastRoutes();
    }
  }

  function toggleRoute(routeId: string) {
    const route = routes.find(r => r.id === routeId);
    if (route) {
      route.enabled = !route.enabled;
      routes = [...routes];
      saveData();
      broadcastRoutes();
    }
  }

  function saveProfile() {
    if (!editingProfile) return;
    editingProfile.routes = JSON.parse(JSON.stringify(routes));
    const existingIndex = profiles.findIndex(p => p.id === editingProfile!.id);
    if (existingIndex !== -1) {
      profiles[existingIndex] = editingProfile;
    } else {
      profiles = [...profiles, editingProfile];
    }
    profiles = [...profiles];
    saveData();
    editingProfile = null;
  }

  function activateProfile(profileId: string) {
    profiles.forEach(p => p.isActive = p.id === profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      routes = JSON.parse(JSON.stringify(profile.routes));
    }
    profiles = [...profiles];
    saveData();
    broadcastRoutes();
  }

  function deleteProfile(profileId: string) {
    profiles = profiles.filter(p => p.id !== profileId);
    saveData();
  }

  function broadcastRoutes() {
    window.dispatchEvent(new CustomEvent('hearth:audio-routes', {
      detail: { routes, masterVolume, muteAll }
    }));
  }

  function getSourceIcon(source: string): string {
    const icons: Record<string, string> = {
      voice: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
      notifications: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      media: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
      effects: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
    };
    return icons[source] || icons.effects;
  }

  function getDeviceName(deviceId: string): string {
    const device = [...inputDevices, ...outputDevices].find(d => d.id === deviceId);
    return device?.name || 'Default';
  }
</script>

<!-- Toggle Button -->
<button
  class="fixed bottom-52 right-4 z-40 w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
  class:opacity-50={muteAll}
  on:click={() => isOpen = !isOpen}
  title="Audio Router (Ctrl+Shift+U)"
>
  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
</button>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click|self={() => isOpen = false}>
    <div class="bg-gray-900 rounded-xl shadow-2xl w-[650px] max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <h2 class="text-lg font-semibold text-white">Audio Router</h2>
        </div>
        <div class="flex items-center gap-3">
          <!-- Master volume -->
          <div class="flex items-center gap-2">
            <button
              class="text-gray-400 hover:text-white"
              on:click={() => { muteAll = !muteAll; broadcastRoutes(); }}
              title={muteAll ? 'Unmute' : 'Mute all'}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {#if muteAll}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                {/if}
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              class="w-20 accent-blue-500"
              bind:value={masterVolume}
              on:input={() => { saveData(); broadcastRoutes(); }}
            />
            <span class="text-xs text-gray-400 w-8">{masterVolume}%</span>
          </div>
          <button class="text-gray-400 hover:text-white transition-colors" on:click={() => isOpen = false}>
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700">
        {#each ['devices', 'routes', 'profiles'] as tab}
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            class:text-blue-400={activeTab === tab}
            class:border-b-2={activeTab === tab}
            class:border-blue-400={activeTab === tab}
            class:text-gray-400={activeTab !== tab}
            on:click={() => activeTab = tab}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'devices'}
          <div class="space-y-4">
            <div>
              <h3 class="text-white font-medium mb-2">Output Devices</h3>
              <div class="space-y-2">
                {#each outputDevices as device (device.id)}
                  <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      <div>
                        <span class="text-white">{device.name}</span>
                        {#if device.isDefault}
                          <span class="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full ml-2">Default</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
                {#if outputDevices.length === 0}
                  <p class="text-gray-400 text-sm">No output devices detected</p>
                {/if}
              </div>
            </div>

            <div>
              <h3 class="text-white font-medium mb-2">Input Devices</h3>
              <div class="space-y-2">
                {#each inputDevices as device (device.id)}
                  <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <div>
                        <span class="text-white">{device.name}</span>
                        {#if device.isDefault}
                          <span class="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full ml-2">Default</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/each}
                {#if inputDevices.length === 0}
                  <p class="text-gray-400 text-sm">No input devices detected</p>
                {/if}
              </div>
            </div>

            <button
              class="w-full px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
              on:click={enumerateDevices}
            >
              Refresh Devices
            </button>
          </div>

        {:else if activeTab === 'routes'}
          <div class="space-y-3">
            <p class="text-sm text-gray-400 mb-4">Route different audio streams to specific output devices</p>
            {#each routes as route (route.id)}
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={getSourceIcon(route.source)} />
                    </svg>
                    <span class="text-white font-medium">{route.name}</span>
                  </div>
                  <button
                    class="relative w-10 h-5 rounded-full transition-colors"
                    class:bg-blue-600={route.enabled}
                    class:bg-gray-600={!route.enabled}
                    on:click={() => toggleRoute(route.id)}
                  >
                    <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-5={route.enabled} />
                  </button>
                </div>
                <div class="flex items-center gap-3">
                  <select
                    class="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white"
                    value={route.deviceId}
                    on:change={(e) => setRouteDevice(route.id, e.target.value)}
                  >
                    {#each outputDevices as device}
                      <option value={device.id}>{device.name}</option>
                    {/each}
                  </select>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    class="w-24 accent-blue-500"
                    value={route.volume}
                    on:input={(e) => setRouteVolume(route.id, parseInt(e.target.value))}
                  />
                  <span class="text-xs text-gray-400 w-8">{route.volume}%</span>
                </div>
              </div>
            {/each}
          </div>

        {:else if activeTab === 'profiles'}
          <div class="space-y-3">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm text-gray-400">Save and switch between audio configurations</p>
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                on:click={() => editingProfile = { id: crypto.randomUUID(), name: '', routes: [], isActive: false }}
              >
                Save Current
              </button>
            </div>

            {#if editingProfile}
              <div class="bg-gray-800 rounded-lg p-4 space-y-3">
                <input
                  type="text"
                  class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Profile name..."
                  bind:value={editingProfile.name}
                />
                <div class="flex justify-end gap-2">
                  <button class="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm" on:click={() => editingProfile = null}>Cancel</button>
                  <button
                    class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                    disabled={!editingProfile.name.trim()}
                    on:click={saveProfile}
                  >
                    Save
                  </button>
                </div>
              </div>
            {/if}

            {#if profiles.length === 0 && !editingProfile}
              <div class="text-center py-8 text-gray-400">
                <p>No audio profiles saved</p>
                <p class="text-sm mt-1">Save your current audio configuration as a profile</p>
              </div>
            {:else}
              {#each profiles as profile (profile.id)}
                <div class="bg-gray-800 rounded-lg p-4 flex items-center justify-between" class:border={profile.isActive} class:border-blue-500={profile.isActive}>
                  <div>
                    <span class="text-white font-medium">{profile.name}</span>
                    {#if profile.isActive}
                      <span class="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full ml-2">Active</span>
                    {/if}
                    <div class="text-xs text-gray-500 mt-1">{profile.routes.length} routes configured</div>
                  </div>
                  <div class="flex gap-2">
                    <button class="px-3 py-1.5 bg-blue-600/30 text-blue-400 rounded-lg hover:bg-blue-600/50 text-sm" on:click={() => activateProfile(profile.id)}>
                      Activate
                    </button>
                    <button class="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-red-600/50 text-sm" on:click={() => deleteProfile(profile.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
</script>
