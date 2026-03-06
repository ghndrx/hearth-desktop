<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		voiceMemos,
		recordingState,
		memoCount,
		favoriteMemos,
		startRecording,
		stopRecording,
		cancelRecording,
		getAllMemos,
		deleteMemo,
		toggleFavorite,
		updateMemoTitle,
		searchMemos,
		getMemoStats,
		type VoiceMemo,
		type VoiceMemoStats
	} from '$lib/stores/voiceMemos';

	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	let searchQuery = $state('');
	let searchResults = $state<VoiceMemo[] | null>(null);
	let expandedMemoId = $state<string | null>(null);
	let editingTitleId = $state<string | null>(null);
	let editTitleValue = $state('');
	let playingMemoId = $state<string | null>(null);
	let stats = $state<VoiceMemoStats>({ total_count: 0, total_duration_ms: 0, favorites_count: 0 });
	let selectedTag = $state<string | null>(null);
	let elapsedMs = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let confirmDeleteId = $state<string | null>(null);

	let displayedMemos = $derived.by(() => {
		let memos = searchResults ?? $voiceMemos;
		if (selectedTag) {
			memos = memos.filter((m) => m.tags.includes(selectedTag!));
		}
		return memos;
	});

	let allTags = $derived.by(() => {
		const tagSet = new Set<string>();
		for (const memo of $voiceMemos) {
			for (const tag of memo.tags) {
				tagSet.add(tag);
			}
		}
		return Array.from(tagSet).sort();
	});

	onMount(async () => {
		await getAllMemos();
		stats = await getMemoStats();
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});

	function startTimer() {
		elapsedMs = 0;
		timerInterval = setInterval(() => {
			elapsedMs += 100;
		}, 100);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	}

	async function handleStartRecording() {
		await startRecording();
		startTimer();
	}

	async function handleStopRecording() {
		stopTimer();
		const memo = await stopRecording({
			title: `Voice Memo ${$memoCount + 1}`,
			file_path: '',
			duration_ms: elapsedMs,
			file_size: 0
		});
		elapsedMs = 0;
		stats = await getMemoStats();
	}

	async function handleCancelRecording() {
		stopTimer();
		await cancelRecording();
		elapsedMs = 0;
	}

	async function handleSearch() {
		if (searchQuery.trim()) {
			searchResults = await searchMemos(searchQuery);
		} else {
			searchResults = null;
		}
	}

	async function handleDelete(id: string) {
		if (confirmDeleteId !== id) {
			confirmDeleteId = id;
			return;
		}
		await deleteMemo(id);
		confirmDeleteId = null;
		stats = await getMemoStats();
		if (searchResults) {
			searchResults = searchResults.filter((m) => m.id !== id);
		}
	}

	async function handleToggleFavorite(id: string) {
		await toggleFavorite(id);
		stats = await getMemoStats();
	}

	function startEditTitle(memo: VoiceMemo) {
		editingTitleId = memo.id;
		editTitleValue = memo.title;
	}

	async function saveTitle() {
		if (editingTitleId && editTitleValue.trim()) {
			await updateMemoTitle(editingTitleId, editTitleValue.trim());
		}
		editingTitleId = null;
	}

	function cancelEditTitle() {
		editingTitleId = null;
	}

	function toggleExpand(id: string) {
		expandedMemoId = expandedMemoId === id ? null : id;
	}

	function togglePlay(id: string) {
		playingMemoId = playingMemoId === id ? null : id;
	}

	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function formatElapsed(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const tenths = Math.floor((ms % 1000) / 100);
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diffDays === 1) {
			return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
		} else if (diffDays < 7) {
			return `${diffDays}d ago`;
		} else {
			return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
		}
	}

	function formatTotalDuration(ms: number): string {
		const totalMinutes = Math.floor(ms / 60000);
		if (totalMinutes < 60) return `${totalMinutes}m`;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${hours}h ${minutes}m`;
	}
</script>

<div class="flex h-full flex-col bg-[#2b2d31] {compact ? 'text-sm' : ''}">
	<!-- Header -->
	<div class="flex items-center gap-2 border-b border-[#1e1f22] px-4 py-3">
		<svg class="h-5 w-5 text-[#5865f2]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
		</svg>
		<h2 class="text-base font-semibold text-[#f2f3f5]">Voice Memos</h2>
		<span class="ml-auto rounded bg-[#313338] px-2 py-0.5 text-xs text-[#b5bac1]">
			{$memoCount}
		</span>
	</div>

	<!-- Recording Controls -->
	<div class="border-b border-[#1e1f22] px-4 py-4">
		{#if $recordingState.is_recording}
			<div class="flex flex-col items-center gap-3">
				<!-- Recording Timer -->
				<div class="font-mono text-2xl font-bold text-[#ed4245]">
					{formatElapsed(elapsedMs)}
				</div>

				<!-- Audio Level Meter -->
				<div class="flex h-3 w-full items-center gap-0.5 overflow-hidden rounded-full bg-[#1e1f22] px-1">
					<div
						class="h-1.5 rounded-full bg-[#ed4245] transition-all duration-100"
						style="width: {Math.max(5, $recordingState.audio_level * 100)}%"
					></div>
				</div>

				<!-- Recording Indicator -->
				<div class="flex items-center gap-2 text-sm text-[#ed4245]">
					<span class="inline-block h-2 w-2 animate-pulse rounded-full bg-[#ed4245]"></span>
					Recording...
				</div>

				<!-- Stop / Cancel Buttons -->
				<div class="flex gap-3">
					<button
						onclick={handleStopRecording}
						class="flex items-center gap-2 rounded-md bg-[#5865f2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4752c4]"
					>
						<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
							<rect x="6" y="6" width="12" height="12" rx="1" />
						</svg>
						Stop
					</button>
					<button
						onclick={handleCancelRecording}
						class="flex items-center gap-2 rounded-md bg-[#313338] px-4 py-2 text-sm font-medium text-[#b5bac1] transition-colors hover:bg-[#383a40] hover:text-[#f2f3f5]"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-2">
				<button
					onclick={handleStartRecording}
					class="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[#ed4245] text-white shadow-lg transition-all hover:scale-105 hover:bg-[#d93a3d] hover:shadow-xl"
				>
					<svg class="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
						<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
					</svg>
					<span class="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#2b2d31] bg-[#3ba55c]"></span>
				</button>
				<span class="text-xs text-[#b5bac1]">Click to record</span>
			</div>
		{/if}
	</div>

	<!-- Search Bar -->
	<div class="border-b border-[#1e1f22] px-4 py-2">
		<div class="relative">
			<svg class="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4e5058]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="text"
				placeholder="Search memos..."
				bind:value={searchQuery}
				oninput={handleSearch}
				class="w-full rounded-md bg-[#1e1f22] py-1.5 pl-9 pr-3 text-sm text-[#f2f3f5] placeholder-[#4e5058] outline-none focus:ring-1 focus:ring-[#5865f2]"
			/>
		</div>
	</div>

	<!-- Tag Filter Chips -->
	{#if allTags.length > 0}
		<div class="flex flex-wrap gap-1.5 border-b border-[#1e1f22] px-4 py-2">
			{#if selectedTag}
				<button
					onclick={() => (selectedTag = null)}
					class="rounded-full bg-[#5865f2] px-2.5 py-0.5 text-xs font-medium text-white transition-colors hover:bg-[#4752c4]"
				>
					All
				</button>
			{/if}
			{#each allTags as tag}
				<button
					onclick={() => (selectedTag = selectedTag === tag ? null : tag)}
					class="rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors {selectedTag === tag
						? 'bg-[#5865f2] text-white'
						: 'bg-[#313338] text-[#b5bac1] hover:bg-[#383a40] hover:text-[#f2f3f5]'}"
				>
					{tag}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Memo List -->
	<div class="flex-1 overflow-y-auto">
		{#if displayedMemos.length === 0}
			<div class="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
				<svg class="h-10 w-10 text-[#4e5058]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
				</svg>
				<p class="text-sm text-[#b5bac1]">
					{searchQuery ? 'No memos found' : 'No voice memos yet'}
				</p>
				{#if !searchQuery}
					<p class="text-xs text-[#4e5058]">Click the record button to get started</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-1 p-2">
				{#each displayedMemos as memo (memo.id)}
					<div
						class="group rounded-lg bg-[#313338] transition-colors hover:bg-[#383a40]"
					>
						<!-- Memo Header Row -->
						<div class="flex items-center gap-3 px-3 py-2.5">
							<!-- Play Button -->
							<button
								onclick={() => togglePlay(memo.id)}
								class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-white transition-colors hover:bg-[#4752c4]"
							>
								{#if playingMemoId === memo.id}
									<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
										<rect x="6" y="4" width="4" height="16" rx="1" />
										<rect x="14" y="4" width="4" height="16" rx="1" />
									</svg>
								{:else}
									<svg class="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M8 5v14l11-7z" />
									</svg>
								{/if}
							</button>

							<!-- Title and Meta -->
							<div
								class="min-w-0 flex-1 cursor-pointer"
								onclick={() => toggleExpand(memo.id)}
								onkeydown={(e) => { if (e.key === 'Enter') toggleExpand(memo.id); }}
								role="button"
								tabindex="0"
							>
								{#if editingTitleId === memo.id}
									<input
										type="text"
										bind:value={editTitleValue}
										onkeydown={(e) => {
											if (e.key === 'Enter') saveTitle();
											if (e.key === 'Escape') cancelEditTitle();
										}}
										onblur={saveTitle}
										class="w-full rounded bg-[#1e1f22] px-2 py-0.5 text-sm text-[#f2f3f5] outline-none focus:ring-1 focus:ring-[#5865f2]"
										onclick={(e) => e.stopPropagation()}
									/>
								{:else}
									<p class="truncate text-sm font-medium text-[#f2f3f5]">{memo.title}</p>
								{/if}
								<div class="flex items-center gap-2 text-xs text-[#b5bac1]">
									<span>{formatDuration(memo.duration_ms)}</span>
									<span class="text-[#4e5058]">-</span>
									<span>{formatDate(memo.created_at)}</span>
								</div>
							</div>

							<!-- Waveform Mini -->
							{#if memo.waveform_data.length > 0 && !compact}
								<div class="hidden items-end gap-px sm:flex" style="height: 24px;">
									{#each memo.waveform_data.slice(0, 20) as level}
										<div
											class="w-0.5 rounded-full bg-[#5865f2] opacity-60"
											style="height: {Math.max(2, level * 24)}px"
										></div>
									{/each}
								</div>
							{/if}

							<!-- Favorite Star -->
							<button
								onclick={() => handleToggleFavorite(memo.id)}
								class="flex-shrink-0 transition-colors {memo.is_favorite
									? 'text-[#f0b232]'
									: 'text-[#4e5058] hover:text-[#f0b232]'}"
								title={memo.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
							>
								<svg class="h-4 w-4" fill={memo.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
								</svg>
							</button>

							<!-- Actions (visible on hover) -->
							<div class="hidden flex-shrink-0 items-center gap-1 group-hover:flex">
								<!-- Edit Title -->
								<button
									onclick={() => startEditTitle(memo)}
									class="rounded p-1 text-[#b5bac1] transition-colors hover:bg-[#1e1f22] hover:text-[#f2f3f5]"
									title="Edit title"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
								</button>

								<!-- Delete -->
								<button
									onclick={() => handleDelete(memo.id)}
									class="rounded p-1 transition-colors {confirmDeleteId === memo.id
										? 'text-[#ed4245] bg-[#ed4245]/10'
										: 'text-[#b5bac1] hover:bg-[#1e1f22] hover:text-[#ed4245]'}"
									title={confirmDeleteId === memo.id ? 'Click again to confirm' : 'Delete memo'}
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
								</button>
							</div>
						</div>

						<!-- Expanded Content -->
						{#if expandedMemoId === memo.id}
							<div class="border-t border-[#1e1f22] px-3 py-2.5">
								<!-- Full Waveform -->
								{#if memo.waveform_data.length > 0}
									<div class="mb-2">
										<p class="mb-1 text-xs font-medium text-[#b5bac1]">Waveform</p>
										<div class="flex items-end gap-px rounded bg-[#1e1f22] p-2" style="height: 48px;">
											{#each memo.waveform_data as level}
												<div
													class="flex-1 rounded-full bg-[#5865f2]"
													style="height: {Math.max(2, level * 40)}px"
												></div>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Transcript -->
								{#if memo.transcript}
									<div class="mb-2">
										<p class="mb-1 text-xs font-medium text-[#b5bac1]">Transcript</p>
										<p class="rounded bg-[#1e1f22] p-2 text-xs leading-relaxed text-[#f2f3f5]">
											{memo.transcript}
										</p>
									</div>
								{/if}

								<!-- Tags -->
								{#if memo.tags.length > 0}
									<div class="mb-2">
										<p class="mb-1 text-xs font-medium text-[#b5bac1]">Tags</p>
										<div class="flex flex-wrap gap-1">
											{#each memo.tags as tag}
												<span class="rounded-full bg-[#5865f2]/20 px-2 py-0.5 text-xs text-[#5865f2]">
													{tag}
												</span>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Channel Info -->
								{#if memo.channel_id}
									<div>
										<p class="mb-1 text-xs font-medium text-[#b5bac1]">Channel</p>
										<span class="rounded bg-[#1e1f22] px-2 py-0.5 text-xs text-[#f2f3f5]">
											#{memo.channel_id}
										</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Stats Footer -->
	<div class="flex items-center justify-between border-t border-[#1e1f22] px-4 py-2 text-xs text-[#b5bac1]">
		<span>{stats.total_count} memo{stats.total_count !== 1 ? 's' : ''}</span>
		<span>{formatTotalDuration(stats.total_duration_ms)} total</span>
		<span class="flex items-center gap-1">
			<svg class="h-3 w-3 text-[#f0b232]" fill="currentColor" viewBox="0 0 24 24">
				<path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
			</svg>
			{stats.favorites_count}
		</span>
	</div>
</div>
