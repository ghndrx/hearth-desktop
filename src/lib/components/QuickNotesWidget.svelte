<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	// Props
	export let compact: boolean = false;
	export let maxNotes: number = 10;

	// Note interface
	interface Note {
		id: string;
		content: string;
		color: string;
		pinned: boolean;
		createdAt: number;
		updatedAt: number;
	}

	// Available note colors
	const noteColors = [
		{ id: 'default', value: 'var(--background-tertiary, #202225)', label: 'Default' },
		{ id: 'yellow', value: '#fef3c7', label: 'Yellow' },
		{ id: 'green', value: '#d1fae5', label: 'Green' },
		{ id: 'blue', value: '#dbeafe', label: 'Blue' },
		{ id: 'purple', value: '#e9d5ff', label: 'Purple' },
		{ id: 'pink', value: '#fce7f3', label: 'Pink' },
		{ id: 'orange', value: '#fed7aa', label: 'Orange' }
	];

	// State
	let notes = writable<Note[]>([]);
	let newNoteContent = '';
	let selectedColor = 'default';
	let isAddingNote = false;
	let editingNoteId: string | null = null;
	let editContent = '';
	let showColorPicker = false;

	// Storage key
	const STORAGE_KEY = 'hearth-quick-notes';

	// Generate unique ID
	function generateId(): string {
		return `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// Load notes from localStorage
	function loadNotes(): Note[] {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				return JSON.parse(stored);
			}
		} catch (e) {
			console.error('Failed to load notes:', e);
		}
		return [];
	}

	// Save notes to localStorage
	function saveNotes(notesToSave: Note[]) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(notesToSave));
		} catch (e) {
			console.error('Failed to save notes:', e);
		}
	}

	// Add a new note
	function addNote() {
		if (!newNoteContent.trim()) return;

		const newNote: Note = {
			id: generateId(),
			content: newNoteContent.trim(),
			color: noteColors.find(c => c.id === selectedColor)?.value || noteColors[0].value,
			pinned: false,
			createdAt: Date.now(),
			updatedAt: Date.now()
		};

		notes.update(n => {
			const updated = [newNote, ...n].slice(0, maxNotes);
			saveNotes(updated);
			return updated;
		});

		newNoteContent = '';
		selectedColor = 'default';
		isAddingNote = false;
		showColorPicker = false;
	}

	// Delete a note
	function deleteNote(id: string) {
		notes.update(n => {
			const updated = n.filter(note => note.id !== id);
			saveNotes(updated);
			return updated;
		});
	}

	// Toggle pin status
	function togglePin(id: string) {
		notes.update(n => {
			const updated = n.map(note => 
				note.id === id ? { ...note, pinned: !note.pinned } : note
			);
			// Sort: pinned first, then by updatedAt
			updated.sort((a, b) => {
				if (a.pinned && !b.pinned) return -1;
				if (!a.pinned && b.pinned) return 1;
				return b.updatedAt - a.updatedAt;
			});
			saveNotes(updated);
			return updated;
		});
	}

	// Start editing a note
	function startEdit(note: Note) {
		editingNoteId = note.id;
		editContent = note.content;
	}

	// Save edit
	function saveEdit() {
		if (!editContent.trim() || !editingNoteId) {
			cancelEdit();
			return;
		}

		notes.update(n => {
			const updated = n.map(note => 
				note.id === editingNoteId 
					? { ...note, content: editContent.trim(), updatedAt: Date.now() }
					: note
			);
			saveNotes(updated);
			return updated;
		});

		cancelEdit();
	}

	// Cancel edit
	function cancelEdit() {
		editingNoteId = null;
		editContent = '';
	}

	// Format relative time
	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'Just now';
	}

	// Handle keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (editingNoteId) {
				cancelEdit();
			} else if (isAddingNote) {
				isAddingNote = false;
				showColorPicker = false;
			}
		}
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			if (editingNoteId) {
				saveEdit();
			} else if (isAddingNote && newNoteContent.trim()) {
				addNote();
			}
		}
	}

	// Check if color is light (for text contrast)
	function isLightColor(color: string): boolean {
		return !color.startsWith('var(');
	}

	onMount(() => {
		notes.set(loadNotes());
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="quick-notes-widget" class:compact>
	<div class="widget-header">
		<div class="widget-title">
			<span class="widget-icon">📝</span>
			<span>Quick Notes</span>
			<span class="note-count">({$notes.length})</span>
		</div>
		{#if !isAddingNote}
			<button 
				class="add-button" 
				on:click={() => { isAddingNote = true; }}
				title="Add new note"
			>
				+
			</button>
		{/if}
	</div>

	<!-- Add new note form -->
	{#if isAddingNote}
		<div class="add-note-form">
			<textarea
				bind:value={newNoteContent}
				placeholder="Write a quick note..."
				class="note-input"
				rows={compact ? 2 : 3}
				autofocus
			></textarea>
			<div class="form-actions">
				<div class="color-picker-wrapper">
					<button 
						class="color-picker-toggle"
						on:click={() => { showColorPicker = !showColorPicker; }}
						style="background-color: {noteColors.find(c => c.id === selectedColor)?.value || noteColors[0].value}"
						title="Choose color"
					>
						🎨
					</button>
					{#if showColorPicker}
						<div class="color-picker-dropdown">
							{#each noteColors as color (color.id)}
								<button
									class="color-option"
									class:selected={selectedColor === color.id}
									style="background-color: {color.value}"
									on:click={() => { selectedColor = color.id; showColorPicker = false; }}
									title={color.label}
								>
									{#if selectedColor === color.id}✓{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="action-buttons">
					<button class="cancel-button" on:click={() => { isAddingNote = false; showColorPicker = false; newNoteContent = ''; }}>
						Cancel
					</button>
					<button 
						class="save-button" 
						on:click={addNote}
						disabled={!newNoteContent.trim()}
					>
						Save
					</button>
				</div>
			</div>
			<div class="form-hint">
				Ctrl+Enter to save • Esc to cancel
			</div>
		</div>
	{/if}

	<!-- Notes list -->
	<div class="notes-list" class:has-notes={$notes.length > 0}>
		{#if $notes.length === 0 && !isAddingNote}
			<div class="empty-state">
				<span class="empty-icon">📋</span>
				<span class="empty-text">No notes yet</span>
				<button class="empty-add-button" on:click={() => { isAddingNote = true; }}>
					Add your first note
				</button>
			</div>
		{:else}
			{#each $notes as note (note.id)}
				<div 
					class="note-item"
					class:pinned={note.pinned}
					class:light-bg={isLightColor(note.color)}
					style="background-color: {note.color}"
				>
					{#if editingNoteId === note.id}
						<textarea
							bind:value={editContent}
							class="edit-input"
							class:light-bg={isLightColor(note.color)}
							rows={2}
							autofocus
						></textarea>
						<div class="edit-actions">
							<button class="edit-cancel" on:click={cancelEdit}>✕</button>
							<button class="edit-save" on:click={saveEdit}>✓</button>
						</div>
					{:else}
						<div class="note-content" on:dblclick={() => startEdit(note)}>
							{note.content}
						</div>
						<div class="note-footer">
							<span class="note-time" title={new Date(note.updatedAt).toLocaleString()}>
								{formatRelativeTime(note.updatedAt)}
							</span>
							<div class="note-actions">
								<button 
									class="note-action pin-action"
									class:active={note.pinned}
									on:click={() => togglePin(note.id)}
									title={note.pinned ? 'Unpin' : 'Pin'}
								>
									📌
								</button>
								<button 
									class="note-action edit-action"
									on:click={() => startEdit(note)}
									title="Edit"
								>
									✏️
								</button>
								<button 
									class="note-action delete-action"
									on:click={() => deleteNote(note.id)}
									title="Delete"
								>
									🗑️
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.quick-notes-widget {
		background: var(--background-secondary, #2f3136);
		border-radius: 8px;
		padding: 12px;
		min-width: 220px;
		max-width: 300px;
		font-family: var(--font-primary, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
	}

	.quick-notes-widget.compact {
		padding: 8px;
		min-width: 180px;
		max-width: 250px;
	}

	.widget-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--background-modifier-accent, #40444b);
	}

	.widget-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--header-secondary, #b9bbbe);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.widget-icon {
		font-size: 14px;
	}

	.note-count {
		font-weight: 400;
		font-size: 10px;
		color: var(--text-muted, #72767d);
	}

	.add-button {
		background: var(--brand-experiment, #5865f2);
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		font-size: 16px;
		line-height: 1;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s ease, transform 0.15s ease;
	}

	.add-button:hover {
		background: var(--brand-experiment-560, #4752c4);
		transform: scale(1.1);
	}

	.add-note-form {
		margin-bottom: 12px;
		padding: 10px;
		background: var(--background-tertiary, #202225);
		border-radius: 6px;
	}

	.note-input {
		width: 100%;
		padding: 8px;
		border: 1px solid var(--background-modifier-accent, #40444b);
		border-radius: 4px;
		background: var(--background-secondary, #2f3136);
		color: var(--text-normal, #dcddde);
		font-size: 13px;
		font-family: inherit;
		resize: none;
		box-sizing: border-box;
	}

	.note-input:focus {
		outline: none;
		border-color: var(--brand-experiment, #5865f2);
	}

	.form-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 8px;
	}

	.color-picker-wrapper {
		position: relative;
	}

	.color-picker-toggle {
		width: 28px;
		height: 28px;
		border-radius: 4px;
		border: 2px solid var(--background-modifier-accent, #40444b);
		cursor: pointer;
		font-size: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s ease;
	}

	.color-picker-toggle:hover {
		border-color: var(--brand-experiment, #5865f2);
	}

	.color-picker-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 4px;
		display: flex;
		gap: 4px;
		padding: 6px;
		background: var(--background-floating, #18191c);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 10;
	}

	.color-option {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: 2px solid transparent;
		cursor: pointer;
		font-size: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #333;
		transition: transform 0.15s ease;
	}

	.color-option:hover {
		transform: scale(1.15);
	}

	.color-option.selected {
		border-color: var(--brand-experiment, #5865f2);
	}

	.action-buttons {
		display: flex;
		gap: 8px;
	}

	.cancel-button,
	.save-button {
		padding: 6px 12px;
		border-radius: 4px;
		border: none;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.cancel-button {
		background: var(--background-modifier-accent, #40444b);
		color: var(--text-normal, #dcddde);
	}

	.cancel-button:hover {
		background: var(--background-modifier-hover, #4f545c);
	}

	.save-button {
		background: var(--brand-experiment, #5865f2);
		color: white;
	}

	.save-button:hover:not(:disabled) {
		background: var(--brand-experiment-560, #4752c4);
	}

	.save-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-hint {
		margin-top: 6px;
		font-size: 10px;
		color: var(--text-muted, #72767d);
		text-align: center;
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 300px;
		overflow-y: auto;
	}

	.notes-list::-webkit-scrollbar {
		width: 6px;
	}

	.notes-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.notes-list::-webkit-scrollbar-thumb {
		background: var(--background-modifier-accent, #40444b);
		border-radius: 3px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		text-align: center;
	}

	.empty-icon {
		font-size: 32px;
		margin-bottom: 8px;
		opacity: 0.6;
	}

	.empty-text {
		font-size: 13px;
		color: var(--text-muted, #72767d);
		margin-bottom: 12px;
	}

	.empty-add-button {
		padding: 8px 16px;
		background: var(--brand-experiment, #5865f2);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.empty-add-button:hover {
		background: var(--brand-experiment-560, #4752c4);
	}

	.note-item {
		padding: 10px;
		border-radius: 6px;
		position: relative;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.note-item:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.note-item.pinned {
		border-left: 3px solid var(--brand-experiment, #5865f2);
	}

	.note-item.light-bg {
		color: #1f2937;
	}

	.note-content {
		font-size: 13px;
		line-height: 1.4;
		color: inherit;
		word-break: break-word;
		white-space: pre-wrap;
		cursor: text;
	}

	.note-item:not(.light-bg) .note-content {
		color: var(--text-normal, #dcddde);
	}

	.edit-input {
		width: 100%;
		padding: 6px;
		border: 1px solid var(--brand-experiment, #5865f2);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.9);
		color: #1f2937;
		font-size: 13px;
		font-family: inherit;
		resize: none;
		box-sizing: border-box;
	}

	.edit-input:not(.light-bg) {
		background: var(--background-secondary, #2f3136);
		color: var(--text-normal, #dcddde);
	}

	.edit-input:focus {
		outline: none;
	}

	.edit-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 6px;
	}

	.edit-cancel,
	.edit-save {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		border: none;
		font-size: 12px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: opacity 0.15s ease;
	}

	.edit-cancel {
		background: var(--status-danger, #ed4245);
		color: white;
	}

	.edit-save {
		background: var(--status-positive, #3ba55c);
		color: white;
	}

	.edit-cancel:hover,
	.edit-save:hover {
		opacity: 0.85;
	}

	.note-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 8px;
		padding-top: 6px;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
	}

	.note-item:not(.light-bg) .note-footer {
		border-top-color: rgba(255, 255, 255, 0.1);
	}

	.note-time {
		font-size: 10px;
		color: inherit;
		opacity: 0.6;
	}

	.note-actions {
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.note-item:hover .note-actions {
		opacity: 1;
	}

	.note-action {
		background: none;
		border: none;
		padding: 2px 4px;
		font-size: 11px;
		cursor: pointer;
		border-radius: 2px;
		opacity: 0.7;
		transition: opacity 0.15s ease, transform 0.15s ease;
	}

	.note-action:hover {
		opacity: 1;
		transform: scale(1.2);
	}

	.note-action.pin-action.active {
		opacity: 1;
	}

	.note-action.delete-action:hover {
		transform: scale(1.2);
	}
</style>
