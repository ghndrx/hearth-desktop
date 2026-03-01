<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { fade, slide } from 'svelte/transition';
	
	/**
	 * InlineTranslator - Translate messages inline with language detection
	 * 
	 * Features:
	 * - Auto-detect source language
	 * - Quick translate to preferred language
	 * - Show original/translated toggle
	 * - Translation history caching
	 * - Support for multiple translation providers
	 */
	
	export let text: string = '';
	export let messageId: string = '';
	export let targetLanguage: string = 'en';
	export let autoDetect: boolean = true;
	export let showOriginal: boolean = true;
	export let compact: boolean = false;
	
	const dispatch = createEventDispatcher<{
		translate: { messageId: string; original: string; translated: string; sourceLang: string; targetLang: string };
		error: { messageId: string; error: string };
		languageDetected: { messageId: string; language: string; confidence: number };
	}>();
	
	interface TranslationResult {
		translatedText: string;
		sourceLanguage: string;
		targetLanguage: string;
		confidence: number;
		provider: string;
	}
	
	interface LanguageOption {
		code: string;
		name: string;
		nativeName: string;
	}
	
	const supportedLanguages: LanguageOption[] = [
		{ code: 'en', name: 'English', nativeName: 'English' },
		{ code: 'es', name: 'Spanish', nativeName: 'Español' },
		{ code: 'fr', name: 'French', nativeName: 'Français' },
		{ code: 'de', name: 'German', nativeName: 'Deutsch' },
		{ code: 'it', name: 'Italian', nativeName: 'Italiano' },
		{ code: 'pt', name: 'Portuguese', nativeName: 'Português' },
		{ code: 'ru', name: 'Russian', nativeName: 'Русский' },
		{ code: 'ja', name: 'Japanese', nativeName: '日本語' },
		{ code: 'ko', name: 'Korean', nativeName: '한국어' },
		{ code: 'zh', name: 'Chinese', nativeName: '中文' },
		{ code: 'ar', name: 'Arabic', nativeName: 'العربية' },
		{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
		{ code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
		{ code: 'pl', name: 'Polish', nativeName: 'Polski' },
		{ code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
		{ code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
		{ code: 'th', name: 'Thai', nativeName: 'ไทย' },
		{ code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
		{ code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
		{ code: 'he', name: 'Hebrew', nativeName: 'עברית' }
	];
	
	let translatedText: string = '';
	let detectedLanguage: string = '';
	let languageConfidence: number = 0;
	let isTranslating: boolean = false;
	let isExpanded: boolean = false;
	let showTranslated: boolean = false;
	let selectedTargetLang: string = targetLanguage;
	let translationCache: Map<string, TranslationResult> = new Map();
	let error: string = '';
	
	$: cacheKey = `${messageId}-${text}-${selectedTargetLang}`;
	
	onMount(() => {
		if (autoDetect && text) {
			detectLanguage();
		}
	});
	
	async function detectLanguage(): Promise<void> {
		if (!text || text.length < 3) return;
		
		try {
			const result = await invoke<{ language: string; confidence: number }>('detect_language', {
				text: text.substring(0, 500) // Limit for efficiency
			});
			
			detectedLanguage = result.language;
			languageConfidence = result.confidence;
			
			dispatch('languageDetected', {
				messageId,
				language: detectedLanguage,
				confidence: languageConfidence
			});
		} catch (err) {
			// Fallback to simple heuristic detection
			detectedLanguage = detectLanguageHeuristic(text);
			languageConfidence = 0.5;
		}
	}
	
	function detectLanguageHeuristic(text: string): string {
		// Simple character-based detection as fallback
		const hasKanji = /[\u4e00-\u9fff]/.test(text);
		const hasHiragana = /[\u3040-\u309f]/.test(text);
		const hasKatakana = /[\u30a0-\u30ff]/.test(text);
		const hasKorean = /[\uac00-\ud7af]/.test(text);
		const hasCyrillic = /[\u0400-\u04ff]/.test(text);
		const hasArabic = /[\u0600-\u06ff]/.test(text);
		const hasThai = /[\u0e00-\u0e7f]/.test(text);
		const hasHebrew = /[\u0590-\u05ff]/.test(text);
		const hasDevanagari = /[\u0900-\u097f]/.test(text);
		
		if (hasHiragana || hasKatakana) return 'ja';
		if (hasKorean) return 'ko';
		if (hasKanji && !hasHiragana && !hasKatakana) return 'zh';
		if (hasCyrillic) return 'ru';
		if (hasArabic) return 'ar';
		if (hasThai) return 'th';
		if (hasHebrew) return 'he';
		if (hasDevanagari) return 'hi';
		
		return 'en';
	}
	
	async function translate(): Promise<void> {
		if (!text || isTranslating) return;
		
		// Check cache first
		const cached = translationCache.get(cacheKey);
		if (cached) {
			translatedText = cached.translatedText;
			showTranslated = true;
			return;
		}
		
		isTranslating = true;
		error = '';
		
		try {
			const result = await invoke<TranslationResult>('translate_text', {
				text,
				sourceLang: detectedLanguage || 'auto',
				targetLang: selectedTargetLang
			});
			
			translatedText = result.translatedText;
			translationCache.set(cacheKey, result);
			showTranslated = true;
			
			dispatch('translate', {
				messageId,
				original: text,
				translated: translatedText,
				sourceLang: result.sourceLanguage,
				targetLang: result.targetLanguage
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Translation failed';
			dispatch('error', { messageId, error });
		} finally {
			isTranslating = false;
		}
	}
	
	function toggleView(): void {
		showTranslated = !showTranslated;
	}
	
	function toggleExpanded(): void {
		isExpanded = !isExpanded;
	}
	
	function copyTranslation(): void {
		if (translatedText) {
			navigator.clipboard.writeText(translatedText);
		}
	}
	
	function getLanguageName(code: string): string {
		const lang = supportedLanguages.find(l => l.code === code);
		return lang ? lang.name : code.toUpperCase();
	}
	
	function getLanguageFlag(code: string): string {
		const flags: Record<string, string> = {
			en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹',
			pt: '🇵🇹', ru: '🇷🇺', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳',
			ar: '🇸🇦', hi: '🇮🇳', nl: '🇳🇱', pl: '🇵🇱', tr: '🇹🇷',
			vi: '🇻🇳', th: '🇹🇭', sv: '🇸🇪', uk: '🇺🇦', he: '🇮🇱'
		};
		return flags[code] || '🌐';
	}
</script>

<div class="inline-translator" class:compact class:expanded={isExpanded}>
	{#if detectedLanguage && detectedLanguage !== targetLanguage}
		<div class="language-badge" transition:fade={{ duration: 150 }}>
			<span class="flag">{getLanguageFlag(detectedLanguage)}</span>
			<span class="lang-name">{getLanguageName(detectedLanguage)}</span>
			{#if languageConfidence > 0.8}
				<span class="confidence high">●</span>
			{:else if languageConfidence > 0.5}
				<span class="confidence medium">●</span>
			{:else}
				<span class="confidence low">●</span>
			{/if}
		</div>
	{/if}
	
	<div class="translator-controls">
		{#if !showTranslated}
			<button
				class="translate-btn"
				class:loading={isTranslating}
				on:click={translate}
				disabled={isTranslating || !text}
				title="Translate message"
			>
				{#if isTranslating}
					<span class="spinner"></span>
					<span>Translating...</span>
				{:else}
					<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
					</svg>
					<span>Translate</span>
				{/if}
			</button>
		{:else}
			<button class="toggle-btn" on:click={toggleView} title="Toggle original/translated">
				<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
				</svg>
				<span>{showTranslated ? 'Show Original' : 'Show Translation'}</span>
			</button>
		{/if}
		
		{#if !compact}
			<button class="expand-btn" on:click={toggleExpanded} title="Language options">
				<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 9l-7 7-7-7"/>
				</svg>
			</button>
		{/if}
	</div>
	
	{#if isExpanded}
		<div class="language-selector" transition:slide={{ duration: 200 }}>
			<label for="target-lang">Translate to:</label>
			<select id="target-lang" bind:value={selectedTargetLang}>
				{#each supportedLanguages as lang}
					<option value={lang.code}>
						{getLanguageFlag(lang.code)} {lang.name} ({lang.nativeName})
					</option>
				{/each}
			</select>
			
			{#if translatedText}
				<button class="copy-btn" on:click={copyTranslation} title="Copy translation">
					<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
						<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
					</svg>
				</button>
			{/if}
		</div>
	{/if}
	
	{#if showTranslated && translatedText}
		<div class="translated-content" transition:slide={{ duration: 200 }}>
			<div class="translation-header">
				<span class="from-lang">{getLanguageFlag(detectedLanguage)} {getLanguageName(detectedLanguage)}</span>
				<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M5 12h14m-7-7l7 7-7 7"/>
				</svg>
				<span class="to-lang">{getLanguageFlag(selectedTargetLang)} {getLanguageName(selectedTargetLang)}</span>
			</div>
			<div class="translation-text">
				{translatedText}
			</div>
		</div>
	{/if}
	
	{#if error}
		<div class="error-message" transition:fade={{ duration: 150 }}>
			<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10"/>
				<line x1="12" y1="8" x2="12" y2="12"/>
				<line x1="12" y1="16" x2="12.01" y2="16"/>
			</svg>
			<span>{error}</span>
		</div>
	{/if}
</div>

<style>
	.inline-translator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--translator-bg, rgba(var(--color-surface-500) / 0.5));
		border-radius: 0.5rem;
		border: 1px solid var(--translator-border, rgba(var(--color-surface-400) / 0.3));
	}
	
	.inline-translator.compact {
		padding: 0.25rem;
		gap: 0.25rem;
	}
	
	.language-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: var(--badge-bg, rgba(var(--color-primary-500) / 0.1));
		border-radius: 1rem;
		font-size: 0.75rem;
		width: fit-content;
	}
	
	.language-badge .flag {
		font-size: 0.875rem;
	}
	
	.language-badge .lang-name {
		color: var(--color-primary-400);
		font-weight: 500;
	}
	
	.confidence {
		font-size: 0.5rem;
	}
	
	.confidence.high {
		color: var(--color-success-500, #10b981);
	}
	
	.confidence.medium {
		color: var(--color-warning-500, #f59e0b);
	}
	
	.confidence.low {
		color: var(--color-error-500, #ef4444);
	}
	
	.translator-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	
	.translate-btn,
	.toggle-btn,
	.expand-btn,
	.copy-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background: var(--btn-bg, rgba(var(--color-primary-500) / 0.2));
		border: none;
		border-radius: 0.375rem;
		color: var(--color-primary-400);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	
	.translate-btn:hover:not(:disabled),
	.toggle-btn:hover,
	.expand-btn:hover,
	.copy-btn:hover {
		background: var(--btn-hover-bg, rgba(var(--color-primary-500) / 0.3));
	}
	
	.translate-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.translate-btn.loading {
		pointer-events: none;
	}
	
	.expand-btn,
	.copy-btn {
		padding: 0.375rem;
	}
	
	.icon {
		width: 1rem;
		height: 1rem;
	}
	
	.spinner {
		width: 0.875rem;
		height: 0.875rem;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	
	.language-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--selector-bg, rgba(var(--color-surface-600) / 0.5));
		border-radius: 0.375rem;
	}
	
	.language-selector label {
		font-size: 0.75rem;
		color: var(--color-surface-300);
		white-space: nowrap;
	}
	
	.language-selector select {
		flex: 1;
		padding: 0.375rem 0.5rem;
		background: var(--select-bg, rgba(var(--color-surface-700) / 0.8));
		border: 1px solid var(--select-border, rgba(var(--color-surface-500) / 0.5));
		border-radius: 0.25rem;
		color: var(--color-surface-100);
		font-size: 0.8125rem;
	}
	
	.translated-content {
		padding: 0.75rem;
		background: var(--translation-bg, rgba(var(--color-success-500) / 0.1));
		border-radius: 0.375rem;
		border-left: 3px solid var(--color-success-500, #10b981);
	}
	
	.translation-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
		color: var(--color-surface-400);
	}
	
	.arrow {
		width: 0.875rem;
		height: 0.875rem;
		color: var(--color-surface-500);
	}
	
	.translation-text {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-surface-100);
	}
	
	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--error-bg, rgba(var(--color-error-500) / 0.1));
		border-radius: 0.375rem;
		color: var(--color-error-400, #f87171);
		font-size: 0.8125rem;
	}
	
	.error-message .icon {
		flex-shrink: 0;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.translator-controls {
			flex-wrap: wrap;
		}
		
		.language-selector {
			flex-direction: column;
			align-items: stretch;
		}
		
		.language-selector label {
			margin-bottom: 0.25rem;
		}
	}
</style>
