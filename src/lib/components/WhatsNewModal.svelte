<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { getVersion } from '@tauri-apps/api/app';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';

  export let show = false;
  export let forceShow = false;

  const dispatch = createEventDispatcher<{
    close: void;
    acknowledge: string;
  }>();

  interface ChangelogEntry {
    version: string;
    date: string;
    highlights: string[];
    features: string[];
    fixes: string[];
    breaking?: string[];
  }

  const changelog: ChangelogEntry[] = [
    {
      version: '0.9.0',
      date: '2026-02-25',
      highlights: [
        'Mini Mode / Picture-in-Picture for compact viewing',
        'Window opacity control for overlay workflows',
        'Enhanced keyboard navigation accessibility'
      ],
      features: [
        'Added Mini Mode with always-on-top support',
        'Window opacity slider (20-100%)',
        'ZoomControl for accessibility scaling',
        'Global keyboard shortcuts manager',
        'Clipboard manager with rich content support',
        'Idle detection with automatic presence updates',
        'Sound notification manager with custom alerts',
        'Multi-step onboarding wizard'
      ],
      fixes: [
        'Improved spellcheck performance',
        'Fixed file drop handling on Linux',
        'Better theme synchronization with system'
      ]
    },
    {
      version: '0.8.0',
      date: '2026-02-20',
      highlights: [
        'Full-featured AI Chat integration',
        'Native screenshot capture',
        'Performance monitoring dashboard'
      ],
      features: [
        'AI Chat panel with streaming responses',
        'Screenshot capture with annotation tools',
        'Performance monitor for CPU/memory tracking',
        'Auto-launch settings',
        'Battery indicator for laptops',
        'Network status monitoring'
      ],
      fixes: [
        'Resolved memory leak in voice channels',
        'Fixed notification badge counts',
        'Improved dark mode contrast'
      ]
    },
    {
      version: '0.7.0',
      date: '2026-02-14',
      highlights: [
        'Native file manager integration',
        'Do Not Disturb scheduling',
        'Command palette for quick actions'
      ],
      features: [
        'Native file manager with drag-and-drop',
        'DND schedule with custom time ranges',
        'Command palette (Cmd/Ctrl+K)',
        'Quick actions panel',
        'Read receipt indicators',
        'Badge manager for unread counts'
      ],
      fixes: [
        'Fixed window state restoration',
        'Improved emoji picker search',
        'Better thread sidebar performance'
      ]
    }
  ];

  let currentVersion = '';
  let lastSeenVersion = '';
  let selectedEntry: ChangelogEntry | null = null;
  let hasUnseenUpdates = false;

  onMount(async () => {
    try {
      currentVersion = await getVersion();
      lastSeenVersion = await invoke<string>('get_last_seen_version').catch(() => '');
      
      hasUnseenUpdates = !lastSeenVersion || compareVersions(currentVersion, lastSeenVersion) > 0;
      
      if (hasUnseenUpdates && !forceShow) {
        show = true;
      }
      
      selectedEntry = changelog[0] || null;
    } catch (err) {
      console.error('Failed to check version:', err);
      selectedEntry = changelog[0] || null;
    }
  });

  function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
  }

  function isNewVersion(version: string): boolean {
    return !lastSeenVersion || compareVersions(version, lastSeenVersion) > 0;
  }

  async function handleClose() {
    show = false;
    dispatch('close');
  }

  async function handleAcknowledge() {
    try {
      await invoke('set_last_seen_version', { version: currentVersion });
      lastSeenVersion = currentVersion;
      hasUnseenUpdates = false;
    } catch (err) {
      console.error('Failed to save version:', err);
    }
    
    dispatch('acknowledge', currentVersion);
    handleClose();
  }

  function selectVersion(entry: ChangelogEntry) {
    selectedEntry = entry;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
</script>

{#if show}
  <Modal on:close={handleClose} size="large">
    <div class="whats-new" transition:fade={{ duration: 200 }}>
      <header class="whats-new-header">
        <div class="header-icon">🎉</div>
        <div class="header-text">
          <h2>What's New in Hearth</h2>
          <p class="current-version">Version {currentVersion}</p>
        </div>
      </header>

      <div class="whats-new-content">
        <aside class="version-list">
          <h3>Versions</h3>
          <ul>
            {#each changelog as entry}
              <li>
                <button
                  class="version-item"
                  class:selected={selectedEntry?.version === entry.version}
                  class:new={isNewVersion(entry.version)}
                  on:click={() => selectVersion(entry)}
                >
                  <span class="version-number">v{entry.version}</span>
                  {#if isNewVersion(entry.version)}
                    <span class="new-badge">NEW</span>
                  {/if}
                  <span class="version-date">{formatDate(entry.date)}</span>
                </button>
              </li>
            {/each}
          </ul>
        </aside>

        <main class="changelog-details">
          {#if selectedEntry}
            <div class="entry" transition:fly={{ x: 20, duration: 200 }}>
              <div class="entry-header">
                <h3>Version {selectedEntry.version}</h3>
                <time datetime={selectedEntry.date}>{formatDate(selectedEntry.date)}</time>
              </div>

              {#if selectedEntry.highlights.length > 0}
                <section class="highlights">
                  <h4>✨ Highlights</h4>
                  <ul>
                    {#each selectedEntry.highlights as highlight}
                      <li>{highlight}</li>
                    {/each}
                  </ul>
                </section>
              {/if}

              {#if selectedEntry.features.length > 0}
                <section class="features">
                  <h4>🚀 New Features</h4>
                  <ul>
                    {#each selectedEntry.features as feature}
                      <li>{feature}</li>
                    {/each}
                  </ul>
                </section>
              {/if}

              {#if selectedEntry.fixes.length > 0}
                <section class="fixes">
                  <h4>🐛 Bug Fixes</h4>
                  <ul>
                    {#each selectedEntry.fixes as fix}
                      <li>{fix}</li>
                    {/each}
                  </ul>
                </section>
              {/if}

              {#if selectedEntry.breaking && selectedEntry.breaking.length > 0}
                <section class="breaking">
                  <h4>⚠️ Breaking Changes</h4>
                  <ul>
                    {#each selectedEntry.breaking as change}
                      <li>{change}</li>
                    {/each}
                  </ul>
                </section>
              {/if}
            </div>
          {/if}
        </main>
      </div>

      <footer class="whats-new-footer">
        <Button variant="secondary" on:click={handleClose}>
          Maybe Later
        </Button>
        <Button variant="primary" on:click={handleAcknowledge}>
          {hasUnseenUpdates ? "Got It!" : "Close"}
        </Button>
      </footer>
    </div>
  </Modal>
{/if}

<style>
  .whats-new {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 80vh;
    background: var(--bg-primary);
    border-radius: 12px;
    overflow: hidden;
  }

  .whats-new-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, var(--accent-primary)) 100%);
    color: white;
  }

  .header-icon {
    font-size: 48px;
    line-height: 1;
  }

  .header-text h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }

  .current-version {
    margin: 4px 0 0;
    opacity: 0.9;
    font-size: 14px;
  }

  .whats-new-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .version-list {
    width: 200px;
    border-right: 1px solid var(--border-primary);
    background: var(--bg-secondary);
    overflow-y: auto;
  }

  .version-list h3 {
    padding: 16px;
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .version-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .version-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.15s;
  }

  .version-item:hover {
    background: var(--bg-tertiary);
  }

  .version-item.selected {
    background: var(--bg-accent);
    border-left: 3px solid var(--accent-primary);
  }

  .version-number {
    font-weight: 600;
    color: var(--text-primary);
  }

  .new-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--accent-primary);
    color: white;
    font-weight: 700;
  }

  .version-date {
    width: 100%;
    font-size: 12px;
    color: var(--text-muted);
  }

  .changelog-details {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
  }

  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-primary);
  }

  .entry-header h3 {
    margin: 0;
    font-size: 20px;
    color: var(--text-primary);
  }

  .entry-header time {
    font-size: 14px;
    color: var(--text-muted);
  }

  section {
    margin-bottom: 20px;
  }

  section h4 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  section ul {
    margin: 0;
    padding-left: 20px;
  }

  section li {
    margin-bottom: 8px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .highlights ul {
    list-style-type: none;
    padding-left: 0;
  }

  .highlights li {
    position: relative;
    padding-left: 24px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .highlights li::before {
    content: "→";
    position: absolute;
    left: 0;
    color: var(--accent-primary);
  }

  .breaking {
    background: rgba(255, 100, 100, 0.1);
    border-radius: 8px;
    padding: 16px;
    border-left: 3px solid #ff6464;
  }

  .breaking h4 {
    color: #ff6464;
  }

  .whats-new-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-primary);
    background: var(--bg-secondary);
  }

  @media (max-width: 600px) {
    .whats-new-content {
      flex-direction: column;
    }

    .version-list {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border-primary);
      max-height: 150px;
    }

    .version-list ul {
      display: flex;
      overflow-x: auto;
      padding: 8px;
      gap: 8px;
    }

    .version-item {
      white-space: nowrap;
      padding: 8px 12px;
      border-radius: 8px;
    }

    .version-item.selected {
      border-left: none;
      border-radius: 8px;
    }
  }
</style>
