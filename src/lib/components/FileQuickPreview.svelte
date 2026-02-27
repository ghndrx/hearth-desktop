<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';

  const dispatch = createEventDispatcher<{
    close: void;
    open: { path: string };
    share: { path: string };
    copyPath: { path: string };
    error: { message: string };
  }>();

  // Props
  export let filePath: string = '';
  export let show: boolean = false;
  export let position: { x: number; y: number } | null = null;
  export let maxWidth: number = 400;
  export let maxHeight: number = 300;
  export let showActions: boolean = true;
  export let autoClose: boolean = true;
  export let autoCloseDelay: number = 5000;

  // State
  let previewData: PreviewData | null = null;
  let loading: boolean = false;
  let error: string | null = null;
  let containerEl: HTMLDivElement;
  let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let unlistenFn: UnlistenFn | null = null;

  interface PreviewData {
    type: 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'code' | 'archive' | 'unknown';
    fileName: string;
    fileSize: number;
    fileSizeFormatted: string;
    mimeType: string;
    extension: string;
    modifiedDate: string;
    previewUrl?: string;
    textContent?: string;
    metadata?: Record<string, string>;
    thumbnailUrl?: string;
    duration?: number;
    dimensions?: { width: number; height: number };
    archiveContents?: string[];
    lineCount?: number;
  }

  // Format file size
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format duration
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get file type icon
  function getFileTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      image: '🖼️',
      video: '🎬',
      audio: '🎵',
      text: '📄',
      pdf: '📕',
      code: '💻',
      archive: '📦',
      unknown: '📁',
    };
    return icons[type] || icons.unknown;
  }

  // Get syntax highlighting class for code files
  function getCodeLanguage(extension: string): string {
    const languages: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      jsx: 'javascript',
      tsx: 'typescript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      md: 'markdown',
      sh: 'bash',
      sql: 'sql',
      svelte: 'svelte',
      vue: 'vue',
    };
    return languages[extension.toLowerCase()] || 'plaintext';
  }

  // Load preview data
  async function loadPreview(): Promise<void> {
    if (!filePath) {
      error = 'No file path provided';
      return;
    }

    loading = true;
    error = null;
    previewData = null;

    try {
      // Try to get preview data from Tauri backend
      const data = await invoke<PreviewData>('get_file_preview', {
        path: filePath,
        maxWidth,
        maxHeight,
      });
      
      previewData = {
        ...data,
        fileSizeFormatted: formatFileSize(data.fileSize),
      };
    } catch (err) {
      // Fallback: construct basic preview from file info
      try {
        const fileInfo = await invoke<{
          name: string;
          size: number;
          modified: string;
          extension: string;
          mimeType: string;
        }>('get_file_info', { path: filePath });

        const type = determineFileType(fileInfo.mimeType, fileInfo.extension);
        
        previewData = {
          type,
          fileName: fileInfo.name,
          fileSize: fileInfo.size,
          fileSizeFormatted: formatFileSize(fileInfo.size),
          mimeType: fileInfo.mimeType,
          extension: fileInfo.extension,
          modifiedDate: fileInfo.modified,
        };

        // For small text files, try to read content
        if (type === 'text' || type === 'code') {
          if (fileInfo.size < 100000) {
            try {
              const content = await invoke<string>('read_file_preview', {
                path: filePath,
                maxBytes: 10000,
              });
              previewData.textContent = content;
              previewData.lineCount = content.split('\n').length;
            } catch {
              // Ignore read errors
            }
          }
        }
      } catch (infoErr) {
        error = `Failed to load preview: ${infoErr}`;
      }
    } finally {
      loading = false;
    }

    // Start auto-close timer if enabled
    if (autoClose && show) {
      startAutoCloseTimer();
    }
  }

  // Determine file type from mime type and extension
  function determineFileType(
    mimeType: string,
    extension: string
  ): PreviewData['type'] {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('text/')) return 'text';
    
    const codeExtensions = [
      'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c',
      'cs', 'php', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'md',
      'sh', 'sql', 'svelte', 'vue',
    ];
    if (codeExtensions.includes(extension.toLowerCase())) return 'code';
    
    const archiveExtensions = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'];
    if (archiveExtensions.includes(extension.toLowerCase())) return 'archive';
    
    return 'unknown';
  }

  // Auto-close timer management
  function startAutoCloseTimer(): void {
    clearAutoCloseTimer();
    autoCloseTimer = setTimeout(() => {
      handleClose();
    }, autoCloseDelay);
  }

  function clearAutoCloseTimer(): void {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  // Reset timer on mouse enter
  function handleMouseEnter(): void {
    clearAutoCloseTimer();
  }

  // Restart timer on mouse leave
  function handleMouseLeave(): void {
    if (autoClose && show) {
      startAutoCloseTimer();
    }
  }

  // Actions
  function handleClose(): void {
    clearAutoCloseTimer();
    dispatch('close');
  }

  async function handleOpen(): Promise<void> {
    try {
      await invoke('open_file_default', { path: filePath });
      dispatch('open', { path: filePath });
      handleClose();
    } catch (err) {
      dispatch('error', { message: `Failed to open file: ${err}` });
    }
  }

  async function handleShare(): Promise<void> {
    try {
      await invoke('share_file', { path: filePath });
      dispatch('share', { path: filePath });
    } catch (err) {
      dispatch('error', { message: `Failed to share file: ${err}` });
    }
  }

  async function handleCopyPath(): Promise<void> {
    try {
      await navigator.clipboard.writeText(filePath);
      dispatch('copyPath', { path: filePath });
    } catch (err) {
      dispatch('error', { message: `Failed to copy path: ${err}` });
    }
  }

  async function handleRevealInFinder(): Promise<void> {
    try {
      await invoke('reveal_in_file_manager', { path: filePath });
    } catch (err) {
      dispatch('error', { message: `Failed to reveal file: ${err}` });
    }
  }

  // Handle keyboard events
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter') {
      handleOpen();
    } else if (event.key === ' ') {
      event.preventDefault();
      handleOpen();
    }
  }

  // Handle click outside
  function handleClickOutside(event: MouseEvent): void {
    if (containerEl && !containerEl.contains(event.target as Node)) {
      handleClose();
    }
  }

  // Position calculation
  function getPositionStyle(): string {
    if (!position) {
      return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
    }
    
    // Ensure preview stays within viewport
    const padding = 20;
    let x = position.x;
    let y = position.y;
    
    if (typeof window !== 'undefined') {
      if (x + maxWidth > window.innerWidth - padding) {
        x = window.innerWidth - maxWidth - padding;
      }
      if (y + maxHeight > window.innerHeight - padding) {
        y = window.innerHeight - maxHeight - padding;
      }
      if (x < padding) x = padding;
      if (y < padding) y = padding;
    }
    
    return `top: ${y}px; left: ${x}px;`;
  }

  // Setup and teardown
  onMount(async () => {
    if (show && filePath) {
      await loadPreview();
    }

    // Listen for file changes
    unlistenFn = await listen('file-changed', (event: { payload: string }) => {
      if (event.payload === filePath) {
        loadPreview();
      }
    });

    // Add global click listener for click-outside detection
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    clearAutoCloseTimer();
    if (unlistenFn) {
      unlistenFn();
    }
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Reactive: reload preview when file path changes
  $: if (show && filePath) {
    loadPreview();
  }
</script>

{#if show}
  <div
    bind:this={containerEl}
    class="file-quick-preview"
    class:loading
    style="{getPositionStyle()} max-width: {maxWidth}px; max-height: {maxHeight}px;"
    role="dialog"
    aria-label="File preview"
    aria-busy={loading}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
  >
    <!-- Header -->
    <div class="preview-header">
      {#if previewData}
        <span class="file-icon">{getFileTypeIcon(previewData.type)}</span>
        <span class="file-name" title={previewData.fileName}>
          {previewData.fileName}
        </span>
      {:else if loading}
        <span class="file-icon">📁</span>
        <span class="file-name">Loading...</span>
      {:else}
        <span class="file-icon">❓</span>
        <span class="file-name">Unknown file</span>
      {/if}
      <button
        class="close-button"
        on:click={handleClose}
        aria-label="Close preview"
      >
        ✕
      </button>
    </div>

    <!-- Content -->
    <div class="preview-content">
      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading preview...</span>
        </div>
      {:else if error}
        <div class="error-state">
          <span class="error-icon">⚠️</span>
          <span class="error-message">{error}</span>
        </div>
      {:else if previewData}
        <!-- Image Preview -->
        {#if previewData.type === 'image' && previewData.previewUrl}
          <div class="image-preview">
            <img
              src={previewData.previewUrl}
              alt={previewData.fileName}
              style="max-width: 100%; max-height: {maxHeight - 100}px;"
            />
            {#if previewData.dimensions}
              <div class="image-dimensions">
                {previewData.dimensions.width} × {previewData.dimensions.height}
              </div>
            {/if}
          </div>
        
        <!-- Video Preview -->
        {:else if previewData.type === 'video'}
          <div class="video-preview">
            {#if previewData.thumbnailUrl}
              <img
                src={previewData.thumbnailUrl}
                alt="Video thumbnail"
                class="video-thumbnail"
              />
            {:else}
              <div class="video-placeholder">
                <span class="play-icon">▶️</span>
              </div>
            {/if}
            {#if previewData.duration}
              <div class="video-duration">
                {formatDuration(previewData.duration)}
              </div>
            {/if}
          </div>
        
        <!-- Audio Preview -->
        {:else if previewData.type === 'audio'}
          <div class="audio-preview">
            <div class="audio-icon">🎵</div>
            {#if previewData.metadata}
              <div class="audio-metadata">
                {#if previewData.metadata.title}
                  <div class="audio-title">{previewData.metadata.title}</div>
                {/if}
                {#if previewData.metadata.artist}
                  <div class="audio-artist">{previewData.metadata.artist}</div>
                {/if}
                {#if previewData.metadata.album}
                  <div class="audio-album">{previewData.metadata.album}</div>
                {/if}
              </div>
            {/if}
            {#if previewData.duration}
              <div class="audio-duration">{formatDuration(previewData.duration)}</div>
            {/if}
          </div>
        
        <!-- Text/Code Preview -->
        {:else if (previewData.type === 'text' || previewData.type === 'code') && previewData.textContent}
          <div class="text-preview">
            <pre class="code-block language-{getCodeLanguage(previewData.extension)}">{previewData.textContent}</pre>
            {#if previewData.lineCount}
              <div class="line-count">{previewData.lineCount} lines</div>
            {/if}
          </div>
        
        <!-- Archive Preview -->
        {:else if previewData.type === 'archive' && previewData.archiveContents}
          <div class="archive-preview">
            <ul class="archive-contents">
              {#each previewData.archiveContents.slice(0, 10) as item}
                <li>{item}</li>
              {/each}
              {#if previewData.archiveContents.length > 10}
                <li class="more-items">
                  ... and {previewData.archiveContents.length - 10} more items
                </li>
              {/if}
            </ul>
          </div>
        
        <!-- PDF Preview -->
        {:else if previewData.type === 'pdf' && previewData.thumbnailUrl}
          <div class="pdf-preview">
            <img
              src={previewData.thumbnailUrl}
              alt="PDF preview"
              class="pdf-thumbnail"
            />
          </div>
        
        <!-- Unknown/Default Preview -->
        {:else}
          <div class="generic-preview">
            <div class="file-type-icon">{getFileTypeIcon(previewData.type)}</div>
            <div class="file-extension">.{previewData.extension.toUpperCase()}</div>
          </div>
        {/if}

        <!-- File Info -->
        <div class="file-info">
          <div class="info-row">
            <span class="info-label">Size:</span>
            <span class="info-value">{previewData.fileSizeFormatted}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">{previewData.mimeType || previewData.extension}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Modified:</span>
            <span class="info-value">{previewData.modifiedDate}</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    {#if showActions && previewData && !loading && !error}
      <div class="preview-actions">
        <button class="action-button primary" on:click={handleOpen}>
          <span class="action-icon">📂</span>
          Open
        </button>
        <button class="action-button" on:click={handleRevealInFinder}>
          <span class="action-icon">📍</span>
          Reveal
        </button>
        <button class="action-button" on:click={handleShare}>
          <span class="action-icon">📤</span>
          Share
        </button>
        <button class="action-button" on:click={handleCopyPath}>
          <span class="action-icon">📋</span>
          Copy Path
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .file-quick-preview {
    position: fixed;
    z-index: 9999;
    background: var(--bg-primary, #1e1e2e);
    border: 1px solid var(--border-color, #313244);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .preview-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary, #181825);
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .file-icon {
    font-size: 1.2em;
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close-button {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #a6adc8);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background: var(--bg-hover, #313244);
    color: var(--text-primary, #cdd6f4);
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    padding: 16px;
    min-height: 100px;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    color: var(--text-secondary, #a6adc8);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #313244);
    border-top-color: var(--accent, #89b4fa);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-icon {
    font-size: 2em;
  }

  .error-message {
    text-align: center;
    font-size: 0.9em;
  }

  .image-preview,
  .video-preview,
  .pdf-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .image-preview img,
  .video-thumbnail,
  .pdf-thumbnail {
    border-radius: 8px;
    max-width: 100%;
    object-fit: contain;
  }

  .image-dimensions,
  .video-duration,
  .audio-duration {
    font-size: 0.85em;
    color: var(--text-secondary, #a6adc8);
    background: var(--bg-secondary, #181825);
    padding: 4px 8px;
    border-radius: 4px;
  }

  .video-placeholder {
    width: 100%;
    height: 150px;
    background: var(--bg-secondary, #181825);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-icon {
    font-size: 3em;
  }

  .audio-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px;
  }

  .audio-icon {
    font-size: 3em;
  }

  .audio-metadata {
    text-align: center;
  }

  .audio-title {
    font-weight: 600;
    color: var(--text-primary, #cdd6f4);
  }

  .audio-artist,
  .audio-album {
    font-size: 0.9em;
    color: var(--text-secondary, #a6adc8);
  }

  .text-preview {
    position: relative;
  }

  .code-block {
    background: var(--bg-secondary, #181825);
    padding: 12px;
    border-radius: 8px;
    overflow: auto;
    max-height: 200px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.85em;
    line-height: 1.5;
    color: var(--text-primary, #cdd6f4);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .line-count {
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 0.75em;
    color: var(--text-secondary, #a6adc8);
    background: var(--bg-primary, #1e1e2e);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .archive-preview {
    background: var(--bg-secondary, #181825);
    border-radius: 8px;
    padding: 12px;
  }

  .archive-contents {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.9em;
  }

  .archive-contents li {
    padding: 4px 0;
    color: var(--text-primary, #cdd6f4);
    border-bottom: 1px solid var(--border-color, #313244);
  }

  .archive-contents li:last-child {
    border-bottom: none;
  }

  .more-items {
    color: var(--text-secondary, #a6adc8);
    font-style: italic;
  }

  .generic-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    gap: 8px;
  }

  .file-type-icon {
    font-size: 4em;
  }

  .file-extension {
    font-weight: 700;
    color: var(--text-secondary, #a6adc8);
    font-size: 1.2em;
  }

  .file-info {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color, #313244);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 0.9em;
  }

  .info-label {
    color: var(--text-secondary, #a6adc8);
  }

  .info-value {
    color: var(--text-primary, #cdd6f4);
    font-weight: 500;
  }

  .preview-actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-secondary, #181825);
    border-top: 1px solid var(--border-color, #313244);
    flex-wrap: wrap;
  }

  .action-button {
    flex: 1;
    min-width: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #313244);
    background: var(--bg-primary, #1e1e2e);
    color: var(--text-primary, #cdd6f4);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .action-button:hover {
    background: var(--bg-hover, #313244);
    border-color: var(--accent, #89b4fa);
  }

  .action-button.primary {
    background: var(--accent, #89b4fa);
    color: var(--bg-primary, #1e1e2e);
    border-color: var(--accent, #89b4fa);
  }

  .action-button.primary:hover {
    background: var(--accent-hover, #b4befe);
  }

  .action-icon {
    font-size: 1.1em;
  }

  /* Loading state styles */
  .file-quick-preview.loading {
    pointer-events: none;
  }
</style>
