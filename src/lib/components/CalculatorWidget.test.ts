/**
 * CalculatorWidget.test.ts
 * Tests for the CalculatorWidget component
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CalculatorWidget from './CalculatorWidget.svelte';

describe('CalculatorWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders with default display of 0', () => {
      render(CalculatorWidget);
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('renders all calculator buttons', () => {
      render(CalculatorWidget);
      const expectedButtons = [
        'C', '±', '%', '÷',
        '7', '8', '9', '×',
        '4', '5', '6', '-',
        '1', '2', '3', '+',
        '0', '.', '⌫', '='
      ];
      expectedButtons.forEach(btn => {
        const ariaLabel = btn === '±' ? 'Toggle sign' : btn === '⌫' ? 'Backspace' : btn;
        expect(screen.getByRole('button', { name: ariaLabel })).toBeTruthy();
      });
    });

    it('renders in compact mode when prop is set', () => {
      const { container } = render(CalculatorWidget, { props: { compact: true } });
      expect(container.querySelector('.compact')).toBeTruthy();
    });

    it('hides history section when showHistory is false', () => {
      const { container } = render(CalculatorWidget, { props: { showHistory: false } });
      expect(container.querySelector('.history-section')).toBeFalsy();
    });
  });

  describe('digit input', () => {
    it('replaces initial 0 with first digit', async () => {
      render(CalculatorWidget);
      const btn5 = screen.getByRole('button', { name: '5' });
      await fireEvent.click(btn5);
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('appends subsequent digits', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      expect(screen.getByText('123')).toBeTruthy();
    });

    it('handles decimal input', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '.' }));
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      await fireEvent.click(screen.getByRole('button', { name: '4' }));
      expect(screen.getByText('3.14')).toBeTruthy();
    });

    it('prevents multiple decimal points', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '.' }));
      await fireEvent.click(screen.getByRole('button', { name: '.' }));
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      expect(screen.getByText('3.1')).toBeTruthy();
    });
  });

  describe('basic operations', () => {
    it('performs addition', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: '+' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('8')).toBeTruthy();
    });

    it('performs subtraction', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '9' }));
      await fireEvent.click(screen.getByRole('button', { name: '-' }));
      await fireEvent.click(screen.getByRole('button', { name: '4' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('performs multiplication', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '6' }));
      await fireEvent.click(screen.getByRole('button', { name: '×' }));
      await fireEvent.click(screen.getByRole('button', { name: '7' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('42')).toBeTruthy();
    });

    it('performs division', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '8' }));
      await fireEvent.click(screen.getByRole('button', { name: '÷' }));
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('4')).toBeTruthy();
    });

    it('handles division by zero', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: '÷' }));
      await fireEvent.click(screen.getByRole('button', { name: '0' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('Error')).toBeTruthy();
    });
  });

  describe('special functions', () => {
    it('clears display with C button', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: 'C' }));
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('toggles sign with ± button', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Toggle sign' }));
      expect(screen.getByText('-5')).toBeTruthy();
      await fireEvent.click(screen.getByRole('button', { name: 'Toggle sign' }));
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('calculates percentage', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: '0' }));
      await fireEvent.click(screen.getByRole('button', { name: '%' }));
      expect(screen.getByText('0.5')).toBeTruthy();
    });

    it('handles backspace', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
      expect(screen.getByText('12')).toBeTruthy();
    });

    it('backspace returns to 0 on single digit', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  describe('chained operations', () => {
    it('handles chained operations', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: '+' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '×' }));
      // After pressing ×, should show intermediate result 8
      expect(screen.getByText('8')).toBeTruthy();
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('16')).toBeTruthy();
    });
  });

  describe('keyboard support', () => {
    it('accepts digit keys', async () => {
      render(CalculatorWidget);
      await fireEvent.keyDown(window, { key: '7' });
      expect(screen.getByText('7')).toBeTruthy();
    });

    it('accepts operator keys', async () => {
      render(CalculatorWidget);
      await fireEvent.keyDown(window, { key: '6' });
      await fireEvent.keyDown(window, { key: '*' });
      await fireEvent.keyDown(window, { key: '7' });
      await fireEvent.keyDown(window, { key: 'Enter' });
      expect(screen.getByText('42')).toBeTruthy();
    });

    it('clears on Escape', async () => {
      render(CalculatorWidget);
      await fireEvent.keyDown(window, { key: '1' });
      await fireEvent.keyDown(window, { key: '2' });
      await fireEvent.keyDown(window, { key: '3' });
      await fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByText('0')).toBeTruthy();
    });

    it('handles backspace key', async () => {
      render(CalculatorWidget);
      await fireEvent.keyDown(window, { key: '1' });
      await fireEvent.keyDown(window, { key: '2' });
      await fireEvent.keyDown(window, { key: 'Backspace' });
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  describe('history', () => {
    it('adds calculation to history on equals', async () => {
      const { container } = render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      await fireEvent.click(screen.getByRole('button', { name: '+' }));
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      
      expect(container.querySelector('.history-item')).toBeTruthy();
      expect(container.querySelector('.expression')?.textContent).toContain('5 + 3');
      expect(container.querySelector('.result')?.textContent).toContain('8');
    });

    it('respects maxHistoryItems prop', async () => {
      const { container } = render(CalculatorWidget, { props: { maxHistoryItems: 2 } });
      
      // Perform 3 calculations
      for (let i = 1; i <= 3; i++) {
        await fireEvent.click(screen.getByRole('button', { name: 'C' }));
        await fireEvent.click(screen.getByRole('button', { name: String(i) }));
        await fireEvent.click(screen.getByRole('button', { name: '+' }));
        await fireEvent.click(screen.getByRole('button', { name: '1' }));
        await fireEvent.click(screen.getByRole('button', { name: '=' }));
      }
      
      const historyItems = container.querySelectorAll('.history-item');
      expect(historyItems.length).toBe(2);
    });

    it('clears history when clear button is clicked', async () => {
      const { container } = render(CalculatorWidget);
      
      // Create a history entry
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '+' }));
      await fireEvent.click(screen.getByRole('button', { name: '2' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      
      expect(container.querySelector('.history-item')).toBeTruthy();
      
      // Clear history
      const clearBtn = container.querySelector('.clear-history');
      if (clearBtn) {
        await fireEvent.click(clearBtn);
      }
      
      expect(container.querySelector('.history-item')).toBeFalsy();
    });

    it('uses history result when clicked', async () => {
      const { container } = render(CalculatorWidget);
      
      // Create a history entry
      await fireEvent.click(screen.getByRole('button', { name: '7' }));
      await fireEvent.click(screen.getByRole('button', { name: '×' }));
      await fireEvent.click(screen.getByRole('button', { name: '6' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      
      // Clear display
      await fireEvent.click(screen.getByRole('button', { name: 'C' }));
      expect(screen.getByText('0')).toBeTruthy();
      
      // Click history item
      const historyItem = container.querySelector('.history-item');
      if (historyItem) {
        await fireEvent.click(historyItem);
      }
      
      expect(screen.getByText('42')).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('handles decimal at start of input', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '.' }));
      await fireEvent.click(screen.getByRole('button', { name: '5' }));
      expect(screen.getByText('0.5')).toBeTruthy();
    });

    it('handles negative results', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '3' }));
      await fireEvent.click(screen.getByRole('button', { name: '-' }));
      await fireEvent.click(screen.getByRole('button', { name: '7' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('-4')).toBeTruthy();
    });

    it('handles decimal division results', async () => {
      render(CalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '1' }));
      await fireEvent.click(screen.getByRole('button', { name: '÷' }));
      await fireEvent.click(screen.getByRole('button', { name: '4' }));
      await fireEvent.click(screen.getByRole('button', { name: '=' }));
      expect(screen.getByText('0.25')).toBeTruthy();
    });
  });
});
