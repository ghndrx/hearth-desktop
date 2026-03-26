<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly, fade, slide } from 'svelte/transition';
	import { quintOut, cubicOut } from 'svelte/easing';
	import {
		transcriptionState,
		visibleTranscriptionEntries,
		transcriptionActions,
		type TranscriptionEntry
	} from '$lib/stores/voice';
	import { getVoiceConnectionManager } from '$lib/voice';
	import { getSpeakerColor } from '$lib/transcription';

	export let maxHeight: string = '320px';

	// Panel state
	let isEnabled = false;
	let isReady = false;
	let isInitializing = false;
	let entries: TranscriptionEntry[] = [];
	let error: string | null = null;
	let isCollapsed = false;
	let showSettings = false;

	// Dragging state
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let panelX = 24;
	let panelY = 80;
	let initialX = 0;
	let initialY = 0;

	// Settings state
	let selectedModel = 'tiny';
	let selectedLanguage = 'auto';
	let showTimestamps = true;
	let showConfidence = true;
	let showSpeakerLabels = true;

	// Auto-scroll
	let captionsContainer: HTMLDivElement;
	let shouldAutoScroll = true;
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

	// Available models
	const models = [
		{ id: 'Xenova/whisper-tiny', name: 'Tiny (fastest)', description: '~1GB RAM' },
		{ id: 'Xenova/whisper-base', name: 'Base (balanced)', description: '~1GB RAM' },
		{ id: 'Xenova/whisper-small', name: 'Small (accurate)', description: '~2GB RAM' },
	];

	// Available languages
	const languages = [
		{ code: 'auto', name: 'Auto-detect' },
		{ code: 'en', name: 'English' },
		{ code: 'es', name: 'Spanish' },
		{ code: 'fr', name: 'French' },
		{ code: 'de', name: 'German' },
		{ code: 'it', name: 'Italian' },
		{ code: 'pt', name: 'Portuguese' },
		{ code: 'ru', name: 'Russian' },
		{ code: 'ja', name: 'Japanese' },
		{ code: 'ko', name: 'Korean' },
		{ code: 'zh', name: 'Chinese' },
	];

	// Speaker color map
	let speakerColors = new Map<string, string>();
	let speakerIndex = 0;

	function getColorForSpeaker(userId: string): string {
		if (!speakerColors.has(userId)) {
			speakerColors.set(userId, getSpeakerColor(speakerIndex++));
		}
		return speakerColors.get(userId)!;
	}

	// Subscriptions
	const unsubscribeState = transcriptionState.subscribe(state => {
		isEnabled = state.isEnabled;
		isReady = state.isReady;
		isInitializing = state.isInitializing;
		error = state.error;
		selectedLanguage = state.language;
		showTimestamps = state.settings.showTimestamps;
		showConfidence = state.settings.showConfidence;
	});

	const unsubscribeEntries = visibleTranscriptionEntries.subscribe(newEntries => {
		entries = newEntries.slice(-20); // Keep last 20
		if (shouldAutoScroll && captionsContainer) {
			scrollToBottom();
		}
	});

	function scrollToBottom() {
		if (captionsContainer) {
			setTimeout(() => {
				captionsContainer.scrollTop = captionsContainer.scrollHeight;
			}, 10);
		}
	}

	function handleScroll() {
		if (!captionsContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = captionsContainer;
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
		shouldAutoScroll = isAtBottom;

		if (scrollTimeout) clearTimeout(scrollTimeout);
		if (!isAtBottom) {
			scrollTimeout = setTimeout(() => { shouldAutoScroll = true; }, 3000);
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'text-green-400';
		if (confidence >= 0.6) return 'text-yellow-400';
		if (confidence >= 0.4) return 'text-orange-400';
		return 'text-red-400';
	}

	async function toggleTranscription() {
		if (isEnabled) {
			disableTranscription();
		} else {
			await enableTranscription();
		}
	}

	async function enableTranscription() {
		try {
			const voiceManager = getVoiceConnectionManager();
			await voiceManager.enableTranscription();
		} catch (err) {
			console.error('[VoiceTranscriptionPanel] Failed to enable:', err);
		}
	}

	function disableTranscription() {
		const voiceManager = getVoiceConnectionManager();
		voiceManager.disableTranscription();
	}

	function clearCaptions() {
		transcriptionActions.clearEntries();
		speakerColors.clear();
		speakerIndex = 0;
	}

	function handleModelChange(modelId: string) {
		selectedModel = modelId;
		// Note: model change requires re-initialization
		transcriptionActions.updateSettings({ minConfidence: 0.3 });
	}

	function handleLanguageChange(langCode: string) {
		selectedLanguage = langCode;
		transcriptionActions.setLanguage(langCode);
		if (langCode !== 'auto') {
			transcriptionActions.setAutoDetectLanguage(false);
		} else {
			transcriptionActions.setAutoDetectLanguage(true);
		}
	}

	// Dragging handlers
	function onMouseDown(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('.settings-panel') || (e.target as HTMLElement).closest('button')) return;
		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		initialX = panelX;
		initialY = panelY;
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		panelX = Math.max(0, initialX + dx);
		panelY = Math.max(0, initialY + dy);
	}

	function onMouseUp() {
		isDragging = false;
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	}

	onMount(() => {
		transcriptionActions.init();
		// Load saved settings
		const saved = localStorage.getItem('hearth_transcription_settings');
		if (saved) {
			try {
				const s = JSON.parse(saved);
				if (s.showTimestamps !== undefined) showTimestamps = s.showTimestamps;
				if (s.showConfidence !== undefined) showConfidence = s.showConfidence;
				if (s.showSpeakerLabels !== undefined) showSpeakerLabels = s.showSpeakerLabels;
			} catch { /* ignore */ }
		}
	});

	onDestroy(() => {
		unsubscribeState();
		unsubscribeEntries();
		if (scrollTimeout) clearTimeout(scrollTimeout);
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	});

	$: statusColor = isEnabled && isReady ? 'bg-green-400' : isEnabled ? 'bg-yellow-400 animate-pulse' : 'bg-gray-500';
</script>

<!-- Floating Panel -->
<div
	class="voice-transcription-panel"
	class:dragging={isDragging}
	style="right: {panelX}px; top: {panelY}px;"
	role="region"
	aria-label="Live captions"
>
	<!-- Header / Drag Handle -->
	<div
		class="panel-header"
		onmousedown={onMouseDown}
	>
		<div class="header-left">
			<div class="w-2 h-2 rounded-full {statusColor}"></div>
			<h3 class="text-sm font-semibold text-white">Live Captions</h3>
			{#if isEnabled && !isReady}
				<div class="w-3 h-3 border border-gray-400 border-t-white rounded-full animate-spin"></div>
			{/if}
		</div>

		<div class="header-right">
			<!-- Settings toggle -->
			<button
				class="icon-btn"
				class:active={showSettings}
				onclick={() => showSettings = !showSettings}
				title="Settings"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
				</svg>
			</button>

			<!-- Clear -->
			{#if entries.length > 0}
				<button class="icon-btn" onclick={clearCaptions} title="Clear captions">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
					</svg>
				</button>
			{/if}

			<!-- Toggle / Collapse -->
			<button class="icon-btn" onclick={toggleTranscription} title={isEnabled ? 'Disable' : 'Enable'}>
				{#if isEnabled}
					<svg class="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
					</svg>
				{:else}
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
				{/if}
			</button>

			<!-- Collapse toggle -->
			<button class="icon-btn" onclick={() => isCollapsed = !isCollapsed} title={isCollapsed ? 'Expand' : 'Collapse'}>
				<svg class="w-3.5 h-3.5 transition-transform {isCollapsed ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="settings-panel" transition:slide={{ duration: 200 }}>
			<!-- Model selection -->
			<div class="setting-group">
				<label class="setting-label">Model</label>
				<div class="model-grid">
					{#each models as model}
						<button
							class="model-btn"
							class:selected={selectedModel === model.id}
							onclick={() => handleModelChange(model.id)}
						>
							<span class="model-name">{model.name}</span>
							<span class="model-desc">{model.description}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Language selection -->
			<div class="setting-group">
				<label class="setting-label">Language</label>
				<select
					class="language-select"
					bind:value={selectedLanguage}
					onchange={() => handleLanguageChange(selectedLanguage)}
				>
					{#each languages as lang}
						<option value={lang.code}>{lang.name}</option>
					{/each}
				</select>
			</div>

			<!-- Toggles -->
			<div class="setting-toggles">
				<label class="toggle-row">
					<span>Show timestamps</span>
					<input type="checkbox" bind:checked={showTimestamps} onchange={() => transcriptionActions.updateSettings({ showTimestamps })} />
				</label>
				<label class="toggle-row">
					<span>Show confidence</span>
					<input type="checkbox" bind:checked={showConfidence} onchange={() => transcriptionActions.updateSettings({ showConfidence })} />
				</label>
				<label class="toggle-row">
					<span>Show speaker labels</span>
					<input type="checkbox" bind:checked={showSpeakerLabels} onchange={() => transcriptionActions.updateSettings({ showSpeakerLabels })} />
				</label>
			</div>
		</div>
	{/if}

	<!-- Caption Display Area -->
	{#if !isCollapsed}
		<div
			bind:this={captionsContainer}
			class="captions-container"
			style="max-height: {maxHeight}"
			onscroll={handleScroll}
			role="log"
			aria-live="polite"
			aria-label="Transcription captions"
		>
			{#if !isEnabled}
				<!-- Disabled state -->
				<div class="empty-state">
					<svg class="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
					</svg>
					<p class="text-sm text-gray-400">Click play to start live captions</p>
					<button class="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors" onclick={toggleTranscription}>
						Enable Captions
					</button>
				</div>
			{:else if isInitializing}
				<!-- Loading state -->
				<div class="empty-state">
					<div class="w-6 h-6 border-2 border-gray-400 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
					<p class="text-sm text-gray-400">Loading Whisper model...</p>
				</div>
			{:else if entries.length === 0}
				<!-- Empty / Listening state -->
				<div class="empty-state">
					<div class="voice-wave">
						{#each Array(5) as _, i}
							<div class="wave-bar" style="animation-delay: {i * 100}ms"></div>
						{/each}
					</div>
					<p class="text-sm text-gray-400 mt-2">Listening for speech...</p>
				</div>
			{:else}
				<!-- Caption entries -->
				<div class="captions-list">
					{#each entries as entry (entry.id)}
						{@const color = getColorForSpeaker(entry.userId)}
						<div
							class="caption-entry"
							in:fly={{ y: 12, duration: 200, easing: cubicOut }}
						>
							{#if showSpeakerLabels}
								<div class="speaker-info">
									<!-- Avatar placeholder -->
									<div class="speaker-avatar" style="background-color: {color}">
										{entry.username?.charAt(0)?.toUpperCase() || '?'}
									</div>
									<div class="speaker-details">
										<span class="speaker-name" style="color: {color}">{entry.username || 'Unknown'}</span>
										{#if showTimestamps}
											<span class="timestamp">{formatTimestamp(entry.timestamp)}</span>
										{/if}
									</div>
									{#if showConfidence}
										<span class="confidence {getConfidenceColor(entry.confidence)}">
											{Math.round(entry.confidence * 100)}%
										</span>
									{/if}
								</div>
							{/if}
							<p class="caption-text {entry.isFinal ? '' : 'italic opacity-70'}">
								{entry.text}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Auto-scroll indicator -->
		{#if !shouldAutoScroll && entries.length > 0}
			<button
				class="scroll-bottom-btn"
				onclick={() => { shouldAutoScroll = true; scrollToBottom(); }}
				transition:fade={{ duration: 150 }}
				title="Scroll to latest"
			>
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
				</svg>
			</button>
		{/if}
	{/if}
</div>

<style>
	.voice-transcription-panel {
		position: fixed;
		z-index: 9999;
		width: 380px;
		background: rgba(24, 25, 28, 0.97);
		border: 1px solid rgba(79, 84, 92, 0.4);
		border-radius: 8px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		overflow: visible;
		backdrop-filter: blur(12px);
		transition: box-shadow 0.2s ease;
	}

	.voice-transcription-panel.dragging {
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
		cursor: grabbing;
		user-select: none;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: rgba(32, 34, 37, 0.8);
		border-bottom: 1px solid rgba(79, 84, 92, 0.2);
		border-radius: 8px 8px 0 0;
		cursor: grab;
		user-select: none;
	}

	.panel-header:active {
		cursor: grabbing;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: rgba(185, 187, 190, 0.8);
		cursor: pointer;
		transition: background-color 0.1s ease, color 0.1s ease;
	}

	.icon-btn:hover {
		background: rgba(79, 84, 92, 0.4);
		color: #dbdee1;
	}

	.icon-btn.active {
		color: #5865f2;
		background: rgba(88, 101, 242, 0.15);
	}

	.settings-panel {
		padding: 12px;
		background: rgba(32, 34, 37, 0.6);
		border-bottom: 1px solid rgba(79, 84, 92, 0.2);
	}

	.setting-group {
		margin-bottom: 12px;
	}

	.setting-group:last-child {
		margin-bottom: 0;
	}

	.setting-label {
		display: block;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #949ba4;
		margin-bottom: 6px;
	}

	.model-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
	}

	.model-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 6px 4px;
		background: rgba(79, 84, 92, 0.2);
		border: 1px solid rgba(79, 84, 92, 0.3);
		border-radius: 4px;
		color: #b5bac1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.model-btn:hover {
		background: rgba(79, 84, 92, 0.4);
		border-color: rgba(79, 84, 92, 0.5);
	}

	.model-btn.selected {
		background: rgba(88, 101, 242, 0.2);
		border-color: #5865f2;
		color: #dbdee1;
	}

	.model-name {
		font-size: 11px;
		font-weight: 500;
	}

	.model-desc {
		font-size: 9px;
		color: #6d6f78;
		margin-top: 2px;
	}

	.language-select {
		width: 100%;
		padding: 6px 8px;
		background: rgba(32, 34, 37, 0.8);
		border: 1px solid rgba(79, 84, 92, 0.4);
		border-radius: 4px;
		color: #dbdee1;
		font-size: 13px;
		cursor: pointer;
		outline: none;
	}

	.language-select:focus {
		border-color: #5865f2;
	}

	.setting-toggles {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 12px;
		color: #b5bac1;
		cursor: pointer;
	}

	.toggle-row input[type="checkbox"] {
		width: 16px;
		height: 16px;
		accent-color: #5865f2;
		cursor: pointer;
	}

	.captions-container {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(79, 84, 92, 0.5) transparent;
	}

	.captions-container::-webkit-scrollbar {
		width: 4px;
	}

	.captions-container::-webkit-scrollbar-thumb {
		background: rgba(79, 84, 92, 0.5);
		border-radius: 2px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		color: #949ba4;
	}

	.voice-wave {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 20px;
	}

	.wave-bar {
		width: 3px;
		height: 100%;
		background: #5865f2;
		border-radius: 2px;
		animation: wave 0.8s ease-in-out infinite;
	}

	@keyframes wave {
		0%, 100% { transform: scaleY(0.3); }
		50% { transform: scaleY(1); }
	}

	.captions-list {
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.caption-entry {
		padding: 8px 10px;
		background: rgba(32, 34, 37, 0.6);
		border-radius: 6px;
		border-left: 3px solid transparent;
	}

	.speaker-info {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.speaker-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		font-weight: 700;
		color: white;
		flex-shrink: 0;
	}

	.speaker-details {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.speaker-name {
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.timestamp {
		font-size: 10px;
		color: #6d6f78;
		white-space: nowrap;
	}

	.confidence {
		font-size: 10px;
		font-weight: 500;
		flex-shrink: 0;
	}

	.caption-text {
		font-size: 13px;
		line-height: 1.5;
		color: #dbdee1;
		margin: 0;
		word-wrap: break-word;
	}

	.scroll-bottom-btn {
		position: absolute;
		bottom: 10px;
		right: 10px;
		width: 24px;
		height: 24px;
		padding: 0;
		background: #5865f2;
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
		transition: background-color 0.15s ease;
	}

	.scroll-bottom-btn:hover {
		background: #4752c4;
	}
</style>
