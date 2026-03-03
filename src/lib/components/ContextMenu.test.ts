import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ContextMenu from './ContextMenu.svelte';

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders when show is true', () => {
      const { container } = render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      const menu = container.querySelector('.context-menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveAttribute('role', 'menu');
    });

    it('does not render when show is false', () => {
      const { container } = render(ContextMenu, {
        props: {
          show: false,
          x: 100,
          y: 100
        }
      });

      const menu = container.querySelector('.context-menu');
      expect(menu).not.toBeInTheDocument();
    });

    it('positions menu at specified coordinates', () => {
      const { container } = render(ContextMenu, {
        props: {
          show: true,
          x: 150,
          y: 200
        }
      });

      const menu = container.querySelector('.context-menu') as HTMLElement;
      expect(menu.style.left).toBe('150px');
      expect(menu.style.top).toBe('200px');
    });
  });

  describe('interactions', () => {
    it('registers document event listeners', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('does not trigger errors when clicking inside menu', async () => {
      const { container } = render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      const menu = container.querySelector('.context-menu');
      // Should not throw
      await expect(fireEvent.click(menu!)).resolves.not.toThrow();
    });

    it('handles keyboard events without errors', async () => {
      render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      // Should not throw
      await expect(fireEvent.keyDown(document, { key: 'Escape' })).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('styling', () => {
    it('has correct CSS classes', () => {
      const { container } = render(ContextMenu, {
        props: {
          show: true,
          x: 100,
          y: 100
        }
      });

      const menu = container.querySelector('.context-menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveClass('context-menu');
    });
  });
});
