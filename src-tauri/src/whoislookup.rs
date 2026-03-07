use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhoisResult {
    pub domain: String,
    pub registrar: Option<String>,
    pub creation_date: Option<String>,
    pub expiry_date: Option<String>,
    pub updated_date: Option<String>,
    pub name_servers: Vec<String>,
    pub status: Vec<String>,
    pub registrant_country: Option<String>,
    pub dnssec: Option<String>,
    pub raw_text: String,
    pub query_time_ms: u64,
}

fn extract_field<'a>(text: &'a str, keys: &[&str]) -> Option<String> {
    for line in text.lines() {
        let lower = line.to_lowercase();
        for key in keys {
            if lower.starts_with(&key.to_lowercase()) {
                let value = line
                    .splitn(2, ':')
                    .nth(1)
                    .map(|v| v.trim().to_string())
                    .filter(|v| !v.is_empty());
                if value.is_some() {
                    return value;
                }
            }
        }
    }
    None
}

fn extract_multi_field(text: &str, keys: &[&str]) -> Vec<String> {
    let mut results = Vec::new();
    for line in text.lines() {
        let lower = line.to_lowercase();
        for key in keys {
            if lower.starts_with(&key.to_lowercase()) {
                if let Some(value) = line.splitn(2, ':').nth(1) {
                    let trimmed = value.trim().to_string();
                    if !trimmed.is_empty() && !results.contains(&trimmed) {
                        results.push(trimmed);
                    }
                }
            }
        }
    }
    results
}

fn parse_whois_text(domain: &str, text: &str, duration_ms: u64) -> WhoisResult {
    WhoisResult {
        domain: domain.to_string(),
        registrar: extract_field(text, &["registrar:", "registrar name:"]),
        creation_date: extract_field(
            text,
            &["creation date:", "created:", "registration date:", "created date:"],
        ),
        expiry_date: extract_field(
            text,
            &[
                "registry expiry date:",
                "expiry date:",
                "expiration date:",
                "paid-till:",
                "expires:",
            ],
        ),
        updated_date: extract_field(text, &["updated date:", "last updated:", "last modified:"]),
        name_servers: extract_multi_field(text, &["name server:", "nserver:"]),
        status: extract_multi_field(text, &["domain status:", "status:"]),
        registrant_country: extract_field(
            text,
            &["registrant country:", "registrant state/province:"],
        ),
        dnssec: extract_field(text, &["dnssec:"]),
        raw_text: text.to_string(),
        query_time_ms: duration_ms,
    }
}

fn get_whois_server(domain: &str) -> &'static str {
    let tld = domain.rsplit('.').next().unwrap_or("");
    match tld {
        "com" | "net" => "whois.verisign-grs.com",
        "org" => "whois.pir.org",
        "io" => "whois.nic.io",
        "dev" => "whois.nic.google",
        "app" => "whois.nic.google",
        "me" => "whois.nic.me",
        "co" => "whois.nic.co",
        "uk" => "whois.nic.uk",
        "de" => "whois.denic.de",
        "fr" => "whois.nic.fr",
        "nl" => "whois.domain-registry.nl",
        "au" => "whois.auda.org.au",
        "ca" => "whois.cira.ca",
        "info" => "whois.afilias.net",
        "xyz" => "whois.nic.xyz",
        _ => "whois.iana.org",
    }
}

#[tauri::command]
pub async fn whois_lookup(domain: String) -> Result<WhoisResult, String> {
    let start = std::time::Instant::now();

    // Sanitize domain
    let domain = domain
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_start_matches("www.")
        .split('/')
        .next()
        .unwrap_or("")
        .to_lowercase();

    if domain.is_empty() || !domain.contains('.') {
        return Err("Invalid domain name".into());
    }

    let server = get_whois_server(&domain);

    // Connect to WHOIS server via TCP port 43
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;

    let mut stream = TcpStream::connect(format!("{}:43", server))
        .await
        .map_err(|e| format!("Connection failed to {}: {}", server, e))?;

    let query = format!("{}\r\n", domain);
    stream
        .write_all(query.as_bytes())
        .await
        .map_err(|e| format!("Write error: {}", e))?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .await
        .map_err(|e| format!("Read error: {}", e))?;

    let duration_ms = start.elapsed().as_millis() as u64;

    if response.trim().is_empty() {
        return Err("Empty WHOIS response".into());
    }

    Ok(parse_whois_text(&domain, &response, duration_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_whois() {
        let text = "Domain Name: EXAMPLE.COM\nRegistrar: Example Registrar\nCreation Date: 2020-01-01\nName Server: ns1.example.com\nName Server: ns2.example.com\n";
        let result = parse_whois_text("example.com", text, 100);
        assert_eq!(result.domain, "example.com");
        assert_eq!(result.name_servers.len(), 2);
    }

    #[test]
    fn test_whois_server_lookup() {
        assert_eq!(get_whois_server("example.com"), "whois.verisign-grs.com");
        assert_eq!(get_whois_server("example.org"), "whois.pir.org");
        assert_eq!(get_whois_server("example.io"), "whois.nic.io");
    }
}
