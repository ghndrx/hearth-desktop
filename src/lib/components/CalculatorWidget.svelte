<script lang="ts">
  /**
   * CalculatorWidget.svelte
   * A compact calculator widget for quick math operations.
   * Supports basic arithmetic, percentage, and keyboard input.
   */
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived } from 'svelte/store';

  // Props
  export let compact = false;
  export let showHistory = true;
  export let maxHistoryItems = 10;

  // State
  const display = writable('0');
  const history = writable<Array<{ expression: string; result: string }>>([]);
  const currentOperator = writable<string | null>(null);
  const previousValue = writable<string>('');
  const waitingForOperand = writable(false);
  const error = writable(false);

  // Derived state for formatted display
  const formattedDisplay = derived(display, ($display) => {
    if ($display === 'Error') return $display;
    const num = parseFloat($display);
    if (isNaN(num)) return $display;
    // Format with thousand separators for readability
    if (Math.abs(num) >= 1000 && !$display.includes('.')) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }
    return $display;
  });

  // Button layout
  const buttons = [
    ['C', '±', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', '⌫', '=']
  ];

  function inputDigit(digit: string) {
    error.set(false);
    if ($waitingForOperand) {
      display.set(digit);
      waitingForOperand.set(false);
    } else {
      display.update(d => d === '0' ? digit : d + digit);
    }
  }

  function inputDecimal() {
    error.set(false);
    if ($waitingForOperand) {
      display.set('0.');
      waitingForOperand.set(false);
      return;
    }
    if (!$display.includes('.')) {
      display.update(d => d + '.');
    }
  }

  function clear() {
    display.set('0');
    previousValue.set('');
    currentOperator.set(null);
    waitingForOperand.set(false);
    error.set(false);
  }

  function toggleSign() {
    display.update(d => {
      const value = parseFloat(d);
      if (isNaN(value)) return d;
      return String(-value);
    });
  }

  function inputPercent() {
    display.update(d => {
      const value = parseFloat(d);
      if (isNaN(value)) return d;
      return String(value / 100);
    });
  }

  function backspace() {
    display.update(d => {
      if (d.length === 1 || (d.length === 2 && d.startsWith('-'))) {
        return '0';
      }
      return d.slice(0, -1);
    });
  }

  function calculate(left: number, right: number, operator: string): number {
    switch (operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '×': return left * right;
      case '÷': return right !== 0 ? left / right : NaN;
      default: return right;
    }
  }

  function performOperation(nextOperator: string) {
    const inputValue = parseFloat($display);
    
    if (isNaN(inputValue)) {
      error.set(true);
      display.set('Error');
      return;
    }

    if ($previousValue === '') {
      previousValue.set($display);
    } else if ($currentOperator) {
      const prev = parseFloat($previousValue);
      const result = calculate(prev, inputValue, $currentOperator);
      
      if (isNaN(result) || !isFinite(result)) {
        error.set(true);
        display.set('Error');
        previousValue.set('');
        currentOperator.set(null);
        waitingForOperand.set(false);
        return;
      }
      
      // Add to history when we get a result and are about to start new operation
      if (nextOperator === '=') {
        const expression = `${$previousValue} ${$currentOperator} ${$display}`;
        const resultStr = String(result);
        history.update(h => {
          const newHistory = [{ expression, result: resultStr }, ...h];
          return newHistory.slice(0, maxHistoryItems);
        });
      }
      
      display.set(String(result));
      previousValue.set(String(result));
    }

    waitingForOperand.set(true);
    currentOperator.set(nextOperator === '=' ? null : nextOperator);
  }

  function handleButton(btn: string) {
    if (btn >= '0' && btn <= '9') {
      inputDigit(btn);
    } else if (btn === '.') {
      inputDecimal();
    } else if (btn === 'C') {
      clear();
    } else if (btn === '±') {
      toggleSign();
    } else if (btn === '%') {
      inputPercent();
    } else if (btn === '⌫') {
      backspace();
    } else if (['+', '-', '×', '÷', '='].includes(btn)) {
      performOperation(btn);
    }
  }

  function getButtonClass(btn: string): string {
    const base = 'calc-btn';
    if (btn === '0') return `${base} zero`;
    if (['÷', '×', '-', '+', '='].includes(btn)) return `${base} operator`;
    if (['C', '±', '%'].includes(btn)) return `${base} function`;
    return base;
  }

  // Keyboard support
  function handleKeydown(event: KeyboardEvent) {
    const key = event.key;
    
    // Prevent default for calculator keys
    if (/^[0-9+\-*/.=%]$/.test(key) || ['Enter', 'Escape', 'Backspace'].includes(key)) {
      event.preventDefault();
    }

    if (key >= '0' && key <= '9') {
      inputDigit(key);
    } else if (key === '.') {
      inputDecimal();
    } else if (key === '+') {
      performOperation('+');
    } else if (key === '-') {
      performOperation('-');
    } else if (key === '*') {
      performOperation('×');
    } else if (key === '/') {
      performOperation('÷');
    } else if (key === 'Enter' || key === '=') {
      performOperation('=');
    } else if (key === 'Escape') {
      clear();
    } else if (key === 'Backspace') {
      backspace();
    } else if (key === '%') {
      inputPercent();
    }
  }

  function clearHistory() {
    history.set([]);
  }

  function useHistoryResult(result: string) {
    display.set(result);
    waitingForOperand.set(false);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="calculator-widget" class:compact class:has-error={$error}>
  <div class="display-container">
    <div class="display" class:error={$error}>
      {$formattedDisplay}
    </div>
    {#if $currentOperator}
      <div class="operator-indicator">{$currentOperator}</div>
    {/if}
  </div>

  <div class="button-grid">
    {#each buttons as row}
      {#each row as btn}
        <button
          class={getButtonClass(btn)}
          on:click={() => handleButton(btn)}
          tabindex="-1"
          aria-label={btn === '±' ? 'Toggle sign' : btn === '⌫' ? 'Backspace' : btn}
        >
          {btn}
        </button>
      {/each}
    {/each}
  </div>

  {#if showHistory && $history.length > 0}
    <div class="history-section">
      <div class="history-header">
        <span>History</span>
        <button class="clear-history" on:click={clearHistory} aria-label="Clear history">
          Clear
        </button>
      </div>
      <div class="history-list">
        {#each $history as item}
          <button
            class="history-item"
            on:click={() => useHistoryResult(item.result)}
            aria-label="Use result {item.result}"
          >
            <span class="expression">{item.expression}</span>
            <span class="result">= {item.result}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .calculator-widget {
    --calc-bg: var(--color-surface, #1e1e1e);
    --calc-display-bg: var(--color-surface-elevated, #2d2d2d);
    --calc-text: var(--color-text, #ffffff);
    --calc-text-muted: var(--color-text-muted, #888888);
    --calc-btn-bg: var(--color-surface-hover, #3d3d3d);
    --calc-btn-hover: var(--color-surface-active, #4d4d4d);
    --calc-operator-bg: var(--color-primary, #ff9f0a);
    --calc-operator-hover: var(--color-primary-hover, #ffb340);
    --calc-function-bg: var(--color-surface-subtle, #505050);
    --calc-function-hover: var(--color-surface-subtle-hover, #606060);
    --calc-error: var(--color-error, #ff453a);
    --calc-radius: 8px;

    display: flex;
    flex-direction: column;
    background: var(--calc-bg);
    border-radius: var(--calc-radius);
    padding: 12px;
    width: 280px;
    user-select: none;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .calculator-widget.compact {
    width: 240px;
    padding: 8px;
  }

  .display-container {
    position: relative;
    margin-bottom: 12px;
  }

  .display {
    background: var(--calc-display-bg);
    color: var(--calc-text);
    font-size: 2rem;
    font-weight: 300;
    text-align: right;
    padding: 12px 16px;
    border-radius: var(--calc-radius);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .display.error {
    color: var(--calc-error);
  }

  .compact .display {
    font-size: 1.5rem;
    padding: 8px 12px;
    min-height: 44px;
  }

  .operator-indicator {
    position: absolute;
    top: 8px;
    right: 16px;
    font-size: 0.75rem;
    color: var(--calc-operator-bg);
    opacity: 0.8;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .compact .button-grid {
    gap: 6px;
  }

  .calc-btn {
    background: var(--calc-btn-bg);
    color: var(--calc-text);
    border: none;
    border-radius: var(--calc-radius);
    padding: 16px;
    font-size: 1.25rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .compact .calc-btn {
    padding: 12px;
    font-size: 1rem;
  }

  .calc-btn:hover {
    background: var(--calc-btn-hover);
  }

  .calc-btn:active {
    transform: scale(0.95);
  }

  .calc-btn.operator {
    background: var(--calc-operator-bg);
    color: #ffffff;
  }

  .calc-btn.operator:hover {
    background: var(--calc-operator-hover);
  }

  .calc-btn.function {
    background: var(--calc-function-bg);
  }

  .calc-btn.function:hover {
    background: var(--calc-function-hover);
  }

  .history-section {
    margin-top: 12px;
    border-top: 1px solid var(--calc-btn-bg);
    padding-top: 12px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    color: var(--calc-text-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-history {
    background: none;
    border: none;
    color: var(--calc-text-muted);
    cursor: pointer;
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .clear-history:hover {
    background: var(--calc-btn-bg);
    color: var(--calc-text);
  }

  .history-list {
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--calc-display-bg);
    border: none;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
  }

  .history-item:hover {
    background: var(--calc-btn-bg);
  }

  .expression {
    color: var(--calc-text-muted);
    font-size: 0.85rem;
  }

  .result {
    color: var(--calc-text);
    font-size: 0.9rem;
    font-weight: 500;
  }

  /* Scrollbar styling */
  .history-list::-webkit-scrollbar {
    width: 4px;
  }

  .history-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .history-list::-webkit-scrollbar-thumb {
    background: var(--calc-btn-bg);
    border-radius: 2px;
  }

  .history-list::-webkit-scrollbar-thumb:hover {
    background: var(--calc-function-bg);
  }
</style>
