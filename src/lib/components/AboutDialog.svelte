<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  
  // Tauri APIs
  declare const __TAURI__: {
    app: {
      getName(): Promise<string>;
      getVersion(): Promise<string>;
      getTauriVersion(): Promise<string>;
    };
    os: {
      type(): Promise<string>;
      version(): Promise<string>;
      arch(): Promise<string>;
    };
    shell: {
      open(url: string): Promise<void>;
    };
  };

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  // App info state
  let appName = 'Hearth Desktop';
  let appVersion = '0.0.0';
  let tauriVersion = '0.0.0';
  let osType = '';
  let osVersion = '';
  let osArch = '';
  let isLoading = true;
  let copyFeedback = '';

  // Credits and links
  const credits = [
    { name: 'Built with Tauri', url: 'https://tauri.app' },
    { name: 'Powered by Svelte', url: 'https://svelte.dev' },
    { name: 'UI by TailwindCSS', url: 'https://tailwindcss.com' },
  ];

  const socialLinks = [
    { name: 'GitHub', icon: 'github', url: 'https://github.com/clawdbot/hearth' },
    { name: 'Discord', icon: 'discord', url: 'https://discord.gg/hearth' },
    { name: 'Documentation', icon: 'book', url: 'https://docs.hearth.app' },
  ];

  onMount(async () => {
    try {
      if (typeof __TAURI__ !== 'undefined') {
        const [name, version, tauri, type, ver, arch] = await Promise.all([
          __TAURI__.app.getName(),
          __TAURI__.app.getVersion(),
          __TAURI__.app.getTauriVersion(),
          __TAURI__.os.type(),
          __TAURI__.os.version(),
          __TAURI__.os.arch(),
        ]);
        
        appName = name;
        appVersion = version;
        tauriVersion = tauri;
        osType = type;
        osVersion = ver;
        osArch = arch;
      }
    } catch (err) {
      console.warn('Failed to fetch app info:', err);
    } finally {
      isLoading = false;
    }
  });

  function close() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  async function openLink(url: string) {
    try {
      if (typeof __TAURI__ !== 'undefined') {
        await __TAURI__.shell.open(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  }

  async function copySystemInfo() {
    const info = [
      `${appName} v${appVersion}`,
      `Tauri v${tauriVersion}`,
      `OS: ${osType} ${osVersion} (${osArch})`,
      `Date: ${new Date().toISOString()}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(info);
      copyFeedback = 'Copied!';
      setTimeout(() => {
        copyFeedback = '';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      copyFeedback = 'Failed to copy';
    }
  }

  function formatOsName(type: string): string {
    const osNames: Record<string, string> = {
      'Darwin': 'macOS',
      'Windows_NT': 'Windows',
      'Linux': 'Linux',
    };
    return osNames[type] || type;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    on:click={handleBackdropClick}
    transition:fade={{ duration: 150 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="about-dialog-title"
  >
    <div
      class="relative w-full max-w-md bg-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      <!-- Header with gradient -->
      <div class="relative h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/20"></div>
        
        <!-- App Logo -->
        <div class="relative z-10 flex flex-col items-center">
          <div class="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>

        <!-- Close button -->
        <button
          class="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          on:click={close}
          aria-label="Close about dialog"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- App Name & Version -->
        <div class="text-center mb-6">
          <h2 id="about-dialog-title" class="text-2xl font-bold text-white">
            {appName}
          </h2>
          {#if isLoading}
            <div class="h-5 w-24 mx-auto mt-2 bg-gray-700 rounded animate-pulse"></div>
          {:else}
            <p class="text-gray-400 mt-1">
              Version {appVersion}
            </p>
          {/if}
        </div>

        <!-- System Info -->
        <div class="bg-gray-800/50 rounded-lg p-4 mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium text-gray-300">System Information</h3>
            <button
              class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex items-center gap-1"
              on:click={copySystemInfo}
            >
              {#if copyFeedback}
                <svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {copyFeedback}
              {:else}
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              {/if}
            </button>
          </div>
          
          {#if isLoading}
            <div class="space-y-2">
              {#each [1, 2, 3] as _}
                <div class="h-4 bg-gray-700 rounded animate-pulse"></div>
              {/each}
            </div>
          {:else}
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Tauri</span>
                <span class="text-gray-300 font-mono">v{tauriVersion}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Operating System</span>
                <span class="text-gray-300 font-mono">{formatOsName(osType)} {osVersion}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Architecture</span>
                <span class="text-gray-300 font-mono">{osArch}</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- Credits -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-300 mb-3">Built With</h3>
          <div class="flex flex-wrap gap-2">
            {#each credits as credit}
              <button
                class="px-3 py-1.5 text-xs rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
                on:click={() => openLink(credit.url)}
              >
                {credit.name}
              </button>
            {/each}
          </div>
        </div>

        <!-- Social Links -->
        <div class="flex justify-center gap-4">
          {#each socialLinks as link}
            <button
              class="p-2.5 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              on:click={() => openLink(link.url)}
              aria-label={link.name}
              title={link.name}
            >
              {#if link.icon === 'github'}
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              {:else if link.icon === 'discord'}
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              {:else if link.icon === 'book'}
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Copyright -->
        <p class="text-center text-xs text-gray-500 mt-6">
          © {new Date().getFullYear()} Hearth Desktop. All rights reserved.
        </p>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Ensure dialog is above other content */
  :global(body:has(.about-dialog-open)) {
    overflow: hidden;
  }
</style>
