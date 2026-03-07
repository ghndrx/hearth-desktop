use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub body_size_bytes: usize,
    pub elapsed_ms: u64,
    pub url: String,
    pub method: String,
}

#[tauri::command]
pub async fn httptester_request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    // Only allow http/https schemes
    let parsed = url::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    match parsed.scheme() {
        "http" | "https" => {}
        other => return Err(format!("Unsupported scheme: {}", other)),
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let method_upper = method.to_uppercase();
    let req_method = match method_upper.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "PATCH" => reqwest::Method::PATCH,
        "DELETE" => reqwest::Method::DELETE,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    let mut req = client.request(req_method, &url);

    if let Some(hdrs) = &headers {
        for (k, v) in hdrs {
            req = req.header(k.as_str(), v.as_str());
        }
    }

    if let Some(b) = &body {
        req = req.body(b.clone());
    }

    let start = std::time::Instant::now();
    let resp = req.send().await.map_err(|e| format!("Request failed: {}", e))?;
    let elapsed_ms = start.elapsed().as_millis() as u64;

    let status = resp.status().as_u16();
    let status_text = resp.status().canonical_reason().unwrap_or("").to_string();

    let mut resp_headers = HashMap::new();
    for (k, v) in resp.headers().iter() {
        if let Ok(val) = v.to_str() {
            resp_headers.insert(k.to_string(), val.to_string());
        }
    }

    let resp_url = resp.url().to_string();
    let body_bytes = resp.bytes().await.map_err(|e| format!("Body read error: {}", e))?;
    let body_size = body_bytes.len();

    // Truncate body to 500KB for display
    let body_text = if body_size > 512_000 {
        let truncated = String::from_utf8_lossy(&body_bytes[..512_000]);
        format!("{}...\n[Truncated: {} bytes total]", truncated, body_size)
    } else {
        String::from_utf8_lossy(&body_bytes).to_string()
    };

    Ok(HttpResponse {
        status,
        status_text,
        headers: resp_headers,
        body: body_text,
        body_size_bytes: body_size,
        elapsed_ms,
        url: resp_url,
        method: method_upper,
    })
}
