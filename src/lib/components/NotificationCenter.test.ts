import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import NotificationCenter from './NotificationCenter.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue(undefined)
}));

describe('NotificationCenter', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('renders toggle button', () => {
		const { container } = render(NotificationCenter);
		const button = container.querySelector('.toggle-button');
		expect(button).toBeTruthy();
	});

	it('opens panel when toggle button clicked', async () => {
		const { container } = render(NotificationCenter);
		const button = container.querySelector('.toggle-button');
		
		expect(container.querySelector('.panel')).toBeFalsy();
		
		await fireEvent.click(button!);
		
		expect(container.querySelector('.panel')).toBeTruthy();
	});

	it('closes panel when close button clicked', async () => {
		const { container } = render(NotificationCenter);
		const toggleButton = container.querySelector('.toggle-button');
		
		await fireEvent.click(toggleButton!);
		expect(container.querySelector('.panel')).toBeTruthy();
		
		const closeButton = container.querySelector('.close-button');
		await fireEvent.click(closeButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.panel')).toBeFalsy();
		});
	});

	it('closes panel when Escape key pressed', async () => {
		const { container } = render(NotificationCenter);
		const toggleButton = container.querySelector('.toggle-button');
		
		await fireEvent.click(toggleButton!);
		expect(container.querySelector('.panel')).toBeTruthy();
		
		await fireEvent.keyDown(window, { key: 'Escape' });
		
		await waitFor(() => {
			expect(container.querySelector('.panel')).toBeFalsy();
		});
	});

	it('shows empty state when no notifications', async () => {
		const { container } = render(NotificationCenter);
		const toggleButton = container.querySelector('.toggle-button');
		
		await fireEvent.click(toggleButton!);
		
		expect(container.querySelector('.empty-state')).toBeTruthy();
	});

	it('displays unread badge when there are unread notifications', async () => {
		const { container, component } = render(NotificationCenter);
		
		// Add a notification
		component.addNotification({
			type: 'message',
			title: 'Test Notification',
			body: 'This is a test'
		});
		
		await waitFor(() => {
			const badge = container.querySelector('.badge');
			expect(badge).toBeTruthy();
			expect(badge?.textContent).toBe('1');
		});
	});

	it('adds notifications via addNotification method', async () => {
		const { container, component } = render(NotificationCenter);
		
		const id = component.addNotification({
			type: 'message',
			title: 'New Message',
			body: 'Hello world'
		});
		
		expect(id).toBeTruthy();
		expect(id).toMatch(/^notif-/);
		
		// Open panel
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.notification-item')).toBeTruthy();
		});
	});

	it('marks notification as read when clicked', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({
			type: 'message',
			title: 'Test',
			body: 'Test body'
		});
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			const item = container.querySelector('.notification-item');
			expect(item?.classList.contains('unread')).toBe(true);
		});
		
		const item = container.querySelector('.notification-item');
		await fireEvent.click(item!);
		
		await waitFor(() => {
			expect(item?.classList.contains('unread')).toBe(false);
		});
	});

	it('marks all as read when button clicked', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({ type: 'message', title: 'Test 1', body: 'Body 1' });
		component.addNotification({ type: 'message', title: 'Test 2', body: 'Body 2' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			const badge = container.querySelector('.badge');
			expect(badge?.textContent).toBe('2');
		});
		
		const markAllButton = screen.getByText('Mark all read');
		await fireEvent.click(markAllButton);
		
		await waitFor(() => {
			expect(container.querySelector('.badge')).toBeFalsy();
		});
	});

	it('removes notification when remove button clicked', async () => {
		const { container, component } = render(NotificationCenter);
		
		const id = component.addNotification({
			type: 'message',
			title: 'To Remove',
			body: 'This will be removed'
		});
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.notification-item')).toBeTruthy();
		});
		
		const removeButton = container.querySelector('.remove-button');
		await fireEvent.click(removeButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.notification-item')).toBeFalsy();
		});
	});

	it('pins notification when pin button clicked', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({
			type: 'message',
			title: 'To Pin',
			body: 'This will be pinned'
		});
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.notification-item')).toBeTruthy();
		});
		
		// Hover to show actions
		const item = container.querySelector('.notification-item');
		await fireEvent.mouseEnter(item!);
		
		const pinButton = container.querySelector('.pin-button');
		await fireEvent.click(pinButton!);
		
		await waitFor(() => {
			expect(item?.classList.contains('pinned')).toBe(true);
		});
	});

	it('filters notifications by unread status', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({ type: 'message', title: 'Read', body: 'Already read' });
		component.addNotification({ type: 'message', title: 'Unread', body: 'Not read yet' });
		
		// Mark first as read
		component.markAsRead(component.addNotification({ type: 'message', title: 'Another Read', body: 'Also read' }));
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		// Click unread filter
		const unreadFilter = screen.getByText(/Unread/);
		await fireEvent.click(unreadFilter);
		
		await waitFor(() => {
			const items = container.querySelectorAll('.notification-item');
			for (const item of items) {
				expect(item.classList.contains('unread')).toBe(true);
			}
		});
	});

	it('searches notifications by title and body', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({ type: 'message', title: 'Important Meeting', body: 'Join the call' });
		component.addNotification({ type: 'system', title: 'System Update', body: 'Version 2.0' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		const searchInput = container.querySelector('.search-input');
		await fireEvent.input(searchInput!, { target: { value: 'meeting' } });
		
		await waitFor(() => {
			const items = container.querySelectorAll('.notification-item');
			expect(items.length).toBe(1);
		});
	});

	it('clears all notifications except pinned', async () => {
		const { container, component } = render(NotificationCenter);
		
		component.addNotification({ type: 'message', title: 'Normal', body: 'Will be cleared' });
		component.addNotification({ type: 'message', title: 'Pinned', body: 'Will stay' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		// Pin second notification
		const pinButtons = container.querySelectorAll('.pin-button');
		await fireEvent.click(pinButtons[1]);
		
		const clearAllButton = screen.getByText('Clear all');
		await fireEvent.click(clearAllButton);
		
		await waitFor(() => {
			const items = container.querySelectorAll('.notification-item');
			expect(items.length).toBe(1);
		});
	});

	it('toggles Do Not Disturb mode', async () => {
		const { container } = render(NotificationCenter);
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		const dndToggle = container.querySelector('.dnd-toggle');
		expect(dndToggle?.textContent).toBe('🔔');
		
		await fireEvent.click(dndToggle!);
		
		await waitFor(() => {
			expect(dndToggle?.textContent).toBe('🔕');
			expect(container.querySelector('.dnd-status')).toBeTruthy();
		});
	});

	it('persists notifications to localStorage', async () => {
		const { component } = render(NotificationCenter);
		
		component.addNotification({
			type: 'message',
			title: 'Persistent',
			body: 'Should be saved'
		});
		
		const stored = localStorage.getItem('hearth-notification-center');
		expect(stored).toBeTruthy();
		
		const data = JSON.parse(stored!);
		expect(data.notifications.length).toBe(1);
		expect(data.notifications[0].title).toBe('Persistent');
	});

	it('loads notifications from localStorage on mount', async () => {
		// Pre-populate storage
		const stored = {
			notifications: [
				{
					id: 'test-1',
					type: 'message',
					title: 'Stored Notification',
					body: 'From storage',
					timestamp: Date.now(),
					read: false,
					pinned: false
				}
			],
			dndEnabled: false
		};
		localStorage.setItem('hearth-notification-center', JSON.stringify(stored));
		
		const { container } = render(NotificationCenter);
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			const item = container.querySelector('.notification-item');
			expect(item).toBeTruthy();
		});
	});

	it('groups notifications by type', async () => {
		const { container, component } = render(NotificationCenter, { props: { groupByType: true } });
		
		component.addNotification({ type: 'message', title: 'Message 1', body: 'Body' });
		component.addNotification({ type: 'system', title: 'System 1', body: 'Body' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			const groups = container.querySelectorAll('.notification-group');
			expect(groups.length).toBe(2);
		});
	});

	it('collapses and expands groups', async () => {
		const { container, component } = render(NotificationCenter, { props: { groupByType: true } });
		
		component.addNotification({ type: 'message', title: 'Message 1', body: 'Body' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			expect(container.querySelector('.group-items')).toBeTruthy();
		});
		
		const groupHeader = container.querySelector('.group-header');
		await fireEvent.click(groupHeader!);
		
		await waitFor(() => {
			const chevron = container.querySelector('.chevron');
			expect(chevron?.classList.contains('collapsed')).toBe(true);
		});
	});

	it('formats timestamps correctly', async () => {
		const { container, component } = render(NotificationCenter);
		
		// Add notification with current timestamp
		component.addNotification({ type: 'message', title: 'Recent', body: 'Body' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		await waitFor(() => {
			const time = container.querySelector('.notification-time');
			expect(time?.textContent).toBe('Just now');
		});
	});

	it('dispatches click event when notification clicked', async () => {
		const { container, component } = render(NotificationCenter);
		
		const clickHandler = vi.fn();
		component.$on('click', clickHandler);
		
		component.addNotification({ type: 'message', title: 'Clickable', body: 'Click me' });
		
		const toggleButton = container.querySelector('.toggle-button');
		await fireEvent.click(toggleButton!);
		
		const item = container.querySelector('.notification-item');
		await fireEvent.click(item!);
		
		expect(clickHandler).toHaveBeenCalled();
	});

	it('limits notifications to maxNotifications prop', async () => {
		const { component } = render(NotificationCenter, { props: { maxNotifications: 3 } });
		
		// Add 5 notifications
		for (let i = 0; i < 5; i++) {
			component.addNotification({ type: 'message', title: `Msg ${i}`, body: 'Body' });
		}
		
		// Check stored count
		const stored = localStorage.getItem('hearth-notification-center');
		const data = JSON.parse(stored!);
		expect(data.notifications.length).toBe(3);
	});

	it('shows correct badge count (99+ for large counts)', async () => {
		const { container, component } = render(NotificationCenter);
		
		// Add 150 notifications
		for (let i = 0; i < 150; i++) {
			component.addNotification({ type: 'message', title: `Msg ${i}`, body: 'Body' });
		}
		
		await waitFor(() => {
			const badge = container.querySelector('.badge');
			expect(badge?.textContent).toBe('99+');
		});
	});
});
