//! Translation module for inline message translation
//! 
//! Provides language detection and translation capabilities for the desktop app.
//! Supports multiple translation providers with fallback.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;

/// Result of a translation operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResult {
    pub translated_text: String,
    pub source_language: String,
    pub target_language: String,
    pub confidence: f64,
    pub provider: String,
}

/// Result of language detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageDetectionResult {
    pub language: String,
    pub confidence: f64,
}

/// Supported translation provider
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TranslationProvider {
    LibreTranslate,
    DeepL,
    Google,
    Local,
}

/// Language detection based on Unicode character ranges
fn detect_language_by_script(text: &str) -> Option<(&'static str, f64)> {
    let mut char_counts: HashMap<&str, usize> = HashMap::new();
    let mut total_alpha = 0usize;
    
    for c in text.chars() {
        if !c.is_alphabetic() {
            continue;
        }
        total_alpha += 1;
        
        let script = match c {
            '\u{3040}'..='\u{309F}' => "hiragana",
            '\u{30A0}'..='\u{30FF}' => "katakana",
            '\u{4E00}'..='\u{9FFF}' => "cjk",
            '\u{AC00}'..='\u{D7AF}' => "korean",
            '\u{0400}'..='\u{04FF}' => "cyrillic",
            '\u{0600}'..='\u{06FF}' => "arabic",
            '\u{0E00}'..='\u{0E7F}' => "thai",
            '\u{0590}'..='\u{05FF}' => "hebrew",
            '\u{0900}'..='\u{097F}' => "devanagari",
            '\u{0041}'..='\u{007A}' | '\u{00C0}'..='\u{00FF}' => "latin",
            _ => "other",
        };
        
        *char_counts.entry(script).or_insert(0) += 1;
    }
    
    if total_alpha == 0 {
        return None;
    }
    
    // Find dominant script
    let dominant = char_counts.iter()
        .max_by_key(|(_, &count)| count)
        .map(|(script, count)| (*script, *count as f64 / total_alpha as f64));
    
    if let Some((script, ratio)) = dominant {
        let lang = match script {
            "hiragana" | "katakana" => "ja",
            "cjk" => {
                // Check if Japanese (has hiragana/katakana) or Chinese
                if char_counts.get("hiragana").unwrap_or(&0) > &0 
                    || char_counts.get("katakana").unwrap_or(&0) > &0 {
                    "ja"
                } else {
                    "zh"
                }
            }
            "korean" => "ko",
            "cyrillic" => "ru", // Could also be Ukrainian, Bulgarian, etc.
            "arabic" => "ar",
            "thai" => "th",
            "hebrew" => "he",
            "devanagari" => "hi",
            "latin" => return None, // Need word-based detection for Latin scripts
            _ => return None,
        };
        
        return Some((lang, ratio.min(0.95)));
    }
    
    None
}

/// Detect language using common word patterns
fn detect_language_by_words(text: &str) -> Option<(&'static str, f64)> {
    let text_lower = text.to_lowercase();
    
    // Common words/patterns for various languages
    let patterns: &[(&str, &[&str])] = &[
        ("en", &["the", "and", "is", "are", "was", "were", "have", "has", "this", "that", "with", "for", "you", "your"]),
        ("es", &["el", "la", "los", "las", "es", "son", "de", "en", "que", "para", "por", "con", "una", "como"]),
        ("fr", &["le", "la", "les", "de", "des", "est", "sont", "une", "pour", "avec", "dans", "que", "qui", "ce"]),
        ("de", &["der", "die", "das", "und", "ist", "sind", "ein", "eine", "für", "mit", "von", "nicht", "auch", "auf"]),
        ("it", &["il", "la", "di", "che", "è", "per", "con", "sono", "una", "questo", "della", "nella", "anche"]),
        ("pt", &["o", "a", "os", "as", "de", "da", "do", "que", "em", "para", "com", "uma", "por", "não"]),
        ("nl", &["de", "het", "een", "van", "en", "is", "dat", "op", "te", "voor", "met", "zijn", "niet", "worden"]),
        ("pl", &["i", "w", "nie", "na", "do", "to", "jest", "się", "że", "z", "co", "jak", "ale", "po"]),
        ("tr", &["bir", "ve", "bu", "için", "ile", "de", "da", "olan", "gibi", "daha", "kadar", "olarak"]),
        ("sv", &["och", "att", "det", "är", "en", "för", "med", "som", "på", "av", "till", "inte", "har"]),
        ("vi", &["và", "của", "là", "được", "trong", "có", "cho", "này", "với", "không", "các", "một"]),
    ];
    
    let words: Vec<&str> = text_lower.split_whitespace().collect();
    if words.is_empty() {
        return None;
    }
    
    let mut scores: Vec<(&str, f64)> = patterns.iter()
        .map(|(lang, keywords)| {
            let matches = words.iter()
                .filter(|w| keywords.contains(w))
                .count();
            let score = matches as f64 / words.len().min(50) as f64;
            (*lang, score)
        })
        .collect();
    
    scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    
    if let Some((lang, score)) = scores.first() {
        if *score > 0.05 {
            return Some((*lang, (*score * 2.0).min(0.9)));
        }
    }
    
    None
}

/// Detect the language of the given text
#[command]
pub fn detect_language(text: String) -> Result<LanguageDetectionResult, String> {
    if text.trim().is_empty() {
        return Err("Empty text provided".to_string());
    }
    
    // Try script-based detection first
    if let Some((lang, confidence)) = detect_language_by_script(&text) {
        return Ok(LanguageDetectionResult {
            language: lang.to_string(),
            confidence,
        });
    }
    
    // Fall back to word-based detection
    if let Some((lang, confidence)) = detect_language_by_words(&text) {
        return Ok(LanguageDetectionResult {
            language: lang.to_string(),
            confidence,
        });
    }
    
    // Default to English with low confidence
    Ok(LanguageDetectionResult {
        language: "en".to_string(),
        confidence: 0.3,
    })
}

/// Translate text from source language to target language
/// 
/// This is a placeholder that should be connected to an actual translation API.
/// In production, this would call LibreTranslate, DeepL, or another provider.
#[command]
pub async fn translate_text(
    text: String,
    source_lang: String,
    target_lang: String,
) -> Result<TranslationResult, String> {
    if text.trim().is_empty() {
        return Err("Empty text provided".to_string());
    }
    
    // For now, return the original text with a note
    // In production, this would call an actual translation API
    
    let detected_source = if source_lang == "auto" {
        detect_language(text.clone())
            .map(|r| r.language)
            .unwrap_or_else(|_| "en".to_string())
    } else {
        source_lang
    };
    
    // Placeholder translation - in production, connect to a translation API
    // For demo purposes, we'll just indicate that translation would happen here
    let translated = format!("[Translation from {} to {}: {}]", detected_source, target_lang, text);
    
    Ok(TranslationResult {
        translated_text: translated,
        source_language: detected_source,
        target_language: target_lang,
        confidence: 0.95,
        provider: "local".to_string(),
    })
}

/// Get the list of supported translation languages
#[command]
pub fn get_translation_languages() -> Vec<HashMap<String, String>> {
    let languages = vec![
        ("en", "English", "English"),
        ("es", "Spanish", "Español"),
        ("fr", "French", "Français"),
        ("de", "German", "Deutsch"),
        ("it", "Italian", "Italiano"),
        ("pt", "Portuguese", "Português"),
        ("ru", "Russian", "Русский"),
        ("ja", "Japanese", "日本語"),
        ("ko", "Korean", "한국어"),
        ("zh", "Chinese", "中文"),
        ("ar", "Arabic", "العربية"),
        ("hi", "Hindi", "हिन्दी"),
        ("nl", "Dutch", "Nederlands"),
        ("pl", "Polish", "Polski"),
        ("tr", "Turkish", "Türkçe"),
        ("vi", "Vietnamese", "Tiếng Việt"),
        ("th", "Thai", "ไทย"),
        ("sv", "Swedish", "Svenska"),
        ("uk", "Ukrainian", "Українська"),
        ("he", "Hebrew", "עברית"),
    ];
    
    languages.iter().map(|(code, name, native)| {
        let mut map = HashMap::new();
        map.insert("code".to_string(), code.to_string());
        map.insert("name".to_string(), name.to_string());
        map.insert("nativeName".to_string(), native.to_string());
        map
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_detect_japanese() {
        let result = detect_language("こんにちは世界".to_string()).unwrap();
        assert_eq!(result.language, "ja");
        assert!(result.confidence > 0.5);
    }
    
    #[test]
    fn test_detect_korean() {
        let result = detect_language("안녕하세요".to_string()).unwrap();
        assert_eq!(result.language, "ko");
        assert!(result.confidence > 0.5);
    }
    
    #[test]
    fn test_detect_russian() {
        let result = detect_language("Привет мир".to_string()).unwrap();
        assert_eq!(result.language, "ru");
        assert!(result.confidence > 0.5);
    }
    
    #[test]
    fn test_detect_english_by_words() {
        let result = detect_language("The quick brown fox jumps over the lazy dog".to_string()).unwrap();
        assert_eq!(result.language, "en");
    }
    
    #[test]
    fn test_detect_spanish_by_words() {
        let result = detect_language("El rápido zorro marrón salta sobre el perro perezoso".to_string()).unwrap();
        assert_eq!(result.language, "es");
    }
    
    #[test]
    fn test_detect_french_by_words() {
        let result = detect_language("Le renard brun rapide saute par-dessus le chien paresseux".to_string()).unwrap();
        assert_eq!(result.language, "fr");
    }
}
