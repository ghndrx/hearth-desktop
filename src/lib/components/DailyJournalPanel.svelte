<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { journal, journalWordCount, journalIsToday, type JournalStats } from '$lib/stores/journal';

	let stats = $state<JournalStats>({
		totalEntries: 0,
		currentStreak: 0,
		longestStreak: 0,
		totalWords: 0,
		moodAverage: null,
		entriesThisMonth: 0
	});

	let showHistory = $state(false);
	let showTagInput = $state(false);
	let newTag = $state('');
	let entryDates = $state<string[]>([]);

	const moods = [
		{ value: 1, label: 'Rough', color: '#ed4245' },
		{ value: 2, label: 'Meh', color: '#faa61a' },
		{ value: 3, label: 'Okay', color: '#fee75c' },
		{ value: 4, label: 'Good', color: '#57f287' },
		{ value: 5, label: 'Great', color: '#3ba55c' }
	];

	const unsub = journal.stats.subscribe((s) => (stats = s));
	const unsubDates = journal.dates.subscribe((d) => (entryDates = d));

	onMount(() => {
		journal.init();
	});

	onDestroy(() => {
		journal.cleanup();
		unsub();
		unsubDates();
	});

	function handleAddTag() {
		const tag = newTag.trim();
		if (tag) {
			journal.addTag(tag);
			newTag = '';
			showTagInput = false;
		}
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAddTag();
		} else if (e.key === 'Escape') {
			showTagInput = false;
			newTag = '';
		}
	}

	function formatDisplayDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatShortDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="flex flex-col gap-3 rounded-lg bg-[var(--bg-secondary)] p-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold text-[var(--text-primary)]">Daily Journal</h3>
		<div class="flex items-center gap-1">
			<button
				class="rounded px-1.5 py-0.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
				onclick={() => (showHistory = !showHistory)}
			>
				{showHistory ? 'Write' : 'History'}
			</button>
		</div>
	</div>

	{#if !showHistory}
		<!-- Date Navigation -->
		<div class="flex items-center justify-between rounded-md bg-[var(--bg-tertiary)] px-2 py-1.5">
			<button
				class="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
				onclick={() => journal.goToPreviousDay()}
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M10.5 3L5.5 8l5 5" stroke="currentColor" stroke-width="1.5" fill="none" />
				</svg>
			</button>

			<div class="text-center">
				<div class="text-xs font-medium text-[var(--text-primary)]">
					{formatDisplayDate($journal.selectedDate)}
				</div>
				{#if !$journalIsToday}
					<button
						class="text-[10px] text-[var(--brand-500)] hover:underline"
						onclick={() => journal.goToToday()}
					>
						Back to today
					</button>
				{/if}
			</div>

			<button
				class="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
				onclick={() => journal.goToNextDay()}
				disabled={$journalIsToday}
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M5.5 3L10.5 8l-5 5" stroke="currentColor" stroke-width="1.5" fill="none" />
				</svg>
			</button>
		</div>

		<!-- Mood Selector -->
		<div class="flex items-center gap-1">
			<span class="text-[10px] text-[var(--text-muted)]">Mood:</span>
			<div class="flex gap-1">
				{#each moods as m}
					<button
						class="flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all {$journal.mood === m.value
							? 'scale-110 ring-2 ring-white/30'
							: 'opacity-50 hover:opacity-80'}"
						style="background-color: {m.color}"
						title={m.label}
						onclick={() => journal.setMood($journal.mood === m.value ? null : m.value)}
					>
						{m.value}
					</button>
				{/each}
			</div>
			{#if $journal.mood}
				<span class="text-[10px] text-[var(--text-muted)]">
					{moods.find((m) => m.value === $journal.mood)?.label}
				</span>
			{/if}
		</div>

		<!-- Text Editor -->
		<div class="relative">
			<textarea
				class="min-h-[160px] w-full resize-y rounded-md border border-[var(--bg-tertiary)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--brand-500)] focus:outline-none"
				placeholder={$journalIsToday
					? "How's your day going? What's on your mind..."
					: 'Write about this day...'}
				value={$journal.content}
				oninput={(e) => journal.updateContent(e.currentTarget.value)}
			></textarea>
			<div class="absolute bottom-2 right-2 flex items-center gap-2">
				{#if $journal.saving}
					<span class="text-[10px] text-[var(--text-muted)]">Saving...</span>
				{/if}
				<span class="text-[10px] text-[var(--text-muted)]">
					{$journalWordCount} word{$journalWordCount !== 1 ? 's' : ''}
				</span>
			</div>
		</div>

		<!-- Tags -->
		<div class="flex flex-wrap items-center gap-1">
			{#each $journal.tags as tag}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-[var(--brand-500)]/20 px-2 py-0.5 text-[10px] text-[var(--brand-500)]"
				>
					{tag}
					<button
						class="hover:text-[var(--danger)]"
						onclick={() => journal.removeTag(tag)}
					>
						x
					</button>
				</span>
			{/each}
			{#if showTagInput}
				<input
					type="text"
					class="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-primary)] focus:outline-none"
					placeholder="Tag name..."
					bind:value={newTag}
					onkeydown={handleTagKeydown}
					onblur={() => {
						if (!newTag.trim()) showTagInput = false;
					}}
				/>
			{:else}
				<button
					class="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
					onclick={() => (showTagInput = true)}
				>
					+ tag
				</button>
			{/if}
		</div>

		<!-- Stats Row -->
		<div class="grid grid-cols-3 gap-2 border-t border-[var(--bg-tertiary)] pt-3 text-center">
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{stats.currentStreak}
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Day Streak</div>
			</div>
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{stats.totalEntries}
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Entries</div>
			</div>
			<div>
				<div class="text-sm font-semibold text-[var(--text-primary)]">
					{stats.totalWords.toLocaleString()}
				</div>
				<div class="text-[10px] text-[var(--text-muted)]">Words</div>
			</div>
		</div>
	{:else}
		<!-- History View -->
		<div class="flex flex-col gap-1.5" style="max-height: 320px; overflow-y: auto;">
			{#if entryDates.length === 0}
				<div class="py-6 text-center text-xs text-[var(--text-muted)]">
					No journal entries yet. Start writing today!
				</div>
			{:else}
				{#each entryDates as date}
					<button
						class="flex items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] {$journal.selectedDate === date
							? 'bg-[var(--bg-tertiary)]'
							: ''}"
						onclick={() => {
							journal.goToDate(date);
							showHistory = false;
						}}
					>
						<div>
							<div class="text-xs font-medium text-[var(--text-primary)]">
								{formatDisplayDate(date)}
							</div>
							<div class="text-[10px] text-[var(--text-muted)]">
								{formatShortDate(date)}
							</div>
						</div>
						<svg
							width="14"
							height="14"
							viewBox="0 0 16 16"
							fill="none"
							class="text-[var(--text-muted)]"
						>
							<path
								d="M5.5 3L10.5 8l-5 5"
								stroke="currentColor"
								stroke-width="1.5"
							/>
						</svg>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
