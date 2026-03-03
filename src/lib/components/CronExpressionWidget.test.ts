import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CronExpressionWidget from './CronExpressionWidget.svelte';

describe('CronExpressionWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('renders with default expression', () => {
    render(CronExpressionWidget);
    expect(screen.getByText('🕐 Cron Expression Helper')).toBeInTheDocument();
    expect(screen.getByText('* * * * *')).toBeInTheDocument();
  });

  it('displays all five cron fields', () => {
    render(CronExpressionWidget);
    expect(screen.getByText('Minute')).toBeInTheDocument();
    expect(screen.getByText('Hour')).toBeInTheDocument();
    expect(screen.getByText('Day (Month)')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Day (Week)')).toBeInTheDocument();
  });

  it('renders preset buttons', () => {
    render(CronExpressionWidget);
    expect(screen.getByText('Every minute')).toBeInTheDocument();
    expect(screen.getByText('Every hour')).toBeInTheDocument();
    expect(screen.getByText('Every day at midnight')).toBeInTheDocument();
    expect(screen.getByText('Every Monday at 9 AM')).toBeInTheDocument();
  });

  it('applies preset when clicked', async () => {
    render(CronExpressionWidget);
    const presetBtn = screen.getByText('Every day at midnight');
    await fireEvent.click(presetBtn);
    expect(screen.getByText('0 0 * * *')).toBeInTheDocument();
  });

  it('shows human-readable description', () => {
    render(CronExpressionWidget);
    expect(screen.getByText('Every minute')).toBeInTheDocument();
  });

  it('toggles custom input mode', async () => {
    render(CronExpressionWidget);
    const toggle = screen.getByText('Edit expression directly');
    await fireEvent.click(toggle);
    const input = screen.getByPlaceholderText('* * * * *');
    expect(input).toBeInTheDocument();
  });

  it('validates custom expression', async () => {
    render(CronExpressionWidget);
    const toggle = screen.getByText('Edit expression directly');
    await fireEvent.click(toggle);
    const input = screen.getByPlaceholderText('* * * * *');
    await fireEvent.input(input, { target: { value: 'invalid' } });
    expect(input).toHaveClass('invalid');
  });

  it('copies expression to clipboard', async () => {
    render(CronExpressionWidget);
    const copyBtn = screen.getByTitle('Copy expression');
    await fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('* * * * *');
  });

  it('displays next runs for valid expression', async () => {
    render(CronExpressionWidget);
    const presetBtn = screen.getByText('Every hour');
    await fireEvent.click(presetBtn);
    expect(screen.getByText('Next 5 runs:')).toBeInTheDocument();
  });

  it('updates expression when field changes', async () => {
    render(CronExpressionWidget);
    const minuteInputs = screen.getAllByRole('textbox');
    const minuteInput = minuteInputs[0];
    await fireEvent.input(minuteInput, { target: { value: '30' } });
    expect(screen.getByText('30 * * * *')).toBeInTheDocument();
  });

  it('shows syntax reference', () => {
    render(CronExpressionWidget);
    expect(screen.getByText('Syntax Reference')).toBeInTheDocument();
  });

  it('expands syntax help', async () => {
    render(CronExpressionWidget);
    const summary = screen.getByText('Syntax Reference');
    await fireEvent.click(summary);
    expect(screen.getByText('any value')).toBeInTheDocument();
  });

  it('handles step values correctly', async () => {
    render(CronExpressionWidget);
    const presetBtn = screen.getByText('Every 15 minutes');
    await fireEvent.click(presetBtn);
    expect(screen.getByText('*/15 * * * *')).toBeInTheDocument();
    expect(screen.getByText('Every 15 minutes')).toBeInTheDocument();
  });

  it('handles weekday range presets', async () => {
    render(CronExpressionWidget);
    const presetBtn = screen.getByText('Every weekday at 9 AM');
    await fireEvent.click(presetBtn);
    expect(screen.getByText('0 9 * * 1-5')).toBeInTheDocument();
  });

  it('validates range expressions', async () => {
    render(CronExpressionWidget);
    const toggle = screen.getByText('Edit expression directly');
    await fireEvent.click(toggle);
    const input = screen.getByPlaceholderText('* * * * *');
    await fireEvent.input(input, { target: { value: '0 0 1-15 * *' } });
    expect(input).not.toHaveClass('invalid');
  });

  it('validates list expressions', async () => {
    render(CronExpressionWidget);
    const toggle = screen.getByText('Edit expression directly');
    await fireEvent.click(toggle);
    const input = screen.getByPlaceholderText('* * * * *');
    await fireEvent.input(input, { target: { value: '0 9 * * 1,3,5' } });
    expect(input).not.toHaveClass('invalid');
  });

  it('rejects out of range values', async () => {
    render(CronExpressionWidget);
    const toggle = screen.getByText('Edit expression directly');
    await fireEvent.click(toggle);
    const input = screen.getByPlaceholderText('* * * * *');
    await fireEvent.input(input, { target: { value: '60 * * * *' } });
    expect(input).toHaveClass('invalid');
  });

  it('handles month first preset', async () => {
    render(CronExpressionWidget);
    const presetBtn = screen.getByText('First of month at midnight');
    await fireEvent.click(presetBtn);
    expect(screen.getByText('0 0 1 * *')).toBeInTheDocument();
  });
});
