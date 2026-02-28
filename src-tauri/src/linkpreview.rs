//! Native link preview / URL metadata extraction
//!
//! Fetches URLs and parses Open Graph, Twitter Card, and HTML meta tags
//! to produce rich link previews. This runs natively through Rust's reqwest
//! to bypass CORS restrictions that the webview would face.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Cached previews to avoid re-fetching
static PREVIEW_CACHE: RwLock<Option<HashMap<String, CachedPreview>>> = RwLock::new(None);

/// Cache TTL in seconds (10 minutes)
const CACHE_TTL_SECS: u64 = 600;

struct CachedPreview {
    data: LinkPreview,
    fetched_at: u64,
}

/// Rich link preview metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkPreview {
    /// The original URL
    pub url: String,
    /// Page title (og:title or <title>)
    pub title: Option<String>,
    /// Page description (og:description or meta description)
    pub description: Option<String>,
    /// Preview image URL (og:image)
    pub image: Option<String>,
    /// Site name (og:site_name)
    pub site_name: Option<String>,
    /// Favicon URL
    pub favicon: Option<String>,
    /// Content type hint (article, video, music, website)
    pub content_type: Option<String>,
    /// Theme color from meta tag
    pub theme_color: Option<String>,
    /// Video embed URL if present (og:video)
    pub video_url: Option<String>,
    /// Author name if present
    pub author: Option<String>,
    /// Published date if present
    pub published: Option<String>,
}

/// Fetch metadata for a URL and return a rich link preview
#[tauri::command]
pub async fn fetch_link_preview(url: String) -> Result<LinkPreview, String> {
    // Check cache first
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    {
        let cache = PREVIEW_CACHE.read().unwrap();
        if let Some(ref map) = *cache {
            if let Some(cached) = map.get(&url) {
                if now - cached.fetched_at < CACHE_TTL_SECS {
                    return Ok(cached.data.clone());
                }
            }
        }
    }

    // Fetch the URL
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("HearthDesktop/1.0 (Link Preview)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    let final_url = response.url().to_string();
    let content_type_header = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    // Only parse HTML pages
    if !content_type_header.contains("text/html") {
        return Ok(LinkPreview {
            url: final_url,
            title: None,
            description: None,
            image: None,
            site_name: None,
            favicon: None,
            content_type: Some(content_type_header),
            theme_color: None,
            video_url: None,
            author: None,
            published: None,
        });
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let preview = parse_html_metadata(&final_url, &html);

    // Store in cache
    {
        let mut cache = PREVIEW_CACHE.write().unwrap();
        let map = cache.get_or_insert_with(HashMap::new);
        map.insert(
            url,
            CachedPreview {
                data: preview.clone(),
                fetched_at: now,
            },
        );

        // Evict stale entries if cache grows large
        if map.len() > 200 {
            map.retain(|_, v| now - v.fetched_at < CACHE_TTL_SECS);
        }
    }

    Ok(preview)
}

/// Fetch previews for multiple URLs concurrently
#[tauri::command]
pub async fn fetch_link_previews(urls: Vec<String>) -> Vec<Result<LinkPreview, String>> {
    let futures: Vec<_> = urls.into_iter().map(|url| fetch_link_preview(url)).collect();
    futures::future::join_all(futures).await
}

/// Clear the link preview cache
#[tauri::command]
pub fn clear_link_preview_cache() {
    let mut cache = PREVIEW_CACHE.write().unwrap();
    *cache = None;
}

/// Parse HTML to extract Open Graph, Twitter Card, and standard meta tags
fn parse_html_metadata(url: &str, html: &str) -> LinkPreview {
    let mut title = None;
    let mut description = None;
    let mut image = None;
    let mut site_name = None;
    let mut favicon = None;
    let mut content_type = None;
    let mut theme_color = None;
    let mut video_url = None;
    let mut author = None;
    let mut published = None;
    let mut html_title = None;

    // Simple tag-by-tag HTML parsing (no heavy dependency)
    // We look for <meta> and <title> tags in the <head>
    let lower = html.to_lowercase();

    // Extract <title>...</title>
    if let Some(start) = lower.find("<title") {
        if let Some(tag_end) = lower[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = lower[content_start..].find("</title>") {
                let raw = &html[content_start..content_start + end];
                html_title = Some(decode_html_entities(raw.trim()));
            }
        }
    }

    // Extract <meta> tags
    let mut search_pos = 0;
    while let Some(meta_start) = lower[search_pos..].find("<meta") {
        let abs_start = search_pos + meta_start;
        let tag_end = match lower[abs_start..].find('>') {
            Some(end) => abs_start + end,
            None => break,
        };
        let tag = &html[abs_start..=tag_end];

        let property = extract_attr(tag, "property")
            .or_else(|| extract_attr(tag, "name"))
            .unwrap_or_default()
            .to_lowercase();
        let content = extract_attr(tag, "content");

        if let Some(ref content_val) = content {
            match property.as_str() {
                "og:title" => title = Some(decode_html_entities(content_val)),
                "og:description" => description = Some(decode_html_entities(content_val)),
                "og:image" => image = Some(resolve_url(url, content_val)),
                "og:site_name" => site_name = Some(decode_html_entities(content_val)),
                "og:type" => content_type = Some(content_val.clone()),
                "og:video" | "og:video:url" => video_url = Some(content_val.clone()),
                "twitter:title" if title.is_none() => {
                    title = Some(decode_html_entities(content_val))
                }
                "twitter:description" if description.is_none() => {
                    description = Some(decode_html_entities(content_val))
                }
                "twitter:image" if image.is_none() => {
                    image = Some(resolve_url(url, content_val))
                }
                "description" if description.is_none() => {
                    description = Some(decode_html_entities(content_val))
                }
                "theme-color" => theme_color = Some(content_val.clone()),
                "author" => author = Some(decode_html_entities(content_val)),
                "article:published_time" | "date" => {
                    published = Some(content_val.clone())
                }
                _ => {}
            }
        }

        search_pos = tag_end + 1;
    }

    // Extract favicon from <link rel="icon" ...>
    search_pos = 0;
    while let Some(link_start) = lower[search_pos..].find("<link") {
        let abs_start = search_pos + link_start;
        let tag_end = match lower[abs_start..].find('>') {
            Some(end) => abs_start + end,
            None => break,
        };
        let tag = &html[abs_start..=tag_end];
        let rel = extract_attr(tag, "rel").unwrap_or_default().to_lowercase();

        if rel.contains("icon") {
            if let Some(href) = extract_attr(tag, "href") {
                favicon = Some(resolve_url(url, &href));
            }
        }

        search_pos = tag_end + 1;
    }

    // Fall back to default favicon path
    if favicon.is_none() {
        if let Ok(parsed) = url::Url::parse(url) {
            favicon = Some(format!("{}://{}/favicon.ico", parsed.scheme(), parsed.host_str().unwrap_or("")));
        }
    }

    // Use HTML title as fallback
    if title.is_none() {
        title = html_title;
    }

    LinkPreview {
        url: url.to_string(),
        title,
        description,
        image,
        site_name,
        favicon,
        content_type,
        theme_color,
        video_url,
        author,
        published,
    }
}

/// Extract an attribute value from an HTML tag string
fn extract_attr(tag: &str, attr_name: &str) -> Option<String> {
    let lower_tag = tag.to_lowercase();
    let search = format!("{}=", attr_name);

    let pos = lower_tag.find(&search)?;
    let after_eq = pos + search.len();
    let rest = &tag[after_eq..];
    let trimmed = rest.trim_start();

    if trimmed.starts_with('"') {
        let content = &trimmed[1..];
        let end = content.find('"')?;
        Some(content[..end].to_string())
    } else if trimmed.starts_with('\'') {
        let content = &trimmed[1..];
        let end = content.find('\'')?;
        Some(content[..end].to_string())
    } else {
        // Unquoted value — take until whitespace or >
        let end = trimmed
            .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
            .unwrap_or(trimmed.len());
        Some(trimmed[..end].to_string())
    }
}

/// Resolve a possibly-relative URL against a base URL
fn resolve_url(base: &str, href: &str) -> String {
    if href.starts_with("http://") || href.starts_with("https://") || href.starts_with("//") {
        if href.starts_with("//") {
            return format!("https:{}", href);
        }
        return href.to_string();
    }

    if let Ok(base_url) = url::Url::parse(base) {
        if let Ok(resolved) = base_url.join(href) {
            return resolved.to_string();
        }
    }

    href.to_string()
}

/// Basic HTML entity decoding
fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&apos;", "'")
        .replace("&#x2F;", "/")
        .replace("&nbsp;", " ")
}
