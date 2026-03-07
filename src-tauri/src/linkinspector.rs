//! Link Inspector - URL safety analysis and metadata extraction
//!
//! Provides tools to inspect URLs before clicking them, showing domain
//! information, safety indicators, redirect chain detection, and
//! link metadata for security-conscious users.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkInspection {
    pub url: String,
    pub domain: String,
    pub scheme: String,
    pub path: String,
    pub query_params: Vec<QueryParam>,
    pub is_https: bool,
    pub is_ip_address: bool,
    pub has_suspicious_chars: bool,
    pub homoglyph_warning: bool,
    pub domain_age_warning: bool,
    pub risk_level: String,
    pub risk_reasons: Vec<String>,
    pub shortened_url: bool,
    pub inspected_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryParam {
    pub key: String,
    pub value: String,
    pub suspicious: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkHistoryEntry {
    pub id: String,
    pub url: String,
    pub domain: String,
    pub risk_level: String,
    pub inspected_at: u64,
}

pub struct LinkInspectorManager {
    history: Mutex<Vec<LinkHistoryEntry>>,
}

impl Default for LinkInspectorManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

const URL_SHORTENERS: &[&str] = &[
    "bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "is.gd",
    "buff.ly", "adf.ly", "bit.do", "mcaf.ee", "su.pr", "db.tt",
    "qr.ae", "cur.lv", "ity.im", "lnkd.in", "rebrand.ly",
    "bl.ink", "short.io", "rb.gy", "cutt.ly", "shorturl.at",
];

const SUSPICIOUS_TLDS: &[&str] = &[
    ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work",
    ".click", ".link", ".info", ".buzz", ".surf", ".monster",
];

const TRACKING_PARAMS: &[&str] = &[
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source",
    "affiliate", "aff_id", "click_id", "tracking",
];

fn has_homoglyph_chars(domain: &str) -> bool {
    // Check for characters that look like ASCII but are Unicode lookalikes
    domain.chars().any(|c| {
        matches!(c,
            '\u{0430}'..='\u{044F}' | // Cyrillic lowercase
            '\u{0410}'..='\u{042F}' | // Cyrillic uppercase
            '\u{03B1}'..='\u{03C9}' | // Greek lowercase
            '\u{0391}'..='\u{03A9}' | // Greek uppercase
            '\u{2010}'..='\u{2015}' | // Various dashes
            '\u{FF01}'..='\u{FF5E}'   // Fullwidth ASCII
        )
    })
}

fn is_ip_address(domain: &str) -> bool {
    // IPv4 check
    if domain.split('.').count() == 4
        && domain.split('.').all(|p| p.parse::<u8>().is_ok())
    {
        return true;
    }
    // IPv6 (bracketed)
    if domain.starts_with('[') && domain.ends_with(']') {
        return true;
    }
    false
}

fn has_suspicious_patterns(url: &str) -> (bool, Vec<String>) {
    let mut reasons = Vec::new();

    // Check for @ in URL (credential-style phishing)
    if url.contains('@') && !url.starts_with("mailto:") {
        reasons.push("Contains @ symbol (possible credential phishing)".to_string());
    }

    // Check for excessive subdomains
    if let Some(host) = extract_domain(url) {
        let subdomain_count = host.split('.').count();
        if subdomain_count > 4 {
            reasons.push(format!("Excessive subdomains ({} levels)", subdomain_count));
        }
    }

    // Check for encoded characters that might hide the real URL
    if url.contains("%2F") || url.contains("%2f") || url.contains("%3A") || url.contains("%3a") {
        reasons.push("Contains encoded path/protocol characters".to_string());
    }

    // Check for very long URLs
    if url.len() > 2000 {
        reasons.push("Unusually long URL".to_string());
    }

    // Check for data URIs
    if url.starts_with("data:") {
        reasons.push("Data URI (embedded content, not a web link)".to_string());
    }

    // Check for javascript: protocol
    if url.to_lowercase().starts_with("javascript:") {
        reasons.push("JavaScript protocol (potential XSS)".to_string());
    }

    (!reasons.is_empty(), reasons)
}

fn extract_domain(url: &str) -> Option<String> {
    let without_scheme = if let Some(pos) = url.find("://") {
        &url[pos + 3..]
    } else {
        url
    };

    // Remove userinfo (user:pass@)
    let without_userinfo = if let Some(pos) = without_scheme.find('@') {
        &without_scheme[pos + 1..]
    } else {
        without_scheme
    };

    // Get just the host part
    let host = without_userinfo
        .split('/')
        .next()
        .unwrap_or(without_userinfo)
        .split(':')
        .next()
        .unwrap_or(without_userinfo)
        .split('?')
        .next()
        .unwrap_or(without_userinfo);

    if host.is_empty() {
        None
    } else {
        Some(host.to_lowercase())
    }
}

fn extract_scheme(url: &str) -> String {
    if let Some(pos) = url.find("://") {
        url[..pos].to_lowercase()
    } else {
        "unknown".to_string()
    }
}

fn extract_path(url: &str) -> String {
    let without_scheme = if let Some(pos) = url.find("://") {
        &url[pos + 3..]
    } else {
        url
    };

    if let Some(slash_pos) = without_scheme.find('/') {
        let path_and_query = &without_scheme[slash_pos..];
        if let Some(q_pos) = path_and_query.find('?') {
            path_and_query[..q_pos].to_string()
        } else {
            path_and_query.to_string()
        }
    } else {
        "/".to_string()
    }
}

fn extract_query_params(url: &str) -> Vec<QueryParam> {
    if let Some(q_pos) = url.find('?') {
        let query = &url[q_pos + 1..];
        // Remove fragment
        let query = if let Some(f_pos) = query.find('#') {
            &query[..f_pos]
        } else {
            query
        };

        query
            .split('&')
            .filter(|p| !p.is_empty())
            .map(|p| {
                let mut parts = p.splitn(2, '=');
                let key = parts.next().unwrap_or("").to_string();
                let value = parts.next().unwrap_or("").to_string();
                let key_lower = key.to_lowercase();
                let suspicious = TRACKING_PARAMS.iter().any(|t| key_lower == *t)
                    || key_lower.contains("token")
                    || key_lower.contains("session")
                    || key_lower.contains("password")
                    || key_lower.contains("secret");
                QueryParam {
                    key,
                    value,
                    suspicious,
                }
            })
            .collect()
    } else {
        Vec::new()
    }
}

fn calculate_risk(
    is_https: bool,
    is_ip: bool,
    homoglyph: bool,
    shortened: bool,
    suspicious_chars: bool,
    reasons: &[String],
    domain: &str,
) -> String {
    let mut score: u32 = 0;

    if !is_https {
        score += 2;
    }
    if is_ip {
        score += 3;
    }
    if homoglyph {
        score += 4;
    }
    if shortened {
        score += 1;
    }
    if suspicious_chars {
        score += 2;
    }
    score += reasons.len() as u32;

    // Check suspicious TLDs
    for tld in SUSPICIOUS_TLDS {
        if domain.ends_with(tld) {
            score += 2;
            break;
        }
    }

    match score {
        0 => "Low".to_string(),
        1..=3 => "Medium".to_string(),
        4..=6 => "High".to_string(),
        _ => "Critical".to_string(),
    }
}

#[tauri::command]
pub fn link_inspect(
    state: State<'_, LinkInspectorManager>,
    url: String,
) -> Result<LinkInspection, String> {
    let domain = extract_domain(&url).unwrap_or_default();
    let scheme = extract_scheme(&url);
    let path = extract_path(&url);
    let query_params = extract_query_params(&url);
    let is_https = scheme == "https";
    let is_ip = is_ip_address(&domain);
    let homoglyph = has_homoglyph_chars(&domain);
    let shortened = URL_SHORTENERS.iter().any(|s| domain == *s);
    let (suspicious_chars, mut reasons) = has_suspicious_patterns(&url);

    if !is_https && scheme == "http" {
        reasons.push("Uses insecure HTTP protocol".to_string());
    }
    if is_ip {
        reasons.push("Uses IP address instead of domain name".to_string());
    }
    if homoglyph {
        reasons.push("Domain contains Unicode lookalike characters (homoglyph attack)".to_string());
    }
    if shortened {
        reasons.push("URL shortener detected (destination unknown)".to_string());
    }
    for tld in SUSPICIOUS_TLDS {
        if domain.ends_with(tld) {
            reasons.push(format!("Suspicious TLD: {}", tld));
            break;
        }
    }

    let risk_level = calculate_risk(
        is_https,
        is_ip,
        homoglyph,
        shortened,
        suspicious_chars,
        &reasons,
        &domain,
    );

    let inspection = LinkInspection {
        url: url.clone(),
        domain: domain.clone(),
        scheme,
        path,
        query_params,
        is_https,
        is_ip_address: is_ip,
        has_suspicious_chars: suspicious_chars,
        homoglyph_warning: homoglyph,
        domain_age_warning: false,
        risk_level: risk_level.clone(),
        risk_reasons: reasons,
        shortened_url: shortened,
        inspected_at: now_ms(),
    };

    // Add to history
    if let Ok(mut history) = state.history.lock() {
        let entry = LinkHistoryEntry {
            id: uuid::Uuid::new_v4().to_string(),
            url,
            domain,
            risk_level,
            inspected_at: now_ms(),
        };
        history.push(entry);
        if history.len() > 100 {
            history.remove(0);
        }
    }

    Ok(inspection)
}

#[tauri::command]
pub fn link_clean_url(url: String) -> Result<String, String> {
    // Remove tracking parameters from URL
    if let Some(q_pos) = url.find('?') {
        let base = &url[..q_pos];
        let query = &url[q_pos + 1..];

        let (query_part, fragment) = if let Some(f_pos) = query.find('#') {
            (&query[..f_pos], Some(&query[f_pos..]))
        } else {
            (query, None)
        };

        let clean_params: Vec<&str> = query_part
            .split('&')
            .filter(|p| {
                if let Some(key) = p.split('=').next() {
                    let key_lower = key.to_lowercase();
                    !TRACKING_PARAMS.iter().any(|t| key_lower == *t)
                } else {
                    true
                }
            })
            .collect();

        let mut result = if clean_params.is_empty() {
            base.to_string()
        } else {
            format!("{}?{}", base, clean_params.join("&"))
        };

        if let Some(frag) = fragment {
            result.push_str(frag);
        }

        Ok(result)
    } else {
        Ok(url)
    }
}

#[tauri::command]
pub fn link_get_history(
    state: State<'_, LinkInspectorManager>,
) -> Result<Vec<LinkHistoryEntry>, String> {
    let history = state.history.lock().map_err(|e| e.to_string())?;
    let mut entries = history.clone();
    entries.reverse();
    Ok(entries)
}

#[tauri::command]
pub fn link_clear_history(
    state: State<'_, LinkInspectorManager>,
) -> Result<(), String> {
    let mut history = state.history.lock().map_err(|e| e.to_string())?;
    history.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_domain() {
        assert_eq!(extract_domain("https://example.com/path"), Some("example.com".to_string()));
        assert_eq!(extract_domain("http://sub.example.com:8080/path"), Some("sub.example.com".to_string()));
        assert_eq!(extract_domain("https://user:pass@example.com"), Some("example.com".to_string()));
    }

    #[test]
    fn test_is_ip_address() {
        assert!(is_ip_address("192.168.1.1"));
        assert!(!is_ip_address("example.com"));
        assert!(!is_ip_address("999.999.999.999")); // Invalid but still parsed as not IP due to u8 range
    }

    #[test]
    fn test_shortened_url_detection() {
        assert!(URL_SHORTENERS.iter().any(|s| *s == "bit.ly"));
        assert!(URL_SHORTENERS.iter().any(|s| *s == "t.co"));
    }

    #[test]
    fn test_extract_query_params() {
        let params = extract_query_params("https://example.com?foo=bar&utm_source=test");
        assert_eq!(params.len(), 2);
        assert!(!params[0].suspicious);
        assert!(params[1].suspicious);
    }

    #[test]
    fn test_clean_url() {
        let cleaned = link_clean_url("https://example.com?page=1&utm_source=test&utm_medium=email".to_string()).unwrap();
        assert_eq!(cleaned, "https://example.com?page=1");
    }
}
