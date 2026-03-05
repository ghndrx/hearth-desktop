<script lang="ts">
	import { contentFilter, type ContentFilterConfig, type FilterResult } from '$lib/stores/contentFilter';
	import { onMount } from 'svelte';

	let config: ContentFilterConfig;
	let stats = { total_scanned: 0, total_filtered: 0, by_category: {} as Record<string, number>, by_severity: {} as Record<string, number>, false_positives_reported: 0 };
	let newWord = '';
	let testInput = '';
	let testResult: FilterResult | null = null;
	let activeSection: 'general' | 'words' | 'categories' | 'log' | 'test' = 'general';

	const modes = [
		{ value: 'strict', label: 'Strict', desc: 'Block most content' },
		{ value: 'moderate', label: 'Moderate', desc: 'Balanced filtering' },
		{ value: 'lenient', label: 'Lenient', desc: 'Only obvious content' },
		{ value: 'custom', label: 'Custom', desc: 'Your own rules' }
	];

	const actions = [
		{ value: 'hide', label: 'Hide', desc: 'Remove from view entirely' },
		{ value: 'blur', label: 'Blur', desc: 'Blur content, click to reveal' },
		{ value: 'warn', label: 'Warn', desc: 'Show warning overlay' },
		{ value: 'replace', label: 'Replace', desc: 'Replace with asterisks' },
		{ value: 'block', label: 'Block', desc: 'Prevent sending' }
	];

	onMount(async () => {
		await contentFilter.loadConfig();
		await contentFilter.loadStats();

		const unsubConfig = contentFilter.config.subscribe((c) => (config = c));
		const unsubStats = contentFilter.stats.subscribe((s) => (stats = s));

		return () => {
			unsubConfig();
			unsubStats();
		};
	});

	async function toggleEnabled() {
		await contentFilter.setEnabled(!config.enabled);
	}

	async function setMode(mode: string) {
		config.mode = mode as ContentFilterConfig['mode'];
		await contentFilter.updateConfig(config);
	}

	async function setAction(action: string) {
		config.action = action as ContentFilterConfig['action'];
		await contentFilter.updateConfig(config);
	}

	async function addWord() {
		const word = newWord.trim();
		if (!word) return;
		await contentFilter.addBlockedWord(word);
		newWord = '';
	}

	async function removeWord(word: string) {
		await contentFilter.removeBlockedWord(word);
	}

	async function toggleCategory(index: number) {
		config.filter_categories[index].enabled = !config.filter_categories[index].enabled;
		await contentFilter.updateConfig(config);
	}

	async function testContent() {
		if (!testInput.trim()) return;
		testResult = await contentFilter.testContent(testInput);
	}

	function handleWordKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addWord();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-base font-semibold text-white">Content Filter</h3>
			<p class="text-sm text-[#b5bac1]">Filter and block unwanted content</p>
		</div>
		<button
			on:click={toggleEnabled}
			class="relative w-11 h-6 rounded-full transition-colors {config?.enabled ? 'bg-[#23a559]' : 'bg-[#4e5058]'}"
			aria-label="Toggle content filter"
		>
			<span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform {config?.enabled ? 'translate-x-5' : ''}"></span>
		</button>
	</div>

	{#if stats.total_scanned > 0}
		<div class="grid grid-cols-3 gap-3">
			<div class="bg-[#2b2d31] rounded-lg p-3 text-center">
				<div class="text-lg font-semibold text-white">{stats.total_scanned}</div>
				<div class="text-xs text-[#b5bac1]">Scanned</div>
			</div>
			<div class="bg-[#2b2d31] rounded-lg p-3 text-center">
				<div class="text-lg font-semibold text-[#f0b232]">{stats.total_filtered}</div>
				<div class="text-xs text-[#b5bac1]">Filtered</div>
			</div>
			<div class="bg-[#2b2d31] rounded-lg p-3 text-center">
				<div class="text-lg font-semibold text-[#23a559]">{stats.false_positives_reported}</div>
				<div class="text-xs text-[#b5bac1]">False Positives</div>
			</div>
		</div>
	{/if}

	<div class="flex gap-1 bg-[#1e1f22] rounded-lg p-1">
		{#each ['general', 'words', 'categories', 'test'] as section}
			<button
				class="flex-1 py-1.5 text-xs font-medium rounded transition-colors {activeSection === section ? 'bg-[#5865f2] text-white' : 'text-[#b5bac1] hover:text-white'}"
				on:click={() => (activeSection = section)}
			>
				{section.charAt(0).toUpperCase() + section.slice(1)}
			</button>
		{/each}
	</div>

	{#if config}
		<div class:opacity-50={!config.enabled && activeSection !== 'test'} class:pointer-events-none={!config.enabled && activeSection !== 'test'}>
			{#if activeSection === 'general'}
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-2">Filter Mode</label>
						<div class="grid grid-cols-2 gap-2">
							{#each modes as mode}
								<button
									class="text-left px-3 py-2 rounded-lg border transition-colors {config.mode === mode.value ? 'border-[#5865f2] bg-[#5865f2]/10' : 'border-[#3f4147] bg-[#2b2d31] hover:border-[#4e5058]'}"
									on:click={() => setMode(mode.value)}
								>
									<div class="text-sm font-medium {config.mode === mode.value ? 'text-[#5865f2]' : 'text-[#dbdee1]'}">{mode.label}</div>
									<div class="text-xs text-[#72767d]">{mode.desc}</div>
								</button>
							{/each}
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-2">Action on Match</label>
						<div class="space-y-1">
							{#each actions as action}
								<button
									class="w-full text-left flex items-center gap-3 px-3 py-2 rounded transition-colors {config.action === action.value ? 'bg-[#5865f2]/10 text-[#5865f2]' : 'text-[#dbdee1] hover:bg-[#2b2d31]'}"
									on:click={() => setAction(action.value)}
								>
									<span class="w-3 h-3 rounded-full border-2 {config.action === action.value ? 'border-[#5865f2] bg-[#5865f2]' : 'border-[#4e5058]'}"></span>
									<div>
										<div class="text-sm">{action.label}</div>
										<div class="text-xs text-[#72767d]">{action.desc}</div>
									</div>
								</button>
							{/each}
						</div>
					</div>

					<div class="space-y-2">
						<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
							<input
								type="checkbox"
								bind:checked={config.log_filtered}
								on:change={() => contentFilter.updateConfig(config)}
								class="rounded"
							/>
							Log filtered content
						</label>
						<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
							<input
								type="checkbox"
								bind:checked={config.notify_on_filter}
								on:change={() => contentFilter.updateConfig(config)}
								class="rounded"
							/>
							Show notification when content is filtered
						</label>
					</div>
				</div>

			{:else if activeSection === 'words'}
				<div class="space-y-4">
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={newWord}
							on:keydown={handleWordKeydown}
							placeholder="Add blocked word..."
							class="flex-1 bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
						/>
						<button
							on:click={addWord}
							disabled={!newWord.trim()}
							class="px-4 py-2 text-sm bg-[#5865f2] text-white rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50"
						>
							Add
						</button>
					</div>

					{#if config.blocked_words.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each config.blocked_words as word}
								<span class="inline-flex items-center gap-1 px-2 py-1 bg-[#2b2d31] rounded text-sm text-[#dbdee1]">
									{word}
									<button
										on:click={() => removeWord(word)}
										class="text-[#72767d] hover:text-[#f23f42] transition-colors"
										aria-label="Remove {word}"
									>
										&times;
									</button>
								</span>
							{/each}
						</div>
					{:else}
						<div class="text-sm text-[#72767d] text-center py-4">
							No blocked words yet
						</div>
					{/if}
				</div>

			{:else if activeSection === 'categories'}
				<div class="space-y-2">
					{#each config.filter_categories as category, i}
						<div class="flex items-center justify-between bg-[#2b2d31] rounded-lg px-4 py-3">
							<div>
								<div class="text-sm text-[#dbdee1]">{category.name}</div>
								<div class="flex items-center gap-2 mt-0.5">
									<span class="text-xs px-1.5 py-0.5 rounded {
										category.severity === 'critical' ? 'bg-[#f23f42]/20 text-[#f23f42]' :
										category.severity === 'high' ? 'bg-[#f0b232]/20 text-[#f0b232]' :
										category.severity === 'medium' ? 'bg-[#5865f2]/20 text-[#5865f2]' :
										'bg-[#4e5058]/20 text-[#b5bac1]'
									}">
										{category.severity}
									</span>
									<span class="text-xs text-[#72767d]">{category.patterns.length} pattern{category.patterns.length !== 1 ? 's' : ''}</span>
									{#if stats.by_category[category.id]}
										<span class="text-xs text-[#f0b232]">{stats.by_category[category.id]} matches</span>
									{/if}
								</div>
							</div>
							<button
								on:click={() => toggleCategory(i)}
								class="relative w-9 h-5 rounded-full transition-colors {category.enabled ? 'bg-[#23a559]' : 'bg-[#4e5058]'}"
							>
								<span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {category.enabled ? 'translate-x-4' : ''}"></span>
							</button>
						</div>
					{/each}
				</div>

			{:else if activeSection === 'test'}
				<div class="space-y-4">
					<p class="text-sm text-[#b5bac1]">Test how the filter handles specific content.</p>
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={testInput}
							on:keydown={(e) => e.key === 'Enter' && testContent()}
							placeholder="Enter test content..."
							class="flex-1 bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
						/>
						<button
							on:click={testContent}
							disabled={!testInput.trim()}
							class="px-4 py-2 text-sm bg-[#5865f2] text-white rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50"
						>
							Test
						</button>
					</div>

					{#if testResult}
						<div class="bg-[#2b2d31] rounded-lg p-4 space-y-2">
							<div class="flex items-center gap-2">
								{#if testResult.filtered}
									<span class="w-2 h-2 rounded-full bg-[#f23f42]"></span>
									<span class="text-sm font-medium text-[#f23f42]">Content would be filtered</span>
								{:else}
									<span class="w-2 h-2 rounded-full bg-[#23a559]"></span>
									<span class="text-sm font-medium text-[#23a559]">Content passes filter</span>
								{/if}
							</div>
							{#if testResult.matched_words.length > 0}
								<div class="text-xs text-[#b5bac1]">
									Matched: {testResult.matched_words.join(', ')}
								</div>
							{/if}
							{#if testResult.matched_categories.length > 0}
								<div class="text-xs text-[#b5bac1]">
									Categories: {testResult.matched_categories.join(', ')}
								</div>
							{/if}
							{#if testResult.clean_content}
								<div class="text-xs text-[#72767d]">
									Clean: <span class="text-[#dbdee1]">{testResult.clean_content}</span>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
