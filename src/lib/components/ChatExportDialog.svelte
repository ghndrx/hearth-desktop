<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import Modal from './Modal.svelte';

	export let show = false;
	export let channelName = '';
	export let serverName = '';
	export let messages: Array<{
		author: string;
		content: string;
		timestamp: string;
		attachments?: string[];
	}> = [];
	export let onClose: () => void = () => {};

	let format = 'html';
	let exporting = false;
	let exportResult: { path: string; size: number; message_count: number } | null = null;
	let error = '';

	const formats = [
		{ value: 'html', label: 'HTML', description: 'Rich formatted export with styling' },
		{ value: 'txt', label: 'Plain Text', description: 'Simple text format' },
		{ value: 'json', label: 'JSON', description: 'Machine-readable structured data' },
		{ value: 'csv', label: 'CSV', description: 'Spreadsheet-compatible format' }
	];

	async function handleExport() {
		exporting = true;
		error = '';
		exportResult = null;

		try {
			exportResult = await invoke('export_chat', {
				request: {
					channel_name: channelName,
					server_name: serverName,
					messages,
					format
				}
			});
		} catch (e: any) {
			if (e === 'Export cancelled' || e?.toString().includes('cancelled')) {
				// User cancelled - not an error
			} else {
				error = e?.toString() || 'Export failed';
			}
		} finally {
			exporting = false;
		}
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1048576).toFixed(1)} MB`;
	}

	function handleClose() {
		exportResult = null;
		error = '';
		onClose();
	}
</script>

{#if show}
	<Modal title="Export Chat History" on:close={handleClose}>
		<div class="space-y-4">
			<div class="text-sm text-gray-300">
				Export <span class="font-semibold text-white">{messages.length}</span> messages from
				<span class="font-semibold text-white">#{channelName}</span>
			</div>

			<!-- Format selection -->
			<div class="space-y-2">
				<label class="text-sm font-medium text-gray-300">Export Format</label>
				<div class="grid grid-cols-2 gap-2">
					{#each formats as fmt}
						<button
							class="p-3 rounded-lg border text-left transition-colors {format === fmt.value
								? 'border-warm-500 bg-warm-500/10 text-white'
								: 'border-dark-500 bg-dark-700 text-gray-300 hover:border-dark-400'}"
							on:click={() => (format = fmt.value)}
						>
							<div class="font-medium text-sm">{fmt.label}</div>
							<div class="text-xs text-gray-400 mt-0.5">{fmt.description}</div>
						</button>
					{/each}
				</div>
			</div>

			{#if error}
				<div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
					{error}
				</div>
			{/if}

			{#if exportResult}
				<div class="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
					<div class="font-medium">Export complete!</div>
					<div class="mt-1 text-green-300/80">
						{exportResult.message_count} messages exported ({formatSize(exportResult.size)})
					</div>
					<div class="mt-1 text-xs text-green-300/60 truncate">{exportResult.path}</div>
				</div>
			{/if}

			<div class="flex justify-end gap-2 pt-2">
				<button
					class="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
					on:click={handleClose}
				>
					{exportResult ? 'Done' : 'Cancel'}
				</button>
				{#if !exportResult}
					<button
						class="px-4 py-2 text-sm bg-warm-600 hover:bg-warm-500 text-white rounded-md transition-colors font-medium disabled:opacity-50"
						on:click={handleExport}
						disabled={exporting || messages.length === 0}
					>
						{#if exporting}
							Exporting...
						{:else}
							Export {messages.length} Messages
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</Modal>
{/if}
