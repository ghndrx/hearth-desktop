import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/svelte';
import ToastManager from './ToastManager.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

describe('ToastManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    delete (window as any).__toastManager;
  });

  describe('rendering', () => {
    it('renders toast container', () => {
      const { container } = render(ToastManager);
      expect(container.querySelector('.toast-container')).toBeInTheDocument();
    });

    it('applies correct position classes', () => {
      const { container } = render(ToastManager, { props: { position: 'top-left' } });
      const toastContainer = container.querySelector('.toast-container');
      expect(toastContainer?.getAttribute('style')).toContain('top: 0');
      expect(toastContainer?.getAttribute('style')).toContain('left: 0');
    });

    it('renders with custom gap', () => {
      const { container } = render(ToastManager, { props: { gap: 20 } });
      const toastContainer = container.querySelector('.toast-container');
      expect(toastContainer?.getAttribute('style')).toContain('gap: 20px');
    });
  });

  describe('toast operations', () => {
    it('exposes toast API globally', () => {
      render(ToastManager);
      expect((window as any).__toastManager).toBeDefined();
      expect((window as any).__toastManager.show).toBeDefined();
      expect((window as any).__toastManager.dismiss).toBeDefined();
      expect((window as any).__toastManager.dismissAll).toBeDefined();
    });

    it('shows info toast', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.info('Test info message');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Test info message')).toBeInTheDocument();
    });

    it('shows success toast', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.success('Operation successful');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
    });

    it('shows warning toast', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.warning('Warning message');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('shows error toast', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.error('Error occurred');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('shows loading toast', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.loading('Loading...');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows toast with message body', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Title',
        message: 'Detailed message body',
        type: 'info'
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Detailed message body')).toBeInTheDocument();
    });

    it('shows toast with custom icon', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Custom icon',
        icon: '🎉'
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('returns toast id', () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.info('Test');
      expect(typeof id).toBe('string');
      expect(id.startsWith('toast-')).toBe(true);
    });

    it('accepts custom id', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.show({
        id: 'custom-id',
        title: 'Custom ID toast'
      });
      
      expect(id).toBe('custom-id');
    });
  });

  describe('toast dismissal', () => {
    it('dismisses toast by id', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.info('To be dismissed');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('To be dismissed')).toBeInTheDocument();
      
      api.dismiss(id);
      await vi.advanceTimersByTimeAsync(200);
      
      expect(screen.queryByText('To be dismissed')).not.toBeInTheDocument();
    });

    it('dismisses all toasts', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.info('Toast 1');
      api.info('Toast 2');
      api.info('Toast 3');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
      
      api.dismissAll();
      await vi.advanceTimersByTimeAsync(200);
      
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Toast 3')).not.toBeInTheDocument();
    });

    it('auto-dismisses after duration', async () => {
      render(ToastManager, { props: { defaultDuration: 1000 } });
      const api = (window as any).__toastManager;
      
      api.info('Auto dismiss');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Auto dismiss')).toBeInTheDocument();
      
      await vi.advanceTimersByTimeAsync(1200);
      
      expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
    });

    it('loading toast does not auto-dismiss', async () => {
      render(ToastManager, { props: { defaultDuration: 100 } });
      const api = (window as any).__toastManager;
      
      api.loading('Loading...');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      await vi.advanceTimersByTimeAsync(500);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('dismisses via close button', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.info('Closeable toast');
      await vi.advanceTimersByTimeAsync(50);
      
      const closeButton = screen.getByLabelText('Dismiss notification');
      await fireEvent.click(closeButton);
      await vi.advanceTimersByTimeAsync(200);
      
      expect(screen.queryByText('Closeable toast')).not.toBeInTheDocument();
    });
  });

  describe('toast update', () => {
    it('updates toast title', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.info('Original title');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Original title')).toBeInTheDocument();
      
      api.update(id, { title: 'Updated title' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.queryByText('Original title')).not.toBeInTheDocument();
      expect(screen.getByText('Updated title')).toBeInTheDocument();
    });

    it('updates toast type', async () => {
      const { container } = render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.info('Changing type');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(container.querySelector('.toast--info')).toBeInTheDocument();
      
      api.update(id, { type: 'success' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(container.querySelector('.toast--success')).toBeInTheDocument();
    });

    it('updates toast message', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const id = api.show({ title: 'Title', message: 'Original message' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Original message')).toBeInTheDocument();
      
      api.update(id, { message: 'Updated message' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.queryByText('Original message')).not.toBeInTheDocument();
      expect(screen.getByText('Updated message')).toBeInTheDocument();
    });
  });

  describe('promise toast', () => {
    it('shows loading then success', async () => {
      render(ToastManager, { props: { defaultDuration: 1000 } });
      const api = (window as any).__toastManager;
      
      const promise = new Promise(resolve => setTimeout(() => resolve('done'), 500));
      
      api.promise(promise, {
        loading: 'Loading...',
        success: 'Success!',
        error: 'Error!'
      });
      
      await vi.advanceTimersByTimeAsync(50);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      await vi.advanceTimersByTimeAsync(600);
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('shows loading then error', async () => {
      render(ToastManager, { props: { defaultDuration: 1000 } });
      const api = (window as any).__toastManager;
      
      const promise = new Promise((_, reject) => setTimeout(() => reject('failed'), 500));
      
      api.promise(promise, {
        loading: 'Loading...',
        success: 'Success!',
        error: 'Error!'
      }).catch(() => {});
      
      await vi.advanceTimersByTimeAsync(50);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      await vi.advanceTimersByTimeAsync(600);
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Error!')).toBeInTheDocument();
    });

    it('supports dynamic success message', async () => {
      render(ToastManager, { props: { defaultDuration: 1000 } });
      const api = (window as any).__toastManager;
      
      const promise = Promise.resolve({ count: 5 });
      
      api.promise(promise, {
        loading: 'Loading...',
        success: (data: { count: number }) => `Loaded ${data.count} items`,
        error: 'Error!'
      });
      
      await vi.advanceTimersByTimeAsync(100);
      
      expect(screen.getByText('Loaded 5 items')).toBeInTheDocument();
    });
  });

  describe('toast actions', () => {
    it('renders action buttons', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Action toast',
        actions: [
          { label: 'Undo', onClick: vi.fn() },
          { label: 'Retry', onClick: vi.fn() }
        ]
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('calls action callback on click', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      const onClick = vi.fn();
      api.show({
        title: 'Action toast',
        actions: [{ label: 'Click me', onClick }]
      });
      await vi.advanceTimersByTimeAsync(50);
      
      await fireEvent.click(screen.getByText('Click me'));
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('dismisses after action click when dismissible', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Action toast',
        dismissible: true,
        actions: [{ label: 'Dismiss', onClick: vi.fn() }]
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('Action toast')).toBeInTheDocument();
      
      await fireEvent.click(screen.getByText('Dismiss'));
      await vi.advanceTimersByTimeAsync(200);
      
      expect(screen.queryByText('Action toast')).not.toBeInTheDocument();
    });

    it('renders action with variant styles', async () => {
      const { container } = render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Action variants',
        actions: [
          { label: 'Primary', onClick: vi.fn(), variant: 'primary' },
          { label: 'Danger', onClick: vi.fn(), variant: 'danger' }
        ]
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(container.querySelector('.toast__action--primary')).toBeInTheDocument();
      expect(container.querySelector('.toast__action--danger')).toBeInTheDocument();
    });
  });

  describe('visibility limits', () => {
    it('limits visible toasts', async () => {
      render(ToastManager, { props: { maxVisible: 3 } });
      const api = (window as any).__toastManager;
      
      api.info('Toast 1');
      api.info('Toast 2');
      api.info('Toast 3');
      api.info('Toast 4');
      api.info('Toast 5');
      await vi.advanceTimersByTimeAsync(50);
      
      const toasts = screen.getAllByRole('alert');
      expect(toasts.length).toBe(3);
    });

    it('shows overflow count', async () => {
      render(ToastManager, { props: { maxVisible: 2 } });
      const api = (window as any).__toastManager;
      
      api.info('Toast 1');
      api.info('Toast 2');
      api.info('Toast 3');
      api.info('Toast 4');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('+2 more notifications')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('renders progress bar when enabled', async () => {
      const { container } = render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Progress toast',
        progress: true,
        duration: 5000
      });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(container.querySelector('.toast__progress')).toBeInTheDocument();
    });

    it('updates progress over time', async () => {
      const { container } = render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({
        title: 'Progress toast',
        progress: true,
        duration: 1000
      });
      await vi.advanceTimersByTimeAsync(50);
      
      const progressBar = container.querySelector('.toast__progress') as HTMLElement;
      const initialWidth = progressBar?.style.width;
      
      await vi.advanceTimersByTimeAsync(500);
      
      const updatedWidth = progressBar?.style.width;
      expect(parseFloat(updatedWidth || '100')).toBeLessThan(parseFloat(initialWidth || '100'));
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(ToastManager);
      const toastContainer = container.querySelector('.toast-container');
      
      expect(toastContainer?.getAttribute('role')).toBe('region');
      expect(toastContainer?.getAttribute('aria-label')).toBe('Notifications');
      expect(toastContainer?.getAttribute('aria-live')).toBe('polite');
    });

    it('toasts have alert role', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.info('Alert toast');
      await vi.advanceTimersByTimeAsync(50);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(toast.getAttribute('aria-atomic')).toBe('true');
    });

    it('close button has aria-label', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.info('Toast with close');
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
    });
  });

  describe('hover pause', () => {
    it('pauses timer on hover when enabled', async () => {
      render(ToastManager, { props: { pauseOnHover: true, defaultDuration: 500 } });
      const api = (window as any).__toastManager;
      
      api.info('Hover pause');
      await vi.advanceTimersByTimeAsync(50);
      
      const toast = screen.getByRole('alert');
      await fireEvent.mouseEnter(toast);
      
      await vi.advanceTimersByTimeAsync(1000);
      
      // Should still be present because paused
      expect(screen.getByText('Hover pause')).toBeInTheDocument();
      
      await fireEvent.mouseLeave(toast);
      await vi.advanceTimersByTimeAsync(600);
      
      // Should be dismissed after resume
      expect(screen.queryByText('Hover pause')).not.toBeInTheDocument();
    });
  });

  describe('duplicate handling', () => {
    it('replaces toast with same id', async () => {
      render(ToastManager);
      const api = (window as any).__toastManager;
      
      api.show({ id: 'unique', title: 'First' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.getByText('First')).toBeInTheDocument();
      
      api.show({ id: 'unique', title: 'Second' });
      await vi.advanceTimersByTimeAsync(50);
      
      expect(screen.queryByText('First')).not.toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      
      // Should only have one toast
      const toasts = screen.getAllByRole('alert');
      expect(toasts.length).toBe(1);
    });
  });
});
