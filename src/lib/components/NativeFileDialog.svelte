<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface FileDialogFilter {
		name: string;
		extensions: string[];
	}

	interface SelectedFile {
		path: string;
		name: string;
		size: number;
	}

	export let onFilesSelected: (files: SelectedFile[]) => void = () => {};
	export let onFolderSelected: (path: string) => void = () => {};
	export let title = 'Select Files';
	export let multiple = false;
	export let filters: FileDialogFilter[] = [];
	export let mode: 'open' | 'save' | 'folder' = 'open';
	export let defaultName = '';
	export let compact = false;

	let loading = false;

	async function openDialog() {
		loading = true;
		try {
			if (mode === 'open') {
				const files = await invoke<SelectedFile[]>('open_file_dialog', {
					title,
					filters: filters.length > 0 ? filters : null,
					multiple,
					defaultPath: null
				});
				if (files.length > 0) {
					onFilesSelected(files);
				}
			} else if (mode === 'save') {
				const path = await invoke<string | null>('save_file_dialog', {
					title,
					defaultName: defaultName || null,
					filters: filters.length > 0 ? filters : null,
					defaultPath: null
				});
				if (path) {
					onFolderSelected(path);
				}
			} else if (mode === 'folder') {
				const path = await invoke<string | null>('pick_folder_dialog', {
					title,
					defaultPath: null
				});
				if (path) {
					onFolderSelected(path);
				}
			}
		} catch (e) {
			console.error('File dialog error:', e);
		} finally {
			loading = false;
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}
</script>

{#if compact}
	<button
		class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-200 text-sm rounded transition-colors"
		on:click={openDialog}
		disabled={loading}
	>
		{#if loading}
			<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25" />
				<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
			</svg>
		{:else if mode === 'folder'}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
			</svg>
		{:else}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
			</svg>
		{/if}
		<span>{mode === 'save' ? 'Save As...' : mode === 'folder' ? 'Browse...' : 'Choose File'}</span>
	</button>
{:else}
	<button
		class="flex items-center gap-2 px-4 py-2 bg-warm-600 hover:bg-warm-500 text-white rounded-md transition-colors font-medium"
		on:click={openDialog}
		disabled={loading}
	>
		{#if loading}
			<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25" />
				<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
			</svg>
		{:else}
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
			</svg>
		{/if}
		<span>{title}</span>
	</button>
{/if}
