<script lang="ts">
	import { onMount } from 'svelte';
	import {
		quickNotesState,
		activeNote,
		noteCount,
		loadQuickNotes,
		createNote,
		updateNote,
		deleteNote,
		toggleNotePin,
		setActiveNote,
		toggleQuickNotes,
		type Note
	} from '$lib/stores/quickNotes';

	let showNoteList = false;
	let newNoteTitle = '';
	let editTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		loadQuickNotes();
	});

	async function handleCreateNote() {
		const title = newNoteTitle.trim() || 'Untitled Note';
		await createNote(title);
		newNoteTitle = '';
		showNoteList = false;
	}

	function handleContentChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		const note = $activeNote;
		if (!note) return;

		if (editTimeout) clearTimeout(editTimeout);
		editTimeout = setTimeout(() => {
			updateNote(note.id, { content: target.value });
		}, 500);
	}

	function handleTitleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const note = $activeNote;
		if (!note) return;

		if (editTimeout) clearTimeout(editTimeout);
		editTimeout = setTimeout(() => {
			updateNote(note.id, { title: target.value });
		}, 500);
	}

	async function handleDelete(note: Note) {
		if ($noteCount <= 1) return;
		await deleteNote(note.id);
	}

	const noteColors = [
		{ name: 'Default', value: null },
		{ name: 'Red', value: '#ef4444' },
		{ name: 'Yellow', value: '#eab308' },
		{ name: 'Green', value: '#22c55e' },
		{ name: 'Blue', value: '#3b82f6' },
		{ name: 'Purple', value: '#a855f7' }
	];
</script>

{#if $quickNotesState.isVisible}
	<div
		class="fixed bottom-4 right-4 z-50 flex w-80 flex-col overflow-hidden rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] shadow-xl"
		style="max-height: 480px;"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--bg-tertiary)] px-3 py-2">
			<div class="flex items-center gap-2">
				<span class="text-sm font-semibold text-[var(--text-primary)]">Quick Notes</span>
				<span class="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
					{$noteCount}
				</span>
			</div>
			<div class="flex items-center gap-1">
				<button
					class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
					title="Note list"
					onclick={() => (showNoteList = !showNoteList)}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
				<button
					class="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
					title="Close"
					onclick={toggleQuickNotes}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Note List (expandable) -->
		{#if showNoteList}
			<div class="max-h-48 overflow-y-auto border-b border-[var(--bg-tertiary)]">
				{#each $quickNotesState.notes as note}
					<button
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-modifier-hover)] {$activeNote?.id === note.id ? 'bg-[var(--bg-modifier-selected)]' : ''}"
						onclick={() => {
							setActiveNote(note.id);
							showNoteList = false;
						}}
					>
						{#if note.color}
							<span class="h-2 w-2 rounded-full" style="background: {note.color}"></span>
						{/if}
						<span class="flex-1 truncate text-[var(--text-primary)]">{note.title}</span>
						{#if note.pinned}
							<svg class="h-3 w-3 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 20 20">
								<path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.8L9 4.323V3a1 1 0 011-1z" />
							</svg>
						{/if}
						{#if $noteCount > 1}
							<button
								class="rounded p-0.5 text-[var(--text-muted)] hover:text-red-400"
								onclick={(e) => {
									e.stopPropagation();
									handleDelete(note);
								}}
							>
								<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						{/if}
					</button>
				{/each}
				<!-- New note -->
				<div class="flex items-center gap-1 px-3 py-2">
					<input
						type="text"
						class="flex-1 rounded bg-[var(--bg-tertiary)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)]"
						placeholder="New note title..."
						bind:value={newNoteTitle}
						onkeydown={(e) => e.key === 'Enter' && handleCreateNote()}
					/>
					<button
						class="rounded bg-[var(--brand-500)] px-2 py-1 text-xs text-white hover:bg-[var(--brand-560)]"
						onclick={handleCreateNote}
					>
						+
					</button>
				</div>
			</div>
		{/if}

		<!-- Active Note Editor -->
		{#if $activeNote}
			<div class="flex flex-col">
				<div class="flex items-center gap-2 px-3 py-2">
					<input
						type="text"
						class="flex-1 bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none"
						value={$activeNote.title}
						oninput={handleTitleChange}
					/>
					<button
						class="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
						title={$activeNote.pinned ? 'Unpin' : 'Pin'}
						onclick={() => $activeNote && toggleNotePin($activeNote.id)}
					>
						<svg class="h-3.5 w-3.5" fill={$activeNote.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
						</svg>
					</button>
				</div>

				<!-- Color selector -->
				<div class="flex gap-1 px-3 pb-2">
					{#each noteColors as color}
						<button
							class="h-4 w-4 rounded-full border border-[var(--bg-tertiary)] {$activeNote?.color === color.value ? 'ring-2 ring-[var(--brand-500)]' : ''}"
							style="background: {color.value || 'var(--bg-tertiary)'}"
							title={color.name}
							onclick={() =>
								$activeNote && updateNote($activeNote.id, { color: color.value ?? undefined })}
						></button>
					{/each}
				</div>

				<textarea
					class="min-h-[200px] flex-1 resize-none bg-transparent px-3 pb-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
					placeholder="Start typing..."
					value={$activeNote.content}
					oninput={handleContentChange}
				></textarea>
			</div>
		{/if}

		<!-- Footer -->
		<div class="border-t border-[var(--bg-tertiary)] px-3 py-1.5">
			<span class="text-[10px] text-[var(--text-muted)]">
				{#if $activeNote}
					Last updated {new Date($activeNote.updatedAt).toLocaleString()}
				{/if}
			</span>
		</div>
	</div>
{/if}
