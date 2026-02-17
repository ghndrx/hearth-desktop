<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export let src: string;
	export let type: 'video' | 'audio';
	export let filename: string;
	export let contentType: string;
	export let poster: string | undefined = undefined;

	let mediaElement: HTMLVideoElement | HTMLAudioElement;
	let container: HTMLDivElement;
	let isPlaying = false;
	let isMuted = false;
	let isFullscreen = false;
	let currentTime = 0;
	let duration = 0;
	let volume = 1;
	let showControls = true;
	let controlsTimeout: ReturnType<typeof setTimeout>;
	let isLoading = true;
	let hasError = false;

	function formatTime(seconds: number): string {
		if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function togglePlay() {
		if (!mediaElement) return;
		
		if (mediaElement.paused) {
			mediaElement.play();
		} else {
			mediaElement.pause();
		}
	}

	function toggleMute() {
		if (!mediaElement) return;
		mediaElement.muted = !mediaElement.muted;
		isMuted = mediaElement.muted;
	}

	function setVolume(e: Event) {
		const target = e.target as HTMLInputElement;
		volume = parseFloat(target.value);
		if (mediaElement) {
			mediaElement.volume = volume;
			isMuted = volume === 0;
		}
	}

	function seek(e: Event) {
		const target = e.target as HTMLInputElement;
		if (mediaElement && duration) {
			mediaElement.currentTime = (parseFloat(target.value) / 100) * duration;
		}
	}

	function toggleFullscreen() {
		if (!container || type !== 'video') return;
		
		if (!document.fullscreenElement) {
			container.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}

	function handleFullscreenChange() {
		isFullscreen = !!document.fullscreenElement;
	}

	function handleMouseMove() {
		showControls = true;
		clearTimeout(controlsTimeout);
		
		if (isPlaying && type === 'video') {
			controlsTimeout = setTimeout(() => {
				showControls = false;
			}, 3000);
		}
	}

	function handleTimeUpdate() {
		if (mediaElement) {
			currentTime = mediaElement.currentTime;
		}
	}

	function handleLoadedMetadata() {
		if (mediaElement) {
			duration = mediaElement.duration;
			isLoading = false;
		}
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
		showControls = true;
		clearTimeout(controlsTimeout);
	}

	function handleError() {
		hasError = true;
		isLoading = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case ' ':
			case 'k':
				e.preventDefault();
				togglePlay();
				break;
			case 'm':
				e.preventDefault();
				toggleMute();
				break;
			case 'f':
				if (type === 'video') {
					e.preventDefault();
					toggleFullscreen();
				}
				break;
			case 'ArrowLeft':
				e.preventDefault();
				if (mediaElement) mediaElement.currentTime -= 5;
				break;
			case 'ArrowRight':
				e.preventDefault();
				if (mediaElement) mediaElement.currentTime += 5;
				break;
			case 'ArrowUp':
				e.preventDefault();
				volume = Math.min(1, volume + 0.1);
				if (mediaElement) mediaElement.volume = volume;
				break;
			case 'ArrowDown':
				e.preventDefault();
				volume = Math.max(0, volume - 0.1);
				if (mediaElement) mediaElement.volume = volume;
				break;
		}
	}

	onMount(() => {
		document.addEventListener('fullscreenchange', handleFullscreenChange);
	});

	onDestroy(() => {
		clearTimeout(controlsTimeout);
		document.removeEventListener('fullscreenchange', handleFullscreenChange);
	});

	$: progress = duration > 0 ? (currentTime / duration) * 100 : 0;
</script>

<div
	bind:this={container}
	class="media-player"
	class:video-player={type === 'video'}
	class:audio-player={type === 'audio'}
	class:fullscreen={isFullscreen}
	on:mousemove={handleMouseMove}
	on:mouseleave={() => isPlaying && type === 'video' && (showControls = false)}
	on:keydown={handleKeydown}
	role="application"
	aria-label="{type === 'video' ? 'Video' : 'Audio'} player: {filename}"
	tabindex="0"
>
	{#if hasError}
		<div class="error-state">
			<svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
				<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
			</svg>
			<p>Unable to load media</p>
			<a href={src} download={filename} class="download-link">Download file</a>
		</div>
	{:else if type === 'video'}
		<video
			bind:this={mediaElement}
			{src}
			{poster}
			preload="metadata"
			playsinline
			on:timeupdate={handleTimeUpdate}
			on:loadedmetadata={handleLoadedMetadata}
			on:play={handlePlay}
			on:pause={handlePause}
			on:error={handleError}
			on:click={togglePlay}
		>
			<track kind="captions" />
		</video>

		{#if isLoading}
			<div class="loading-overlay">
				<div class="spinner"></div>
			</div>
		{/if}

		<div class="controls" class:visible={showControls} class:hidden={!showControls && isPlaying}>
			<!-- Play button overlay -->
			{#if !isPlaying}
				<button class="play-overlay" on:click={togglePlay} aria-label="Play">
					<svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
						<path d="M8 5v14l11-7z"/>
					</svg>
				</button>
			{/if}

			<!-- Bottom controls -->
			<div class="control-bar">
				<button class="control-btn" on:click={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
					{#if isPlaying}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M8 5v14l11-7z"/>
						</svg>
					{/if}
				</button>

				<span class="time">{formatTime(currentTime)}</span>

				<input
					type="range"
					class="progress-slider"
					min="0"
					max="100"
					value={progress}
					on:input={seek}
					aria-label="Seek"
				/>

				<span class="time">{formatTime(duration)}</span>

				<div class="volume-control">
					<button class="control-btn" on:click={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
						{#if isMuted || volume === 0}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
							</svg>
						{:else if volume < 0.5}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
								<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
							</svg>
						{/if}
					</button>
					<input
						type="range"
						class="volume-slider"
						min="0"
						max="1"
						step="0.05"
						value={volume}
						on:input={setVolume}
						aria-label="Volume"
					/>
				</div>

				<button class="control-btn" on:click={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
					{#if isFullscreen}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
							<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	{:else}
		<!-- Audio Player -->
		<audio
			bind:this={mediaElement}
			{src}
			preload="metadata"
			on:timeupdate={handleTimeUpdate}
			on:loadedmetadata={handleLoadedMetadata}
			on:play={handlePlay}
			on:pause={handlePause}
			on:error={handleError}
		>
		</audio>

		<div class="audio-info">
			<div class="audio-icon">
				{#if isPlaying}
					<div class="audio-wave">
						<span></span>
						<span></span>
						<span></span>
						<span></span>
					</div>
				{:else}
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
					</svg>
				{/if}
			</div>
			<div class="audio-details">
				<span class="audio-filename">{filename}</span>
				<span class="audio-duration">{formatTime(currentTime)} / {formatTime(duration)}</span>
			</div>
		</div>

		<div class="audio-controls">
			<button class="control-btn play-btn" on:click={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
				{#if isPlaying}
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
						<path d="M8 5v14l11-7z"/>
					</svg>
				{/if}
			</button>

			<input
				type="range"
				class="progress-slider"
				min="0"
				max="100"
				value={progress}
				on:input={seek}
				aria-label="Seek"
			/>

			<div class="volume-control compact">
				<button class="control-btn" on:click={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
					{#if isMuted || volume === 0}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
							<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
						</svg>
					{/if}
				</button>
			</div>

			<a href={src} download={filename} class="download-btn" title="Download" aria-label="Download {filename}">
				<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
					<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
				</svg>
			</a>
		</div>
	{/if}
</div>

<style>
	.media-player {
		position: relative;
		background: var(--bg-tertiary, #1e1f22);
		border-radius: 8px;
		overflow: hidden;
	}

	.video-player {
		max-width: 400px;
		aspect-ratio: 16 / 9;
	}

	.video-player.fullscreen {
		max-width: none;
		width: 100%;
		height: 100%;
	}

	.video-player video {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
		background: black;
		cursor: pointer;
	}

	.audio-player {
		display: flex;
		flex-direction: column;
		padding: 12px;
		min-width: 300px;
		max-width: 400px;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.2);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-muted, #949ba4);
		text-align: center;
	}

	.error-state svg {
		margin-bottom: 12px;
		opacity: 0.5;
	}

	.error-state p {
		margin: 0 0 12px;
	}

	.download-link {
		color: var(--blurple, #5865f2);
		text-decoration: none;
	}

	.download-link:hover {
		text-decoration: underline;
	}

	/* Video Controls */
	.controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background: linear-gradient(transparent 60%, rgba(0, 0, 0, 0.8));
		transition: opacity 0.2s;
	}

	.controls.hidden {
		opacity: 0;
	}

	.play-overlay {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: transform 0.2s, background 0.2s;
	}

	.play-overlay:hover {
		transform: translate(-50%, -50%) scale(1.1);
		background: rgba(0, 0, 0, 0.9);
	}

	.control-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
	}

	.control-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		transition: background 0.15s;
	}

	.control-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.time {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);
		min-width: 40px;
		text-align: center;
	}

	.progress-slider {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		cursor: pointer;
	}

	.progress-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
	}

	.progress-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	.volume-control {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.volume-slider {
		width: 60px;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		cursor: pointer;
	}

	.volume-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 10px;
		height: 10px;
		background: white;
		border-radius: 50%;
		cursor: pointer;
	}

	.volume-slider::-moz-range-thumb {
		width: 10px;
		height: 10px;
		background: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
	}

	/* Audio Player Styles */
	.audio-info {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.audio-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--blurple, #5865f2);
	}

	.audio-wave {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 20px;
	}

	.audio-wave span {
		width: 3px;
		background: var(--blurple, #5865f2);
		border-radius: 2px;
		animation: wave 0.5s ease-in-out infinite;
	}

	.audio-wave span:nth-child(1) { animation-delay: 0s; height: 8px; }
	.audio-wave span:nth-child(2) { animation-delay: 0.1s; height: 16px; }
	.audio-wave span:nth-child(3) { animation-delay: 0.2s; height: 12px; }
	.audio-wave span:nth-child(4) { animation-delay: 0.3s; height: 6px; }

	@keyframes wave {
		0%, 100% { transform: scaleY(1); }
		50% { transform: scaleY(0.5); }
	}

	.audio-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.audio-filename {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-primary, #f2f3f5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.audio-duration {
		font-size: 12px;
		color: var(--text-muted, #949ba4);
	}

	.audio-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.audio-controls .control-btn {
		color: var(--text-primary, #f2f3f5);
	}

	.audio-controls .play-btn {
		width: 36px;
		height: 36px;
		background: var(--blurple, #5865f2);
		border-radius: 50%;
	}

	.audio-controls .play-btn:hover {
		background: var(--blurple-dark, #4752c4);
	}

	.audio-controls .progress-slider {
		background: var(--bg-modifier-accent, #3f4147);
	}

	.audio-controls .progress-slider::-webkit-slider-thumb {
		background: var(--blurple, #5865f2);
	}

	.audio-controls .progress-slider::-moz-range-thumb {
		background: var(--blurple, #5865f2);
	}

	.volume-control.compact .volume-slider {
		display: none;
	}

	.download-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		color: var(--text-muted, #949ba4);
		border-radius: 4px;
		transition: all 0.15s;
	}

	.download-btn:hover {
		background: var(--bg-modifier-hover, rgba(79, 84, 92, 0.16));
		color: var(--text-primary, #f2f3f5);
	}
</style>
