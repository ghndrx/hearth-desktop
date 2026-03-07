//! Coin Flip - Random coin toss with history and streak tracking

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CoinSide {
    Heads,
    Tails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinFlipResult {
    pub side: CoinSide,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinFlipStats {
    pub total: u32,
    pub heads: u32,
    pub tails: u32,
    pub current_streak: u32,
    pub current_streak_side: Option<CoinSide>,
    pub longest_streak: u32,
    pub longest_streak_side: Option<CoinSide>,
    pub history: Vec<CoinFlipResult>,
}

pub struct CoinFlipManager {
    history: Mutex<Vec<CoinFlipResult>>,
    longest_streak: Mutex<(u32, Option<CoinSide>)>,
}

impl Default for CoinFlipManager {
    fn default() -> Self {
        Self {
            history: Mutex::new(Vec::new()),
            longest_streak: Mutex::new((0, None)),
        }
    }
}

fn compute_current_streak(history: &[CoinFlipResult]) -> (u32, Option<CoinSide>) {
    if history.is_empty() {
        return (0, None);
    }
    let first_side = history[0].side;
    let streak = history
        .iter()
        .take_while(|r| r.side == first_side)
        .count() as u32;
    (streak, Some(first_side))
}

#[tauri::command]
pub fn coinflip_flip(
    manager: tauri::State<'_, CoinFlipManager>,
) -> Result<CoinFlipStats, String> {
    let mut rng = rand::thread_rng();
    let side = if rng.gen_bool(0.5) {
        CoinSide::Heads
    } else {
        CoinSide::Tails
    };

    let result = CoinFlipResult {
        side,
        timestamp: chrono::Local::now().to_rfc3339(),
    };

    let mut history = manager.history.lock().map_err(|e| e.to_string())?;
    history.insert(0, result);
    if history.len() > 100 {
        history.truncate(100);
    }

    let (current_streak, current_streak_side) = compute_current_streak(&history);

    let mut longest = manager.longest_streak.lock().map_err(|e| e.to_string())?;
    if current_streak > longest.0 {
        *longest = (current_streak, current_streak_side);
    }

    let heads = history.iter().filter(|r| r.side == CoinSide::Heads).count() as u32;
    let total = history.len() as u32;

    Ok(CoinFlipStats {
        total,
        heads,
        tails: total - heads,
        current_streak,
        current_streak_side,
        longest_streak: longest.0,
        longest_streak_side: longest.1,
        history: history.clone(),
    })
}

#[tauri::command]
pub fn coinflip_get_stats(
    manager: tauri::State<'_, CoinFlipManager>,
) -> Result<CoinFlipStats, String> {
    let history = manager.history.lock().map_err(|e| e.to_string())?;
    let longest = manager.longest_streak.lock().map_err(|e| e.to_string())?;
    let (current_streak, current_streak_side) = compute_current_streak(&history);
    let heads = history.iter().filter(|r| r.side == CoinSide::Heads).count() as u32;
    let total = history.len() as u32;

    Ok(CoinFlipStats {
        total,
        heads,
        tails: total - heads,
        current_streak,
        current_streak_side,
        longest_streak: longest.0,
        longest_streak_side: longest.1,
        history: history.clone(),
    })
}

#[tauri::command]
pub fn coinflip_clear(
    manager: tauri::State<'_, CoinFlipManager>,
) -> Result<(), String> {
    let mut history = manager.history.lock().map_err(|e| e.to_string())?;
    let mut longest = manager.longest_streak.lock().map_err(|e| e.to_string())?;
    history.clear();
    *longest = (0, None);
    Ok(())
}
