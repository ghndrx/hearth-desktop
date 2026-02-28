import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import BreathingExercise from './BreathingExercise.svelte';

describe('BreathingExercise', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(BreathingExercise, { props: { isOpen: true } });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('🌬️ Breathing Exercise')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    render(BreathingExercise, { props: { isOpen: false } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('displays all breathing patterns in selector', () => {
    render(BreathingExercise, { props: { isOpen: true } });
    const select = screen.getByLabelText('Choose a pattern:') as HTMLSelectElement;
    expect(select.options.length).toBe(4);
    expect(Array.from(select.options).map(o => o.text)).toEqual([
      'Relaxing', 'Balanced', 'Energizing', 'Calming'
    ]);
  });

  it('shows duration buttons and allows selection', async () => {
    render(BreathingExercise, { props: { isOpen: true } });
    
    const buttons = screen.getAllByRole('button').filter(b => b.textContent?.includes('min'));
    expect(buttons).toHaveLength(4);
    
    const fiveMinBtn = screen.getByText('5 min');
    await fireEvent.click(fiveMinBtn);
    expect(fiveMinBtn.classList.contains('active')).toBe(true);
  });

  it('starts session when Begin Session is clicked', async () => {
    const { component } = render(BreathingExercise, { props: { isOpen: true } });
    
    const startSpy = vi.fn();
    component.$on('sessionStart', startSpy);

    await fireEvent.click(screen.getByText('Begin Session'));
    
    expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        pattern: 'balanced',
        duration: 3
      })
    }));
  });

  it('shows session screen after starting', async () => {
    render(BreathingExercise, { props: { isOpen: true } });
    
    await fireEvent.click(screen.getByText('Begin Session'));
    
    expect(screen.getByText('3:00')).toBeTruthy();
    expect(screen.getByText('0 cycles')).toBeTruthy();
    expect(screen.getByText('Breathe In')).toBeTruthy();
  });

  it('can pause and resume session', async () => {
    render(BreathingExercise, { props: { isOpen: true } });
    await fireEvent.click(screen.getByText('Begin Session'));
    
    const pauseBtn = screen.getByText('⏸️ Pause');
    await fireEvent.click(pauseBtn);
    expect(screen.getByText('▶️ Resume')).toBeTruthy();
    
    await fireEvent.click(screen.getByText('▶️ Resume'));
    expect(screen.getByText('⏸️ Pause')).toBeTruthy();
  });

  it('emits sessionEnd when End button is clicked', async () => {
    const { component } = render(BreathingExercise, { props: { isOpen: true } });
    
    const endSpy = vi.fn();
    component.$on('sessionEnd', endSpy);

    await fireEvent.click(screen.getByText('Begin Session'));
    await fireEvent.click(screen.getByText('⏹️ End'));
    
    expect(endSpy).toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const { component } = render(BreathingExercise, { props: { isOpen: true } });
    
    const closeSpy = vi.fn();
    component.$on('close', closeSpy);

    await fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(closeSpy).toHaveBeenCalled();
  });

  it('toggles pause on Space key during session', async () => {
    render(BreathingExercise, { props: { isOpen: true } });
    await fireEvent.click(screen.getByText('Begin Session'));
    
    expect(screen.getByText('⏸️ Pause')).toBeTruthy();
    
    await fireEvent.keyDown(document, { key: ' ' });
    expect(screen.getByText('▶️ Resume')).toBeTruthy();
    
    await fireEvent.keyDown(document, { key: ' ' });
    expect(screen.getByText('⏸️ Pause')).toBeTruthy();
  });

  it('closes when clicking overlay background', async () => {
    const { component } = render(BreathingExercise, { props: { isOpen: true } });
    
    const closeSpy = vi.fn();
    component.$on('close', closeSpy);

    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      await fireEvent.click(overlay);
    }
    
    expect(closeSpy).toHaveBeenCalled();
  });

  it('respects defaultPattern prop', () => {
    render(BreathingExercise, { props: { isOpen: true, defaultPattern: 'relaxing' } });
    const select = screen.getByLabelText('Choose a pattern:') as HTMLSelectElement;
    expect(select.value).toBe('relaxing');
  });

  it('respects sessionMinutes prop', async () => {
    render(BreathingExercise, { props: { isOpen: true, sessionMinutes: 5 } });
    await fireEvent.click(screen.getByText('Begin Session'));
    expect(screen.getByText('5:00')).toBeTruthy();
  });

  it('displays pattern description', () => {
    render(BreathingExercise, { props: { isOpen: true } });
    expect(screen.getByText('Box breathing for focus')).toBeTruthy();
  });

  it('shows pattern timing details', () => {
    render(BreathingExercise, { props: { isOpen: true } });
    expect(screen.getByText('Inhale: 4s')).toBeTruthy();
    expect(screen.getByText('Hold: 4s')).toBeTruthy();
    expect(screen.getByText('Exhale: 4s')).toBeTruthy();
  });

  it('updates pattern description when pattern changes', async () => {
    render(BreathingExercise, { props: { isOpen: true } });
    const select = screen.getByLabelText('Choose a pattern:') as HTMLSelectElement;
    
    await fireEvent.change(select, { target: { value: 'relaxing' } });
    
    expect(screen.getByText('4-7-8 technique for relaxation')).toBeTruthy();
  });
});
