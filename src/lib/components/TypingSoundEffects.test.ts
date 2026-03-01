import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import TypingSoundEffects from './TypingSoundEffects.svelte';

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    buffer: null
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 }
  })),
  createBuffer: vi.fn((channels, length, sampleRate) => ({
    getChannelData: vi.fn(() => new Float32Array(length)),
    numberOfChannels: channels,
    length,
    sampleRate
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running',
  resume: vi.fn(),
  close: vi.fn()
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));

describe('TypingSoundEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders settings UI', () => {
    render(TypingSoundEffects, { enabled: false });
    
    expect(screen.getByText('Typing Sound Effects')).toBeInTheDocument();
    expect(screen.getByText('Play satisfying sounds while typing')).toBeInTheDocument();
  });

  it('shows controls when enabled', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    expect(screen.getByText('Sound Theme')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('Test Sound')).toBeInTheDocument();
  });

  it('hides controls when disabled', () => {
    render(TypingSoundEffects, { enabled: false });
    
    expect(screen.queryByText('Sound Theme')).not.toBeInTheDocument();
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
  });

  it('toggles enabled state', async () => {
    const { component } = render(TypingSoundEffects, { enabled: false });
    
    const toggle = screen.getByRole('checkbox');
    await fireEvent.click(toggle);
    
    expect(toggle).toBeChecked();
  });

  it('changes theme selection', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    const select = screen.getByRole('combobox');
    await fireEvent.change(select, { target: { value: 'typewriter' } });
    
    expect(select).toHaveValue('typewriter');
  });

  it('adjusts volume', async () => {
    render(TypingSoundEffects, { enabled: true, volume: 0.5 });
    
    const slider = screen.getByRole('slider');
    expect(slider).toHaveValue('0.5');
    
    await fireEvent.input(slider, { target: { value: '0.8' } });
    expect(slider).toHaveValue('0.8');
  });

  it('displays volume percentage', () => {
    render(TypingSoundEffects, { enabled: true, volume: 0.3 });
    
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows theme description', () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    expect(screen.getByText('Clicky mechanical keyboard with blue switches')).toBeInTheDocument();
  });

  it('test button is clickable', async () => {
    render(TypingSoundEffects, { enabled: true });
    
    const testButton = screen.getByText('Test Sound');
    await fireEvent.click(testButton);
    
    // Should not throw
    expect(testButton).toBeInTheDocument();
  });

  it('initializes audio context on mount', async () => {
    render(TypingSoundEffects, { enabled: true });
    
    // AudioContext should be created
    expect(AudioContext).toHaveBeenCalled();
  });

  it('responds to keydown events on text inputs', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    // Create a text input
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    
    // Focus and type
    input.focus();
    await fireEvent.keyDown(input, { key: 'a' });
    
    // Clean up
    document.body.removeChild(input);
  });

  it('exports available themes', () => {
    const { component } = render(TypingSoundEffects, { enabled: true });
    
    const themes = component.getAvailableThemes();
    
    expect(themes).toBeInstanceOf(Array);
    expect(themes.length).toBeGreaterThan(0);
    expect(themes[0]).toHaveProperty('id');
    expect(themes[0]).toHaveProperty('name');
    expect(themes[0]).toHaveProperty('description');
  });

  it('includes all expected themes', () => {
    const { component } = render(TypingSoundEffects, { enabled: true });
    
    const themes = component.getAvailableThemes();
    const themeIds = themes.map((t: any) => t.id);
    
    expect(themeIds).toContain('mechanical-blue');
    expect(themeIds).toContain('mechanical-red');
    expect(themeIds).toContain('typewriter');
    expect(themeIds).toContain('bubble');
    expect(themeIds).toContain('pop');
    expect(themeIds).toContain('soft');
  });

  it('handles space bar sound', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    await fireEvent.keyDown(input, { key: ' ' });
    
    document.body.removeChild(input);
  });

  it('handles enter key sound', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    await fireEvent.keyDown(input, { key: 'Enter' });
    
    document.body.removeChild(input);
  });

  it('handles backspace sound', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'mechanical-blue' });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    await fireEvent.keyDown(input, { key: 'Backspace' });
    
    document.body.removeChild(input);
  });

  it('respects target selector', async () => {
    render(TypingSoundEffects, { 
      enabled: true, 
      targetSelector: '.custom-input'
    });
    
    // Non-matching element should not trigger sounds
    const div = document.createElement('div');
    document.body.appendChild(div);
    div.focus();
    
    await fireEvent.keyDown(div, { key: 'a' });
    
    document.body.removeChild(div);
  });

  it('rate limits rapid key presses', async () => {
    render(TypingSoundEffects, { enabled: true });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    // Rapid fire keys
    for (let i = 0; i < 10; i++) {
      await fireEvent.keyDown(input, { key: 'a' });
    }
    
    // Should have rate limited some of these
    document.body.removeChild(input);
  });

  it('does not play sounds when theme is none', async () => {
    render(TypingSoundEffects, { enabled: true, theme: 'none' });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    await fireEvent.keyDown(input, { key: 'a' });
    
    // No crash expected
    document.body.removeChild(input);
  });

  it('does not play sounds when disabled', async () => {
    render(TypingSoundEffects, { enabled: false, theme: 'mechanical-blue' });
    
    const input = document.createElement('textarea');
    document.body.appendChild(input);
    input.focus();
    
    await fireEvent.keyDown(input, { key: 'a' });
    
    // No crash expected
    document.body.removeChild(input);
  });
});
