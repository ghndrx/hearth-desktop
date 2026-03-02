<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';

  interface Props {
    compact?: boolean;
    onClose?: () => void;
  }

  let { compact = false, onClose }: Props = $props();

  interface HashResult {
    md5: string;
    sha1: string;
    sha256: string;
    sha512: string;
    fileSize: number;
    fileName: string;
  }

  let selectedFile = $state<File | null>(null);
  let filePath = $state<string | null>(null);
  let hashResult = $state<HashResult | null>(null);
  let isHashing = $state(false);
  let progress = $state(0);
  let error = $state<string | null>(null);
  let copyFeedback = $state<string | null>(null);
  let verifyHash = $state('');
  let verifyResult = $state<'match' | 'mismatch' | null>(null);
  let showAllHashes = $state(false);

  async function selectFile() {
    try {
      // Try Tauri dialog first
      const selected = await open({
        multiple: false,
        title: 'Select file to hash',
      });

      if (selected) {
        filePath = selected as string;
        selectedFile = null;
        await computeHashesFromPath(filePath);
      }
    } catch {
      // Fallback to browser file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          selectedFile = file;
          filePath = null;
          await computeHashesFromFile(file);
        }
      };
      input.click();
    }
  }

  async function computeHashesFromPath(path: string) {
    isHashing = true;
    error = null;
    progress = 0;
    verifyResult = null;

    try {
      const result = await invoke<HashResult>('compute_file_hashes', { path });
      hashResult = result;
      progress = 100;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to compute hashes';
      hashResult = null;
    } finally {
      isHashing = false;
    }
  }

  async function computeHashesFromFile(file: File) {
    isHashing = true;
    error = null;
    progress = 0;
    verifyResult = null;

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Compute hashes using Web Crypto API
      const [md5, sha1, sha256, sha512] = await Promise.all([
        computeMD5(data),
        computeHash(data, 'SHA-1'),
        computeHash(data, 'SHA-256'),
        computeHash(data, 'SHA-512'),
      ]);

      hashResult = {
        md5,
        sha1,
        sha256,
        sha512,
        fileSize: file.size,
        fileName: file.name,
      };
      progress = 100;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to compute hashes';
      hashResult = null;
    } finally {
      isHashing = false;
    }
  }

  async function computeHash(data: Uint8Array, algorithm: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    return bufferToHex(hashBuffer);
  }

  // MD5 is not supported by Web Crypto API, so we use a simple implementation
  async function computeMD5(data: Uint8Array): Promise<string> {
    // Use a simple hash for demo - in production use a proper MD5 library
    // For now, return a placeholder or use SubtleCrypto workaround
    try {
      // Try Tauri backend
      const hash = await invoke<string>('compute_md5', { data: Array.from(data) });
      return hash;
    } catch {
      // Fallback: indicate MD5 not available
      return '(MD5 not available in browser)';
    }
  }

  function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  async function copyHash(hash: string, label: string) {
    try {
      await navigator.clipboard.writeText(hash);
      copyFeedback = `${label} copied!`;
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    } catch {
      copyFeedback = 'Copy failed';
      setTimeout(() => {
        copyFeedback = null;
      }, 2000);
    }
  }

  function verifyAgainstHash() {
    if (!hashResult || !verifyHash.trim()) {
      verifyResult = null;
      return;
    }

    const normalizedInput = verifyHash.toLowerCase().trim();
    const hashes = [
      hashResult.md5.toLowerCase(),
      hashResult.sha1.toLowerCase(),
      hashResult.sha256.toLowerCase(),
      hashResult.sha512.toLowerCase(),
    ];

    verifyResult = hashes.includes(normalizedInput) ? 'match' : 'mismatch';
  }

  function clearAll() {
    selectedFile = null;
    filePath = null;
    hashResult = null;
    error = null;
    progress = 0;
    verifyHash = '';
    verifyResult = null;
  }

  // Re-verify when input changes
  $effect(() => {
    if (verifyHash && hashResult) {
      verifyAgainstHash();
    } else {
      verifyResult = null;
    }
  });
</script>

<div class="hash-widget" class:compact>
  <div class="widget-header">
    <div class="title">
      <span class="icon">🔒</span>
      <span class="label">File Hash Calculator</span>
    </div>
    <div class="actions">
      {#if hashResult}
        <button class="action-btn" onclick={clearAll} title="Clear">🗑️</button>
      {/if}
      {#if onClose}
        <button class="action-btn" onclick={onClose} title="Close">×</button>
      {/if}
    </div>
  </div>

  <div class="content">
    <!-- File Selection -->
    <div class="file-section">
      <button class="select-btn" onclick={selectFile} disabled={isHashing}>
        {isHashing ? 'Hashing...' : 'Select File'}
      </button>
      
      {#if hashResult}
        <div class="file-info">
          <span class="file-name">{hashResult.fileName}</span>
          <span class="file-size">{formatFileSize(hashResult.fileSize)}</span>
        </div>
      {/if}
    </div>

    <!-- Progress -->
    {#if isHashing}
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        <span class="progress-text">Computing hashes...</span>
      </div>
    {/if}

    <!-- Error -->
    {#if error}
      <div class="error">{error}</div>
    {/if}

    <!-- Hash Results -->
    {#if hashResult}
      <div class="hashes-section">
        <div class="hash-row">
          <span class="hash-label">SHA-256</span>
          <button 
            class="hash-value"
            onclick={() => copyHash(hashResult!.sha256, 'SHA-256')}
            title="Click to copy"
          >
            {compact ? hashResult.sha256.substring(0, 16) + '...' : hashResult.sha256}
          </button>
        </div>

        {#if showAllHashes || !compact}
          <div class="hash-row">
            <span class="hash-label">SHA-1</span>
            <button 
              class="hash-value"
              onclick={() => copyHash(hashResult!.sha1, 'SHA-1')}
              title="Click to copy"
            >
              {compact ? hashResult.sha1.substring(0, 16) + '...' : hashResult.sha1}
            </button>
          </div>

          <div class="hash-row">
            <span class="hash-label">MD5</span>
            <button 
              class="hash-value"
              onclick={() => copyHash(hashResult!.md5, 'MD5')}
              title="Click to copy"
            >
              {compact ? hashResult.md5.substring(0, 16) + '...' : hashResult.md5}
            </button>
          </div>

          <div class="hash-row">
            <span class="hash-label">SHA-512</span>
            <button 
              class="hash-value"
              onclick={() => copyHash(hashResult!.sha512, 'SHA-512')}
              title="Click to copy"
            >
              {hashResult.sha512.substring(0, compact ? 16 : 32)}...
            </button>
          </div>
        {:else}
          <button class="show-more" onclick={() => showAllHashes = true}>
            Show all hashes
          </button>
        {/if}
      </div>

      <!-- Verify Section -->
      <div class="verify-section">
        <label class="verify-label">Verify hash</label>
        <div class="verify-input-row">
          <input 
            type="text" 
            class="verify-input"
            class:match={verifyResult === 'match'}
            class:mismatch={verifyResult === 'mismatch'}
            bind:value={verifyHash}
            placeholder="Paste hash to verify..."
          />
          {#if verifyResult}
            <span class="verify-icon">
              {verifyResult === 'match' ? '✓' : '✗'}
            </span>
          {/if}
        </div>
        {#if verifyResult}
          <div class="verify-result" class:match={verifyResult === 'match'}>
            {verifyResult === 'match' ? 'Hash matches!' : 'Hash does not match'}
          </div>
        {/if}
      </div>
    {/if}

    {#if copyFeedback}
      <div class="feedback">{copyFeedback}</div>
    {/if}
  </div>
</div>

<style>
  .hash-widget {
    background: var(--background-secondary, #2f3136);
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    width: 100%;
    max-width: 400px;
  }

  .hash-widget.compact {
    padding: 8px;
    max-width: 280px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: var(--text-normal, #dcddde);
  }

  .icon {
    font-size: 16px;
  }

  .actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--text-muted, #72767d);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.4));
    color: var(--text-normal, #dcddde);
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .file-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .select-btn {
    background: var(--brand-experiment, #5865f2);
    border: none;
    border-radius: 4px;
    padding: 10px 16px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .select-btn:hover:not(:disabled) {
    background: var(--brand-experiment-560, #4752c4);
  }

  .select-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }

  .file-name {
    color: var(--text-normal, #dcddde);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .file-size {
    color: var(--text-muted, #72767d);
    font-size: 11px;
    margin-left: 8px;
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-bar {
    height: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--brand-experiment, #5865f2);
    transition: width 0.2s ease;
  }

  .progress-text {
    font-size: 11px;
    color: var(--text-muted, #72767d);
    text-align: center;
  }

  .error {
    color: var(--text-danger, #ed4245);
    font-size: 12px;
    padding: 8px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
    text-align: center;
  }

  .hashes-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hash-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hash-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .hash-value {
    background: var(--background-tertiary, #202225);
    border: none;
    border-radius: 4px;
    padding: 6px 8px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 10px;
    cursor: pointer;
    text-align: left;
    word-break: break-all;
    transition: all 0.15s ease;
  }

  .hash-value:hover {
    background: var(--background-modifier-hover, rgba(79, 84, 92, 0.6));
  }

  .show-more {
    background: transparent;
    border: none;
    color: var(--text-link, #00aff4);
    cursor: pointer;
    font-size: 11px;
    padding: 4px;
    text-align: center;
  }

  .show-more:hover {
    text-decoration: underline;
  }

  .verify-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-accent, #4f545c);
  }

  .verify-label {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted, #72767d);
    font-weight: 600;
  }

  .verify-input-row {
    position: relative;
    display: flex;
    align-items: center;
  }

  .verify-input {
    width: 100%;
    background: var(--background-tertiary, #202225);
    border: 2px solid transparent;
    border-radius: 4px;
    padding: 8px;
    padding-right: 32px;
    color: var(--text-normal, #dcddde);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 11px;
    transition: border-color 0.15s ease;
  }

  .verify-input:focus {
    outline: none;
    border-color: var(--brand-experiment, #5865f2);
  }

  .verify-input.match {
    border-color: var(--text-positive, #3ba55d);
  }

  .verify-input.mismatch {
    border-color: var(--text-danger, #ed4245);
  }

  .verify-icon {
    position: absolute;
    right: 8px;
    font-size: 14px;
  }

  .verify-input.match + .verify-icon {
    color: var(--text-positive, #3ba55d);
  }

  .verify-input.mismatch + .verify-icon {
    color: var(--text-danger, #ed4245);
  }

  .verify-result {
    font-size: 11px;
    color: var(--text-danger, #ed4245);
    text-align: center;
    padding: 4px;
  }

  .verify-result.match {
    color: var(--text-positive, #3ba55d);
  }

  .feedback {
    text-align: center;
    color: var(--text-positive, #3ba55d);
    font-size: 11px;
    padding: 4px;
    background: var(--background-tertiary, #202225);
    border-radius: 4px;
  }
</style>
