//! Regex Tester - Test regular expressions with Rust's regex engine
//!
//! Provides:
//! - Pattern matching with capture groups
//! - Match highlighting with positions
//! - Pattern validation with error details
//! - Replace operations (first match and global)

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegexMatch {
    pub full_match: String,
    pub start: usize,
    pub end: usize,
    pub groups: Vec<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegexTestResult {
    pub valid: bool,
    pub matches: Vec<RegexMatch>,
    pub match_count: usize,
    pub execution_time_us: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegexValidation {
    pub valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegexReplaceResult {
    pub output: String,
    pub replacements: usize,
}

#[tauri::command]
pub fn regex_test(pattern: String, text: String, case_insensitive: Option<bool>) -> Result<RegexTestResult, String> {
    let start = std::time::Instant::now();

    let pat = if case_insensitive.unwrap_or(false) {
        format!("(?i){}", pattern)
    } else {
        pattern
    };

    let re = regex::Regex::new(&pat).map_err(|e| format!("Invalid regex: {}", e))?;

    let mut matches = Vec::new();
    for caps in re.captures_iter(&text) {
        let full = caps.get(0).unwrap();
        let groups: Vec<Option<String>> = (1..caps.len())
            .map(|i| caps.get(i).map(|m| m.as_str().to_string()))
            .collect();

        matches.push(RegexMatch {
            full_match: full.as_str().to_string(),
            start: full.start(),
            end: full.end(),
            groups,
        });
    }

    let match_count = matches.len();
    let elapsed = start.elapsed().as_micros() as u64;

    Ok(RegexTestResult {
        valid: true,
        matches,
        match_count,
        execution_time_us: elapsed,
    })
}

#[tauri::command]
pub fn regex_validate(pattern: String) -> RegexValidation {
    match regex::Regex::new(&pattern) {
        Ok(_) => RegexValidation {
            valid: true,
            error: None,
        },
        Err(e) => RegexValidation {
            valid: false,
            error: Some(e.to_string()),
        },
    }
}

#[tauri::command]
pub fn regex_replace(
    pattern: String,
    text: String,
    replacement: String,
    global: Option<bool>,
    case_insensitive: Option<bool>,
) -> Result<RegexReplaceResult, String> {
    let pat = if case_insensitive.unwrap_or(false) {
        format!("(?i){}", pattern)
    } else {
        pattern
    };

    let re = regex::Regex::new(&pat).map_err(|e| format!("Invalid regex: {}", e))?;

    if global.unwrap_or(true) {
        let count = re.find_iter(&text).count();
        let output = re.replace_all(&text, replacement.as_str()).to_string();
        Ok(RegexReplaceResult {
            output,
            replacements: count,
        })
    } else {
        let had_match = re.is_match(&text);
        let output = re.replace(&text, replacement.as_str()).to_string();
        Ok(RegexReplaceResult {
            output,
            replacements: if had_match { 1 } else { 0 },
        })
    }
}
