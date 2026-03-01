import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NativeSpellcheckManager from './NativeSpellcheckManager.svelte';

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

describe('NativeSpellcheckManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the toggle button', () => {
    render(NativeSpellcheckManager);
    const button = screen.getByTitle(/Spellcheck Manager/i);
    expect(button).toBeTruthy();
  });

  it('opens the panel when clicked', async () => {
    render(NativeSpellcheckManager);
    const button = screen.getByTitle(/Spellcheck Manager/i);
    await fireEvent.click(button);
    expect(screen.getByText('Spellcheck Manager')).toBeTruthy();
  });

  it('shows dictionaries by default', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    expect(screen.getByText('English (US)')).toBeTruthy();
    expect(screen.getByText('Spanish')).toBeTruthy();
  });

  it('can switch to custom dictionary tab', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Custom Dictionary'));
    expect(screen.getByPlaceholderText(/Add a word/i)).toBeTruthy();
  });

  it('can add a custom word', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Custom Dictionary'));

    const input = screen.getByPlaceholderText(/Add a word/i);
    await fireEvent.input(input, { target: { value: 'testword' } });
    await fireEvent.click(screen.getByText('Add'));

    const saved = localStorage.getItem('hearth-spellcheck-custom');
    expect(saved).toBeTruthy();
    const words = JSON.parse(saved!);
    expect(words.length).toBe(1);
    expect(words[0].word).toBe('testword');
  });

  it('shows settings tab with behavior options', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Behavior')).toBeTruthy();
    expect(screen.getByText('Check spelling as you type')).toBeTruthy();
    expect(screen.getByText('Highlight spelling errors')).toBeTruthy();
  });

  it('shows keyboard shortcut info', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Toggle Spellcheck Manager')).toBeTruthy();
  });

  it('loads saved custom words from localStorage', async () => {
    const savedWords = [{ word: 'preloaded', addedAt: new Date().toISOString() }];
    localStorage.setItem('hearth-spellcheck-custom', JSON.stringify(savedWords));

    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Custom Dictionary'));
    expect(screen.getByText('preloaded')).toBeTruthy();
  });

  it('shows statistics in settings', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Statistics')).toBeTruthy();
    expect(screen.getByText('Active dictionaries:')).toBeTruthy();
  });

  it('can search custom words', async () => {
    const savedWords = [
      { word: 'alpha', addedAt: new Date().toISOString() },
      { word: 'beta', addedAt: new Date().toISOString() },
    ];
    localStorage.setItem('hearth-spellcheck-custom', JSON.stringify(savedWords));

    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Custom Dictionary'));

    const searchInput = screen.getByPlaceholderText(/Search custom words/i);
    await fireEvent.input(searchInput, { target: { value: 'alpha' } });

    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.queryByText('beta')).toBeFalsy();
  });

  it('shows import and export buttons', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    await fireEvent.click(screen.getByText('Custom Dictionary'));
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
  });

  it('shows three tabs', async () => {
    render(NativeSpellcheckManager);
    await fireEvent.click(screen.getByTitle(/Spellcheck Manager/i));
    expect(screen.getByText('Dictionaries')).toBeTruthy();
    expect(screen.getByText('Custom Dictionary')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });
});
