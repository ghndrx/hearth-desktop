<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { handleListKeyboard } from '$lib/utils/keyboard';

  export let show = false;

  const dispatch = createEventDispatcher<{ select: { url: string; width: number; height: number }; close: void }>();

  // Keyboard navigation
  const GRID_COLUMNS = 2;
  let focusedGifIndex = -1;
  let gifsContainer: HTMLDivElement;

  // API Configuration - supports Tenor API
  // Get free API key at https://developers.google.com/tenor/guides/quickstart
  // Set VITE_TENOR_API_KEY in your .env file
  const TENOR_API_KEY = browser ? (import.meta.env.VITE_TENOR_API_KEY || '') : '';
  const TENOR_CONFIGURED = !!TENOR_API_KEY;
  const TENOR_BASE_URL = 'https://tenor.googleapis.com/v2';
  const CLIENT_KEY = 'hearth_chat';

  interface GifResult {
    id: string;
    url: string;
    previewUrl: string;
    width: number;
    height: number;
    description: string;
  }

  interface TenorMedia {
    url: string;
    dims: [number, number];
  }

  interface TenorResult {
    id: string;
    title: string;
    content_description: string;
    media_formats: {
      gif: TenorMedia;
      tinygif: TenorMedia;
      nanogif: TenorMedia;
      mediumgif?: TenorMedia;
    };
  }

  let searchQuery = '';
  let gifs: GifResult[] = [];
  let trendingGifs: GifResult[] = [];
  let loading = false;
  let error = '';
  let pickerElement: HTMLDivElement;
  let searchInput: HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let categories = [
    { name: 'Trending', icon: '🔥', query: '' },
    { name: 'Reactions', icon: '😂', query: 'reactions' },
    { name: 'Love', icon: '❤️', query: 'love' },
    { name: 'Happy', icon: '😊', query: 'happy' },
    { name: 'Sad', icon: '😢', query: 'sad' },
    { name: 'Angry', icon: '😠', query: 'angry' },
    { name: 'Celebrate', icon: '🎉', query: 'celebrate' },
    { name: 'Yes', icon: '👍', query: 'yes agree' },
    { name: 'No', icon: '👎', query: 'no disagree' },
  ];
  let selectedCategory = 0;
  let hoveredGif: GifResult | null = null;

  function parseGifResults(results: TenorResult[]): GifResult[] {
    return results.map(r => ({
      id: r.id,
      url: r.media_formats.gif?.url || r.media_formats.mediumgif?.url || '',
      previewUrl: r.media_formats.tinygif?.url || r.media_formats.nanogif?.url || '',
      width: r.media_formats.gif?.dims?.[0] || 200,
      height: r.media_formats.gif?.dims?.[1] || 200,
      description: r.content_description || r.title || ''
    }));
  }

  async function fetchTrending() {
    if (!TENOR_API_KEY) {
      error = 'GIF API key not configured';
      return;
    }

    loading = true;
    error = '';

    try {
      const params = new URLSearchParams({
        key: TENOR_API_KEY,
        client_key: CLIENT_KEY,
        limit: '30',
        media_filter: 'gif,tinygif'
      });

      const response = await fetch(`${TENOR_BASE_URL}/featured?${params}`);
      if (!response.ok) throw new Error('Failed to fetch trending GIFs');

      const data = await response.json();
      trendingGifs = parseGifResults(data.results || []);
      if (!searchQuery && selectedCategory === 0) {
        gifs = trendingGifs;
      }
    } catch (err) {
      console.error('Tenor API error:', err);
      error = 'Failed to load GIFs';
    } finally {
      loading = false;
    }
  }

  async function searchGifs(query: string) {
    if (!TENOR_API_KEY) {
      error = 'GIF API key not configured';
      return;
    }

    if (!query.trim()) {
      gifs = trendingGifs;
      return;
    }

    loading = true;
    error = '';

    try {
      const params = new URLSearchParams({
        key: TENOR_API_KEY,
        client_key: CLIENT_KEY,
        q: query,
        limit: '30',
        media_filter: 'gif,tinygif'
      });

      const response = await fetch(`${TENOR_BASE_URL}/search?${params}`);
      if (!response.ok) throw new Error('Failed to search GIFs');

      const data = await response.json();
      gifs = parseGifResults(data.results || []);
    } catch (err) {
      console.error('Tenor API error:', err);
      error = 'Failed to search GIFs';
    } finally {
      loading = false;
    }
  }

  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchGifs(searchQuery);
    }, 300);
  }

  function selectCategory(index: number) {
    selectedCategory = index;
    const category = categories[index];
    if (category.query) {
      searchQuery = '';
      searchGifs(category.query);
    } else {
      searchQuery = '';
      gifs = trendingGifs;
    }
  }

  function selectGif(gif: GifResult) {
    dispatch('select', {
      url: gif.url,
      width: gif.width,
      height: gif.height
    });
  }

  function handleClickOutside(event: MouseEvent) {
    if (show && pickerElement && !pickerElement.contains(event.target as Node)) {
      dispatch('close');
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
    }
  }

  function getGifButtons(): HTMLElement[] {
    if (!gifsContainer) return [];
    return Array.from(gifsContainer.querySelectorAll<HTMLElement>('.gif-item'));
  }

  function focusGifAt(index: number) {
    const buttons = getGifButtons();
    if (buttons[index]) {
      buttons[index].focus();
      focusedGifIndex = index;
    }
  }

  function handleGridKeydown(event: KeyboardEvent) {
    const buttons = getGifButtons();
    if (buttons.length === 0) return;

    if (focusedGifIndex < 0) return;

    const { handled, newIndex } = handleListKeyboard(event, focusedGifIndex, buttons.length, {
      wrap: false,
      gridNavigation: true,
      gridColumns: GRID_COLUMNS,
      onSelect: (idx) => {
        if (gifs[idx]) selectGif(gifs[idx]);
      },
      onEscape: () => dispatch('close')
    });

    if (handled && newIndex !== focusedGifIndex) {
      focusGifAt(newIndex);
    }
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusedGifIndex = 0;
      tick().then(() => focusGifAt(0));
    } else if (event.key === 'Escape') {
      dispatch('close');
    }
  }

  function handleGifFocus(index: number) {
    focusedGifIndex = index;
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
    clearTimeout(searchTimeout);
  });

  // Load trending when picker opens
  $: if (show && browser) {
    if (trendingGifs.length === 0) {
      fetchTrending();
    }
    setTimeout(() => searchInput?.focus(), 0);
  }
</script>

{#if show}
  <div bind:this={pickerElement} class="gif-picker" role="dialog" aria-label="GIF picker" aria-modal="true">
    <!-- Header with search -->
    <div class="header">
      <div class="search-container">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M21.707 20.293l-4.054-4.054A8.46 8.46 0 0 0 19.5 11c0-4.687-3.813-8.5-8.5-8.5S2.5 6.313 2.5 11s3.813 8.5 8.5 8.5a8.46 8.46 0 0 0 5.239-1.847l4.054 4.054a1 1 0 0 0 1.414-1.414zM11 17.5c-3.584 0-6.5-2.916-6.5-6.5S7.416 4.5 11 4.5s6.5 2.916 6.5 6.5-2.916 6.5-6.5 6.5z"/>
        </svg>
        <input
          bind:this={searchInput}
          type="text"
          placeholder="Search Tenor"
          bind:value={searchQuery}
          on:input={handleSearchInput}
          on:keydown={handleSearchKeydown}
          class="search-input"
          aria-label="Search GIFs"
        />
      </div>
    </div>

    <!-- Category tabs -->
    <div class="categories" role="tablist" aria-label="GIF categories">
      {#each categories as category, i}
        <button
          class="category-btn"
          class:active={selectedCategory === i && !searchQuery}
          on:click={() => selectCategory(i)}
          title={category.name}
          role="tab"
          aria-selected={selectedCategory === i && !searchQuery}
          aria-label={category.name}
          type="button"
        >
          {category.icon}
        </button>
      {/each}
    </div>

    <!-- Category label -->
    <div class="category-label">
      {#if searchQuery}
        Results for "{searchQuery}"
      {:else}
        {categories[selectedCategory].name}
      {/if}
    </div>

    <!-- GIF grid -->
    <div class="gifs-container">
      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <span>Loading GIFs...</span>
        </div>
      {:else if error}
        <div class="error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{error}</span>
          <button class="retry-btn" on:click={fetchTrending}>Try Again</button>
        </div>
      {:else if gifs.length === 0}
        <div class="no-results">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>No GIFs found</span>
          <span class="hint">Try a different search term</span>
        </div>
      {:else}
        <div 
          bind:this={gifsContainer}
          class="gifs-grid" 
          role="grid" 
          aria-label="GIF results"
          on:keydown={handleGridKeydown}
        >
          {#each gifs as gif, i (gif.id)}
            <button
              class="gif-item"
              on:click={() => selectGif(gif)}
              on:focus={() => handleGifFocus(i)}
              on:mouseenter={() => hoveredGif = gif}
              on:mouseleave={() => hoveredGif = null}
              title={gif.description}
              aria-label="Select {gif.description} GIF"
              type="button"
              tabindex={focusedGifIndex === i ? 0 : -1}
            >
              <img
                src={gif.previewUrl}
                alt={gif.description}
                loading="lazy"
              />
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer with preview and attribution -->
    <div class="footer">
      <div class="preview-section">
        {#if hoveredGif}
          <span class="preview-text">{hoveredGif.description.slice(0, 40)}{hoveredGif.description.length > 40 ? '...' : ''}</span>
        {:else}
          <span class="preview-text hint">Click a GIF to send</span>
        {/if}
      </div>
      <div class="attribution">
        <span>Powered by</span>
        <svg class="tenor-logo" width="54" height="14" viewBox="0 0 54 14" fill="currentColor">
          <path d="M0 1.5h10.6v2.1H6.4V13H4.2V3.6H0V1.5zm11.4 0H20v2.1h-6.4v2.8h5.7v2h-5.7v2.5h6.6V13h-8.8V1.5zm15.1 0L30.7 7l4.2-5.5h2.7l-5.4 6.8V13h-2.2V8.3l-5.4-6.8h2.7zm6.6 5.75c0-3.3 2.5-6 6-6s6 2.7 6 6-2.5 6-6 6-6-2.7-6-6zm9.7 0c0-2.2-1.5-3.9-3.7-3.9s-3.7 1.7-3.7 3.9 1.5 3.9 3.7 3.9 3.7-1.7 3.7-3.9zm4.2-5.75h5.7c2.7 0 4.3 1.5 4.3 3.6 0 1.8-1.1 3-2.8 3.4l3.2 4.5h-2.6l-3-4.2h-2.6V13H47V1.5zm5.5 5.4c1.3 0 2.2-.7 2.2-1.8s-.9-1.8-2.2-1.8h-3.3v3.6h3.3z"/>
        </svg>
      </div>
    </div>
  </div>
{/if}

<style>
  .gif-picker {
    position: absolute;
    bottom: 100%;
    right: 0;
    width: 418px;
    height: 445px;
    background-color: var(--bg-floating, #2f3136);
    border-radius: 8px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
    display: flex;
    flex-direction: column;
    z-index: 100;
    margin-bottom: 8px;
    animation: pickerSlideIn 0.15s ease-out;
  }

  @keyframes pickerSlideIn {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
  }

  .search-container {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    color: var(--text-muted, #b5bac1);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 34px;
    background-color: var(--bg-tertiary, #1e1f22);
    border: none;
    border-radius: 4px;
    color: var(--text-normal, #f2f3f5);
    font-size: 14px;
  }

  .search-input::placeholder {
    color: var(--text-muted, #b5bac1);
  }

  .search-input:focus {
    outline: none;
  }

  .search-input:focus-visible {
    outline: 2px solid var(--blurple, #5865f2);
    outline-offset: -2px;
  }

  .categories {
    display: flex;
    padding: 0 8px;
    gap: 2px;
    border-bottom: 1px solid var(--bg-modifier-accent, #3f4147);
    background-color: var(--bg-secondary, #2b2d31);
  }

  .category-btn {
    flex: 1;
    padding: 8px 4px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 16px;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s, border-color 0.15s;
  }

  .category-btn:hover {
    opacity: 0.8;
  }

  .category-btn:focus-visible {
    outline: 2px solid var(--blurple, #5865f2);
    outline-offset: -2px;
    opacity: 1;
  }

  .category-btn.active {
    opacity: 1;
    border-bottom-color: var(--blurple, #5865f2);
  }

  .category-label {
    padding: 8px 12px 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #b5bac1);
  }

  .gifs-container {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 8px;
  }

  .gifs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .gif-item {
    position: relative;
    background: var(--bg-tertiary, #1e1f22);
    border: none;
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    aspect-ratio: 16 / 10;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  .gif-item:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .gif-item:focus-visible {
    outline: 2px solid var(--blurple, #5865f2);
    outline-offset: 2px;
    transform: scale(1.02);
  }

  .gif-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .loading,
  .error,
  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    color: var(--text-muted, #b5bac1);
    gap: 12px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--bg-modifier-accent, #3f4147);
    border-top-color: var(--blurple, #5865f2);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error svg,
  .no-results svg {
    color: var(--text-muted, #b5bac1);
    opacity: 0.5;
  }

  .hint {
    font-size: 12px;
    opacity: 0.7;
  }

  .retry-btn {
    margin-top: 8px;
    padding: 8px 16px;
    background-color: var(--blurple, #5865f2);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .retry-btn:hover {
    background-color: var(--blurple-dark, #4752c4);
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background-color: var(--bg-secondary, #2b2d31);
    border-top: 1px solid var(--bg-modifier-accent, #3f4147);
    border-radius: 0 0 8px 8px;
  }

  .preview-section {
    flex: 1;
    min-width: 0;
  }

  .preview-text {
    font-size: 12px;
    color: var(--text-muted, #b5bac1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .preview-text.hint {
    font-style: italic;
    opacity: 0.7;
  }

  .attribution {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted, #b5bac1);
    opacity: 0.7;
  }

  .tenor-logo {
    opacity: 0.8;
  }
</style>
