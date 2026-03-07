<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface ClipSyncEntry {
		id: string;
		content: string;
		contentType: string;
		sourceDevice: string;
		timestamp: string;
		synced: boolean;
	}

	interface ClipSyncSettings {
		enabled: boolean;
		maxEntries: number;
		autoSync: boolean;
		syncImages: boolean;
		syncFiles: boolean;
	}

	interface ClipSyncStats {
		totalEntries: number;
		syncedEntries: number;
		textEntries: number;
		imageEntries: number;
		fileEntries: number;
		devices: string[];
		lastSyncTime: string | null;
	}

	let entries = $state<ClipSyncEntry[]>([]);
	let settings = $state<ClipSyncSettings>({
		enabled: true,
		maxEntries: 100,
		autoSync: true,
		syncImages: true,
		syncFiles: false
	});
	let stats = $state<ClipSyncStats>({
		totalEntries: 0,
		syncedEntries: 0,
		textEntries: 0,
		imageEntries: 0,
		fileEntries: 0,
		devices: [],
		lastSyncTime: null
	});
	let error = $state<string | null>(null);
	let tab = $state<'entries' | 'settings' | 'stats'>('entries');
	let filterType = $state<string | null>(null);

	onMount(() => {
		loadAll();
	});

	async function loadAll() {
		error = null;
		try {
			const [e, se, st] = await Promise.all([
				invoke<ClipSyncEntry[]>('clipsync_get_entries', {}),
				invoke<ClipSyncSettings>('clipsync_get_settings'),
				invoke<ClipSyncStats>('clipsync_get_stats')
			]);
			entries = e;
			settings = se;
			stats = st;
		} catch (e) {
			error = String(e);
		}
	}

	async function loadEntries() {
		try {
			entries = await invoke<ClipSyncEntry[]>('clipsync_get_entries', {
				contentType: filterType
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function handleClear() {
		error = null;
		try {
			await invoke('clipsync_clear');
			entries = [];
			stats = { ...stats, totalEntries: 0, syncedEntries: 0, textEntries: 0, imageEntries: 0, fileEntries: 0 };
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleAutoSync() {
		error = null;
		try {
			settings = await invoke<ClipSyncSettings>('clipsync_update_settings', {
				autoSync: !settings.autoSync
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleEnabled() {
		error = null;
		try {
			settings = await invoke<ClipSyncSettings>('clipsync_update_settings', {
				enabled: !settings.enabled
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleSyncImages() {
		error = null;
		try {
			settings = await invoke<ClipSyncSettings>('clipsync_update_settings', {
				syncImages: !settings.syncImages
			});
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleSyncFiles() {
		error = null;
		try {
			settings = await invoke<ClipSyncSettings>('clipsync_update_settings', {
				syncFiles: !settings.syncFiles
			});
		} catch (e) {
			error = String(e);
		}
	}

	function setFilter(type: string | null) {
		filterType = type;
		loadEntries();
	}

	function formatDate(ts: string): string {
		const d = new Date(ts);
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function contentTypeIcon(type: string): string {
		switch (type) {
			case 'image': return 'IMG';
			case 'file': return 'FILE';
			default: return 'TXT';
		}
	}

	function contentTypeColor(type: string): string {
		switch (type) {
			case 'image': return 'text-purple-400';
			case 'file': return 'text-amber-400';
			default: return 'text-blue-400';
		}
	}

	$effect(() => {
		if (tab === 'stats') {
			invoke<ClipSyncStats>('clipsync_get_stats').then(s => { stats = s; });
		}
	});
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
			</svg>
			<h2 class="text-lg font-semibold">Clipboard Sync</h2>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-xs {settings.enabled ? 'text-green-400' : 'text-dark-400'}">
				{settings.enabled ? 'Active' : 'Disabled'}
			</span>
		</div>
	</div>

	<div class="flex border-b border-dark-600">
		{#each [
			{ key: 'entries', label: 'Entries' },
			{ key: 'settings', label: 'Settings' },
			{ key: 'stats', label: 'Stats' }
		] as t}
			<button
				onclick={() => { tab = t.key as typeof tab; }}
				class="flex-1 py-2 text-xs transition-colors {tab === t.key
					? 'border-b-2 border-hearth-500 text-hearth-400'
					: 'text-dark-300 hover:text-gray-100'}"
			>{t.label}</button>
		{/each}
	</div>

	{#if error}
		<div class="px-4 py-2 text-xs text-red-400">{error}</div>
	{/if}

	{#if tab === 'entries'}
		<div class="flex items-center gap-1 border-b border-dark-600 px-4 py-2">
			{#each [
				{ key: null, label: 'All' },
				{ key: 'text', label: 'Text' },
				{ key: 'image', label: 'Images' },
				{ key: 'file', label: 'Files' }
			] as f}
				<button
					onclick={() => setFilter(f.key)}
					class="rounded px-2 py-1 text-xs transition-colors {filterType === f.key
						? 'bg-hearth-600 text-white'
						: 'bg-dark-700 text-dark-300 hover:text-gray-100'}"
				>{f.label}</button>
			{/each}
			<div class="flex-1"></div>
			<button
				onclick={handleClear}
				class="rounded bg-dark-700 px-2 py-1 text-xs text-dark-300 hover:bg-red-600 hover:text-white"
			>Clear All</button>
		</div>

		<div class="flex-1 overflow-y-auto p-4">
			{#if entries.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-dark-400">
					<svg class="mb-3 h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
							d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
					</svg>
					<p class="text-sm">No clipboard sync entries</p>
					<p class="mt-1 text-xs text-dark-500">Entries will appear when content is synced across devices</p>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					{#each entries as entry (entry.id)}
						<div class="rounded-lg bg-dark-700 p-3">
							<div class="mb-1 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<span class="rounded bg-dark-600 px-2 py-0.5 text-xs font-medium {contentTypeColor(entry.contentType)}">
										{contentTypeIcon(entry.contentType)}
									</span>
									<span class="text-xs text-dark-300">from</span>
									<span class="text-xs font-medium text-hearth-400">{entry.sourceDevice}</span>
								</div>
								<div class="flex items-center gap-2">
									{#if entry.synced}
										<span class="text-xs text-green-400">synced</span>
									{:else}
										<span class="text-xs text-yellow-400">pending</span>
									{/if}
								</div>
							</div>
							<p class="mt-1 text-sm text-dark-200 line-clamp-2">
								{entry.content.length > 150 ? entry.content.slice(0, 150) + '...' : entry.content}
							</p>
							<p class="mt-1 text-right text-xs text-dark-500">{formatDate(entry.timestamp)}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	{:else if tab === 'settings'}
		<div class="flex-1 overflow-y-auto p-4">
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between rounded-lg bg-dark-700 p-3">
					<div>
						<p class="text-sm font-medium">Sync Enabled</p>
						<p class="text-xs text-dark-400">Enable clipboard synchronization</p>
					</div>
					<button
						onclick={toggleEnabled}
						class="relative h-6 w-11 rounded-full transition-colors {settings.enabled ? 'bg-hearth-500' : 'bg-dark-500'}"
					>
						<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings.enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
					</button>
				</div>

				<div class="flex items-center justify-between rounded-lg bg-dark-700 p-3">
					<div>
						<p class="text-sm font-medium">Auto Sync</p>
						<p class="text-xs text-dark-400">Automatically sync new clipboard content</p>
					</div>
					<button
						onclick={toggleAutoSync}
						class="relative h-6 w-11 rounded-full transition-colors {settings.autoSync ? 'bg-hearth-500' : 'bg-dark-500'}"
					>
						<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings.autoSync ? 'translate-x-5' : 'translate-x-0'}"></span>
					</button>
				</div>

				<div class="flex items-center justify-between rounded-lg bg-dark-700 p-3">
					<div>
						<p class="text-sm font-medium">Sync Images</p>
						<p class="text-xs text-dark-400">Include images in clipboard sync</p>
					</div>
					<button
						onclick={toggleSyncImages}
						class="relative h-6 w-11 rounded-full transition-colors {settings.syncImages ? 'bg-hearth-500' : 'bg-dark-500'}"
					>
						<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings.syncImages ? 'translate-x-5' : 'translate-x-0'}"></span>
					</button>
				</div>

				<div class="flex items-center justify-between rounded-lg bg-dark-700 p-3">
					<div>
						<p class="text-sm font-medium">Sync Files</p>
						<p class="text-xs text-dark-400">Include file references in clipboard sync</p>
					</div>
					<button
						onclick={toggleSyncFiles}
						class="relative h-6 w-11 rounded-full transition-colors {settings.syncFiles ? 'bg-hearth-500' : 'bg-dark-500'}"
					>
						<span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings.syncFiles ? 'translate-x-5' : 'translate-x-0'}"></span>
					</button>
				</div>

				<div class="rounded-lg bg-dark-700 p-3">
					<p class="mb-2 text-sm font-medium">Max Entries</p>
					<p class="text-xs text-dark-400">Current limit: {settings.maxEntries}</p>
				</div>
			</div>
		</div>

	{:else if tab === 'stats'}
		<div class="flex-1 overflow-y-auto p-4">
			<div class="flex flex-col gap-3">
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-lg bg-dark-700 p-3 text-center">
						<p class="text-2xl font-bold text-hearth-400">{stats.totalEntries}</p>
						<p class="text-xs text-dark-400">Total Entries</p>
					</div>
					<div class="rounded-lg bg-dark-700 p-3 text-center">
						<p class="text-2xl font-bold text-green-400">{stats.syncedEntries}</p>
						<p class="text-xs text-dark-400">Synced</p>
					</div>
				</div>

				<div class="grid grid-cols-3 gap-3">
					<div class="rounded-lg bg-dark-700 p-3 text-center">
						<p class="text-lg font-bold text-blue-400">{stats.textEntries}</p>
						<p class="text-xs text-dark-400">Text</p>
					</div>
					<div class="rounded-lg bg-dark-700 p-3 text-center">
						<p class="text-lg font-bold text-purple-400">{stats.imageEntries}</p>
						<p class="text-xs text-dark-400">Images</p>
					</div>
					<div class="rounded-lg bg-dark-700 p-3 text-center">
						<p class="text-lg font-bold text-amber-400">{stats.fileEntries}</p>
						<p class="text-xs text-dark-400">Files</p>
					</div>
				</div>

				<div class="rounded-lg bg-dark-700 p-3">
					<p class="mb-2 text-sm font-medium">Devices</p>
					{#if stats.devices.length === 0}
						<p class="text-xs text-dark-400">No devices synced yet</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each stats.devices as device}
								<span class="rounded-full bg-dark-600 px-3 py-1 text-xs text-hearth-400">{device}</span>
							{/each}
						</div>
					{/if}
				</div>

				<div class="rounded-lg bg-dark-700 p-3">
					<p class="mb-1 text-sm font-medium">Last Sync</p>
					<p class="text-xs text-dark-400">
						{stats.lastSyncTime ? formatDate(stats.lastSyncTime) : 'Never'}
					</p>
				</div>
			</div>
		</div>
	{/if}
</div>
