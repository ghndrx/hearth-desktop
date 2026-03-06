<script lang="ts">
	import { onMount } from 'svelte';
	import {
		stickyNotes,
		archivedNotes,
		stickyNoteCount,
		loadStickyNotes,
		loadArchivedNotes,
		createNote,
		updateNote,
		deleteNote,
		setNoteColor,
		setNotePosition,
		togglePin,
		archiveNote,
		restoreNote,
		clearArchived,
		type StickyNote,
		type StickyNoteColor
	} from '$lib/stores/stickyNotes';

	let showArchived = false;
	let editingNoteId: string | null = null;
	let editContent = '';
	let colorPickerNoteId: string | null = null;
	let editTimeout: ReturnType<typeof setTimeout> | null = null;

	const colors: { name: string; value: StickyNoteColor; bg: string; text: string }[] = [
		{ name: 'Yellow', value: 'yellow', bg: 'bg-yellow-200', text: 'text-yellow-900' },
		{ name: 'Pink', value: 'pink', bg: 'bg-pink-200', text: 'text-pink-900' },
		{ name: 'Blue', value: 'blue', bg: 'bg-blue-200', text: 'text-blue-900' },
		{ name: 'Green', value: 'green', bg: 'bg-green-200', text: 'text-green-900' },
		{ name: 'Purple', value: 'purple', bg: 'bg-purple-200', text: 'text-purple-900' },
		{ name: 'Orange', value: 'orange', bg: 'bg-orange-200', text: 'text-orange-900' }
	];

	function getColorClasses(color: StickyNoteColor): { bg: string; text: string } {
		const found = colors.find((c) => c.value === color);
		return found ? { bg: found.bg, text: found.text } : { bg: 'bg-yellow-200', text: 'text-yellow-900' };
	}

	onMount(() => {
		loadStickyNotes();
		loadArchivedNotes();
	});

	async function handleAddNote() {
		const offset = $stickyNoteCount * 20;
		await createNote('', 'yellow', 100 + offset, 100 + offset);
	}

	function startEditing(note: StickyNote) {
		editingNoteId = note.id;
		editContent = note.content;
	}

	function handleEditInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		editContent = target.value;

		if (editTimeout) clearTimeout(editTimeout);
		editTimeout = setTimeout(() => {
			if (editingNoteId) {
				updateNote(editingNoteId, editContent);
			}
		}, 400);
	}

	function finishEditing() {
		if (editingNoteId) {
			updateNote(editingNoteId, editContent);
		}
		editingNoteId = null;
		editContent = '';
	}

	async function handleColorChange(noteId: string, color: StickyNoteColor) {
		await setNoteColor(noteId, color);
		colorPickerNoteId = null;
	}

	async function handleDelete(noteId: string) {
		await deleteNote(noteId);
	}

	async function handleArchive(noteId: string) {
		await archiveNote(noteId);
	}

	async function handleRestore(noteId: string) {
		await restoreNote(noteId);
	}

	async function handleClearArchived() {
		await clearArchived();
	}

	async function handleTogglePin(noteId: string) {
		await togglePin(noteId);
	}

	function toggleColorPicker(noteId: string) {
		colorPickerNoteId = colorPickerNoteId === noteId ? null : noteId;
	}
</script>

<div class="flex h-full flex-col overflow-hidden bg-[var(--bg-secondary)]">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-[var(--bg-tertiary)] px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
			</svg>
			<h2 class="text-sm font-semibold text-[var(--text-primary)]">Sticky Notes</h2>
			<span class="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
				{$stickyNoteCount}
			</span>
		</div>
		<div class="flex items-center gap-1">
			<button
				class="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
				title={showArchived ? 'Show active notes' : 'Show archived notes'}
				onclick={() => (showArchived = !showArchived)}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					{#if showArchived}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					{/if}
				</svg>
			</button>
			<button
				class="rounded-full bg-[var(--brand-500)] p-1.5 text-white shadow-md hover:bg-[var(--brand-560)]"
				title="Add new note"
				onclick={handleAddNote}
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Notes Area -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if showArchived}
			<!-- Archived Notes -->
			<div class="mb-3 flex items-center justify-between">
				<span class="text-xs font-medium text-[var(--text-muted)]">
					Archived ({$archivedNotes.length})
				</span>
				{#if $archivedNotes.length > 0}
					<button
						class="text-xs text-red-400 hover:text-red-300"
						onclick={handleClearArchived}
					>
						Clear all
					</button>
				{/if}
			</div>

			{#if $archivedNotes.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="mb-2 h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
					</svg>
					<p class="text-xs text-[var(--text-muted)]">No archived notes</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					{#each $archivedNotes as note (note.id)}
						{@const cc = getColorClasses(note.color)}
						<div class="flex flex-col rounded-lg {cc.bg} p-3 opacity-70 shadow-sm">
							<p class="mb-2 flex-1 text-xs {cc.text} line-clamp-4">
								{note.content || 'Empty note'}
							</p>
							<div class="flex items-center justify-end gap-1">
								<button
									class="rounded p-1 {cc.text} opacity-60 hover:opacity-100"
									title="Restore"
									onclick={() => handleRestore(note.id)}
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Active Notes -->
			{#if $stickyNoteCount === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg class="mb-2 h-10 w-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
					</svg>
					<p class="text-sm text-[var(--text-muted)]">No sticky notes yet</p>
					<p class="mt-1 text-xs text-[var(--text-muted)]">Click + to create one</p>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					{#each $stickyNotes as note (note.id)}
						{@const cc = getColorClasses(note.color)}
						<div
							class="group relative flex flex-col rounded-lg {cc.bg} shadow-sm transition-shadow hover:shadow-md"
							style="min-height: 120px;"
						>
							<!-- Pin indicator -->
							{#if note.pinned}
								<div class="absolute -right-1 -top-1 z-10">
									<svg class="h-4 w-4 {cc.text} drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.8L9 4.323V3a1 1 0 011-1z" />
									</svg>
								</div>
							{/if}

							<!-- Note content -->
							<div class="flex-1 p-3">
								{#if editingNoteId === note.id}
									<textarea
										class="h-full w-full resize-none bg-transparent text-xs {cc.text} placeholder-opacity-50 outline-none"
										placeholder="Write something..."
										value={editContent}
										oninput={handleEditInput}
										onblur={finishEditing}
										autofocus
									></textarea>
								{:else}
									<button
										class="h-full w-full cursor-text text-left"
										onclick={() => startEditing(note)}
									>
										<p class="whitespace-pre-wrap text-xs {cc.text}">
											{note.content || 'Click to edit...'}
										</p>
									</button>
								{/if}
							</div>

							<!-- Note actions (visible on hover) -->
							<div class="flex items-center justify-between border-t border-black/5 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100">
								<div class="flex items-center gap-0.5">
									<!-- Color picker toggle -->
									<button
										class="rounded p-1 {cc.text} opacity-60 hover:opacity-100"
										title="Change color"
										onclick={() => toggleColorPicker(note.id)}
									>
										<svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
											<circle cx="10" cy="10" r="8" />
										</svg>
									</button>
									<!-- Pin toggle -->
									<button
										class="rounded p-1 {cc.text} opacity-60 hover:opacity-100"
										title={note.pinned ? 'Unpin' : 'Pin'}
										onclick={() => handleTogglePin(note.id)}
									>
										<svg class="h-3 w-3" fill={note.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
										</svg>
									</button>
									<!-- Archive -->
									<button
										class="rounded p-1 {cc.text} opacity-60 hover:opacity-100"
										title="Archive"
										onclick={() => handleArchive(note.id)}
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
										</svg>
									</button>
								</div>
								<!-- Delete -->
								<button
									class="rounded p-1 {cc.text} opacity-60 hover:text-red-700 hover:opacity-100"
									title="Delete"
									onclick={() => handleDelete(note.id)}
								>
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>

							<!-- Color picker dropdown -->
							{#if colorPickerNoteId === note.id}
								<div class="absolute bottom-10 left-2 z-20 flex gap-1 rounded-lg bg-white p-2 shadow-lg">
									{#each colors as color}
										<button
											class="h-5 w-5 rounded-full {color.bg} border border-black/10 transition-transform hover:scale-110 {note.color === color.value ? 'ring-2 ring-gray-600 ring-offset-1' : ''}"
											title={color.name}
											onclick={() => handleColorChange(note.id, color.value)}
										></button>
									{/each}
								</div>
							{/if}

							<!-- Linked context indicator -->
							{#if note.channelId}
								<div class="absolute bottom-1 right-2 opacity-0 group-hover:opacity-60">
									<svg class="h-3 w-3 {cc.text}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
									</svg>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Footer -->
	<div class="border-t border-[var(--bg-tertiary)] px-4 py-2">
		<span class="text-[10px] text-[var(--text-muted)]">
			{#if showArchived}
				{$archivedNotes.length} archived note{$archivedNotes.length !== 1 ? 's' : ''}
			{:else}
				{$stickyNoteCount} note{$stickyNoteCount !== 1 ? 's' : ''}
			{/if}
		</span>
	</div>
</div>
