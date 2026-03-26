<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { transcriptionStore, isTranscriptionActive } from '$lib/stores/transcription';
	import { user as authUser } from '$lib/stores/auth';
	import { SUPPORTED_LANGUAGES, type TranscriptSegment } from '$lib/transcription';

	export let open = false;
	export let onClose: () => void = () => {};

	let scrollContainer: HTMLDivElement;
	let autoScroll = true;
	let searchQuery = '';
	let showSettings = false;

	// Filtered segments based on search
	$: filteredSegments = searchQuery
		? $transcriptionStore.segments.filter(s =>
			s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
			s.speakerName.toLowerCase().includes(searchQuery.toLowerCase())
		)
		: $transcriptionStore.segments;

	// Auto-scroll to bottom when new segments arrive
	$: if (filteredSegments.length && autoScroll && scrollContainer) {
		tick().then(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		});
	}

	function handleScroll() {
		if (!scrollContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		// If user scrolled up more than 50px from bottom, disable auto-scroll
		autoScroll = scrollHeight - scrollTop - clientHeight < 50;
	}

	function scrollToBottom() {
		autoScroll = true;
		if (scrollContainer) {
			scrollContainer.scrollTop = scrollContainer.scrollHeight;
		}
	}

	function handleToggleTranscription() {
		if ($transcriptionStore.enabled) {
			transcriptionStore.setEnabled(false);
		} else {
			transcriptionStore.setEnabled(true);
		}
	}

	function handleLanguageChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		transcriptionStore.setLanguage(select.value);
	}

	function handleModelChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		transcriptionStore.setModel(select.value);
	}

	function handleClearTranscript() {
		transcriptionStore.clearSegments();
	}

	function handleExportTranscript() {
		const text = $transcriptionStore.segments
			.map(s => {
				const time = new Date(s.timestamp).toLocaleTimeString();
				return `[${time}] ${s.speakerName}: ${s.text}`;
			})
			.join('\n');

		const blob = new Blob([text], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function getSpeakerLabel(segment: TranscriptSegment): string {
		if ($authUser && segment.speakerId === $authUser.id) {
			return 'You';
		}
		return segment.speakerName || 'Unknown';
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

{#if open}
	<div class="transcript-panel" transition:fly={{ x: 300, duration: 200 }}>
		<!-- Header -->
		<div class="panel-header">
			<div class="header-title">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="header-icon">
					<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
					<path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
				</svg>
				<span>Live Transcript</span>
				{#if $isTranscriptionActive}
					<span class="live-badge">LIVE</span>
				{/if}
			</div>
			<div class="header-actions">
				<button
					class="icon-btn"
					on:click={() => showSettings = !showSettings}
					title="Settings"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
					</svg>
				</button>
				<button class="icon-btn" on:click={handleClose} title="Close">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Settings Panel -->
		{#if showSettings}
			<div class="settings-section">
				<div class="setting-row">
					<label for="lang-select">Language</label>
					<select id="lang-select" value={$transcriptionStore.language} on:change={handleLanguageChange}>
						{#each SUPPORTED_LANGUAGES as lang}
							<option value={lang.code}>{lang.name}</option>
						{/each}
					</select>
				</div>
				<div class="setting-row">
					<label for="model-select">Model</label>
					<select id="model-select" value={$transcriptionStore.model} on:change={handleModelChange}>
						<option value="tiny">Tiny (~75 MB)</option>
						<option value="base">Base (~145 MB)</option>
						<option value="small">Small (~484 MB)</option>
						<option value="medium">Medium (~1.5 GB)</option>
					</select>
				</div>
			</div>
		{/if}

		<!-- Toggle + Search Bar -->
		<div class="toolbar">
			<button
				class="toggle-btn"
				class:active={$transcriptionStore.enabled}
				on:click={handleToggleTranscription}
				title={$transcriptionStore.enabled ? 'Disable transcription' : 'Enable transcription'}
			>
				{#if $transcriptionStore.isModelLoading || $transcriptionStore.isDownloading}
					<span class="spinner"></span>
				{:else}
					<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
						<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
					</svg>
				{/if}
				<span>{$transcriptionStore.enabled ? 'On' : 'Off'}</span>
			</button>
			<div class="search-bar">
				<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="search-icon">
					<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
				</svg>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search transcript..."
				/>
			</div>
		</div>

		<!-- Error Banner -->
		{#if $transcriptionStore.error}
			<div class="error-banner">
				<span>{$transcriptionStore.error}</span>
				<button on:click={() => transcriptionStore.setError(null)}>Dismiss</button>
			</div>
		{/if}

		<!-- Download Progress -->
		{#if $transcriptionStore.isDownloading}
			<div class="download-progress">
				<span>Downloading model...</span>
				<div class="progress-bar">
					<div class="progress-fill" style="width: {$transcriptionStore.downloadProgress}%"></div>
				</div>
			</div>
		{/if}

		<!-- Transcript Content -->
		<div
			class="transcript-content"
			bind:this={scrollContainer}
			on:scroll={handleScroll}
		>
			{#if filteredSegments.length === 0}
				<div class="empty-state">
					{#if !$transcriptionStore.enabled}
						<svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" class="empty-icon">
							<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
							<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
						</svg>
						<p>Enable transcription to see live captions</p>
					{:else if searchQuery}
						<p>No results for "{searchQuery}"</p>
					{:else}
						<p>Listening for speech...</p>
					{/if}
				</div>
			{:else}
				{#each filteredSegments as segment (segment.id)}
					<div class="transcript-entry">
						<div class="entry-header">
							<span class="speaker-name" class:is-self={$authUser && segment.speakerId === $authUser.id}>
								{getSpeakerLabel(segment)}
							</span>
							<span class="entry-time">{formatTime(segment.timestamp)}</span>
							{#if segment.language && segment.language !== 'en'}
								<span class="lang-badge">{segment.language}</span>
							{/if}
						</div>
						<p class="entry-text">{segment.text}</p>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Footer -->
		<div class="panel-footer">
			{#if !autoScroll && filteredSegments.length > 0}
				<button class="scroll-btn" on:click={scrollToBottom}>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
						<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
					</svg>
					New messages below
				</button>
			{/if}
			<div class="footer-actions">
				<button class="text-btn" on:click={handleExportTranscript} title="Export transcript" disabled={filteredSegments.length === 0}>
					Export
				</button>
				<button class="text-btn" on:click={handleClearTranscript} title="Clear transcript" disabled={filteredSegments.length === 0}>
					Clear
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.transcript-panel {
		position: fixed;
		right: 0;
		top: 0;
		bottom: 0;
		width: 340px;
		background: #2b2d31;
		border-left: 1px solid #1e1f22;
		display: flex;
		flex-direction: column;
		z-index: 100;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #1e1f22;
		background: #232428;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		color: #f2f3f5;
	}

	.header-icon {
		color: #b5bac1;
	}

	.live-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 3px;
		background: #f23f43;
		color: white;
		letter-spacing: 0.5px;
		animation: pulse-badge 2s infinite;
	}

	@keyframes pulse-badge {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background: rgba(79, 84, 92, 0.32);
		color: #f2f3f5;
	}

	.settings-section {
		padding: 8px 16px;
		border-bottom: 1px solid #1e1f22;
		background: #232428;
	}

	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 0;
	}

	.setting-row label {
		font-size: 12px;
		color: #b5bac1;
	}

	.setting-row select {
		background: #1e1f22;
		border: 1px solid #3f4147;
		border-radius: 4px;
		color: #f2f3f5;
		padding: 4px 8px;
		font-size: 12px;
		cursor: pointer;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid #1e1f22;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		background: #3f4147;
		color: #b5bac1;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.toggle-btn.active {
		background: #23a559;
		color: white;
	}

	.toggle-btn:hover {
		opacity: 0.9;
	}

	.spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.search-bar {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		background: #1e1f22;
		border-radius: 4px;
		padding: 4px 8px;
	}

	.search-icon {
		color: #6d6f78;
		flex-shrink: 0;
	}

	.search-bar input {
		flex: 1;
		background: none;
		border: none;
		color: #f2f3f5;
		font-size: 12px;
		outline: none;
	}

	.search-bar input::placeholder {
		color: #6d6f78;
	}

	.error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: rgba(242, 63, 67, 0.15);
		color: #f23f43;
		font-size: 12px;
	}

	.error-banner button {
		background: none;
		border: none;
		color: #f23f43;
		cursor: pointer;
		font-size: 11px;
		text-decoration: underline;
	}

	.download-progress {
		padding: 8px 12px;
		font-size: 12px;
		color: #b5bac1;
	}

	.progress-bar {
		margin-top: 4px;
		height: 4px;
		background: #1e1f22;
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #5865f2;
		border-radius: 2px;
		transition: width 0.3s;
	}

	.transcript-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 12px;
		scroll-behavior: smooth;
	}

	.transcript-content::-webkit-scrollbar {
		width: 6px;
	}

	.transcript-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.transcript-content::-webkit-scrollbar-thumb {
		background: #1e1f22;
		border-radius: 3px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		color: #6d6f78;
		text-align: center;
		padding: 24px;
	}

	.empty-icon {
		color: #4f545c;
	}

	.empty-state p {
		font-size: 13px;
		margin: 0;
	}

	.transcript-entry {
		padding: 6px 0;
		border-bottom: 1px solid rgba(79, 84, 92, 0.12);
	}

	.transcript-entry:last-child {
		border-bottom: none;
	}

	.entry-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 2px;
	}

	.speaker-name {
		font-size: 12px;
		font-weight: 600;
		color: #b5bac1;
	}

	.speaker-name.is-self {
		color: #23a559;
	}

	.entry-time {
		font-size: 10px;
		color: #6d6f78;
	}

	.lang-badge {
		font-size: 9px;
		padding: 1px 4px;
		border-radius: 2px;
		background: rgba(88, 101, 242, 0.2);
		color: #8b9dff;
		text-transform: uppercase;
	}

	.entry-text {
		font-size: 13px;
		color: #dbdee1;
		line-height: 1.4;
		margin: 0;
		word-wrap: break-word;
	}

	.panel-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-top: 1px solid #1e1f22;
		background: #232428;
		min-height: 36px;
	}

	.scroll-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: #5865f2;
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 11px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.scroll-btn:hover {
		background: #4752c4;
	}

	.footer-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}

	.text-btn {
		background: none;
		border: none;
		color: #b5bac1;
		font-size: 11px;
		cursor: pointer;
		padding: 2px 4px;
		transition: color 0.15s;
	}

	.text-btn:hover:not(:disabled) {
		color: #f2f3f5;
	}

	.text-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
