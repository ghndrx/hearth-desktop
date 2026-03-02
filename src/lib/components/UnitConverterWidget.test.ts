/**
 * UnitConverterWidget.test.ts
 * Tests for the UnitConverterWidget component
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import UnitConverterWidget from './UnitConverterWidget.svelte';

describe('UnitConverterWidget', () => {
  describe('rendering', () => {
    it('renders with default length category', () => {
      render(UnitConverterWidget);
      expect(screen.getByText('Length')).toBeTruthy();
      expect(screen.getByText('📏')).toBeTruthy();
    });

    it('renders in compact mode when prop is set', () => {
      const { container } = render(UnitConverterWidget, { props: { compact: true } });
      expect(container.querySelector('.compact')).toBeTruthy();
    });

    it('shows input field and result', () => {
      render(UnitConverterWidget);
      const input = screen.getByPlaceholderText('Enter value');
      expect(input).toBeTruthy();
      expect((input as HTMLInputElement).value).toBe('1');
    });

    it('shows unit dropdowns', () => {
      const { container } = render(UnitConverterWidget);
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBe(2);
    });
  });

  describe('category selection', () => {
    it('opens category picker when clicked', async () => {
      const { container } = render(UnitConverterWidget);
      const categoryBtn = container.querySelector('.category-btn');
      expect(categoryBtn).toBeTruthy();
      
      await fireEvent.click(categoryBtn!);
      expect(container.querySelector('.category-dropdown')).toBeTruthy();
    });

    it('shows all available categories', async () => {
      const { container } = render(UnitConverterWidget);
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      
      const categories = ['Length', 'Weight', 'Temperature', 'Time', 'Data', 'Volume'];
      categories.forEach(cat => {
        expect(screen.getByText(cat)).toBeTruthy();
      });
    });

    it('switches to weight category', async () => {
      const { container } = render(UnitConverterWidget);
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      
      const weightOption = screen.getByText('Weight');
      await fireEvent.click(weightOption);
      
      expect(container.querySelector('.category-dropdown')).toBeFalsy();
      expect(screen.getByText('Weight')).toBeTruthy();
      expect(screen.getByText('⚖️')).toBeTruthy();
    });

    it('switches to temperature category', async () => {
      const { container } = render(UnitConverterWidget);
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      
      const tempOption = screen.getByText('Temperature');
      await fireEvent.click(tempOption);
      
      expect(screen.getByText('🌡️')).toBeTruthy();
    });
  });

  describe('length conversions', () => {
    it('converts meters to feet', async () => {
      const { container } = render(UnitConverterWidget);
      const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement;
      
      // Set input to 1
      await fireEvent.input(input, { target: { value: '1' } });
      
      // Default is m to ft, 1m ≈ 3.28084ft
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toContain('3.28');
    });

    it('converts feet to meters', async () => {
      const { container } = render(UnitConverterWidget);
      const selects = container.querySelectorAll('select');
      const fromSelect = selects[0];
      const toSelect = selects[1];
      
      await fireEvent.change(fromSelect, { target: { value: 'ft' } });
      await fireEvent.change(toSelect, { target: { value: 'm' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '10' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toContain('3.04');
    });

    it('converts kilometers to miles', async () => {
      const { container } = render(UnitConverterWidget);
      const selects = container.querySelectorAll('select');
      
      await fireEvent.change(selects[0], { target: { value: 'km' } });
      await fireEvent.change(selects[1], { target: { value: 'mi' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '5' } });
      
      const result = container.querySelector('.result-value');
      // 5km ≈ 3.107 miles
      expect(result?.textContent).toContain('3.1');
    });
  });

  describe('temperature conversions', () => {
    it('converts Celsius to Fahrenheit', async () => {
      const { container } = render(UnitConverterWidget);
      
      // Switch to temperature
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Temperature'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'c' } });
      await fireEvent.change(selects[1], { target: { value: 'f' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '0' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toBe('32');
    });

    it('converts Fahrenheit to Celsius', async () => {
      const { container } = render(UnitConverterWidget);
      
      // Switch to temperature
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Temperature'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'f' } });
      await fireEvent.change(selects[1], { target: { value: 'c' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '212' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toBe('100');
    });

    it('converts Celsius to Kelvin', async () => {
      const { container } = render(UnitConverterWidget);
      
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Temperature'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'c' } });
      await fireEvent.change(selects[1], { target: { value: 'k' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '0' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toContain('273.15');
    });
  });

  describe('weight conversions', () => {
    it('converts kilograms to pounds', async () => {
      const { container } = render(UnitConverterWidget);
      
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Weight'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'kg' } });
      await fireEvent.change(selects[1], { target: { value: 'lb' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '1' } });
      
      const result = container.querySelector('.result-value');
      // 1kg ≈ 2.205 lb
      expect(result?.textContent).toContain('2.2');
    });
  });

  describe('data conversions', () => {
    it('converts megabytes to gigabytes', async () => {
      const { container } = render(UnitConverterWidget);
      
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Data'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'mb' } });
      await fireEvent.change(selects[1], { target: { value: 'gb' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '1024' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toBe('1');
    });
  });

  describe('swap functionality', () => {
    it('swaps units when swap button clicked', async () => {
      const { container } = render(UnitConverterWidget);
      const selects = container.querySelectorAll('select');
      
      // Get initial values
      const fromBefore = (selects[0] as HTMLSelectElement).value;
      const toBefore = (selects[1] as HTMLSelectElement).value;
      
      const swapBtn = screen.getByRole('button', { name: 'Swap units' });
      await fireEvent.click(swapBtn);
      
      const fromAfter = (selects[0] as HTMLSelectElement).value;
      const toAfter = (selects[1] as HTMLSelectElement).value;
      
      expect(fromAfter).toBe(toBefore);
      expect(toAfter).toBe(fromBefore);
    });
  });

  describe('input handling', () => {
    it('handles decimal input', async () => {
      const { container } = render(UnitConverterWidget);
      const input = screen.getByPlaceholderText('Enter value');
      
      await fireEvent.input(input, { target: { value: '2.5' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).not.toBe('—');
    });

    it('handles invalid input', async () => {
      const { container } = render(UnitConverterWidget);
      const input = screen.getByPlaceholderText('Enter value');
      
      await fireEvent.input(input, { target: { value: 'abc' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toBe('—');
    });

    it('handles empty input', async () => {
      const { container } = render(UnitConverterWidget);
      const input = screen.getByPlaceholderText('Enter value');
      
      await fireEvent.input(input, { target: { value: '' } });
      
      const result = container.querySelector('.result-value');
      expect(result?.textContent).toBe('—');
    });

    it('handles very large numbers with scientific notation', async () => {
      const { container } = render(UnitConverterWidget);
      
      // Switch to data
      const categoryBtn = container.querySelector('.category-btn');
      await fireEvent.click(categoryBtn!);
      await fireEvent.click(screen.getByText('Data'));
      
      const selects = container.querySelectorAll('select');
      await fireEvent.change(selects[0], { target: { value: 'tb' } });
      await fireEvent.change(selects[1], { target: { value: 'b' } });
      
      const input = screen.getByPlaceholderText('Enter value');
      await fireEvent.input(input, { target: { value: '1000' } });
      
      const result = container.querySelector('.result-value');
      // Should show in scientific notation
      expect(result?.textContent).toContain('e');
    });
  });

  describe('conversion label', () => {
    it('shows full conversion in label', async () => {
      const { container } = render(UnitConverterWidget);
      const label = container.querySelector('.conversion-label');
      
      expect(label?.textContent).toContain('M');
      expect(label?.textContent).toContain('FT');
      expect(label?.textContent).toContain('=');
    });
  });
});
