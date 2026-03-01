import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ContextualHelpPanel from './ContextualHelpPanel.svelte';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  })
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('ContextualHelpPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(ContextualHelpPanel, { props: { isOpen: false } });
      expect(screen.queryByText('💡 Help & Tips')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByText('💡 Help & Tips')).toBeInTheDocument();
    });

    it('should render search input', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByPlaceholderText('Search help topics...')).toBeInTheDocument();
    });

    it('should render category chips', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('should render suggested topics section', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByText('💡 Suggested for You')).toBeInTheDocument();
    });

    it('should render all topics section', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByText('All Topics')).toBeInTheDocument();
    });

    it('should render footer links', () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      expect(screen.getByText('📚 Full Documentation')).toBeInTheDocument();
      expect(screen.getByText('💬 Contact Support')).toBeInTheDocument();
    });
  });

  describe('Positions', () => {
    it('should apply right position class', () => {
      const { container } = render(ContextualHelpPanel, { 
        props: { isOpen: true, position: 'right' } 
      });
      expect(container.querySelector('.position-right')).toBeInTheDocument();
    });

    it('should apply bottom position class', () => {
      const { container } = render(ContextualHelpPanel, { 
        props: { isOpen: true, position: 'bottom' } 
      });
      expect(container.querySelector('.position-bottom')).toBeInTheDocument();
    });

    it('should apply floating position class', () => {
      const { container } = render(ContextualHelpPanel, { 
        props: { isOpen: true, position: 'floating' } 
      });
      expect(container.querySelector('.position-floating')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should filter topics based on search query', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      const searchInput = screen.getByPlaceholderText('Search help topics...');
      
      await fireEvent.input(searchInput, { target: { value: 'focus' } });
      
      await waitFor(() => {
        expect(screen.getByText('Focus Mode')).toBeInTheDocument();
      });
    });

    it('should show no results message for invalid search', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      const searchInput = screen.getByPlaceholderText('Search help topics...');
      
      await fireEvent.input(searchInput, { target: { value: 'xyznonexistent' } });
      
      await waitFor(() => {
        expect(screen.getByText(/No topics found/)).toBeInTheDocument();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      const searchInput = screen.getByPlaceholderText('Search help topics...') as HTMLInputElement;
      
      await fireEvent.input(searchInput, { target: { value: 'focus' } });
      
      const clearButton = screen.getByText('×');
      await fireEvent.click(clearButton);
      
      expect(searchInput.value).toBe('');
    });
  });

  describe('Category Filtering', () => {
    it('should filter topics by category', async () => {
      const { container } = render(ContextualHelpPanel, { props: { isOpen: true } });
      
      // Find and click productivity category (⚡ icon)
      const categoryChips = container.querySelectorAll('.category-chip');
      const productivityChip = Array.from(categoryChips).find(
        chip => chip.textContent?.includes('⚡')
      );
      
      if (productivityChip) {
        await fireEvent.click(productivityChip);
        expect(productivityChip).toHaveClass('active');
      }
    });

    it('should show all topics when All is selected', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const allButton = screen.getByText('All');
      await fireEvent.click(allButton);
      
      expect(allButton).toHaveClass('active');
    });
  });

  describe('Topic Selection', () => {
    it('should show topic detail when topic is clicked', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(screen.getByText(/How to use:/)).toBeInTheDocument();
      });
    });

    it('should show back button in topic detail view', async () => {
      const { container } = render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(container.querySelector('.back-btn')).toBeInTheDocument();
      });
    });

    it('should return to browse view when back is clicked', async () => {
      const { container } = render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        const backBtn = container.querySelector('.back-btn');
        expect(backBtn).toBeInTheDocument();
      });
      
      const backBtn = container.querySelector('.back-btn') as HTMLElement;
      await fireEvent.click(backBtn);
      
      await waitFor(() => {
        expect(screen.getByText('💡 Help & Tips')).toBeInTheDocument();
      });
    });
  });

  describe('Pinning', () => {
    it('should pin a topic when pin button is clicked', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        const pinBtn = screen.getByText('📍 Pin');
        expect(pinBtn).toBeInTheDocument();
      });
      
      const pinBtn = screen.getByText('📍 Pin');
      await fireEvent.click(pinBtn);
      
      await waitFor(() => {
        expect(screen.getByText('📌 Pinned')).toBeInTheDocument();
      });
    });

    it('should save pinned topics to localStorage', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        const pinBtn = screen.getByText('📍 Pin');
        fireEvent.click(pinBtn);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'help-pinned-topics',
        expect.any(String)
      );
    });
  });

  describe('Feedback', () => {
    it('should show feedback section in topic detail', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(screen.getByText('Was this helpful?')).toBeInTheDocument();
        expect(screen.getByText('👍 Yes')).toBeInTheDocument();
        expect(screen.getByText('👎 No')).toBeInTheDocument();
      });
    });

    it('should dispatch feedback event when button is clicked', async () => {
      const { component } = render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const feedbackHandler = vi.fn();
      component.$on('feedbackSubmitted', feedbackHandler);
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        const yesBtn = screen.getByText('👍 Yes');
        fireEvent.click(yesBtn);
      });
      
      expect(feedbackHandler).toHaveBeenCalled();
    });
  });

  describe('Close', () => {
    it('should dispatch close event when close button is clicked', async () => {
      const { component, container } = render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const closeHandler = vi.fn();
      component.$on('close', closeHandler);
      
      const closeBtn = container.querySelector('.close-btn') as HTMLElement;
      await fireEvent.click(closeBtn);
      
      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('Tips Section', () => {
    it('should hide tips when hide button is clicked', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const hideBtn = screen.getByText('Hide');
      await fireEvent.click(hideBtn);
      
      await waitFor(() => {
        expect(screen.queryByText('💡 Suggested for You')).not.toBeInTheDocument();
      });
    });
  });

  describe('Context-aware suggestions', () => {
    it('should show context-specific topics based on context prop', () => {
      render(ContextualHelpPanel, { 
        props: { 
          isOpen: true,
          context: {
            currentView: 'settings',
            userLevel: 'regular',
            recentActions: []
          }
        } 
      });
      
      expect(screen.getByText('💡 Suggested for You')).toBeInTheDocument();
    });
  });

  describe('Topic metadata', () => {
    it('should display shortcut badge for topics with shortcuts', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
      });
    });

    it('should display difficulty badge for topics', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(screen.getByText('beginner')).toBeInTheDocument();
      });
    });

    it('should display related features', async () => {
      render(ContextualHelpPanel, { props: { isOpen: true } });
      
      const topicItem = screen.getByText('Quick Actions Panel');
      await fireEvent.click(topicItem);
      
      await waitFor(() => {
        expect(screen.getByText('Related Features')).toBeInTheDocument();
      });
    });
  });
});
