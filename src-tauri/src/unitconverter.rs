//! Unit Converter - Convert between various measurement units
//!
//! Supports: length, weight, temperature, data size, time, and speed

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionResult {
    pub from_value: f64,
    pub from_unit: String,
    pub to_value: f64,
    pub to_unit: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitCategory {
    pub name: String,
    pub units: Vec<String>,
}

#[tauri::command]
pub fn unit_convert(value: f64, from: String, to: String, category: String) -> Result<ConversionResult, String> {
    let base = to_base(value, &from, &category)?;
    let result = from_base(base, &to, &category)?;

    Ok(ConversionResult {
        from_value: value,
        from_unit: from,
        to_value: result,
        to_unit: to,
        category,
    })
}

#[tauri::command]
pub fn unit_get_categories() -> Vec<UnitCategory> {
    vec![
        UnitCategory {
            name: "Length".into(),
            units: vec!["m", "km", "cm", "mm", "mi", "yd", "ft", "in"]
                .into_iter().map(String::from).collect(),
        },
        UnitCategory {
            name: "Weight".into(),
            units: vec!["kg", "g", "mg", "lb", "oz", "ton"]
                .into_iter().map(String::from).collect(),
        },
        UnitCategory {
            name: "Temperature".into(),
            units: vec!["C", "F", "K"]
                .into_iter().map(String::from).collect(),
        },
        UnitCategory {
            name: "Data".into(),
            units: vec!["B", "KB", "MB", "GB", "TB", "PB"]
                .into_iter().map(String::from).collect(),
        },
        UnitCategory {
            name: "Time".into(),
            units: vec!["s", "ms", "min", "hr", "day", "week"]
                .into_iter().map(String::from).collect(),
        },
        UnitCategory {
            name: "Speed".into(),
            units: vec!["m/s", "km/h", "mph", "knot"]
                .into_iter().map(String::from).collect(),
        },
    ]
}

fn to_base(value: f64, unit: &str, category: &str) -> Result<f64, String> {
    match category {
        "Length" => match unit {
            "m" => Ok(value),
            "km" => Ok(value * 1000.0),
            "cm" => Ok(value / 100.0),
            "mm" => Ok(value / 1000.0),
            "mi" => Ok(value * 1609.344),
            "yd" => Ok(value * 0.9144),
            "ft" => Ok(value * 0.3048),
            "in" => Ok(value * 0.0254),
            _ => Err(format!("Unknown length unit: {}", unit)),
        },
        "Weight" => match unit {
            "kg" => Ok(value),
            "g" => Ok(value / 1000.0),
            "mg" => Ok(value / 1_000_000.0),
            "lb" => Ok(value * 0.453592),
            "oz" => Ok(value * 0.0283495),
            "ton" => Ok(value * 907.185),
            _ => Err(format!("Unknown weight unit: {}", unit)),
        },
        "Temperature" => match unit {
            "C" => Ok(value),
            "F" => Ok((value - 32.0) * 5.0 / 9.0),
            "K" => Ok(value - 273.15),
            _ => Err(format!("Unknown temperature unit: {}", unit)),
        },
        "Data" => match unit {
            "B" => Ok(value),
            "KB" => Ok(value * 1024.0),
            "MB" => Ok(value * 1024.0 * 1024.0),
            "GB" => Ok(value * 1024.0 * 1024.0 * 1024.0),
            "TB" => Ok(value * 1024.0_f64.powi(4)),
            "PB" => Ok(value * 1024.0_f64.powi(5)),
            _ => Err(format!("Unknown data unit: {}", unit)),
        },
        "Time" => match unit {
            "s" => Ok(value),
            "ms" => Ok(value / 1000.0),
            "min" => Ok(value * 60.0),
            "hr" => Ok(value * 3600.0),
            "day" => Ok(value * 86400.0),
            "week" => Ok(value * 604800.0),
            _ => Err(format!("Unknown time unit: {}", unit)),
        },
        "Speed" => match unit {
            "m/s" => Ok(value),
            "km/h" => Ok(value / 3.6),
            "mph" => Ok(value * 0.44704),
            "knot" => Ok(value * 0.514444),
            _ => Err(format!("Unknown speed unit: {}", unit)),
        },
        _ => Err(format!("Unknown category: {}", category)),
    }
}

fn from_base(value: f64, unit: &str, category: &str) -> Result<f64, String> {
    match category {
        "Length" => match unit {
            "m" => Ok(value),
            "km" => Ok(value / 1000.0),
            "cm" => Ok(value * 100.0),
            "mm" => Ok(value * 1000.0),
            "mi" => Ok(value / 1609.344),
            "yd" => Ok(value / 0.9144),
            "ft" => Ok(value / 0.3048),
            "in" => Ok(value / 0.0254),
            _ => Err(format!("Unknown length unit: {}", unit)),
        },
        "Weight" => match unit {
            "kg" => Ok(value),
            "g" => Ok(value * 1000.0),
            "mg" => Ok(value * 1_000_000.0),
            "lb" => Ok(value / 0.453592),
            "oz" => Ok(value / 0.0283495),
            "ton" => Ok(value / 907.185),
            _ => Err(format!("Unknown weight unit: {}", unit)),
        },
        "Temperature" => match unit {
            "C" => Ok(value),
            "F" => Ok(value * 9.0 / 5.0 + 32.0),
            "K" => Ok(value + 273.15),
            _ => Err(format!("Unknown temperature unit: {}", unit)),
        },
        "Data" => match unit {
            "B" => Ok(value),
            "KB" => Ok(value / 1024.0),
            "MB" => Ok(value / (1024.0 * 1024.0)),
            "GB" => Ok(value / (1024.0 * 1024.0 * 1024.0)),
            "TB" => Ok(value / 1024.0_f64.powi(4)),
            "PB" => Ok(value / 1024.0_f64.powi(5)),
            _ => Err(format!("Unknown data unit: {}", unit)),
        },
        "Time" => match unit {
            "s" => Ok(value),
            "ms" => Ok(value * 1000.0),
            "min" => Ok(value / 60.0),
            "hr" => Ok(value / 3600.0),
            "day" => Ok(value / 86400.0),
            "week" => Ok(value / 604800.0),
            _ => Err(format!("Unknown time unit: {}", unit)),
        },
        "Speed" => match unit {
            "m/s" => Ok(value),
            "km/h" => Ok(value * 3.6),
            "mph" => Ok(value / 0.44704),
            "knot" => Ok(value / 0.514444),
            _ => Err(format!("Unknown speed unit: {}", unit)),
        },
        _ => Err(format!("Unknown category: {}", category)),
    }
}
