<script lang="ts">
  /**
   * CalculatorWidget.svelte
   * A compact calculator widget for quick math operations.
   * Supports basic arithmetic, percentage, and keyboard input.
   */
  import { onMount, onDestroy } from 'svelte';

  // Props
  interface Props {
    compact?: boolean;
    showHistory?: boolean;
    maxHistoryItems?: number;
  }

  let { compact = false, showHistory = true, maxHistoryItems = 10 }: Props = $props();

  // State
  let display = $state('0');
  let history = $state<Array<{ expression: string; result: string }>>([]);
  let currentOperator = $state<string | null>(null);
  let previousValue = $state('');
  let waitingForOperand = $state(false);
  let error = $state(false);

  // Derived state for formatted display
  let formattedDisplay = $derived(() => {
    if (display === 'Error') return display;
    const num = parseFloat(display);
    if (isNaN(num)) return display;
    // Format with thousand separators for readability
    if (Math.abs(num) >= 1000 && !display.includes('.')) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }
    return display;
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
    error = false;
    if (waitingForOperand) {
      display = digit;
      waitingForOperand = false;
    } else {
      display = display === '0' ? digit : display + digit;
    }
  }

  function inputDecimal() {
    error = false;
    if (waitingForOperand) {
      display = '0.';
      waitingForOperand = false;
      return;
    }
    if (!display.includes('.')) {
      display = display + '.';
    }
  }

  function clear() {
    display = '0';
    previousValue = '';
    currentOperator = null;
    waitingForOperand = false;
    error = false;
  }

  function toggleSign() {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      display = String(-value);
    }
  }

  function inputPercent() {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      display = String(value / 100);
    }
  }

  function backspace() {
    if (display.length === 1 || (display.length === 2 && display.startsWith('-'))) {
      display = '0';
    } else {
      display = display.slice(0, -1);
    }
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
    const inputValue = parseFloat(display);
    
    if (isNaN(inputValue)) {
      error = true;
      display = 'Error';
      return;
    }

    if (previousValue === '') {
      previousValue = display;
    } else if (currentOperator) {
      const prev = parseFloat(previousValue);
      const result = calculate(prev, inputValue, currentOperator);
      
      if (isNaN(result) || !isFinite(result)) {
        error = true;
        display = 'Error';
        previousValue = '';
        currentOperator = null;
        waitingForOperand = false;
        return;
      }
      
      // Add to history when we get a result and are about to start new operation
      if (nextOperator === '=') {
        const expression = `${previousValue} ${currentOperator} ${display}`;
        const resultStr = String(result);
        const newHistory = [{ expression, result: resultStr }, ...history];
        history = newHistory.slice(0, maxHistoryItems);
      }
      
      display = String(result);
      previousValue = String(result);
    }

    waitingForOperand = true;
    currentOperator = nextOperator === '=' ? null : nextOperator;
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
    history = [];
  }

  function useHistoryResult(result: string) {
    display = result;
    waitingForOperand = false;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="calculator-widget" class:compact class:has-error={error}>
  <div class="display-container">
    <div class="display" class:error>
      {formattedDisplay()}
    </div>
    {#if currentOperator}
      <div class="operator-indicator">{currentOperator}</div>
    {/if}
  </div>

  <div class="button-grid">
    {#each buttons as row}
      {#each row as btn}
        <button
          class={getButtonClass(btn)}
          onclick={() => handleButton(btn)}
          tabindex="-1"
          aria-label={btn === '±' ? 'Toggle sign' : btn === '⌫' ? 'Backspace' : btn}
        >
          {btn}
        </button>
      {/each}
    {/each}
  </div>

  {#if showHistory && history.length > 0}
    <div class="history-section">
      <div class="history-header">
        <span>History</span>
        <button class="clear-history" onclick={clearHistory} aria-label="Clear history">
          Clear
        </button>
      </div>
      <div class="history-list">
        {#each history as item}
          <button
            class="history-item"
            onclick={() => useHistoryResult(item.result)}
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
    --calc-bg: var(--bg-tertiary, #40444b);
    --calc-display-bg: var(--bg-primary, #36393f);
    --calc-text: var(--text-primary, #ffffff);
    --calc-text-muted: var(--text-muted, #72767d);
    --calc-btn-bg: var(--bg-secondary, #2f3136);
    --calc-btn-hover: var(--bg-modifier-hover, #4f545c);
    --calc-operator-bg: var(--accent, #5865f2);
    --calc-operator-hover: #4752c4;
    --calc-function-bg: var(--bg-modifier-accent, #40444b);
    --calc-function-hover: #4f545c;
    --calc-error: var(--error, #ed4245);
    --calc-radius: 6px;

    display: flex;
    flex-direction: column;
    background: var(--calc-bg);
    border-radius: var(--calc-radius);
    user-select: none;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .calculator-widget.compact {
    padding: 0;
  }

  .display-container {
    position: relative;
    margin-bottom: 8px;
  }

  .display {
    background: var(--calc-display-bg);
    color: var(--calc-text);
    font-size: 1.5rem;
    font-weight: 500;
    text-align: right;
    padding: 10px 12px;
    border-radius: var(--calc-radius);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .display.error {
    color: var(--calc-error);
  }

  .compact .display {
    font-size: 1.25rem;
    padding: 8px 10px;
    min-height: 36px;
  }

  .operator-indicator {
    position: absolute;
    top: 6px;
    right: 12px;
    font-size: 0.7rem;
    color: var(--calc-operator-bg);
    opacity: 0.8;
  }

  .button-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .compact .button-grid {
    gap: 3px;
  }

  .calc-btn {
    background: var(--calc-btn-bg);
    color: var(--calc-text);
    border: none;
    border-radius: var(--calc-radius);
    padding: 10px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .compact .calc-btn {
    padding: 8px;
    font-size: 0.9rem;
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
    margin-top: 8px;
    border-top: 1px solid var(--calc-btn-bg);
    padding-top: 8px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    color: var(--calc-text-muted);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .clear-history {
    background: none;
    border: none;
    color: var(--calc-text-muted);
    cursor: pointer;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .clear-history:hover {
    background: var(--calc-btn-bg);
    color: var(--calc-text);
  }

  .history-list {
    max-height: 80px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--calc-display-bg);
    border: none;
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
    text-align: left;
    transition: background-color 0.15s ease;
  }

  .history-item:hover {
    background: var(--calc-btn-bg);
  }

  .expression {
    color: var(--calc-text-muted);
    font-size: 0.75rem;
  }

  .result {
    color: var(--calc-text);
    font-size: 0.8rem;
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
