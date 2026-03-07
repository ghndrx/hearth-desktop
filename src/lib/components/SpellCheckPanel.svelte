<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface SpellCheckResult {
		word: string;
		start: number;
		end: number;
		suggestions: string[];
	}

	interface SpellCheckLanguage {
		code: string;
		name: string;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let textInput = $state('');
	let results = $state<SpellCheckResult[]>([]);
	let languages = $state<SpellCheckLanguage[]>([]);
	let selectedLanguage = $state('en_US');
	let customWords = $state<string[]>([]);
	let newWord = $state('');
	let checking = $state(false);
	let error = $state<string | null>(null);
	let showDictionary = $state(false);
	let selectedResult = $state<SpellCheckResult | null>(null);

	onMount(async () => {
		try {
			languages = await invoke<SpellCheckLanguage[]>('get_spell_check_languages');
			customWords = await invoke<string[]>('get_custom_dictionary');
		} catch (e) {
			error = String(e);
		}
	});

	async function checkSpelling() {
		if (!textInput.trim()) return;
		try {
			checking = true;
			error = null;
			selectedResult = null;
			results = await invoke<SpellCheckResult[]>('check_spelling', {
				text: textInput,
				language: selectedLanguage
			});
		} catch (e) {
			error = String(e);
		} finally {
			checking = false;
		}
	}

	async function addToDictionary(word: string) {
		try {
			await invoke('add_to_dictionary', { word });
			customWords = await invoke<string[]>('get_custom_dictionary');
			results = results.filter(r => r.word.toLowerCase() !== word.toLowerCase());
		} catch (e) {
			error = String(e);
		}
	}

	async function removeFromDictionary(word: string) {
		try {
			await invoke('remove_from_dictionary', { word });
			customWords = await invoke<string[]>('get_custom_dictionary');
		} catch (e) {
			error = String(e);
		}
	}

	async function addCustomWord() {
		if (!newWord.trim()) return;
		await addToDictionary(newWord.trim());
		newWord = '';
	}

	function applySuggestion(result: SpellCheckResult, suggestion: string) {
		textInput = textInput.substring(0, result.start) + suggestion + textInput.substring(result.end);
		results = results.filter(r => r !== result);
		selectedResult = null;
	}

	function highlightErrors(text: string): string {
		if (results.length === 0) return text;
		let highlighted = '';
		let lastEnd = 0;
		for (const r of results) {
			highlighted += escapeHtml(text.substring(lastEnd, r.start));
			highlighted += `<span class="underline decoration-wavy decoration-red-400">${escapeHtml(text.substring(r.start, r.end))}</span>`;
			lastEnd = r.end;
		}
		highlighted += escapeHtml(text.substring(lastEnd));
		return highlighted;
	}

	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			checkSpelling();
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[560px] max-h-[80vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Spell Check</h2>
						<p class="text-gray-400 text-xs">Native spell checking with custom dictionary</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						class="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
						onclick={() => showDictionary = !showDictionary}
					>
						{showDictionary ? 'Checker' : 'Dictionary'}
					</button>
					<button
						class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
						onclick={() => { open = false; onClose?.(); }}
						aria-label="Close spell check"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 space-y-4">
				{#if showDictionary}
					<!-- Custom Dictionary -->
					<div>
						<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Custom Dictionary ({customWords.length} words)</h3>
						<div class="flex gap-2 mb-3">
							<input
								type="text"
								bind:value={newWord}
								class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
								placeholder="Add a word..."
								onkeydown={(e) => e.key === 'Enter' && addCustomWord()}
							/>
							<button
								class="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-colors disabled:opacity-50"
								onclick={addCustomWord}
								disabled={!newWord.trim()}
							>Add</button>
						</div>
						<div class="max-h-64 overflow-y-auto space-y-1">
							{#if customWords.length === 0}
								<p class="text-gray-500 text-sm text-center py-4">No custom words added yet</p>
							{:else}
								{#each customWords as word}
									<div class="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors">
										<span class="text-sm text-gray-300 font-mono">{word}</span>
										<button
											class="text-xs text-red-400 hover:text-red-300"
											onclick={() => removeFromDictionary(word)}
										>Remove</button>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{:else}
					<!-- Spell Checker -->
					<div>
						<div class="flex items-center justify-between mb-1.5">
							<label class="text-xs text-gray-400" for="spell-lang">Language</label>
							<select
								id="spell-lang"
								bind:value={selectedLanguage}
								class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
							>
								{#each languages as lang}
									<option value={lang.code}>{lang.name}</option>
								{/each}
							</select>
						</div>
					</div>

					<div>
						<label class="text-xs text-gray-400 mb-1.5 block" for="spell-input">Text to Check</label>
						<textarea
							id="spell-input"
							bind:value={textInput}
							onkeydown={handleKeydown}
							class="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono resize-none focus:outline-none focus:border-blue-500 placeholder-gray-600"
							placeholder="Type or paste text to check spelling..."
						></textarea>
						<div class="flex justify-between items-center mt-1.5">
							<span class="text-xs text-gray-500">{textInput.split(/\s+/).filter(Boolean).length} words</span>
							<span class="text-xs text-gray-600">Ctrl+Enter to check</span>
						</div>
					</div>

					<button
						class="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
						onclick={checkSpelling}
						disabled={checking || !textInput.trim()}
					>
						{checking ? 'Checking...' : 'Check Spelling'}
					</button>

					<!-- Results -->
					{#if results.length > 0}
						<div>
							<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
								Found {results.length} issue{results.length !== 1 ? 's' : ''}
							</h3>
							<div class="space-y-2">
								{#each results as result}
									<div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
										<div class="flex items-center justify-between mb-2">
											<span class="text-sm text-red-400 font-mono font-medium">"{result.word}"</span>
											<button
												class="text-xs text-gray-400 hover:text-blue-400 transition-colors"
												onclick={() => addToDictionary(result.word)}
											>Add to Dictionary</button>
										</div>
										{#if result.suggestions.length > 0}
											<div class="flex flex-wrap gap-1.5">
												{#each result.suggestions as suggestion}
													<button
														class="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
														onclick={() => applySuggestion(result, suggestion)}
													>{suggestion}</button>
												{/each}
											</div>
										{:else}
											<span class="text-xs text-gray-500">No suggestions available</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{:else if !checking && textInput.trim() && results.length === 0}
						<div class="text-center py-4">
							<svg class="w-8 h-8 text-green-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<p class="text-green-400 text-sm">No spelling errors found!</p>
						</div>
					{/if}
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
