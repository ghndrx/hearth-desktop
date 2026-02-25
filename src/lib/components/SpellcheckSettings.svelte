<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface SpellCheckLanguage {
    code: string;
    name: string;
  }

  interface SpellCheckResult {
    word: string;
    start: number;
    end: number;
    suggestions: string[];
  }

  // Props
  export let enabled: boolean = true;
  export let onEnabledChange: ((enabled: boolean) => void) | undefined = undefined;
  export let onLanguageChange: ((language: string) => void) | undefined = undefined;

  // State
  let selectedLanguage = 'en_US';
  let languages: SpellCheckLanguage[] = [];
  let customDictionary: string[] = [];
  let newWord = '';
  let testText = '';
  let testResults: SpellCheckResult[] = [];
  let isLoading = false;
  let isTesting = false;
  let showDictionary = false;
  let searchQuery = '';
  let error = '';

  $: filteredDictionary = searchQuery
    ? customDictionary.filter(word => 
        word.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : customDictionary;

  onMount(async () => {
    await loadLanguages();
    await loadCustomDictionary();
  });

  async function loadLanguages() {
    try {
      languages = await invoke<SpellCheckLanguage[]>('get_spell_check_languages');
    } catch (e) {
      console.error('Failed to load spell check languages:', e);
      // Fallback languages
      languages = [
        { code: 'en_US', name: 'English (US)' },
        { code: 'en_GB', name: 'English (UK)' }
      ];
    }
  }

  async function loadCustomDictionary() {
    try {
      isLoading = true;
      customDictionary = await invoke<string[]>('get_custom_dictionary');
    } catch (e) {
      console.error('Failed to load custom dictionary:', e);
      error = 'Failed to load custom dictionary';
    } finally {
      isLoading = false;
    }
  }

  async function addWord() {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    
    if (customDictionary.includes(word)) {
      error = 'Word already in dictionary';
      return;
    }

    try {
      isLoading = true;
      error = '';
      await invoke('add_to_dictionary', { word });
      customDictionary = [...customDictionary, word].sort();
      newWord = '';
    } catch (e) {
      console.error('Failed to add word:', e);
      error = 'Failed to add word to dictionary';
    } finally {
      isLoading = false;
    }
  }

  async function removeWord(word: string) {
    try {
      isLoading = true;
      error = '';
      await invoke('remove_from_dictionary', { word });
      customDictionary = customDictionary.filter(w => w !== word);
    } catch (e) {
      console.error('Failed to remove word:', e);
      error = 'Failed to remove word from dictionary';
    } finally {
      isLoading = false;
    }
  }

  async function testSpellCheck() {
    if (!testText.trim()) return;

    try {
      isTesting = true;
      error = '';
      testResults = await invoke<SpellCheckResult[]>('check_spelling', {
        text: testText,
        language: selectedLanguage
      });
    } catch (e) {
      console.error('Spell check failed:', e);
      error = 'Spell check failed. Make sure aspell is installed.';
      testResults = [];
    } finally {
      isTesting = false;
    }
  }

  function handleEnabledChange(event: Event) {
    const target = event.target as HTMLInputElement;
    enabled = target.checked;
    onEnabledChange?.(enabled);
  }

  function handleLanguageChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedLanguage = target.value;
    onLanguageChange?.(selectedLanguage);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      addWord();
    }
  }

  function highlightErrors(text: string, results: SpellCheckResult[]): string {
    if (results.length === 0) return text;
    
    // Sort by position descending to replace from end to start
    const sorted = [...results].sort((a, b) => b.start - a.start);
    let highlighted = text;
    
    for (const result of sorted) {
      const before = highlighted.slice(0, result.start);
      const word = highlighted.slice(result.start, result.end);
      const after = highlighted.slice(result.end);
      highlighted = `${before}<mark class="error">${word}</mark>${after}`;
    }
    
    return highlighted;
  }
</script>

<div class="spellcheck-settings">
  <header class="settings-header">
    <div class="header-content">
      <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <path d="M15 6l3 3" />
      </svg>
      <div>
        <h2>Spell Check</h2>
        <p>Configure spell checking for messages</p>
      </div>
    </div>
  </header>

  {#if error}
    <div class="error-banner" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{error}</span>
      <button class="dismiss" on:click={() => error = ''} aria-label="Dismiss">×</button>
    </div>
  {/if}

  <section class="settings-section">
    <h3>General Settings</h3>
    
    <div class="setting-row">
      <label class="toggle-label">
        <span class="label-text">Enable Spell Check</span>
        <span class="label-description">Highlight misspelled words while typing</span>
      </label>
      <label class="toggle">
        <input 
          type="checkbox" 
          checked={enabled}
          on:change={handleEnabledChange}
        />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <div class="setting-row">
      <label for="language" class="toggle-label">
        <span class="label-text">Language</span>
        <span class="label-description">Select spell check language</span>
      </label>
      <select 
        id="language"
        value={selectedLanguage}
        on:change={handleLanguageChange}
        disabled={!enabled}
      >
        {#each languages as lang}
          <option value={lang.code}>{lang.name}</option>
        {/each}
      </select>
    </div>
  </section>

  <section class="settings-section">
    <div class="section-header">
      <h3>Custom Dictionary</h3>
      <button 
        class="expand-btn"
        on:click={() => showDictionary = !showDictionary}
        aria-expanded={showDictionary}
      >
        <span class="word-count">{customDictionary.length} words</span>
        <svg 
          class="chevron" 
          class:expanded={showDictionary}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
    <p class="section-description">
      Words added here won't be marked as misspelled
    </p>

    <div class="add-word-form">
      <input 
        type="text"
        bind:value={newWord}
        on:keydown={handleKeyDown}
        placeholder="Add a word..."
        disabled={!enabled || isLoading}
      />
      <button 
        class="add-btn"
        on:click={addWord}
        disabled={!enabled || isLoading || !newWord.trim()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add
      </button>
    </div>

    {#if showDictionary}
      <div class="dictionary-panel">
        {#if customDictionary.length > 5}
          <input 
            type="search"
            bind:value={searchQuery}
            placeholder="Search dictionary..."
            class="search-input"
          />
        {/if}

        {#if filteredDictionary.length === 0}
          <div class="empty-state">
            {#if searchQuery}
              <p>No words match "{searchQuery}"</p>
            {:else}
              <p>No custom words added yet</p>
            {/if}
          </div>
        {:else}
          <ul class="word-list">
            {#each filteredDictionary as word}
              <li class="word-item">
                <span class="word">{word}</span>
                <button 
                  class="remove-btn"
                  on:click={() => removeWord(word)}
                  disabled={isLoading}
                  aria-label="Remove {word}"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </section>

  <section class="settings-section">
    <h3>Test Spell Check</h3>
    <p class="section-description">
      Try out the spell checker with sample text
    </p>

    <div class="test-area">
      <textarea
        bind:value={testText}
        placeholder="Type or paste text to check spelling..."
        rows="4"
        disabled={!enabled}
      ></textarea>

      <button 
        class="test-btn"
        on:click={testSpellCheck}
        disabled={!enabled || isTesting || !testText.trim()}
      >
        {#if isTesting}
          <span class="spinner"></span>
          Checking...
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Check Spelling
        {/if}
      </button>

      {#if testResults.length > 0}
        <div class="results-panel">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {testResults.length} misspelled {testResults.length === 1 ? 'word' : 'words'} found
          </h4>
          
          <div class="highlighted-text">
            {@html highlightErrors(testText, testResults)}
          </div>

          <ul class="suggestions-list">
            {#each testResults as result}
              <li class="suggestion-item">
                <span class="misspelled">{result.word}</span>
                <span class="arrow">→</span>
                {#if result.suggestions.length > 0}
                  <span class="suggestions">
                    {result.suggestions.join(', ')}
                  </span>
                {:else}
                  <span class="no-suggestions">No suggestions</span>
                {/if}
                <button 
                  class="add-to-dict"
                  on:click={() => {
                    newWord = result.word;
                    addWord();
                    testResults = testResults.filter(r => r.word !== result.word);
                  }}
                  title="Add to dictionary"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {:else if testText && !isTesting && testResults.length === 0}
        <div class="success-panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>No spelling errors found!</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="settings-section info-section">
    <h3>Requirements</h3>
    <ul class="requirements-list">
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <div>
          <strong>Linux:</strong> Install <code>aspell</code> and language dictionaries
          <code class="command">sudo apt install aspell aspell-en</code>
        </div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <div>
          <strong>macOS:</strong> Uses built-in spell checker (aspell optional)
        </div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <div>
          <strong>Windows:</strong> Uses system spell checker
        </div>
      </li>
    </ul>
  </section>
</div>

<style>
  .spellcheck-settings {
    padding: 1.5rem;
    max-width: 640px;
    margin: 0 auto;
  }

  .settings-header {
    margin-bottom: 1.5rem;
  }

  .header-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--accent-color, #5865f2);
    flex-shrink: 0;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .settings-header p {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--text-secondary, #b5bac1);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(237, 66, 69, 0.1);
    border: 1px solid rgba(237, 66, 69, 0.3);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    color: #ed4245;
  }

  .error-banner svg {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }

  .error-banner .dismiss {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .settings-section {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .settings-section h3 {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-description {
    margin: 0 0 1rem;
    font-size: 0.8125rem;
    color: var(--text-secondary, #b5bac1);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-color, #3f4147);
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .label-text {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary, #fff);
  }

  .label-description {
    font-size: 0.75rem;
    color: var(--text-secondary, #b5bac1);
  }

  .toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--toggle-off, #72767d);
    transition: 0.2s;
    border-radius: 24px;
  }

  .toggle-slider::before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  .toggle input:checked + .toggle-slider {
    background-color: var(--accent-color, #5865f2);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  select {
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    font-size: 0.875rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.375rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23b5bac1' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .expand-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.375rem;
    color: var(--text-secondary, #b5bac1);
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .expand-btn:hover {
    background: var(--bg-modifier-hover, #393c41);
    color: var(--text-primary, #fff);
  }

  .word-count {
    font-weight: 500;
  }

  .chevron {
    width: 1rem;
    height: 1rem;
    transition: transform 0.2s;
  }

  .chevron.expanded {
    transform: rotate(180deg);
  }

  .add-word-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .add-word-form input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.375rem;
    color: var(--text-primary, #fff);
  }

  .add-word-form input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .add-word-form input::placeholder {
    color: var(--text-muted, #6d6f78);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 0.375rem;
    color: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .add-btn:hover:not(:disabled) {
    background: var(--accent-color-hover, #4752c4);
  }

  .add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .dictionary-panel {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #3f4147);
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.375rem;
    color: var(--text-primary, #fff);
    margin-bottom: 0.75rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .empty-state {
    text-align: center;
    padding: 1.5rem;
    color: var(--text-muted, #6d6f78);
    font-size: 0.875rem;
  }

  .word-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .word-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    transition: background 0.1s;
  }

  .word-item:hover {
    background: var(--bg-modifier-hover, #393c41);
  }

  .word {
    font-size: 0.875rem;
    color: var(--text-primary, #fff);
    font-family: monospace;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 0.25rem;
    color: var(--text-muted, #6d6f78);
    cursor: pointer;
    transition: all 0.1s;
  }

  .remove-btn:hover:not(:disabled) {
    background: rgba(237, 66, 69, 0.1);
    color: #ed4245;
  }

  .remove-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .test-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 0.5rem;
    color: var(--text-primary, #fff);
    resize: vertical;
    min-height: 100px;
  }

  textarea:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 500;
    background: var(--accent-color, #5865f2);
    border: none;
    border-radius: 0.375rem;
    color: white;
    cursor: pointer;
    transition: background 0.15s;
    align-self: flex-start;
  }

  .test-btn:hover:not(:disabled) {
    background: var(--accent-color-hover, #4752c4);
  }

  .test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-btn svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .results-panel {
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 0.5rem;
    padding: 1rem;
    border-left: 3px solid #faa61a;
  }

  .results-panel h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #faa61a;
  }

  .results-panel h4 svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  .highlighted-text {
    padding: 0.75rem;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text-primary, #fff);
    margin-bottom: 0.75rem;
    word-wrap: break-word;
  }

  .highlighted-text :global(mark.error) {
    background: rgba(237, 66, 69, 0.3);
    color: #ed4245;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    text-decoration: wavy underline #ed4245;
  }

  .suggestions-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-color, #3f4147);
    font-size: 0.8125rem;
  }

  .suggestion-item:last-child {
    border-bottom: none;
  }

  .misspelled {
    font-weight: 600;
    color: #ed4245;
    font-family: monospace;
  }

  .arrow {
    color: var(--text-muted, #6d6f78);
  }

  .suggestions {
    color: #3ba55c;
    font-family: monospace;
  }

  .no-suggestions {
    color: var(--text-muted, #6d6f78);
    font-style: italic;
  }

  .add-to-dict {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    background: none;
    border: none;
    border-radius: 0.25rem;
    color: var(--text-secondary, #b5bac1);
    cursor: pointer;
    transition: all 0.1s;
  }

  .add-to-dict:hover {
    background: rgba(59, 165, 92, 0.1);
    color: #3ba55c;
  }

  .add-to-dict svg {
    width: 1rem;
    height: 1rem;
  }

  .success-panel {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(59, 165, 92, 0.1);
    border: 1px solid rgba(59, 165, 92, 0.3);
    border-radius: 0.5rem;
    color: #3ba55c;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .success-panel svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .info-section {
    background: transparent;
    border: 1px dashed var(--border-color, #3f4147);
  }

  .requirements-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .requirements-list li {
    display: flex;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-secondary, #b5bac1);
  }

  .requirements-list svg {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    color: var(--text-muted, #6d6f78);
  }

  .requirements-list strong {
    color: var(--text-primary, #fff);
  }

  .requirements-list code {
    display: inline-block;
    padding: 0.125rem 0.375rem;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--text-primary, #fff);
  }

  .requirements-list code.command {
    display: block;
    margin-top: 0.375rem;
    padding: 0.5rem 0.75rem;
  }
</style>
