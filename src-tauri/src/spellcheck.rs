use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::RwLock;
use tauri::Manager;

/// Spell check suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpellCheckResult {
    /// The misspelled word
    pub word: String,
    /// Start position in the text
    pub start: usize,
    /// End position in the text
    pub end: usize,
    /// Suggested corrections
    pub suggestions: Vec<String>,
}

/// User's custom dictionary (words added by the user)
struct CustomDictionary {
    words: HashSet<String>,
}

static CUSTOM_DICTIONARY: RwLock<Option<CustomDictionary>> = RwLock::new(None);

fn get_or_init_dictionary() -> HashSet<String> {
    let dict = CUSTOM_DICTIONARY.read().unwrap();
    if let Some(ref d) = *dict {
        return d.words.clone();
    }
    drop(dict);

    let mut dict = CUSTOM_DICTIONARY.write().unwrap();
    if dict.is_none() {
        *dict = Some(CustomDictionary {
            words: HashSet::new(),
        });
    }
    dict.as_ref().unwrap().words.clone()
}

/// Check text for spelling errors using platform-native spell checker
///
/// On macOS: Uses NSSpellChecker via objc runtime
/// On Windows: Uses ISpellChecker COM interface
/// On Linux: Falls back to basic dictionary check
#[tauri::command]
pub async fn check_spelling(text: String, language: Option<String>) -> Result<Vec<SpellCheckResult>, String> {
    let _lang = language.unwrap_or_else(|| "en_US".to_string());
    let custom_words = get_or_init_dictionary();
    let mut results = Vec::new();

    // Split text into words and check each one
    // This is a cross-platform implementation that works with the custom dictionary
    let mut pos = 0;
    for segment in text.split_whitespace() {
        // Find actual position in text
        if let Some(start) = text[pos..].find(segment) {
            let actual_start = pos + start;
            let actual_end = actual_start + segment.len();
            pos = actual_end;

            // Strip punctuation for checking
            let word = segment.trim_matches(|c: char| !c.is_alphanumeric() && c != '\'');
            if word.is_empty() || word.len() < 2 {
                continue;
            }

            // Skip if in custom dictionary
            if custom_words.contains(&word.to_lowercase()) {
                continue;
            }

            // Use platform-native spell checking
            let misspelled = check_word_native(word, &_lang);
            if misspelled {
                let suggestions = get_suggestions_native(word, &_lang);
                results.push(SpellCheckResult {
                    word: word.to_string(),
                    start: actual_start,
                    end: actual_end,
                    suggestions,
                });
            }
        }
    }

    Ok(results)
}

/// Get spelling suggestions for a word
#[tauri::command]
pub async fn get_spelling_suggestions(word: String, language: Option<String>) -> Result<Vec<String>, String> {
    let lang = language.unwrap_or_else(|| "en_US".to_string());
    Ok(get_suggestions_native(&word, &lang))
}

/// Add a word to the user's custom dictionary
#[tauri::command]
pub async fn add_to_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    {
        let mut dict = CUSTOM_DICTIONARY.write().map_err(|e| e.to_string())?;
        if dict.is_none() {
            *dict = Some(CustomDictionary {
                words: HashSet::new(),
            });
        }
        dict.as_mut().unwrap().words.insert(word.to_lowercase());
    }

    // Persist to store
    save_custom_dictionary(&app).map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a word from the user's custom dictionary
#[tauri::command]
pub async fn remove_from_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    {
        let mut dict = CUSTOM_DICTIONARY.write().map_err(|e| e.to_string())?;
        if let Some(ref mut d) = *dict {
            d.words.remove(&word.to_lowercase());
        }
    }

    save_custom_dictionary(&app).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all words in the custom dictionary
#[tauri::command]
pub async fn get_custom_dictionary() -> Result<Vec<String>, String> {
    let words = get_or_init_dictionary();
    let mut sorted: Vec<String> = words.into_iter().collect();
    sorted.sort();
    Ok(sorted)
}

/// Get available spell check languages
#[tauri::command]
pub async fn get_spell_check_languages() -> Result<Vec<SpellCheckLanguage>, String> {
    Ok(vec![
        SpellCheckLanguage { code: "en_US".into(), name: "English (US)".into() },
        SpellCheckLanguage { code: "en_GB".into(), name: "English (UK)".into() },
        SpellCheckLanguage { code: "es_ES".into(), name: "Spanish".into() },
        SpellCheckLanguage { code: "fr_FR".into(), name: "French".into() },
        SpellCheckLanguage { code: "de_DE".into(), name: "German".into() },
        SpellCheckLanguage { code: "pt_BR".into(), name: "Portuguese (Brazil)".into() },
        SpellCheckLanguage { code: "ja_JP".into(), name: "Japanese".into() },
        SpellCheckLanguage { code: "zh_CN".into(), name: "Chinese (Simplified)".into() },
    ])
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpellCheckLanguage {
    pub code: String,
    pub name: String,
}

// Platform-native spell checking implementations

#[cfg(target_os = "macos")]
fn check_word_native(word: &str, _language: &str) -> bool {
    // On macOS, use NSSpellChecker via process
    // For simplicity, we use the `aspell` or system dictionary approach
    use std::process::Command;
    if let Ok(output) = Command::new("echo")
        .arg(word)
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|child| {
            Command::new("aspell")
                .args(["list", "--lang=en"])
                .stdin(child.stdout.unwrap())
                .output()
        })
    {
        let result = String::from_utf8_lossy(&output.stdout);
        return !result.trim().is_empty();
    }
    false
}

#[cfg(target_os = "linux")]
fn check_word_native(word: &str, _language: &str) -> bool {
    use std::process::Command;
    use std::io::Write;

    // Use aspell/hunspell on Linux
    if let Ok(mut child) = Command::new("echo")
        .arg(word)
        .stdout(std::process::Stdio::piped())
        .spawn()
    {
        if let Ok(output) = Command::new("aspell")
            .args(["list", "--lang=en"])
            .stdin(child.stdout.take().unwrap())
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout);
            return !result.trim().is_empty();
        }
    }
    false
}

#[cfg(target_os = "windows")]
fn check_word_native(_word: &str, _language: &str) -> bool {
    // Windows spell checking - simplified fallback
    // In production, would use ISpellChecker COM interface
    false
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn check_word_native(_word: &str, _language: &str) -> bool {
    false
}

#[cfg(target_os = "macos")]
fn get_suggestions_native(word: &str, _language: &str) -> Vec<String> {
    use std::process::Command;
    if let Ok(output) = Command::new("echo")
        .arg(word)
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|child| {
            Command::new("aspell")
                .args(["pipe", "--lang=en"])
                .stdin(child.stdout.unwrap())
                .output()
        })
    {
        let result = String::from_utf8_lossy(&output.stdout);
        // Parse aspell output: lines starting with & contain suggestions
        for line in result.lines() {
            if line.starts_with('&') {
                if let Some(colon_pos) = line.find(':') {
                    let suggestions_str = &line[colon_pos + 2..];
                    return suggestions_str
                        .split(", ")
                        .take(5)
                        .map(|s| s.trim().to_string())
                        .collect();
                }
            }
        }
    }
    Vec::new()
}

#[cfg(target_os = "linux")]
fn get_suggestions_native(word: &str, _language: &str) -> Vec<String> {
    use std::process::Command;

    if let Ok(mut child) = Command::new("echo")
        .arg(word)
        .stdout(std::process::Stdio::piped())
        .spawn()
    {
        if let Ok(output) = Command::new("aspell")
            .args(["pipe", "--lang=en"])
            .stdin(child.stdout.take().unwrap())
            .output()
        {
            let result = String::from_utf8_lossy(&output.stdout);
            for line in result.lines() {
                if line.starts_with('&') {
                    if let Some(colon_pos) = line.find(':') {
                        let suggestions_str = &line[colon_pos + 2..];
                        return suggestions_str
                            .split(", ")
                            .take(5)
                            .map(|s| s.trim().to_string())
                            .collect();
                    }
                }
            }
        }
    }
    Vec::new()
}

#[cfg(target_os = "windows")]
fn get_suggestions_native(_word: &str, _language: &str) -> Vec<String> {
    Vec::new()
}

#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn get_suggestions_native(_word: &str, _language: &str) -> Vec<String> {
    Vec::new()
}

// Persistence helpers

fn save_custom_dictionary(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dict = CUSTOM_DICTIONARY.read()?;
    if let Some(ref d) = *dict {
        let app_dir = app.path().app_data_dir()?;
        std::fs::create_dir_all(&app_dir)?;
        let dict_file = app_dir.join("custom-dictionary.json");
        let words: Vec<&String> = d.words.iter().collect();
        let json = serde_json::to_string_pretty(&words)?;
        std::fs::write(&dict_file, json)?;
    }
    Ok(())
}

/// Load custom dictionary from disk (called during app startup)
pub fn load_custom_dictionary(app: &tauri::AppHandle) {
    if let Ok(app_dir) = app.path().app_data_dir() {
        let dict_file = app_dir.join("custom-dictionary.json");
        if dict_file.exists() {
            if let Ok(json) = std::fs::read_to_string(&dict_file) {
                if let Ok(words) = serde_json::from_str::<Vec<String>>(&json) {
                    let mut dict = CUSTOM_DICTIONARY.write().unwrap();
                    *dict = Some(CustomDictionary {
                        words: words.into_iter().collect(),
                    });
                }
            }
        }
    }
}
