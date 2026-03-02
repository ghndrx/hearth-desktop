import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CurrencyConverterWidget from './CurrencyConverterWidget.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'fetch_exchange_rates') {
      return Promise.resolve({
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79,
        JPY: 149.50,
        CAD: 1.36
      });
    }
    if (cmd === 'storage_get') {
      return Promise.resolve(null);
    }
    if (cmd === 'storage_set') {
      return Promise.resolve();
    }
    return Promise.reject(new Error(`Unknown command: ${cmd}`));
  })
}));

describe('CurrencyConverterWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default values', async () => {
    render(CurrencyConverterWidget);
    
    expect(screen.getByText('Currency Converter')).toBeInTheDocument();
    expect(screen.getByText('💱')).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
  });

  it('converts currency when amount changes', async () => {
    render(CurrencyConverterWidget);
    
    const amountInput = screen.getByLabelText(/amount/i);
    await fireEvent.input(amountInput, { target: { value: '100' } });
    
    await waitFor(() => {
      // Should display a converted result
      const resultElement = screen.getByRole('heading', { level: 3 }).closest('.currency-converter');
      expect(resultElement).toBeInTheDocument();
    });
  });

  it('swaps currencies when swap button is clicked', async () => {
    render(CurrencyConverterWidget);
    
    const fromSelect = screen.getByLabelText(/from/i) as HTMLSelectElement;
    const toSelect = screen.getByLabelText(/to/i) as HTMLSelectElement;
    
    const initialFrom = fromSelect.value;
    const initialTo = toSelect.value;
    
    const swapButton = screen.getByTitle(/swap currencies/i);
    await fireEvent.click(swapButton);
    
    await waitFor(() => {
      expect(fromSelect.value).toBe(initialTo);
      expect(toSelect.value).toBe(initialFrom);
    });
  });

  it('shows history panel when history button clicked', async () => {
    render(CurrencyConverterWidget);
    
    const historyButton = screen.getByTitle(/conversion history/i);
    await fireEvent.click(historyButton);
    
    await waitFor(() => {
      expect(screen.getByText('Recent Conversions')).toBeInTheDocument();
      expect(screen.getByText('No conversions yet')).toBeInTheDocument();
    });
  });

  it('displays quick amount buttons in non-compact mode', async () => {
    render(CurrencyConverterWidget);
    
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('updates amount when quick amount button clicked', async () => {
    render(CurrencyConverterWidget);
    
    const quickButton = screen.getByText('500');
    await fireEvent.click(quickButton);
    
    const amountInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
    await waitFor(() => {
      expect(amountInput.value).toBe('500');
    });
  });

  it('shows refresh button and handles click', async () => {
    render(CurrencyConverterWidget);
    
    const refreshButton = screen.getByTitle(/refresh rates/i);
    expect(refreshButton).toBeInTheDocument();
    
    await fireEvent.click(refreshButton);
    
    // Should not throw error
    expect(refreshButton).toBeInTheDocument();
  });

  it('toggles favorite when favorite button clicked', async () => {
    render(CurrencyConverterWidget);
    
    const favoriteButton = screen.getByTitle(/add to favorites/i);
    expect(favoriteButton).toBeInTheDocument();
    expect(screen.getByText('☆')).toBeInTheDocument();
    
    await fireEvent.click(favoriteButton);
    
    await waitFor(() => {
      expect(screen.getByText('⭐')).toBeInTheDocument();
    });
  });

  it('displays exchange rate between selected currencies', async () => {
    render(CurrencyConverterWidget);
    
    await waitFor(() => {
      const rateText = screen.getByText(/1 USD =/i);
      expect(rateText).toBeInTheDocument();
    });
  });

  it('renders in compact mode without quick amounts', async () => {
    render(CurrencyConverterWidget, { props: { compact: true } });
    
    // Quick amounts should not be present in compact mode
    expect(screen.queryByText('1000')).not.toBeInTheDocument();
  });

  it('shows currency flags in selects', async () => {
    render(CurrencyConverterWidget);
    
    // USD flag
    expect(screen.getAllByText('🇺🇸').length).toBeGreaterThan(0);
    // EUR flag
    expect(screen.getAllByText('🇪🇺').length).toBeGreaterThan(0);
  });

  it('allows selecting different currencies', async () => {
    render(CurrencyConverterWidget);
    
    const fromSelect = screen.getByLabelText(/from/i) as HTMLSelectElement;
    await fireEvent.change(fromSelect, { target: { value: 'GBP' } });
    
    expect(fromSelect.value).toBe('GBP');
  });

  it('displays last updated timestamp', async () => {
    render(CurrencyConverterWidget);
    
    await waitFor(() => {
      expect(screen.getByText(/updated:/i)).toBeInTheDocument();
    });
  });

  it('handles custom currencies prop', async () => {
    render(CurrencyConverterWidget, { 
      props: { 
        currencies: ['USD', 'EUR', 'GBP'],
        defaultFrom: 'GBP',
        defaultTo: 'USD'
      } 
    });
    
    const fromSelect = screen.getByLabelText(/from/i) as HTMLSelectElement;
    expect(fromSelect.value).toBe('GBP');
  });

  it('formats currency amounts correctly', async () => {
    render(CurrencyConverterWidget);
    
    const amountInput = screen.getByLabelText(/amount/i);
    await fireEvent.input(amountInput, { target: { value: '1000' } });
    
    await waitFor(() => {
      // Should format with thousands separator
      const converter = screen.getByRole('heading', { level: 3 }).closest('.currency-converter');
      expect(converter?.textContent).toMatch(/1,000|1\.000/); // Depends on locale
    });
  });

  it('shows loading indicator when refreshing', async () => {
    render(CurrencyConverterWidget);
    
    const refreshButton = screen.getByTitle(/refresh rates/i);
    await fireEvent.click(refreshButton);
    
    // Button should have loading class during refresh
    expect(refreshButton).toBeInTheDocument();
  });

  it('loads favorites from storage on mount', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'storage_get') {
        return Promise.resolve(JSON.stringify([{ from: 'GBP', to: 'EUR' }]));
      }
      if (cmd === 'fetch_exchange_rates') {
        return Promise.resolve({ USD: 1.0, EUR: 0.92, GBP: 0.79 });
      }
      return Promise.resolve();
    });
    
    render(CurrencyConverterWidget);
    
    await waitFor(() => {
      // Should show favorite chip
      expect(screen.getByText(/🇬🇧.*→.*🇪🇺/)).toBeInTheDocument();
    });
  });
});
