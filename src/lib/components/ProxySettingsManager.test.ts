import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import ProxySettingsManager from './ProxySettingsManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue(null),
  open: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  readTextFile: vi.fn().mockResolvedValue('{}'),
}));

describe('ProxySettingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with default state', () => {
      render(ProxySettingsManager);

      expect(screen.getByText('Proxy Settings')).toBeInTheDocument();
      expect(screen.getByText('Enable Proxy')).toBeInTheDocument();
      expect(screen.getByText('Proxy disabled')).toBeInTheDocument();
    });

    it('renders with proxy enabled', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', host: 'proxy.test.com', port: 8080 },
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/HTTP proxy/i)).toBeInTheDocument();
      });
    });

    it('shows connection mode section when enabled', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      await waitFor(() => {
        expect(screen.getByText('Connection Mode')).toBeInTheDocument();
      });
    });
  });

  describe('proxy toggle', () => {
    it('enables proxy when toggled on', async () => {
      const { component } = render(ProxySettingsManager);

      const toggle = screen.getByRole('checkbox');
      await fireEvent.click(toggle);

      expect(toggle).toBeChecked();
    });

    it('disables proxy when toggled off', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const toggle = screen.getByRole('checkbox');
      await fireEvent.click(toggle);

      expect(toggle).not.toBeChecked();
    });

    it('emits proxyChange event on toggle', async () => {
      const handleChange = vi.fn();
      const { component } = render(ProxySettingsManager);
      component.$on('proxyChange', handleChange);

      const toggle = screen.getByRole('checkbox');
      await fireEvent.click(toggle);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalled();
      });
    });
  });

  describe('proxy modes', () => {
    it('selects direct mode', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const directOption = screen.getByLabelText(/Direct/i);
      await fireEvent.click(directOption);

      expect(directOption).toBeChecked();
    });

    it('selects system mode', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const systemOption = screen.getByLabelText(/System/i);
      await fireEvent.click(systemOption);

      expect(systemOption).toBeChecked();
    });

    it('selects manual mode and shows configuration', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const manualOption = screen.getByLabelText(/Manual/i);
      await fireEvent.click(manualOption);

      await waitFor(() => {
        expect(screen.getByText('Proxy Server')).toBeInTheDocument();
      });
    });

    it('selects PAC mode and shows PAC URL field', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const pacOption = screen.getByLabelText(/PAC Script/i);
      await fireEvent.click(pacOption);

      await waitFor(() => {
        expect(screen.getByText('PAC Script URL')).toBeInTheDocument();
      });
    });
  });

  describe('manual configuration', () => {
    it('accepts host input', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'manual' } },
      });

      // Expand the section
      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const hostInput = screen.getByLabelText('Host');
        expect(hostInput).toBeInTheDocument();
      });

      const hostInput = screen.getByLabelText('Host');
      await fireEvent.input(hostInput, { target: { value: 'proxy.example.com' } });

      expect((hostInput as HTMLInputElement).value).toBe('proxy.example.com');
    });

    it('accepts port input', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'manual' } },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const portInput = screen.getByLabelText('Port');
        expect(portInput).toBeInTheDocument();
      });

      const portInput = screen.getByLabelText('Port');
      await fireEvent.input(portInput, { target: { value: '3128' } });

      expect((portInput as HTMLInputElement).value).toBe('3128');
    });

    it('validates invalid port', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'manual', host: 'test', port: 99999 } },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByText(/Port must be between/i)).toBeInTheDocument();
      });
    });

    it('selects protocol', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'manual' } },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const socks5Option = screen.getByLabelText('SOCKS5');
        expect(socks5Option).toBeInTheDocument();
      });

      const socks5Option = screen.getByLabelText('SOCKS5');
      await fireEvent.click(socks5Option);

      expect(socks5Option).toBeChecked();
    });
  });

  describe('PAC configuration', () => {
    it('accepts PAC URL input', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'pac' } },
      });

      const sectionHeader = screen.getByText('PAC Script');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const pacInput = screen.getByLabelText('PAC Script URL');
        expect(pacInput).toBeInTheDocument();
      });

      const pacInput = screen.getByLabelText('PAC Script URL');
      await fireEvent.input(pacInput, { target: { value: 'https://example.com/proxy.pac' } });

      expect((pacInput as HTMLInputElement).value).toBe('https://example.com/proxy.pac');
    });

    it('validates invalid PAC URL', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'pac', pacUrl: 'not-a-url' } },
      });

      const sectionHeader = screen.getByText('PAC Script');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument();
      });
    });
  });

  describe('bypass rules', () => {
    it('shows bypass rules section', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual' },
          showAdvancedOptions: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Bypass Rules')).toBeInTheDocument();
      });
    });

    it('adds bypass pattern', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', bypassList: [] },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Bypass Rules');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Add pattern/i);
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Add pattern/i);
      await fireEvent.input(input, { target: { value: '*.test.com' } });

      const addButton = screen.getByRole('button', { name: 'Add' });
      await fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('*.test.com')).toBeInTheDocument();
      });
    });

    it('shows common patterns', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', bypassList: [] },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Bypass Rules');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByText('Quick add:')).toBeInTheDocument();
        expect(screen.getByText('localhost')).toBeInTheDocument();
      });
    });

    it('toggles bypass local setting', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', bypassLocal: false },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Bypass Rules');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const bypassLocalToggle = screen.getByText('Bypass for local addresses');
        expect(bypassLocalToggle).toBeInTheDocument();
      });
    });
  });

  describe('presets', () => {
    it('shows presets section', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true },
          showAdvancedOptions: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Saved Presets')).toBeInTheDocument();
      });
    });

    it('shows empty presets message', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Saved Presets');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByText('No saved presets')).toBeInTheDocument();
      });
    });

    it('shows save preset input for valid manual config', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: {
            enabled: true,
            mode: 'manual',
            host: 'proxy.test.com',
            port: 8080,
          },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Saved Presets');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Preset name')).toBeInTheDocument();
      });
    });
  });

  describe('connection test', () => {
    it('shows test connection button', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Test Connection' })).toBeInTheDocument();
      });
    });

    it('disables test button when config is invalid', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', host: '', port: 0 },
        },
      });

      await waitFor(() => {
        const testButton = screen.getByRole('button', { name: 'Test Connection' });
        expect(testButton).toBeDisabled();
      });
    });

    it('shows testing state when clicked', async () => {
      global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'system' },
        },
      });

      const testButton = screen.getByRole('button', { name: 'Test Connection' });
      await fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Testing/i)).toBeInTheDocument();
      });
    });

    it('shows success result', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ip: '1.2.3.4' }),
      });

      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'system' },
        },
      });

      const testButton = screen.getByRole('button', { name: 'Test Connection' });
      await fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connection Successful')).toBeInTheDocument();
      });
    });

    it('shows error result', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'system' },
        },
      });

      const testButton = screen.getByRole('button', { name: 'Test Connection' });
      await fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
      });
    });
  });

  describe('footer actions', () => {
    it('shows reset button', () => {
      render(ProxySettingsManager);

      expect(screen.getByRole('button', { name: 'Reset to Defaults' })).toBeInTheDocument();
    });

    it('shows save button', () => {
      render(ProxySettingsManager);

      expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument();
    });

    it('resets configuration when reset clicked', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', host: 'test', port: 8080 },
        },
      });

      const resetButton = screen.getByRole('button', { name: 'Reset to Defaults' });
      await fireEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.getByText('Proxy disabled')).toBeInTheDocument();
      });
    });
  });

  describe('advanced options', () => {
    it('hides advanced sections when showAdvancedOptions is false', () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual' },
          showAdvancedOptions: false,
        },
      });

      expect(screen.queryByText('Bypass Rules')).not.toBeInTheDocument();
      expect(screen.queryByText('Saved Presets')).not.toBeInTheDocument();
    });

    it('shows advanced sections when showAdvancedOptions is true', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual' },
          showAdvancedOptions: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Bypass Rules')).toBeInTheDocument();
        expect(screen.getByText('Saved Presets')).toBeInTheDocument();
      });
    });
  });

  describe('authentication', () => {
    it('shows authentication fields for supported protocols', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', protocol: 'http' },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByText('Authentication (Optional)')).toBeInTheDocument();
      });
    });

    it('toggles password visibility', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual', protocol: 'http' },
          showAdvancedOptions: true,
        },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        const passwordInput = screen.getByLabelText('Password');
        expect(passwordInput).toHaveAttribute('type', 'password');
      });

      const toggleButtons = screen.getAllByRole('button');
      const passwordToggle = toggleButtons.find(btn => btn.classList.contains('password-toggle'));
      if (passwordToggle) {
        await fireEvent.click(passwordToggle);
      }

      await waitFor(() => {
        const passwordInput = screen.getByLabelText('Password');
        expect(passwordInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('events', () => {
    it('emits error event on failure', async () => {
      const handleError = vi.fn();
      const { component } = render(ProxySettingsManager, {
        props: { maxPresets: 0 },
      });
      component.$on('error', handleError);

      // This would trigger an error when trying to save a preset with maxPresets=0
      // Implementation would need to handle this case
    });

    it('emits connectionTest event on test', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ip: '1.2.3.4' }),
      });

      const handleTest = vi.fn();
      const { component } = render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'system' } },
      });
      component.$on('connectionTest', handleTest);

      const testButton = screen.getByRole('button', { name: 'Test Connection' });
      await fireEvent.click(testButton);

      await waitFor(() => {
        expect(handleTest).toHaveBeenCalled();
      });
    });
  });

  describe('import/export', () => {
    it('shows export button', () => {
      render(ProxySettingsManager);

      const buttons = screen.getAllByRole('button');
      const exportButton = buttons.find(btn => btn.getAttribute('title') === 'Export configuration');
      expect(exportButton).toBeInTheDocument();
    });

    it('shows import button', () => {
      render(ProxySettingsManager);

      const buttons = screen.getAllByRole('button');
      const importButton = buttons.find(btn => btn.getAttribute('title') === 'Import configuration');
      expect(importButton).toBeInTheDocument();
    });
  });

  describe('section expansion', () => {
    it('expands and collapses sections', async () => {
      render(ProxySettingsManager, {
        props: {
          initialConfig: { enabled: true, mode: 'manual' },
          showAdvancedOptions: true,
        },
      });

      const bypassHeader = screen.getByText('Bypass Rules');
      
      // Initially collapsed
      await fireEvent.click(bypassHeader);
      
      // Should expand
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Add pattern/i)).toBeInTheDocument();
      });

      // Click again to collapse
      await fireEvent.click(bypassHeader);

      await tick();
      
      // Should collapse (content hidden)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Add pattern/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper aria attributes on sections', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true } },
      });

      const sectionHeader = screen.getByText('Connection Mode').closest('button');
      expect(sectionHeader).toHaveAttribute('aria-expanded');
    });

    it('has proper labels for form fields', async () => {
      render(ProxySettingsManager, {
        props: { initialConfig: { enabled: true, mode: 'manual' } },
      });

      const sectionHeader = screen.getByText('Proxy Server');
      await fireEvent.click(sectionHeader);

      await waitFor(() => {
        expect(screen.getByLabelText('Host')).toBeInTheDocument();
        expect(screen.getByLabelText('Port')).toBeInTheDocument();
        expect(screen.getByLabelText('Protocol')).toBeInTheDocument();
      });
    });
  });
});
