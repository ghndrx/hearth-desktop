<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';

  let {
    channelId = '',
    userId = '',
    onclose = () => {}
  }: {
    channelId?: string;
    userId?: string;
    onclose?: () => void;
  } = $props();

  interface PollOption {
    id: number;
    label: string;
    votes: number;
    voter_ids: string[];
  }

  interface Poll {
    id: string;
    channel_id: string;
    creator_id: string;
    question: string;
    options: PollOption[];
    multi_vote: boolean;
    anonymous: boolean;
    expires_at: number | null;
    created_at: number;
    closed: boolean;
    total_votes: number;
  }

  type ViewMode = 'list' | 'create';

  let mode = $state<ViewMode>('list');
  let polls = $state<Poll[]>([]);
  let loading = $state(false);
  let showClosed = $state(false);

  // Create form state
  let question = $state('');
  let options = $state<string[]>(['', '']);
  let multiVote = $state(false);
  let anonymous = $state(false);
  let hasExpiry = $state(false);
  let expiryHours = $state(24);
  let creating = $state(false);
  let error = $state('');

  let unlisteners: (() => void)[] = [];

  onMount(async () => {
    await loadPolls();

    const u1 = await listen<Poll>('poll:created', () => loadPolls());
    const u2 = await listen<Poll>('poll:updated', (event) => {
      const updated = event.payload;
      polls = polls.map(p => p.id === updated.id ? updated : p);
    });
    const u3 = await listen<Poll>('poll:closed', (event) => {
      const closed = event.payload;
      polls = polls.map(p => p.id === closed.id ? closed : p);
    });
    const u4 = await listen<string>('poll:deleted', (event) => {
      polls = polls.filter(p => p.id !== event.payload);
    });
    unlisteners = [u1, u2, u3, u4];
  });

  onDestroy(() => {
    unlisteners.forEach(fn => fn());
  });

  async function loadPolls() {
    if (!channelId) return;
    loading = true;
    try {
      polls = await invoke<Poll[]>('poll_list_by_channel', {
        channelId,
        includeClosed: showClosed
      });
    } catch (e) {
      console.error('Failed to load polls:', e);
    } finally {
      loading = false;
    }
  }

  function addOption() {
    if (options.length < 10) {
      options = [...options, ''];
    }
  }

  function removeOption(index: number) {
    if (options.length > 2) {
      options = options.filter((_, i) => i !== index);
    }
  }

  async function createPoll() {
    const trimmedOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (!question.trim()) {
      error = 'Enter a question';
      return;
    }
    if (trimmedOptions.length < 2) {
      error = 'Add at least 2 options';
      return;
    }

    creating = true;
    error = '';
    try {
      await invoke('poll_create', {
        request: {
          channel_id: channelId,
          creator_id: userId,
          question: question.trim(),
          options: trimmedOptions,
          multi_vote: multiVote,
          anonymous,
          expires_at: hasExpiry ? Date.now() + expiryHours * 3600000 : null
        }
      });
      resetForm();
      mode = 'list';
      await loadPolls();
    } catch (e: any) {
      error = e?.toString() || 'Failed to create poll';
    } finally {
      creating = false;
    }
  }

  function resetForm() {
    question = '';
    options = ['', ''];
    multiVote = false;
    anonymous = false;
    hasExpiry = false;
    expiryHours = 24;
    error = '';
  }

  async function vote(pollId: string, optionId: number) {
    try {
      const updated = await invoke<Poll>('poll_vote', {
        pollId,
        optionId,
        voterId: userId
      });
      polls = polls.map(p => p.id === updated.id ? updated : p);
    } catch (e) {
      console.error('Vote failed:', e);
    }
  }

  async function closePoll(pollId: string) {
    try {
      const updated = await invoke<Poll>('poll_close', { pollId });
      polls = polls.map(p => p.id === updated.id ? updated : p);
    } catch (e) {
      console.error('Close poll failed:', e);
    }
  }

  async function deletePoll(pollId: string) {
    try {
      await invoke('poll_delete', { pollId });
      polls = polls.filter(p => p.id !== pollId);
    } catch (e) {
      console.error('Delete poll failed:', e);
    }
  }

  function hasVoted(poll: Poll, optionId: number): boolean {
    const opt = poll.options.find(o => o.id === optionId);
    return opt?.voter_ids.includes(userId) ?? false;
  }

  function votePercent(poll: Poll, option: PollOption): number {
    if (poll.total_votes === 0) return 0;
    return Math.round((option.votes / poll.total_votes) * 100);
  }

  function formatTime(ms: number): string {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function isExpired(poll: Poll): boolean {
    return poll.expires_at !== null && Date.now() > poll.expires_at;
  }

  function toggleShowClosed() {
    showClosed = !showClosed;
    loadPolls();
  }
</script>

<div class="poll-panel">
  <div class="poll-header">
    <h3>Polls</h3>
    <div class="header-actions">
      {#if mode === 'list'}
        <button class="btn-icon" onclick={() => toggleShowClosed()} title={showClosed ? 'Hide closed' : 'Show closed'}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {#if showClosed}
              <path d="M8 3C4.5 3 1.7 5.1 0.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5c-1.2-2.9-4-5-7.5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S6.1 4.5 8 4.5s3.5 1.6 3.5 3.5S9.9 11.5 8 11.5zm0-5.5C7.2 6 6.5 6.7 6.5 7.5v1c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5v-1C9.5 6.7 8.8 6 8 6z"/>
            {:else}
              <path d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5c-1.2-2.9-4-5-7.5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5S6.1 4.5 8 4.5s3.5 1.6 3.5 3.5S9.9 11.5 8 11.5zM8 6C6.9 6 6 6.9 6 8s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            {/if}
          </svg>
        </button>
        <button class="btn-primary-sm" onclick={() => { resetForm(); mode = 'create'; }}>
          + New Poll
        </button>
      {:else}
        <button class="btn-ghost-sm" onclick={() => { mode = 'list'; error = ''; }}>
          Cancel
        </button>
      {/if}
      <button class="btn-icon" onclick={onclose} title="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>
  </div>

  {#if mode === 'create'}
    <div class="create-form">
      <div class="form-group">
        <label for="poll-question">Question</label>
        <input
          id="poll-question"
          type="text"
          bind:value={question}
          placeholder="Ask something..."
          maxlength="200"
        />
      </div>

      <div class="form-group">
        <label>Options</label>
        {#each options as opt, i}
          <div class="option-row">
            <span class="option-num">{i + 1}.</span>
            <input
              type="text"
              bind:value={options[i]}
              placeholder="Option {i + 1}"
              maxlength="100"
            />
            {#if options.length > 2}
              <button class="btn-icon-sm" onclick={() => removeOption(i)} title="Remove">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
        {#if options.length < 10}
          <button class="btn-ghost-sm add-option" onclick={addOption}>+ Add option</button>
        {/if}
      </div>

      <div class="form-toggles">
        <label class="toggle-row">
          <input type="checkbox" bind:checked={multiVote} />
          <span>Allow multiple votes</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={anonymous} />
          <span>Anonymous voting</span>
        </label>
        <label class="toggle-row">
          <input type="checkbox" bind:checked={hasExpiry} />
          <span>Set expiry</span>
        </label>
        {#if hasExpiry}
          <div class="expiry-picker">
            <select bind:value={expiryHours}>
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>2 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>
        {/if}
      </div>

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}

      <button class="btn-primary" onclick={createPoll} disabled={creating}>
        {creating ? 'Creating...' : 'Create Poll'}
      </button>
    </div>

  {:else}
    <div class="poll-list">
      {#if loading}
        <div class="empty-state">Loading polls...</div>
      {:else if polls.length === 0}
        <div class="empty-state">
          <p>No polls yet</p>
          <p class="muted">Create a poll to get started</p>
        </div>
      {:else}
        {#each polls as poll (poll.id)}
          {@const expired = isExpired(poll)}
          {@const isClosed = poll.closed || expired}
          <div class="poll-card" class:closed={isClosed}>
            <div class="poll-question">
              <span>{poll.question}</span>
              {#if isClosed}
                <span class="badge closed-badge">{expired ? 'Expired' : 'Closed'}</span>
              {/if}
              {#if poll.multi_vote}
                <span class="badge multi-badge">Multi</span>
              {/if}
              {#if poll.anonymous}
                <span class="badge anon-badge">Anon</span>
              {/if}
            </div>

            <div class="poll-options">
              {#each poll.options as opt (opt.id)}
                {@const pct = votePercent(poll, opt)}
                {@const voted = hasVoted(poll, opt.id)}
                <button
                  class="poll-option"
                  class:voted
                  class:disabled={isClosed}
                  onclick={() => !isClosed && vote(poll.id, opt.id)}
                  disabled={isClosed}
                >
                  <div class="option-bar" style="width: {pct}%"></div>
                  <span class="option-label">{opt.label}</span>
                  <span class="option-count">{opt.votes} ({pct}%)</span>
                  {#if voted}
                    <span class="check-mark">&#10003;</span>
                  {/if}
                </button>
              {/each}
            </div>

            <div class="poll-footer">
              <span class="vote-count">{poll.total_votes} vote{poll.total_votes !== 1 ? 's' : ''}</span>
              <span class="poll-time">{formatTime(poll.created_at)}</span>
              {#if poll.creator_id === userId && !isClosed}
                <button class="btn-ghost-xs" onclick={() => closePoll(poll.id)}>Close</button>
              {/if}
              {#if poll.creator_id === userId}
                <button class="btn-ghost-xs danger" onclick={() => deletePoll(poll.id)}>Delete</button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .poll-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary, #2b2d31);
    color: var(--text-normal, #dbdee1);
    font-size: 14px;
  }

  .poll-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #3f4147);
  }

  .poll-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-primary-sm {
    padding: 4px 12px;
    border-radius: 4px;
    border: none;
    background: var(--brand-color, #5865f2);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    font-weight: 500;
  }
  .btn-primary-sm:hover { opacity: 0.9; }

  .btn-primary {
    width: 100%;
    padding: 10px;
    border-radius: 4px;
    border: none;
    background: var(--brand-color, #5865f2);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 8px;
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-ghost-sm {
    padding: 4px 10px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-muted, #949ba4);
    font-size: 13px;
    cursor: pointer;
  }
  .btn-ghost-sm:hover { color: var(--text-normal, #dbdee1); }

  .btn-ghost-xs {
    padding: 2px 8px;
    border-radius: 3px;
    border: none;
    background: transparent;
    color: var(--text-muted, #949ba4);
    font-size: 12px;
    cursor: pointer;
  }
  .btn-ghost-xs:hover { color: var(--text-normal, #dbdee1); background: var(--bg-modifier-hover, #36373d); }
  .btn-ghost-xs.danger:hover { color: #ed4245; }

  .btn-icon, .btn-icon-sm {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-muted, #949ba4);
    cursor: pointer;
    border-radius: 4px;
    padding: 4px;
  }
  .btn-icon:hover, .btn-icon-sm:hover { color: var(--text-normal, #dbdee1); background: var(--bg-modifier-hover, #36373d); }

  /* Create form */
  .create-form {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted, #949ba4);
    margin-bottom: 6px;
  }

  .form-group input[type="text"] {
    width: 100%;
    padding: 8px 10px;
    border-radius: 4px;
    border: none;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-normal, #dbdee1);
    font-size: 14px;
    outline: none;
    box-sizing: border-box;
  }
  .form-group input[type="text"]:focus {
    outline: 2px solid var(--brand-color, #5865f2);
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .option-num {
    color: var(--text-muted, #949ba4);
    font-size: 13px;
    min-width: 16px;
  }

  .option-row input {
    flex: 1;
  }

  .add-option {
    margin-top: 4px;
    color: var(--brand-color, #5865f2);
  }
  .add-option:hover { text-decoration: underline; }

  .form-toggles {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
  }

  .toggle-row input[type="checkbox"] {
    accent-color: var(--brand-color, #5865f2);
  }

  .expiry-picker select {
    padding: 6px 8px;
    border-radius: 4px;
    border: none;
    background: var(--bg-tertiary, #1e1f22);
    color: var(--text-normal, #dbdee1);
    font-size: 13px;
    margin-left: 24px;
  }

  .error-msg {
    color: #ed4245;
    font-size: 13px;
    margin: 4px 0;
  }

  /* Poll list */
  .poll-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted, #949ba4);
  }
  .empty-state .muted {
    font-size: 13px;
    margin-top: 4px;
  }

  .poll-card {
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .poll-card.closed { opacity: 0.7; }

  .poll-question {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }
  .closed-badge { background: #ed424533; color: #ed4245; }
  .multi-badge { background: #5865f233; color: #5865f2; }
  .anon-badge { background: #949ba433; color: #949ba4; }

  .poll-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .poll-option {
    position: relative;
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid var(--border-color, #3f4147);
    background: transparent;
    color: var(--text-normal, #dbdee1);
    cursor: pointer;
    overflow: hidden;
    text-align: left;
    font-size: 13px;
    width: 100%;
  }
  .poll-option:hover:not(:disabled) {
    border-color: var(--brand-color, #5865f2);
  }
  .poll-option.voted {
    border-color: var(--brand-color, #5865f2);
  }
  .poll-option.disabled {
    cursor: default;
  }

  .option-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--brand-color, #5865f2);
    opacity: 0.15;
    transition: width 0.3s ease;
    border-radius: 3px;
  }

  .option-label {
    position: relative;
    flex: 1;
    z-index: 1;
  }

  .option-count {
    position: relative;
    z-index: 1;
    font-size: 12px;
    color: var(--text-muted, #949ba4);
    margin-left: 8px;
  }

  .check-mark {
    position: relative;
    z-index: 1;
    color: var(--brand-color, #5865f2);
    font-weight: bold;
    margin-left: 6px;
  }

  .poll-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-muted, #949ba4);
  }

  .vote-count { font-weight: 500; }
  .poll-time { flex: 1; }
</style>
