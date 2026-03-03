import { describe, it, expect } from 'vitest';
import {
  getStatusColor,
  getStatusLabel,
  getActivityLabel,
  type PresenceStatus
} from '../stores/presence';

describe('getStatusColor', () => {
  it('should return green for online status', () => {
    expect(getStatusColor('online')).toBe('#3ba55c');
  });

  it('should return yellow/orange for idle status', () => {
    expect(getStatusColor('idle')).toBe('#faa61a');
  });

  it('should return red for dnd (Do Not Disturb) status', () => {
    expect(getStatusColor('dnd')).toBe('#ed4245');
  });

  it('should return gray for invisible status', () => {
    expect(getStatusColor('invisible')).toBe('#747f8d');
  });

  it('should return gray for offline status', () => {
    expect(getStatusColor('offline')).toBe('#747f8d');
  });

  it('should return gray for unknown/default status', () => {
    // Cast to PresenceStatus to test fallback behavior
    expect(getStatusColor('unknown' as PresenceStatus)).toBe('#747f8d');
  });
});

describe('getStatusLabel', () => {
  it('should return "Online" for online status', () => {
    expect(getStatusLabel('online')).toBe('Online');
  });

  it('should return "Idle" for idle status', () => {
    expect(getStatusLabel('idle')).toBe('Idle');
  });

  it('should return "Do Not Disturb" for dnd status', () => {
    expect(getStatusLabel('dnd')).toBe('Do Not Disturb');
  });

  it('should return "Invisible" for invisible status', () => {
    expect(getStatusLabel('invisible')).toBe('Invisible');
  });

  it('should return "Offline" for offline status', () => {
    expect(getStatusLabel('offline')).toBe('Offline');
  });

  it('should return "Offline" for unknown/default status', () => {
    expect(getStatusLabel('unknown' as PresenceStatus)).toBe('Offline');
  });
});

describe('getActivityLabel', () => {
  it('should return "Playing" for type 0', () => {
    expect(getActivityLabel(0)).toBe('Playing');
  });

  it('should return "Streaming" for type 1', () => {
    expect(getActivityLabel(1)).toBe('Streaming');
  });

  it('should return "Listening to" for type 2', () => {
    expect(getActivityLabel(2)).toBe('Listening to');
  });

  it('should return "Watching" for type 3', () => {
    expect(getActivityLabel(3)).toBe('Watching');
  });

  it('should return empty string for type 4 (Custom)', () => {
    expect(getActivityLabel(4)).toBe('');
  });

  it('should return "Competing in" for type 5', () => {
    expect(getActivityLabel(5)).toBe('Competing in');
  });

  it('should return empty string for unknown activity types', () => {
    expect(getActivityLabel(99)).toBe('');
    expect(getActivityLabel(-1)).toBe('');
  });
});
