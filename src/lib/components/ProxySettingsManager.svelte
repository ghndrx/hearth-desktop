<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';

  const dispatch = createEventDispatcher<{
    proxyChange: ProxyConfig;
    connectionTest: { success: boolean; latency?: number; error?: string };
    error: { message: string; code?: string };
  }>();

  // Types
  interface ProxyConfig {
    enabled: boolean;
    mode: 'none' | 'system' | 'manual' | 'pac';
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    pacUrl?: string;
    bypassList: string[];
    bypassLocal: boolean;
  }

  interface ProxyPreset {
    id: string;
    name: string;
    config: Omit<ProxyConfig, 'enabled'>;
    createdAt: Date;
    lastUsed?: Date;
  }

  interface ConnectionTestResult {
    success: boolean;
    latency?: number;
    externalIp?: string;
    error?: string;
    timestamp: Date;
  }

  // Props
  export let initialConfig: Partial<ProxyConfig> = {};
  export let testUrl: string = 'https://api.ipify.org?format=json';
  export let autoTestOnChange: boolean = false;
  export let showAdvancedOptions: boolean = true;
  export let maxPresets: number = 10;

  // Default configuration
  const defaultConfig: ProxyConfig = {
    enabled: false,
    mode: 'none',
    protocol: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    pacUrl: '',
    bypassList: ['localhost', '127.0.0.1', '*.local'],
    bypassLocal: true,
  };

  // Stores
  const config: Writable<ProxyConfig> = writable({ ...defaultConfig, ...initialConfig });
  const presets: Writable<ProxyPreset[]> = writable([]);
  const testResult: Writable<ConnectionTestResult | null> = writable(null);
  const isTesting: Writable<boolean> = writable(false);
  const isSaving: Writable<boolean> = writable(false);
  const showPassword: Writable<boolean> = writable(false);
  const expandedSections: Writable<Set<string>> = writable(new Set(['basic']));
  const validationErrors: Writable<Record<string, string>> = writable({});
  const bypassInput: Writable<string> = writable('');

  // Derived stores
  const isConfigValid = derived([config, validationErrors], ([$config, $errors]) => {
    if (!$config.enabled) return true;
    if ($config.mode === 'none' || $config.mode === 'system') return true;
    if (Object.keys($errors).length > 0) return false;
    
    if ($config.mode === 'manual') {
      return $config.host.length > 0 && $config.port > 0 && $config.port <= 65535;
    }
    if ($config.mode === 'pac') {
      return $config.pacUrl?.length > 0;
    }
    return true;
  });

  const configSummary = derived(config, ($config) => {
    if (!$config.enabled) return 'Proxy disabled';
    switch ($config.mode) {
      case 'none': return 'Direct connection';
      case 'system': return 'Using system proxy settings';
      case 'manual': return `${$config.protocol.toUpperCase()} proxy: ${$config.host}:${$config.port}`;
      case 'pac': return `PAC script: ${$config.pacUrl}`;
      default: return 'Unknown configuration';
    }
  });

  // Protocol options
  const protocols = [
    { value: 'http', label: 'HTTP', description: 'Standard HTTP proxy' },
    { value: 'https', label: 'HTTPS', description: 'Secure HTTP proxy' },
    { value: 'socks4', label: 'SOCKS4', description: 'SOCKS version 4' },
    { value: 'socks5', label: 'SOCKS5', description: 'SOCKS version 5 with authentication' },
  ];

  // Common bypass patterns
  const commonBypassPatterns = [
    { pattern: 'localhost', description: 'Local machine' },
    { pattern: '127.0.0.1', description: 'Loopback address' },
    { pattern: '*.local', description: 'Local network domains' },
    { pattern: '192.168.*.*', description: 'Private network (192.168.x.x)' },
    { pattern: '10.*.*.*', description: 'Private network (10.x.x.x)' },
    { pattern: '172.16.*.*', description: 'Private network (172.16.x.x)' },
  ];

  // Lifecycle
  onMount(async () => {
    await loadPresets();
    await loadSavedConfig();
  });

  // Storage functions (Tauri integration)
  async function loadSavedConfig(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('proxy-settings.json');
        const savedConfig = await store.get<ProxyConfig>('config');
        if (savedConfig) {
          config.set({ ...defaultConfig, ...savedConfig });
        }
      }
    } catch (error) {
      console.error('Failed to load proxy config:', error);
    }
  }

  async function saveConfig(): Promise<void> {
    isSaving.set(true);
    try {
      const currentConfig = $config;
      
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('proxy-settings.json');
        await store.set('config', currentConfig);
        await store.save();
        
        // Apply proxy settings via Tauri command if available
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('apply_proxy_settings', { config: currentConfig });
        } catch (e) {
          // Command may not be implemented yet
          console.warn('Proxy settings saved but not applied:', e);
        }
      }
      
      dispatch('proxyChange', currentConfig);
      
      if (autoTestOnChange && currentConfig.enabled) {
        await testConnection();
      }
    } catch (error) {
      dispatch('error', { message: `Failed to save config: ${error}` });
    } finally {
      isSaving.set(false);
    }
  }

  async function loadPresets(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && '__TAURI__' in window) {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = new Store('proxy-settings.json');
        const savedPresets = await store.get<ProxyPreset[]>('presets');
        if (savedPresets) {
          presets.set(savedPresets);
        }
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }

  async function savePreset(name: string): Promise<void> {
    const currentPresets = $presets;
    if (currentPresets.length >= maxPresets) {
      dispatch('error', { message: `Maximum ${maxPresets} presets allowed` });
      return;
    }

    const currentConfig = $config;
    const newPreset: ProxyPreset = {
      id: crypto.randomUUID(),
      name,
      config: {
        mode: currentConfig.mode,
        protocol: currentConfig.protocol,
        host: currentConfig.host,
        port: currentConfig.port,
        username: currentConfig.username,
        password: currentConfig.password,
        pacUrl: currentConfig.pacUrl,
        bypassList: [...currentConfig.bypassList],
        bypassLocal: currentConfig.bypassLocal,
      },
      createdAt: new Date(),
    };

    presets.update(p => [...p, newPreset]);
    
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = new Store('proxy-settings.json');
      await store.set('presets', $presets);
      await store.save();
    }
  }

  async function loadPreset(preset: ProxyPreset): Promise<void> {
    config.update(c => ({
      ...c,
      ...preset.config,
      enabled: true,
    }));

    // Update last used
    presets.update(p => p.map(pr => 
      pr.id === preset.id ? { ...pr, lastUsed: new Date() } : pr
    ));

    await saveConfig();
  }

  async function deletePreset(presetId: string): Promise<void> {
    presets.update(p => p.filter(pr => pr.id !== presetId));
    
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = new Store('proxy-settings.json');
      await store.set('presets', $presets);
      await store.save();
    }
  }

  // Validation
  function validateConfig(): void {
    const errors: Record<string, string> = {};
    const currentConfig = $config;

    if (currentConfig.mode === 'manual') {
      if (!currentConfig.host) {
        errors.host = 'Host is required';
      } else if (!/^[a-zA-Z0-9.-]+$/.test(currentConfig.host)) {
        errors.host = 'Invalid host format';
      }

      if (!currentConfig.port || currentConfig.port < 1 || currentConfig.port > 65535) {
        errors.port = 'Port must be between 1 and 65535';
      }
    }

    if (currentConfig.mode === 'pac') {
      if (!currentConfig.pacUrl) {
        errors.pacUrl = 'PAC URL is required';
      } else {
        try {
          new URL(currentConfig.pacUrl);
        } catch {
          errors.pacUrl = 'Invalid URL format';
        }
      }
    }

    validationErrors.set(errors);
  }

  // Connection test
  async function testConnection(): Promise<void> {
    isTesting.set(true);
    testResult.set(null);

    const startTime = Date.now();

    try {
      // In a real Tauri app, this would use the proxy settings
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const result: ConnectionTestResult = {
        success: true,
        latency,
        externalIp: data.ip,
        timestamp: new Date(),
      };

      testResult.set(result);
      dispatch('connectionTest', { success: true, latency });
    } catch (error) {
      const result: ConnectionTestResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date(),
      };

      testResult.set(result);
      dispatch('connectionTest', { success: false, error: result.error });
    } finally {
      isTesting.set(false);
    }
  }

  // Bypass list management
  function addBypassPattern(pattern: string): void {
    if (!pattern.trim()) return;
    
    config.update(c => ({
      ...c,
      bypassList: [...new Set([...c.bypassList, pattern.trim()])],
    }));
    bypassInput.set('');
  }

  function removeBypassPattern(pattern: string): void {
    config.update(c => ({
      ...c,
      bypassList: c.bypassList.filter(p => p !== pattern),
    }));
  }

  // Section toggle
  function toggleSection(section: string): void {
    expandedSections.update(s => {
      const newSet = new Set(s);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }

  // Import/Export
  async function exportConfig(): Promise<void> {
    const exportData = {
      config: $config,
      presets: $presets,
      exportedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      
      const filePath = await save({
        defaultPath: 'proxy-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
      }
    } else {
      // Browser fallback
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'proxy-config.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function importConfig(): Promise<void> {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      
      const filePath = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath && typeof filePath === 'string') {
        const content = await readTextFile(filePath);
        const importData = JSON.parse(content);
        
        if (importData.config) {
          config.set({ ...defaultConfig, ...importData.config });
        }
        if (importData.presets) {
          presets.set(importData.presets);
        }
        
        await saveConfig();
      }
    }
  }

  // Reset to defaults
  function resetToDefaults(): void {
    config.set({ ...defaultConfig });
    validationErrors.set({});
    testResult.set(null);
  }

  // Reactive validation
  $: {
    $config;
    validateConfig();
  }
</script>

<div class="proxy-settings-manager">
  <header class="proxy-header">
    <div class="header-content">
      <div class="header-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div class="header-text">
        <h2>Proxy Settings</h2>
        <p class="config-summary">{$configSummary}</p>
      </div>
    </div>
    
    <div class="header-actions">
      <button
        class="btn btn-icon"
        on:click={exportConfig}
        title="Export configuration"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button
        class="btn btn-icon"
        on:click={importConfig}
        title="Import configuration"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
    </div>
  </header>

  <div class="proxy-content">
    <!-- Enable Toggle -->
    <div class="setting-group">
      <label class="toggle-setting">
        <span class="toggle-label">
          <span class="label-text">Enable Proxy</span>
          <span class="label-description">Route network traffic through a proxy server</span>
        </span>
        <input
          type="checkbox"
          bind:checked={$config.enabled}
          on:change={saveConfig}
        />
        <span class="toggle-switch"></span>
      </label>
    </div>

    {#if $config.enabled}
      <!-- Proxy Mode -->
      <section class="settings-section">
        <button
          class="section-header"
          on:click={() => toggleSection('basic')}
          aria-expanded={$expandedSections.has('basic')}
        >
          <span class="section-title">Connection Mode</span>
          <svg class="chevron" class:expanded={$expandedSections.has('basic')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {#if $expandedSections.has('basic')}
          <div class="section-content">
            <div class="mode-selector">
              <label class="mode-option" class:selected={$config.mode === 'none'}>
                <input type="radio" bind:group={$config.mode} value="none" on:change={saveConfig} />
                <div class="mode-content">
                  <span class="mode-icon">🔗</span>
                  <span class="mode-name">Direct</span>
                  <span class="mode-desc">No proxy</span>
                </div>
              </label>

              <label class="mode-option" class:selected={$config.mode === 'system'}>
                <input type="radio" bind:group={$config.mode} value="system" on:change={saveConfig} />
                <div class="mode-content">
                  <span class="mode-icon">💻</span>
                  <span class="mode-name">System</span>
                  <span class="mode-desc">Use OS settings</span>
                </div>
              </label>

              <label class="mode-option" class:selected={$config.mode === 'manual'}>
                <input type="radio" bind:group={$config.mode} value="manual" on:change={saveConfig} />
                <div class="mode-content">
                  <span class="mode-icon">⚙️</span>
                  <span class="mode-name">Manual</span>
                  <span class="mode-desc">Configure proxy</span>
                </div>
              </label>

              <label class="mode-option" class:selected={$config.mode === 'pac'}>
                <input type="radio" bind:group={$config.mode} value="pac" on:change={saveConfig} />
                <div class="mode-content">
                  <span class="mode-icon">📜</span>
                  <span class="mode-name">PAC Script</span>
                  <span class="mode-desc">Auto-configure</span>
                </div>
              </label>
            </div>
          </div>
        {/if}
      </section>

      <!-- Manual Configuration -->
      {#if $config.mode === 'manual'}
        <section class="settings-section">
          <button
            class="section-header"
            on:click={() => toggleSection('manual')}
            aria-expanded={$expandedSections.has('manual')}
          >
            <span class="section-title">Proxy Server</span>
            <svg class="chevron" class:expanded={$expandedSections.has('manual')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if $expandedSections.has('manual')}
            <div class="section-content">
              <div class="form-group">
                <label for="protocol">Protocol</label>
                <div class="protocol-selector">
                  {#each protocols as proto}
                    <label class="protocol-option" class:selected={$config.protocol === proto.value}>
                      <input
                        type="radio"
                        bind:group={$config.protocol}
                        value={proto.value}
                        on:change={saveConfig}
                      />
                      <span class="protocol-label">{proto.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <div class="form-row">
                <div class="form-group flex-grow">
                  <label for="host">Host</label>
                  <input
                    id="host"
                    type="text"
                    bind:value={$config.host}
                    on:blur={saveConfig}
                    placeholder="proxy.example.com"
                    class:error={$validationErrors.host}
                  />
                  {#if $validationErrors.host}
                    <span class="error-text">{$validationErrors.host}</span>
                  {/if}
                </div>

                <div class="form-group port-group">
                  <label for="port">Port</label>
                  <input
                    id="port"
                    type="number"
                    bind:value={$config.port}
                    on:blur={saveConfig}
                    min="1"
                    max="65535"
                    class:error={$validationErrors.port}
                  />
                  {#if $validationErrors.port}
                    <span class="error-text">{$validationErrors.port}</span>
                  {/if}
                </div>
              </div>

              {#if showAdvancedOptions && ($config.protocol === 'socks5' || $config.protocol === 'http' || $config.protocol === 'https')}
                <div class="auth-section">
                  <h4>Authentication (Optional)</h4>
                  <div class="form-row">
                    <div class="form-group flex-grow">
                      <label for="username">Username</label>
                      <input
                        id="username"
                        type="text"
                        bind:value={$config.username}
                        on:blur={saveConfig}
                        placeholder="Optional"
                        autocomplete="username"
                      />
                    </div>

                    <div class="form-group flex-grow">
                      <label for="password">Password</label>
                      <div class="password-input">
                        <input
                          id="password"
                          type={$showPassword ? 'text' : 'password'}
                          bind:value={$config.password}
                          on:blur={saveConfig}
                          placeholder="Optional"
                          autocomplete="current-password"
                        />
                        <button
                          type="button"
                          class="btn btn-icon password-toggle"
                          on:click={() => showPassword.update(v => !v)}
                        >
                          {#if $showPassword}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          {:else}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          {/if}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <!-- PAC Configuration -->
      {#if $config.mode === 'pac'}
        <section class="settings-section">
          <button
            class="section-header"
            on:click={() => toggleSection('pac')}
            aria-expanded={$expandedSections.has('pac')}
          >
            <span class="section-title">PAC Script</span>
            <svg class="chevron" class:expanded={$expandedSections.has('pac')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if $expandedSections.has('pac')}
            <div class="section-content">
              <div class="form-group">
                <label for="pacUrl">PAC Script URL</label>
                <input
                  id="pacUrl"
                  type="url"
                  bind:value={$config.pacUrl}
                  on:blur={saveConfig}
                  placeholder="https://example.com/proxy.pac"
                  class:error={$validationErrors.pacUrl}
                />
                {#if $validationErrors.pacUrl}
                  <span class="error-text">{$validationErrors.pacUrl}</span>
                {/if}
                <p class="form-hint">Enter the URL of your Proxy Auto-Configuration script</p>
              </div>
            </div>
          {/if}
        </section>
      {/if}

      <!-- Bypass List -->
      {#if $config.mode === 'manual' && showAdvancedOptions}
        <section class="settings-section">
          <button
            class="section-header"
            on:click={() => toggleSection('bypass')}
            aria-expanded={$expandedSections.has('bypass')}
          >
            <span class="section-title">Bypass Rules</span>
            <span class="badge">{$config.bypassList.length}</span>
            <svg class="chevron" class:expanded={$expandedSections.has('bypass')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if $expandedSections.has('bypass')}
            <div class="section-content">
              <label class="toggle-setting compact">
                <span class="toggle-label">
                  <span class="label-text">Bypass for local addresses</span>
                </span>
                <input
                  type="checkbox"
                  bind:checked={$config.bypassLocal}
                  on:change={saveConfig}
                />
                <span class="toggle-switch"></span>
              </label>

              <div class="bypass-list">
                <div class="bypass-input-row">
                  <input
                    type="text"
                    bind:value={$bypassInput}
                    placeholder="Add pattern (e.g., *.example.com)"
                    on:keydown={(e) => e.key === 'Enter' && addBypassPattern($bypassInput)}
                  />
                  <button
                    class="btn btn-primary"
                    on:click={() => addBypassPattern($bypassInput)}
                    disabled={!$bypassInput.trim()}
                  >
                    Add
                  </button>
                </div>

                <div class="common-patterns">
                  <span class="patterns-label">Quick add:</span>
                  {#each commonBypassPatterns as { pattern, description }}
                    {#if !$config.bypassList.includes(pattern)}
                      <button
                        class="pattern-chip"
                        on:click={() => addBypassPattern(pattern)}
                        title={description}
                      >
                        {pattern}
                      </button>
                    {/if}
                  {/each}
                </div>

                {#if $config.bypassList.length > 0}
                  <ul class="bypass-items">
                    {#each $config.bypassList as pattern}
                      <li class="bypass-item">
                        <code>{pattern}</code>
                        <button
                          class="btn btn-icon btn-small"
                          on:click={() => removeBypassPattern(pattern)}
                          title="Remove pattern"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {/if}
        </section>
      {/if}

      <!-- Presets -->
      {#if showAdvancedOptions}
        <section class="settings-section">
          <button
            class="section-header"
            on:click={() => toggleSection('presets')}
            aria-expanded={$expandedSections.has('presets')}
          >
            <span class="section-title">Saved Presets</span>
            <span class="badge">{$presets.length}/{maxPresets}</span>
            <svg class="chevron" class:expanded={$expandedSections.has('presets')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if $expandedSections.has('presets')}
            <div class="section-content">
              {#if $presets.length > 0}
                <ul class="preset-list">
                  {#each $presets as preset}
                    <li class="preset-item">
                      <div class="preset-info">
                        <span class="preset-name">{preset.name}</span>
                        <span class="preset-details">
                          {preset.config.protocol.toUpperCase()} - {preset.config.host}:{preset.config.port}
                        </span>
                      </div>
                      <div class="preset-actions">
                        <button
                          class="btn btn-small"
                          on:click={() => loadPreset(preset)}
                        >
                          Load
                        </button>
                        <button
                          class="btn btn-icon btn-small btn-danger"
                          on:click={() => deletePreset(preset.id)}
                          title="Delete preset"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty-state">No saved presets</p>
              {/if}

              {#if $config.mode === 'manual' && $isConfigValid && $presets.length < maxPresets}
                <div class="save-preset">
                  <input
                    type="text"
                    id="preset-name"
                    placeholder="Preset name"
                    on:keydown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        savePreset(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    class="btn btn-primary"
                    on:click={() => {
                      const input = document.getElementById('preset-name') as HTMLInputElement;
                      if (input?.value) {
                        savePreset(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Save Current
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/if}

      <!-- Connection Test -->
      <section class="settings-section test-section">
        <div class="test-header">
          <h3>Connection Test</h3>
          <button
            class="btn btn-primary"
            on:click={testConnection}
            disabled={$isTesting || !$isConfigValid}
          >
            {#if $isTesting}
              <span class="spinner"></span>
              Testing...
            {:else}
              Test Connection
            {/if}
          </button>
        </div>

        {#if $testResult}
          <div class="test-result" class:success={$testResult.success} class:error={!$testResult.success}>
            {#if $testResult.success}
              <div class="result-icon success">✓</div>
              <div class="result-details">
                <span class="result-title">Connection Successful</span>
                <span class="result-info">
                  Latency: {$testResult.latency}ms
                  {#if $testResult.externalIp}
                    • External IP: {$testResult.externalIp}
                  {/if}
                </span>
              </div>
            {:else}
              <div class="result-icon error">✗</div>
              <div class="result-details">
                <span class="result-title">Connection Failed</span>
                <span class="result-info">{$testResult.error}</span>
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <footer class="proxy-footer">
    <button class="btn btn-secondary" on:click={resetToDefaults}>
      Reset to Defaults
    </button>
    <button
      class="btn btn-primary"
      on:click={saveConfig}
      disabled={$isSaving || !$isConfigValid}
    >
      {#if $isSaving}
        <span class="spinner"></span>
        Saving...
      {:else}
        Save Settings
      {/if}
    </button>
  </footer>
</div>

<style>
  .proxy-settings-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary, #1e1e1e);
    color: var(--text-primary, #e0e0e0);
    border-radius: 8px;
    overflow: hidden;
  }

  .proxy-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--bg-secondary, #252525);
    border-bottom: 1px solid var(--border-color, #333);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-color, #5865f2);
    border-radius: 10px;
  }

  .header-icon svg {
    width: 24px;
    height: 24px;
    color: white;
  }

  .header-text h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .config-summary {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .proxy-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .setting-group {
    margin-bottom: 16px;
  }

  .toggle-setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 8px;
    cursor: pointer;
  }

  .toggle-setting.compact {
    padding: 8px 12px;
    margin-bottom: 12px;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
  }

  .label-text {
    font-weight: 500;
  }

  .label-description {
    font-size: 12px;
    color: var(--text-secondary, #888);
    margin-top: 2px;
  }

  .toggle-setting input {
    display: none;
  }

  .toggle-switch {
    width: 44px;
    height: 24px;
    background: var(--bg-quaternary, #444);
    border-radius: 12px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle-setting input:checked + .toggle-switch {
    background: var(--accent-color, #5865f2);
  }

  .toggle-setting input:checked + .toggle-switch::after {
    transform: translateX(20px);
  }

  .settings-section {
    background: var(--bg-tertiary, #2a2a2a);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 14px 16px;
    background: none;
    border: none;
    color: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
  }

  .section-header:hover {
    background: var(--bg-quaternary, #333);
  }

  .section-title {
    flex: 1;
  }

  .badge {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--bg-quaternary, #444);
    border-radius: 10px;
    margin-right: 8px;
  }

  .chevron {
    width: 16px;
    height: 16px;
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 0 16px 16px;
  }

  .mode-selector {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .mode-option {
    display: block;
    cursor: pointer;
  }

  .mode-option input {
    display: none;
  }

  .mode-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: var(--bg-quaternary, #333);
    border: 2px solid transparent;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .mode-option:hover .mode-content {
    background: var(--bg-hover, #3a3a3a);
  }

  .mode-option.selected .mode-content {
    border-color: var(--accent-color, #5865f2);
    background: rgba(88, 101, 242, 0.1);
  }

  .mode-icon {
    font-size: 24px;
    margin-bottom: 4px;
  }

  .mode-name {
    font-weight: 500;
    font-size: 13px;
  }

  .mode-desc {
    font-size: 10px;
    color: var(--text-secondary, #888);
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-color, #444);
    border-radius: 6px;
    color: inherit;
    font-size: 14px;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .form-group input.error {
    border-color: var(--error-color, #f04747);
  }

  .error-text {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: var(--error-color, #f04747);
  }

  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .form-row {
    display: flex;
    gap: 12px;
  }

  .flex-grow {
    flex: 1;
  }

  .port-group {
    width: 100px;
    flex-shrink: 0;
  }

  .protocol-selector {
    display: flex;
    gap: 8px;
  }

  .protocol-option {
    cursor: pointer;
  }

  .protocol-option input {
    display: none;
  }

  .protocol-label {
    display: block;
    padding: 8px 16px;
    background: var(--bg-quaternary, #333);
    border: 2px solid transparent;
    border-radius: 6px;
    font-size: 13px;
    transition: all 0.2s;
  }

  .protocol-option:hover .protocol-label {
    background: var(--bg-hover, #3a3a3a);
  }

  .protocol-option.selected .protocol-label {
    border-color: var(--accent-color, #5865f2);
    background: rgba(88, 101, 242, 0.1);
  }

  .auth-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color, #333);
  }

  .auth-section h4 {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-secondary, #888);
  }

  .password-input {
    position: relative;
    display: flex;
  }

  .password-input input {
    padding-right: 40px;
  }

  .password-toggle {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
  }

  .bypass-list {
    margin-top: 12px;
  }

  .bypass-input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .bypass-input-row input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-color, #444);
    border-radius: 6px;
    color: inherit;
  }

  .common-patterns {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    align-items: center;
  }

  .patterns-label {
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .pattern-chip {
    padding: 4px 10px;
    background: var(--bg-quaternary, #333);
    border: none;
    border-radius: 4px;
    color: var(--text-secondary, #888);
    font-size: 11px;
    cursor: pointer;
    font-family: monospace;
  }

  .pattern-chip:hover {
    background: var(--bg-hover, #3a3a3a);
    color: var(--text-primary, #e0e0e0);
  }

  .bypass-items {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .bypass-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-quaternary, #333);
    border-radius: 6px;
    margin-bottom: 6px;
  }

  .bypass-item code {
    font-family: monospace;
    font-size: 13px;
  }

  .preset-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
  }

  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-quaternary, #333);
    border-radius: 6px;
    margin-bottom: 6px;
  }

  .preset-info {
    display: flex;
    flex-direction: column;
  }

  .preset-name {
    font-weight: 500;
  }

  .preset-details {
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .preset-actions {
    display: flex;
    gap: 6px;
  }

  .save-preset {
    display: flex;
    gap: 8px;
  }

  .save-preset input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-input, #1a1a1a);
    border: 1px solid var(--border-color, #444);
    border-radius: 6px;
    color: inherit;
  }

  .empty-state {
    text-align: center;
    color: var(--text-secondary, #888);
    padding: 16px;
  }

  .test-section {
    background: transparent;
  }

  .test-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .test-header h3 {
    margin: 0;
    font-size: 14px;
  }

  .test-result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
  }

  .test-result.success {
    background: rgba(67, 181, 129, 0.1);
    border: 1px solid rgba(67, 181, 129, 0.3);
  }

  .test-result.error {
    background: rgba(240, 71, 71, 0.1);
    border: 1px solid rgba(240, 71, 71, 0.3);
  }

  .result-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: bold;
  }

  .result-icon.success {
    background: rgba(67, 181, 129, 0.2);
    color: #43b581;
  }

  .result-icon.error {
    background: rgba(240, 71, 71, 0.2);
    color: #f04747;
  }

  .result-details {
    display: flex;
    flex-direction: column;
  }

  .result-title {
    font-weight: 500;
  }

  .result-info {
    font-size: 12px;
    color: var(--text-secondary, #888);
  }

  .proxy-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    background: var(--bg-secondary, #252525);
    border-top: 1px solid var(--border-color, #333);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
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
    background: var(--accent-color, #5865f2);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover, #4752c4);
  }

  .btn-secondary {
    background: var(--bg-tertiary, #2a2a2a);
    color: var(--text-primary, #e0e0e0);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-quaternary, #333);
  }

  .btn-icon {
    padding: 8px;
    background: transparent;
  }

  .btn-icon:hover {
    background: var(--bg-quaternary, #333);
  }

  .btn-icon svg {
    width: 18px;
    height: 18px;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 12px;
  }

  .btn-icon.btn-small {
    padding: 4px;
  }

  .btn-icon.btn-small svg {
    width: 14px;
    height: 14px;
  }

  .btn-danger {
    color: var(--error-color, #f04747);
  }

  .btn-danger:hover {
    background: rgba(240, 71, 71, 0.1);
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 600px) {
    .mode-selector {
      grid-template-columns: repeat(2, 1fr);
    }

    .form-row {
      flex-direction: column;
    }

    .port-group {
      width: 100%;
    }

    .protocol-selector {
      flex-wrap: wrap;
    }
  }
</style>
