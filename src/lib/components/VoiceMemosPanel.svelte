<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';

	interface VoiceMemo {
		id: string;
		title: string;
		filePath: string;
		durationMs: number;
		fileSize: number;
		channelId: string | null;
		transcript: string | null;
		tags: string[];
		createdAt: number;
		isFavorite: boolean;
		waveformData: number[];
	}

	interface VoiceMemoState {
		isRecording: boolean;
		currentMemoId: string | null;
		recordingStartTime: number | null;
		audioLevel: number;
	}

	interface VoiceMemoStats {
		totalCount: number;
		totalDurationMs: number;
		favoritesCount: number;
	}

	let memos = $state<VoiceMemo[]>([]);
	let recordingState = $state<VoiceMemoState>({
		isRecording: false,
		currentMemoId: null,
		recordingStartTime: null,
		audioLevel: 0
	});
	let stats = $state<VoiceMemoStats>({ totalCount: 0, totalDurationMs: 0, favoritesCount: 0 });
	let searchQuery = $state('');
	let filter = $state<'all' | 'favorites'>('all');
	let error = $state<string | null>(null);
	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let recordingElapsed = $state(0);
	let recordingTimer: ReturnType<typeof setInterval> | null = null;

	let unlisteners: (() => void)[] = [];

	let filteredMemos = $derived.by(() => {
		let list = memos;
		if (filter === 'favorites') {
			list = list.filter((m) => m.isFavorite);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(m) =>
					m.title.toLowerCase().includes(q) ||
					m.tags.some((t) => t.toLowerCase().includes(q)) ||
					(m.transcript && m.transcript.toLowerCase().includes(q))
			);
		}
		return list;
	});

	onMount(async () => {
		await loadData();

		const u1 = await listen<VoiceMemo>('memo:saved', () => loadData());
		const u2 = await listen<string>('memo:deleted', () => loadData());
		const u3 = await listen<VoiceMemoState>('memo:recording-started', (e) => {
			recordingState = e.payload;
			startRecordingTimer();
		});
		const u4 = await listen('memo:recording-stopped', () => {
			recordingState = {
				isRecording: false,
				currentMemoId: null,
				recordingStartTime: null,
				audioLevel: 0
			};
			stopRecordingTimer();
			loadData();
		});
		unlisteners = [u1, u2, u3, u4];
	});

	onDestroy(() => {
		unlisteners.forEach((u) => u());
		stopRecordingTimer();
	});

	async function loadData() {
		try {
			if (searchQuery.trim()) {
				memos = await invoke<VoiceMemo[]>('memo_search', { query: searchQuery });
			} else {
				memos = await invoke<VoiceMemo[]>('memo_get_all');
			}
			stats = await invoke<VoiceMemoStats>('memo_get_stats');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function startRecording() {
		try {
			recordingState = await invoke<VoiceMemoState>('memo_start_recording');
			startRecordingTimer();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function stopRecording() {
		try {
			await invoke<VoiceMemo>('memo_stop_recording', {
				data: {
					title: `Memo ${new Date().toLocaleString()}`,
					filePath: '',
					durationMs: recordingElapsed,
					fileSize: 0,
					channelId: null,
					tags: null,
					waveformData: null
				}
			});
			stopRecordingTimer();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function cancelRecording() {
		try {
			await invoke('memo_cancel_recording');
			stopRecordingTimer();
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	function startRecordingTimer() {
		recordingElapsed = 0;
		recordingTimer = setInterval(() => {
			recordingElapsed += 100;
		}, 100);
	}

	function stopRecordingTimer() {
		if (recordingTimer) {
			clearInterval(recordingTimer);
			recordingTimer = null;
		}
		recordingElapsed = 0;
	}

	async function deleteMemo(id: string) {
		try {
			await invoke('memo_delete', { id });
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleFavorite(id: string) {
		try {
			await invoke('memo_toggle_favorite', { id });
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	function startEditing(memo: VoiceMemo) {
		editingId = memo.id;
		editTitle = memo.title;
	}

	async function saveTitle() {
		if (!editingId) return;
		try {
			await invoke('memo_update_title', { id: editingId, title: editTitle });
			editingId = null;
			await loadData();
		} catch (e) {
			error = String(e);
		}
	}

	function formatDuration(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const min = Math.floor(totalSec / 60);
		const sec = totalSec % 60;
		return `${min}:${sec.toString().padStart(2, '0')}`;
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') loadData();
	}
</script>

<div class="voice-memos-panel">
	<div class="panel-header">
		<h3>Voice Memos</h3>
		<div class="stats">
			<span>{stats.totalCount} memos</span>
			<span class="dot">·</span>
			<span>{formatDuration(stats.totalDurationMs)} total</span>
		</div>
	</div>

	{#if recordingState.isRecording}
		<div class="recording-bar">
			<span class="rec-dot"></span>
			<span class="rec-time">{formatDuration(recordingElapsed)}</span>
			<div class="rec-actions">
				<button class="rec-btn stop" onclick={stopRecording}>Stop</button>
				<button class="rec-btn cancel" onclick={cancelRecording}>Cancel</button>
			</div>
		</div>
	{:else}
		<button class="record-btn" onclick={startRecording}>
			<span class="record-icon"></span>
			Record Memo
		</button>
	{/if}

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="controls">
		<input
			type="text"
			class="search-input"
			placeholder="Search memos..."
			bind:value={searchQuery}
			oninput={() => loadData()}
			onkeydown={handleSearchKeydown}
		/>
		<div class="filter-btns">
			<button class="filter-btn" class:active={filter === 'all'} onclick={() => (filter = 'all')}
				>All</button
			>
			<button
				class="filter-btn"
				class:active={filter === 'favorites'}
				onclick={() => (filter = 'favorites')}>Favorites ({stats.favoritesCount})</button
			>
		</div>
	</div>

	<div class="memo-list">
		{#each filteredMemos as memo (memo.id)}
			<div class="memo-item" class:favorite={memo.isFavorite}>
				<div class="memo-header">
					{#if editingId === memo.id}
						<input
							type="text"
							class="edit-title"
							bind:value={editTitle}
							onkeydown={(e) => {
								if (e.key === 'Enter') saveTitle();
								if (e.key === 'Escape') (editingId = null);
							}}
						/>
					{:else}
						<span class="memo-title" ondblclick={() => startEditing(memo)}>{memo.title}</span>
					{/if}
					<div class="memo-actions">
						<button
							class="icon-btn"
							class:fav-active={memo.isFavorite}
							onclick={() => toggleFavorite(memo.id)}
							title={memo.isFavorite ? 'Unfavorite' : 'Favorite'}
						>
							{memo.isFavorite ? '\u2605' : '\u2606'}
						</button>
						<button class="icon-btn delete" onclick={() => deleteMemo(memo.id)} title="Delete">
							\u2715
						</button>
					</div>
				</div>
				<div class="memo-meta">
					<span>{formatDuration(memo.durationMs)}</span>
					{#if memo.fileSize > 0}
						<span class="dot">·</span>
						<span>{formatSize(memo.fileSize)}</span>
					{/if}
					<span class="dot">·</span>
					<span>{formatDate(memo.createdAt)}</span>
				</div>
				{#if memo.tags.length > 0}
					<div class="memo-tags">
						{#each memo.tags as tag}
							<span class="tag">{tag}</span>
						{/each}
					</div>
				{/if}
				{#if memo.transcript}
					<div class="memo-transcript">{memo.transcript}</div>
				{/if}
				{#if memo.waveformData.length > 0}
					<div class="waveform">
						{#each memo.waveformData as level}
							<div class="wave-bar" style="height: {Math.max(2, level * 24)}px"></div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="empty">
				{searchQuery ? 'No memos match your search' : 'No voice memos yet. Hit Record to start!'}
			</div>
		{/each}
	</div>
</div>

<style>
	.voice-memos-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.panel-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}
	.stats {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}
	.dot {
		margin: 0 4px;
	}

	.record-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px;
		border: none;
		border-radius: 8px;
		background: #ed4245;
		color: white;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.record-btn:hover {
		background: #d63a3d;
	}
	.record-icon {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: white;
	}

	.recording-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px;
		border-radius: 8px;
		background: rgba(237, 66, 69, 0.12);
		border: 1px solid rgba(237, 66, 69, 0.3);
	}
	.rec-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #ed4245;
		animation: pulse 1s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
	.rec-time {
		font-family: monospace;
		font-size: 16px;
		font-weight: 600;
		flex: 1;
	}
	.rec-actions {
		display: flex;
		gap: 6px;
	}
	.rec-btn {
		padding: 6px 14px;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.rec-btn.stop {
		background: #ed4245;
		color: white;
	}
	.rec-btn.cancel {
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
	}

	.error {
		font-size: 12px;
		color: #ed4245;
		padding: 8px;
		border-radius: 6px;
		background: rgba(237, 66, 69, 0.1);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.search-input {
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		box-sizing: border-box;
		outline: none;
	}
	.search-input:focus {
		border-color: #5865f2;
	}
	.search-input::placeholder {
		color: var(--text-muted, #6d6f78);
	}
	.filter-btns {
		display: flex;
		gap: 4px;
	}
	.filter-btn {
		padding: 4px 10px;
		border: none;
		border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-secondary, #949ba4);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}
	.filter-btn.active {
		background: #5865f2;
		color: white;
	}

	.memo-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 400px;
		overflow-y: auto;
	}
	.memo-item {
		padding: 10px 12px;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-left: 3px solid transparent;
	}
	.memo-item.favorite {
		border-left-color: #faa61a;
	}

	.memo-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.memo-title {
		font-size: 13px;
		font-weight: 600;
		flex: 1;
		cursor: default;
	}
	.edit-title {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid #5865f2;
		border-radius: 4px;
		background: var(--bg-secondary, #2b2d31);
		color: var(--text-primary, #dbdee1);
		font-size: 13px;
		outline: none;
	}
	.memo-actions {
		display: flex;
		gap: 4px;
	}
	.icon-btn {
		background: transparent;
		border: none;
		color: var(--text-muted, #6d6f78);
		cursor: pointer;
		font-size: 14px;
		padding: 2px 4px;
		border-radius: 4px;
	}
	.icon-btn:hover {
		color: var(--text-primary, #dbdee1);
		background: var(--bg-secondary, #2b2d31);
	}
	.icon-btn.fav-active {
		color: #faa61a;
	}
	.icon-btn.delete:hover {
		color: #ed4245;
	}

	.memo-meta {
		font-size: 11px;
		color: var(--text-muted, #6d6f78);
	}

	.memo-tags {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.tag {
		padding: 2px 8px;
		border-radius: 10px;
		background: rgba(88, 101, 242, 0.15);
		color: #7983f5;
		font-size: 10px;
	}

	.memo-transcript {
		font-size: 12px;
		color: var(--text-secondary, #949ba4);
		font-style: italic;
		line-height: 1.4;
		max-height: 40px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.waveform {
		display: flex;
		align-items: flex-end;
		gap: 1px;
		height: 24px;
	}
	.wave-bar {
		width: 3px;
		background: #5865f2;
		border-radius: 1px;
		min-height: 2px;
	}

	.empty {
		text-align: center;
		padding: 24px;
		color: var(--text-muted, #6d6f78);
		font-size: 13px;
	}
</style>
