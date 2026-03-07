//! Weather Widget - shows current weather conditions using the Open-Meteo API
//!
//! Uses the free Open-Meteo geocoding + weather APIs (no API key required).
//! Users can search for a city and pin it to see live weather updates.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherLocation {
    pub name: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub location: WeatherLocation,
    pub temperature_c: f64,
    pub temperature_f: f64,
    pub weather_code: u32,
    pub weather_description: String,
    pub wind_speed_kmh: f64,
    pub humidity: f64,
    pub is_day: bool,
    pub fetched_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoResult {
    pub name: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
    pub admin1: Option<String>,
}

pub struct WeatherManager {
    saved_location: Mutex<Option<WeatherLocation>>,
    cached_weather: Mutex<Option<WeatherData>>,
}

impl Default for WeatherManager {
    fn default() -> Self {
        Self {
            saved_location: Mutex::new(None),
            cached_weather: Mutex::new(None),
        }
    }
}

fn weather_code_description(code: u32) -> &'static str {
    match code {
        0 => "Clear sky",
        1 => "Mainly clear",
        2 => "Partly cloudy",
        3 => "Overcast",
        45 | 48 => "Foggy",
        51 | 53 | 55 => "Drizzle",
        56 | 57 => "Freezing drizzle",
        61 | 63 | 65 => "Rain",
        66 | 67 => "Freezing rain",
        71 | 73 | 75 => "Snow",
        77 => "Snow grains",
        80 | 81 | 82 => "Rain showers",
        85 | 86 => "Snow showers",
        95 => "Thunderstorm",
        96 | 99 => "Thunderstorm with hail",
        _ => "Unknown",
    }
}

fn now_epoch() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// --- Tauri commands ---

#[tauri::command]
pub async fn weather_search_city(query: String) -> Result<Vec<GeoResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=5&language=en&format=json",
        urlencoding::encode(&query)
    );

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let results = body
        .get("results")
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();

    let geo_results: Vec<GeoResult> = results
        .iter()
        .filter_map(|r| {
            Some(GeoResult {
                name: r.get("name")?.as_str()?.to_string(),
                country: r.get("country").and_then(|c| c.as_str()).unwrap_or("").to_string(),
                latitude: r.get("latitude")?.as_f64()?,
                longitude: r.get("longitude")?.as_f64()?,
                admin1: r.get("admin1").and_then(|a| a.as_str()).map(String::from),
            })
        })
        .collect();

    Ok(geo_results)
}

#[tauri::command]
pub async fn weather_fetch(
    manager: tauri::State<'_, WeatherManager>,
    latitude: f64,
    longitude: f64,
    name: String,
    country: String,
) -> Result<WeatherData, String> {
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
        latitude, longitude
    );

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let current = body
        .get("current")
        .ok_or("Missing current weather data")?;

    let temp_c = current
        .get("temperature_2m")
        .and_then(|t| t.as_f64())
        .unwrap_or(0.0);

    let weather_code = current
        .get("weather_code")
        .and_then(|c| c.as_u64())
        .unwrap_or(0) as u32;

    let location = WeatherLocation {
        name: name.clone(),
        country: country.clone(),
        latitude,
        longitude,
    };

    let data = WeatherData {
        location: location.clone(),
        temperature_c: temp_c,
        temperature_f: temp_c * 9.0 / 5.0 + 32.0,
        weather_code,
        weather_description: weather_code_description(weather_code).to_string(),
        wind_speed_kmh: current.get("wind_speed_10m").and_then(|w| w.as_f64()).unwrap_or(0.0),
        humidity: current.get("relative_humidity_2m").and_then(|h| h.as_f64()).unwrap_or(0.0),
        is_day: current.get("is_day").and_then(|d| d.as_u64()).unwrap_or(1) == 1,
        fetched_at: now_epoch(),
    };

    if let Ok(mut cached) = manager.cached_weather.lock() {
        *cached = Some(data.clone());
    }

    Ok(data)
}

#[tauri::command]
pub fn weather_set_location(
    manager: tauri::State<'_, WeatherManager>,
    name: String,
    country: String,
    latitude: f64,
    longitude: f64,
) -> Result<(), String> {
    if let Ok(mut loc) = manager.saved_location.lock() {
        *loc = Some(WeatherLocation {
            name,
            country,
            latitude,
            longitude,
        });
    }
    Ok(())
}

#[tauri::command]
pub fn weather_get_location(
    manager: tauri::State<'_, WeatherManager>,
) -> Result<Option<WeatherLocation>, String> {
    Ok(manager.saved_location.lock().ok().and_then(|l| l.clone()))
}

#[tauri::command]
pub fn weather_get_cached(
    manager: tauri::State<'_, WeatherManager>,
) -> Result<Option<WeatherData>, String> {
    Ok(manager.cached_weather.lock().ok().and_then(|c| c.clone()))
}

#[tauri::command]
pub fn weather_clear_location(
    manager: tauri::State<'_, WeatherManager>,
) -> Result<(), String> {
    if let Ok(mut loc) = manager.saved_location.lock() {
        *loc = None;
    }
    if let Ok(mut cached) = manager.cached_weather.lock() {
        *cached = None;
    }
    Ok(())
}
