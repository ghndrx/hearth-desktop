import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import PrintManager from './PrintManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

const mockMessages = [
  {
    id: '1',
    author: 'Alice',
    content: 'Hello world!',
    timestamp: '2024-02-26T10:00:00Z',
    attachments: []
  },
  {
    id: '2',
    author: 'Bob',
    content: 'Hi Alice, how are you?',
    timestamp: '2024-02-26T10:01:00Z',
    attachments: [{ name: 'document.pdf', url: 'https://example.com/doc.pdf' }]
  },
  {
    id: '3',
    author: 'Alice',
    content: 'Doing great, thanks!',
    timestamp: '2024-02-26T10:02:00Z',
    attachments: []
  }
];

describe('PrintManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders with default props', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(screen.getByText('Print Options')).toBeInTheDocument();
      expect(screen.getByText('Export Options')).toBeInTheDocument();
    });

    it('displays correct message count', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(screen.getByText('3 messages')).toBeInTheDocument();
    });

    it('displays channel name', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'announcements',
          serverName: 'My Server'
        }
      });

      expect(screen.getByText('#announcements')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });

  describe('options', () => {
    it('renders orientation select', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      const orientationSelect = screen.getByLabelText(/orientation/i) as HTMLSelectElement;
      expect(orientationSelect).toBeInTheDocument();
      expect(orientationSelect.value).toBe('portrait');
    });

    it('renders paper size select', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      const paperSelect = screen.getByLabelText(/paper size/i) as HTMLSelectElement;
      expect(paperSelect).toBeInTheDocument();
      expect(paperSelect.value).toBe('letter');
    });

    it('renders export format select', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      const formatSelect = screen.getByLabelText(/format/i) as HTMLSelectElement;
      expect(formatSelect).toBeInTheDocument();
      expect(formatSelect.value).toBe('pdf');
    });

    it('allows toggling include timestamps', async () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          includeTimestamps: true
        }
      });

      const checkbox = screen.getByLabelText(/include timestamps/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      await fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('allows toggling include attachments', async () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          includeAttachments: false
        }
      });

      const checkbox = screen.getByLabelText(/list attachments/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      await fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('date range filtering', () => {
    it('filters messages by date range', () => {
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          dateRange: {
            start: new Date('2024-02-26T10:00:30Z'),
            end: new Date('2024-02-26T10:01:30Z')
          }
        }
      });

      expect(component.getMessageCount()).toBe(1);
    });

    it('shows all messages when no date range', () => {
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          dateRange: {}
        }
      });

      expect(component.getMessageCount()).toBe(3);
    });
  });

  describe('disabled states', () => {
    it('disables buttons when no messages', () => {
      render(PrintManager, {
        props: {
          messages: [],
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /print/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
    });

    it('enables buttons when messages exist', () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(screen.getByRole('button', { name: /preview/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /print/i })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /export/i })).not.toBeDisabled();
    });
  });

  describe('preview modal', () => {
    it('opens preview modal on preview button click', async () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      const previewBtn = screen.getByRole('button', { name: /preview/i });
      await fireEvent.click(previewBtn);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Print Preview')).toBeInTheDocument();
    });

    it('closes preview modal on close button click', async () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      const previewBtn = screen.getByRole('button', { name: /preview/i });
      await fireEvent.click(previewBtn);

      const closeBtn = screen.getByRole('button', { name: '✕' });
      await fireEvent.click(closeBtn);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes preview modal on cancel button click', async () => {
      render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await fireEvent.click(screen.getByRole('button', { name: /preview/i }));
      await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('print functionality', () => {
    it('calls print method without error', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue(undefined);

      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await component.print();

      expect(invoke).toHaveBeenCalledWith('plugin:print|print_document', expect.any(Object));
    });

    it('dispatches print event on success', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue(undefined);

      const printHandler = vi.fn();
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      component.$on('print', printHandler);
      await component.print();

      expect(printHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { success: true }
        })
      );
    });

    it('dispatches error event on failure', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValue(new Error('Printer not found'));

      const errorHandler = vi.fn();
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      component.$on('error', errorHandler);
      await component.print();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { message: 'Printer not found', code: 'PRINT_ERROR' }
        })
      );
    });
  });

  describe('export functionality', () => {
    it('exports to PDF format', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/path/to/export.pdf');

      const exportHandler = vi.fn();
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      component.$on('export', exportHandler);
      await component.exportTo('pdf');

      expect(invoke).toHaveBeenCalledWith('plugin:print|export_pdf', expect.any(Object));
      expect(exportHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { success: true, path: '/path/to/export.pdf', format: 'pdf' }
        })
      );
    });

    it('exports to HTML format', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/path/to/export.html');

      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await component.exportTo('html');

      expect(invoke).toHaveBeenCalledWith('plugin:fs|save_file', expect.objectContaining({
        mimeType: 'text/html'
      }));
    });

    it('exports to JSON format', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/path/to/export.json');

      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await component.exportTo('json');

      expect(invoke).toHaveBeenCalledWith('plugin:fs|save_file', expect.objectContaining({
        mimeType: 'application/json'
      }));
    });

    it('exports to TXT format', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/path/to/export.txt');

      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await component.exportTo('txt');

      expect(invoke).toHaveBeenCalledWith('plugin:fs|save_file', expect.objectContaining({
        mimeType: 'text/plain'
      }));
    });

    it('exports to CSV format', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValue('/path/to/export.csv');

      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      await component.exportTo('csv');

      expect(invoke).toHaveBeenCalledWith('plugin:fs|save_file', expect.objectContaining({
        mimeType: 'text/csv'
      }));
    });
  });

  describe('component API', () => {
    it('exposes setPrintOptions method', () => {
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(typeof component.setPrintOptions).toBe('function');
      component.setPrintOptions({ orientation: 'landscape' });
    });

    it('exposes setExportOptions method', () => {
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      expect(typeof component.setExportOptions).toBe('function');
      component.setExportOptions({ format: 'json' });
    });

    it('exposes showPrintPreview and closePrintPreview methods', async () => {
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server'
        }
      });

      component.showPrintPreview();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      component.closePrintPreview();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('themes', () => {
    it('generates light theme HTML', () => {
      const previewHandler = vi.fn();
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          theme: 'light'
        }
      });

      component.$on('preview', previewHandler);
      component.showPrintPreview();

      expect(previewHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            html: expect.stringContaining('background: #ffffff')
          }
        })
      );
    });

    it('generates dark theme HTML', () => {
      const previewHandler = vi.fn();
      const { component } = render(PrintManager, {
        props: {
          messages: mockMessages,
          channelName: 'general',
          serverName: 'Test Server',
          theme: 'dark'
        }
      });

      component.$on('preview', previewHandler);
      component.showPrintPreview();

      expect(previewHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            html: expect.stringContaining('background: #1a1a2e')
          }
        })
      );
    });
  });
});
