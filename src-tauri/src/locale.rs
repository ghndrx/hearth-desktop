//! System locale detection for the Hearth desktop app
//!
//! Provides commands to detect the user's system locale settings including
//! language code, region code, and display name.

use serde::Serialize;
use std::env;

/// Locale information returned to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct LocaleInfo {
    /// Full locale string (e.g., "en-US")
    pub locale: String,
    /// Language code (e.g., "en")
    pub language: String,
    /// Region code (e.g., "US")
    pub region: String,
    /// Human-readable display name
    pub display_name: String,
}

/// Get the display name for a language code
fn get_display_name(lang: &str) -> String {
    match lang.to_lowercase().as_str() {
        "en" => "English",
        "es" => "Spanish",
        "fr" => "French",
        "de" => "German",
        "it" => "Italian",
        "pt" => "Portuguese",
        "ru" => "Russian",
        "zh" => "Chinese",
        "ja" => "Japanese",
        "ko" => "Korean",
        "ar" => "Arabic",
        "hi" => "Hindi",
        "nl" => "Dutch",
        "pl" => "Polish",
        "sv" => "Swedish",
        "da" => "Danish",
        "no" => "Norwegian",
        "fi" => "Finnish",
        "tr" => "Turkish",
        "he" => "Hebrew",
        "th" => "Thai",
        "vi" => "Vietnamese",
        "id" => "Indonesian",
        "ms" => "Malay",
        "uk" => "Ukrainian",
        "cs" => "Czech",
        "el" => "Greek",
        "hu" => "Hungarian",
        "ro" => "Romanian",
        "sk" => "Slovak",
        _ => lang,
    }
    .to_string()
}

/// Parse a locale string into components
fn parse_locale(locale_str: &str) -> (String, String, String) {
    // Handle formats like "en_US.UTF-8", "en-US", "en"
    let clean = locale_str
        .split('.')
        .next()
        .unwrap_or(locale_str)
        .replace('_', "-");

    let parts: Vec<&str> = clean.split('-').collect();
    let language = parts.first().unwrap_or(&"en").to_lowercase();
    let region = parts.get(1).map(|r| r.to_uppercase()).unwrap_or_default();

    let formatted_locale = if region.is_empty() {
        language.clone()
    } else {
        format!("{}-{}", language, region)
    };

    (formatted_locale, language, region)
}

/// Detect the system locale
fn detect_system_locale() -> LocaleInfo {
    // Try environment variables in order of preference
    let locale_str = env::var("LC_ALL")
        .or_else(|_| env::var("LC_MESSAGES"))
        .or_else(|_| env::var("LANG"))
        .or_else(|_| env::var("LANGUAGE"))
        .unwrap_or_else(|_| "en-US".to_string());

    let (locale, language, region) = parse_locale(&locale_str);
    let display_name = get_display_name(&language);

    LocaleInfo {
        locale,
        language,
        region,
        display_name,
    }
}

/// Tauri command: Get the system locale
#[tauri::command]
pub fn get_system_locale() -> LocaleInfo {
    detect_system_locale()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_locale_full() {
        let (locale, lang, region) = parse_locale("en_US.UTF-8");
        assert_eq!(locale, "en-US");
        assert_eq!(lang, "en");
        assert_eq!(region, "US");
    }

    #[test]
    fn test_parse_locale_hyphen() {
        let (locale, lang, region) = parse_locale("de-DE");
        assert_eq!(locale, "de-DE");
        assert_eq!(lang, "de");
        assert_eq!(region, "DE");
    }

    #[test]
    fn test_parse_locale_lang_only() {
        let (locale, lang, region) = parse_locale("fr");
        assert_eq!(locale, "fr");
        assert_eq!(lang, "fr");
        assert_eq!(region, "");
    }

    #[test]
    fn test_display_names() {
        assert_eq!(get_display_name("en"), "English");
        assert_eq!(get_display_name("ja"), "Japanese");
        assert_eq!(get_display_name("xx"), "xx");
    }
}
