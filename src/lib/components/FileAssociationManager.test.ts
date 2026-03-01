import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileAssociationManager from './FileAssociationManager.svelte';

describe('FileAssociationManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the toggle button', () => {
    render(FileAssociationManager);
    expect(screen.getByTitle(/File Associations/i)).toBeTruthy();
  });

  it('opens panel when clicked', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    expect(screen.getByText('File Associations')).toBeTruthy();
  });

  it('shows three tabs', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    expect(screen.getByText('File Types')).toBeTruthy();
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows default file associations', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    expect(screen.getByText('.hearth')).toBeTruthy();
    expect(screen.getByText('.png')).toBeTruthy();
    expect(screen.getByText('.mp4')).toBeTruthy();
  });

  it('has search input for file types', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    expect(screen.getByPlaceholderText(/Search file types/i)).toBeTruthy();
  });

  it('can filter file types', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));

    const search = screen.getByPlaceholderText(/Search file types/i);
    await fireEvent.input(search, { target: { value: '.hearth' } });
    expect(screen.getByText('.hearth')).toBeTruthy();
    expect(screen.queryByText('.png')).toBeFalsy();
  });

  it('shows empty state for recent files', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    await fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByText('No recently opened files')).toBeTruthy();
  });

  it('shows settings options', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Default Behavior')).toBeTruthy();
    expect(screen.getByText('Open files in Hearth')).toBeTruthy();
    expect(screen.getByText('Show preview on hover')).toBeTruthy();
  });

  it('shows supported formats in settings', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Supported Formats')).toBeTruthy();
  });

  it('shows clear history button in recent tab', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));
    await fireEvent.click(screen.getByText('Recent'));
    expect(screen.getByText('Clear History')).toBeTruthy();
  });

  it('persists associations to localStorage', async () => {
    render(FileAssociationManager);
    await fireEvent.click(screen.getByTitle(/File Associations/i));

    // Toggle an association which triggers save
    const toggles = screen.getAllByRole('button');
    // Find a toggle button and click it
    const firstToggle = toggles.find(b => b.classList.contains('rounded-full') && b.classList.contains('w-10'));
    if (firstToggle) {
      await fireEvent.click(firstToggle);
    }

    const saved = localStorage.getItem('hearth-file-associations');
    expect(saved).toBeTruthy();
  });
});
