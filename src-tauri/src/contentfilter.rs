use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentFilterConfig {
    pub enabled: bool,
    pub mode: FilterMode,
    pub blocked_words: Vec<String>,
    pub blocked_patterns: Vec<String>,
    pub allowed_exceptions: Vec<String>,
    pub filter_categories: Vec<FilterCategory>,
    pub action: FilterAction,
    pub log_filtered: bool,
    pub notify_on_filter: bool,
    pub exempt_roles: Vec<String>,
    pub exempt_channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterMode {
    Strict,
    Moderate,
    Lenient,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterCategory {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub severity: FilterSeverity,
    pub patterns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterAction {
    Hide,
    Blur,
    Warn,
    Replace,
    Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterResult {
    pub filtered: bool,
    pub original_length: usize,
    pub matched_categories: Vec<String>,
    pub matched_words: Vec<String>,
    pub action_taken: FilterAction,
    pub clean_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterLogEntry {
    pub id: String,
    pub timestamp: String,
    pub channel_id: Option<String>,
    pub author_id: Option<String>,
    pub matched_rule: String,
    pub severity: FilterSeverity,
    pub action_taken: FilterAction,
    pub content_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterStats {
    pub total_scanned: u64,
    pub total_filtered: u64,
    pub by_category: std::collections::HashMap<String, u64>,
    pub by_severity: std::collections::HashMap<String, u64>,
    pub false_positives_reported: u64,
}

impl Default for ContentFilterConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: FilterMode::Moderate,
            blocked_words: Vec::new(),
            blocked_patterns: Vec::new(),
            allowed_exceptions: Vec::new(),
            filter_categories: vec![
                FilterCategory {
                    id: "profanity".to_string(),
                    name: "Profanity".to_string(),
                    enabled: true,
                    severity: FilterSeverity::Medium,
                    patterns: Vec::new(),
                },
                FilterCategory {
                    id: "spam".to_string(),
                    name: "Spam / Repetitive".to_string(),
                    enabled: true,
                    severity: FilterSeverity::Low,
                    patterns: vec![
                        r"(.)\1{10,}".to_string(),
                        r"(https?://\S+\s*){5,}".to_string(),
                    ],
                },
                FilterCategory {
                    id: "spoilers".to_string(),
                    name: "Unmarked Spoilers".to_string(),
                    enabled: false,
                    severity: FilterSeverity::Low,
                    patterns: Vec::new(),
                },
                FilterCategory {
                    id: "mentions".to_string(),
                    name: "Excessive Mentions".to_string(),
                    enabled: true,
                    severity: FilterSeverity::Medium,
                    patterns: vec![
                        r"@(everyone|here)".to_string(),
                        r"(<@\d+>\s*){5,}".to_string(),
                    ],
                },
                FilterCategory {
                    id: "links".to_string(),
                    name: "Suspicious Links".to_string(),
                    enabled: true,
                    severity: FilterSeverity::High,
                    patterns: Vec::new(),
                },
            ],
            action: FilterAction::Warn,
            log_filtered: true,
            notify_on_filter: false,
            exempt_roles: Vec::new(),
            exempt_channels: Vec::new(),
        }
    }
}

#[derive(Debug)]
pub struct ContentFilterState {
    pub config: Mutex<ContentFilterConfig>,
    pub stats: Mutex<FilterStats>,
    pub log: Mutex<Vec<FilterLogEntry>>,
}

impl Default for ContentFilterState {
    fn default() -> Self {
        Self {
            config: Mutex::new(ContentFilterConfig::default()),
            stats: Mutex::new(FilterStats {
                total_scanned: 0,
                total_filtered: 0,
                by_category: std::collections::HashMap::new(),
                by_severity: std::collections::HashMap::new(),
                false_positives_reported: 0,
            }),
            log: Mutex::new(Vec::new()),
        }
    }
}

fn check_word_match(content: &str, word: &str) -> bool {
    let lower = content.to_lowercase();
    let word_lower = word.to_lowercase();
    lower.contains(&word_lower)
}

fn check_pattern_match(content: &str, pattern: &str) -> bool {
    regex::Regex::new(pattern)
        .map(|re| re.is_match(content))
        .unwrap_or(false)
}

fn censor_word(content: &str, word: &str) -> String {
    let lower = content.to_lowercase();
    let word_lower = word.to_lowercase();
    let mut result = content.to_string();
    if let Some(pos) = lower.find(&word_lower) {
        let replacement = "*".repeat(word.len());
        result.replace_range(pos..pos + word.len(), &replacement);
    }
    result
}

#[tauri::command]
pub fn filter_get_config(
    state: tauri::State<'_, ContentFilterState>,
) -> Result<ContentFilterConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn filter_update_config(
    state: tauri::State<'_, ContentFilterState>,
    config: ContentFilterConfig,
) -> Result<ContentFilterConfig, String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    Ok(config)
}

#[tauri::command]
pub fn filter_set_enabled(
    state: tauri::State<'_, ContentFilterState>,
    enabled: bool,
) -> Result<bool, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.enabled = enabled;
    Ok(enabled)
}

#[tauri::command]
pub fn filter_check_content(
    state: tauri::State<'_, ContentFilterState>,
    content: String,
    channel_id: Option<String>,
    author_id: Option<String>,
) -> Result<FilterResult, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;

    // Update scan count
    if let Ok(mut stats) = state.stats.lock() {
        stats.total_scanned += 1;
    }

    if !config.enabled {
        return Ok(FilterResult {
            filtered: false,
            original_length: content.len(),
            matched_categories: Vec::new(),
            matched_words: Vec::new(),
            action_taken: FilterAction::Warn,
            clean_content: None,
        });
    }

    // Check exemptions
    if let Some(ref ch) = channel_id {
        if config.exempt_channels.contains(ch) {
            return Ok(FilterResult {
                filtered: false,
                original_length: content.len(),
                matched_categories: Vec::new(),
                matched_words: Vec::new(),
                action_taken: FilterAction::Warn,
                clean_content: None,
            });
        }
    }

    // Check allowed exceptions
    for exception in &config.allowed_exceptions {
        if content.to_lowercase().contains(&exception.to_lowercase()) {
            return Ok(FilterResult {
                filtered: false,
                original_length: content.len(),
                matched_categories: Vec::new(),
                matched_words: Vec::new(),
                action_taken: FilterAction::Warn,
                clean_content: None,
            });
        }
    }

    let mut matched_categories = Vec::new();
    let mut matched_words = Vec::new();
    let mut clean_content = content.clone();

    // Check blocked words
    for word in &config.blocked_words {
        if check_word_match(&content, word) {
            matched_words.push(word.clone());
            clean_content = censor_word(&clean_content, word);
        }
    }

    // Check blocked patterns
    for pattern in &config.blocked_patterns {
        if check_pattern_match(&content, pattern) {
            matched_words.push(format!("pattern:{}", pattern));
        }
    }

    // Check filter categories
    for category in &config.filter_categories {
        if !category.enabled {
            continue;
        }
        for pattern in &category.patterns {
            if check_pattern_match(&content, pattern) {
                if !matched_categories.contains(&category.id) {
                    matched_categories.push(category.id.clone());
                }
            }
        }
    }

    let filtered = !matched_words.is_empty() || !matched_categories.is_empty();

    if filtered {
        if let Ok(mut stats) = state.stats.lock() {
            stats.total_filtered += 1;
            for cat in &matched_categories {
                *stats.by_category.entry(cat.clone()).or_insert(0) += 1;
            }
        }

        // Log if configured
        if config.log_filtered {
            if let Ok(mut log) = state.log.lock() {
                let preview = if content.len() > 50 {
                    format!("{}...", &content[..50])
                } else {
                    content.clone()
                };
                log.push(FilterLogEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    channel_id,
                    author_id,
                    matched_rule: matched_words.first().cloned()
                        .or_else(|| matched_categories.first().cloned())
                        .unwrap_or_default(),
                    severity: FilterSeverity::Medium,
                    action_taken: config.action.clone(),
                    content_preview: preview,
                });
                // Keep log bounded
                if log.len() > 1000 {
                    log.drain(0..500);
                }
            }
        }
    }

    Ok(FilterResult {
        filtered,
        original_length: content.len(),
        matched_categories,
        matched_words,
        action_taken: config.action.clone(),
        clean_content: if filtered { Some(clean_content) } else { None },
    })
}

#[tauri::command]
pub fn filter_add_blocked_word(
    state: tauri::State<'_, ContentFilterState>,
    word: String,
) -> Result<Vec<String>, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if !config.blocked_words.contains(&word) {
        config.blocked_words.push(word);
    }
    Ok(config.blocked_words.clone())
}

#[tauri::command]
pub fn filter_remove_blocked_word(
    state: tauri::State<'_, ContentFilterState>,
    word: String,
) -> Result<Vec<String>, String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.blocked_words.retain(|w| w != &word);
    Ok(config.blocked_words.clone())
}

#[tauri::command]
pub fn filter_get_stats(
    state: tauri::State<'_, ContentFilterState>,
) -> Result<FilterStats, String> {
    let stats = state.stats.lock().map_err(|e| e.to_string())?;
    Ok(stats.clone())
}

#[tauri::command]
pub fn filter_get_log(
    state: tauri::State<'_, ContentFilterState>,
    limit: Option<usize>,
) -> Result<Vec<FilterLogEntry>, String> {
    let log = state.log.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);
    let start = if log.len() > limit { log.len() - limit } else { 0 };
    Ok(log[start..].to_vec())
}

#[tauri::command]
pub fn filter_clear_log(
    state: tauri::State<'_, ContentFilterState>,
) -> Result<(), String> {
    let mut log = state.log.lock().map_err(|e| e.to_string())?;
    log.clear();
    Ok(())
}

#[tauri::command]
pub fn filter_reset_stats(
    state: tauri::State<'_, ContentFilterState>,
) -> Result<(), String> {
    let mut stats = state.stats.lock().map_err(|e| e.to_string())?;
    stats.total_scanned = 0;
    stats.total_filtered = 0;
    stats.by_category.clear();
    stats.by_severity.clear();
    stats.false_positives_reported = 0;
    Ok(())
}

#[tauri::command]
pub fn filter_report_false_positive(
    state: tauri::State<'_, ContentFilterState>,
    log_entry_id: String,
) -> Result<(), String> {
    if let Ok(mut stats) = state.stats.lock() {
        stats.false_positives_reported += 1;
    }
    // Remove from log
    if let Ok(mut log) = state.log.lock() {
        log.retain(|e| e.id != log_entry_id);
    }
    Ok(())
}

#[tauri::command]
pub fn filter_test_content(
    state: tauri::State<'_, ContentFilterState>,
    content: String,
) -> Result<FilterResult, String> {
    filter_check_content(state, content, None, None)
}
