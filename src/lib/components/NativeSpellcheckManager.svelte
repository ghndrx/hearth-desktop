<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // Types
  interface SpellcheckDictionary {
    id: string;
    language: string;
    label: string;
    enabled: boolean;
    wordCount: number;
  }

  interface CustomWord {
    word: string;
    addedAt: string;
  }

  interface SpellcheckSuggestion {
    original: string;
    suggestions: string[];
    context: string;
  }

  // State
  let isOpen = false;
  let activeTab: 'dictionaries' | 'custom' | 'settings' = 'dictionaries';
  let dictionaries: SpellcheckDictionary[] = [];
  let customWords: CustomWord[] = [];
  let newWord = '';
  let searchQuery = '';
  let recentCorrections: SpellcheckSuggestion[] = [];
  let enabled = true;
  let autoCorrect = false;
  let highlightErrors = true;
  let checkAsYouType = true;

  const STORAGE_KEY = 'hearth-spellcheck';
  const CUSTOM_WORDS_KEY = 'hearth-spellcheck-custom';

  // Default dictionaries
  const defaultDictionaries: SpellcheckDictionary[] = [
    { id: 'en-US', language: 'en-US', label: 'English (US)', enabled: true, wordCount: 143000 },
    { id: 'en-GB', language: 'en-GB', label: 'English (UK)', enabled: false, wordCount: 141000 },
    { id: 'es-ES', language: 'es-ES', label: 'Spanish', enabled: false, wordCount: 98000 },
    { id: 'fr-FR', language: 'fr-FR', label: 'French', enabled: false, wordCount: 112000 },
    { id: 'de-DE', language: 'de-DE', label: 'German', enabled: false, wordCount: 135000 },
    { id: 'pt-BR', language: 'pt-BR', label: 'Portuguese (BR)', enabled: false, wordCount: 87000 },
    { id: 'ja-JP', language: 'ja-JP', label: 'Japanese', enabled: false, wordCount: 210000 },
    { id: 'zh-CN', language: 'zh-CN', label: 'Chinese (Simplified)', enabled: false, wordCount: 180000 },
  ];

  let unregisterShortcut: (() => void) | null = null;

  onMount(async () => {
    loadData();
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
        dictionaries = data.dictionaries || defaultDictionaries;
        enabled = data.enabled ?? true;
        autoCorrect = data.autoCorrect ?? false;
        highlightErrors = data.highlightErrors ?? true;
        checkAsYouType = data.checkAsYouType ?? true;
      } else {
        dictionaries = [...defaultDictionaries];
      }

      const savedWords = localStorage.getItem(CUSTOM_WORDS_KEY);
      if (savedWords) {
        customWords = JSON.parse(savedWords);
      }
    } catch (e) {
      console.error('Failed to load spellcheck data:', e);
      dictionaries = [...defaultDictionaries];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        dictionaries,
        enabled,
        autoCorrect,
        highlightErrors,
        checkAsYouType,
      }));
    } catch (e) {
      console.error('Failed to save spellcheck data:', e);
    }
  }

  function saveCustomWords() {
    try {
      localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(customWords));
    } catch (e) {
      console.error('Failed to save custom words:', e);
    }
  }

  async function registerShortcut() {
    try {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await register('CommandOrControl+Shift+;', () => {
        isOpen = !isOpen;
      });
      unregisterShortcut = () => unregister('CommandOrControl+Shift+;');
    } catch (e) {
      console.warn('Global shortcut not available:', e);
    }
  }

  function toggleDictionary(id: string) {
    const dict = dictionaries.find(d => d.id === id);
    if (dict) {
      dict.enabled = !dict.enabled;
      dictionaries = [...dictionaries];
      saveData();
      broadcastSettings();
    }
  }

  function addCustomWord() {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed || customWords.some(w => w.word === trimmed)) return;

    customWords = [...customWords, {
      word: trimmed,
      addedAt: new Date().toISOString(),
    }];
    newWord = '';
    saveCustomWords();
    broadcastSettings();
  }

  function removeCustomWord(word: string) {
    customWords = customWords.filter(w => w.word !== word);
    saveCustomWords();
    broadcastSettings();
  }

  function broadcastSettings() {
    window.dispatchEvent(new CustomEvent('hearth:spellcheck-settings', {
      detail: {
        enabled,
        autoCorrect,
        highlightErrors,
        checkAsYouType,
        languages: dictionaries.filter(d => d.enabled).map(d => d.language),
        customWords: customWords.map(w => w.word),
      }
    }));
  }

  function filteredCustomWords(): CustomWord[] {
    if (!searchQuery) return customWords;
    const q = searchQuery.toLowerCase();
    return customWords.filter(w => w.word.includes(q));
  }

  function importWords() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const words = text.split(/[\n,]/).map(w => w.trim().toLowerCase()).filter(Boolean);
      const existing = new Set(customWords.map(w => w.word));
      const newWords = words.filter(w => !existing.has(w));
      customWords = [...customWords, ...newWords.map(w => ({
        word: w,
        addedAt: new Date().toISOString(),
      }))];
      saveCustomWords();
    };
    input.click();
  }

  function exportWords() {
    const content = customWords.map(w => w.word).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hearth-custom-dictionary.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString();
  }
</script>

<!-- Toggle Button -->
<button
  class="fixed bottom-36 right-4 z-40 w-10 h-10 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
  class:opacity-50={!enabled}
  on:click={() => isOpen = !isOpen}
  title="Spellcheck Manager (Ctrl+Shift+;)"
>
  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
</button>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" on:click|self={() => isOpen = false}>
    <div class="bg-gray-900 rounded-xl shadow-2xl w-[600px] max-h-[75vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 class="text-lg font-semibold text-white">Spellcheck Manager</h2>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="relative w-12 h-6 rounded-full transition-colors"
            class:bg-emerald-600={enabled}
            class:bg-gray-600={!enabled}
            on:click={() => { enabled = !enabled; saveData(); broadcastSettings(); }}
          >
            <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-6={enabled} />
          </button>
          <button class="text-gray-400 hover:text-white transition-colors" on:click={() => isOpen = false}>
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-gray-700">
        {#each ['dictionaries', 'custom', 'settings'] as tab}
          <button
            class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
            class:text-emerald-400={activeTab === tab}
            class:border-b-2={activeTab === tab}
            class:border-emerald-400={activeTab === tab}
            class:text-gray-400={activeTab !== tab}
            on:click={() => activeTab = tab}
          >
            {tab === 'custom' ? 'Custom Dictionary' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {#if tab === 'custom'}
              <span class="ml-1 text-xs text-gray-500">({customWords.length})</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'dictionaries'}
          <div class="space-y-2">
            {#each dictionaries as dict (dict.id)}
              <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span class="text-white font-medium">{dict.label}</span>
                  <span class="text-xs text-gray-500 ml-2">{dict.language}</span>
                  <div class="text-xs text-gray-500 mt-1">{dict.wordCount.toLocaleString()} words</div>
                </div>
                <button
                  class="relative w-12 h-6 rounded-full transition-colors"
                  class:bg-emerald-600={dict.enabled}
                  class:bg-gray-600={!dict.enabled}
                  on:click={() => toggleDictionary(dict.id)}
                >
                  <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform" class:translate-x-6={dict.enabled} />
                </button>
              </div>
            {/each}
          </div>

        {:else if activeTab === 'custom'}
          <div class="space-y-3">
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Add a word to your dictionary..."
                bind:value={newWord}
                on:keydown={(e) => e.key === 'Enter' && addCustomWord()}
              />
              <button
                class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50"
                disabled={!newWord.trim()}
                on:click={addCustomWord}
              >
                Add
              </button>
            </div>

            <div class="flex items-center justify-between">
              <input
                type="text"
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Search custom words..."
                bind:value={searchQuery}
              />
              <div class="flex gap-2 ml-3">
                <button class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm" on:click={importWords}>Import</button>
                <button class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 text-sm" on:click={exportWords} disabled={customWords.length === 0}>Export</button>
              </div>
            </div>

            {#if filteredCustomWords().length === 0}
              <div class="text-center py-8 text-gray-400">
                <p>{searchQuery ? 'No matching words' : 'No custom words added yet'}</p>
                <p class="text-sm mt-1">Add words that should not be flagged as misspelled</p>
              </div>
            {:else}
              <div class="space-y-1 max-h-[300px] overflow-y-auto">
                {#each filteredCustomWords() as entry (entry.word)}
                  <div class="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between group">
                    <div>
                      <span class="text-white">{entry.word}</span>
                      <span class="text-xs text-gray-500 ml-2">Added {formatDate(entry.addedAt)}</span>
                    </div>
                    <button
                      class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      on:click={() => removeCustomWord(entry.word)}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        {:else if activeTab === 'settings'}
          <div class="space-y-4">
            <div class="bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 class="text-white font-medium">Behavior</h3>
              {#each [
                { key: 'checkAsYouType', label: 'Check spelling as you type' },
                { key: 'highlightErrors', label: 'Highlight spelling errors' },
                { key: 'autoCorrect', label: 'Auto-correct common mistakes' },
              ] as setting}
                <label class="flex items-center justify-between cursor-pointer">
                  <span class="text-sm text-gray-300">{setting.label}</span>
                  <button
                    class="relative w-12 h-6 rounded-full transition-colors"
                    class:bg-emerald-600={setting.key === 'checkAsYouType' ? checkAsYouType : setting.key === 'highlightErrors' ? highlightErrors : autoCorrect}
                    class:bg-gray-600={setting.key === 'checkAsYouType' ? !checkAsYouType : setting.key === 'highlightErrors' ? !highlightErrors : !autoCorrect}
                    on:click={() => {
                      if (setting.key === 'checkAsYouType') checkAsYouType = !checkAsYouType;
                      else if (setting.key === 'highlightErrors') highlightErrors = !highlightErrors;
                      else autoCorrect = !autoCorrect;
                      saveData();
                      broadcastSettings();
                    }}
                  >
                    <span
                      class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform"
                      class:translate-x-6={setting.key === 'checkAsYouType' ? checkAsYouType : setting.key === 'highlightErrors' ? highlightErrors : autoCorrect}
                    />
                  </button>
                </label>
              {/each}
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-2">Keyboard Shortcut</h3>
              <div class="flex items-center gap-2">
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Ctrl</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">Shift</kbd>
                <span class="text-gray-500">+</span>
                <kbd class="px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">;</kbd>
                <span class="text-gray-400 ml-2">Toggle Spellcheck Manager</span>
              </div>
            </div>

            <div class="bg-gray-800 rounded-lg p-4">
              <h3 class="text-white font-medium mb-2">Statistics</h3>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-gray-400">Active dictionaries:</span>
                  <span class="text-white ml-1">{dictionaries.filter(d => d.enabled).length}</span>
                </div>
                <div>
                  <span class="text-gray-400">Custom words:</span>
                  <span class="text-white ml-1">{customWords.length}</span>
                </div>
                <div>
                  <span class="text-gray-400">Languages:</span>
                  <span class="text-white ml-1">{dictionaries.filter(d => d.enabled).map(d => d.language).join(', ') || 'None'}</span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
</script>
