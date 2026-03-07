//! JSON Formatter - Format, minify, validate, and query JSON data
//!
//! Provides:
//! - JSON formatting (pretty-print with configurable indent)
//! - JSON minification (compact single-line)
//! - JSON validation with detailed error info
//! - JSON path querying (dot-notation access)
//! - JSON statistics (depth, key count, type breakdown)

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub output: String,
    pub input_size: usize,
    pub output_size: usize,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<String>,
    pub error_line: Option<usize>,
    pub error_column: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsonStats {
    pub valid: bool,
    pub max_depth: usize,
    pub total_keys: usize,
    pub total_values: usize,
    pub type_counts: TypeCounts,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeCounts {
    pub objects: usize,
    pub arrays: usize,
    pub strings: usize,
    pub numbers: usize,
    pub booleans: usize,
    pub nulls: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub found: bool,
    pub value: Option<String>,
    pub value_type: Option<String>,
    pub path: String,
}

#[tauri::command]
pub fn json_format(text: String, indent: Option<usize>) -> Result<FormatResult, String> {
    let indent_size = indent.unwrap_or(2);
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let output = if indent_size == 0 {
        serde_json::to_string(&parsed).map_err(|e| e.to_string())?
    } else {
        let mut buf = Vec::new();
        let formatter = serde_json::ser::PrettyFormatter::with_indent(
            " ".repeat(indent_size).as_bytes(),
        );
        let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
        use serde::Serialize;
        parsed.serialize(&mut ser).map_err(|e| e.to_string())?;
        String::from_utf8(buf).map_err(|e| e.to_string())?
    };

    Ok(FormatResult {
        input_size: text.len(),
        output_size: output.len(),
        output,
        valid: true,
    })
}

#[tauri::command]
pub fn json_minify(text: String) -> Result<FormatResult, String> {
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    let output = serde_json::to_string(&parsed).map_err(|e| e.to_string())?;

    Ok(FormatResult {
        input_size: text.len(),
        output_size: output.len(),
        output,
        valid: true,
    })
}

#[tauri::command]
pub fn json_validate(text: String) -> ValidationResult {
    match serde_json::from_str::<Value>(&text) {
        Ok(_) => ValidationResult {
            valid: true,
            error: None,
            error_line: None,
            error_column: None,
        },
        Err(e) => ValidationResult {
            valid: false,
            error: Some(e.to_string()),
            error_line: Some(e.line()),
            error_column: Some(e.column()),
        },
    }
}

#[tauri::command]
pub fn json_query(text: String, path: String) -> Result<QueryResult, String> {
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let parts: Vec<&str> = path.split('.').filter(|s| !s.is_empty()).collect();
    let mut current = &parsed;

    for part in &parts {
        // Try as array index
        if let Ok(index) = part.parse::<usize>() {
            match current.get(index) {
                Some(val) => current = val,
                None => return Ok(QueryResult {
                    found: false,
                    value: None,
                    value_type: None,
                    path,
                }),
            }
        } else {
            match current.get(*part) {
                Some(val) => current = val,
                None => return Ok(QueryResult {
                    found: false,
                    value: None,
                    value_type: None,
                    path,
                }),
            }
        }
    }

    let value_type = match current {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    };

    let value_str = match current {
        Value::String(s) => s.clone(),
        other => serde_json::to_string_pretty(other).unwrap_or_default(),
    };

    Ok(QueryResult {
        found: true,
        value: Some(value_str),
        value_type: Some(value_type.to_string()),
        path,
    })
}

#[tauri::command]
pub fn json_stats(text: String) -> Result<JsonStats, String> {
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut counts = TypeCounts {
        objects: 0,
        arrays: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0,
    };
    let mut total_keys = 0;
    let mut total_values = 0;

    let max_depth = count_stats(&parsed, &mut counts, &mut total_keys, &mut total_values, 0);

    Ok(JsonStats {
        valid: true,
        max_depth,
        total_keys,
        total_values,
        type_counts: counts,
        size_bytes: text.len(),
    })
}

fn count_stats(
    value: &Value,
    counts: &mut TypeCounts,
    total_keys: &mut usize,
    total_values: &mut usize,
    depth: usize,
) -> usize {
    *total_values += 1;
    let mut max_depth = depth;

    match value {
        Value::Object(map) => {
            counts.objects += 1;
            *total_keys += map.len();
            for (_, v) in map {
                let d = count_stats(v, counts, total_keys, total_values, depth + 1);
                max_depth = max_depth.max(d);
            }
        }
        Value::Array(arr) => {
            counts.arrays += 1;
            for v in arr {
                let d = count_stats(v, counts, total_keys, total_values, depth + 1);
                max_depth = max_depth.max(d);
            }
        }
        Value::String(_) => counts.strings += 1,
        Value::Number(_) => counts.numbers += 1,
        Value::Bool(_) => counts.booleans += 1,
        Value::Null => counts.nulls += 1,
    }

    max_depth
}
