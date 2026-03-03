import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import RandomPickerWidget from './RandomPickerWidget.svelte';

describe('RandomPickerWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders with default coin mode', () => {
      render(RandomPickerWidget);
      
      expect(screen.getByText('🎲 Random Picker')).toBeTruthy();
      expect(screen.getByText('🪙 Coin')).toBeTruthy();
      expect(screen.getByText('🎲 Dice')).toBeTruthy();
      expect(screen.getByText('📋 List')).toBeTruthy();
      expect(screen.getByText('Flip Coin')).toBeTruthy();
    });

    it('shows placeholder text initially', () => {
      render(RandomPickerWidget);
      expect(screen.getByText('Click to flip')).toBeTruthy();
    });
  });

  describe('coin flip', () => {
    it('flips coin and shows result', async () => {
      render(RandomPickerWidget);
      
      const flipButton = screen.getByText('Flip Coin');
      await fireEvent.click(flipButton);
      
      // Button should show "Flipping..."
      expect(screen.getByText('Flipping...')).toBeTruthy();
      
      // Fast forward through animation
      vi.advanceTimersByTime(1100);
      
      // Should show either Heads or Tails
      const result = screen.queryByText('Heads') || screen.queryByText('Tails');
      expect(result).toBeTruthy();
    });

    it('disables button during animation', async () => {
      render(RandomPickerWidget);
      
      const flipButton = screen.getByText('Flip Coin');
      await fireEvent.click(flipButton);
      
      // Button should be disabled
      expect(flipButton).toHaveProperty('disabled', true);
      
      vi.advanceTimersByTime(1100);
    });
  });

  describe('dice roll', () => {
    it('switches to dice mode', async () => {
      render(RandomPickerWidget);
      
      const diceTab = screen.getByText('🎲 Dice');
      await fireEvent.click(diceTab);
      
      expect(screen.getByText('Roll D6')).toBeTruthy();
      expect(screen.getByText('Click to roll')).toBeTruthy();
    });

    it('shows all dice type options', async () => {
      render(RandomPickerWidget);
      
      const diceTab = screen.getByText('🎲 Dice');
      await fireEvent.click(diceTab);
      
      expect(screen.getByText('D4')).toBeTruthy();
      expect(screen.getByText('D6')).toBeTruthy();
      expect(screen.getByText('D8')).toBeTruthy();
      expect(screen.getByText('D10')).toBeTruthy();
      expect(screen.getByText('D12')).toBeTruthy();
      expect(screen.getByText('D20')).toBeTruthy();
      expect(screen.getByText('D100')).toBeTruthy();
    });

    it('changes dice type when selected', async () => {
      render(RandomPickerWidget);
      
      const diceTab = screen.getByText('🎲 Dice');
      await fireEvent.click(diceTab);
      
      const d20Button = screen.getByText('D20');
      await fireEvent.click(d20Button);
      
      expect(screen.getByText('Roll D20')).toBeTruthy();
    });

    it('rolls dice and shows result', async () => {
      render(RandomPickerWidget);
      
      const diceTab = screen.getByText('🎲 Dice');
      await fireEvent.click(diceTab);
      
      const rollButton = screen.getByText('Roll D6');
      await fireEvent.click(rollButton);
      
      expect(screen.getByText('Rolling...')).toBeTruthy();
      
      vi.advanceTimersByTime(900);
      
      // Result should be a number 1-6
      const resultEl = document.querySelector('.dice-result');
      expect(resultEl).toBeTruthy();
      const resultNum = parseInt(resultEl?.textContent || '0');
      expect(resultNum).toBeGreaterThanOrEqual(1);
      expect(resultNum).toBeLessThanOrEqual(6);
    });
  });

  describe('list picker', () => {
    it('switches to list mode', async () => {
      render(RandomPickerWidget);
      
      const listTab = screen.getByText('📋 List');
      await fireEvent.click(listTab);
      
      expect(screen.getByText('Pick Random')).toBeTruthy();
      expect(screen.getByPlaceholderText('Enter items (one per line)...')).toBeTruthy();
    });

    it('shows error when list is empty', async () => {
      render(RandomPickerWidget);
      
      const listTab = screen.getByText('📋 List');
      await fireEvent.click(listTab);
      
      const pickButton = screen.getByText('Pick Random');
      await fireEvent.click(pickButton);
      
      expect(screen.getByText('Add items to the list first!')).toBeTruthy();
    });

    it('picks from list and shows result', async () => {
      render(RandomPickerWidget);
      
      const listTab = screen.getByText('📋 List');
      await fireEvent.click(listTab);
      
      const textarea = screen.getByPlaceholderText('Enter items (one per line)...');
      await fireEvent.input(textarea, { target: { value: 'Apple\nBanana\nCherry' } });
      
      const pickButton = screen.getByText('Pick Random');
      await fireEvent.click(pickButton);
      
      vi.advanceTimersByTime(1300);
      
      const result = document.querySelector('.list-result');
      expect(result).toBeTruthy();
      expect(['Apple', 'Banana', 'Cherry']).toContain(result?.textContent);
    });

    it('immediately picks single item without animation', async () => {
      render(RandomPickerWidget);
      
      const listTab = screen.getByText('📋 List');
      await fireEvent.click(listTab);
      
      const textarea = screen.getByPlaceholderText('Enter items (one per line)...');
      await fireEvent.input(textarea, { target: { value: 'OnlyOne' } });
      
      const pickButton = screen.getByText('Pick Random');
      await fireEvent.click(pickButton);
      
      // Should immediately show result without needing timer advance
      expect(screen.getByText('OnlyOne')).toBeTruthy();
    });
  });

  describe('history', () => {
    it('shows history after picking', async () => {
      render(RandomPickerWidget);
      
      const flipButton = screen.getByText('Flip Coin');
      await fireEvent.click(flipButton);
      
      vi.advanceTimersByTime(1100);
      
      expect(screen.getByText('Recent Results')).toBeTruthy();
      expect(screen.getByText('Coin')).toBeTruthy();
    });

    it('clears history when clear button clicked', async () => {
      render(RandomPickerWidget);
      
      const flipButton = screen.getByText('Flip Coin');
      await fireEvent.click(flipButton);
      
      vi.advanceTimersByTime(1100);
      
      const clearButton = screen.getByText('Clear');
      await fireEvent.click(clearButton);
      
      expect(screen.queryByText('Recent Results')).toBeFalsy();
    });

    it('limits history to 10 items', async () => {
      render(RandomPickerWidget);
      
      // Flip coin 12 times
      for (let i = 0; i < 12; i++) {
        const flipButton = screen.getByText('Flip Coin');
        await fireEvent.click(flipButton);
        vi.advanceTimersByTime(1100);
      }
      
      const historyItems = document.querySelectorAll('.history-item');
      expect(historyItems.length).toBeLessThanOrEqual(10);
    });
  });

  describe('mode switching', () => {
    it('clears result when switching modes', async () => {
      render(RandomPickerWidget);
      
      // Flip coin
      const flipButton = screen.getByText('Flip Coin');
      await fireEvent.click(flipButton);
      vi.advanceTimersByTime(1100);
      
      // Result should be shown
      const coinResult = screen.queryByText('Heads') || screen.queryByText('Tails');
      expect(coinResult).toBeTruthy();
      
      // Switch to dice
      const diceTab = screen.getByText('🎲 Dice');
      await fireEvent.click(diceTab);
      
      // Should show dice placeholder, not coin result
      expect(screen.getByText('Click to roll')).toBeTruthy();
    });
  });
});
