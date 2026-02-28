import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import QuickCaptureWidget from './QuickCaptureWidget.svelte';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: vi.fn(() => ({
		show: vi.fn(),
		hide: vi.fn(),
		setFocus: vi.fn()
	})),
	Window: vi.fn()
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
	register: vi.fn(),
	unregister: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn(),
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

const mockContacts = [
	{ id: 'user1', name: 'Alice Smith', type: 'user' as const },
	{ id: 'user2', name: 'Bob Johnson', type: 'user' as const },
	{ id: 'channel1', name: 'general', type: 'channel' as const },
	{ id: 'channel2', name: 'random', type: 'channel' as const },
	{ id: 'group1', name: 'Project Team', type: 'group' as const }
];

describe('QuickCaptureWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initialization', () => {
		it('should render without crashing', () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});
			expect(component).toBeTruthy();
		});

		it('should not be visible initially', () => {
			render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should register global shortcut on mount', async () => {
			const { register } = await import('@tauri-apps/plugin-global-shortcut');
			
			render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await tick();
			expect(register).toHaveBeenCalledWith(
				'CommandOrControl+Shift+C',
				expect.any(Function)
			);
		});

		it('should use custom shortcut when provided', async () => {
			const { register } = await import('@tauri-apps/plugin-global-shortcut');
			
			render(QuickCaptureWidget, {
				props: { 
					contacts: mockContacts,
					shortcut: 'Alt+Shift+M'
				}
			});

			await tick();
			expect(register).toHaveBeenCalledWith(
				'Alt+Shift+M',
				expect.any(Function)
			);
		});

		it('should not register shortcut when disabled', async () => {
			const { register } = await import('@tauri-apps/plugin-global-shortcut');
			
			render(QuickCaptureWidget, {
				props: { 
					contacts: mockContacts,
					enabled: false
				}
			});

			await tick();
			expect(register).not.toHaveBeenCalled();
		});
	});

	describe('visibility', () => {
		it('should show widget when show() is called', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			expect(screen.getByRole('dialog')).toBeTruthy();
		});

		it('should hide widget when hide() is called', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();
			expect(screen.getByRole('dialog')).toBeTruthy();

			await component.hide();
			await tick();
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should toggle visibility', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.toggle();
			await tick();
			expect(screen.getByRole('dialog')).toBeTruthy();

			await component.toggle();
			await tick();
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		it('should call onChange callback when visibility changes', async () => {
			const onChange = vi.fn();
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts, onChange }
			});

			await component.show();
			await tick();
			expect(onChange).toHaveBeenCalledWith(true);

			await component.hide();
			await tick();
			expect(onChange).toHaveBeenCalledWith(false);
		});

		it('should emit quick-capture:show event when shown', async () => {
			const { emit } = await import('@tauri-apps/api/event');
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			expect(emit).toHaveBeenCalledWith('quick-capture:show');
		});

		it('should emit quick-capture:hide event when hidden', async () => {
			const { emit } = await import('@tauri-apps/api/event');
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();
			await component.hide();
			await tick();

			expect(emit).toHaveBeenCalledWith('quick-capture:hide');
		});
	});

	describe('recipient selection', () => {
		it('should show search input when visible', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			expect(input).toBeTruthy();
		});

		it('should filter contacts based on search query', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			expect(screen.getByText('Alice Smith')).toBeTruthy();
			expect(screen.queryByText('Bob Johnson')).toBeNull();
		});

		it('should show all contacts when search is empty', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts, maxRecentContacts: 10 }
			});

			// Set up recent recipients
			localStorage.setItem(
				'hearth_quick_capture_recent',
				JSON.stringify(['user1', 'user2', 'channel1'])
			);

			await component.show();
			await tick();

			expect(screen.getByText('Alice Smith')).toBeTruthy();
			expect(screen.getByText('Bob Johnson')).toBeTruthy();
			expect(screen.getByText('general')).toBeTruthy();
		});

		it('should select contact on click', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			// Should now show compose view with recipient badge
			expect(screen.getByText('Alice Smith')).toBeTruthy();
			expect(screen.getByPlaceholderText(/Type your message/)).toBeTruthy();
		});

		it('should select contact on Enter key', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'bob' } });
			await tick();
			await fireEvent.keyDown(document, { key: 'Enter' });
			await tick();

			expect(screen.getByPlaceholderText(/Type your message/)).toBeTruthy();
		});

		it('should navigate contacts with arrow keys', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			localStorage.setItem(
				'hearth_quick_capture_recent',
				JSON.stringify(['user1', 'user2'])
			);

			await component.show();
			await tick();

			// Initial focus is on first item
			const items = screen.getAllByRole('option');
			expect(items[0].classList.contains('focused')).toBe(true);

			// Arrow down
			await fireEvent.keyDown(document, { key: 'ArrowDown' });
			await tick();
			expect(items[1].classList.contains('focused')).toBe(true);

			// Arrow up
			await fireEvent.keyDown(document, { key: 'ArrowUp' });
			await tick();
			expect(items[0].classList.contains('focused')).toBe(true);
		});
	});

	describe('message composition', () => {
		it('should show message textarea after selecting recipient', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			expect(screen.getByPlaceholderText(/Type your message/)).toBeTruthy();
		});

		it('should show back button to return to recipient selection', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const backButton = screen.getByLabelText('Back to recipient selection');
			await fireEvent.click(backButton);
			await tick();

			expect(screen.getByPlaceholderText('Search contacts or channels...')).toBeTruthy();
		});

		it('should go back on Escape when composing', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			await fireEvent.keyDown(document, { key: 'Escape' });
			await tick();

			expect(screen.getByPlaceholderText('Search contacts or channels...')).toBeTruthy();
		});

		it('should close widget on Escape when selecting recipient', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();
			expect(screen.getByRole('dialog')).toBeTruthy();

			await fireEvent.keyDown(document, { key: 'Escape' });
			await tick();

			expect(screen.queryByRole('dialog')).toBeNull();
		});
	});

	describe('sending messages', () => {
		it('should call onSend callback when sending', async () => {
			const onSend = vi.fn(() => Promise.resolve(true));
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts, onSend }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			await fireEvent.input(textarea, { target: { value: 'Hello, Alice!' } });
			await tick();

			const sendButton = screen.getByText('Send');
			await fireEvent.click(sendButton);

			await waitFor(() => {
				expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
					recipientId: 'user1',
					recipientName: 'Alice Smith',
					recipientType: 'user',
					content: 'Hello, Alice!',
					attachments: []
				}));
			});
		});

		it('should disable send button when message is empty', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const sendButton = screen.getByText('Send');
			expect(sendButton.hasAttribute('disabled')).toBe(true);
		});

		it('should send on Cmd/Ctrl+Enter', async () => {
			const onSend = vi.fn(() => Promise.resolve(true));
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts, onSend }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			await fireEvent.input(textarea, { target: { value: 'Quick message!' } });
			await tick();

			await fireEvent.keyDown(document, { key: 'Enter', metaKey: true });

			await waitFor(() => {
				expect(onSend).toHaveBeenCalled();
			});
		});

		it('should show success state after sending', async () => {
			const onSend = vi.fn(() => Promise.resolve(true));
			const { component } = render(QuickCaptureWidget, {
				props: { 
					contacts: mockContacts, 
					onSend,
					autoDismiss: false
				}
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			await fireEvent.input(textarea, { target: { value: 'Test message' } });
			await tick();

			const sendButton = screen.getByText('Send');
			await fireEvent.click(sendButton);

			await waitFor(() => {
				expect(screen.getByText('Message sent!')).toBeTruthy();
			});
		});

		it('should auto-dismiss after successful send when enabled', async () => {
			vi.useFakeTimers();
			const onSend = vi.fn(() => Promise.resolve(true));
			const { component } = render(QuickCaptureWidget, {
				props: { 
					contacts: mockContacts, 
					onSend,
					autoDismiss: true,
					autoDismissDelay: 500
				}
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			await fireEvent.input(textarea, { target: { value: 'Test' } });
			await tick();

			const sendButton = screen.getByText('Send');
			await fireEvent.click(sendButton);

			await vi.advanceTimersByTimeAsync(600);

			expect(screen.queryByRole('dialog')).toBeNull();
			vi.useRealTimers();
		});
	});

	describe('attachments', () => {
		it('should add files on paste', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			
			const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
			const clipboardData = {
				items: [{
					kind: 'file',
					getAsFile: () => file
				}]
			};

			await fireEvent.paste(textarea, { clipboardData });
			await tick();

			expect(screen.getByText('test.txt')).toBeTruthy();
		});

		it('should remove attachment when clicking remove button', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const textarea = screen.getByPlaceholderText(/Type your message/);
			
			const file = new File(['test'], 'test.txt', { type: 'text/plain' });
			const clipboardData = {
				items: [{
					kind: 'file',
					getAsFile: () => file
				}]
			};

			await fireEvent.paste(textarea, { clipboardData });
			await tick();

			const removeButton = screen.getByLabelText('Remove attachment');
			await fireEvent.click(removeButton);
			await tick();

			expect(screen.queryByText('test.txt')).toBeNull();
		});
	});

	describe('persistence', () => {
		it('should save recent recipients to localStorage', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'alice' } });
			await tick();

			const contactItem = screen.getByText('Alice Smith');
			await fireEvent.click(contactItem.closest('button')!);
			await tick();

			const stored = JSON.parse(
				localStorage.getItem('hearth_quick_capture_recent') || '[]'
			);
			expect(stored).toContain('user1');
		});

		it('should load last recipient when rememberLastRecipient is enabled', async () => {
			localStorage.setItem('hearth_quick_capture', JSON.stringify({
				lastRecipientId: 'user1'
			}));

			const { component } = render(QuickCaptureWidget, {
				props: { 
					contacts: mockContacts,
					rememberLastRecipient: true
				}
			});

			await component.show();
			await tick();

			// Should auto-select Alice and show compose view
			expect(screen.getByText('Alice Smith')).toBeTruthy();
			expect(screen.getByPlaceholderText(/Type your message/)).toBeTruthy();
		});
	});

	describe('contact type icons', () => {
		it('should show correct icons for different contact types', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			localStorage.setItem(
				'hearth_quick_capture_recent',
				JSON.stringify(['user1', 'channel1', 'group1'])
			);

			await component.show();
			await tick();

			// Check type labels exist
			expect(screen.getByText('user')).toBeTruthy();
			expect(screen.getByText('channel')).toBeTruthy();
			expect(screen.getByText('group')).toBeTruthy();
		});
	});

	describe('setContacts', () => {
		it('should update contacts dynamically', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const newContacts = [
				{ id: 'new1', name: 'New Contact', type: 'user' as const }
			];

			component.setContacts(newContacts);
			await tick();

			const input = screen.getByPlaceholderText('Search contacts or channels...');
			await fireEvent.input(input, { target: { value: 'new' } });
			await tick();

			expect(screen.getByText('New Contact')).toBeTruthy();
		});
	});

	describe('accessibility', () => {
		it('should have proper dialog role and aria attributes', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			await component.show();
			await tick();

			const dialog = screen.getByRole('dialog');
			expect(dialog.getAttribute('aria-label')).toBe('Quick Capture');
			expect(dialog.getAttribute('aria-modal')).toBe('true');
		});

		it('should have proper listbox role for contacts', async () => {
			const { component } = render(QuickCaptureWidget, {
				props: { contacts: mockContacts }
			});

			localStorage.setItem(
				'hearth_quick_capture_recent',
				JSON.stringify(['user1', 'user2'])
			);

			await component.show();
			await tick();

			expect(screen.getByRole('listbox')).toBeTruthy();
			expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
		});
	});
});
