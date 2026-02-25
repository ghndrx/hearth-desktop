import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import SpellcheckSettings from './SpellcheckSettings.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

describe('SpellcheckSettings', () => {
  const mockLanguages = [
    { code: 'en_US', name: 'English (US)' },
    { code: 'en_GB', name: 'English (UK)' },
    { code: 'es_ES', name: 'Spanish' }
  ];

  const mockDictionary = ['testword', 'customterm', 'myname'];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'get_spell_check_languages':
          return mockLanguages;
        case 'get_custom_dictionary':
          return mockDictionary;
        case 'add_to_dictionary':
          return undefined;
        case 'remove_from_dictionary':
          return undefined;
        case 'check_spelling':
          return [
            { word: 'misspeled', start: 0, end: 9, suggestions: ['misspelled', 'misspell'] }
          ];
        default:
          return undefined;
      }
    });
  });

  describe('rendering', () => {
    it('renders the component with header', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      expect(screen.getByText('Spell Check')).toBeInTheDocument();
      expect(screen.getByText('Configure spell checking for messages')).toBeInTheDocument();
    });

    it('loads languages on mount', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_spell_check_languages');
      });

      await waitFor(() => {
        expect(screen.getByText('English (US)')).toBeInTheDocument();
      });
    });

    it('loads custom dictionary on mount', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_custom_dictionary');
      });

      // Word count should show
      await waitFor(() => {
        expect(screen.getByText('3 words')).toBeInTheDocument();
      });
    });
  });

  describe('enable/disable toggle', () => {
    it('shows enabled state', () => {
      render(SpellcheckSettings, { enabled: true });
      
      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeChecked();
    });

    it('shows disabled state', () => {
      render(SpellcheckSettings, { enabled: false });
      
      const toggle = screen.getByRole('checkbox');
      expect(toggle).not.toBeChecked();
    });

    it('calls onEnabledChange when toggled', async () => {
      const onEnabledChange = vi.fn();
      render(SpellcheckSettings, { 
        enabled: true, 
        onEnabledChange 
      });
      
      const toggle = screen.getByRole('checkbox');
      await fireEvent.click(toggle);
      
      expect(onEnabledChange).toHaveBeenCalledWith(false);
    });
  });

  describe('language selection', () => {
    it('allows language change', async () => {
      const onLanguageChange = vi.fn();
      render(SpellcheckSettings, { 
        enabled: true,
        onLanguageChange 
      });
      
      await waitFor(() => {
        expect(screen.getByText('English (UK)')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await fireEvent.change(select, { target: { value: 'en_GB' } });
      
      expect(onLanguageChange).toHaveBeenCalledWith('en_GB');
    });

    it('disables language select when spell check is disabled', () => {
      render(SpellcheckSettings, { enabled: false });
      
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('custom dictionary', () => {
    it('expands dictionary panel when clicked', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      await waitFor(() => {
        expect(screen.getByText('3 words')).toBeInTheDocument();
      });

      const expandBtn = screen.getByText('3 words').closest('button')!;
      await fireEvent.click(expandBtn);
      
      await waitFor(() => {
        expect(screen.getByText('testword')).toBeInTheDocument();
      });
    });

    it('adds word to dictionary', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      const input = screen.getByPlaceholderText('Add a word...');
      await fireEvent.input(input, { target: { value: 'newword' } });
      
      const addBtn = screen.getByText('Add');
      await fireEvent.click(addBtn);
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('add_to_dictionary', { word: 'newword' });
      });
    });

    it('adds word on Enter key', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      const input = screen.getByPlaceholderText('Add a word...');
      await fireEvent.input(input, { target: { value: 'anotherword' } });
      await fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('add_to_dictionary', { word: 'anotherword' });
      });
    });

    it('removes word from dictionary', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      // Expand dictionary
      await waitFor(() => {
        expect(screen.getByText('3 words')).toBeInTheDocument();
      });
      const expandBtn = screen.getByText('3 words').closest('button')!;
      await fireEvent.click(expandBtn);
      
      // Find and click remove button
      await waitFor(() => {
        expect(screen.getByText('testword')).toBeInTheDocument();
      });
      
      const removeBtn = screen.getByLabelText('Remove testword');
      await fireEvent.click(removeBtn);
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('remove_from_dictionary', { word: 'testword' });
      });
    });

    it('filters dictionary by search', async () => {
      // Mock a larger dictionary to show search
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'get_custom_dictionary') {
          return ['word1', 'word2', 'word3', 'test1', 'test2', 'other'];
        }
        if (cmd === 'get_spell_check_languages') {
          return mockLanguages;
        }
        return undefined;
      });

      render(SpellcheckSettings, { enabled: true });
      
      // Expand dictionary
      await waitFor(() => {
        expect(screen.getByText('6 words')).toBeInTheDocument();
      });
      const expandBtn = screen.getByText('6 words').closest('button')!;
      await fireEvent.click(expandBtn);
      
      // Search for 'test'
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search dictionary...')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText('Search dictionary...');
      await fireEvent.input(searchInput, { target: { value: 'test' } });
      
      // Should show only test words
      await waitFor(() => {
        expect(screen.getByText('test1')).toBeInTheDocument();
        expect(screen.getByText('test2')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('word1')).not.toBeInTheDocument();
    });
  });

  describe('spell check test', () => {
    it('runs spell check on test text', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'This is misspeled text' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('check_spelling', {
          text: 'This is misspeled text',
          language: 'en_US'
        });
      });
    });

    it('displays spell check results', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'misspeled' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByText('1 misspelled word found')).toBeInTheDocument();
      });
      
      expect(screen.getByText('misspeled')).toBeInTheDocument();
      expect(screen.getByText(/misspelled, misspell/)).toBeInTheDocument();
    });

    it('shows success when no errors found', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'check_spelling') {
          return [];
        }
        if (cmd === 'get_spell_check_languages') {
          return mockLanguages;
        }
        if (cmd === 'get_custom_dictionary') {
          return mockDictionary;
        }
        return undefined;
      });

      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'correctly spelled text' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByText('No spelling errors found!')).toBeInTheDocument();
      });
    });

    it('allows adding misspelled word to dictionary from results', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'misspeled' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByText('misspeled')).toBeInTheDocument();
      });
      
      // Click add to dictionary button
      const addBtn = screen.getByTitle('Add to dictionary');
      await fireEvent.click(addBtn);
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('add_to_dictionary', { word: 'misspeled' });
      });
    });

    it('disables test area when spell check is disabled', () => {
      render(SpellcheckSettings, { enabled: false });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      expect(textarea).toBeDisabled();
      
      const checkBtn = screen.getByText('Check Spelling');
      expect(checkBtn).toBeDisabled();
    });
  });

  describe('error handling', () => {
    it('displays error when spell check fails', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'check_spelling') {
          throw new Error('aspell not found');
        }
        if (cmd === 'get_spell_check_languages') {
          return mockLanguages;
        }
        if (cmd === 'get_custom_dictionary') {
          return mockDictionary;
        }
        return undefined;
      });

      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'test text' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/Spell check failed/)).toBeInTheDocument();
      });
    });

    it('dismisses error when close button clicked', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'check_spelling') {
          throw new Error('aspell not found');
        }
        if (cmd === 'get_spell_check_languages') {
          return mockLanguages;
        }
        if (cmd === 'get_custom_dictionary') {
          return mockDictionary;
        }
        return undefined;
      });

      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'test' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByText(/Spell check failed/)).toBeInTheDocument();
      });
      
      const dismissBtn = screen.getByLabelText('Dismiss');
      await fireEvent.click(dismissBtn);
      
      expect(screen.queryByText(/Spell check failed/)).not.toBeInTheDocument();
    });

    it('shows error when adding duplicate word', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('get_custom_dictionary');
      });
      
      const input = screen.getByPlaceholderText('Add a word...');
      await fireEvent.input(input, { target: { value: 'testword' } }); // Already in dictionary
      
      const addBtn = screen.getByText('Add');
      await fireEvent.click(addBtn);
      
      await waitFor(() => {
        expect(screen.getByText('Word already in dictionary')).toBeInTheDocument();
      });
    });
  });

  describe('requirements section', () => {
    it('shows installation requirements', () => {
      render(SpellcheckSettings, { enabled: true });
      
      expect(screen.getByText('Requirements')).toBeInTheDocument();
      expect(screen.getByText(/Linux:/)).toBeInTheDocument();
      expect(screen.getByText(/macOS:/)).toBeInTheDocument();
      expect(screen.getByText(/Windows:/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper form labels', () => {
      render(SpellcheckSettings, { enabled: true });
      
      expect(screen.getByLabelText(/Enable Spell Check/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Language/i)).toBeInTheDocument();
    });

    it('has expandable section with aria-expanded', async () => {
      render(SpellcheckSettings, { enabled: true });
      
      await waitFor(() => {
        expect(screen.getByText('3 words')).toBeInTheDocument();
      });

      const expandBtn = screen.getByText('3 words').closest('button')!;
      expect(expandBtn).toHaveAttribute('aria-expanded', 'false');
      
      await fireEvent.click(expandBtn);
      expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
    });

    it('error banner has alert role', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'check_spelling') {
          throw new Error('Failed');
        }
        if (cmd === 'get_spell_check_languages') {
          return mockLanguages;
        }
        if (cmd === 'get_custom_dictionary') {
          return mockDictionary;
        }
        return undefined;
      });

      render(SpellcheckSettings, { enabled: true });
      
      const textarea = screen.getByPlaceholderText('Type or paste text to check spelling...');
      await fireEvent.input(textarea, { target: { value: 'test' } });
      
      const checkBtn = screen.getByText('Check Spelling');
      await fireEvent.click(checkBtn);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
