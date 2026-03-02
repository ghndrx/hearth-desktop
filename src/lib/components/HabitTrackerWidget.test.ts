import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import HabitTrackerWidget from './HabitTrackerWidget.svelte';

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined)
}));

describe('HabitTrackerWidget', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default state', () => {
    render(HabitTrackerWidget);
    
    expect(screen.getByText('Habit Tracker')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(HabitTrackerWidget, { props: { compact: true } });
    
    expect(screen.getByText('Habits')).toBeInTheDocument();
  });

  it('shows empty state when no habits', () => {
    render(HabitTrackerWidget);
    
    expect(screen.getByText('No habits yet')).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('shows add habit form when button clicked', async () => {
    render(HabitTrackerWidget);
    
    const addButton = screen.getByText('+ Add Habit');
    await fireEvent.click(addButton);
    
    expect(screen.getByPlaceholderText('New habit...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('adds a new habit', async () => {
    render(HabitTrackerWidget);
    
    // Open form
    await fireEvent.click(screen.getByText('+ Add Habit'));
    
    // Enter habit name
    const input = screen.getByPlaceholderText('New habit...');
    await fireEvent.input(input, { target: { value: 'Exercise' } });
    
    // Submit
    await fireEvent.click(screen.getByText('Add'));
    
    // Verify habit appears
    expect(screen.getByText('Exercise')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });

  it('toggles habit completion', async () => {
    // Pre-populate localStorage
    const habits = [{
      id: 'test-1',
      name: 'Read',
      emoji: '📚',
      completedDates: [],
      createdAt: '2026-03-01T00:00:00Z',
      currentStreak: 0,
      longestStreak: 0,
      color: '#5865f2'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    // Find and click the check button
    const checkButton = screen.getByTitle('Mark complete');
    await fireEvent.click(checkButton);
    
    // Verify completion
    expect(screen.getByText('1/1')).toBeInTheDocument();
    expect(screen.getByTitle('Mark incomplete')).toBeInTheDocument();
  });

  it('calculates streaks correctly', async () => {
    // Habit with 3-day streak ending yesterday
    const yesterday = new Date('2026-03-01');
    const twoDaysAgo = new Date('2026-02-28');
    const threeDaysAgo = new Date('2026-02-27');
    
    const habits = [{
      id: 'test-1',
      name: 'Meditate',
      emoji: '🧘',
      completedDates: [
        threeDaysAgo.toISOString().split('T')[0],
        twoDaysAgo.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0]
      ],
      createdAt: '2026-02-20T00:00:00Z',
      currentStreak: 0,
      longestStreak: 3,
      color: '#57f287'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    // Should not show streak since today isn't completed
    expect(screen.queryByText('🔥 3')).not.toBeInTheDocument();
  });

  it('shows streak badge when habit completed today with history', async () => {
    const today = '2026-03-02';
    const yesterday = '2026-03-01';
    
    const habits = [{
      id: 'test-1',
      name: 'Walk',
      emoji: '🚶',
      completedDates: [yesterday, today],
      createdAt: '2026-02-25T00:00:00Z',
      currentStreak: 2,
      longestStreak: 2,
      color: '#3498db'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    expect(screen.getByText('🔥 2')).toBeInTheDocument();
  });

  it('cancels add habit form', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    expect(screen.getByPlaceholderText('New habit...')).toBeInTheDocument();
    
    await fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('New habit...')).not.toBeInTheDocument();
  });

  it('does not add empty habit', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    await fireEvent.click(screen.getByText('Add'));
    
    // Form should still be visible
    expect(screen.getByPlaceholderText('New habit...')).toBeInTheDocument();
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });

  it('shows habit details on click', async () => {
    const habits = [{
      id: 'test-1',
      name: 'Code',
      emoji: '💻',
      completedDates: ['2026-02-28', '2026-03-01'],
      createdAt: '2026-02-25T00:00:00Z',
      currentStreak: 0,
      longestStreak: 2,
      color: '#9b59b6'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    // Click on habit to expand details
    await fireEvent.click(screen.getByText('Code'));
    
    // Should show stats
    expect(screen.getByText('best')).toBeInTheDocument();
    expect(screen.getByText('rate')).toBeInTheDocument();
  });

  it('deletes habit', async () => {
    const habits = [{
      id: 'test-1',
      name: 'ToDelete',
      emoji: '🗑️',
      completedDates: [],
      createdAt: '2026-03-01T00:00:00Z',
      currentStreak: 0,
      longestStreak: 0,
      color: '#ed4245'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    expect(screen.getByText('ToDelete')).toBeInTheDocument();
    
    // Expand details
    await fireEvent.click(screen.getByText('ToDelete'));
    
    // Delete
    await fireEvent.click(screen.getByText('🗑️'));
    
    expect(screen.queryByText('ToDelete')).not.toBeInTheDocument();
    expect(screen.getByText('No habits yet')).toBeInTheDocument();
  });

  it('persists habits to localStorage', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    await fireEvent.input(screen.getByPlaceholderText('New habit...'), { 
      target: { value: 'Persist Test' } 
    });
    await fireEvent.click(screen.getByText('Add'));
    
    const stored = JSON.parse(localStorage.getItem('hearth-habits') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Persist Test');
  });

  it('shows all-done badge when all habits completed', async () => {
    const today = '2026-03-02';
    const habits = [
      {
        id: 'test-1',
        name: 'Habit1',
        emoji: '✅',
        completedDates: [today],
        createdAt: '2026-03-01T00:00:00Z',
        currentStreak: 1,
        longestStreak: 1,
        color: '#5865f2'
      },
      {
        id: 'test-2',
        name: 'Habit2',
        emoji: '✅',
        completedDates: [today],
        createdAt: '2026-03-01T00:00:00Z',
        currentStreak: 1,
        longestStreak: 1,
        color: '#57f287'
      }
    ];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    const badge = screen.getByText('2/2');
    expect(badge).toHaveClass('all-done');
  });

  it('allows selecting different emoji for new habit', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    
    const emojiSelect = document.querySelector('.emoji-select') as HTMLSelectElement;
    expect(emojiSelect).toBeInTheDocument();
    expect(emojiSelect.value).toBe('✅');
    
    await fireEvent.change(emojiSelect, { target: { value: '💪' } });
    expect(emojiSelect.value).toBe('💪');
  });

  it('allows selecting color for new habit', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    
    const colorButtons = document.querySelectorAll('.color-btn');
    expect(colorButtons.length).toBeGreaterThan(0);
    
    // First color should be selected by default
    expect(colorButtons[0]).toHaveClass('selected');
  });

  it('submits form on enter key', async () => {
    render(HabitTrackerWidget);
    
    await fireEvent.click(screen.getByText('+ Add Habit'));
    
    const input = screen.getByPlaceholderText('New habit...');
    await fireEvent.input(input, { target: { value: 'Enter Test' } });
    await fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    
    expect(screen.getByText('Enter Test')).toBeInTheDocument();
  });

  it('displays week progress dots', async () => {
    const habits = [{
      id: 'test-1',
      name: 'Weekly',
      emoji: '📅',
      completedDates: ['2026-02-26', '2026-02-28', '2026-03-01'],
      createdAt: '2026-02-20T00:00:00Z',
      currentStreak: 0,
      longestStreak: 3,
      color: '#1abc9c'
    }];
    localStorage.setItem('hearth-habits', JSON.stringify(habits));
    
    render(HabitTrackerWidget);
    
    // Expand to see week progress
    await fireEvent.click(screen.getByText('Weekly'));
    
    const dots = document.querySelectorAll('.day-dot');
    expect(dots).toHaveLength(7);
  });
});
