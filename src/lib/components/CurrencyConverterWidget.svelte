<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  // Props
  export let compact = false;
  export let currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'];
  export let defaultFrom = 'USD';
  export let defaultTo = 'EUR';

  // State
  let amount = $state<number>(100);
  let fromCurrency = $state<string>(defaultFrom);
  let toCurrency = $state<string>(defaultTo);
  let convertedAmount = $state<number | null>(null);
  let exchangeRates = $state<Record<string, number>>({});
  let lastUpdated = $state<Date | null>(null);
  let loading = $state<boolean>(false);
  let error = $state<string | null>(null);
  let history = $state<Array<{ from: string; to: string; amount: number; result: number; date: Date }>>([]);
  let showHistory = $state<boolean>(false);
  let favorites = $state<Array<{ from: string; to: string }>>([]);

  // Currency symbols and names
  const currencyInfo: Record<string, { symbol: string; name: string; flag: string }> = {
    USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
    GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
    AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
    CHF: { symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭' },
    CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
    INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
    MXN: { symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
    BRL: { symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
    KRW: { symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },
    SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
    HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰' },
    NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿' },
    SEK: { symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪' },
    NOK: { symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴' },
    DKK: { symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰' },
    RUB: { symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
    ZAR: { symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
    THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
    PLN: { symbol: 'zł', name: 'Polish Złoty', flag: '🇵🇱' },
    TRY: { symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },
    ILS: { symbol: '₪', name: 'Israeli Shekel', flag: '🇮🇱' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' }
  };

  // Mock exchange rates (in production, fetch from API)
  const mockRates: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.50,
    CAD: 1.36,
    AUD: 1.54,
    CHF: 0.88,
    CNY: 7.24,
    INR: 83.12,
    MXN: 17.15,
    BRL: 4.97,
    KRW: 1328.45,
    SGD: 1.34,
    HKD: 7.82,
    NZD: 1.64,
    SEK: 10.42,
    NOK: 10.58,
    DKK: 6.87,
    RUB: 92.50,
    ZAR: 18.62,
    THB: 35.28,
    PLN: 3.98,
    TRY: 32.15,
    ILS: 3.67,
    AED: 3.67
  };

  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    await loadFavorites();
    await fetchExchangeRates();
    
    // Refresh rates every 5 minutes
    refreshInterval = setInterval(fetchExchangeRates, 5 * 60 * 1000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadFavorites() {
    try {
      const stored = await invoke<string>('storage_get', { key: 'currency_favorites' });
      if (stored) {
        favorites = JSON.parse(stored);
      }
    } catch {
      // Use defaults
    }
  }

  async function saveFavorites() {
    try {
      await invoke('storage_set', { 
        key: 'currency_favorites', 
        value: JSON.stringify(favorites) 
      });
    } catch {
      // Ignore storage errors
    }
  }

  async function fetchExchangeRates() {
    loading = true;
    error = null;
    
    try {
      // Try to fetch from Tauri backend
      const rates = await invoke<Record<string, number>>('fetch_exchange_rates');
      exchangeRates = rates;
      lastUpdated = new Date();
    } catch {
      // Fall back to mock rates
      exchangeRates = mockRates;
      lastUpdated = new Date();
    } finally {
      loading = false;
    }
    
    convert();
  }

  function convert() {
    if (!amount || !exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) {
      convertedAmount = null;
      return;
    }

    // Convert through USD as base
    const usdAmount = amount / exchangeRates[fromCurrency];
    convertedAmount = usdAmount * exchangeRates[toCurrency];
  }

  function swapCurrencies() {
    const temp = fromCurrency;
    fromCurrency = toCurrency;
    toCurrency = temp;
    convert();
  }

  function addToHistory() {
    if (convertedAmount === null) return;
    
    const entry = {
      from: fromCurrency,
      to: toCurrency,
      amount,
      result: convertedAmount,
      date: new Date()
    };
    
    history = [entry, ...history.slice(0, 9)];
  }

  function toggleFavorite() {
    const pair = { from: fromCurrency, to: toCurrency };
    const index = favorites.findIndex(f => f.from === pair.from && f.to === pair.to);
    
    if (index >= 0) {
      favorites = favorites.filter((_, i) => i !== index);
    } else {
      favorites = [...favorites, pair];
    }
    
    saveFavorites();
  }

  function isFavorite(): boolean {
    return favorites.some(f => f.from === fromCurrency && f.to === toCurrency);
  }

  function loadFavorite(fav: { from: string; to: string }) {
    fromCurrency = fav.from;
    toCurrency = fav.to;
    convert();
  }

  function formatCurrency(value: number, currency: string): string {
    const info = currencyInfo[currency];
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2
    });
    return `${info?.symbol || ''}${formatted}`;
  }

  function getRate(): string {
    if (!exchangeRates[fromCurrency] || !exchangeRates[toCurrency]) return '—';
    const rate = exchangeRates[toCurrency] / exchangeRates[fromCurrency];
    return `1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`;
  }

  // React to changes
  $effect(() => {
    convert();
  });
</script>

<div class="currency-converter" class:compact>
  <header class="converter-header">
    <div class="title-row">
      <span class="icon">💱</span>
      <h3>Currency Converter</h3>
    </div>
    <div class="header-actions">
      <button 
        class="icon-btn" 
        class:active={showHistory}
        onclick={() => showHistory = !showHistory}
        title="Conversion history"
      >
        📜
      </button>
      <button 
        class="icon-btn" 
        class:loading
        onclick={() => fetchExchangeRates()}
        title="Refresh rates"
      >
        🔄
      </button>
    </div>
  </header>

  {#if error}
    <div class="error-banner">
      ⚠️ {error}
    </div>
  {/if}

  {#if showHistory}
    <div class="history-panel">
      <h4>Recent Conversions</h4>
      {#if history.length === 0}
        <p class="empty-state">No conversions yet</p>
      {:else}
        <ul class="history-list">
          {#each history as entry}
            <li class="history-item">
              <span class="history-conversion">
                {formatCurrency(entry.amount, entry.from)} → {formatCurrency(entry.result, entry.to)}
              </span>
              <span class="history-time">
                {entry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <div class="converter-body">
      <!-- Favorites -->
      {#if favorites.length > 0}
        <div class="favorites-row">
          {#each favorites as fav}
            <button 
              class="favorite-chip"
              onclick={() => loadFavorite(fav)}
            >
              {currencyInfo[fav.from]?.flag} → {currencyInfo[fav.to]?.flag}
            </button>
          {/each}
        </div>
      {/if}

      <!-- Amount input -->
      <div class="input-group">
        <label for="amount">Amount</label>
        <div class="amount-input-wrapper">
          <span class="currency-symbol">{currencyInfo[fromCurrency]?.symbol || ''}</span>
          <input
            type="number"
            id="amount"
            bind:value={amount}
            min="0"
            step="any"
            placeholder="Enter amount"
            oninput={() => { convert(); }}
          />
        </div>
      </div>

      <!-- Currency selection -->
      <div class="currency-row">
        <div class="currency-select-group">
          <label for="from-currency">From</label>
          <div class="select-wrapper">
            <span class="flag">{currencyInfo[fromCurrency]?.flag || '🏳️'}</span>
            <select 
              id="from-currency" 
              bind:value={fromCurrency}
              onchange={() => convert()}
            >
              {#each Object.keys(currencyInfo) as code}
                <option value={code}>{code} - {currencyInfo[code].name}</option>
              {/each}
            </select>
          </div>
        </div>

        <button class="swap-btn" onclick={swapCurrencies} title="Swap currencies">
          ⇄
        </button>

        <div class="currency-select-group">
          <label for="to-currency">To</label>
          <div class="select-wrapper">
            <span class="flag">{currencyInfo[toCurrency]?.flag || '🏳️'}</span>
            <select 
              id="to-currency" 
              bind:value={toCurrency}
              onchange={() => convert()}
            >
              {#each Object.keys(currencyInfo) as code}
                <option value={code}>{code} - {currencyInfo[code].name}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <!-- Result -->
      <div class="result-section">
        <div class="result-display">
          {#if convertedAmount !== null}
            <span class="result-amount">{formatCurrency(convertedAmount, toCurrency)}</span>
            <span class="result-currency">{toCurrency}</span>
          {:else}
            <span class="result-placeholder">—</span>
          {/if}
        </div>
        
        <div class="rate-display">
          <span class="rate-text">{getRate()}</span>
          <button 
            class="favorite-btn" 
            class:is-favorite={isFavorite()}
            onclick={() => { toggleFavorite(); addToHistory(); }}
            title={isFavorite() ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite() ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      <!-- Quick amounts -->
      {#if !compact}
        <div class="quick-amounts">
          {#each [10, 50, 100, 500, 1000] as quickAmount}
            <button 
              class="quick-amount-btn"
              class:active={amount === quickAmount}
              onclick={() => { amount = quickAmount; convert(); }}
            >
              {quickAmount}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <footer class="converter-footer">
    {#if lastUpdated}
      <span class="last-updated">
        Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    {/if}
    {#if loading}
      <span class="loading-indicator">Refreshing...</span>
    {/if}
  </footer>
</div>

<style>
  .currency-converter {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary, #2f3136);
    border-radius: 12px;
    padding: 16px;
    min-width: 320px;
    max-width: 400px;
    color: var(--text-primary, #dcddde);
    font-family: var(--font-family, system-ui, -apple-system, sans-serif);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .currency-converter.compact {
    min-width: 280px;
    padding: 12px;
  }

  .converter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color, #40444b);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon {
    font-size: 1.5rem;
  }

  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .icon-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .icon-btn:hover {
    background: var(--bg-hover, #40444b);
  }

  .icon-btn.active {
    background: var(--accent-color, #5865f2);
  }

  .icon-btn.loading {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-banner {
    background: var(--error-bg, #f04747);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-size: 0.85rem;
  }

  .history-panel {
    padding: 12px;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
  }

  .history-panel h4 {
    margin: 0 0 12px 0;
    font-size: 0.9rem;
    color: var(--text-secondary, #b9bbbe);
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted, #72767d);
    font-size: 0.85rem;
    padding: 20px 0;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, #40444b);
    font-size: 0.85rem;
  }

  .history-item:last-child {
    border-bottom: none;
  }

  .history-time {
    color: var(--text-muted, #72767d);
  }

  .converter-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .favorites-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .favorite-chip {
    background: var(--bg-tertiary, #202225);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 16px;
    padding: 4px 12px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .favorite-chip:hover {
    background: var(--accent-color, #5865f2);
    border-color: var(--accent-color, #5865f2);
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group label {
    font-size: 0.8rem;
    color: var(--text-secondary, #b9bbbe);
    text-transform: uppercase;
    font-weight: 600;
  }

  .amount-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 0 12px;
    border: 1px solid var(--border-color, #40444b);
    transition: border-color 0.2s;
  }

  .amount-input-wrapper:focus-within {
    border-color: var(--accent-color, #5865f2);
  }

  .currency-symbol {
    color: var(--text-muted, #72767d);
    font-size: 1.1rem;
    margin-right: 8px;
  }

  .amount-input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 12px 0;
    font-size: 1.2rem;
    color: var(--text-primary, #dcddde);
    outline: none;
  }

  .amount-input-wrapper input::placeholder {
    color: var(--text-muted, #72767d);
  }

  .currency-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  .currency-select-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .currency-select-group label {
    font-size: 0.8rem;
    color: var(--text-secondary, #b9bbbe);
    text-transform: uppercase;
    font-weight: 600;
  }

  .select-wrapper {
    display: flex;
    align-items: center;
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 0 12px;
    border: 1px solid var(--border-color, #40444b);
  }

  .flag {
    font-size: 1.2rem;
    margin-right: 8px;
  }

  .select-wrapper select {
    flex: 1;
    background: transparent;
    border: none;
    padding: 10px 0;
    font-size: 0.95rem;
    color: var(--text-primary, #dcddde);
    outline: none;
    cursor: pointer;
  }

  .select-wrapper select option {
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
  }

  .swap-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--accent-color, #5865f2);
    border: none;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, background 0.2s;
    flex-shrink: 0;
    margin-bottom: 4px;
  }

  .swap-btn:hover {
    transform: scale(1.1);
    background: var(--accent-hover, #4752c4);
  }

  .result-section {
    background: var(--bg-tertiary, #202225);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }

  .result-display {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .result-amount {
    font-size: 2rem;
    font-weight: 700;
    color: var(--success-color, #43b581);
  }

  .result-currency {
    font-size: 1rem;
    color: var(--text-secondary, #b9bbbe);
  }

  .result-placeholder {
    font-size: 2rem;
    color: var(--text-muted, #72767d);
  }

  .rate-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .rate-text {
    font-size: 0.85rem;
    color: var(--text-muted, #72767d);
  }

  .favorite-btn {
    background: transparent;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px;
    transition: transform 0.2s;
  }

  .favorite-btn:hover {
    transform: scale(1.2);
  }

  .favorite-btn.is-favorite {
    color: #faa61a;
  }

  .quick-amounts {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .quick-amount-btn {
    flex: 1;
    padding: 8px;
    background: var(--bg-tertiary, #202225);
    border: 1px solid var(--border-color, #40444b);
    border-radius: 6px;
    color: var(--text-secondary, #b9bbbe);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-amount-btn:hover,
  .quick-amount-btn.active {
    background: var(--accent-color, #5865f2);
    border-color: var(--accent-color, #5865f2);
    color: white;
  }

  .converter-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border-color, #40444b);
    font-size: 0.75rem;
    color: var(--text-muted, #72767d);
  }

  .loading-indicator {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Compact mode adjustments */
  .compact .converter-body {
    gap: 12px;
  }

  .compact .result-amount {
    font-size: 1.5rem;
  }

  .compact .amount-input-wrapper input {
    font-size: 1rem;
    padding: 10px 0;
  }
</style>
</script>
