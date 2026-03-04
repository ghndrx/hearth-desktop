/**
 * TimestampConverterWidget.test.ts
 * Tests for the Unix Timestamp Converter widget
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import TimestampConverterWidget from './TimestampConverterWidget.svelte';

describe('TimestampConverterWidget', () => {
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'));
    Object.assign(navigator, { clipboard: mockClipboard });
    mockClipboard.writeText.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders the widget with header', () => {
      render(TimestampConverterWidget);
      expect(screen.getByText('⏱️ Timestamp Converter')).toBeTruthy();
    });

    it('renders input field with placeholder', () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      expect(input).toBeTruthy();
    });

    it('renders mode toggle button', () => {
      render(TimestampConverterWidget);
      const toggle = screen.getByTitle('Switch input mode');
      expect(toggle).toBeTruthy();
      expect(toggle.textContent).toContain('🔢 → 📅');
    });

    it('renders Now button', () => {
      render(TimestampConverterWidget);
      expect(screen.getByTitle('Set to current time')).toBeTruthy();
    });

    it('shows current time section by default', () => {
      render(TimestampConverterWidget);
      expect(screen.getByText('Now:')).toBeTruthy();
    });
  });

  describe('current time display', () => {
    it('displays current Unix timestamp', () => {
      render(TimestampConverterWidget);
      // March 15, 2024 12:00:00 UTC = 1710504000 seconds
      expect(screen.getByText('1710504000')).toBeTruthy();
    });

    it('updates current time every second', async () => {
      render(TimestampConverterWidget);
      expect(screen.getByText('1710504000')).toBeTruthy();
      
      vi.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('1710504001')).toBeTruthy();
      });
    });

    it('copies current timestamp when clicked', async () => {
      render(TimestampConverterWidget);
      const timeButton = screen.getByTitle('Copy current Unix timestamp');
      await fireEvent.click(timeButton);
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('1710504000');
    });
  });

  describe('timestamp to date conversion', () => {
    it('converts Unix timestamp in seconds', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(() => {
        expect(screen.getByText('1609459200')).toBeTruthy();
        expect(screen.getByText('2021-01-01T00:00:00.000Z')).toBeTruthy();
      });
    });

    it('detects and converts Unix timestamp in milliseconds', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // Timestamp > 32503680000 is treated as milliseconds
      await fireEvent.input(input, { target: { value: '1609459200000' } });
      
      await waitFor(() => {
        // Should convert to seconds
        expect(screen.getByText('1609459200')).toBeTruthy();
        // Milliseconds display
        expect(screen.getByText('1609459200000')).toBeTruthy();
      });
    });

    it('shows error for invalid timestamp', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: 'not-a-number' } });
      
      await waitFor(() => {
        expect(screen.getByText('Invalid timestamp')).toBeTruthy();
      });
    });

    it('displays multiple date formats', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(() => {
        // Check format labels
        expect(screen.getByText('Unix (seconds)')).toBeTruthy();
        expect(screen.getByText('Unix (ms)')).toBeTruthy();
        expect(screen.getByText('ISO 8601')).toBeTruthy();
        expect(screen.getByText('Local')).toBeTruthy();
        expect(screen.getByText('UTC')).toBeTruthy();
        expect(screen.getByText('Relative')).toBeTruthy();
      });
    });
  });

  describe('date to timestamp conversion', () => {
    it('switches to date input mode', async () => {
      render(TimestampConverterWidget);
      const toggle = screen.getByTitle('Switch input mode');
      
      await fireEvent.click(toggle);
      
      expect(toggle.textContent).toContain('📅 → 🔢');
      expect(screen.getByPlaceholderText('Enter date (ISO, RFC, etc.)...')).toBeTruthy();
    });

    it('converts ISO date string to timestamp', async () => {
      render(TimestampConverterWidget);
      const toggle = screen.getByTitle('Switch input mode');
      await fireEvent.click(toggle);
      
      const input = screen.getByPlaceholderText('Enter date (ISO, RFC, etc.)...');
      await fireEvent.input(input, { target: { value: '2021-01-01T00:00:00Z' } });
      
      await waitFor(() => {
        expect(screen.getByText('1609459200')).toBeTruthy();
      });
    });

    it('shows error for invalid date format', async () => {
      render(TimestampConverterWidget);
      const toggle = screen.getByTitle('Switch input mode');
      await fireEvent.click(toggle);
      
      const input = screen.getByPlaceholderText('Enter date (ISO, RFC, etc.)...');
      await fireEvent.input(input, { target: { value: 'invalid-date' } });
      
      await waitFor(() => {
        expect(screen.getByText('Invalid date format')).toBeTruthy();
      });
    });

    it('clears input when toggling modes', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      const toggle = screen.getByTitle('Switch input mode');
      await fireEvent.click(toggle);
      
      const newInput = screen.getByPlaceholderText('Enter date (ISO, RFC, etc.)...');
      expect((newInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('now button', () => {
    it('sets timestamp to current time in timestamp mode', async () => {
      render(TimestampConverterWidget);
      const nowBtn = screen.getByTitle('Set to current time');
      
      await fireEvent.click(nowBtn);
      
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      expect((input as HTMLInputElement).value).toBe('1710504000');
    });

    it('sets ISO date in date mode', async () => {
      render(TimestampConverterWidget);
      const toggle = screen.getByTitle('Switch input mode');
      await fireEvent.click(toggle);
      
      const nowBtn = screen.getByTitle('Set to current time');
      await fireEvent.click(nowBtn);
      
      const input = screen.getByPlaceholderText('Enter date (ISO, RFC, etc.)...');
      expect((input as HTMLInputElement).value).toBe('2024-03-15T12:00:00.000Z');
    });
  });

  describe('relative time calculation', () => {
    it('shows "seconds ago" for recent past', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 30 seconds ago
      await fireEvent.input(input, { target: { value: '1710503970' } });
      
      await waitFor(() => {
        expect(screen.getByText('30 seconds ago')).toBeTruthy();
      });
    });

    it('shows "minutes ago" for past within hour', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 5 minutes ago
      await fireEvent.input(input, { target: { value: '1710503700' } });
      
      await waitFor(() => {
        expect(screen.getByText('5 minutes ago')).toBeTruthy();
      });
    });

    it('shows "hours ago" for past within day', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 3 hours ago
      await fireEvent.input(input, { target: { value: '1710493200' } });
      
      await waitFor(() => {
        expect(screen.getByText('3 hours ago')).toBeTruthy();
      });
    });

    it('shows "days ago" for past within month', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 7 days ago
      await fireEvent.input(input, { target: { value: '1709899200' } });
      
      await waitFor(() => {
        expect(screen.getByText('7 days ago')).toBeTruthy();
      });
    });

    it('shows "in X seconds" for near future', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 30 seconds in the future
      await fireEvent.input(input, { target: { value: '1710504030' } });
      
      await waitFor(() => {
        expect(screen.getByText('in 30 seconds')).toBeTruthy();
      });
    });

    it('shows "in X minutes" for future within hour', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 10 minutes in the future
      await fireEvent.input(input, { target: { value: '1710504600' } });
      
      await waitFor(() => {
        expect(screen.getByText('in 10 minutes')).toBeTruthy();
      });
    });

    it('handles singular units correctly', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // 1 minute ago
      await fireEvent.input(input, { target: { value: '1710503940' } });
      
      await waitFor(() => {
        expect(screen.getByText('1 minute ago')).toBeTruthy();
      });
    });
  });

  describe('copy to clipboard', () => {
    it('copies Unix seconds when clicked', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(async () => {
        const unixRow = screen.getByText('Unix (seconds)').closest('.result-row');
        const copyBtn = unixRow?.querySelector('.result-value');
        if (copyBtn) {
          await fireEvent.click(copyBtn);
          expect(mockClipboard.writeText).toHaveBeenCalledWith('1609459200');
        }
      });
    });

    it('copies Unix milliseconds when clicked', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(async () => {
        const msRow = screen.getByText('Unix (ms)').closest('.result-row');
        const copyBtn = msRow?.querySelector('.result-value');
        if (copyBtn) {
          await fireEvent.click(copyBtn);
          expect(mockClipboard.writeText).toHaveBeenCalledWith('1609459200000');
        }
      });
    });

    it('copies ISO date when clicked', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(async () => {
        const isoRow = screen.getByText('ISO 8601').closest('.result-row');
        const copyBtn = isoRow?.querySelector('.result-value');
        if (copyBtn) {
          await fireEvent.click(copyBtn);
          expect(mockClipboard.writeText).toHaveBeenCalledWith('2021-01-01T00:00:00.000Z');
        }
      });
    });

    it('shows copied badge after copying', async () => {
      const { container } = render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(async () => {
        const unixRow = screen.getByText('Unix (seconds)').closest('.result-row');
        const copyBtn = unixRow?.querySelector('.result-value');
        if (copyBtn) {
          await fireEvent.click(copyBtn);
          expect(container.querySelector('.copied-badge')).toBeTruthy();
        }
      });
    });

    it('hides copied badge after timeout', async () => {
      const { container } = render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      await fireEvent.input(input, { target: { value: '1609459200' } });
      
      await waitFor(async () => {
        const unixRow = screen.getByText('Unix (seconds)').closest('.result-row');
        const copyBtn = unixRow?.querySelector('.result-value');
        if (copyBtn) {
          await fireEvent.click(copyBtn);
        }
      });
      
      // Advance timers past the 1500ms timeout
      vi.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(container.querySelector('.copied-badge')).toBeFalsy();
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty input', async () => {
      const { container } = render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '' } });
      
      // Should not show results or errors
      expect(container.querySelector('.results')).toBeFalsy();
      expect(container.querySelector('.error')).toBeFalsy();
    });

    it('handles whitespace-only input', async () => {
      const { container } = render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '   ' } });
      
      expect(container.querySelector('.results')).toBeFalsy();
    });

    it('handles epoch timestamp (0)', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '0' } });
      
      await waitFor(() => {
        expect(screen.getByText('1970-01-01T00:00:00.000Z')).toBeTruthy();
      });
    });

    it('handles negative timestamps (pre-epoch dates)', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      await fireEvent.input(input, { target: { value: '-86400' } });
      
      await waitFor(() => {
        // Dec 31, 1969
        expect(screen.getByText('1969-12-31T00:00:00.000Z')).toBeTruthy();
      });
    });

    it('handles very large future timestamps', async () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      
      // Year 2100
      await fireEvent.input(input, { target: { value: '4102444800' } });
      
      await waitFor(() => {
        expect(screen.getByText('2100-01-01T00:00:00.000Z')).toBeTruthy();
      });
    });
  });

  describe('accessibility', () => {
    it('input has proper role', () => {
      render(TimestampConverterWidget);
      const input = screen.getByPlaceholderText('Enter Unix timestamp...');
      expect(input.tagName).toBe('INPUT');
    });

    it('mode toggle has descriptive title', () => {
      render(TimestampConverterWidget);
      expect(screen.getByTitle('Switch input mode')).toBeTruthy();
    });

    it('now button has descriptive title', () => {
      render(TimestampConverterWidget);
      expect(screen.getByTitle('Set to current time')).toBeTruthy();
    });

    it('current time button has descriptive title', () => {
      render(TimestampConverterWidget);
      expect(screen.getByTitle('Copy current Unix timestamp')).toBeTruthy();
    });
  });
});
