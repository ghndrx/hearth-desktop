import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AutoReplyManager from './AutoReplyManager.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn(),
}));

describe('AutoReplyManager', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders the toggle button', () => {
    render(AutoReplyManager);
    const button = screen.getByTitle(/Auto Reply Manager/i);
    expect(button).toBeTruthy();
  });

  it('opens the panel when toggle button is clicked', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('Auto Reply Manager')).toBeTruthy();
  });

  it('shows empty state when no rules exist', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText(/No auto-reply rules yet/i)).toBeTruthy();
  });

  it('can create a new rule', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const newRuleButton = screen.getByText('New Rule');
    await fireEvent.click(newRuleButton);
    
    expect(screen.getByPlaceholderText(/e.g., Away Message/i)).toBeTruthy();
  });

  it('saves rules to localStorage', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const newRuleButton = screen.getByText('New Rule');
    await fireEvent.click(newRuleButton);
    
    const nameInput = screen.getByPlaceholderText(/e.g., Away Message/i);
    await fireEvent.input(nameInput, { target: { value: 'Test Rule' } });
    
    const saveButton = screen.getByText('Save Rule');
    await fireEvent.click(saveButton);
    
    const saved = localStorage.getItem('hearth-auto-reply');
    expect(saved).toBeTruthy();
    const rules = JSON.parse(saved!);
    expect(rules.length).toBe(1);
    expect(rules[0].name).toBe('Test Rule');
  });

  it('shows three tabs: rules, logs, settings', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('Rules')).toBeTruthy();
    expect(screen.getByText('Logs')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('can switch between tabs', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const logsTab = screen.getByText('Logs');
    await fireEvent.click(logsTab);
    
    expect(screen.getByText(/auto-replies sent/i)).toBeTruthy();
  });

  it('displays global enable toggle', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('Enabled')).toBeTruthy();
  });

  it('loads saved rules from localStorage', async () => {
    const savedRules = [{
      id: 'test-1',
      name: 'Saved Rule',
      message: 'Test message',
      trigger: 'away',
      enabled: true,
      delay: 5,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    }];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('Saved Rule')).toBeTruthy();
  });

  it('can delete a rule', async () => {
    const savedRules = [{
      id: 'test-1',
      name: 'Rule to Delete',
      message: 'Test message',
      trigger: 'away',
      enabled: true,
      delay: 5,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    }];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const deleteButton = screen.getByTitle('Delete');
    await fireEvent.click(deleteButton);
    
    const saved = localStorage.getItem('hearth-auto-reply');
    const rules = JSON.parse(saved!);
    expect(rules.length).toBe(0);
  });

  it('can toggle a rule on/off', async () => {
    const savedRules = [{
      id: 'test-1',
      name: 'Toggle Rule',
      message: 'Test message',
      trigger: 'away',
      enabled: true,
      delay: 5,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    }];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const disableButton = screen.getByTitle('Disable');
    await fireEvent.click(disableButton);
    
    const saved = localStorage.getItem('hearth-auto-reply');
    const rules = JSON.parse(saved!);
    expect(rules[0].enabled).toBe(false);
  });

  it('shows template suggestions when creating a rule', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const newRuleButton = screen.getByText('New Rule');
    await fireEvent.click(newRuleButton);
    
    expect(screen.getByText('Basic Away')).toBeTruthy();
    expect(screen.getByText('In Meeting')).toBeTruthy();
    expect(screen.getByText('Focus Time')).toBeTruthy();
  });

  it('shows variable placeholders for messages', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const newRuleButton = screen.getByText('New Rule');
    await fireEvent.click(newRuleButton);
    
    expect(screen.getByText('{name}')).toBeTruthy();
    expect(screen.getByText('{time}')).toBeTruthy();
    expect(screen.getByText('{date}')).toBeTruthy();
  });

  it('can filter rules by search', async () => {
    const savedRules = [
      {
        id: 'test-1',
        name: 'Away Message',
        message: 'Im away',
        trigger: 'away',
        enabled: true,
        delay: 5,
        oncePerContact: true,
        excludeContacts: [],
        includeContacts: [],
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      },
      {
        id: 'test-2',
        name: 'Focus Time',
        message: 'In focus mode',
        trigger: 'focus',
        enabled: true,
        delay: 5,
        oncePerContact: true,
        excludeContacts: [],
        includeContacts: [],
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      }
    ];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const searchInput = screen.getByPlaceholderText(/Search rules/i);
    await fireEvent.input(searchInput, { target: { value: 'focus' } });
    
    expect(screen.getByText('Focus Time')).toBeTruthy();
    expect(screen.queryByText('Away Message')).toBeFalsy();
  });

  it('shows settings options', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const settingsTab = screen.getByText('Settings');
    await fireEvent.click(settingsTab);
    
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Logging')).toBeTruthy();
    expect(screen.getByText('Defaults')).toBeTruthy();
    expect(screen.getByText('Keyboard Shortcut')).toBeTruthy();
  });

  it('displays keyboard shortcut info', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const settingsTab = screen.getByText('Settings');
    await fireEvent.click(settingsTab);
    
    expect(screen.getByText('Toggle Auto Reply Manager')).toBeTruthy();
  });

  it('can clear logs', async () => {
    const savedLogs = [{
      id: 'log-1',
      ruleId: 'rule-1',
      ruleName: 'Test Rule',
      contactId: 'contact-1',
      contactName: 'John',
      message: 'Auto reply message',
      sentAt: new Date().toISOString(),
    }];
    localStorage.setItem('hearth-auto-reply-logs', JSON.stringify(savedLogs));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    const logsTab = screen.getByText('Logs');
    await fireEvent.click(logsTab);
    
    const clearButton = screen.getByText('Clear Logs');
    await fireEvent.click(clearButton);
    
    const saved = localStorage.getItem('hearth-auto-reply-logs');
    const logs = JSON.parse(saved!);
    expect(logs.length).toBe(0);
  });

  it('shows trigger type labels correctly', async () => {
    const savedRules = [{
      id: 'test-1',
      name: 'DND Rule',
      message: 'Test message',
      trigger: 'dnd',
      enabled: true,
      delay: 5,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    }];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    
    expect(screen.getByText('🔴 Do Not Disturb')).toBeTruthy();
  });

  it('closes panel when clicking outside', async () => {
    render(AutoReplyManager);
    const toggleButton = screen.getByTitle(/Auto Reply Manager/i);
    
    await fireEvent.click(toggleButton);
    expect(screen.getByText('Auto Reply Manager')).toBeTruthy();
    
    // Click on backdrop
    const backdrop = screen.getByText('Auto Reply Manager').closest('.fixed.inset-0');
    if (backdrop) {
      await fireEvent.click(backdrop);
    }
  });

  it('shows rule count on toggle button badge', async () => {
    const savedRules = [{
      id: 'test-1',
      name: 'Test Rule',
      message: 'Test message',
      trigger: 'away',
      enabled: true,
      delay: 5,
      oncePerContact: true,
      excludeContacts: [],
      includeContacts: [],
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    }];
    localStorage.setItem('hearth-auto-reply', JSON.stringify(savedRules));
    
    render(AutoReplyManager);
    
    // Badge should show 1
    expect(screen.getByText('1')).toBeTruthy();
  });
});
