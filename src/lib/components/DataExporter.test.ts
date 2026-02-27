import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import DataExporter from './DataExporter.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

describe('DataExporter', () => {
  const mockInvoke = invoke as ReturnType<typeof vi.fn>;
  const mockSave = save as ReturnType<typeof vi.fn>;
  const mockWriteTextFile = writeTextFile as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(1024 * 50); // 50KB estimate
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should not render when visible is false', () => {
      render(DataExporter, { visible: false });
      
      expect(screen.queryByText('Export Your Data')).not.toBeInTheDocument();
    });

    it('should render when visible is true', () => {
      render(DataExporter, { visible: true });
      
      expect(screen.getByText(/Export Your Data/)).toBeInTheDocument();
    });

    it('should render all format options', () => {
      render(DataExporter, { visible: true });
      
      expect(screen.getByText('JSON')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('HTML')).toBeInTheDocument();
      expect(screen.getByText('Markdown')).toBeInTheDocument();
    });

    it('should render all category options', () => {
      render(DataExporter, { visible: true });
      
      expect(screen.getByText('Messages')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.getByText('Channels')).toBeInTheDocument();
      expect(screen.getByText('Servers')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Bookmarks')).toBeInTheDocument();
    });

    it('should render date range inputs', () => {
      render(DataExporter, { visible: true });
      
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    it('should render option toggles', () => {
      render(DataExporter, { visible: true });
      
      expect(screen.getByText('Include Attachments')).toBeInTheDocument();
      expect(screen.getByText('Compress Output')).toBeInTheDocument();
    });
  });

  describe('format selection', () => {
    it('should select JSON format by default', () => {
      render(DataExporter, { visible: true });
      
      const jsonOption = screen.getByText('JSON').closest('button');
      expect(jsonOption).toHaveClass('selected');
    });

    it('should change format when clicking on a format option', async () => {
      render(DataExporter, { visible: true });
      
      const csvOption = screen.getByText('CSV').closest('button');
      await fireEvent.click(csvOption!);
      
      expect(csvOption).toHaveClass('selected');
      
      const jsonOption = screen.getByText('JSON').closest('button');
      expect(jsonOption).not.toHaveClass('selected');
    });
  });

  describe('category selection', () => {
    it('should have messages and settings selected by default', () => {
      render(DataExporter, { visible: true });
      
      const messagesOption = screen.getByText('Messages').closest('button');
      const settingsOption = screen.getByText('Settings').closest('button');
      
      expect(messagesOption).toHaveClass('selected');
      expect(settingsOption).toHaveClass('selected');
    });

    it('should toggle category when clicked', async () => {
      render(DataExporter, { visible: true });
      
      const contactsOption = screen.getByText('Contacts').closest('button');
      expect(contactsOption).not.toHaveClass('selected');
      
      await fireEvent.click(contactsOption!);
      expect(contactsOption).toHaveClass('selected');
      
      await fireEvent.click(contactsOption!);
      expect(contactsOption).not.toHaveClass('selected');
    });

    it('should select all categories when clicking Select All', async () => {
      render(DataExporter, { visible: true });
      
      const selectAllButton = screen.getByText('Select All');
      await fireEvent.click(selectAllButton);
      
      const allOptions = screen.getAllByRole('button').filter(
        btn => btn.classList.contains('category-option')
      );
      
      allOptions.forEach(option => {
        expect(option).toHaveClass('selected');
      });
    });

    it('should clear all categories when clicking Clear', async () => {
      render(DataExporter, { visible: true });
      
      const clearButton = screen.getByText('Clear');
      await fireEvent.click(clearButton);
      
      const allOptions = screen.getAllByRole('button').filter(
        btn => btn.classList.contains('category-option')
      );
      
      allOptions.forEach(option => {
        expect(option).not.toHaveClass('selected');
      });
    });
  });

  describe('estimated size', () => {
    it('should display estimated size', async () => {
      mockInvoke.mockResolvedValue(1024 * 50); // 50KB
      
      render(DataExporter, { visible: true });
      
      await waitFor(() => {
        expect(screen.getByText(/Estimated Size/)).toBeInTheDocument();
      });
    });

    it('should update size when attachments toggle changes', async () => {
      render(DataExporter, { visible: true });
      
      const attachmentsCheckbox = screen.getByText('Include Attachments')
        .closest('label')
        ?.querySelector('input');
      
      await fireEvent.click(attachmentsCheckbox!);
      
      expect(mockInvoke).toHaveBeenCalledWith('estimate_export_size', expect.objectContaining({
        includeAttachments: true,
      }));
    });
  });

  describe('export process', () => {
    it('should show error when no categories selected', async () => {
      render(DataExporter, { visible: true });
      
      // Clear all categories
      const clearButton = screen.getByText('Clear');
      await fireEvent.click(clearButton);
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      expect(screen.getByText(/Please select at least one category/)).toBeInTheDocument();
    });

    it('should disable export button when no categories selected', async () => {
      render(DataExporter, { visible: true });
      
      const clearButton = screen.getByText('Clear');
      await fireEvent.click(clearButton);
      
      const exportButton = screen.getByText(/Export Data/);
      expect(exportButton).toBeDisabled();
    });

    it('should open save dialog when starting export', async () => {
      mockSave.mockResolvedValue('/path/to/export.json');
      mockInvoke.mockResolvedValue({ success: true });
      
      render(DataExporter, { visible: true });
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });
    });

    it('should cancel export when save dialog is cancelled', async () => {
      mockSave.mockResolvedValue(null);
      
      render(DataExporter, { visible: true });
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Exporting...')).not.toBeInTheDocument();
      });
    });

    it('should show progress during export', async () => {
      mockSave.mockResolvedValue('/path/to/export.json');
      mockInvoke.mockImplementation(async (cmd) => {
        if (cmd === 'export_category_data') {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { data: [] };
        }
        return {};
      });
      
      render(DataExporter, { visible: true });
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
      });
    });
  });

  describe('modal behavior', () => {
    it('should call onClose when clicking close button', async () => {
      const onClose = vi.fn();
      render(DataExporter, { visible: true, onClose });
      
      const closeButton = screen.getByLabelText('Close');
      await fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking overlay', async () => {
      const onClose = vi.fn();
      render(DataExporter, { visible: true, onClose });
      
      const overlay = screen.getByRole('dialog').parentElement;
      await fireEvent.click(overlay!);
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when pressing Escape', async () => {
      const onClose = vi.fn();
      render(DataExporter, { visible: true, onClose });
      
      await fireEvent.keyDown(window, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalled();
    });

    it('should not close when pressing Escape during export', async () => {
      const onClose = vi.fn();
      mockSave.mockResolvedValue('/path/to/export.json');
      mockInvoke.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {};
      });
      
      render(DataExporter, { visible: true, onClose });
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
      });
      
      await fireEvent.keyDown(window, { key: 'Escape' });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should call onClose when clicking cancel button', async () => {
      const onClose = vi.fn();
      render(DataExporter, { visible: true, onClose });
      
      const cancelButton = screen.getByText('Cancel');
      await fireEvent.click(cancelButton);
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('export completion', () => {
    it('should call onExportComplete with file path', async () => {
      const onExportComplete = vi.fn();
      mockSave.mockResolvedValue('/path/to/export.json');
      mockInvoke.mockResolvedValue({ data: [] });
      mockWriteTextFile.mockResolvedValue(undefined);
      
      render(DataExporter, { visible: true, onExportComplete });
      
      const exportButton = screen.getByText(/Export Data/);
      await fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(onExportComplete).toHaveBeenCalledWith('/path/to/export.json');
      }, { timeout: 5000 });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(DataExporter, { visible: true });
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'export-title');
    });

    it('should have accessible close button', () => {
      render(DataExporter, { visible: true });
      
      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });
  });
});
