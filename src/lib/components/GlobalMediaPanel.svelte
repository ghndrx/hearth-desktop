<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface MediaMetadata {
		title: string;
		artist: string;
		album: string;
		artwork: string | null;
		duration: number | null;
	}

	interface MediaPlaybackState {
		isPlaying: boolean;
		position: number | null;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let metadata = $state<MediaMetadata>({ title: '', artist: '', album: '', artwork: null, duration: null });
	let playback = $state<MediaPlaybackState>({ isPlaying: false, position: null });
	let registered = $state(false);
	let error = $state<string | null>(null);
	let seekPosition = $state(0);

	let unlistenAction: UnlistenFn | null = null;
	let unlistenSeek: UnlistenFn | null = null;
	let positionInterval: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		await refreshState();

		unlistenAction = await listen<string>('media-session-action', (e) => {
			handleMediaAction(e.payload);
		});
		unlistenSeek = await listen<number>('media-session-seek', (e) => {
			seekPosition = e.payload;
			playback = { ...playback, position: e.payload };
		});

		positionInterval = setInterval(() => {
			if (playback.isPlaying && playback.position != null) {
				playback = { ...playback, position: (playback.position ?? 0) + 1 };
				seekPosition = playback.position ?? 0;
			}
		}, 1000);
	});

	onDestroy(() => {
		unlistenAction?.();
		unlistenSeek?.();
		if (positionInterval) clearInterval(positionInterval);
	});

	async function refreshState() {
		try {
			const [meta, state, isRegistered] = await invoke<[MediaMetadata, MediaPlaybackState, boolean]>('media_session_get_state');
			metadata = meta;
			playback = state;
			registered = isRegistered;
			seekPosition = state.position ?? 0;
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleRegistration() {
		try {
			error = null;
			if (registered) {
				await invoke('media_session_unregister');
			} else {
				await invoke('media_session_register');
			}
			registered = !registered;
		} catch (e) {
			error = String(e);
		}
	}

	async function sendAction(action: string) {
		try {
			error = null;
			await invoke('media_session_simulate_action', { action });
			if (action === 'play' || action === 'pause') {
				playback = { ...playback, isPlaying: action === 'play' };
			}
		} catch (e) {
			error = String(e);
		}
	}

	function handleMediaAction(action: string) {
		switch (action) {
			case 'play':
				playback = { ...playback, isPlaying: true };
				break;
			case 'pause':
			case 'stop':
				playback = { ...playback, isPlaying: false };
				break;
		}
	}

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function handleSeek() {
		try {
			await invoke('media_session_set_playback_state', {
				stateUpdate: { isPlaying: playback.isPlaying, position: seekPosition }
			});
			playback = { ...playback, position: seekPosition };
		} catch (e) {
			error = String(e);
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[440px] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Global Media Controls</h2>
						<p class="text-gray-400 text-xs">OS media key integration</p>
					</div>
				</div>
				<button
					class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
					onclick={() => { open = false; onClose?.(); }}
					aria-label="Close media controls"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-5 space-y-4">
				<!-- Registration Toggle -->
				<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-3">
					<label class="flex items-center justify-between cursor-pointer">
						<div>
							<span class="text-sm text-gray-300 block">Media Session</span>
							<span class="text-xs text-gray-500">{registered ? 'Registered with OS' : 'Not registered'}</span>
						</div>
						<button
							role="switch"
							aria-checked={registered}
							class="w-10 h-5 rounded-full transition-colors {registered ? 'bg-purple-500' : 'bg-gray-600'}"
							onclick={toggleRegistration}
						>
							<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {registered ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
						</button>
					</label>
				</div>

				{#if registered}
					<!-- Now Playing -->
					<div class="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
						<div class="flex items-start gap-4">
							<!-- Artwork -->
							<div class="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
								{#if metadata.artwork}
									<img src={metadata.artwork} alt="Album art" class="w-full h-full object-cover" />
								{:else}
									<svg class="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
										<path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
									</svg>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-white font-medium text-sm truncate">{metadata.title || 'No media playing'}</p>
								<p class="text-gray-400 text-xs truncate">{metadata.artist || 'Unknown artist'}</p>
								<p class="text-gray-500 text-xs truncate">{metadata.album || ''}</p>
							</div>
						</div>

						<!-- Progress Bar -->
						{#if metadata.duration}
							<div class="mt-4">
								<input
									type="range"
									min="0"
									max={metadata.duration}
									bind:value={seekPosition}
									onchange={handleSeek}
									class="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-500"
								/>
								<div class="flex justify-between text-xs text-gray-500 mt-1">
									<span>{formatDuration(seekPosition)}</span>
									<span>{formatDuration(metadata.duration)}</span>
								</div>
							</div>
						{/if}

						<!-- Transport Controls -->
						<div class="flex items-center justify-center gap-4 mt-3">
							<button
								class="w-9 h-9 rounded-full hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
								onclick={() => sendAction('previous')}
								aria-label="Previous track"
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
									<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
								</svg>
							</button>
							<button
								class="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white transition-colors shadow-lg"
								onclick={() => sendAction(playback.isPlaying ? 'pause' : 'play')}
								aria-label={playback.isPlaying ? 'Pause' : 'Play'}
							>
								{#if playback.isPlaying}
									<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
										<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
									</svg>
								{:else}
									<svg class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M8 5v14l11-7z" />
									</svg>
								{/if}
							</button>
							<button
								class="w-9 h-9 rounded-full hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
								onclick={() => sendAction('next')}
								aria-label="Next track"
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
									<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
								</svg>
							</button>
							<button
								class="w-9 h-9 rounded-full hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
								onclick={() => sendAction('stop')}
								aria-label="Stop"
							>
								<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
									<path d="M6 6h12v12H6z" />
								</svg>
							</button>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
						<p class="text-sm text-red-400">{error}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
