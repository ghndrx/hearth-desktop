<script lang="ts">
  import { onMount } from 'svelte';

  // Permission types
  type PermissionSet = {
    read: boolean;
    write: boolean;
    execute: boolean;
  };

  type PermissionState = {
    owner: PermissionSet;
    group: PermissionSet;
    others: PermissionSet;
  };

  // State
  let permissions: PermissionState = {
    owner: { read: true, write: true, execute: false },
    group: { read: true, write: false, execute: false },
    others: { read: true, write: false, execute: false }
  };

  let numericInput = '';
  let symbolicInput = '';
  let showCopyFeedback = false;
  let copyFeedbackText = '';
  let activeTab: 'visual' | 'numeric' | 'symbolic' = 'visual';

  // Common presets
  const presets = [
    { name: '755', desc: 'Executable (owner full, others read/exec)', value: '755' },
    { name: '644', desc: 'File (owner rw, others read)', value: '644' },
    { name: '777', desc: 'Full access (everyone)', value: '777' },
    { name: '700', desc: 'Private (owner only)', value: '700' },
    { name: '600', desc: 'Private file (owner rw only)', value: '600' },
    { name: '750', desc: 'Group executable', value: '750' },
    { name: '640', desc: 'Group readable', value: '640' },
    { name: '444', desc: 'Read-only (everyone)', value: '444' }
  ];

  // Convert permission set to octal digit
  function permissionToOctal(perm: PermissionSet): number {
    return (perm.read ? 4 : 0) + (perm.write ? 2 : 0) + (perm.execute ? 1 : 0);
  }

  // Convert octal digit to permission set
  function octalToPermission(digit: number): PermissionSet {
    return {
      read: (digit & 4) !== 0,
      write: (digit & 2) !== 0,
      execute: (digit & 1) !== 0
    };
  }

  // Get full numeric chmod value
  function getNumericValue(): string {
    const owner = permissionToOctal(permissions.owner);
    const group = permissionToOctal(permissions.group);
    const others = permissionToOctal(permissions.others);
    return `${owner}${group}${others}`;
  }

  // Get symbolic representation
  function getSymbolicValue(): string {
    const formatPerm = (perm: PermissionSet): string => {
      return (perm.read ? 'r' : '-') + (perm.write ? 'w' : '-') + (perm.execute ? 'x' : '-');
    };
    return formatPerm(permissions.owner) + formatPerm(permissions.group) + formatPerm(permissions.others);
  }

  // Get chmod command representation (e.g., u=rwx,g=rx,o=rx)
  function getChmodCommand(): string {
    const formatPerm = (perm: PermissionSet): string => {
      let result = '';
      if (perm.read) result += 'r';
      if (perm.write) result += 'w';
      if (perm.execute) result += 'x';
      return result || '-';
    };
    
    const owner = formatPerm(permissions.owner);
    const group = formatPerm(permissions.group);
    const others = formatPerm(permissions.others);
    
    const parts: string[] = [];
    if (owner !== '-') parts.push(`u=${owner}`);
    if (group !== '-') parts.push(`g=${group}`);
    if (others !== '-') parts.push(`o=${others}`);
    
    return parts.length > 0 ? parts.join(',') : 'u=,g=,o=';
  }

  // Parse numeric input
  function parseNumeric(value: string): boolean {
    if (!/^[0-7]{3}$/.test(value)) return false;
    
    const digits = value.split('').map(Number);
    permissions = {
      owner: octalToPermission(digits[0]),
      group: octalToPermission(digits[1]),
      others: octalToPermission(digits[2])
    };
    return true;
  }

  // Parse symbolic input (e.g., rwxr-xr-x)
  function parseSymbolic(value: string): boolean {
    if (!/^[rwx-]{9}$/.test(value)) return false;
    
    const parseSet = (str: string): PermissionSet => ({
      read: str[0] === 'r',
      write: str[1] === 'w',
      execute: str[2] === 'x'
    });
    
    permissions = {
      owner: parseSet(value.slice(0, 3)),
      group: parseSet(value.slice(3, 6)),
      others: parseSet(value.slice(6, 9))
    };
    return true;
  }

  // Handle numeric input change
  function handleNumericInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    numericInput = value;
    if (parseNumeric(value)) {
      symbolicInput = getSymbolicValue();
    }
  }

  // Handle symbolic input change
  function handleSymbolicInput(e: Event) {
    const value = (e.target as HTMLInputElement).value.toLowerCase();
    symbolicInput = value;
    if (parseSymbolic(value)) {
      numericInput = getNumericValue();
    }
  }

  // Apply preset
  function applyPreset(value: string) {
    parseNumeric(value);
    numericInput = value;
    symbolicInput = getSymbolicValue();
  }

  // Copy to clipboard
  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedbackText = `${label} copied!`;
      showCopyFeedback = true;
      setTimeout(() => {
        showCopyFeedback = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  // Toggle individual permission
  function togglePermission(target: 'owner' | 'group' | 'others', perm: 'read' | 'write' | 'execute') {
    permissions[target][perm] = !permissions[target][perm];
    permissions = permissions; // Trigger reactivity
    numericInput = getNumericValue();
    symbolicInput = getSymbolicValue();
  }

  // Initialize inputs
  onMount(() => {
    numericInput = getNumericValue();
    symbolicInput = getSymbolicValue();
  });

  // Reactive statements for visual mode updates
  $: {
    if (permissions) {
      numericInput = getNumericValue();
      symbolicInput = getSymbolicValue();
    }
  }
</script>

<div class="chmod-calculator" role="application" aria-label="Chmod Permission Calculator">
  <div class="header">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
        <path d="M12 18v-6"/>
        <path d="M9 15l3 3 3-3"/>
      </svg>
      Chmod Calculator
    </h3>
  </div>

  <!-- Tab Navigation -->
  <div class="tabs" role="tablist">
    <button
      class="tab"
      class:active={activeTab === 'visual'}
      on:click={() => activeTab = 'visual'}
      role="tab"
      aria-selected={activeTab === 'visual'}
    >
      Visual
    </button>
    <button
      class="tab"
      class:active={activeTab === 'numeric'}
      on:click={() => activeTab = 'numeric'}
      role="tab"
      aria-selected={activeTab === 'numeric'}
    >
      Numeric
    </button>
    <button
      class="tab"
      class:active={activeTab === 'symbolic'}
      on:click={() => activeTab = 'symbolic'}
      role="tab"
      aria-selected={activeTab === 'symbolic'}
    >
      Symbolic
    </button>
  </div>

  <div class="content">
    {#if activeTab === 'visual'}
      <!-- Visual Permission Grid -->
      <div class="permission-grid">
        <div class="grid-header">
          <div class="label-cell"></div>
          <div class="perm-header">Read</div>
          <div class="perm-header">Write</div>
          <div class="perm-header">Execute</div>
          <div class="octal-header">Octal</div>
        </div>
        
        {#each [
          { key: 'owner', label: 'Owner (u)' },
          { key: 'group', label: 'Group (g)' },
          { key: 'others', label: 'Others (o)' }
        ] as { key, label } (key)}
          <div class="grid-row">
            <div class="label-cell">{label}</div>
            <div class="perm-cell">
              <button
                class="perm-toggle"
                class:active={permissions[key].read}
                on:click={() => togglePermission(key, 'read')}
                aria-label="{label} read permission"
                aria-pressed={permissions[key].read}
              >
                r
              </button>
            </div>
            <div class="perm-cell">
              <button
                class="perm-toggle"
                class:active={permissions[key].write}
                on:click={() => togglePermission(key, 'write')}
                aria-label="{label} write permission"
                aria-pressed={permissions[key].write}
              >
                w
              </button>
            </div>
            <div class="perm-cell">
              <button
                class="perm-toggle"
                class:active={permissions[key].execute}
                on:click={() => togglePermission(key, 'execute')}
                aria-label="{label} execute permission"
                aria-pressed={permissions[key].execute}
              >
                x
              </button>
            </div>
            <div class="octal-cell">{permissionToOctal(permissions[key])}</div>
          </div>
        {/each}
      </div>

      <!-- Presets -->
      <div class="presets">
        <div class="presets-label">Common Presets:</div>
        <div class="presets-grid">
          {#each presets as preset}
            <button
              class="preset-btn"
              class:active={getNumericValue() === preset.value}
              on:click={() => applyPreset(preset.value)}
              title={preset.desc}
            >
              {preset.name}
            </button>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'numeric'}
      <!-- Numeric Input -->
      <div class="input-section">
        <label for="numeric-input">Enter octal value (e.g., 755):</label>
        <input
          id="numeric-input"
          type="text"
          class="mode-input"
          value={numericInput}
          on:input={handleNumericInput}
          maxlength="3"
          placeholder="755"
          pattern="[0-7]{3}"
        />
        <div class="input-hint">
          Use digits 0-7 for each position (owner, group, others)
        </div>
      </div>
    {:else}
      <!-- Symbolic Input -->
      <div class="input-section">
        <label for="symbolic-input">Enter symbolic value (e.g., rwxr-xr-x):</label>
        <input
          id="symbolic-input"
          type="text"
          class="mode-input"
          value={symbolicInput}
          on:input={handleSymbolicInput}
          maxlength="9"
          placeholder="rwxr-xr-x"
          pattern="[rwx-]{9}"
        />
        <div class="input-hint">
          Use r (read), w (write), x (execute), or - (none)
        </div>
      </div>
    {/if}

    <!-- Results -->
    <div class="results">
      <div class="result-row">
        <span class="result-label">Numeric:</span>
        <code class="result-value">{getNumericValue()}</code>
        <button
          class="copy-btn"
          on:click={() => copyToClipboard(getNumericValue(), 'Numeric value')}
          title="Copy numeric value"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>

      <div class="result-row">
        <span class="result-label">Symbolic:</span>
        <code class="result-value">{getSymbolicValue()}</code>
        <button
          class="copy-btn"
          on:click={() => copyToClipboard(getSymbolicValue(), 'Symbolic value')}
          title="Copy symbolic value"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>

      <div class="result-row command-row">
        <span class="result-label">Command:</span>
        <code class="result-value command">chmod {getNumericValue()} filename</code>
        <button
          class="copy-btn"
          on:click={() => copyToClipboard(`chmod ${getNumericValue()} filename`, 'Command')}
          title="Copy command"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>

      <div class="result-row command-row">
        <span class="result-label">Symbolic cmd:</span>
        <code class="result-value command">chmod {getChmodCommand()} filename</code>
        <button
          class="copy-btn"
          on:click={() => copyToClipboard(`chmod ${getChmodCommand()} filename`, 'Symbolic command')}
          title="Copy symbolic command"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Permission Description -->
    <div class="description">
      <div class="desc-title">Permission Breakdown:</div>
      <div class="desc-item">
        <span class="desc-label">Owner:</span>
        <span>{permissions.owner.read ? 'read' : ''} {permissions.owner.write ? 'write' : ''} {permissions.owner.execute ? 'execute' : ''}</span>
        {#if !permissions.owner.read && !permissions.owner.write && !permissions.owner.execute}
          <span class="no-perm">no permissions</span>
        {/if}
      </div>
      <div class="desc-item">
        <span class="desc-label">Group:</span>
        <span>{permissions.group.read ? 'read' : ''} {permissions.group.write ? 'write' : ''} {permissions.group.execute ? 'execute' : ''}</span>
        {#if !permissions.group.read && !permissions.group.write && !permissions.group.execute}
          <span class="no-perm">no permissions</span>
        {/if}
      </div>
      <div class="desc-item">
        <span class="desc-label">Others:</span>
        <span>{permissions.others.read ? 'read' : ''} {permissions.others.write ? 'write' : ''} {permissions.others.execute ? 'execute' : ''}</span>
        {#if !permissions.others.read && !permissions.others.write && !permissions.others.execute}
          <span class="no-perm">no permissions</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Copy Feedback -->
  {#if showCopyFeedback}
    <div class="copy-feedback" role="status" aria-live="polite">
      {copyFeedbackText}
    </div>
  {/if}
</div>

<style>
  .chmod-calculator {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    padding: 16px;
    color: var(--text-primary, #f2f3f5);
    font-family: var(--font-sans, system-ui, sans-serif);
    position: relative;
    min-width: 320px;
  }

  .header {
    margin-bottom: 12px;
  }

  .header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }

  .header svg {
    color: var(--accent, #5865f2);
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    background: var(--bg-tertiary, #1e1f22);
    padding: 4px;
    border-radius: 6px;
  }

  .tab {
    flex: 1;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #b5bac1);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: var(--text-primary, #f2f3f5);
    background: var(--bg-secondary, #2b2d31);
  }

  .tab.active {
    background: var(--accent, #5865f2);
    color: white;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Permission Grid */
  .permission-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
  }

  .grid-header,
  .grid-row {
    display: grid;
    grid-template-columns: 90px repeat(3, 1fr) 50px;
    gap: 8px;
    align-items: center;
  }

  .grid-header {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #3f4147);
  }

  .perm-header,
  .octal-header {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
    text-align: center;
  }

  .label-cell {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #b5bac1);
  }

  .perm-cell {
    display: flex;
    justify-content: center;
  }

  .perm-toggle {
    width: 36px;
    height: 36px;
    border: 2px solid var(--border-color, #3f4147);
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-muted, #949ba4);
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .perm-toggle:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .perm-toggle.active {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: white;
  }

  .octal-cell {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 16px;
    font-weight: 600;
    color: var(--accent, #5865f2);
    text-align: center;
  }

  /* Presets */
  .presets {
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
  }

  .presets-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted, #949ba4);
    margin-bottom: 8px;
  }

  .presets-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .preset-btn {
    padding: 6px 10px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-secondary, #b5bac1);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .preset-btn.active {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: white;
  }

  /* Input Section */
  .input-section {
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
  }

  .input-section label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary, #b5bac1);
    margin-bottom: 8px;
  }

  .mode-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #f2f3f5);
    font-size: 18px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: 2px;
    border-radius: 6px;
    box-sizing: border-box;
  }

  .mode-input:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .input-hint {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    margin-top: 6px;
  }

  /* Results */
  .results {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
  }

  .result-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .result-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted, #949ba4);
    min-width: 90px;
  }

  .result-value {
    flex: 1;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 14px;
    color: var(--text-primary, #f2f3f5);
    background: var(--bg-secondary, #2b2d31);
    padding: 6px 10px;
    border-radius: 4px;
  }

  .result-value.command {
    font-size: 12px;
    color: var(--success, #3ba55c);
  }

  .copy-btn {
    padding: 6px;
    border: none;
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-muted, #949ba4);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: var(--accent, #5865f2);
    color: white;
  }

  /* Description */
  .description {
    background: var(--bg-tertiary, #1e1f22);
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
  }

  .desc-title {
    font-weight: 600;
    color: var(--text-secondary, #b5bac1);
    margin-bottom: 8px;
  }

  .desc-item {
    display: flex;
    gap: 8px;
    color: var(--text-muted, #949ba4);
    margin-bottom: 4px;
  }

  .desc-item:last-child {
    margin-bottom: 0;
  }

  .desc-label {
    font-weight: 500;
    min-width: 60px;
    color: var(--text-secondary, #b5bac1);
  }

  .no-perm {
    font-style: italic;
    color: var(--warning, #faa61a);
  }

  /* Copy Feedback */
  .copy-feedback {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success, #3ba55c);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    animation: fadeInOut 2s ease;
    pointer-events: none;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  }

  /* Responsive */
  @media (max-width: 400px) {
    .chmod-calculator {
      padding: 12px;
      min-width: auto;
    }

    .presets-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .result-label {
      min-width: 70px;
    }
  }
</style>
