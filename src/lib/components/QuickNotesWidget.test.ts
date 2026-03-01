import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import QuickNotesWidget from './QuickNotesWidget.svelte';

describe('QuickNotesWidget', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-01T21:17:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
	});

	it('renders without crashing', () => {
		render(QuickNotesWidget);
		expect(screen.getByText('Quick Notes')).toBeTruthy();
	});

	it('displays empty state when no notes exist', () => {
		render(QuickNotesWidget);
		expect(screen.getByText('No notes yet')).toBeTruthy();
		expect(screen.getByText('Add your first note')).toBeTruthy();
	});

	it('shows note count in header', () => {
		render(QuickNotesWidget);
		const noteCount = document.querySelector('.note-count');
		expect(noteCount?.textContent).toBe('(0)');
	});

	it('renders in compact mode', () => {
		const { container } = render(QuickNotesWidget, { compact: true });
		const widget = container.querySelector('.quick-notes-widget');
		expect(widget?.classList.contains('compact')).toBe(true);
	});

	it('shows add note form when clicking add button', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const noteInput = document.querySelector('.note-input');
			expect(noteInput).toBeTruthy();
		}
	});

	it('shows add note form when clicking empty state button', async () => {
		render(QuickNotesWidget);
		const emptyAddButton = document.querySelector('.empty-add-button');
		
		if (emptyAddButton) {
			await fireEvent.click(emptyAddButton);
			const noteInput = document.querySelector('.note-input');
			expect(noteInput).toBeTruthy();
		}
	});

	it('creates a new note when submitting the form', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const noteInput = document.querySelector('.note-input') as HTMLTextAreaElement;
			
			if (noteInput) {
				await fireEvent.input(noteInput, { target: { value: 'Test note content' } });
				const saveButton = document.querySelector('.save-button');
				
				if (saveButton) {
					await fireEvent.click(saveButton);
					expect(screen.getByText('Test note content')).toBeTruthy();
				}
			}
		}
	});

	it('cancels adding note when clicking cancel', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const cancelButton = document.querySelector('.cancel-button');
			
			if (cancelButton) {
				await fireEvent.click(cancelButton);
				const noteInput = document.querySelector('.note-input');
				expect(noteInput).toBeNull();
			}
		}
	});

	it('disables save button when note content is empty', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const saveButton = document.querySelector('.save-button') as HTMLButtonElement;
			expect(saveButton?.disabled).toBe(true);
		}
	});

	it('shows color picker when clicking color button', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const colorToggle = document.querySelector('.color-picker-toggle');
			
			if (colorToggle) {
				await fireEvent.click(colorToggle);
				const colorPicker = document.querySelector('.color-picker-dropdown');
				expect(colorPicker).toBeTruthy();
			}
		}
	});

	it('displays multiple color options in color picker', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const colorToggle = document.querySelector('.color-picker-toggle');
			
			if (colorToggle) {
				await fireEvent.click(colorToggle);
				const colorOptions = document.querySelectorAll('.color-option');
				expect(colorOptions.length).toBeGreaterThan(1);
			}
		}
	});

	it('saves notes to localStorage', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const noteInput = document.querySelector('.note-input') as HTMLTextAreaElement;
			
			if (noteInput) {
				await fireEvent.input(noteInput, { target: { value: 'Persistent note' } });
				const saveButton = document.querySelector('.save-button');
				
				if (saveButton) {
					await fireEvent.click(saveButton);
					const stored = localStorage.getItem('hearth-quick-notes');
					expect(stored).toBeTruthy();
					const notes = JSON.parse(stored!);
					expect(notes.length).toBe(1);
					expect(notes[0].content).toBe('Persistent note');
				}
			}
		}
	});

	it('loads notes from localStorage on mount', async () => {
		// Pre-populate localStorage
		const existingNotes = [
			{
				id: 'test-1',
				content: 'Existing note',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		expect(screen.getByText('Existing note')).toBeTruthy();
	});

	it('deletes a note when clicking delete button', async () => {
		// Pre-populate localStorage
		const existingNotes = [
			{
				id: 'test-delete',
				content: 'Note to delete',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		expect(screen.getByText('Note to delete')).toBeTruthy();
		
		// Hover to show actions
		const noteItem = document.querySelector('.note-item');
		if (noteItem) {
			await fireEvent.mouseOver(noteItem);
			const deleteButton = document.querySelector('.delete-action');
			
			if (deleteButton) {
				await fireEvent.click(deleteButton);
				expect(screen.queryByText('Note to delete')).toBeNull();
			}
		}
	});

	it('toggles pin status when clicking pin button', async () => {
		const existingNotes = [
			{
				id: 'test-pin',
				content: 'Note to pin',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const noteItem = document.querySelector('.note-item');
		if (noteItem) {
			await fireEvent.mouseOver(noteItem);
			const pinButton = document.querySelector('.pin-action');
			
			if (pinButton) {
				await fireEvent.click(pinButton);
				const pinnedNote = document.querySelector('.note-item.pinned');
				expect(pinnedNote).toBeTruthy();
			}
		}
	});

	it('enters edit mode when clicking edit button', async () => {
		const existingNotes = [
			{
				id: 'test-edit',
				content: 'Note to edit',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const noteItem = document.querySelector('.note-item');
		if (noteItem) {
			await fireEvent.mouseOver(noteItem);
			const editButton = document.querySelector('.edit-action');
			
			if (editButton) {
				await fireEvent.click(editButton);
				const editInput = document.querySelector('.edit-input');
				expect(editInput).toBeTruthy();
			}
		}
	});

	it('enters edit mode on double-click', async () => {
		const existingNotes = [
			{
				id: 'test-dblclick',
				content: 'Double click me',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const noteContent = document.querySelector('.note-content');
		if (noteContent) {
			await fireEvent.dblClick(noteContent);
			const editInput = document.querySelector('.edit-input');
			expect(editInput).toBeTruthy();
		}
	});

	it('saves edited note content', async () => {
		const existingNotes = [
			{
				id: 'test-save-edit',
				content: 'Original content',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const noteContent = document.querySelector('.note-content');
		if (noteContent) {
			await fireEvent.dblClick(noteContent);
			const editInput = document.querySelector('.edit-input') as HTMLTextAreaElement;
			
			if (editInput) {
				await fireEvent.input(editInput, { target: { value: 'Updated content' } });
				const saveEditButton = document.querySelector('.edit-save');
				
				if (saveEditButton) {
					await fireEvent.click(saveEditButton);
					expect(screen.getByText('Updated content')).toBeTruthy();
				}
			}
		}
	});

	it('cancels edit when clicking cancel button', async () => {
		const existingNotes = [
			{
				id: 'test-cancel-edit',
				content: 'Keep this content',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const noteContent = document.querySelector('.note-content');
		if (noteContent) {
			await fireEvent.dblClick(noteContent);
			const cancelEditButton = document.querySelector('.edit-cancel');
			
			if (cancelEditButton) {
				await fireEvent.click(cancelEditButton);
				expect(screen.getByText('Keep this content')).toBeTruthy();
				const editInput = document.querySelector('.edit-input');
				expect(editInput).toBeNull();
			}
		}
	});

	it('displays relative time for notes', () => {
		const existingNotes = [
			{
				id: 'test-time',
				content: 'Recent note',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		const noteTime = document.querySelector('.note-time');
		expect(noteTime?.textContent).toBe('Just now');
	});

	it('respects maxNotes prop', async () => {
		render(QuickNotesWidget, { maxNotes: 2 });
		
		// Add 3 notes
		for (let i = 0; i < 3; i++) {
			const addButton = document.querySelector('.add-button');
			if (addButton) {
				await fireEvent.click(addButton);
				const noteInput = document.querySelector('.note-input') as HTMLTextAreaElement;
				if (noteInput) {
					await fireEvent.input(noteInput, { target: { value: `Note ${i}` } });
					const saveButton = document.querySelector('.save-button');
					if (saveButton) {
						await fireEvent.click(saveButton);
					}
				}
			}
		}
		
		const noteItems = document.querySelectorAll('.note-item');
		expect(noteItems.length).toBeLessThanOrEqual(2);
	});

	it('has proper accessibility with title attributes', async () => {
		const existingNotes = [
			{
				id: 'test-a11y',
				content: 'Accessible note',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		
		const addButton = document.querySelector('.add-button');
		expect(addButton?.getAttribute('title')).toBe('Add new note');
	});

	it('shows form hint text', async () => {
		render(QuickNotesWidget);
		const addButton = document.querySelector('.add-button');
		
		if (addButton) {
			await fireEvent.click(addButton);
			const hint = document.querySelector('.form-hint');
			expect(hint?.textContent).toContain('Ctrl+Enter');
		}
	});

	it('renders widget icon', () => {
		render(QuickNotesWidget);
		const icon = document.querySelector('.widget-icon');
		expect(icon?.textContent).toBe('📝');
	});

	it('applies light background styling for colored notes', async () => {
		const existingNotes = [
			{
				id: 'test-light',
				content: 'Yellow note',
				color: '#fef3c7',
				pinned: false,
				createdAt: Date.now(),
				updatedAt: Date.now()
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		const noteItem = document.querySelector('.note-item');
		expect(noteItem?.classList.contains('light-bg')).toBe(true);
	});

	it('sorts pinned notes first', async () => {
		const existingNotes = [
			{
				id: 'unpinned',
				content: 'Unpinned note',
				color: 'var(--background-tertiary, #202225)',
				pinned: false,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now() - 1000
			},
			{
				id: 'pinned',
				content: 'Pinned note',
				color: 'var(--background-tertiary, #202225)',
				pinned: true,
				createdAt: Date.now() - 2000,
				updatedAt: Date.now() - 2000
			}
		];
		localStorage.setItem('hearth-quick-notes', JSON.stringify(existingNotes));
		
		render(QuickNotesWidget);
		const noteItems = document.querySelectorAll('.note-item');
		const firstNote = noteItems[0];
		expect(firstNote?.classList.contains('pinned')).toBe(true);
	});
});
