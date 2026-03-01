<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable } from 'svelte/store';
  import { fade, fly, slide } from 'svelte/transition';
  import { quintOut, elasticOut } from 'svelte/easing';
  import { invoke } from '@tauri-apps/api/core';

  // Types
  export interface HelpTopic {
    id: string;
    title: string;
    category: HelpCategory;
    content: string;
    shortcut?: string;
    relatedFeatures?: string[];
    videoUrl?: string;
    docsUrl?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    viewCount?: number;
    helpfulCount?: number;
    lastViewed?: Date;
  }

  export type HelpCategory =
    | 'getting-started'
    | 'messaging'
    | 'voice'
    | 'notifications'
    | 'privacy'
    | 'customization'
    | 'shortcuts'
    | 'productivity'
    | 'accessibility'
    | 'troubleshooting';

  export interface HelpContext {
    currentView: string;
    activeFeature?: string;
    userLevel: 'new' | 'regular' | 'power';
    recentActions: string[];
  }

  export interface HelpSearchResult {
    topic: HelpTopic;
    score: number;
    matchedTerms: string[];
  }

  // Props
  export let isOpen: boolean = false;
  export let position: 'right' | 'bottom' | 'floating' = 'right';
  export let autoShow: boolean = true;
  export let context: HelpContext | null = null;

  // State
  const dispatch = createEventDispatcher<{
    close: void;
    topicSelected: HelpTopic;
    feedbackSubmitted: { topicId: string; helpful: boolean };
  }>();

  let searchQuery = '';
  let selectedCategory: HelpCategory | 'all' = 'all';
  let selectedTopic: HelpTopic | null = null;
  let searchResults: HelpSearchResult[] = [];
  let isSearching = false;
  let showTips = true;
  let pinnedTopics: Set<string> = new Set();
  let viewHistory: string[] = [];

  // Help topics database
  const helpTopics: Writable<HelpTopic[]> = writable([
    {
      id: 'quick-actions',
      title: 'Quick Actions Panel',
      category: 'productivity',
      content: `The Quick Actions Panel (Ctrl+K) gives you instant access to common tasks without navigating through menus.

**How to use:**
1. Press Ctrl+K (or Cmd+K on Mac) to open
2. Start typing to search for actions
3. Use arrow keys to navigate
4. Press Enter to execute

**Pro tips:**
- Recent actions appear at the top
- Use categories to filter results
- Pin frequently used actions`,
      shortcut: 'Ctrl+K',
      relatedFeatures: ['command-palette', 'keyboard-shortcuts'],
      difficulty: 'beginner',
      tags: ['shortcuts', 'productivity', 'navigation'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'focus-mode',
      title: 'Focus Mode',
      category: 'productivity',
      content: `Focus Mode helps you concentrate by minimizing distractions.

**Features:**
- Mutes non-essential notifications
- Dims inactive windows
- Shows focus timer
- Tracks focus sessions

**Shortcuts:**
- Toggle: Ctrl+Shift+F
- Quick break: Ctrl+Shift+B

**Integration:**
Focus Mode syncs with your calendar to auto-enable during meetings.`,
      shortcut: 'Ctrl+Shift+F',
      relatedFeatures: ['notifications', 'do-not-disturb'],
      difficulty: 'beginner',
      tags: ['focus', 'productivity', 'notifications'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'keyboard-navigation',
      title: 'Keyboard Navigation',
      category: 'accessibility',
      content: `Navigate the entire app without touching your mouse.

**Essential shortcuts:**
- F6: Cycle through regions
- Tab: Move between elements
- Escape: Close modals/menus
- ?: Show shortcuts help

**Region navigation:**
The app is divided into regions (sidebar, main content, panels). Press F6 to move between them.

**Skip links:**
Press Tab when focused on the window to access skip links for quick navigation.`,
      shortcut: 'F6',
      relatedFeatures: ['accessibility', 'shortcuts'],
      difficulty: 'intermediate',
      tags: ['accessibility', 'keyboard', 'navigation'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'system-tray',
      title: 'System Tray Integration',
      category: 'customization',
      content: `The system tray provides quick access to common actions when the app is minimized.

**Right-click menu options:**
- Show/Hide window
- Toggle mute
- Enable focus mode
- Check for updates
- Quit application

**Tips:**
- Double-click the tray icon to toggle window
- The icon shows notification count
- Color changes based on status`,
      relatedFeatures: ['minimize-to-tray', 'notifications'],
      difficulty: 'beginner',
      tags: ['tray', 'desktop', 'integration'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'voice-dictation',
      title: 'Voice Dictation',
      category: 'productivity',
      content: `Speak to type messages hands-free using Voice Dictation.

**Getting started:**
1. Press Ctrl+Shift+D to open dictation panel
2. Click the microphone or press Space
3. Speak clearly
4. Click stop or press Space again

**Voice commands:**
- "Period" - inserts .
- "New paragraph" - inserts line breaks
- "Delete that" - removes last phrase

**Languages:**
Supports 18 languages. Change in Settings > Voice.`,
      shortcut: 'Ctrl+Shift+D',
      relatedFeatures: ['voice', 'accessibility'],
      difficulty: 'intermediate',
      tags: ['voice', 'dictation', 'accessibility'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'quick-notes',
      title: 'Quick Notes',
      category: 'productivity',
      content: `Capture thoughts instantly with Quick Notes - a floating notepad always at your fingertips.

**Features:**
- Color-coded notes
- Pin important notes
- Search across all notes
- Persistent storage

**Usage:**
- Open from toolbar or tray menu
- Drag to reposition
- Right-click for options

**Pro tip:**
Pin notes to keep them visible during calls or focus sessions.`,
      relatedFeatures: ['productivity', 'floating-panels'],
      difficulty: 'beginner',
      tags: ['notes', 'productivity', 'quick-capture'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'privacy-lock',
      title: 'Privacy Lock',
      category: 'privacy',
      content: `Protect your conversations with Privacy Lock when stepping away.

**How it works:**
1. Enable in Settings > Privacy
2. Set a PIN or use biometrics
3. App locks after timeout or manually

**Manual lock:**
Press Ctrl+Shift+L to instantly lock the app.

**Security features:**
- Screen blur when locked
- Notification preview hiding
- Auto-lock on sleep`,
      shortcut: 'Ctrl+Shift+L',
      relatedFeatures: ['privacy', 'security'],
      difficulty: 'intermediate',
      tags: ['privacy', 'security', 'lock'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'notification-center',
      title: 'Notification Center',
      category: 'notifications',
      content: `All your notifications in one place with smart filtering and management.

**Features:**
- Filter by type (all/unread/pinned)
- Group by category
- Pin important notifications
- Do Not Disturb mode

**Quick actions:**
- Click to view details
- Swipe to dismiss
- Long-press to pin

**Settings:**
Customize notification behavior in Settings > Notifications.`,
      relatedFeatures: ['notifications', 'do-not-disturb'],
      difficulty: 'beginner',
      tags: ['notifications', 'management', 'alerts'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'window-management',
      title: 'Window Management',
      category: 'customization',
      content: `Advanced window controls for multi-tasking power users.

**Snap zones:**
Drag windows to screen edges to snap into position.

**Presets:**
Save and restore window layouts with presets.

**Shortcuts:**
- Ctrl+Shift+Left/Right: Snap to half
- Ctrl+Shift+Up: Maximize
- Ctrl+Shift+Down: Minimize

**Multi-monitor:**
Windows remember position per monitor setup.`,
      relatedFeatures: ['window-snapping', 'window-presets'],
      difficulty: 'advanced',
      tags: ['windows', 'layout', 'multi-monitor'],
      viewCount: 0,
      helpfulCount: 0
    },
    {
      id: 'troubleshooting-audio',
      title: 'Audio Troubleshooting',
      category: 'troubleshooting',
      content: `Having audio issues? Try these steps:

**No sound:**
1. Check system volume
2. Verify app isn't muted (tray icon)
3. Check Settings > Audio
4. Restart audio system

**Microphone issues:**
1. Grant microphone permission
2. Select correct input device
3. Check input level meter
4. Try a different mic

**Still having issues?**
Generate a diagnostic report in Settings > About > Diagnostics.`,
      relatedFeatures: ['voice', 'audio-settings'],
      difficulty: 'intermediate',
      tags: ['troubleshooting', 'audio', 'voice'],
      viewCount: 0,
      helpfulCount: 0
    }
  ]);

  // Category metadata
  const categories: Record<HelpCategory, { label: string; icon: string; color: string }> = {
    'getting-started': { label: 'Getting Started', icon: '🚀', color: '#10b981' },
    'messaging': { label: 'Messaging', icon: '💬', color: '#3b82f6' },
    'voice': { label: 'Voice & Audio', icon: '🎤', color: '#8b5cf6' },
    'notifications': { label: 'Notifications', icon: '🔔', color: '#f59e0b' },
    'privacy': { label: 'Privacy & Security', icon: '🔒', color: '#ef4444' },
    'customization': { label: 'Customization', icon: '🎨', color: '#ec4899' },
    'shortcuts': { label: 'Keyboard Shortcuts', icon: '⌨️', color: '#6366f1' },
    'productivity': { label: 'Productivity', icon: '⚡', color: '#14b8a6' },
    'accessibility': { label: 'Accessibility', icon: '♿', color: '#0ea5e9' },
    'troubleshooting': { label: 'Troubleshooting', icon: '🔧', color: '#f97316' }
  };

  // Contextual tips based on current view
  const contextualTips: Record<string, string[]> = {
    'chat': ['quick-actions', 'keyboard-navigation', 'voice-dictation'],
    'settings': ['customization', 'privacy-lock', 'notification-center'],
    'voice-call': ['troubleshooting-audio', 'voice-dictation'],
    'focus': ['focus-mode', 'quick-notes'],
    'default': ['getting-started', 'quick-actions', 'keyboard-navigation']
  };

  // Derived stores
  const filteredTopics = derived(helpTopics, ($topics) => {
    let filtered = $topics;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  });

  const suggestedTopics = derived([helpTopics], ([$topics]) => {
    if (!context) return $topics.slice(0, 3);
    
    const contextKey = context.currentView || 'default';
    const suggestedIds = contextualTips[contextKey] || contextualTips['default'];
    
    return $topics.filter(t => suggestedIds.includes(t.id));
  });

  // Functions
  function selectTopic(topic: HelpTopic) {
    selectedTopic = topic;
    
    // Update view count
    helpTopics.update(topics => 
      topics.map(t => 
        t.id === topic.id 
          ? { ...t, viewCount: (t.viewCount || 0) + 1, lastViewed: new Date() }
          : t
      )
    );
    
    // Add to history
    if (!viewHistory.includes(topic.id)) {
      viewHistory = [topic.id, ...viewHistory.slice(0, 9)];
    }
    
    dispatch('topicSelected', topic);
  }

  function goBack() {
    selectedTopic = null;
  }

  function togglePin(topicId: string) {
    if (pinnedTopics.has(topicId)) {
      pinnedTopics.delete(topicId);
    } else {
      pinnedTopics.add(topicId);
    }
    pinnedTopics = pinnedTopics;
    savePinnedTopics();
  }

  function submitFeedback(topicId: string, helpful: boolean) {
    helpTopics.update(topics =>
      topics.map(t =>
        t.id === topicId && helpful
          ? { ...t, helpfulCount: (t.helpfulCount || 0) + 1 }
          : t
      )
    );
    dispatch('feedbackSubmitted', { topicId, helpful });
  }

  async function searchTopics() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    
    isSearching = true;
    const query = searchQuery.toLowerCase();
    
    searchResults = $helpTopics
      .map(topic => {
        let score = 0;
        const matchedTerms: string[] = [];
        
        if (topic.title.toLowerCase().includes(query)) {
          score += 10;
          matchedTerms.push('title');
        }
        if (topic.content.toLowerCase().includes(query)) {
          score += 5;
          matchedTerms.push('content');
        }
        topic.tags?.forEach(tag => {
          if (tag.toLowerCase().includes(query)) {
            score += 3;
            matchedTerms.push(`tag:${tag}`);
          }
        });
        
        return { topic, score, matchedTerms };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
    
    isSearching = false;
  }

  async function loadPinnedTopics() {
    try {
      const saved = localStorage.getItem('help-pinned-topics');
      if (saved) {
        pinnedTopics = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load pinned topics:', e);
    }
  }

  function savePinnedTopics() {
    try {
      localStorage.setItem('help-pinned-topics', JSON.stringify([...pinnedTopics]));
    } catch (e) {
      console.error('Failed to save pinned topics:', e);
    }
  }

  function getDifficultyColor(difficulty?: string): string {
    switch (difficulty) {
      case 'beginner': return '#10b981';
      case 'intermediate': return '#f59e0b';
      case 'advanced': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  // Lifecycle
  onMount(() => {
    loadPinnedTopics();
  });

  // Reactivity
  $: if (searchQuery) {
    searchTopics();
  }
</script>

{#if isOpen}
  <div
    class="contextual-help-panel"
    class:position-right={position === 'right'}
    class:position-bottom={position === 'bottom'}
    class:position-floating={position === 'floating'}
    transition:fly={{ x: position === 'right' ? 300 : 0, y: position === 'bottom' ? 300 : 0, duration: 300 }}
  >
    <!-- Header -->
    <header class="help-header">
      <div class="header-content">
        {#if selectedTopic}
          <button class="back-btn" on:click={goBack} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        {/if}
        <h2 class="header-title">
          {selectedTopic ? selectedTopic.title : '💡 Help & Tips'}
        </h2>
      </div>
      <button class="close-btn" on:click={close} title="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </header>

    <!-- Content -->
    <div class="help-content">
      {#if selectedTopic}
        <!-- Topic Detail View -->
        <article class="topic-detail" transition:fade={{ duration: 200 }}>
          <div class="topic-meta">
            <span class="category-badge" style="background-color: {categories[selectedTopic.category].color}20; color: {categories[selectedTopic.category].color}">
              {categories[selectedTopic.category].icon} {categories[selectedTopic.category].label}
            </span>
            {#if selectedTopic.difficulty}
              <span class="difficulty-badge" style="color: {getDifficultyColor(selectedTopic.difficulty)}">
                {selectedTopic.difficulty}
              </span>
            {/if}
            {#if selectedTopic.shortcut}
              <kbd class="shortcut-badge">{selectedTopic.shortcut}</kbd>
            {/if}
          </div>

          <div class="topic-content">
            {@html selectedTopic.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
          </div>

          {#if selectedTopic.relatedFeatures?.length}
            <div class="related-features">
              <h4>Related Features</h4>
              <div class="feature-tags">
                {#each selectedTopic.relatedFeatures as feature}
                  <span class="feature-tag">{feature}</span>
                {/each}
              </div>
            </div>
          {/if}

          <div class="topic-actions">
            <button 
              class="action-btn pin-btn"
              class:pinned={pinnedTopics.has(selectedTopic.id)}
              on:click={() => togglePin(selectedTopic.id)}
            >
              {pinnedTopics.has(selectedTopic.id) ? '📌 Pinned' : '📍 Pin'}
            </button>
            
            {#if selectedTopic.docsUrl}
              <a href={selectedTopic.docsUrl} target="_blank" rel="noopener" class="action-btn">
                📄 View Docs
              </a>
            {/if}
          </div>

          <div class="feedback-section">
            <p>Was this helpful?</p>
            <div class="feedback-buttons">
              <button class="feedback-btn" on:click={() => submitFeedback(selectedTopic.id, true)}>
                👍 Yes
              </button>
              <button class="feedback-btn" on:click={() => submitFeedback(selectedTopic.id, false)}>
                👎 No
              </button>
            </div>
          </div>
        </article>
      {:else}
        <!-- Browse/Search View -->
        <div class="browse-view">
          <!-- Search -->
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search help topics..."
              bind:value={searchQuery}
              class="search-input"
            />
            {#if searchQuery}
              <button class="clear-btn" on:click={() => searchQuery = ''}>×</button>
            {/if}
          </div>

          <!-- Categories -->
          <div class="categories-bar">
            <button
              class="category-chip"
              class:active={selectedCategory === 'all'}
              on:click={() => selectedCategory = 'all'}
            >
              All
            </button>
            {#each Object.entries(categories) as [key, cat]}
              <button
                class="category-chip"
                class:active={selectedCategory === key}
                on:click={() => selectedCategory = key}
              >
                {cat.icon}
              </button>
            {/each}
          </div>

          <!-- Suggested/Contextual Tips -->
          {#if !searchQuery && selectedCategory === 'all' && showTips}
            <section class="suggested-section" transition:slide>
              <div class="section-header">
                <h3>💡 Suggested for You</h3>
                <button class="hide-tips-btn" on:click={() => showTips = false}>Hide</button>
              </div>
              <div class="suggested-cards">
                {#each $suggestedTopics as topic (topic.id)}
                  <button class="suggested-card" on:click={() => selectTopic(topic)}>
                    <span class="card-icon">{categories[topic.category].icon}</span>
                    <span class="card-title">{topic.title}</span>
                    {#if topic.shortcut}
                      <kbd class="card-shortcut">{topic.shortcut}</kbd>
                    {/if}
                  </button>
                {/each}
              </div>
            </section>
          {/if}

          <!-- Pinned Topics -->
          {#if pinnedTopics.size > 0 && !searchQuery}
            <section class="pinned-section">
              <h3>📌 Pinned</h3>
              <div class="topic-list">
                {#each $helpTopics.filter(t => pinnedTopics.has(t.id)) as topic (topic.id)}
                  <button class="topic-item" on:click={() => selectTopic(topic)}>
                    <span class="topic-icon">{categories[topic.category].icon}</span>
                    <span class="topic-title">{topic.title}</span>
                    <span class="arrow">→</span>
                  </button>
                {/each}
              </div>
            </section>
          {/if}

          <!-- Search Results or All Topics -->
          <section class="topics-section">
            <h3>{searchQuery ? `Results (${searchResults.length})` : 'All Topics'}</h3>
            <div class="topic-list">
              {#if searchQuery}
                {#each searchResults as result (result.topic.id)}
                  <button class="topic-item" on:click={() => selectTopic(result.topic)}>
                    <span class="topic-icon">{categories[result.topic.category].icon}</span>
                    <div class="topic-info">
                      <span class="topic-title">{result.topic.title}</span>
                      <span class="topic-category">{categories[result.topic.category].label}</span>
                    </div>
                    <span class="arrow">→</span>
                  </button>
                {:else}
                  <p class="no-results">No topics found for "{searchQuery}"</p>
                {/each}
              {:else}
                {#each $filteredTopics as topic (topic.id)}
                  <button class="topic-item" on:click={() => selectTopic(topic)}>
                    <span class="topic-icon">{categories[topic.category].icon}</span>
                    <div class="topic-info">
                      <span class="topic-title">{topic.title}</span>
                      {#if topic.shortcut}
                        <kbd class="topic-shortcut">{topic.shortcut}</kbd>
                      {/if}
                    </div>
                    {#if pinnedTopics.has(topic.id)}
                      <span class="pin-indicator">📌</span>
                    {/if}
                    <span class="arrow">→</span>
                  </button>
                {/each}
              {/if}
            </div>
          </section>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <footer class="help-footer">
      <a href="https://docs.hearth.chat" target="_blank" rel="noopener" class="footer-link">
        📚 Full Documentation
      </a>
      <a href="https://hearth.chat/support" target="_blank" rel="noopener" class="footer-link">
        💬 Contact Support
      </a>
    </footer>
  </div>
{/if}

<style>
  .contextual-help-panel {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, #1a1a2e);
    border-left: 1px solid var(--border-color, #2d2d44);
    color: var(--text-primary, #e0e0e0);
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }

  .position-right {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    z-index: 100;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .position-bottom {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 400px;
    z-index: 100;
    border-left: none;
    border-top: 1px solid var(--border-color, #2d2d44);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  }

  .position-floating {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 380px;
    height: 500px;
    border-radius: 12px;
    border: 1px solid var(--border-color, #2d2d44);
    z-index: 100;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* Header */
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border-color, #2d2d44);
    background: var(--bg-tertiary, #16162a);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .back-btn, .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary, #a0a0a0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover, .close-btn:hover {
    background: var(--bg-hover, #2d2d44);
    color: var(--text-primary, #e0e0e0);
  }

  /* Content */
  .help-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Search */
  .search-box {
    position: relative;
    margin-bottom: 16px;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-secondary, #a0a0a0);
  }

  .search-input {
    width: 100%;
    padding: 10px 36px;
    background: var(--bg-tertiary, #16162a);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    color: var(--text-primary, #e0e0e0);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: var(--accent-color, #6366f1);
  }

  .search-input::placeholder {
    color: var(--text-secondary, #a0a0a0);
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-secondary, #a0a0a0);
    font-size: 18px;
    cursor: pointer;
  }

  .clear-btn:hover {
    background: var(--bg-hover, #2d2d44);
    color: var(--text-primary, #e0e0e0);
  }

  /* Categories */
  .categories-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .category-chip {
    padding: 6px 12px;
    background: var(--bg-tertiary, #16162a);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 20px;
    color: var(--text-secondary, #a0a0a0);
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .category-chip:hover {
    background: var(--bg-hover, #2d2d44);
    color: var(--text-primary, #e0e0e0);
  }

  .category-chip.active {
    background: var(--accent-color, #6366f1);
    border-color: var(--accent-color, #6366f1);
    color: white;
  }

  /* Sections */
  section {
    margin-bottom: 20px;
  }

  section h3 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #a0a0a0);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .section-header h3 {
    margin: 0;
  }

  .hide-tips-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #a0a0a0);
    font-size: 12px;
    cursor: pointer;
  }

  .hide-tips-btn:hover {
    color: var(--text-primary, #e0e0e0);
  }

  /* Suggested Cards */
  .suggested-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  .suggested-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 8px;
    background: var(--bg-tertiary, #16162a);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .suggested-card:hover {
    background: var(--bg-hover, #2d2d44);
    border-color: var(--accent-color, #6366f1);
    transform: translateY(-2px);
  }

  .card-icon {
    font-size: 24px;
  }

  .card-title {
    font-size: 11px;
    text-align: center;
    color: var(--text-primary, #e0e0e0);
  }

  .card-shortcut {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--bg-secondary, #1a1a2e);
    border-radius: 4px;
    color: var(--text-secondary, #a0a0a0);
  }

  /* Topic List */
  .topic-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .topic-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-tertiary, #16162a);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .topic-item:hover {
    background: var(--bg-hover, #2d2d44);
    border-color: var(--border-color, #2d2d44);
  }

  .topic-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .topic-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .topic-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary, #e0e0e0);
  }

  .topic-category {
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
  }

  .topic-shortcut {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--bg-secondary, #1a1a2e);
    border-radius: 4px;
    color: var(--text-secondary, #a0a0a0);
  }

  .pin-indicator {
    font-size: 12px;
  }

  .arrow {
    color: var(--text-secondary, #a0a0a0);
    font-size: 14px;
  }

  .no-results {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary, #a0a0a0);
    font-style: italic;
  }

  /* Topic Detail */
  .topic-detail {
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .topic-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .category-badge {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .difficulty-badge {
    padding: 4px 10px;
    background: var(--bg-tertiary, #16162a);
    border-radius: 12px;
    font-size: 12px;
    text-transform: capitalize;
  }

  .shortcut-badge {
    padding: 4px 10px;
    background: var(--bg-tertiary, #16162a);
    border-radius: 6px;
    font-size: 12px;
    font-family: monospace;
    color: var(--accent-color, #6366f1);
  }

  .topic-content {
    line-height: 1.7;
    font-size: 14px;
    color: var(--text-primary, #e0e0e0);
    margin-bottom: 20px;
  }

  .topic-content :global(strong) {
    color: white;
    font-weight: 600;
  }

  .related-features {
    margin-bottom: 20px;
  }

  .related-features h4 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary, #a0a0a0);
  }

  .feature-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .feature-tag {
    padding: 4px 10px;
    background: var(--bg-tertiary, #16162a);
    border-radius: 12px;
    font-size: 12px;
    color: var(--text-secondary, #a0a0a0);
  }

  .topic-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }

  .action-btn {
    padding: 8px 16px;
    background: var(--bg-tertiary, #16162a);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 13px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--bg-hover, #2d2d44);
  }

  .pin-btn.pinned {
    background: var(--accent-color, #6366f1);
    border-color: var(--accent-color, #6366f1);
    color: white;
  }

  .feedback-section {
    padding: 16px;
    background: var(--bg-tertiary, #16162a);
    border-radius: 8px;
    text-align: center;
  }

  .feedback-section p {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text-secondary, #a0a0a0);
  }

  .feedback-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .feedback-btn {
    padding: 8px 20px;
    background: var(--bg-secondary, #1a1a2e);
    border: 1px solid var(--border-color, #2d2d44);
    border-radius: 6px;
    color: var(--text-primary, #e0e0e0);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .feedback-btn:hover {
    background: var(--bg-hover, #2d2d44);
    transform: scale(1.05);
  }

  /* Footer */
  .help-footer {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 12px 16px;
    border-top: 1px solid var(--border-color, #2d2d44);
    background: var(--bg-tertiary, #16162a);
  }

  .footer-link {
    font-size: 13px;
    color: var(--text-secondary, #a0a0a0);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: var(--accent-color, #6366f1);
  }

  /* Scrollbar */
  .help-content::-webkit-scrollbar {
    width: 6px;
  }

  .help-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .help-content::-webkit-scrollbar-thumb {
    background: var(--border-color, #2d2d44);
    border-radius: 3px;
  }

  .help-content::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary, #a0a0a0);
  }
</style>
