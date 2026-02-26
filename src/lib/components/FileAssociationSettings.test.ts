import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import FileAssociationSettings from './FileAssociationSettings.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

describe('FileAssociationSettings', () => {
  const mockAssociations = [
    {
      extension: 'hearth',
      mime_type: 'application/x-hearth',
      description: 'Hearth Chat Export',
      registered: true,
    },
    {
      extension: 'hearthkey',
      mime_type: 'application/x-hearth-key',
      description: 'Hearth Encryption Key',
      registered: true,
    },
    {
      extension: 'hearthbackup',
      mime_type: 'application/x-hearth-backup',
      description: 'Hearth Chat Backup',
      registered: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockAssociations);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the component with title', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('File Associations')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    render(FileAssociationSettings);
    expect(screen.getByText('Loading file associations...')).toBeInTheDocument();
  });

  it('fetches and displays file associations', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_supported_file_associations');
    });

    await waitFor(() => {
      expect(screen.getByText('.hearth')).toBeInTheDocument();
      expect(screen.getByText('.hearthkey')).toBeInTheDocument();
      expect(screen.getByText('.hearthbackup')).toBeInTheDocument();
    });
  });

  it('shows registered status for registered associations', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      const registeredBadges = screen.getAllByText('Registered');
      expect(registeredBadges).toHaveLength(2);
    });
  });

  it('shows not registered status for unregistered associations', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('Not Registered')).toBeInTheDocument();
    });
  });

  it('displays file descriptions', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('Hearth Chat Export')).toBeInTheDocument();
      expect(screen.getByText('Hearth Encryption Key')).toBeInTheDocument();
      expect(screen.getByText('Hearth Chat Backup')).toBeInTheDocument();
    });
  });

  it('displays MIME types', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('application/x-hearth')).toBeInTheDocument();
      expect(screen.getByText('application/x-hearth-key')).toBeInTheDocument();
      expect(screen.getByText('application/x-hearth-backup')).toBeInTheDocument();
    });
  });

  it('handles error state gracefully', async () => {
    const errorMessage = 'Failed to load associations';
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retries loading on retry button click', async () => {
    (invoke as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce(mockAssociations);

    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledTimes(2);
    });
  });

  it('subscribes to file association events on mount', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith(
        'file-association-open',
        expect.any(Function)
      );
    });
  });

  it('displays information about file types', async () => {
    render(FileAssociationSettings);

    await waitFor(() => {
      expect(screen.getByText('How File Associations Work')).toBeInTheDocument();
      expect(screen.getByText(/Double-click to import chat exports/)).toBeInTheDocument();
    });
  });
});
