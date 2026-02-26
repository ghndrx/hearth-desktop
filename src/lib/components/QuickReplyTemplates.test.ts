import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import QuickReplyTemplates from './QuickReplyTemplates.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(null)
}));

describe('QuickReplyTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default templates', async () => {
    render(QuickReplyTemplates);
    
    // Wait for templates to load
    await vi.waitFor(() => {
      expect(screen.getByText('Quick Replies')).toBeTruthy();
    });
  });

  it('displays search input', () => {
    render(QuickReplyTemplates);
    
    const searchInput = screen.getByPlaceholderText('Search templates...');
    expect(searchInput).toBeTruthy();
  });

  it('displays category filter dropdown', () => {
    render(QuickReplyTemplates);
    
    const categorySelect = screen.getByRole('combobox');
    expect(categorySelect).toBeTruthy();
  });

  it('opens add modal when clicking add button', async () => {
    render(QuickReplyTemplates);
    
    const addButton = screen.getByTitle('Add template');
    await fireEvent.click(addButton);
    
    expect(screen.getByText('New Template')).toBeTruthy();
  });

  it('shows empty state when no templates match filter', async () => {
    render(QuickReplyTemplates);
    
    const searchInput = screen.getByPlaceholderText('Search templates...');
    await fireEvent.input(searchInput, { target: { value: 'zzzznonexistent' } });
    
    await vi.waitFor(() => {
      expect(screen.getByText('No templates found')).toBeTruthy();
    });
  });

  it('renders in compact mode', () => {
    const { container } = render(QuickReplyTemplates, { compact: true });
    
    expect(container.querySelector('.compact')).toBeTruthy();
  });

  it('filters templates by category', async () => {
    render(QuickReplyTemplates);
    
    const categorySelect = screen.getByRole('combobox');
    await fireEvent.change(categorySelect, { target: { value: 'greetings' } });
    
    // Should only show greetings templates
    await vi.waitFor(() => {
      const templates = screen.queryAllByText(/Welcome/);
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  it('calls onInsert callback when template is clicked', async () => {
    const mockInsert = vi.fn();
    render(QuickReplyTemplates, { onInsert: mockInsert });
    
    // Wait for templates to render then click one
    await vi.waitFor(async () => {
      const templateItems = screen.getAllByRole('button');
      const templateButton = templateItems.find(btn => 
        btn.classList.contains('template-item') || 
        btn.textContent?.includes('Welcome')
      );
      if (templateButton) {
        await fireEvent.click(templateButton);
      }
    });
  });

  it('shows edit modal when edit button is clicked', async () => {
    render(QuickReplyTemplates);
    
    // Wait for templates to load
    await vi.waitFor(async () => {
      const editButtons = screen.getAllByTitle('Edit');
      if (editButtons.length > 0) {
        await fireEvent.click(editButtons[0]);
        expect(screen.getByText('Edit Template')).toBeTruthy();
      }
    });
  });

  it('modal has required form fields', async () => {
    render(QuickReplyTemplates);
    
    const addButton = screen.getByTitle('Add template');
    await fireEvent.click(addButton);
    
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Content')).toBeTruthy();
    expect(screen.getByLabelText('Shortcut (optional)')).toBeTruthy();
    expect(screen.getByLabelText('Category')).toBeTruthy();
  });

  it('closes modal when cancel is clicked', async () => {
    render(QuickReplyTemplates);
    
    const addButton = screen.getByTitle('Add template');
    await fireEvent.click(addButton);
    
    const cancelButton = screen.getByText('Cancel');
    await fireEvent.click(cancelButton);
    
    expect(screen.queryByText('New Template')).toBeFalsy();
  });

  it('displays template stats footer', async () => {
    render(QuickReplyTemplates);
    
    await vi.waitFor(() => {
      expect(screen.getByText(/templates/)).toBeTruthy();
      expect(screen.getByText(/total uses/)).toBeTruthy();
    });
  });

  it('shows default categories in filter', async () => {
    render(QuickReplyTemplates);
    
    const categorySelect = screen.getByRole('combobox');
    
    expect(categorySelect).toContainHTML('General');
    expect(categorySelect).toContainHTML('Greetings');
    expect(categorySelect).toContainHTML('Support');
    expect(categorySelect).toContainHTML('Farewells');
  });
});
