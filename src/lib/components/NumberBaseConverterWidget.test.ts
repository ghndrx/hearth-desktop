import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NumberBaseConverterWidget from './NumberBaseConverterWidget.svelte';

describe('NumberBaseConverterWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders with default props', () => {
    render(NumberBaseConverterWidget);
    
    expect(screen.getByText('Base Converter')).toBeDefined();
    expect(screen.getByText('🔢')).toBeDefined();
    expect(screen.getByPlaceholderText(/enter decimal number/i)).toBeDefined();
  });

  it('renders in compact mode', () => {
    const { container } = render(NumberBaseConverterWidget, { compact: true });
    
    expect(container.querySelector('.compact')).toBeTruthy();
  });

  it('shows close button when onClose is provided', () => {
    const onClose = vi.fn();
    render(NumberBaseConverterWidget, { onClose });
    
    const closeBtn = screen.getByTitle('Close');
    expect(closeBtn).toBeDefined();
    
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('converts decimal to other bases', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '255' } });
    
    // Check binary conversion
    expect(screen.getByText(/1111 1111/)).toBeDefined();
    
    // Check hex conversion
    expect(screen.getByText(/FF/)).toBeDefined();
    
    // Check octal conversion
    expect(screen.getByText(/377/)).toBeDefined();
  });

  it('handles binary input', async () => {
    render(NumberBaseConverterWidget);
    
    // Select binary base
    const baseSelect = screen.getByRole('combobox');
    await fireEvent.change(baseSelect, { target: { value: '2' } });
    
    const input = screen.getByPlaceholderText(/enter binary number/i);
    await fireEvent.input(input, { target: { value: '1010' } });
    
    // Should show decimal 10
    expect(screen.getByText('10')).toBeDefined();
  });

  it('handles hexadecimal input', async () => {
    render(NumberBaseConverterWidget);
    
    // Select hex base
    const baseSelect = screen.getByRole('combobox');
    await fireEvent.change(baseSelect, { target: { value: '16' } });
    
    const input = screen.getByPlaceholderText(/enter hexadecimal number/i);
    await fireEvent.input(input, { target: { value: 'FF' } });
    
    // Should show decimal 255
    expect(screen.getByText('255')).toBeDefined();
  });

  it('shows error for invalid input', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: 'xyz' } });
    
    expect(screen.getByText(/invalid decimal number/i)).toBeDefined();
  });

  it('shows error for out of range values', async () => {
    render(NumberBaseConverterWidget);
    
    // 8-bit mode
    const bit8Btn = screen.getByText('8');
    await fireEvent.click(bit8Btn);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '256' } });
    
    expect(screen.getByText(/out of range/i)).toBeDefined();
  });

  it('supports different bit widths', async () => {
    render(NumberBaseConverterWidget);
    
    // Click 8-bit button
    const bit8Btn = screen.getByText('8');
    await fireEvent.click(bit8Btn);
    
    expect(bit8Btn.classList.contains('active')).toBe(true);
    
    // Click 64-bit button
    const bit64Btn = screen.getByText('64');
    await fireEvent.click(bit64Btn);
    
    expect(bit64Btn.classList.contains('active')).toBe(true);
  });

  it('supports signed mode', async () => {
    render(NumberBaseConverterWidget);
    
    const signedCheckbox = screen.getByRole('checkbox');
    await fireEvent.click(signedCheckbox);
    
    expect(signedCheckbox).toBeChecked();
  });

  it('clears input when clear button is clicked', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: '123' } });
    
    expect(input.value).toBe('123');
    
    const clearBtn = screen.getByTitle('Clear');
    await fireEvent.click(clearBtn);
    
    expect(input.value).toBe('');
  });

  it('copies value to clipboard', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '255' } });
    
    const copyBtns = screen.getAllByTitle('Copy raw value');
    await fireEvent.click(copyBtns[0]);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('shows sample value button when input is empty', () => {
    render(NumberBaseConverterWidget);
    
    expect(screen.getByText(/Try: 255/)).toBeDefined();
  });

  it('inserts sample value when sample button is clicked', async () => {
    render(NumberBaseConverterWidget);
    
    const sampleBtn = screen.getByText(/Try: 255/);
    await fireEvent.click(sampleBtn);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i) as HTMLInputElement;
    expect(input.value).toBe('255');
  });

  it('handles prefix detection (0x for hex)', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '0xFF' } });
    
    // Should detect as hex and show decimal 255
    expect(screen.getByText('255')).toBeDefined();
  });

  it('handles prefix detection (0b for binary)', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '0b1010' } });
    
    // Should detect as binary and show decimal 10
    expect(screen.getByText('10')).toBeDefined();
  });

  it('shows bit visualization in non-compact mode', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '5' } });
    
    expect(screen.getByText(/Bit Pattern/)).toBeDefined();
  });

  it('hides bit visualization in compact mode', async () => {
    render(NumberBaseConverterWidget, { compact: true });
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '5' } });
    
    expect(screen.queryByText(/Bit Pattern/)).toBeNull();
  });

  it('handles negative numbers in signed mode', async () => {
    render(NumberBaseConverterWidget);
    
    // Enable signed mode
    const signedCheckbox = screen.getByRole('checkbox');
    await fireEvent.click(signedCheckbox);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '-1' } });
    
    // Should show two's complement representation
    expect(screen.getByText(/Signed value:/)).toBeDefined();
  });

  it('allows using result as new input', async () => {
    render(NumberBaseConverterWidget);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '255' } });
    
    const useBtns = screen.getAllByTitle('Use as input');
    // Click the binary "use" button
    await fireEvent.click(useBtns[0]);
    
    // Input should now be in binary
    expect(screen.getByPlaceholderText(/enter binary number/i)).toBeDefined();
  });

  it('formats large numbers with grouping', async () => {
    render(NumberBaseConverterWidget);
    
    // Set 64-bit mode for larger numbers
    const bit64Btn = screen.getByText('64');
    await fireEvent.click(bit64Btn);
    
    const input = screen.getByPlaceholderText(/enter decimal number/i);
    await fireEvent.input(input, { target: { value: '1000000' } });
    
    // Decimal should be formatted with commas
    expect(screen.getByText('1,000,000')).toBeDefined();
  });
});
