import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CssUnitConverterWidget from './CssUnitConverterWidget.svelte';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
};

Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('CssUnitConverterWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render with title', () => {
    render(CssUnitConverterWidget);
    expect(screen.getByText('CSS Unit Converter')).toBeInTheDocument();
  });

  it('should render value input and unit select', () => {
    render(CssUnitConverterWidget);
    expect(screen.getByLabelText('Value to convert')).toBeInTheDocument();
    expect(screen.getByLabelText('Source unit')).toBeInTheDocument();
  });

  it('should default to 16px', () => {
    render(CssUnitConverterWidget);
    const input = screen.getByLabelText('Value to convert') as HTMLInputElement;
    expect(input.value).toBe('16');

    const select = screen.getByLabelText('Source unit') as HTMLSelectElement;
    expect(select.value).toBe('px');
  });

  it('should show conversion results', () => {
    render(CssUnitConverterWidget);
    // 16px = 1rem (with default 16px root font size)
    // Should show rem conversion
    const resultButtons = screen.getAllByRole('button').filter(
      btn => btn.classList.contains('result-row')
    );
    expect(resultButtons.length).toBeGreaterThan(0);
  });

  it('should convert 16px to 1rem correctly', async () => {
    const { container } = render(CssUnitConverterWidget);

    // Look for the rem result row that shows value "1"
    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      const remRow = Array.from(resultRows).find(row => {
        const unitEl = row.querySelector('.result-unit');
        return unitEl?.textContent?.trim() === 'rem';
      });
      expect(remRow).toBeTruthy();
      const valueEl = remRow?.querySelector('.result-value');
      expect(valueEl?.textContent?.trim()).toBe('1');
    });
  });

  it('should convert 16px to 12pt correctly', async () => {
    const { container } = render(CssUnitConverterWidget);

    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      const ptRow = Array.from(resultRows).find(row => {
        const unitEl = row.querySelector('.result-unit');
        return unitEl?.textContent?.trim() === 'pt';
      });
      expect(ptRow).toBeTruthy();
      const valueEl = ptRow?.querySelector('.result-value');
      expect(valueEl?.textContent?.trim()).toBe('12');
    });
  });

  it('should update conversions when input value changes', async () => {
    const { container } = render(CssUnitConverterWidget);
    const input = screen.getByLabelText('Value to convert');

    await fireEvent.input(input, { target: { value: '32' } });

    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      const remRow = Array.from(resultRows).find(row => {
        const unitEl = row.querySelector('.result-unit');
        return unitEl?.textContent?.trim() === 'rem';
      });
      const valueEl = remRow?.querySelector('.result-value');
      expect(valueEl?.textContent?.trim()).toBe('2');
    });
  });

  it('should update conversions when unit changes', async () => {
    const { container } = render(CssUnitConverterWidget);
    const select = screen.getByLabelText('Source unit');

    await fireEvent.change(select, { target: { value: 'rem' } });

    // When changing to rem, the px conversion should be different
    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      const pxRow = Array.from(resultRows).find(row => {
        const unitEl = row.querySelector('.result-unit');
        return unitEl?.textContent?.trim() === 'px';
      });
      expect(pxRow).toBeTruthy();
      // 16rem = 256px (with default 16px root font size)
      const valueEl = pxRow?.querySelector('.result-value');
      expect(valueEl?.textContent?.trim()).toBe('256');
    });
  });

  it('should apply preset when clicked', async () => {
    render(CssUnitConverterWidget);

    const preset24 = screen.getByText('24px');
    await fireEvent.click(preset24);

    const input = screen.getByLabelText('Value to convert') as HTMLInputElement;
    expect(input.value).toBe('24');
  });

  it('should toggle settings panel', async () => {
    render(CssUnitConverterWidget);

    const settingsBtn = screen.getByLabelText('Toggle settings');
    await fireEvent.click(settingsBtn);

    expect(screen.getByLabelText('Root font size:')).toBeInTheDocument();
  });

  it('should show viewport presets in settings', async () => {
    render(CssUnitConverterWidget);

    await fireEvent.click(screen.getByLabelText('Toggle settings'));

    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('4K')).toBeInTheDocument();
  });

  it('should apply viewport preset', async () => {
    render(CssUnitConverterWidget);

    await fireEvent.click(screen.getByLabelText('Toggle settings'));

    const mobileBtn = screen.getByText('Mobile');
    await fireEvent.click(mobileBtn);

    // Verify Mobile viewport preset was applied (375x667)
    const widthInput = screen.getByLabelText(/viewport-w/i) as HTMLInputElement;
    expect(widthInput.value).toBe('375');
  });

  it('should copy CSS value to clipboard when result row is clicked', async () => {
    const { container } = render(CssUnitConverterWidget);

    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      expect(resultRows.length).toBeGreaterThan(0);
    });

    const firstResult = container.querySelector('.result-row') as HTMLElement;
    await fireEvent.click(firstResult);

    expect(mockClipboard.writeText).toHaveBeenCalled();
  });

  it('should show copy feedback after copying', async () => {
    const { container } = render(CssUnitConverterWidget);

    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      expect(resultRows.length).toBeGreaterThan(0);
    });

    const firstResult = container.querySelector('.result-row') as HTMLElement;
    await fireEvent.click(firstResult);

    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('should display pixel preview', () => {
    const { container } = render(CssUnitConverterWidget);
    expect(container.querySelector('.preview-bar')).toBeInTheDocument();
  });

  it('should show visual preview label with pixel value', () => {
    render(CssUnitConverterWidget);
    // Default is 16px
    expect(screen.getByText(/Visual Preview.*16px/)).toBeInTheDocument();
  });

  it('should render unit type legend', () => {
    render(CssUnitConverterWidget);
    expect(screen.getByText('Absolute')).toBeInTheDocument();
    expect(screen.getByText('Relative')).toBeInTheDocument();
    expect(screen.getByText('Viewport')).toBeInTheDocument();
  });

  it('should show description for selected unit', () => {
    render(CssUnitConverterWidget);
    // Default is px
    expect(screen.getByText('Pixels - 1/96th of 1 inch')).toBeInTheDocument();
  });

  it('should update description when unit changes', async () => {
    render(CssUnitConverterWidget);
    const select = screen.getByLabelText('Source unit');

    await fireEvent.change(select, { target: { value: 'rem' } });

    expect(screen.getByText('Relative to root font size')).toBeInTheDocument();
  });

  it('should have proper aria attributes', () => {
    render(CssUnitConverterWidget);
    expect(screen.getByRole('application', { name: /css unit converter/i })).toBeInTheDocument();
  });

  it('should show preset buttons', () => {
    render(CssUnitConverterWidget);
    expect(screen.getByText('8px')).toBeInTheDocument();
    expect(screen.getByText('16px')).toBeInTheDocument();
    expect(screen.getByText('1rem')).toBeInTheDocument();
    expect(screen.getByText('100vw')).toBeInTheDocument();
  });

  it('should highlight active preset', async () => {
    render(CssUnitConverterWidget);

    // Default is 16px which should be active
    const presetBtn = screen.getByText('16px');
    expect(presetBtn.classList.contains('active')).toBe(true);
  });

  it('should convert inches correctly', async () => {
    const { container } = render(CssUnitConverterWidget);

    // 16px should be some fraction of an inch (16/96 = 0.1667 in)
    await waitFor(() => {
      const resultRows = container.querySelectorAll('.result-row');
      const inRow = Array.from(resultRows).find(row => {
        const unitEl = row.querySelector('.result-unit');
        return unitEl?.textContent?.trim() === 'in';
      });
      expect(inRow).toBeTruthy();
      const valueEl = inRow?.querySelector('.result-value');
      const value = parseFloat(valueEl?.textContent?.trim() || '0');
      expect(value).toBeCloseTo(16 / 96, 3);
    });
  });
});
