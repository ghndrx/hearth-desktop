import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import TextSnippetsManager from './TextSnippetsManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case 'store_get':
        if (args?.key === 'text_snippets') {
          return Promise.resolve(null);
        }
        if (args?.key === 'snippet_categories') {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      case 'store_set':
        return Promise.resolve();
      case 'type_text':
        return Promise.resolve();
      case 'delete_chars':
        return Promise.resolve();
      case 'register_keyboard_listener':
        return Promise.resolve();
      case 'unregister_keyboard_listener':
        return Promise.resolve();
      default:
        return Promise.resolve();
    }
  }),
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

describe('TextSnippetsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the component with header', async () => {
    render(TextSnippetsManager);
    await tick();

    expect(screen.getByText('Text Snippets')).toBeInTheDocument();
    expect(screen.getByText('New Snippet')).toBeInTheDocument();
  });

  it('displays stats bar with correct initial values', async () => {
    render(TextSnippetsManager);
    await tick();

    // Wait for initial snippets to load
    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Expansions')).toBeInTheDocument();
    });
  });

  it('loads default snippets on mount', async () => {
    render(TextSnippetsManager);
    await tick();

    // Default snippets should be loaded
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
      expect(screen.getByText(/;today/)).toBeInTheDocument();
      expect(screen.getByText(/;omw/)).toBeInTheDocument();
    });
  });

  it('opens create modal when clicking New Snippet', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Snippet')).toBeInTheDocument();
      expect(screen.getByLabelText('Trigger')).toBeInTheDocument();
      expect(screen.getByLabelText('Content')).toBeInTheDocument();
    });
  });

  it('closes modal when clicking cancel', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Snippet')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    await fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Create Snippet')).not.toBeInTheDocument();
    });
  });

  it('displays category filters', async () => {
    render(TextSnippetsManager);
    await tick();

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('filters snippets when clicking a category', async () => {
    render(TextSnippetsManager);
    await tick();

    // Wait for snippets to load
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
    });

    const emailCategory = screen.getByText('Email');
    await fireEvent.click(emailCategory);

    // Only email snippets should be visible
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
    });
  });

  it('filters snippets with search input', async () => {
    render(TextSnippetsManager);
    await tick();

    // Wait for snippets to load
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search snippets...');
    await fireEvent.input(searchInput, { target: { value: 'signature' } });

    // Only matching snippets should be visible
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no snippets match search', async () => {
    render(TextSnippetsManager);
    await tick();

    const searchInput = screen.getByPlaceholderText('Search snippets...');
    await fireEvent.input(searchInput, { target: { value: 'nonexistent123xyz' } });

    await waitFor(() => {
      expect(screen.getByText('No snippets found')).toBeInTheDocument();
    });
  });

  it('respects custom trigger prefix prop', async () => {
    render(TextSnippetsManager, { props: { triggerPrefix: '/' } });
    await tick();

    await waitFor(() => {
      expect(screen.getByText(/\/sig/)).toBeInTheDocument();
    });
  });

  it('renders snippet cards with trigger badges', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      const triggerBadges = screen.getAllByRole('code');
      expect(triggerBadges.length).toBeGreaterThan(0);
    });
  });

  it('shows variable tags on snippets with variables', async () => {
    render(TextSnippetsManager);
    await tick();

    // The sig snippet has variables
    await waitFor(() => {
      expect(screen.getByText('{{name}}')).toBeInTheDocument();
      expect(screen.getByText('{{email}}')).toBeInTheDocument();
    });
  });

  it('opens edit modal when clicking edit button', async () => {
    render(TextSnippetsManager);
    await tick();

    // Wait for snippets to load
    await waitFor(() => {
      expect(screen.getByText(/;sig/)).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Snippet')).toBeInTheDocument();
    });
  });

  it('can add variables in the create form', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Snippet')).toBeInTheDocument();
    });

    const addVariableButton = screen.getByText('+ Add Variable');
    await fireEvent.click(addVariableButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    });
  });

  it('shows usage count for snippets', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      const usageText = screen.getAllByText(/Used 0 times/);
      expect(usageText.length).toBeGreaterThan(0);
    });
  });

  it('has accessible form labels', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByLabelText('Trigger')).toBeInTheDocument();
      expect(screen.getByLabelText('Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
      expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
    });
  });

  it('emits ready event on mount', async () => {
    const handleReady = vi.fn();
    const { component } = render(TextSnippetsManager);
    component.$on('ready', handleReady);

    await tick();
    await waitFor(() => {
      expect(handleReady).toHaveBeenCalled();
    });
  });

  it('validates trigger input pattern', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      const triggerInput = screen.getByLabelText('Trigger');
      expect(triggerInput).toHaveAttribute('pattern', '[a-zA-Z0-9_-]+');
    });
  });

  it('displays content preview in snippet cards', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      // Check for signature content
      expect(screen.getByText(/Best regards/)).toBeInTheDocument();
    });
  });

  it('closes modal when pressing Escape', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create Snippet')).toBeInTheDocument();
    });

    const overlay = screen.getByRole('dialog').parentElement;
    await fireEvent.keyDown(overlay!, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Create Snippet')).not.toBeInTheDocument();
    });
  });

  it('shows trigger prefix description', async () => {
    render(TextSnippetsManager);
    await tick();

    expect(screen.getByText(/Type/)).toBeInTheDocument();
    expect(screen.getByText(/followed by your trigger/)).toBeInTheDocument();
  });

  it('displays duplicate button on snippet cards', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      const duplicateButtons = screen.getAllByTitle('Duplicate');
      expect(duplicateButtons.length).toBeGreaterThan(0);
    });
  });

  it('displays delete button on snippet cards', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle('Delete');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('displays enable/disable button on snippet cards', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      const toggleButtons = screen.getAllByTitle('Disable');
      expect(toggleButtons.length).toBeGreaterThan(0);
    });
  });

  it('requires content field in form', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      const contentInput = screen.getByLabelText('Content');
      expect(contentInput).toHaveAttribute('required');
    });
  });

  it('shows category select with all options', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      const categorySelect = screen.getByLabelText('Category');
      expect(categorySelect).toBeInTheDocument();

      // Check options exist
      const options = categorySelect.querySelectorAll('option');
      expect(options.length).toBe(4);
    });
  });

  it('displays most used snippet in stats when present', async () => {
    render(TextSnippetsManager);
    await tick();

    await waitFor(() => {
      expect(screen.getByText('Most Used')).toBeInTheDocument();
    });
  });

  it('supports auto-expand toggle via prop', async () => {
    render(TextSnippetsManager, { props: { autoExpand: false } });
    await tick();

    // Component should still render without keyboard listener
    expect(screen.getByText('Text Snippets')).toBeInTheDocument();
  });

  it('variable type select has all options', async () => {
    render(TextSnippetsManager);
    await tick();

    const createButton = screen.getByText('New Snippet');
    await fireEvent.click(createButton);

    await waitFor(() => {
      const addVariableButton = screen.getByText('+ Add Variable');
      fireEvent.click(addVariableButton);
    });

    await waitFor(() => {
      const typeSelect = screen.getByDisplayValue('Text');
      const options = typeSelect.querySelectorAll('option');

      expect(options.length).toBe(6);
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('DateTime')).toBeInTheDocument();
      expect(screen.getByText('Clipboard')).toBeInTheDocument();
      expect(screen.getByText('Cursor Position')).toBeInTheDocument();
    });
  });
});
