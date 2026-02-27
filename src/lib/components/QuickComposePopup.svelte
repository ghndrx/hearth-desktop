<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow, Window } from '@tauri-apps/api/window';
  import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

  export let isOpen = false;
  export let recentChannels: Array<{ id: string; name: string; serverName?: string }> = [];
  export let defaultChannelId: string | null = null;
  export let maxRecentChannels = 5;
  export let shortcut = 'CommandOrControl+Shift+N';
  export let placeholder = 'Quick message...';
  export let sendOnEnter = true;
  export let closeOnSend = true;
  export let closeOnEscape = true;
  export let position: 'center' | 'cursor' | 'bottom-right' = 'center';
  export let theme: 'light' | 'dark' | 'system' = 'system';
  export let showChannelSelector = true;
  export let maxLength = 2000;
  export let enableMarkdown = true;
  export let enableEmoji = true;

  const dispatch = createEventDispatcher<{
    send: { channelId: string; message: string; attachments: File[] };
    open: void;
    close: void;
    channelChange: { channelId: string };
    error: { message: string; code: string };
  }>();

  let message = '';
  let selectedChannelId: string | null = defaultChannelId;
  let attachments: File[] = [];
  let inputRef: HTMLTextAreaElement;
  let isSending = false;
  let error: string | null = null;
  let searchQuery = '';
  let showChannelDropdown = false;
  let filteredChannels: typeof recentChannels = [];
  let popupWindow: Window | null = null;
  let isDragging = false;
  let characterCount = 0;
  let emojiPickerOpen = false;
  let shortcutRegistered = false;

  // Common emoji shortcuts
  const quickEmojis = ['👍', '❤️', '😊', '🎉', '🔥', '✅', '👀', '💯'];

  $: characterCount = message.length;
  $: isOverLimit = characterCount > maxLength;
  $: canSend = message.trim().length > 0 && selectedChannelId && !isSending && !isOverLimit;
  $: filteredChannels = searchQuery
    ? recentChannels.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.serverName?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : recentChannels.slice(0, maxRecentChannels);

  $: if (!selectedChannelId && recentChannels.length > 0) {
    selectedChannelId = recentChannels[0].id;
  }

  onMount(async () => {
    await registerShortcut();
    document.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(async () => {
    await unregisterShortcut();
    document.removeEventListener('keydown', handleGlobalKeydown);
  });

  async function registerShortcut() {
    if (shortcutRegistered) return;
    
    try {
      await register(shortcut, async () => {
        await togglePopup();
      });
      shortcutRegistered = true;
    } catch (e) {
      console.error('Failed to register global shortcut:', e);
      dispatch('error', { message: 'Failed to register shortcut', code: 'SHORTCUT_ERROR' });
    }
  }

  async function unregisterShortcut() {
    if (!shortcutRegistered) return;
    
    try {
      await unregister(shortcut);
      shortcutRegistered = false;
    } catch (e) {
      console.error('Failed to unregister shortcut:', e);
    }
  }

  async function togglePopup() {
    if (isOpen) {
      await closePopup();
    } else {
      await openPopup();
    }
  }

  async function openPopup() {
    isOpen = true;
    error = null;
    message = '';
    attachments = [];
    
    try {
      const currentWindow = getCurrentWindow();
      await currentWindow.setFocus();
      
      // Position window based on preference
      if (position === 'cursor') {
        const cursorPos = await invoke<{ x: number; y: number }>('get_cursor_position').catch(() => null);
        if (cursorPos) {
          await currentWindow.setPosition({ x: cursorPos.x - 200, y: cursorPos.y - 100 });
        }
      } else if (position === 'bottom-right') {
        const monitor = await currentWindow.currentMonitor();
        if (monitor) {
          const { width, height } = monitor.size;
          await currentWindow.setPosition({ x: width - 450, y: height - 350 });
        }
      }
      
      dispatch('open');
      
      // Focus input after a small delay
      setTimeout(() => {
        inputRef?.focus();
      }, 100);
    } catch (e) {
      console.error('Failed to open popup:', e);
    }
  }

  async function closePopup() {
    isOpen = false;
    showChannelDropdown = false;
    emojiPickerOpen = false;
    dispatch('close');
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      closePopup();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && sendOnEnter) {
      event.preventDefault();
      handleSend();
    }

    if (event.key === 'Tab' && showChannelSelector) {
      event.preventDefault();
      showChannelDropdown = !showChannelDropdown;
    }

    // Ctrl+Up/Down to cycle through channels
    if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      cycleChannel(event.key === 'ArrowUp' ? -1 : 1);
    }
  }

  function cycleChannel(direction: number) {
    const currentIndex = recentChannels.findIndex(c => c.id === selectedChannelId);
    const newIndex = (currentIndex + direction + recentChannels.length) % recentChannels.length;
    selectedChannelId = recentChannels[newIndex].id;
    dispatch('channelChange', { channelId: selectedChannelId });
  }

  async function handleSend() {
    if (!canSend || !selectedChannelId) return;

    isSending = true;
    error = null;

    try {
      dispatch('send', {
        channelId: selectedChannelId,
        message: message.trim(),
        attachments
      });

      message = '';
      attachments = [];

      if (closeOnSend) {
        await closePopup();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to send message';
      dispatch('error', { message: error, code: 'SEND_ERROR' });
    } finally {
      isSending = false;
    }
  }

  function selectChannel(channelId: string) {
    selectedChannelId = channelId;
    showChannelDropdown = false;
    searchQuery = '';
    dispatch('channelChange', { channelId });
    inputRef?.focus();
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (files) {
      attachments = [...attachments, ...Array.from(files)];
    }
  }

  function removeAttachment(index: number) {
    attachments = attachments.filter((_, i) => i !== index);
  }

  function insertEmoji(emoji: string) {
    const cursorPos = inputRef?.selectionStart ?? message.length;
    message = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    emojiPickerOpen = false;
    
    setTimeout(() => {
      if (inputRef) {
        inputRef.selectionStart = inputRef.selectionEnd = cursorPos + emoji.length;
        inputRef.focus();
      }
    }, 0);
  }

  function getSelectedChannelName(): string {
    const channel = recentChannels.find(c => c.id === selectedChannelId);
    return channel ? `#${channel.name}` : 'Select channel';
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

{#if isOpen}
  <div
    class="quick-compose-overlay"
    class:dark={theme === 'dark'}
    on:click|self={closePopup}
    on:keydown={handleGlobalKeydown}
    role="dialog"
    aria-modal="true"
    aria-label="Quick compose message"
  >
    <div
      class="quick-compose-popup"
      class:dragging={isDragging}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
      on:dragover={handleDragOver}
      on:drop={handleDrop}
      role="presentation"
    >
      <!-- Header with channel selector -->
      <div class="popup-header">
        <div class="channel-selector">
          {#if showChannelSelector}
            <button
              class="channel-button"
              on:click={() => showChannelDropdown = !showChannelDropdown}
              aria-expanded={showChannelDropdown}
              aria-haspopup="listbox"
            >
              <span class="channel-icon">💬</span>
              <span class="channel-name">{getSelectedChannelName()}</span>
              <span class="dropdown-arrow">▼</span>
            </button>

            {#if showChannelDropdown}
              <div class="channel-dropdown" role="listbox">
                <input
                  type="text"
                  class="channel-search"
                  placeholder="Search channels..."
                  bind:value={searchQuery}
                  on:keydown|stopPropagation
                />
                <div class="channel-list">
                  {#each filteredChannels as channel (channel.id)}
                    <button
                      class="channel-option"
                      class:selected={channel.id === selectedChannelId}
                      on:click={() => selectChannel(channel.id)}
                      role="option"
                      aria-selected={channel.id === selectedChannelId}
                    >
                      <span class="channel-hash">#</span>
                      <span class="channel-option-name">{channel.name}</span>
                      {#if channel.serverName}
                        <span class="server-name">{channel.serverName}</span>
                      {/if}
                    </button>
                  {:else}
                    <div class="no-channels">No channels found</div>
                  {/each}
                </div>
              </div>
            {/if}
          {:else}
            <span class="static-channel">{getSelectedChannelName()}</span>
          {/if}
        </div>

        <button
          class="close-button"
          on:click={closePopup}
          aria-label="Close quick compose"
        >
          ✕
        </button>
      </div>

      <!-- Message input -->
      <div class="message-area">
        <textarea
          bind:this={inputRef}
          bind:value={message}
          on:keydown={handleKeydown}
          {placeholder}
          class="message-input"
          class:error={isOverLimit}
          disabled={isSending}
          rows={3}
          aria-label="Message content"
          aria-describedby="char-count"
        />

        <!-- Drag overlay -->
        {#if isDragging}
          <div class="drag-overlay">
            <span class="drag-icon">📎</span>
            <span>Drop files to attach</span>
          </div>
        {/if}
      </div>

      <!-- Attachments -->
      {#if attachments.length > 0}
        <div class="attachments-list">
          {#each attachments as file, index (file.name + index)}
            <div class="attachment-item">
              <span class="attachment-icon">📄</span>
              <span class="attachment-name" title={file.name}>
                {file.name.length > 20 ? file.name.slice(0, 17) + '...' : file.name}
              </span>
              <span class="attachment-size">{formatFileSize(file.size)}</span>
              <button
                class="remove-attachment"
                on:click={() => removeAttachment(index)}
                aria-label="Remove {file.name}"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Footer -->
      <div class="popup-footer">
        <div class="footer-left">
          {#if enableEmoji}
            <div class="emoji-picker-container">
              <button
                class="emoji-button"
                on:click={() => emojiPickerOpen = !emojiPickerOpen}
                aria-label="Insert emoji"
                aria-expanded={emojiPickerOpen}
              >
                😊
              </button>

              {#if emojiPickerOpen}
                <div class="emoji-quick-picker">
                  {#each quickEmojis as emoji}
                    <button
                      class="emoji-option"
                      on:click={() => insertEmoji(emoji)}
                      aria-label="Insert {emoji}"
                    >
                      {emoji}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          <label class="attach-button">
            <input
              type="file"
              multiple
              on:change={(e) => {
                const files = e.currentTarget.files;
                if (files) attachments = [...attachments, ...Array.from(files)];
              }}
              hidden
            />
            <span aria-label="Attach files">📎</span>
          </label>

          <span
            id="char-count"
            class="char-count"
            class:warning={characterCount > maxLength * 0.9}
            class:error={isOverLimit}
          >
            {characterCount}/{maxLength}
          </span>
        </div>

        <div class="footer-right">
          {#if error}
            <span class="error-message">{error}</span>
          {/if}

          <span class="hint">
            {sendOnEnter ? 'Enter to send' : 'Ctrl+Enter to send'}
          </span>

          <button
            class="send-button"
            on:click={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            {#if isSending}
              <span class="spinner" />
            {:else}
              Send
            {/if}
          </button>
        </div>
      </div>

      <!-- Keyboard hints -->
      <div class="keyboard-hints">
        <span>Tab: channels</span>
        <span>Ctrl+↑↓: switch</span>
        <span>Esc: close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-compose-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .quick-compose-popup {
    background: var(--bg-primary, #ffffff);
    border-radius: 12px;
    width: 420px;
    max-width: 95vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    position: relative;
    animation: slideIn 0.15s ease-out;
  }

  .dark .quick-compose-popup {
    background: #2f3136;
    color: #dcddde;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .quick-compose-popup.dragging {
    border: 2px dashed var(--accent-color, #5865f2);
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #e3e5e8);
    background: var(--bg-secondary, #f2f3f5);
  }

  .dark .popup-header {
    background: #36393f;
    border-color: #202225;
  }

  .channel-selector {
    position: relative;
    flex: 1;
  }

  .channel-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e3e5e8);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: inherit;
    transition: all 0.15s;
  }

  .dark .channel-button {
    background: #40444b;
    border-color: #202225;
  }

  .channel-button:hover {
    background: var(--bg-hover, #ebedef);
  }

  .dark .channel-button:hover {
    background: #4a4e54;
  }

  .channel-icon {
    font-size: 16px;
  }

  .channel-name {
    font-weight: 500;
  }

  .dropdown-arrow {
    font-size: 10px;
    opacity: 0.7;
  }

  .channel-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e3e5e8);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .dark .channel-dropdown {
    background: #2f3136;
    border-color: #202225;
  }

  .channel-search {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-bottom: 1px solid var(--border-color, #e3e5e8);
    font-size: 14px;
    background: transparent;
    color: inherit;
  }

  .dark .channel-search {
    border-color: #202225;
  }

  .channel-search:focus {
    outline: none;
  }

  .channel-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .channel-option {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-size: 14px;
    transition: background 0.1s;
  }

  .channel-option:hover,
  .channel-option.selected {
    background: var(--bg-hover, #ebedef);
  }

  .dark .channel-option:hover,
  .dark .channel-option.selected {
    background: #40444b;
  }

  .channel-hash {
    color: var(--text-muted, #72767d);
    font-weight: 500;
  }

  .server-name {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .no-channels {
    padding: 16px;
    text-align: center;
    color: var(--text-muted, #72767d);
    font-size: 14px;
  }

  .close-button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    font-size: 16px;
    transition: all 0.15s;
  }

  .close-button:hover {
    background: var(--bg-hover, #ebedef);
    color: var(--text-primary, #060607);
  }

  .dark .close-button:hover {
    background: #40444b;
    color: #ffffff;
  }

  .message-area {
    position: relative;
    padding: 12px 16px;
  }

  .message-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color, #e3e5e8);
    border-radius: 8px;
    font-size: 15px;
    font-family: inherit;
    resize: none;
    background: var(--bg-primary, #ffffff);
    color: inherit;
    line-height: 1.4;
    transition: border-color 0.15s;
  }

  .dark .message-input {
    background: #40444b;
    border-color: #202225;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--accent-color, #5865f2);
  }

  .message-input.error {
    border-color: #ed4245;
  }

  .message-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .drag-overlay {
    position: absolute;
    inset: 12px 16px;
    background: rgba(88, 101, 242, 0.1);
    border: 2px dashed var(--accent-color, #5865f2);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--accent-color, #5865f2);
    font-weight: 500;
  }

  .drag-icon {
    font-size: 32px;
  }

  .attachments-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 16px 12px;
  }

  .attachment-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--bg-secondary, #f2f3f5);
    border-radius: 6px;
    font-size: 13px;
  }

  .dark .attachment-item {
    background: #40444b;
  }

  .attachment-icon {
    font-size: 14px;
  }

  .attachment-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-size {
    color: var(--text-muted, #72767d);
    font-size: 11px;
  }

  .remove-attachment {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text-muted, #72767d);
    font-size: 12px;
    transition: all 0.15s;
  }

  .remove-attachment:hover {
    background: rgba(237, 66, 69, 0.2);
    color: #ed4245;
  }

  .popup-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--border-color, #e3e5e8);
    background: var(--bg-secondary, #f2f3f5);
  }

  .dark .popup-footer {
    background: #36393f;
    border-color: #202225;
  }

  .footer-left,
  .footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .emoji-picker-container {
    position: relative;
  }

  .emoji-button,
  .attach-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 18px;
    transition: background 0.15s;
  }

  .emoji-button:hover,
  .attach-button:hover {
    background: var(--bg-hover, #ebedef);
  }

  .dark .emoji-button:hover,
  .dark .attach-button:hover {
    background: #40444b;
  }

  .emoji-quick-picker {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 8px;
    display: flex;
    gap: 4px;
    padding: 8px;
    background: var(--bg-primary, #ffffff);
    border: 1px solid var(--border-color, #e3e5e8);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }

  .dark .emoji-quick-picker {
    background: #2f3136;
    border-color: #202225;
  }

  .emoji-option {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 20px;
    transition: all 0.15s;
  }

  .emoji-option:hover {
    background: var(--bg-hover, #ebedef);
    transform: scale(1.15);
  }

  .dark .emoji-option:hover {
    background: #40444b;
  }

  .char-count {
    font-size: 12px;
    color: var(--text-muted, #72767d);
  }

  .char-count.warning {
    color: #faa61a;
  }

  .char-count.error {
    color: #ed4245;
    font-weight: 500;
  }

  .error-message {
    font-size: 12px;
    color: #ed4245;
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted, #72767d);
  }

  .send-button {
    padding: 8px 20px;
    background: var(--accent-color, #5865f2);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    min-width: 70px;
  }

  .send-button:hover:not(:disabled) {
    background: #4752c4;
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .keyboard-hints {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 6px 16px;
    font-size: 11px;
    color: var(--text-muted, #72767d);
    background: var(--bg-tertiary, #e3e5e8);
  }

  .dark .keyboard-hints {
    background: #202225;
  }

  .static-channel {
    font-weight: 500;
    color: var(--text-secondary, #4f5660);
  }

  .dark .static-channel {
    color: #b9bbbe;
  }
</style>
</script>
