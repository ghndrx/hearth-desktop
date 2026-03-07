<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';

	interface UpdateInfo {
		version: string;
		current_version: string;
		body: string | null;
		date: string | null;
	}

	interface UpdateProgress {
		downloaded: number;
		total: number | null;
		percent: number | null;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let currentVersion = $state('');
	let updateInfo = $state<UpdateInfo | null>(null);
	let checking = $state(false);
	let downloading = $state(false);
	let progress = $state<UpdateProgress | null>(null);
	let installing = $state(false);
	let error = $state<string | null>(null);
	let autoCheck = $state(true);
	let lastChecked = $state<string | null>(null);

	let unlistenProgress: UnlistenFn | null = null;
	let unlistenInstalling: UnlistenFn | null = null;
	let unlistenAvailable: UnlistenFn | null = null;

	onMount(async () => {
		unlistenProgress = await listen<UpdateProgress>('update:progress', (e) => {
			progress = e.payload;
		});
		unlistenInstalling = await listen('update:installing', () => {
			installing = true;
			downloading = false;
		});
		unlistenAvailable = await listen<UpdateInfo>('update:available', (e) => {
			updateInfo = e.payload;
			currentVersion = e.payload.current_version;
		});
		try {
			const info = await invoke<UpdateInfo | null>('check_for_updates');
			if (info) {
				currentVersion = info.current_version;
			}
		} catch {
			// Silently fail on initial load
		}
	});

	onDestroy(() => {
		unlistenProgress?.();
		unlistenInstalling?.();
		unlistenAvailable?.();
	});

	async function checkForUpdates() {
		try {
			checking = true;
			error = null;
			updateInfo = await invoke<UpdateInfo | null>('check_for_updates');
			lastChecked = new Date().toLocaleTimeString();
			if (updateInfo) {
				currentVersion = updateInfo.current_version;
			}
		} catch (e) {
			error = String(e);
		} finally {
			checking = false;
		}
	}

	async function downloadAndInstall() {
		try {
			downloading = true;
			error = null;
			progress = { downloaded: 0, total: null, percent: 0 };
			await invoke('download_and_install_update');
		} catch (e) {
			error = String(e);
			downloading = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[480px] max-h-[70vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Auto Updater</h2>
						<p class="text-gray-400 text-xs">Check for and install application updates</p>
					</div>
				</div>
				<button
					class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
					onclick={() => { open = false; onClose?.(); }}
					aria-label="Close auto updater"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 space-y-4">
				<!-- Current Version -->
				<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
					<div class="flex items-center justify-between">
						<div>
							<span class="text-xs text-gray-500 block">Current Version</span>
							<span class="text-lg font-bold text-white">{currentVersion || 'Unknown'}</span>
						</div>
						{#if lastChecked}
							<span class="text-xs text-gray-500">Last checked: {lastChecked}</span>
						{/if}
					</div>
				</div>

				{#if updateInfo}
					<!-- Update Available -->
					<div class="rounded-xl border bg-emerald-500/10 border-emerald-500/30 p-4">
						<div class="flex items-center gap-3 mb-3">
							<svg class="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<span class="text-emerald-400 font-semibold">Update Available</span>
								<span class="text-gray-400 text-sm ml-2">v{updateInfo.version}</span>
							</div>
						</div>
						{#if updateInfo.body}
							<div class="bg-gray-900/50 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
								<p class="text-sm text-gray-300 whitespace-pre-wrap">{updateInfo.body}</p>
							</div>
						{/if}
						{#if updateInfo.date}
							<p class="text-xs text-gray-500 mb-3">Released: {updateInfo.date}</p>
						{/if}

						{#if downloading}
							<div class="space-y-2">
								<div class="h-2 bg-gray-700 rounded-full overflow-hidden">
									<div
										class="h-full bg-emerald-500 rounded-full transition-all duration-300"
										style="width: {progress?.percent ?? 0}%"
									></div>
								</div>
								<div class="flex justify-between text-xs text-gray-400">
									<span>{progress ? formatBytes(progress.downloaded) : '0 B'}</span>
									<span>{progress?.percent ? `${progress.percent.toFixed(1)}%` : 'Preparing...'}</span>
									<span>{progress?.total ? formatBytes(progress.total) : '...'}</span>
								</div>
							</div>
						{:else if installing}
							<div class="flex items-center gap-2 text-emerald-400">
								<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
								</svg>
								<span class="text-sm font-medium">Installing update and restarting...</span>
							</div>
						{:else}
							<button
								class="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
								onclick={downloadAndInstall}
							>
								Download & Install v{updateInfo.version}
							</button>
						{/if}
					</div>
				{:else if !checking}
					<!-- No Update -->
					<div class="text-center py-6">
						<svg class="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						<p class="text-gray-400 text-sm">You're up to date!</p>
					</div>
				{/if}

				<!-- Check Button -->
				<button
					class="w-full px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors border border-gray-700 disabled:opacity-50"
					onclick={checkForUpdates}
					disabled={checking || downloading || installing}
				>
					{checking ? 'Checking...' : 'Check for Updates'}
				</button>

				<!-- Settings -->
				<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
					<label class="flex items-center justify-between cursor-pointer">
						<span class="text-sm text-gray-300">Check for updates on startup</span>
						<button
							role="switch"
							aria-checked={autoCheck}
							class="w-10 h-5 rounded-full transition-colors {autoCheck ? 'bg-emerald-500' : 'bg-gray-600'}"
							onclick={() => autoCheck = !autoCheck}
						>
							<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {autoCheck ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
						</button>
					</label>
				</div>

				{#if error}
					<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
						<p class="text-sm text-red-400">{error}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
