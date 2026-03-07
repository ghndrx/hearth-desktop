use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpGeoResult {
    pub query: String,
    pub status: String,
    pub country: String,
    pub country_code: String,
    pub region: String,
    pub region_name: String,
    pub city: String,
    pub zip: String,
    pub lat: f64,
    pub lon: f64,
    pub timezone: String,
    pub isp: String,
    pub org: String,
    pub as_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiResponse {
    query: String,
    status: String,
    country: Option<String>,
    #[serde(rename = "countryCode")]
    country_code: Option<String>,
    region: Option<String>,
    #[serde(rename = "regionName")]
    region_name: Option<String>,
    city: Option<String>,
    zip: Option<String>,
    lat: Option<f64>,
    lon: Option<f64>,
    timezone: Option<String>,
    isp: Option<String>,
    org: Option<String>,
    #[serde(rename = "as")]
    as_field: Option<String>,
}

#[tauri::command]
pub async fn ipgeo_lookup(ip: String) -> Result<IpGeoResult, String> {
    let url = if ip.is_empty() {
        "http://ip-api.com/json/".to_string()
    } else {
        format!("http://ip-api.com/json/{}", ip)
    };

    let resp: ApiResponse = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status == "fail" {
        return Err("Lookup failed: invalid IP or query".to_string());
    }

    Ok(IpGeoResult {
        query: resp.query,
        status: resp.status,
        country: resp.country.unwrap_or_default(),
        country_code: resp.country_code.unwrap_or_default(),
        region: resp.region.unwrap_or_default(),
        region_name: resp.region_name.unwrap_or_default(),
        city: resp.city.unwrap_or_default(),
        zip: resp.zip.unwrap_or_default(),
        lat: resp.lat.unwrap_or(0.0),
        lon: resp.lon.unwrap_or(0.0),
        timezone: resp.timezone.unwrap_or_default(),
        isp: resp.isp.unwrap_or_default(),
        org: resp.org.unwrap_or_default(),
        as_name: resp.as_field.unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_structs_serialize() {
        let result = IpGeoResult {
            query: "8.8.8.8".into(),
            status: "success".into(),
            country: "United States".into(),
            country_code: "US".into(),
            region: "VA".into(),
            region_name: "Virginia".into(),
            city: "Ashburn".into(),
            zip: "20149".into(),
            lat: 39.03,
            lon: -77.5,
            timezone: "America/New_York".into(),
            isp: "Google LLC".into(),
            org: "Google Public DNS".into(),
            as_name: "AS15169 Google LLC".into(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("countryCode"));
        assert!(json.contains("regionName"));
    }
}
