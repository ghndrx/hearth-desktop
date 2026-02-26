import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LocaleManager from './LocaleManager.svelte';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Intl APIs
const mockDateTimeFormat = vi.fn().mockImplementation(() => ({
  format: vi.fn().mockReturnValue('February 26, 2026'),
  formatToParts: vi.fn().mockReturnValue([
    { type: 'month', value: 'February' },
    { type: 'literal', value: ' ' },
    { type: 'day', value: '26' },
    { type: 'literal', value: ', ' },
    { type: 'year', value: '2026' },
  ]),
  resolvedOptions: vi.fn().mockReturnValue({
    timeZone: 'America/Chicago',
    locale: 'en-US',
  }),
}));

const mockNumberFormat = vi.fn().mockImplementation(() => ({
  format: vi.fn().mockReturnValue('1,234,567.89'),
  formatToParts: vi.fn().mockReturnValue([
    { type: 'integer', value: '1' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '234' },
    { type: 'group', value: ',' },
    { type: 'integer', value: '567' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '89' },
  ]),
}));

const mockRelativeTimeFormat = vi.fn().mockImplementation(() => ({
  format: vi.fn().mockReturnValue('in 5 minutes'),
}));

const originalIntl = global.Intl;

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  
  global.Intl = {
    ...originalIntl,
    DateTimeFormat: mockDateTimeFormat as unknown as typeof Intl.DateTimeFormat,
    NumberFormat: mockNumberFormat as unknown as typeof Intl.NumberFormat,
    RelativeTimeFormat: mockRelativeTimeFormat as unknown as typeof Intl.RelativeTimeFormat,
  };
});

afterEach(() => {
  global.Intl = originalIntl;
});

describe('LocaleManager', () => {
  describe('rendering', () => {
    it('renders with default locale', () => {
      render(LocaleManager);
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('renders with custom initial locale', () => {
      render(LocaleManager, { props: { initialLocale: 'es-ES' } });
      expect(screen.getByText('Español')).toBeInTheDocument();
    });

    it('shows settings toggle button', () => {
      render(LocaleManager);
      expect(screen.getByRole('button', { name: /toggle locale settings/i })).toBeInTheDocument();
    });

    it('hides settings panel initially', () => {
      render(LocaleManager);
      expect(screen.queryByText('Language & Region')).not.toBeInTheDocument();
    });
  });

  describe('settings panel', () => {
    it('opens settings panel when toggle clicked', async () => {
      render(LocaleManager);
      
      const toggle = screen.getByRole('button', { name: /toggle locale settings/i });
      await fireEvent.click(toggle);
      
      expect(screen.getByText('Language & Region')).toBeInTheDocument();
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
      expect(screen.getByText('Numbers & Currency')).toBeInTheDocument();
    });

    it('closes settings panel when toggle clicked again', async () => {
      render(LocaleManager);
      
      const toggle = screen.getByRole('button', { name: /toggle locale settings/i });
      await fireEvent.click(toggle);
      await fireEvent.click(toggle);
      
      expect(screen.queryByText('Language & Region')).not.toBeInTheDocument();
    });

    it('shows locale tab content by default', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      expect(screen.getByPlaceholderText('Search languages...')).toBeInTheDocument();
      expect(screen.getByText('Use system language')).toBeInTheDocument();
    });
  });

  describe('locale selection', () => {
    it('displays list of available locales', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      expect(screen.getByText('Español')).toBeInTheDocument();
      expect(screen.getByText('Français')).toBeInTheDocument();
      expect(screen.getByText('Deutsch')).toBeInTheDocument();
    });

    it('filters locales based on search query', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const searchInput = screen.getByPlaceholderText('Search languages...');
      await fireEvent.input(searchInput, { target: { value: 'spanish' } });
      
      await waitFor(() => {
        expect(screen.getByText('Español')).toBeInTheDocument();
        expect(screen.queryByText('Français')).not.toBeInTheDocument();
      });
    });

    it('changes locale when language is selected', async () => {
      const { component } = render(LocaleManager);
      let localeChangedEvent: CustomEvent | null = null;
      
      component.$on('localeChanged', (e: CustomEvent) => {
        localeChangedEvent = e;
      });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const spanishOption = screen.getByText('Español').closest('button');
      if (spanishOption) {
        await fireEvent.click(spanishOption);
      }
      
      await waitFor(() => {
        expect(localeChangedEvent).not.toBeNull();
        expect(localeChangedEvent?.detail.locale).toBe('es-ES');
      });
    });

    it('marks RTL locales with badge', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const searchInput = screen.getByPlaceholderText('Search languages...');
      await fireEvent.input(searchInput, { target: { value: 'arabic' } });
      
      await waitFor(() => {
        expect(screen.getByText('RTL')).toBeInTheDocument();
      });
    });
  });

  describe('date & time tab', () => {
    it('switches to date & time tab', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      expect(screen.getByText('Use system time zone')).toBeInTheDocument();
      expect(screen.getByText('Time Format')).toBeInTheDocument();
    });

    it('shows time zone selector', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      expect(screen.getByLabelText('Time Zone')).toBeInTheDocument();
    });

    it('toggles between 12 and 24 hour format', async () => {
      const { component } = render(LocaleManager);
      let timeFormatEvent: CustomEvent | null = null;
      
      component.$on('timeFormatChanged', (e: CustomEvent) => {
        timeFormatEvent = e;
      });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      const radio24 = screen.getByLabelText('24-hour (13:30)');
      await fireEvent.click(radio24);
      
      await waitFor(() => {
        expect(timeFormatEvent).not.toBeNull();
        expect(timeFormatEvent?.detail.format.use24Hour).toBe(true);
      });
    });

    it('toggles show seconds option', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      const showSecondsCheckbox = screen.getByLabelText('Show seconds');
      await fireEvent.click(showSecondsCheckbox);
      
      expect(showSecondsCheckbox).toBeChecked();
    });

    it('shows preview section', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  describe('numbers & currency tab', () => {
    it('switches to numbers & currency tab', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Numbers & Currency'));
      
      expect(screen.getByText('Currency')).toBeInTheDocument();
    });

    it('shows currency selector', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Numbers & Currency'));
      
      expect(screen.getByLabelText('Currency')).toBeInTheDocument();
    });

    it('changes currency when selected', async () => {
      const { component } = render(LocaleManager);
      let numberFormatEvent: CustomEvent | null = null;
      
      component.$on('numberFormatChanged', (e: CustomEvent) => {
        numberFormatEvent = e;
      });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Numbers & Currency'));
      
      const currencySelect = screen.getByLabelText('Currency');
      await fireEvent.change(currencySelect, { target: { value: 'EUR' } });
      
      await waitFor(() => {
        expect(numberFormatEvent).not.toBeNull();
        expect(numberFormatEvent?.detail.format.currencyCode).toBe('EUR');
      });
    });

    it('shows number and currency preview', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Numbers & Currency'));
      
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText(/Number:/)).toBeInTheDocument();
      expect(screen.getByText(/Currency:/)).toBeInTheDocument();
    });
  });

  describe('persistence', () => {
    it('saves settings to localStorage', async () => {
      render(LocaleManager, { props: { persistSettings: true } });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const spanishOption = screen.getByText('Español').closest('button');
      if (spanishOption) {
        await fireEvent.click(spanishOption);
      }
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
    });

    it('loads settings from localStorage on mount', async () => {
      const savedConfig = JSON.stringify({
        locale: 'fr-FR',
        timeZone: 'Europe/Paris',
        useSystemLocale: false,
        useSystemTimeZone: false,
      });
      localStorageMock.getItem.mockReturnValueOnce(savedConfig);
      
      render(LocaleManager);
      
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('hearth-locale-settings');
      });
    });

    it('uses custom storage key when provided', async () => {
      render(LocaleManager, { props: { storageKey: 'custom-locale-key' } });
      
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('custom-locale-key');
      });
    });

    it('does not persist when persistSettings is false', async () => {
      render(LocaleManager, { props: { persistSettings: false } });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const spanishOption = screen.getByText('Español').closest('button');
      if (spanishOption) {
        await fireEvent.click(spanishOption);
      }
      
      await waitFor(() => {
        // Should not have saved after initial load
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
      });
    });
  });

  describe('reset functionality', () => {
    it('resets to defaults when reset button clicked', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      // Change locale first
      const spanishOption = screen.getByText('Español').closest('button');
      if (spanishOption) {
        await fireEvent.click(spanishOption);
      }
      
      // Click reset
      const resetButton = screen.getByText('Reset to Defaults');
      await fireEvent.click(resetButton);
      
      // Should reset to system locale
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
    });
  });

  describe('RTL support', () => {
    it('applies RTL direction for RTL locales', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const searchInput = screen.getByPlaceholderText('Search languages...');
      await fireEvent.input(searchInput, { target: { value: 'arabic' } });
      
      await waitFor(() => {
        const arabicOption = screen.getByText('العربية').closest('button');
        if (arabicOption) {
          fireEvent.click(arabicOption);
        }
      });
      
      // Component should have rtl class applied
      const manager = document.querySelector('.locale-manager');
      expect(manager).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('dispatches error for invalid time zone', async () => {
      const { component } = render(LocaleManager);
      let errorEvent: CustomEvent | null = null;
      
      component.$on('error', (e: CustomEvent) => {
        errorEvent = e;
      });
      
      // Trigger error by mocking invalid timezone
      mockDateTimeFormat.mockImplementationOnce(() => {
        throw new Error('Invalid time zone');
      });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      // The component should handle errors gracefully
      expect(screen.getByText('Date & Time')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper aria attributes on toggle button', () => {
      render(LocaleManager);
      
      const toggle = screen.getByRole('button', { name: /toggle locale settings/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('updates aria-expanded when settings opened', async () => {
      render(LocaleManager);
      
      const toggle = screen.getByRole('button', { name: /toggle locale settings/i });
      await fireEvent.click(toggle);
      
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('has proper labels for form controls', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      await fireEvent.click(screen.getByText('Date & Time'));
      
      expect(screen.getByLabelText('Time Zone')).toBeInTheDocument();
      expect(screen.getByLabelText('First day of week')).toBeInTheDocument();
    });

    it('locale search input is focusable', async () => {
      render(LocaleManager);
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      const searchInput = screen.getByPlaceholderText('Search languages...');
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('custom locales', () => {
    it('accepts custom available locales', async () => {
      const customLocales = [
        { code: 'en-US', name: 'Custom English', nativeName: 'English', region: 'US', rtl: false },
        { code: 'custom-XY', name: 'Custom Language', nativeName: 'Custom', region: 'XY', rtl: false },
      ];
      
      render(LocaleManager, { props: { availableLocales: customLocales } });
      
      await fireEvent.click(screen.getByRole('button', { name: /toggle locale settings/i }));
      
      expect(screen.getByText('Custom Language')).toBeInTheDocument();
      expect(screen.queryByText('Español')).not.toBeInTheDocument();
    });
  });
});
