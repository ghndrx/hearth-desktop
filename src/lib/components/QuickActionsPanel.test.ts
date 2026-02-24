import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import QuickActionsPanel from './QuickActionsPanel.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}));

describe('QuickActionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    expect(container.querySelector('.panel')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: false } });
    expect(container.querySelector('.panel')).toBeFalsy();
  });

  it('shows search input when open', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    const input = container.querySelector('.search-input');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toContain('command');
  });

  it('displays quick actions', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    const items = container.querySelectorAll('.item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('filters actions based on search query', async () => {
    const { container, component } = render(QuickActionsPanel, { props: { isOpen: true } });
    
    const input = container.querySelector('.search-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'message' } });
    
    const items = container.querySelectorAll('.item-label');
    const labels = Array.from(items).map(el => el.textContent?.toLowerCase());
    expect(labels.some(l => l?.includes('message'))).toBe(true);
  });

  it('closes on Escape key', async () => {
    const { component } = render(QuickActionsPanel, { props: { isOpen: true } });
    
    let closeCalled = false;
    component.$on('close', () => { closeCalled = true; });
    
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(closeCalled).toBe(true);
  });

  it('navigates with arrow keys', async () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    
    await fireEvent.keyDown(window, { key: 'ArrowDown' });
    
    const selectedItems = container.querySelectorAll('.item.selected');
    expect(selectedItems.length).toBe(1);
  });

  it('shows keyboard hints in footer', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    const footer = container.querySelector('.footer');
    expect(footer?.textContent).toContain('Navigate');
    expect(footer?.textContent).toContain('Select');
    expect(footer?.textContent).toContain('Close');
  });

  it('shows empty state when no results match', async () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    
    const input = container.querySelector('.search-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'xyznonexistent' } });
    
    const emptyState = container.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('dispatches action event when item selected', async () => {
    const { container, component } = render(QuickActionsPanel, { props: { isOpen: true } });
    
    let actionFired = false;
    component.$on('action', () => { actionFired = true; });
    
    const firstItem = container.querySelector('.item');
    if (firstItem) {
      await fireEvent.click(firstItem);
    }
    
    expect(actionFired).toBe(true);
  });

  it('shows shortcuts for applicable actions', () => {
    const { container } = render(QuickActionsPanel, { props: { isOpen: true } });
    const shortcuts = container.querySelectorAll('.item-shortcut');
    expect(shortcuts.length).toBeGreaterThan(0);
  });
});
