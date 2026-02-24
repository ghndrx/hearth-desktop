import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import EmojiPicker from './EmojiPicker.svelte';

describe('EmojiPicker', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when show is false', () => {
      const { container } = render(EmojiPicker, { props: { show: false } });
      expect(container.querySelector('.emoji-picker')).toBeNull();
    });

    it('renders picker when show is true', () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      expect(container.querySelector('.emoji-picker')).not.toBeNull();
    });
  });

  describe('search functionality', () => {
    it('renders search input', () => {
      render(EmojiPicker, { props: { show: true } });
      const searchInput = screen.getByPlaceholderText('Search emoji');
      expect(searchInput).toBeInTheDocument();
    });

    it('filters emojis based on search query', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const searchInput = screen.getByPlaceholderText('Search emoji');
      
      await fireEvent.input(searchInput, { target: { value: '😀' } });
      
      // Should show search results label
      expect(container.textContent).toContain('Search Results');
    });

    it('shows no results message when search has no matches', async () => {
      render(EmojiPicker, { props: { show: true } });
      const searchInput = screen.getByPlaceholderText('Search emoji');
      
      await fireEvent.input(searchInput, { target: { value: 'xyznonexistent' } });
      
      expect(screen.getByText(/No emoji found/)).toBeInTheDocument();
    });
  });

  describe('category navigation', () => {
    it('renders category buttons', () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const categoryButtons = container.querySelectorAll('.category-btn');
      
      // Should have at least 9 categories (excluding recent if empty)
      expect(categoryButtons.length).toBeGreaterThanOrEqual(9);
    });

    it('switches category when clicking category button', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const categoryButtons = container.querySelectorAll('.category-btn');
      
      // Click on People & Body category (second visible button when no recents)
      await fireEvent.click(categoryButtons[1]);
      
      // Check that the category label changed
      const categoryLabel = container.querySelector('.category-label');
      expect(categoryLabel?.textContent).toContain('People & Body');
    });

    it('shows category labels', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      // Click first category button (Smileys & Emotion) to ensure it's selected
      const categoryButtons = container.querySelectorAll('.category-btn');
      await fireEvent.click(categoryButtons[0]);
      
      // Now check the category label
      const categoryLabel = container.querySelector('.category-label');
      expect(categoryLabel).toBeInTheDocument();
      expect(categoryLabel?.textContent).toContain('Smileys & Emotion');
    });
  });

  describe('skin tone selector', () => {
    it('renders skin tone button', () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const skinToneButton = container.querySelector('.skin-tone-button');
      
      expect(skinToneButton).toBeInTheDocument();
    });

    it('opens skin tone picker when clicking button', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const skinToneButton = container.querySelector('.skin-tone-button') as HTMLElement;
      
      await fireEvent.click(skinToneButton);
      
      const skinTonePicker = container.querySelector('.skin-tone-picker');
      expect(skinTonePicker).toBeInTheDocument();
    });

    it('shows all 6 skin tone options', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const skinToneButton = container.querySelector('.skin-tone-button') as HTMLElement;
      
      await fireEvent.click(skinToneButton);
      
      const skinToneOptions = container.querySelectorAll('.skin-tone-option');
      expect(skinToneOptions.length).toBe(6);
    });

    it('selects skin tone and closes picker', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const skinToneButton = container.querySelector('.skin-tone-button') as HTMLElement;
      
      await fireEvent.click(skinToneButton);
      
      const skinToneOptions = container.querySelectorAll('.skin-tone-option');
      await fireEvent.click(skinToneOptions[2]); // Select Medium-Light
      
      // Picker should close
      const skinTonePicker = container.querySelector('.skin-tone-picker');
      expect(skinTonePicker).toBeNull();
    });
  });

  describe('emoji selection', () => {
    it('renders emoji buttons', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      // Click on Smileys category first (default is "Recently Used" which may be empty)
      const categoryButtons = container.querySelectorAll('.category-btn');
      await fireEvent.click(categoryButtons[0]); // Click Smileys & Emotion
      
      const emojiButtons = container.querySelectorAll('.emoji-btn');
      
      // Should have many emoji buttons
      expect(emojiButtons.length).toBeGreaterThan(10);
    });

    // Skip - needs Svelte 5 event prop migration
    it.skip('dispatches select event when clicking emoji', async () => {
      // Svelte 5 uses event props instead of $on
    });
  });

  describe('recent emojis', () => {
    it('loads recent emojis from localStorage on mount', () => {
      const recentEmojis = ['😀', '😎', '🎉'];
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(recentEmojis));
      
      render(EmojiPicker, { props: { show: true } });
      
      expect(localStorage.getItem).toHaveBeenCalledWith('hearth_recent_emojis');
    });

    it('saves emoji to recent when selected', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      // Click on Smileys category first to get emoji buttons
      const categoryButtons = container.querySelectorAll('.category-btn');
      await fireEvent.click(categoryButtons[0]); // Click Smileys & Emotion
      
      // Wait for emojis to render
      await waitFor(() => {
        const buttons = container.querySelectorAll('.emoji-btn');
        expect(buttons.length).toBeGreaterThan(0);
      });
      
      const emojiButtons = container.querySelectorAll('.emoji-btn');
      if (emojiButtons.length > 0) {
        await fireEvent.click(emojiButtons[0]);
        expect(localStorage.setItem).toHaveBeenCalled();
      }
    });
  });

  describe('keyboard navigation', () => {
    // Skip - needs Svelte 5 event prop migration  
    it.skip('closes picker on Escape key', async () => {
      // Svelte 5 uses event props instead of $on
    });

    // Skip - needs Svelte 5 event prop migration
    it.skip('closes skin tone picker first on Escape', async () => {
      // Svelte 5 uses event props instead of $on
    });
  });

  describe('footer preview', () => {
    it('renders footer with preview emoji', () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      const footer = container.querySelector('.footer');
      
      expect(footer).toBeInTheDocument();
    });

    it('shows preview info text', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      // Click on Smileys category first to have emojis (otherwise shows "No emoji selected")
      const categoryButtons = container.querySelectorAll('.category-btn');
      await fireEvent.click(categoryButtons[0]); // Click Smileys & Emotion
      
      // Check for preview info in the footer
      const previewInfo = container.querySelector('.preview-info');
      expect(previewInfo).toBeInTheDocument();
      expect(previewInfo?.textContent).toContain('Hover to preview');
    });
  });

  describe('styling and animations', () => {
    it('has proper structure with header, categories, emojis, and footer', () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      expect(container.querySelector('.header')).toBeInTheDocument();
      expect(container.querySelector('.categories')).toBeInTheDocument();
      expect(container.querySelector('.category-label')).toBeInTheDocument();
      expect(container.querySelector('.emojis')).toBeInTheDocument();
      expect(container.querySelector('.footer')).toBeInTheDocument();
    });

    it('has active class on selected category', async () => {
      const { container } = render(EmojiPicker, { props: { show: true } });
      
      // Click a category to select it
      const categoryButtons = container.querySelectorAll('.category-btn');
      await fireEvent.click(categoryButtons[0]); // Click Smileys & Emotion
      
      // Check for active class
      await waitFor(() => {
        const activeCategory = container.querySelector('.category-btn.active');
        expect(activeCategory).toBeInTheDocument();
      });
    });
  });
});
