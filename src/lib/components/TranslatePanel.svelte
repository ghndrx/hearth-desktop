<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface TranslationResult {
		translated_text: string;
		source_language: string;
		target_language: string;
		confidence: number;
		provider: string;
	}

	interface DetectionResult {
		language: string;
		confidence: number;
	}

	interface TranslationLanguage {
		code: string;
		name: string;
	}

	let sourceText = $state('');
	let translatedText = $state('');
	let sourceLang = $state('auto');
	let targetLang = $state('es');
	let detectedLang = $state<DetectionResult | null>(null);
	let languages = $state<TranslationLanguage[]>([]);
	let translating = $state(false);
	let error = $state<string | null>(null);
	let provider = $state('');
	let confidence = $state(0);

	// Translation history
	let history = $state<Array<{ source: string; translated: string; from: string; to: string }>>([]);

	const commonLanguages = [
		{ code: 'en', name: 'English' },
		{ code: 'es', name: 'Spanish' },
		{ code: 'fr', name: 'French' },
		{ code: 'de', name: 'German' },
		{ code: 'it', name: 'Italian' },
		{ code: 'pt', name: 'Portuguese' },
		{ code: 'ja', name: 'Japanese' },
		{ code: 'ko', name: 'Korean' },
		{ code: 'zh', name: 'Chinese' },
		{ code: 'ru', name: 'Russian' },
		{ code: 'ar', name: 'Arabic' },
		{ code: 'hi', name: 'Hindi' },
	];

	onMount(async () => {
		try {
			languages = await invoke<TranslationLanguage[]>('get_translation_languages');
		} catch {
			languages = commonLanguages;
		}
	});

	async function translate() {
		if (!sourceText.trim()) return;
		translating = true;
		error = null;

		try {
			// Detect language if auto
			if (sourceLang === 'auto') {
				detectedLang = await invoke<DetectionResult>('detect_language', { text: sourceText });
			}

			const result = await invoke<TranslationResult>('translate_text', {
				text: sourceText,
				sourceLang: sourceLang === 'auto' ? (detectedLang?.language || 'en') : sourceLang,
				targetLang
			});

			translatedText = result.translated_text;
			provider = result.provider;
			confidence = result.confidence;

			// Add to history
			history = [
				{
					source: sourceText.slice(0, 100),
					translated: translatedText.slice(0, 100),
					from: result.source_language,
					to: result.target_language
				},
				...history.slice(0, 9)
			];
		} catch (e) {
			error = String(e);
		} finally {
			translating = false;
		}
	}

	function swapLanguages() {
		if (sourceLang === 'auto') return;
		const temp = sourceLang;
		sourceLang = targetLang;
		targetLang = temp;
		const tempText = sourceText;
		sourceText = translatedText;
		translatedText = tempText;
	}

	async function copyTranslation() {
		if (translatedText) {
			await navigator.clipboard.writeText(translatedText);
		}
	}

	function getLangName(code: string): string {
		const lang = (languages.length > 0 ? languages : commonLanguages).find(l => l.code === code);
		return lang?.name || code;
	}
</script>

<div class="flex flex-col gap-3 p-4 h-full overflow-y-auto bg-dark-800 text-gray-200">
	<h2 class="text-lg font-semibold text-white">Translate</h2>

	{#if error}
		<div class="text-sm text-red-400 bg-red-900/30 px-3 py-2 rounded">{error}</div>
	{/if}

	<!-- Language Selectors -->
	<div class="flex items-center gap-2">
		<select bind:value={sourceLang} class="flex-1 text-sm bg-dark-700 border border-dark-500 rounded px-2 py-1.5 text-gray-300">
			<option value="auto">Auto-detect</option>
			{#each (languages.length > 0 ? languages : commonLanguages) as lang}
				<option value={lang.code}>{lang.name}</option>
			{/each}
		</select>
		<button
			onclick={swapLanguages}
			class="p-1.5 bg-dark-700 hover:bg-dark-600 rounded transition-colors text-gray-400 {sourceLang === 'auto' ? 'opacity-30 cursor-not-allowed' : ''}"
			disabled={sourceLang === 'auto'}
			title="Swap languages"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
			</svg>
		</button>
		<select bind:value={targetLang} class="flex-1 text-sm bg-dark-700 border border-dark-500 rounded px-2 py-1.5 text-gray-300">
			{#each (languages.length > 0 ? languages : commonLanguages) as lang}
				<option value={lang.code}>{lang.name}</option>
			{/each}
		</select>
	</div>

	{#if detectedLang}
		<div class="text-xs text-gray-400">
			Detected: {getLangName(detectedLang.language)} ({(detectedLang.confidence * 100).toFixed(0)}%)
		</div>
	{/if}

	<!-- Source Text -->
	<div class="relative">
		<textarea
			bind:value={sourceText}
			placeholder="Enter text to translate..."
			rows="4"
			onkeydown={(e) => e.key === 'Enter' && e.ctrlKey && translate()}
			class="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-hearth-500 focus:outline-none resize-none"
		></textarea>
		{#if sourceText}
			<span class="absolute bottom-2 right-2 text-[10px] text-gray-500">{sourceText.length} chars</span>
		{/if}
	</div>

	<!-- Translate Button -->
	<button
		onclick={translate}
		disabled={!sourceText.trim() || translating}
		class="w-full py-2 bg-hearth-600 hover:bg-hearth-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
	>
		{#if translating}
			<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
			Translating...
		{:else}
			Translate (Ctrl+Enter)
		{/if}
	</button>

	<!-- Translated Text -->
	{#if translatedText}
		<div class="relative">
			<div class="bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white min-h-[80px] whitespace-pre-wrap">
				{translatedText}
			</div>
			<div class="flex items-center justify-between mt-1">
				<span class="text-[10px] text-gray-500">
					{provider} {confidence > 0 ? `(${(confidence * 100).toFixed(0)}%)` : ''}
				</span>
				<button
					onclick={copyTranslation}
					class="text-xs text-gray-400 hover:text-white transition-colors"
				>
					Copy
				</button>
			</div>
		</div>
	{/if}

	<!-- History -->
	{#if history.length > 0}
		<div class="mt-2">
			<div class="text-sm font-medium text-gray-400 mb-2">Recent</div>
			<div class="flex flex-col gap-1.5">
				{#each history as item}
					<button
						onclick={() => { sourceText = item.source; translatedText = item.translated; }}
						class="text-left bg-dark-700 rounded p-2 hover:bg-dark-600 transition-colors"
					>
						<div class="text-xs text-gray-300 truncate">{item.source}</div>
						<div class="text-[10px] text-gray-500 mt-0.5">{getLangName(item.from)} -> {getLangName(item.to)}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
