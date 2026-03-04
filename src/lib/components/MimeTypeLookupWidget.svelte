<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Comprehensive MIME type database
  const mimeTypes: Record<string, { mime: string; description: string; category: string }> = {
    // Images
    'jpg': { mime: 'image/jpeg', description: 'JPEG Image', category: 'Images' },
    'jpeg': { mime: 'image/jpeg', description: 'JPEG Image', category: 'Images' },
    'png': { mime: 'image/png', description: 'PNG Image', category: 'Images' },
    'gif': { mime: 'image/gif', description: 'GIF Image', category: 'Images' },
    'webp': { mime: 'image/webp', description: 'WebP Image', category: 'Images' },
    'svg': { mime: 'image/svg+xml', description: 'SVG Vector Image', category: 'Images' },
    'ico': { mime: 'image/x-icon', description: 'Icon Image', category: 'Images' },
    'bmp': { mime: 'image/bmp', description: 'Bitmap Image', category: 'Images' },
    'tiff': { mime: 'image/tiff', description: 'TIFF Image', category: 'Images' },
    'tif': { mime: 'image/tiff', description: 'TIFF Image', category: 'Images' },
    'avif': { mime: 'image/avif', description: 'AVIF Image', category: 'Images' },
    'heic': { mime: 'image/heic', description: 'HEIC Image', category: 'Images' },
    'heif': { mime: 'image/heif', description: 'HEIF Image', category: 'Images' },

    // Documents
    'pdf': { mime: 'application/pdf', description: 'PDF Document', category: 'Documents' },
    'doc': { mime: 'application/msword', description: 'Microsoft Word', category: 'Documents' },
    'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: 'Microsoft Word (OpenXML)', category: 'Documents' },
    'xls': { mime: 'application/vnd.ms-excel', description: 'Microsoft Excel', category: 'Documents' },
    'xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', description: 'Microsoft Excel (OpenXML)', category: 'Documents' },
    'ppt': { mime: 'application/vnd.ms-powerpoint', description: 'Microsoft PowerPoint', category: 'Documents' },
    'pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', description: 'Microsoft PowerPoint (OpenXML)', category: 'Documents' },
    'odt': { mime: 'application/vnd.oasis.opendocument.text', description: 'OpenDocument Text', category: 'Documents' },
    'ods': { mime: 'application/vnd.oasis.opendocument.spreadsheet', description: 'OpenDocument Spreadsheet', category: 'Documents' },
    'odp': { mime: 'application/vnd.oasis.opendocument.presentation', description: 'OpenDocument Presentation', category: 'Documents' },
    'rtf': { mime: 'application/rtf', description: 'Rich Text Format', category: 'Documents' },
    'txt': { mime: 'text/plain', description: 'Plain Text', category: 'Documents' },

    // Code & Data
    'html': { mime: 'text/html', description: 'HTML Document', category: 'Code' },
    'htm': { mime: 'text/html', description: 'HTML Document', category: 'Code' },
    'css': { mime: 'text/css', description: 'CSS Stylesheet', category: 'Code' },
    'js': { mime: 'text/javascript', description: 'JavaScript', category: 'Code' },
    'mjs': { mime: 'text/javascript', description: 'JavaScript Module', category: 'Code' },
    'ts': { mime: 'text/typescript', description: 'TypeScript', category: 'Code' },
    'tsx': { mime: 'text/tsx', description: 'TypeScript JSX', category: 'Code' },
    'jsx': { mime: 'text/jsx', description: 'JavaScript JSX', category: 'Code' },
    'json': { mime: 'application/json', description: 'JSON Data', category: 'Code' },
    'xml': { mime: 'application/xml', description: 'XML Document', category: 'Code' },
    'yaml': { mime: 'text/yaml', description: 'YAML Data', category: 'Code' },
    'yml': { mime: 'text/yaml', description: 'YAML Data', category: 'Code' },
    'toml': { mime: 'text/toml', description: 'TOML Configuration', category: 'Code' },
    'csv': { mime: 'text/csv', description: 'CSV Data', category: 'Code' },
    'md': { mime: 'text/markdown', description: 'Markdown', category: 'Code' },
    'markdown': { mime: 'text/markdown', description: 'Markdown', category: 'Code' },
    'py': { mime: 'text/x-python', description: 'Python', category: 'Code' },
    'rb': { mime: 'text/x-ruby', description: 'Ruby', category: 'Code' },
    'go': { mime: 'text/x-go', description: 'Go', category: 'Code' },
    'rs': { mime: 'text/x-rust', description: 'Rust', category: 'Code' },
    'java': { mime: 'text/x-java', description: 'Java', category: 'Code' },
    'c': { mime: 'text/x-c', description: 'C Source', category: 'Code' },
    'cpp': { mime: 'text/x-c++', description: 'C++ Source', category: 'Code' },
    'h': { mime: 'text/x-c', description: 'C Header', category: 'Code' },
    'hpp': { mime: 'text/x-c++', description: 'C++ Header', category: 'Code' },
    'php': { mime: 'text/x-php', description: 'PHP', category: 'Code' },
    'swift': { mime: 'text/x-swift', description: 'Swift', category: 'Code' },
    'kt': { mime: 'text/x-kotlin', description: 'Kotlin', category: 'Code' },
    'sql': { mime: 'application/sql', description: 'SQL', category: 'Code' },
    'sh': { mime: 'application/x-sh', description: 'Shell Script', category: 'Code' },
    'bash': { mime: 'application/x-sh', description: 'Bash Script', category: 'Code' },
    'ps1': { mime: 'application/x-powershell', description: 'PowerShell', category: 'Code' },
    'svelte': { mime: 'text/x-svelte', description: 'Svelte Component', category: 'Code' },
    'vue': { mime: 'text/x-vue', description: 'Vue Component', category: 'Code' },

    // Audio
    'mp3': { mime: 'audio/mpeg', description: 'MP3 Audio', category: 'Audio' },
    'wav': { mime: 'audio/wav', description: 'WAV Audio', category: 'Audio' },
    'ogg': { mime: 'audio/ogg', description: 'OGG Audio', category: 'Audio' },
    'flac': { mime: 'audio/flac', description: 'FLAC Audio', category: 'Audio' },
    'aac': { mime: 'audio/aac', description: 'AAC Audio', category: 'Audio' },
    'm4a': { mime: 'audio/mp4', description: 'M4A Audio', category: 'Audio' },
    'wma': { mime: 'audio/x-ms-wma', description: 'WMA Audio', category: 'Audio' },
    'opus': { mime: 'audio/opus', description: 'Opus Audio', category: 'Audio' },
    'mid': { mime: 'audio/midi', description: 'MIDI Audio', category: 'Audio' },
    'midi': { mime: 'audio/midi', description: 'MIDI Audio', category: 'Audio' },

    // Video
    'mp4': { mime: 'video/mp4', description: 'MP4 Video', category: 'Video' },
    'webm': { mime: 'video/webm', description: 'WebM Video', category: 'Video' },
    'mkv': { mime: 'video/x-matroska', description: 'Matroska Video', category: 'Video' },
    'avi': { mime: 'video/x-msvideo', description: 'AVI Video', category: 'Video' },
    'mov': { mime: 'video/quicktime', description: 'QuickTime Video', category: 'Video' },
    'wmv': { mime: 'video/x-ms-wmv', description: 'WMV Video', category: 'Video' },
    'flv': { mime: 'video/x-flv', description: 'Flash Video', category: 'Video' },
    'm4v': { mime: 'video/x-m4v', description: 'M4V Video', category: 'Video' },
    'mpeg': { mime: 'video/mpeg', description: 'MPEG Video', category: 'Video' },
    'mpg': { mime: 'video/mpeg', description: 'MPEG Video', category: 'Video' },
    '3gp': { mime: 'video/3gpp', description: '3GP Video', category: 'Video' },

    // Archives
    'zip': { mime: 'application/zip', description: 'ZIP Archive', category: 'Archives' },
    'rar': { mime: 'application/vnd.rar', description: 'RAR Archive', category: 'Archives' },
    '7z': { mime: 'application/x-7z-compressed', description: '7-Zip Archive', category: 'Archives' },
    'tar': { mime: 'application/x-tar', description: 'TAR Archive', category: 'Archives' },
    'gz': { mime: 'application/gzip', description: 'GZip Archive', category: 'Archives' },
    'bz2': { mime: 'application/x-bzip2', description: 'BZip2 Archive', category: 'Archives' },
    'xz': { mime: 'application/x-xz', description: 'XZ Archive', category: 'Archives' },
    'tgz': { mime: 'application/gzip', description: 'Tarball (gzipped)', category: 'Archives' },

    // Fonts
    'woff': { mime: 'font/woff', description: 'WOFF Font', category: 'Fonts' },
    'woff2': { mime: 'font/woff2', description: 'WOFF2 Font', category: 'Fonts' },
    'ttf': { mime: 'font/ttf', description: 'TrueType Font', category: 'Fonts' },
    'otf': { mime: 'font/otf', description: 'OpenType Font', category: 'Fonts' },
    'eot': { mime: 'application/vnd.ms-fontobject', description: 'Embedded OpenType', category: 'Fonts' },

    // Executables & Binaries
    'exe': { mime: 'application/vnd.microsoft.portable-executable', description: 'Windows Executable', category: 'Executables' },
    'msi': { mime: 'application/x-msi', description: 'Windows Installer', category: 'Executables' },
    'dmg': { mime: 'application/x-apple-diskimage', description: 'macOS Disk Image', category: 'Executables' },
    'pkg': { mime: 'application/x-newton-compatible-pkg', description: 'macOS Package', category: 'Executables' },
    'deb': { mime: 'application/vnd.debian.binary-package', description: 'Debian Package', category: 'Executables' },
    'rpm': { mime: 'application/x-rpm', description: 'RPM Package', category: 'Executables' },
    'apk': { mime: 'application/vnd.android.package-archive', description: 'Android Package', category: 'Executables' },
    'appimage': { mime: 'application/x-iso9660-appimage', description: 'AppImage', category: 'Executables' },
    'jar': { mime: 'application/java-archive', description: 'Java Archive', category: 'Executables' },
    'wasm': { mime: 'application/wasm', description: 'WebAssembly', category: 'Executables' },

    // Other
    'ics': { mime: 'text/calendar', description: 'Calendar Event', category: 'Other' },
    'vcf': { mime: 'text/vcard', description: 'vCard Contact', category: 'Other' },
    'eml': { mime: 'message/rfc822', description: 'Email Message', category: 'Other' },
    'pem': { mime: 'application/x-pem-file', description: 'PEM Certificate', category: 'Other' },
    'crt': { mime: 'application/x-x509-ca-cert', description: 'Certificate', category: 'Other' },
    'key': { mime: 'application/x-pem-file', description: 'Private Key', category: 'Other' },
  };

  let searchQuery = '';
  let searchMode: 'extension' | 'mime' = 'extension';
  let copiedField: string | null = null;

  // Get all unique categories
  const categories = [...new Set(Object.values(mimeTypes).map(m => m.category))].sort();

  // Filter results based on search
  $: filteredResults = (() => {
    const query = searchQuery.toLowerCase().replace(/^\./, '');
    if (!query) return [];

    if (searchMode === 'extension') {
      // Search by extension
      return Object.entries(mimeTypes)
        .filter(([ext]) => ext.includes(query))
        .map(([ext, info]) => ({ ext, ...info }))
        .slice(0, 20);
    } else {
      // Search by MIME type
      return Object.entries(mimeTypes)
        .filter(([, info]) => info.mime.toLowerCase().includes(query))
        .map(([ext, info]) => ({ ext, ...info }))
        .slice(0, 20);
    }
  })();

  // Get extensions grouped by category for browsing
  function getExtensionsByCategory(category: string) {
    return Object.entries(mimeTypes)
      .filter(([, info]) => info.category === category)
      .map(([ext, info]) => ({ ext, ...info }))
      .sort((a, b) => a.ext.localeCompare(b.ext));
  }

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedField = field;
      setTimeout(() => {
        copiedField = null;
      }, 1500);
      dispatch('copy', { text, field });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      'Images': '🖼️',
      'Documents': '📄',
      'Code': '💻',
      'Audio': '🎵',
      'Video': '🎬',
      'Archives': '📦',
      'Fonts': '🔤',
      'Executables': '⚙️',
      'Other': '📎'
    };
    return icons[category] || '📁';
  }

  let browseCategory: string | null = null;
</script>

<div class="mime-lookup-widget">
  <div class="widget-header">
    <h3>🔍 MIME Type Lookup</h3>
  </div>

  <div class="search-section">
    <div class="search-mode">
      <button
        class="mode-btn"
        class:active={searchMode === 'extension'}
        on:click={() => searchMode = 'extension'}
      >
        By Extension
      </button>
      <button
        class="mode-btn"
        class:active={searchMode === 'mime'}
        on:click={() => searchMode = 'mime'}
      >
        By MIME Type
      </button>
    </div>

    <div class="search-input-wrapper">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={searchMode === 'extension' ? 'Search extension (e.g., jpg, png, mp4)...' : 'Search MIME type (e.g., image/jpeg)...'}
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-btn" on:click={() => searchQuery = ''}>✕</button>
      {/if}
    </div>
  </div>

  {#if searchQuery && filteredResults.length > 0}
    <div class="results-section">
      <div class="results-header">
        Found {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
      </div>
      <div class="results-list">
        {#each filteredResults as result}
          <div class="result-item">
            <div class="result-main">
              <span class="category-icon">{getCategoryIcon(result.category)}</span>
              <span class="extension">.{result.ext}</span>
              <span class="description">{result.description}</span>
            </div>
            <div class="result-mime">
              <code class="mime-type">{result.mime}</code>
              <button
                class="copy-btn"
                class:copied={copiedField === `mime-${result.ext}`}
                on:click={() => copyToClipboard(result.mime, `mime-${result.ext}`)}
                title="Copy MIME type"
              >
                {copiedField === `mime-${result.ext}` ? '✓' : '📋'}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if searchQuery}
    <div class="no-results">
      <span class="no-results-icon">🔎</span>
      <span>No matches found for "{searchQuery}"</span>
    </div>
  {:else}
    <div class="browse-section">
      <div class="browse-header">Browse by Category</div>
      <div class="categories-grid">
        {#each categories as category}
          <button
            class="category-btn"
            class:active={browseCategory === category}
            on:click={() => browseCategory = browseCategory === category ? null : category}
          >
            <span class="category-icon">{getCategoryIcon(category)}</span>
            <span class="category-name">{category}</span>
            <span class="category-count">{getExtensionsByCategory(category).length}</span>
          </button>
        {/each}
      </div>

      {#if browseCategory}
        <div class="category-extensions">
          <div class="category-title">
            {getCategoryIcon(browseCategory)} {browseCategory}
          </div>
          <div class="extensions-grid">
            {#each getExtensionsByCategory(browseCategory) as item}
              <div class="extension-card">
                <div class="ext-header">
                  <span class="ext-name">.{item.ext}</span>
                  <button
                    class="copy-btn-small"
                    class:copied={copiedField === `ext-${item.ext}`}
                    on:click={() => copyToClipboard(item.mime, `ext-${item.ext}`)}
                    title="Copy MIME type"
                  >
                    {copiedField === `ext-${item.ext}` ? '✓' : '📋'}
                  </button>
                </div>
                <div class="ext-desc">{item.description}</div>
                <code class="ext-mime">{item.mime}</code>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <div class="widget-footer">
    <span class="stats">{Object.keys(mimeTypes).length} extensions indexed</span>
  </div>
</div>

<style>
  .mime-lookup-widget {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--widget-bg, #1e1e2e);
    border-radius: 12px;
    color: var(--widget-text, #cdd6f4);
    font-family: system-ui, -apple-system, sans-serif;
    max-height: 600px;
    overflow: hidden;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--widget-heading, #f5c2e7);
  }

  .search-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-mode {
    display: flex;
    gap: 0.5rem;
  }

  .mode-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 1px solid var(--widget-border, #45475a);
    background: var(--widget-input-bg, #313244);
    color: var(--widget-text, #cdd6f4);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: var(--widget-hover, #3d3d55);
  }

  .mode-btn.active {
    background: var(--widget-accent, #89b4fa);
    color: var(--widget-accent-text, #1e1e2e);
    border-color: var(--widget-accent, #89b4fa);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    border: 1px solid var(--widget-border, #45475a);
    background: var(--widget-input-bg, #313244);
    color: var(--widget-text, #cdd6f4);
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: var(--widget-accent, #89b4fa);
  }

  .search-input::placeholder {
    color: var(--widget-placeholder, #6c7086);
  }

  .clear-btn {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: var(--widget-placeholder, #6c7086);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.25rem;
  }

  .clear-btn:hover {
    color: var(--widget-text, #cdd6f4);
  }

  .results-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow: hidden;
  }

  .results-header {
    font-size: 0.8rem;
    color: var(--widget-muted, #a6adc8);
    padding: 0 0.25rem;
  }

  .results-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    max-height: 350px;
    padding-right: 0.5rem;
  }

  .result-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--widget-item-bg, #313244);
    border-radius: 8px;
    border: 1px solid var(--widget-border, #45475a);
  }

  .result-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .category-icon {
    font-size: 1rem;
  }

  .extension {
    font-weight: 600;
    color: var(--widget-accent, #89b4fa);
    font-family: 'SF Mono', 'Consolas', monospace;
  }

  .description {
    color: var(--widget-muted, #a6adc8);
    font-size: 0.85rem;
  }

  .result-mime {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mime-type {
    flex: 1;
    padding: 0.4rem 0.6rem;
    background: var(--widget-code-bg, #1e1e2e);
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--widget-code, #94e2d5);
    font-family: 'SF Mono', 'Consolas', monospace;
    word-break: break-all;
  }

  .copy-btn, .copy-btn-small {
    padding: 0.4rem 0.6rem;
    background: var(--widget-btn-bg, #45475a);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .copy-btn:hover, .copy-btn-small:hover {
    background: var(--widget-btn-hover, #585b70);
  }

  .copy-btn.copied, .copy-btn-small.copied {
    background: var(--widget-success, #a6e3a1);
    color: var(--widget-success-text, #1e1e2e);
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--widget-muted, #a6adc8);
  }

  .no-results-icon {
    font-size: 2rem;
    opacity: 0.5;
  }

  .browse-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: hidden;
  }

  .browse-header {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--widget-muted, #a6adc8);
  }

  .categories-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .category-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background: var(--widget-item-bg, #313244);
    border: 1px solid var(--widget-border, #45475a);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-btn:hover {
    background: var(--widget-hover, #3d3d55);
  }

  .category-btn.active {
    border-color: var(--widget-accent, #89b4fa);
    background: var(--widget-accent-bg, rgba(137, 180, 250, 0.1));
  }

  .category-name {
    font-size: 0.75rem;
    color: var(--widget-text, #cdd6f4);
  }

  .category-count {
    font-size: 0.7rem;
    color: var(--widget-muted, #6c7086);
  }

  .category-extensions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow: hidden;
    flex: 1;
  }

  .category-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--widget-heading, #f5c2e7);
    padding: 0.25rem 0;
  }

  .extensions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    overflow-y: auto;
    max-height: 200px;
    padding-right: 0.5rem;
  }

  .extension-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.6rem;
    background: var(--widget-item-bg, #313244);
    border-radius: 6px;
    border: 1px solid var(--widget-border, #45475a);
  }

  .ext-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .ext-name {
    font-weight: 600;
    color: var(--widget-accent, #89b4fa);
    font-family: 'SF Mono', 'Consolas', monospace;
    font-size: 0.9rem;
  }

  .copy-btn-small {
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
  }

  .ext-desc {
    font-size: 0.75rem;
    color: var(--widget-muted, #a6adc8);
  }

  .ext-mime {
    font-size: 0.7rem;
    color: var(--widget-code, #94e2d5);
    font-family: 'SF Mono', 'Consolas', monospace;
    word-break: break-all;
  }

  .widget-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 0.5rem;
    border-top: 1px solid var(--widget-border, #45475a);
  }

  .stats {
    font-size: 0.75rem;
    color: var(--widget-muted, #6c7086);
  }

  /* Scrollbar styling */
  .results-list::-webkit-scrollbar,
  .extensions-grid::-webkit-scrollbar {
    width: 6px;
  }

  .results-list::-webkit-scrollbar-track,
  .extensions-grid::-webkit-scrollbar-track {
    background: var(--widget-bg, #1e1e2e);
    border-radius: 3px;
  }

  .results-list::-webkit-scrollbar-thumb,
  .extensions-grid::-webkit-scrollbar-thumb {
    background: var(--widget-border, #45475a);
    border-radius: 3px;
  }

  .results-list::-webkit-scrollbar-thumb:hover,
  .extensions-grid::-webkit-scrollbar-thumb:hover {
    background: var(--widget-muted, #6c7086);
  }
</style>
