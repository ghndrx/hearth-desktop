<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable, derived, type Writable, type Readable } from 'svelte/store';

  const dispatch = createEventDispatcher<{
    localeChanged: { locale: string; previousLocale: string };
    timeZoneChanged: { timeZone: string; previousTimeZone: string };
    dateFormatChanged: { format: DateFormat };
    timeFormatChanged: { format: TimeFormat };
    numberFormatChanged: { format: NumberFormat };
    error: { message: string; code: string };
  }>();

  // Types
  export interface LocaleConfig {
    locale: string;
    timeZone: string;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
    numberFormat: NumberFormat;
    firstDayOfWeek: number;
    useSystemLocale: boolean;
    useSystemTimeZone: boolean;
  }

  export interface DateFormat {
    short: string;
    medium: string;
    long: string;
    full: string;
  }

  export interface TimeFormat {
    use24Hour: boolean;
    showSeconds: boolean;
    showTimeZone: boolean;
  }

  export interface NumberFormat {
    decimalSeparator: string;
    thousandsSeparator: string;
    currencyCode: string;
    currencyPosition: 'before' | 'after';
  }

  export interface LocaleInfo {
    code: string;
    name: string;
    nativeName: string;
    region: string;
    script?: string;
    rtl: boolean;
  }

  // Props
  export let initialLocale: string = 'en-US';
  export let availableLocales: LocaleInfo[] = [
    { code: 'en-US', name: 'English (US)', nativeName: 'English', region: 'United States', rtl: false },
    { code: 'en-GB', name: 'English (UK)', nativeName: 'English', region: 'United Kingdom', rtl: false },
    { code: 'es-ES', name: 'Spanish', nativeName: 'Español', region: 'Spain', rtl: false },
    { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español', region: 'Mexico', rtl: false },
    { code: 'fr-FR', name: 'French', nativeName: 'Français', region: 'France', rtl: false },
    { code: 'de-DE', name: 'German', nativeName: 'Deutsch', region: 'Germany', rtl: false },
    { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', region: 'Italy', rtl: false },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', region: 'Brazil', rtl: false },
    { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português', region: 'Portugal', rtl: false },
    { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', region: 'Japan', rtl: false },
    { code: 'ko-KR', name: 'Korean', nativeName: '한국어', region: 'South Korea', rtl: false },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', region: 'China', rtl: false },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', region: 'Taiwan', rtl: false },
    { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', region: 'Russia', rtl: false },
    { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', region: 'Saudi Arabia', rtl: true },
    { code: 'he-IL', name: 'Hebrew', nativeName: 'עברית', region: 'Israel', rtl: true },
    { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', region: 'India', rtl: false },
    { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', region: 'Netherlands', rtl: false },
    { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', region: 'Poland', rtl: false },
    { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', region: 'Sweden', rtl: false },
    { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', region: 'Turkey', rtl: false },
    { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', region: 'Ukraine', rtl: false },
    { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'Vietnam', rtl: false },
    { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', region: 'Thailand', rtl: false },
  ];
  export let persistSettings: boolean = true;
  export let storageKey: string = 'hearth-locale-settings';

  // State
  const config: Writable<LocaleConfig> = writable({
    locale: initialLocale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: {
      short: 'MM/dd/yyyy',
      medium: 'MMM d, yyyy',
      long: 'MMMM d, yyyy',
      full: 'EEEE, MMMM d, yyyy',
    },
    timeFormat: {
      use24Hour: false,
      showSeconds: false,
      showTimeZone: false,
    },
    numberFormat: {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      currencyCode: 'USD',
      currencyPosition: 'before',
    },
    firstDayOfWeek: 0,
    useSystemLocale: true,
    useSystemTimeZone: true,
  });

  let searchQuery = '';
  let showSettings = false;
  let activeTab: 'locale' | 'datetime' | 'numbers' = 'locale';
  let previewDate = new Date();
  let previewNumber = 1234567.89;

  // Time zones
  const commonTimeZones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Hong_Kong',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Australia/Perth',
    'Pacific/Auckland',
  ];

  // Derived state
  const currentLocaleInfo: Readable<LocaleInfo | undefined> = derived(config, ($config) =>
    availableLocales.find((l) => l.code === $config.locale)
  );

  const filteredLocales: Readable<LocaleInfo[]> = derived([config], () => {
    if (!searchQuery) return availableLocales;
    const query = searchQuery.toLowerCase();
    return availableLocales.filter(
      (locale) =>
        locale.name.toLowerCase().includes(query) ||
        locale.nativeName.toLowerCase().includes(query) ||
        locale.code.toLowerCase().includes(query) ||
        locale.region.toLowerCase().includes(query)
    );
  });

  const isRTL: Readable<boolean> = derived(currentLocaleInfo, ($info) => $info?.rtl ?? false);

  // Format preview helpers
  const formattedDate: Readable<string> = derived(config, ($config) => {
    try {
      return new Intl.DateTimeFormat($config.locale, {
        dateStyle: 'long',
        timeZone: $config.timeZone,
      }).format(previewDate);
    } catch {
      return previewDate.toLocaleDateString();
    }
  });

  const formattedTime: Readable<string> = derived(config, ($config) => {
    try {
      return new Intl.DateTimeFormat($config.locale, {
        hour: 'numeric',
        minute: 'numeric',
        second: $config.timeFormat.showSeconds ? 'numeric' : undefined,
        hour12: !$config.timeFormat.use24Hour,
        timeZone: $config.timeZone,
        timeZoneName: $config.timeFormat.showTimeZone ? 'short' : undefined,
      }).format(previewDate);
    } catch {
      return previewDate.toLocaleTimeString();
    }
  });

  const formattedNumber: Readable<string> = derived(config, ($config) => {
    try {
      return new Intl.NumberFormat($config.locale, {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(previewNumber);
    } catch {
      return previewNumber.toLocaleString();
    }
  });

  const formattedCurrency: Readable<string> = derived(config, ($config) => {
    try {
      return new Intl.NumberFormat($config.locale, {
        style: 'currency',
        currency: $config.numberFormat.currencyCode,
      }).format(previewNumber);
    } catch {
      return `$${previewNumber.toFixed(2)}`;
    }
  });

  // Functions
  function setLocale(localeCode: string): void {
    const previousLocale = $config.locale;
    if (localeCode === previousLocale) return;

    const localeInfo = availableLocales.find((l) => l.code === localeCode);
    if (!localeInfo) {
      dispatch('error', { message: `Unknown locale: ${localeCode}`, code: 'UNKNOWN_LOCALE' });
      return;
    }

    config.update((c) => ({ ...c, locale: localeCode, useSystemLocale: false }));
    updateNumberFormatForLocale(localeCode);
    
    dispatch('localeChanged', { locale: localeCode, previousLocale });
    
    if (typeof document !== 'undefined') {
      document.documentElement.lang = localeCode;
      document.documentElement.dir = localeInfo.rtl ? 'rtl' : 'ltr';
    }
  }

  function setTimeZone(timeZone: string): void {
    const previousTimeZone = $config.timeZone;
    if (timeZone === previousTimeZone) return;

    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
      config.update((c) => ({ ...c, timeZone, useSystemTimeZone: false }));
      dispatch('timeZoneChanged', { timeZone, previousTimeZone });
    } catch {
      dispatch('error', { message: `Invalid time zone: ${timeZone}`, code: 'INVALID_TIMEZONE' });
    }
  }

  function setDateFormat(format: Partial<DateFormat>): void {
    config.update((c) => ({
      ...c,
      dateFormat: { ...c.dateFormat, ...format },
    }));
    dispatch('dateFormatChanged', { format: $config.dateFormat });
  }

  function setTimeFormat(format: Partial<TimeFormat>): void {
    config.update((c) => ({
      ...c,
      timeFormat: { ...c.timeFormat, ...format },
    }));
    dispatch('timeFormatChanged', { format: $config.timeFormat });
  }

  function setNumberFormat(format: Partial<NumberFormat>): void {
    config.update((c) => ({
      ...c,
      numberFormat: { ...c.numberFormat, ...format },
    }));
    dispatch('numberFormatChanged', { format: $config.numberFormat });
  }

  function updateNumberFormatForLocale(locale: string): void {
    try {
      const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
      const decimal = parts.find((p) => p.type === 'decimal')?.value || '.';
      const group = parts.find((p) => p.type === 'group')?.value || ',';
      
      config.update((c) => ({
        ...c,
        numberFormat: {
          ...c.numberFormat,
          decimalSeparator: decimal,
          thousandsSeparator: group,
        },
      }));
    } catch {
      // Keep existing format on error
    }
  }

  function useSystemLocale(): void {
    const systemLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    config.update((c) => ({ ...c, useSystemLocale: true }));
    setLocale(systemLocale);
  }

  function useSystemTimeZone(): void {
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    config.update((c) => ({ ...c, useSystemTimeZone: true }));
    setTimeZone(systemTimeZone);
  }

  function formatDate(date: Date, style: 'short' | 'medium' | 'long' | 'full' = 'medium'): string {
    try {
      return new Intl.DateTimeFormat($config.locale, {
        dateStyle: style,
        timeZone: $config.timeZone,
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  function formatTime(date: Date): string {
    try {
      return new Intl.DateTimeFormat($config.locale, {
        hour: 'numeric',
        minute: 'numeric',
        second: $config.timeFormat.showSeconds ? 'numeric' : undefined,
        hour12: !$config.timeFormat.use24Hour,
        timeZone: $config.timeZone,
      }).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  }

  function formatNumber(num: number, options?: Intl.NumberFormatOptions): string {
    try {
      return new Intl.NumberFormat($config.locale, options).format(num);
    } catch {
      return num.toLocaleString();
    }
  }

  function formatCurrency(amount: number, currency?: string): string {
    try {
      return new Intl.NumberFormat($config.locale, {
        style: 'currency',
        currency: currency || $config.numberFormat.currencyCode,
      }).format(amount);
    } catch {
      return `$${amount.toFixed(2)}`;
    }
  }

  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const seconds = Math.round(diff / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    try {
      const rtf = new Intl.RelativeTimeFormat($config.locale, { numeric: 'auto' });
      
      if (Math.abs(seconds) < 60) return rtf.format(seconds, 'second');
      if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
      if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
      return rtf.format(days, 'day');
    } catch {
      return date.toLocaleString();
    }
  }

  function saveSettings(): void {
    if (!persistSettings || typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem(storageKey, JSON.stringify($config));
    } catch (err) {
      dispatch('error', { message: 'Failed to save locale settings', code: 'SAVE_ERROR' });
    }
  }

  function loadSettings(): void {
    if (!persistSettings || typeof localStorage === 'undefined') return;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as LocaleConfig;
        config.set({ ...$config, ...parsed });
        
        if (typeof document !== 'undefined') {
          const localeInfo = availableLocales.find((l) => l.code === parsed.locale);
          document.documentElement.lang = parsed.locale;
          document.documentElement.dir = localeInfo?.rtl ? 'rtl' : 'ltr';
        }
      }
    } catch (err) {
      dispatch('error', { message: 'Failed to load locale settings', code: 'LOAD_ERROR' });
    }
  }

  function resetToDefaults(): void {
    const systemLocale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    config.set({
      locale: systemLocale,
      timeZone: systemTimeZone,
      dateFormat: {
        short: 'MM/dd/yyyy',
        medium: 'MMM d, yyyy',
        long: 'MMMM d, yyyy',
        full: 'EEEE, MMMM d, yyyy',
      },
      timeFormat: {
        use24Hour: false,
        showSeconds: false,
        showTimeZone: false,
      },
      numberFormat: {
        decimalSeparator: '.',
        thousandsSeparator: ',',
        currencyCode: 'USD',
        currencyPosition: 'before',
      },
      firstDayOfWeek: 0,
      useSystemLocale: true,
      useSystemTimeZone: true,
    });
    
    updateNumberFormatForLocale(systemLocale);
    saveSettings();
  }

  // Lifecycle
  onMount(() => {
    loadSettings();
    
    // Update preview date every minute
    const interval = setInterval(() => {
      previewDate = new Date();
    }, 60000);
    
    return () => clearInterval(interval);
  });

  // Auto-save on changes
  $: if ($config && persistSettings) {
    saveSettings();
  }

  // Exports for parent components
  export { formatDate, formatTime, formatNumber, formatCurrency, formatRelativeTime };
  export { config as localeConfig };
</script>

<div class="locale-manager" class:rtl={$isRTL}>
  <div class="locale-header">
    <div class="current-locale">
      <span class="locale-flag">{$currentLocaleInfo?.code.split('-')[1] || '🌐'}</span>
      <div class="locale-info">
        <span class="locale-name">{$currentLocaleInfo?.nativeName || $config.locale}</span>
        <span class="locale-region">{$currentLocaleInfo?.region || ''}</span>
      </div>
    </div>
    <button
      class="settings-toggle"
      on:click={() => (showSettings = !showSettings)}
      aria-expanded={showSettings}
      aria-label="Toggle locale settings"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6m0 6v10M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h10M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
      </svg>
    </button>
  </div>

  {#if showSettings}
    <div class="settings-panel">
      <div class="tabs">
        <button
          class="tab"
          class:active={activeTab === 'locale'}
          on:click={() => (activeTab = 'locale')}
        >
          Language & Region
        </button>
        <button
          class="tab"
          class:active={activeTab === 'datetime'}
          on:click={() => (activeTab = 'datetime')}
        >
          Date & Time
        </button>
        <button
          class="tab"
          class:active={activeTab === 'numbers'}
          on:click={() => (activeTab = 'numbers')}
        >
          Numbers & Currency
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'locale'}
          <div class="locale-section">
            <div class="system-toggle">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={$config.useSystemLocale}
                  on:change={() => useSystemLocale()}
                />
                <span>Use system language</span>
              </label>
            </div>

            <div class="search-box">
              <input
                type="text"
                placeholder="Search languages..."
                bind:value={searchQuery}
                class="search-input"
              />
            </div>

            <div class="locale-list">
              {#each $filteredLocales as locale (locale.code)}
                <button
                  class="locale-item"
                  class:selected={$config.locale === locale.code}
                  on:click={() => setLocale(locale.code)}
                >
                  <span class="locale-native">{locale.nativeName}</span>
                  <span class="locale-english">{locale.name}</span>
                  {#if locale.rtl}
                    <span class="rtl-badge">RTL</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {:else if activeTab === 'datetime'}
          <div class="datetime-section">
            <div class="system-toggle">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={$config.useSystemTimeZone}
                  on:change={() => useSystemTimeZone()}
                />
                <span>Use system time zone</span>
              </label>
            </div>

            <div class="form-group">
              <label for="timezone-select">Time Zone</label>
              <select
                id="timezone-select"
                value={$config.timeZone}
                on:change={(e) => setTimeZone(e.currentTarget.value)}
                disabled={$config.useSystemTimeZone}
              >
                {#each commonTimeZones as tz}
                  <option value={tz}>{tz.replace(/_/g, ' ')}</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label>Time Format</label>
              <div class="radio-group">
                <label>
                  <input
                    type="radio"
                    name="time-format"
                    checked={!$config.timeFormat.use24Hour}
                    on:change={() => setTimeFormat({ use24Hour: false })}
                  />
                  <span>12-hour (1:30 PM)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="time-format"
                    checked={$config.timeFormat.use24Hour}
                    on:change={() => setTimeFormat({ use24Hour: true })}
                  />
                  <span>24-hour (13:30)</span>
                </label>
              </div>
            </div>

            <div class="checkbox-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={$config.timeFormat.showSeconds}
                  on:change={(e) => setTimeFormat({ showSeconds: e.currentTarget.checked })}
                />
                <span>Show seconds</span>
              </label>
              <label class="toggle-label">
                <input
                  type="checkbox"
                  checked={$config.timeFormat.showTimeZone}
                  on:change={(e) => setTimeFormat({ showTimeZone: e.currentTarget.checked })}
                />
                <span>Show time zone</span>
              </label>
            </div>

            <div class="form-group">
              <label for="first-day">First day of week</label>
              <select
                id="first-day"
                value={$config.firstDayOfWeek}
                on:change={(e) => config.update((c) => ({ ...c, firstDayOfWeek: parseInt(e.currentTarget.value) }))}
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>

            <div class="preview-box">
              <h4>Preview</h4>
              <p class="preview-date">{$formattedDate}</p>
              <p class="preview-time">{$formattedTime}</p>
            </div>
          </div>
        {:else if activeTab === 'numbers'}
          <div class="numbers-section">
            <div class="form-group">
              <label for="currency-select">Currency</label>
              <select
                id="currency-select"
                value={$config.numberFormat.currencyCode}
                on:change={(e) => setNumberFormat({ currencyCode: e.currentTarget.value })}
              >
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
                <option value="JPY">Japanese Yen (JPY)</option>
                <option value="CNY">Chinese Yuan (CNY)</option>
                <option value="KRW">Korean Won (KRW)</option>
                <option value="INR">Indian Rupee (INR)</option>
                <option value="BRL">Brazilian Real (BRL)</option>
                <option value="CAD">Canadian Dollar (CAD)</option>
                <option value="AUD">Australian Dollar (AUD)</option>
                <option value="CHF">Swiss Franc (CHF)</option>
                <option value="MXN">Mexican Peso (MXN)</option>
              </select>
            </div>

            <div class="preview-box">
              <h4>Preview</h4>
              <p class="preview-number">Number: {$formattedNumber}</p>
              <p class="preview-currency">Currency: {$formattedCurrency}</p>
            </div>
          </div>
        {/if}
      </div>

      <div class="settings-footer">
        <button class="reset-btn" on:click={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .locale-manager {
    background: var(--bg-secondary, #2f3136);
    border-radius: 8px;
    padding: 16px;
    color: var(--text-primary, #dcddde);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .locale-manager.rtl {
    direction: rtl;
  }

  .locale-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .current-locale {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .locale-flag {
    font-size: 24px;
    width: 32px;
    text-align: center;
  }

  .locale-info {
    display: flex;
    flex-direction: column;
  }

  .locale-name {
    font-weight: 600;
    font-size: 14px;
  }

  .locale-region {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .settings-toggle {
    background: transparent;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .settings-toggle:hover {
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
  }

  .settings-panel {
    margin-top: 16px;
    border-top: 1px solid var(--bg-tertiary, #202225);
    padding-top: 16px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
  }

  .tab {
    flex: 1;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    transition: all 0.2s ease;
  }

  .tab:hover {
    background: var(--bg-tertiary, #202225);
    color: var(--text-primary, #dcddde);
  }

  .tab.active {
    background: var(--brand-primary, #5865f2);
    color: white;
  }

  .tab-content {
    min-height: 300px;
  }

  .system-toggle {
    margin-bottom: 16px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
  }

  .toggle-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .search-box {
    margin-bottom: 12px;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 14px;
  }

  .search-input::placeholder {
    color: var(--text-muted, #72767d);
  }

  .search-input:focus {
    outline: 2px solid var(--brand-primary, #5865f2);
    outline-offset: -2px;
  }

  .locale-list {
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .locale-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.2s ease;
  }

  .locale-item:hover {
    background: var(--bg-tertiary, #202225);
  }

  .locale-item.selected {
    background: var(--brand-primary, #5865f2);
    color: white;
  }

  .locale-native {
    font-weight: 500;
    flex: 1;
  }

  .locale-english {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .locale-item.selected .locale-english {
    color: rgba(255, 255, 255, 0.7);
  }

  .rtl-badge {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--bg-accent, #4f545c);
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
  }

  .form-group select {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-tertiary, #202225);
    border: none;
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    font-size: 14px;
    cursor: pointer;
  }

  .form-group select:focus {
    outline: 2px solid var(--brand-primary, #5865f2);
    outline-offset: -2px;
  }

  .form-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    text-transform: none;
    font-weight: normal;
    color: var(--text-primary, #dcddde);
    margin-bottom: 0;
  }

  .radio-group input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .preview-box {
    background: var(--bg-tertiary, #202225);
    border-radius: 8px;
    padding: 16px;
    margin-top: 16px;
  }

  .preview-box h4 {
    margin: 0 0 12px 0;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .preview-box p {
    margin: 0 0 8px 0;
    font-size: 16px;
  }

  .preview-box p:last-child {
    margin-bottom: 0;
  }

  .settings-footer {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--bg-tertiary, #202225);
    display: flex;
    justify-content: flex-end;
  }

  .reset-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--text-muted, #72767d);
    border-radius: 4px;
    color: var(--text-primary, #dcddde);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .reset-btn:hover {
    background: var(--danger, #ed4245);
    border-color: var(--danger, #ed4245);
    color: white;
  }

  /* Scrollbar styling */
  .locale-list::-webkit-scrollbar {
    width: 8px;
  }

  .locale-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .locale-list::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary, #202225);
    border-radius: 4px;
  }

  .locale-list::-webkit-scrollbar-thumb:hover {
    background: var(--bg-accent, #4f545c);
  }
</style>
