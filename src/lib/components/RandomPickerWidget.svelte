<script lang="ts">
  /**
   * RandomPickerWidget - Random selection utility
   * 
   * Features:
   * - Coin flip with animation
   * - Configurable dice roll (D4, D6, D8, D10, D12, D20)
   * - Random picker from custom list
   * - History of recent results
   */

  let mode = $state<'coin' | 'dice' | 'list'>('coin');
  let diceType = $state<number>(6);
  let listItems = $state<string>('');
  let result = $state<string>('');
  let isAnimating = $state(false);
  let history = $state<Array<{ type: string; result: string; timestamp: Date }>>([]);

  const diceTypes = [4, 6, 8, 10, 12, 20, 100];
  const coinSides = ['Heads', 'Tails'];

  function flipCoin() {
    if (isAnimating) return;
    isAnimating = true;
    
    // Animate through several flips before landing
    let flips = 0;
    const maxFlips = 10;
    const interval = setInterval(() => {
      result = coinSides[Math.floor(Math.random() * 2)];
      flips++;
      if (flips >= maxFlips) {
        clearInterval(interval);
        isAnimating = false;
        addToHistory('Coin', result);
      }
    }, 100);
  }

  function rollDice() {
    if (isAnimating) return;
    isAnimating = true;
    
    let rolls = 0;
    const maxRolls = 8;
    const interval = setInterval(() => {
      result = String(Math.floor(Math.random() * diceType) + 1);
      rolls++;
      if (rolls >= maxRolls) {
        clearInterval(interval);
        isAnimating = false;
        addToHistory(`D${diceType}`, result);
      }
    }, 100);
  }

  function pickFromList() {
    const items = listItems
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (items.length === 0) {
      result = 'Add items to the list first!';
      return;
    }
    
    if (items.length === 1) {
      result = items[0];
      addToHistory('List', result);
      return;
    }
    
    if (isAnimating) return;
    isAnimating = true;
    
    let picks = 0;
    const maxPicks = 12;
    const interval = setInterval(() => {
      result = items[Math.floor(Math.random() * items.length)];
      picks++;
      if (picks >= maxPicks) {
        clearInterval(interval);
        isAnimating = false;
        addToHistory('List', result);
      }
    }, 100);
  }

  function addToHistory(type: string, value: string) {
    history = [
      { type, result: value, timestamp: new Date() },
      ...history.slice(0, 9) // Keep last 10 results
    ];
  }

  function clearHistory() {
    history = [];
  }

  function handleAction() {
    switch (mode) {
      case 'coin':
        flipCoin();
        break;
      case 'dice':
        rollDice();
        break;
      case 'list':
        pickFromList();
        break;
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="random-picker-widget">
  <div class="widget-header">
    <h3>🎲 Random Picker</h3>
    <div class="mode-tabs">
      <button 
        class="mode-tab" 
        class:active={mode === 'coin'}
        onclick={() => { mode = 'coin'; result = ''; }}
      >
        🪙 Coin
      </button>
      <button 
        class="mode-tab" 
        class:active={mode === 'dice'}
        onclick={() => { mode = 'dice'; result = ''; }}
      >
        🎲 Dice
      </button>
      <button 
        class="mode-tab" 
        class:active={mode === 'list'}
        onclick={() => { mode = 'list'; result = ''; }}
      >
        📋 List
      </button>
    </div>
  </div>

  <div class="widget-content">
    {#if mode === 'coin'}
      <div class="coin-mode">
        <div class="result-display" class:animating={isAnimating}>
          {#if result}
            <span class="coin-result">{result === 'Heads' ? '👑' : '🦅'}</span>
            <span class="result-text">{result}</span>
          {:else}
            <span class="placeholder">Click to flip</span>
          {/if}
        </div>
        <button class="action-button" onclick={flipCoin} disabled={isAnimating}>
          {isAnimating ? 'Flipping...' : 'Flip Coin'}
        </button>
      </div>
    {:else if mode === 'dice'}
      <div class="dice-mode">
        <div class="dice-selector">
          {#each diceTypes as d}
            <button 
              class="dice-type-btn" 
              class:selected={diceType === d}
              onclick={() => diceType = d}
            >
              D{d}
            </button>
          {/each}
        </div>
        <div class="result-display" class:animating={isAnimating}>
          {#if result}
            <span class="dice-result">{result}</span>
          {:else}
            <span class="placeholder">Click to roll</span>
          {/if}
        </div>
        <button class="action-button" onclick={rollDice} disabled={isAnimating}>
          {isAnimating ? 'Rolling...' : `Roll D${diceType}`}
        </button>
      </div>
    {:else}
      <div class="list-mode">
        <textarea 
          class="list-input"
          placeholder="Enter items (one per line)..."
          bind:value={listItems}
          rows="4"
        ></textarea>
        <div class="result-display" class:animating={isAnimating}>
          {#if result}
            <span class="list-result">{result}</span>
          {:else}
            <span class="placeholder">Add items and pick</span>
          {/if}
        </div>
        <button class="action-button" onclick={pickFromList} disabled={isAnimating}>
          {isAnimating ? 'Picking...' : 'Pick Random'}
        </button>
      </div>
    {/if}
  </div>

  {#if history.length > 0}
    <div class="history-section">
      <div class="history-header">
        <span>Recent Results</span>
        <button class="clear-btn" onclick={clearHistory}>Clear</button>
      </div>
      <div class="history-list">
        {#each history as item}
          <div class="history-item">
            <span class="history-type">{item.type}</span>
            <span class="history-result">{item.result}</span>
            <span class="history-time">{formatTime(item.timestamp)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .random-picker-widget {
    background: var(--bg-secondary, #2b2d31);
    border-radius: 8px;
    padding: 12px;
    min-width: 280px;
  }

  .widget-header {
    margin-bottom: 12px;
  }

  .widget-header h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }

  .mode-tabs {
    display: flex;
    gap: 4px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 6px;
    padding: 4px;
  }

  .mode-tab {
    flex: 1;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted, #b5bac1);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .mode-tab:hover {
    color: var(--text-primary, #f2f3f5);
    background: var(--bg-modifier-hover, rgba(255, 255, 255, 0.1));
  }

  .mode-tab.active {
    background: var(--brand-primary, #5865f2);
    color: white;
  }

  .widget-content {
    margin-bottom: 12px;
  }

  .result-display {
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    margin: 12px 0;
    min-height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s;
  }

  .result-display.animating {
    animation: shake 0.1s infinite;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px) rotate(-1deg); }
    75% { transform: translateX(2px) rotate(1deg); }
  }

  .placeholder {
    color: var(--text-muted, #b5bac1);
    font-size: 14px;
  }

  .coin-result {
    font-size: 36px;
    margin-bottom: 4px;
  }

  .dice-result {
    font-size: 48px;
    font-weight: 700;
    color: var(--brand-primary, #5865f2);
  }

  .list-result {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
    word-break: break-word;
  }

  .result-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #f2f3f5);
  }

  .dice-selector {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .dice-type-btn {
    padding: 6px 10px;
    background: var(--bg-tertiary, #1e1f22);
    border: 2px solid transparent;
    border-radius: 6px;
    color: var(--text-secondary, #b5bac1);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dice-type-btn:hover {
    border-color: var(--brand-primary, #5865f2);
    color: var(--text-primary, #f2f3f5);
  }

  .dice-type-btn.selected {
    background: var(--brand-primary, #5865f2);
    border-color: var(--brand-primary, #5865f2);
    color: white;
  }

  .list-input {
    width: 100%;
    padding: 10px;
    background: var(--bg-tertiary, #1e1f22);
    border: 1px solid var(--border-subtle, #3f4147);
    border-radius: 6px;
    color: var(--text-primary, #f2f3f5);
    font-size: 13px;
    resize: vertical;
    font-family: inherit;
  }

  .list-input::placeholder {
    color: var(--text-muted, #6d6f78);
  }

  .list-input:focus {
    outline: none;
    border-color: var(--brand-primary, #5865f2);
  }

  .action-button {
    width: 100%;
    padding: 10px 16px;
    background: var(--brand-primary, #5865f2);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .action-button:hover:not(:disabled) {
    background: var(--brand-primary-dark, #4752c4);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .history-section {
    border-top: 1px solid var(--border-subtle, #3f4147);
    padding-top: 12px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--text-muted, #b5bac1);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--text-link, #00aff4);
    font-size: 11px;
    cursor: pointer;
  }

  .clear-btn:hover {
    text-decoration: underline;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 150px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--bg-tertiary, #1e1f22);
    border-radius: 4px;
    font-size: 12px;
  }

  .history-type {
    padding: 2px 6px;
    background: var(--bg-modifier-accent, rgba(88, 101, 242, 0.2));
    border-radius: 3px;
    color: var(--brand-primary, #5865f2);
    font-weight: 500;
    font-size: 10px;
  }

  .history-result {
    flex: 1;
    color: var(--text-primary, #f2f3f5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-time {
    color: var(--text-muted, #6d6f78);
    font-size: 10px;
  }
</style>
