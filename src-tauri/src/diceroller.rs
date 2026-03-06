//! Dice Roller - Cryptographically random dice rolling with expression parsing

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiceRoll {
    pub expression: String,
    pub rolls: Vec<SingleDie>,
    pub modifier: i64,
    pub total: i64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SingleDie {
    pub sides: u32,
    pub value: u32,
}

pub struct DiceRollerManager {
    history: Mutex<Vec<DiceRoll>>,
}

impl Default for DiceRollerManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
        }
    }
}

/// Parse a dice expression like "2d6+3", "d20", "4d8-2", "d100"
fn parse_dice_expression(expr: &str) -> Result<(u32, u32, i64), String> {
    let expr = expr.trim().to_lowercase();

    // Find the 'd' separator
    let d_pos = expr.find('d').ok_or("Invalid expression: missing 'd'")?;

    // Parse number of dice (default 1)
    let count_str = &expr[..d_pos];
    let count: u32 = if count_str.is_empty() {
        1
    } else {
        count_str
            .parse()
            .map_err(|_| format!("Invalid dice count: '{}'", count_str))?
    };

    if count == 0 || count > 100 {
        return Err("Dice count must be between 1 and 100".into());
    }

    // Parse sides and modifier from the part after 'd'
    let after_d = &expr[d_pos + 1..];

    let (sides_str, modifier) = if let Some(plus_pos) = after_d.find('+') {
        let mod_str = &after_d[plus_pos + 1..];
        let modifier: i64 = mod_str
            .parse()
            .map_err(|_| format!("Invalid modifier: '{}'", mod_str))?;
        (&after_d[..plus_pos], modifier)
    } else if let Some(minus_pos) = after_d.rfind('-') {
        if minus_pos > 0 {
            let mod_str = &after_d[minus_pos + 1..];
            let modifier: i64 = mod_str
                .parse::<i64>()
                .map_err(|_| format!("Invalid modifier: '{}'", mod_str))?;
            (&after_d[..minus_pos], -modifier)
        } else {
            (after_d, 0i64)
        }
    } else {
        (after_d, 0i64)
    };

    let sides: u32 = sides_str
        .parse()
        .map_err(|_| format!("Invalid dice sides: '{}'", sides_str))?;

    if sides < 2 || sides > 1000 {
        return Err("Dice sides must be between 2 and 1000".into());
    }

    Ok((count, sides, modifier))
}

#[tauri::command]
pub fn dice_roll(
    manager: tauri::State<'_, DiceRollerManager>,
    expression: String,
) -> Result<DiceRoll, String> {
    let (count, sides, modifier) = parse_dice_expression(&expression)?;
    let mut rng = rand::thread_rng();

    let rolls: Vec<SingleDie> = (0..count)
        .map(|_| SingleDie {
            sides,
            value: rng.gen_range(1..=sides),
        })
        .collect();

    let sum: i64 = rolls.iter().map(|r| r.value as i64).sum();
    let total = sum + modifier;

    let result = DiceRoll {
        expression: expression.clone(),
        rolls,
        modifier,
        total,
        timestamp: chrono::Local::now().to_rfc3339(),
    };

    if let Ok(mut history) = manager.history.lock() {
        history.insert(0, result.clone());
        if history.len() > 50 {
            history.truncate(50);
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn dice_roll_quick(sides: u32) -> Result<DiceRoll, String> {
    if sides < 2 || sides > 1000 {
        return Err("Dice sides must be between 2 and 1000".into());
    }

    let mut rng = rand::thread_rng();
    let value = rng.gen_range(1..=sides);

    Ok(DiceRoll {
        expression: format!("d{}", sides),
        rolls: vec![SingleDie { sides, value }],
        modifier: 0,
        total: value as i64,
        timestamp: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn dice_get_history(
    manager: tauri::State<'_, DiceRollerManager>,
) -> Result<Vec<DiceRoll>, String> {
    let history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    Ok(history.clone())
}

#[tauri::command]
pub fn dice_clear_history(
    manager: tauri::State<'_, DiceRollerManager>,
) -> Result<(), String> {
    let mut history = manager
        .history
        .lock()
        .map_err(|_| "Failed to access history")?;
    history.clear();
    Ok(())
}
