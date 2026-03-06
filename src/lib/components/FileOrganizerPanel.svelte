<script lang="ts">
	import { onMount } from 'svelte';
	import {
		organizerConfig,
		organizerHistory,
		organizerStats,
		loadOrganizerConfig,
		organizeDirectory,
		previewOrganize,
		undoLast,
		addRule,
		removeRule
	} from '$lib/stores/fileOrganizer';

	let sourceDir = '';
	let targetDir = '';
	let newExtension = '';
	let newCategory = 'Other';
	let previewResults: any[] = [];
	let showPreview = false;
	let showAddRule = false;
	let showHistory = false;
	let organizing = false;
	let activeTab: 'organize' | 'rules' | 'stats' = 'organize';

	const categoryIcons: Record<string, string> = {
		Images: '\u{1F5BC}\u{FE0F}',
		Documents: '\u{1F4C4}',
		Videos: '\u{1F3AC}',
		Audio: '\u{1F3B5}',
		Archives: '\u{1F4E6}',
		Code: '\u{1F4BB}',
		Other: '\u{1F4C1}'
	};

	const categoryColors: Record<string, string> = {
		Images: 'bg-blue-500',
		Documents: 'bg-green-500',
		Videos: 'bg-purple-500',
		Audio: 'bg-yellow-500',
		Archives: 'bg-orange-500',
		Code: 'bg-cyan-500',
		Other: 'bg-gray-500'
	};

	async function handlePreview() {
		if (!sourceDir.trim()) return;
		previewResults = await previewOrganize(sourceDir.trim());
		showPreview = true;
	}

	async function handleOrganize() {
		if (!sourceDir.trim()) return;
		organizing = true;
		await organizeDirectory(sourceDir.trim(), targetDir.trim() || sourceDir.trim());
		organizing = false;
		showPreview = false;
		previewResults = [];
	}

	async function handleAddRule() {
		if (!newExtension.trim()) return;
		await addRule(newExtension.trim().toLowerCase().replace('.', ''), newCategory);
		newExtension = '';
		showAddRule = false;
	}

	function getStatPercent(count: number, total: number): number {
		if (total === 0) return 0;
		return Math.round((count / total) * 100);
	}

	onMount(async () => {
		await loadOrganizerConfig();
	});
</script>

<div class="flex flex-col h-full bg-dark-900 text-gray-100">
	<div class="flex items-center justify-between p-4 border-b border-dark-600">
		<h2 class="text-lg font-semibold">File Organizer</h2>
		<div class="flex items-center gap-1 bg-dark-800 rounded-lg p-0.5">
			{#each ['organize', 'rules', 'stats'] as tab}
				<button
					class="px-3 py-1 text-xs rounded-md transition-colors"
					class:bg-hearth-500={activeTab === tab}
					class:text-white={activeTab === tab}
					class:text-gray-400={activeTab !== tab}
					class:hover:text-gray-200={activeTab !== tab}
					on:click={() => (activeTab = tab)}
				>
					{tab.charAt(0).toUpperCase() + tab.slice(1)}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if activeTab === 'organize'}
			<div class="space-y-4">
				<div>
					<label class="block text-sm text-gray-400 mb-1">Source Directory</label>
					<input
						bind:value={sourceDir}
						placeholder="/path/to/downloads"
						class="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
					/>
				</div>
				<div>
					<label class="block text-sm text-gray-400 mb-1">Target Directory (optional)</label>
					<input
						bind:value={targetDir}
						placeholder="Same as source"
						class="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
					/>
				</div>
				<div class="flex gap-2">
					<button
						class="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded-md text-sm transition-colors disabled:opacity-50"
						disabled={!sourceDir.trim()}
						on:click={handlePreview}
					>
						Preview
					</button>
					<button
						class="flex-1 py-2 bg-hearth-500 hover:bg-hearth-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
						disabled={!sourceDir.trim() || organizing}
						on:click={handleOrganize}
					>
						{organizing ? 'Organizing...' : 'Organize'}
					</button>
				</div>

				{#if showPreview && previewResults.length > 0}
					<div class="border border-dark-600 rounded-lg overflow-hidden">
						<div class="bg-dark-800 px-3 py-2 border-b border-dark-600">
							<span class="text-sm font-medium">Preview ({previewResults.length} files)</span>
						</div>
						<div class="max-h-48 overflow-y-auto">
							{#each previewResults as file}
								<div class="flex items-center gap-2 px-3 py-1.5 border-b border-dark-700 last:border-0 text-xs">
									<span>{categoryIcons[file.category] || '\u{1F4C1}'}</span>
									<span class="flex-1 truncate text-gray-300">{file.original_name || file.file_path}</span>
									<span class="px-1.5 py-0.5 rounded bg-dark-700 text-gray-400">{file.category}</span>
								</div>
							{/each}
						</div>
					</div>
				{:else if showPreview}
					<p class="text-sm text-gray-500 text-center py-4">No files to organize.</p>
				{/if}

				{#if $organizerHistory.length > 0}
					<div>
						<button
							class="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-2"
							on:click={() => (showHistory = !showHistory)}
						>
							<svg class="w-4 h-4 transition-transform" class:rotate-90={showHistory} fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							Recent History ({$organizerHistory.length})
						</button>
						{#if showHistory}
							<div class="space-y-1">
								{#each $organizerHistory.slice(0, 20) as item}
									<div class="flex items-center gap-2 bg-dark-800 rounded-md px-3 py-1.5 text-xs">
										<span>{categoryIcons[item.category] || '\u{1F4C1}'}</span>
										<span class="flex-1 truncate text-gray-300">{item.original_name || item.file_path}</span>
										<span class="text-gray-500">{item.category}</span>
									</div>
								{/each}
							</div>
							<button
								class="mt-2 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 rounded-md text-xs transition-colors"
								on:click={() => undoLast()}
							>
								Undo Last
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{:else if activeTab === 'rules'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-400">Extension to category mappings</p>
					<button
						class="px-2 py-1 bg-hearth-500 hover:bg-hearth-600 text-white rounded text-xs transition-colors"
						on:click={() => (showAddRule = !showAddRule)}
					>
						+ Add Rule
					</button>
				</div>

				{#if showAddRule}
					<div class="bg-dark-800 rounded-lg p-3 border border-dark-600 space-y-2">
						<input
							bind:value={newExtension}
							placeholder="Extension (e.g., pdf)"
							class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-hearth-500"
						/>
						<select
							bind:value={newCategory}
							class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-md text-gray-100 text-sm"
						>
							{#each Object.keys(categoryIcons) as cat}
								<option value={cat}>{cat}</option>
							{/each}
						</select>
						<button
							class="w-full py-1.5 bg-hearth-500 hover:bg-hearth-600 text-white rounded-md text-sm transition-colors disabled:opacity-50"
							disabled={!newExtension.trim()}
							on:click={handleAddRule}
						>
							Add Rule
						</button>
					</div>
				{/if}

				{#if $organizerConfig?.rules}
					<div class="space-y-1">
						{#each $organizerConfig.rules as rule}
							<div class="flex items-center gap-2 bg-dark-800 rounded-md px-3 py-2">
								<span class="text-sm font-mono text-gray-300">.{rule.extension}</span>
								<span class="text-gray-600">&rarr;</span>
								<span class="text-sm">{categoryIcons[rule.category] || '\u{1F4C1}'} {rule.category}</span>
								<div class="flex-1" />
								<button
									class="text-gray-500 hover:text-red-400 transition-colors"
									on:click={() => removeRule(rule.extension)}
								>
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-gray-500 text-center py-8">No custom rules. Default rules apply.</p>
				{/if}
			</div>
		{:else if activeTab === 'stats'}
			<div class="space-y-4">
				{#if $organizerStats}
					<div class="grid grid-cols-2 gap-3">
						<div class="bg-dark-800 rounded-lg p-3 text-center">
							<p class="text-2xl font-bold text-hearth-400">{$organizerStats.total_organized ?? 0}</p>
							<p class="text-xs text-gray-500">Files Organized</p>
						</div>
						<div class="bg-dark-800 rounded-lg p-3 text-center">
							<p class="text-2xl font-bold text-hearth-400">{Object.keys($organizerStats.by_category ?? {}).length}</p>
							<p class="text-xs text-gray-500">Categories Used</p>
						</div>
					</div>

					{#if $organizerStats.by_category}
						<div class="space-y-2">
							<h3 class="text-sm font-medium text-gray-400">By Category</h3>
							{#each Object.entries($organizerStats.by_category) as [category, count]}
								<div class="flex items-center gap-2">
									<span class="text-sm w-24">{categoryIcons[category] || '\u{1F4C1}'} {category}</span>
									<div class="flex-1 h-4 bg-dark-800 rounded-full overflow-hidden">
										<div
											class="{categoryColors[category] || 'bg-gray-500'} h-full rounded-full transition-all"
											style="width: {getStatPercent(count, $organizerStats.total_organized || 1)}%"
										/>
									</div>
									<span class="text-xs text-gray-400 w-8 text-right">{count}</span>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="text-center py-12 text-gray-500">
						<p class="text-4xl mb-3">&#128202;</p>
						<p class="text-sm">No organization stats yet.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
