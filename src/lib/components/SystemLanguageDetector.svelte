<!--
  SystemLanguageDetector - Detects and displays the user's system locale.

  This component queries the system locale from the Rust backend and provides
  the detected language information to child components via a slot. Useful for
  localization decisions and displaying the current system language setting.

  Usage:
    <SystemLanguageDetector let:locale let:language let:region>
      <p>System Language: {language} ({region})</p>
    </SystemLanguageDetector>
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	/** Full locale string (e.g., "en-US") */
	export let locale = '';

	/** Language code (e.g., "en") */
	export let language = '';

	/** Region code (e.g., "US") */
	export let region = '';

	/** Whether the locale detection is in progress */
	export let loading = true;

	/** Error message if detection fails */
	export let error: string | null = null;

	/** Language display name (e.g., "English") */
	export let displayName = '';

	interface LocaleInfo {
		locale: string;
		language: string;
		region: string;
		display_name: string;
	}

	const LANGUAGE_NAMES: Record<string, string> = {
		en: 'English',
		es: 'Spanish',
		fr: 'French',
		de: 'German',
		it: 'Italian',
		pt: 'Portuguese',
		ru: 'Russian',
		zh: 'Chinese',
		ja: 'Japanese',
		ko: 'Korean',
		ar: 'Arabic',
		hi: 'Hindi',
		nl: 'Dutch',
		pl: 'Polish',
		sv: 'Swedish',
		da: 'Danish',
		no: 'Norwegian',
		fi: 'Finnish',
		tr: 'Turkish',
		he: 'Hebrew',
		th: 'Thai',
		vi: 'Vietnamese',
		id: 'Indonesian',
		ms: 'Malay',
		uk: 'Ukrainian',
		cs: 'Czech',
		el: 'Greek',
		hu: 'Hungarian',
		ro: 'Romanian',
		sk: 'Slovak'
	};

	function getDisplayName(lang: string): string {
		return LANGUAGE_NAMES[lang] || lang.toUpperCase();
	}

	async function detectLocale() {
		loading = true;
		error = null;

		try {
			// Try Tauri command first
			const info = await invoke<LocaleInfo>('get_system_locale');
			locale = info.locale;
			language = info.language;
			region = info.region;
			displayName = info.display_name || getDisplayName(info.language);
		} catch {
			// Fallback to browser API
			try {
				const browserLocale = navigator.language || 'en-US';
				const parts = browserLocale.split('-');
				locale = browserLocale;
				language = parts[0] || 'en';
				region = parts[1] || '';
				displayName = getDisplayName(language);
			} catch (fallbackErr) {
				error = 'Failed to detect system locale';
				locale = 'en-US';
				language = 'en';
				region = 'US';
				displayName = 'English';
			}
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		detectLocale();
	});

	/** Refresh locale detection manually */
	export function refresh() {
		detectLocale();
	}
</script>

<slot {locale} {language} {region} {displayName} {loading} {error} {refresh} />
