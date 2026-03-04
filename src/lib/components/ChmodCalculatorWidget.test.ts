import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ChmodCalculatorWidget from './ChmodCalculatorWidget.svelte';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined)
};
Object.assign(navigator, { clipboard: mockClipboard });

describe('ChmodCalculatorWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with header', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByText('Chmod Calculator')).toBeInTheDocument();
    });

    it('renders all three tabs', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByRole('tab', { name: 'Visual' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Numeric' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Symbolic' })).toBeInTheDocument();
    });

    it('shows visual tab by default', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByRole('tab', { name: 'Visual' })).toHaveAttribute('aria-selected', 'true');
    });

    it('renders permission grid in visual mode', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByText('Owner (u)')).toBeInTheDocument();
      expect(screen.getByText('Group (g)')).toBeInTheDocument();
      expect(screen.getByText('Others (o)')).toBeInTheDocument();
    });

    it('renders preset buttons', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByRole('button', { name: '755' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '644' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '777' })).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to numeric tab', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      expect(screen.getByLabelText(/Enter octal value/)).toBeInTheDocument();
    });

    it('switches to symbolic tab', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Symbolic' }));
      expect(screen.getByLabelText(/Enter symbolic value/)).toBeInTheDocument();
    });

    it('switches back to visual tab', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      await fireEvent.click(screen.getByRole('tab', { name: 'Visual' }));
      expect(screen.getByText('Owner (u)')).toBeInTheDocument();
    });
  });

  describe('Visual Mode', () => {
    it('toggles permission on click', async () => {
      render(ChmodCalculatorWidget);
      const ownerExecuteBtn = screen.getByRole('button', { name: /Owner \(u\) execute permission/ });
      
      // Initially off (default is 644)
      expect(ownerExecuteBtn).not.toHaveClass('active');
      
      await fireEvent.click(ownerExecuteBtn);
      expect(ownerExecuteBtn).toHaveClass('active');
    });

    it('updates results when permission changes', async () => {
      render(ChmodCalculatorWidget);
      
      // Default should be 644
      expect(screen.getByText('644')).toBeInTheDocument();
      
      // Toggle owner execute
      const ownerExecuteBtn = screen.getByRole('button', { name: /Owner \(u\) execute permission/ });
      await fireEvent.click(ownerExecuteBtn);
      
      // Should now show 744
      expect(screen.getByText('744')).toBeInTheDocument();
    });
  });

  describe('Preset Application', () => {
    it('applies 755 preset correctly', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '755' }));
      
      expect(screen.getByText('755')).toBeInTheDocument();
      expect(screen.getByText('rwxr-xr-x')).toBeInTheDocument();
    });

    it('applies 777 preset correctly', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '777' }));
      
      expect(screen.getByText('777')).toBeInTheDocument();
      expect(screen.getByText('rwxrwxrwx')).toBeInTheDocument();
    });

    it('applies 600 preset correctly', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '600' }));
      
      expect(screen.getByText('600')).toBeInTheDocument();
      expect(screen.getByText('rw-------')).toBeInTheDocument();
    });

    it('highlights active preset', async () => {
      render(ChmodCalculatorWidget);
      const preset755 = screen.getByRole('button', { name: '755' });
      
      await fireEvent.click(preset755);
      expect(preset755).toHaveClass('active');
    });
  });

  describe('Numeric Input', () => {
    it('parses valid numeric input', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      
      const input = screen.getByLabelText(/Enter octal value/);
      await fireEvent.input(input, { target: { value: '755' } });
      
      expect(screen.getByText('rwxr-xr-x')).toBeInTheDocument();
    });

    it('handles 000 permissions', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      
      const input = screen.getByLabelText(/Enter octal value/);
      await fireEvent.input(input, { target: { value: '000' } });
      
      expect(screen.getByText('---------')).toBeInTheDocument();
    });

    it('handles maximum permissions', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      
      const input = screen.getByLabelText(/Enter octal value/);
      await fireEvent.input(input, { target: { value: '777' } });
      
      expect(screen.getByText('rwxrwxrwx')).toBeInTheDocument();
    });
  });

  describe('Symbolic Input', () => {
    it('parses valid symbolic input', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Symbolic' }));
      
      const input = screen.getByLabelText(/Enter symbolic value/);
      await fireEvent.input(input, { target: { value: 'rwxr-xr-x' } });
      
      expect(screen.getByText('755')).toBeInTheDocument();
    });

    it('parses all dashes', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Symbolic' }));
      
      const input = screen.getByLabelText(/Enter symbolic value/);
      await fireEvent.input(input, { target: { value: '---------' } });
      
      expect(screen.getByText('000')).toBeInTheDocument();
    });

    it('parses mixed permissions', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('tab', { name: 'Symbolic' }));
      
      const input = screen.getByLabelText(/Enter symbolic value/);
      await fireEvent.input(input, { target: { value: 'rw-r--r--' } });
      
      expect(screen.getByText('644')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('copies numeric value to clipboard', async () => {
      render(ChmodCalculatorWidget);
      
      const copyButtons = screen.getAllByTitle(/Copy/);
      await fireEvent.click(copyButtons[0]); // First copy button is numeric
      
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });

    it('shows copy feedback', async () => {
      render(ChmodCalculatorWidget);
      
      const copyButtons = screen.getAllByTitle('Copy numeric value');
      await fireEvent.click(copyButtons[0]);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Command Generation', () => {
    it('generates correct chmod command', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '755' }));
      
      expect(screen.getByText('chmod 755 filename')).toBeInTheDocument();
    });

    it('generates symbolic command', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '755' }));
      
      expect(screen.getByText('chmod u=rwx,g=rx,o=rx filename')).toBeInTheDocument();
    });
  });

  describe('Permission Description', () => {
    it('shows permission breakdown', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByText('Permission Breakdown:')).toBeInTheDocument();
    });

    it('describes owner permissions', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '755' }));
      
      const ownerDesc = screen.getByText(/Owner:/);
      expect(ownerDesc.parentElement).toHaveTextContent('read');
      expect(ownerDesc.parentElement).toHaveTextContent('write');
      expect(ownerDesc.parentElement).toHaveTextContent('execute');
    });

    it('shows no permissions warning', async () => {
      render(ChmodCalculatorWidget);
      await fireEvent.click(screen.getByRole('button', { name: '700' }));
      
      // Group and others should show no permissions
      expect(screen.getAllByText('no permissions').length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(ChmodCalculatorWidget);
      expect(screen.getByRole('application', { name: 'Chmod Permission Calculator' })).toBeInTheDocument();
    });

    it('has proper tab ARIA attributes', () => {
      render(ChmodCalculatorWidget);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('permission toggles have aria-pressed', async () => {
      render(ChmodCalculatorWidget);
      const ownerReadBtn = screen.getByRole('button', { name: /Owner \(u\) read permission/ });
      expect(ownerReadBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid permission toggles', async () => {
      render(ChmodCalculatorWidget);
      const btn = screen.getByRole('button', { name: /Owner \(u\) execute permission/ });
      
      // Rapid toggles
      await fireEvent.click(btn);
      await fireEvent.click(btn);
      await fireEvent.click(btn);
      
      // Should be active after odd number of clicks
      expect(btn).toHaveClass('active');
    });

    it('syncs between tabs', async () => {
      render(ChmodCalculatorWidget);
      
      // Change in visual mode
      await fireEvent.click(screen.getByRole('button', { name: '755' }));
      
      // Switch to numeric and verify
      await fireEvent.click(screen.getByRole('tab', { name: 'Numeric' }));
      const numericInput = screen.getByLabelText(/Enter octal value/);
      expect(numericInput).toHaveValue('755');
      
      // Switch to symbolic and verify
      await fireEvent.click(screen.getByRole('tab', { name: 'Symbolic' }));
      const symbolicInput = screen.getByLabelText(/Enter symbolic value/);
      expect(symbolicInput).toHaveValue('rwxr-xr-x');
    });
  });
});
