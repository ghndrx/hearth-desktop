<script lang="ts">
  let input: string = '';
  let searchQuery: string = '';
  let inspectedChars: CharInfo[] = [];
  let searchResults: CharInfo[] = [];
  let activeTab: 'inspect' | 'search' = 'inspect';
  let showCopyFeedback: boolean = false;
  let copyFeedbackText: string = '';

  interface CharInfo {
    char: string;
    codePoint: string;
    hex: string;
    decimal: number;
    utf8: string;
    utf16: string;
    htmlEntity: string;
    cssEscape: string;
    name: string;
    category: string;
    block: string;
  }

  const commonCharacters: { label: string; chars: string }[] = [
    { label: 'Arrows', chars: '\u2190\u2191\u2192\u2193\u2194\u2195\u21D0\u21D2\u27A1' },
    { label: 'Math', chars: '\u00B1\u00D7\u00F7\u2260\u2264\u2265\u221E\u2211\u222B' },
    { label: 'Currency', chars: '$\u20AC\u00A3\u00A5\u20A3\u20B9\u20BF\u20A9\u20AB' },
    { label: 'Symbols', chars: '\u00A9\u00AE\u2122\u2603\u2605\u2606\u2764\u266A\u2713' },
    { label: 'Box Drawing', chars: '\u250C\u2510\u2514\u2518\u2500\u2502\u251C\u2524\u253C' },
    { label: 'Blocks', chars: '\u2580\u2584\u2588\u258C\u2590\u2591\u2592\u2593\u25A0' },
  ];

  // Unicode block ranges (simplified)
  const unicodeBlocks: [number, number, string][] = [
    [0x0000, 0x007F, 'Basic Latin'],
    [0x0080, 0x00FF, 'Latin-1 Supplement'],
    [0x0100, 0x017F, 'Latin Extended-A'],
    [0x0180, 0x024F, 'Latin Extended-B'],
    [0x0250, 0x02AF, 'IPA Extensions'],
    [0x0370, 0x03FF, 'Greek and Coptic'],
    [0x0400, 0x04FF, 'Cyrillic'],
    [0x0530, 0x058F, 'Armenian'],
    [0x0590, 0x05FF, 'Hebrew'],
    [0x0600, 0x06FF, 'Arabic'],
    [0x2000, 0x206F, 'General Punctuation'],
    [0x2070, 0x209F, 'Superscripts and Subscripts'],
    [0x20A0, 0x20CF, 'Currency Symbols'],
    [0x2100, 0x214F, 'Letterlike Symbols'],
    [0x2150, 0x218F, 'Number Forms'],
    [0x2190, 0x21FF, 'Arrows'],
    [0x2200, 0x22FF, 'Mathematical Operators'],
    [0x2300, 0x23FF, 'Miscellaneous Technical'],
    [0x2500, 0x257F, 'Box Drawing'],
    [0x2580, 0x259F, 'Block Elements'],
    [0x25A0, 0x25FF, 'Geometric Shapes'],
    [0x2600, 0x26FF, 'Miscellaneous Symbols'],
    [0x2700, 0x27BF, 'Dingbats'],
    [0x1F600, 0x1F64F, 'Emoticons'],
    [0x1F680, 0x1F6FF, 'Transport and Map Symbols'],
    [0x1F900, 0x1F9FF, 'Supplemental Symbols and Pictographs'],
  ];

  function getUnicodeBlock(codePoint: number): string {
    for (const [start, end, name] of unicodeBlocks) {
      if (codePoint >= start && codePoint <= end) return name;
    }
    return 'Unknown';
  }

  function getCategory(codePoint: number): string {
    if (codePoint <= 0x1F || (codePoint >= 0x7F && codePoint <= 0x9F)) return 'Control';
    if (codePoint >= 0x30 && codePoint <= 0x39) return 'Digit';
    if ((codePoint >= 0x41 && codePoint <= 0x5A) || (codePoint >= 0x61 && codePoint <= 0x7A)) return 'Letter';
    if (codePoint === 0x20) return 'Space';
    if (codePoint >= 0x21 && codePoint <= 0x2F) return 'Punctuation';
    if (codePoint >= 0x2000 && codePoint <= 0x206F) return 'Punctuation';
    if (codePoint >= 0x2190 && codePoint <= 0x21FF) return 'Arrow';
    if (codePoint >= 0x2200 && codePoint <= 0x22FF) return 'Math';
    if (codePoint >= 0x20A0 && codePoint <= 0x20CF) return 'Currency';
    if (codePoint >= 0x2500 && codePoint <= 0x259F) return 'Box Drawing';
    if (codePoint >= 0x2600 && codePoint <= 0x26FF) return 'Symbol';
    if (codePoint >= 0x1F600 && codePoint <= 0x1F9FF) return 'Emoji';
    return 'Symbol';
  }

  function getCharName(codePoint: number): string {
    // Common character names
    const names: Record<number, string> = {
      0x20: 'SPACE', 0x21: 'EXCLAMATION MARK', 0x22: 'QUOTATION MARK',
      0x23: 'NUMBER SIGN', 0x24: 'DOLLAR SIGN', 0x25: 'PERCENT SIGN',
      0x26: 'AMPERSAND', 0x27: 'APOSTROPHE', 0x28: 'LEFT PARENTHESIS',
      0x29: 'RIGHT PARENTHESIS', 0x2A: 'ASTERISK', 0x2B: 'PLUS SIGN',
      0x2C: 'COMMA', 0x2D: 'HYPHEN-MINUS', 0x2E: 'FULL STOP',
      0x2F: 'SOLIDUS', 0x3A: 'COLON', 0x3B: 'SEMICOLON',
      0x3C: 'LESS-THAN SIGN', 0x3D: 'EQUALS SIGN', 0x3E: 'GREATER-THAN SIGN',
      0x3F: 'QUESTION MARK', 0x40: 'COMMERCIAL AT', 0x5B: 'LEFT SQUARE BRACKET',
      0x5C: 'REVERSE SOLIDUS', 0x5D: 'RIGHT SQUARE BRACKET',
      0x5E: 'CIRCUMFLEX ACCENT', 0x5F: 'LOW LINE', 0x60: 'GRAVE ACCENT',
      0x7B: 'LEFT CURLY BRACKET', 0x7C: 'VERTICAL LINE',
      0x7D: 'RIGHT CURLY BRACKET', 0x7E: 'TILDE',
      0xA9: 'COPYRIGHT SIGN', 0xAE: 'REGISTERED SIGN',
      0xB1: 'PLUS-MINUS SIGN', 0xD7: 'MULTIPLICATION SIGN',
      0xF7: 'DIVISION SIGN', 0x2190: 'LEFTWARDS ARROW',
      0x2191: 'UPWARDS ARROW', 0x2192: 'RIGHTWARDS ARROW',
      0x2193: 'DOWNWARDS ARROW', 0x221E: 'INFINITY',
      0x2605: 'BLACK STAR', 0x2606: 'WHITE STAR',
      0x2764: 'HEAVY BLACK HEART', 0x2713: 'CHECK MARK',
      0x20AC: 'EURO SIGN', 0xA3: 'POUND SIGN', 0xA5: 'YEN SIGN',
    };

    if (names[codePoint]) return names[codePoint];
    if (codePoint >= 0x30 && codePoint <= 0x39) return `DIGIT ${String.fromCodePoint(codePoint)}`;
    if (codePoint >= 0x41 && codePoint <= 0x5A) return `LATIN CAPITAL LETTER ${String.fromCodePoint(codePoint)}`;
    if (codePoint >= 0x61 && codePoint <= 0x7A) return `LATIN SMALL LETTER ${String.fromCodePoint(codePoint)}`;
    if (codePoint <= 0x1F) return `CONTROL (${codePoint.toString(16).toUpperCase().padStart(2, '0')})`;
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
  }

  function toUtf8Hex(codePoint: number): string {
    const bytes: number[] = [];
    if (codePoint <= 0x7F) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7FF) {
      bytes.push(0xC0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3F));
    } else if (codePoint <= 0xFFFF) {
      bytes.push(0xE0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
      bytes.push(0x80 | (codePoint & 0x3F));
    } else {
      bytes.push(0xF0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
      bytes.push(0x80 | (codePoint & 0x3F));
    }
    return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  }

  function toUtf16Hex(codePoint: number): string {
    if (codePoint <= 0xFFFF) {
      return codePoint.toString(16).toUpperCase().padStart(4, '0');
    }
    // Surrogate pair
    const offset = codePoint - 0x10000;
    const high = 0xD800 + (offset >> 10);
    const low = 0xDC00 + (offset & 0x3FF);
    return `${high.toString(16).toUpperCase()} ${low.toString(16).toUpperCase()}`;
  }

  function analyzeChar(char: string): CharInfo {
    const codePoint = char.codePointAt(0)!;
    return {
      char,
      codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
      hex: `0x${codePoint.toString(16).toUpperCase()}`,
      decimal: codePoint,
      utf8: toUtf8Hex(codePoint),
      utf16: toUtf16Hex(codePoint),
      htmlEntity: codePoint > 127 ? `&#${codePoint};` : `&#x${codePoint.toString(16)};`,
      cssEscape: `\\${codePoint.toString(16).toUpperCase()}`,
      name: getCharName(codePoint),
      category: getCategory(codePoint),
      block: getUnicodeBlock(codePoint),
    };
  }

  $: {
    if (activeTab === 'inspect' && input) {
      // Use Array.from to handle surrogate pairs correctly
      inspectedChars = Array.from(input).map(analyzeChar);
    } else if (activeTab === 'inspect') {
      inspectedChars = [];
    }
  }

  function searchUnicode() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: CharInfo[] = [];

    // Check if searching by codepoint (U+XXXX or 0xXXXX)
    const hexMatch = query.match(/^(?:u\+|0x)([0-9a-f]+)$/i);
    if (hexMatch) {
      const cp = parseInt(hexMatch[1], 16);
      if (cp >= 0 && cp <= 0x10FFFF) {
        try {
          results.push(analyzeChar(String.fromCodePoint(cp)));
        } catch { /* invalid codepoint */ }
      }
      searchResults = results;
      return;
    }

    // Check if searching by decimal
    const decMatch = query.match(/^(\d+)$/);
    if (decMatch) {
      const cp = parseInt(decMatch[1], 10);
      if (cp >= 0 && cp <= 0x10FFFF) {
        try {
          results.push(analyzeChar(String.fromCodePoint(cp)));
        } catch { /* invalid codepoint */ }
      }
      searchResults = results;
      return;
    }

    // Search by name in common ranges
    const searchRanges: [number, number][] = [
      [0x20, 0x7E],      // Basic ASCII
      [0xA0, 0xFF],      // Latin-1 Supplement
      [0x2000, 0x206F],  // General Punctuation
      [0x2190, 0x21FF],  // Arrows
      [0x2200, 0x22FF],  // Math Operators
      [0x2500, 0x257F],  // Box Drawing
      [0x2580, 0x259F],  // Block Elements
      [0x25A0, 0x25FF],  // Geometric Shapes
      [0x2600, 0x26FF],  // Miscellaneous Symbols
      [0x2700, 0x27BF],  // Dingbats
      [0x20A0, 0x20CF],  // Currency Symbols
    ];

    for (const [start, end] of searchRanges) {
      for (let cp = start; cp <= end && results.length < 50; cp++) {
        try {
          const info = analyzeChar(String.fromCodePoint(cp));
          if (
            info.name.toLowerCase().includes(query) ||
            info.category.toLowerCase().includes(query) ||
            info.block.toLowerCase().includes(query)
          ) {
            results.push(info);
          }
        } catch { /* skip */ }
      }
    }

    searchResults = results;
  }

  function insertCommonChar(chars: string) {
    input += chars;
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copyFeedbackText = `${label} copied!`;
      showCopyFeedback = true;
      setTimeout(() => { showCopyFeedback = false; }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function clearInput() {
    input = '';
    inspectedChars = [];
  }
</script>

<div class="unicode-inspector" role="application" aria-label="Unicode Character Inspector">
  <div class="header">
    <h3>
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Unicode Inspector
    </h3>
  </div>

  <!-- Tabs -->
  <div class="tabs" role="tablist">
    <button
      class="tab"
      class:active={activeTab === 'inspect'}
      on:click={() => activeTab = 'inspect'}
      role="tab"
      aria-selected={activeTab === 'inspect'}
    >
      Inspect
    </button>
    <button
      class="tab"
      class:active={activeTab === 'search'}
      on:click={() => activeTab = 'search'}
      role="tab"
      aria-selected={activeTab === 'search'}
    >
      Search
    </button>
  </div>

  <div class="content">
    {#if activeTab === 'inspect'}
      <!-- Inspect Mode -->
      <div class="input-section">
        <div class="input-header">
          <label for="unicode-input">Enter characters to inspect:</label>
          <button class="clear-btn" on:click={clearInput} title="Clear">Clear</button>
        </div>
        <textarea
          id="unicode-input"
          bind:value={input}
          placeholder="Type or paste characters here..."
          rows="2"
          spellcheck="false"
        ></textarea>
        {#if input}
          <div class="char-count">{Array.from(input).length} character{Array.from(input).length !== 1 ? 's' : ''}</div>
        {/if}
      </div>

      <!-- Common Character Palettes -->
      <div class="palettes">
        <div class="palettes-label">Quick Insert:</div>
        <div class="palette-groups">
          {#each commonCharacters as group}
            <div class="palette-group">
              <span class="palette-name">{group.label}</span>
              <div class="palette-chars">
                {#each Array.from(group.chars) as char}
                  <button
                    class="palette-char"
                    on:click={() => insertCommonChar(char)}
                    title="Insert {char}"
                  >
                    {char}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Character Details -->
      {#if inspectedChars.length > 0}
        <div class="results-section">
          <h4>Character Details</h4>
          <div class="char-grid">
            {#each inspectedChars as info}
              <div class="char-card">
                <div class="char-display">
                  <button
                    class="char-big"
                    on:click={() => copyToClipboard(info.char, 'Character')}
                    title="Click to copy character"
                  >
                    {info.char}
                  </button>
                </div>
                <div class="char-details">
                  <div class="detail-row">
                    <span class="detail-label">Name</span>
                    <span class="detail-value name-value">{info.name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Code Point</span>
                    <button class="detail-value copyable" on:click={() => copyToClipboard(info.codePoint, 'Code point')}>
                      {info.codePoint}
                    </button>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Decimal</span>
                    <span class="detail-value">{info.decimal}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">UTF-8</span>
                    <button class="detail-value copyable" on:click={() => copyToClipboard(info.utf8, 'UTF-8')}>
                      {info.utf8}
                    </button>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">UTF-16</span>
                    <span class="detail-value">{info.utf16}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">HTML</span>
                    <button class="detail-value copyable" on:click={() => copyToClipboard(info.htmlEntity, 'HTML entity')}>
                      {info.htmlEntity}
                    </button>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">CSS</span>
                    <button class="detail-value copyable" on:click={() => copyToClipboard(info.cssEscape, 'CSS escape')}>
                      {info.cssEscape}
                    </button>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Block</span>
                    <span class="detail-value block-value">{info.block}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Category</span>
                    <span class="detail-value category-badge">{info.category}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    {:else}
      <!-- Search Mode -->
      <div class="search-section">
        <label for="unicode-search">Search by name, codepoint (U+XXXX), or decimal:</label>
        <div class="search-row">
          <input
            id="unicode-search"
            type="text"
            bind:value={searchQuery}
            on:input={searchUnicode}
            placeholder="e.g., arrow, U+2192, 8594"
            spellcheck="false"
          />
          {#if searchQuery}
            <button class="clear-btn" on:click={() => { searchQuery = ''; searchResults = []; }}>
              Clear
            </button>
          {/if}
        </div>
      </div>

      <!-- Search Results -->
      {#if searchResults.length > 0}
        <div class="search-results">
          <div class="results-count">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</div>
          <div class="results-grid">
            {#each searchResults as info}
              <button
                class="result-item"
                on:click={() => copyToClipboard(info.char, info.name)}
                title="Click to copy: {info.name}"
              >
                <span class="result-char">{info.char}</span>
                <span class="result-code">{info.codePoint}</span>
                <span class="result-name">{info.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else if searchQuery}
        <div class="no-results">No characters found for "{searchQuery}"</div>
      {/if}
    {/if}
  </div>

  <!-- Copy Feedback -->
  {#if showCopyFeedback}
    <div class="copy-feedback" role="status" aria-live="polite">
      {copyFeedbackText}
    </div>
  {/if}
</div>

<style>
  .unicode-inspector {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    color: var(--text-primary, #f2f3f5);
    font-family: var(--font-sans, system-ui, sans-serif);
    position: relative;
    max-height: 650px;
    overflow: hidden;
  }

  .header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header svg {
    color: var(--accent, #5865f2);
  }

  .tabs {
    display: flex;
    gap: 4px;
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
    gap: 12px;
    flex: 1;
    overflow-y: auto;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .input-section label,
  .search-section label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted, #949ba4);
  }

  .clear-btn {
    padding: 2px 8px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-secondary, #b5bac1);
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .clear-btn:hover {
    border-color: var(--accent, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .input-section textarea {
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 6px;
    color: var(--text-primary, #f2f3f5);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 16px;
    padding: 10px;
    resize: vertical;
    min-height: 40px;
  }

  .input-section textarea:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .char-count {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
  }

  /* Palettes */
  .palettes {
    background: var(--bg-tertiary, #1e1f22);
    padding: 10px;
    border-radius: 6px;
  }

  .palettes-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .palette-groups {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .palette-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .palette-name {
    font-size: 10px;
    color: var(--text-muted, #949ba4);
    min-width: 60px;
    text-align: right;
  }

  .palette-chars {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }

  .palette-char {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border-color, #3f4147);
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-primary, #f2f3f5);
    font-size: 14px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .palette-char:hover {
    background: var(--accent, #5865f2);
    border-color: var(--accent, #5865f2);
    color: white;
    transform: scale(1.15);
  }

  /* Character Cards */
  .results-section h4 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #949ba4);
  }

  .char-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .char-card {
    display: flex;
    gap: 12px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    padding: 10px;
  }

  .char-display {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .char-big {
    width: 52px;
    height: 52px;
    background: var(--bg-secondary, #2b2d31);
    border: 2px solid var(--border-color, #3f4147);
    border-radius: 8px;
    font-size: 28px;
    color: var(--text-primary, #f2f3f5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .char-big:hover {
    border-color: var(--accent, #5865f2);
    background: rgba(88, 101, 242, 0.1);
  }

  .char-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }

  .detail-label {
    color: var(--text-muted, #949ba4);
    min-width: 65px;
    font-weight: 500;
  }

  .detail-value {
    color: var(--text-primary, #f2f3f5);
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
  }

  .detail-value.copyable {
    cursor: pointer;
    color: var(--accent, #5865f2);
    transition: color 0.15s ease;
  }

  .detail-value.copyable:hover {
    color: #7289da;
    text-decoration: underline;
  }

  .name-value {
    font-family: inherit;
    font-weight: 500;
    font-size: 11px;
  }

  .block-value {
    font-family: inherit;
    font-size: 10px;
    color: var(--text-muted, #949ba4);
  }

  .category-badge {
    font-family: inherit;
    font-size: 10px;
    background: rgba(88, 101, 242, 0.15);
    color: var(--accent, #5865f2);
    padding: 1px 6px;
    border-radius: 3px;
  }

  /* Search Mode */
  .search-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .search-row {
    display: flex;
    gap: 6px;
  }

  .search-row input {
    flex: 1;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-color, #3f4147);
    border-radius: 6px;
    color: var(--text-primary, #f2f3f5);
    font-size: 13px;
    padding: 8px 12px;
  }

  .search-row input:focus {
    outline: none;
    border-color: var(--accent, #5865f2);
  }

  .search-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .results-count {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
  }

  .results-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 350px;
    overflow-y: auto;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    color: inherit;
  }

  .result-item:hover {
    border-color: var(--accent, #5865f2);
    background: rgba(88, 101, 242, 0.08);
  }

  .result-char {
    font-size: 20px;
    width: 32px;
    text-align: center;
  }

  .result-code {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 11px;
    color: var(--accent, #5865f2);
    min-width: 65px;
  }

  .result-name {
    font-size: 11px;
    color: var(--text-secondary, #b5bac1);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .no-results {
    text-align: center;
    color: var(--text-muted, #949ba4);
    padding: 20px;
    font-size: 13px;
  }

  /* Copy Feedback */
  .copy-feedback {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--success, #3ba55c);
    color: white;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    animation: fadeInOut 1.5s ease;
    pointer-events: none;
    z-index: 10;
  }

  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateX(-50%) translateY(8px); }
    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  @media (max-width: 400px) {
    .unicode-inspector {
      padding: 12px;
    }
    .palette-name {
      display: none;
    }
  }
</style>
