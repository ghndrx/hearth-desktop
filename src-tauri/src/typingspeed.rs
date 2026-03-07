use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingSession {
    pub start_time: u64,    // unix millis
    pub end_time: u64,
    pub char_count: u32,
    pub word_count: u32,
    pub wpm: f64,
    pub accuracy: f64,      // 0.0-1.0, based on backspace ratio
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypingStats {
    pub current_wpm: f64,
    pub peak_wpm: f64,
    pub average_wpm: f64,
    pub total_words_typed: u64,
    pub total_chars_typed: u64,
    pub total_sessions: u32,
    pub average_accuracy: f64,
    pub today_words: u64,
    pub today_sessions: u32,
    pub today_date: String,
    pub recent_sessions: Vec<TypingSession>,
}

impl Default for TypingStats {
    fn default() -> Self {
        Self {
            current_wpm: 0.0,
            peak_wpm: 0.0,
            average_wpm: 0.0,
            total_words_typed: 0,
            total_chars_typed: 0,
            total_sessions: 0,
            average_accuracy: 1.0,
            today_words: 0,
            today_sessions: 0,
            today_date: chrono::Local::now().format("%Y-%m-%d").to_string(),
            recent_sessions: Vec::new(),
        }
    }
}

/// Tracks live typing burst for WPM calculation
struct LiveBurst {
    first_key_time: u64,
    last_key_time: u64,
    char_count: u32,
    word_count: u32,
    backspace_count: u32,
    total_keystrokes: u32,
}

pub struct TypingSpeedManager {
    stats: Mutex<TypingStats>,
    live: Mutex<Option<LiveBurst>>,
}

impl Default for TypingSpeedManager {
    fn default() -> Self {
        Self {
            stats: Mutex::new(TypingStats::default()),
            live: Mutex::new(None),
        }
    }
}

const BURST_TIMEOUT_MS: u64 = 3000; // 3s pause ends a burst
const MAX_RECENT_SESSIONS: usize = 50;

impl TypingSpeedManager {
    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    fn check_today(stats: &mut TypingStats) {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        if stats.today_date != today {
            stats.today_words = 0;
            stats.today_sessions = 0;
            stats.today_date = today;
        }
    }

    /// Called on each keystroke from the frontend
    pub fn record_keystroke(&self, is_backspace: bool, is_space: bool) {
        let now = Self::now_ms();
        let mut live = self.live.lock().unwrap();

        if let Some(burst) = live.as_mut() {
            // Check if burst has timed out
            if now - burst.last_key_time > BURST_TIMEOUT_MS {
                // Finalize previous burst
                let session = self.finalize_burst(burst, now);
                drop(live);
                self.record_session(session);
                // Start new burst
                let mut live = self.live.lock().unwrap();
                *live = Some(LiveBurst {
                    first_key_time: now,
                    last_key_time: now,
                    char_count: if is_backspace { 0 } else { 1 },
                    word_count: 0,
                    backspace_count: if is_backspace { 1 } else { 0 },
                    total_keystrokes: 1,
                });
                return;
            }

            burst.last_key_time = now;
            burst.total_keystrokes += 1;
            if is_backspace {
                burst.backspace_count += 1;
            } else {
                burst.char_count += 1;
                if is_space {
                    burst.word_count += 1;
                }
            }

            // Update live WPM
            let elapsed_min = (now - burst.first_key_time) as f64 / 60_000.0;
            if elapsed_min > 0.01 {
                // Count words as chars/5 (standard WPM measure)
                let gross_words = burst.char_count as f64 / 5.0;
                let wpm = gross_words / elapsed_min;
                let mut stats = self.stats.lock().unwrap();
                stats.current_wpm = (wpm * 10.0).round() / 10.0;
            }
        } else {
            *live = Some(LiveBurst {
                first_key_time: now,
                last_key_time: now,
                char_count: if is_backspace { 0 } else { 1 },
                word_count: 0,
                backspace_count: if is_backspace { 1 } else { 0 },
                total_keystrokes: 1,
            });
        }
    }

    fn finalize_burst(&self, burst: &LiveBurst, _now: u64) -> TypingSession {
        let elapsed_min = (burst.last_key_time - burst.first_key_time) as f64 / 60_000.0;
        let gross_words = burst.char_count as f64 / 5.0;
        let wpm = if elapsed_min > 0.01 {
            gross_words / elapsed_min
        } else {
            0.0
        };
        let accuracy = if burst.total_keystrokes > 0 {
            1.0 - (burst.backspace_count as f64 / burst.total_keystrokes as f64)
        } else {
            1.0
        };

        TypingSession {
            start_time: burst.first_key_time,
            end_time: burst.last_key_time,
            char_count: burst.char_count,
            word_count: burst.word_count,
            wpm: (wpm * 10.0).round() / 10.0,
            accuracy: (accuracy * 1000.0).round() / 1000.0,
        }
    }

    fn record_session(&self, session: TypingSession) {
        let mut stats = self.stats.lock().unwrap();
        Self::check_today(&mut stats);

        if session.wpm > stats.peak_wpm {
            stats.peak_wpm = session.wpm;
        }

        stats.total_words_typed += session.word_count as u64;
        stats.total_chars_typed += session.char_count as u64;
        stats.total_sessions += 1;
        stats.today_words += session.word_count as u64;
        stats.today_sessions += 1;

        // Rolling average WPM
        let n = stats.total_sessions as f64;
        stats.average_wpm = ((stats.average_wpm * (n - 1.0)) + session.wpm) / n;
        stats.average_wpm = (stats.average_wpm * 10.0).round() / 10.0;

        // Rolling average accuracy
        stats.average_accuracy = ((stats.average_accuracy * (n - 1.0)) + session.accuracy) / n;
        stats.average_accuracy = (stats.average_accuracy * 1000.0).round() / 1000.0;

        stats.recent_sessions.push(session);
        if stats.recent_sessions.len() > MAX_RECENT_SESSIONS {
            stats.recent_sessions.remove(0);
        }
    }

    /// Flush any active burst (called when message is sent or input blurs)
    pub fn flush_burst(&self) {
        let now = Self::now_ms();
        let mut live = self.live.lock().unwrap();
        if let Some(burst) = live.take() {
            if burst.char_count > 4 {
                let session = self.finalize_burst(&burst, now);
                drop(live);
                self.record_session(session);
            }
            let mut stats = self.stats.lock().unwrap();
            stats.current_wpm = 0.0;
        }
    }

    pub fn get_stats(&self) -> TypingStats {
        let mut stats = self.stats.lock().unwrap();
        Self::check_today(&mut stats);
        stats.clone()
    }

    pub fn reset(&self) {
        let mut stats = self.stats.lock().unwrap();
        *stats = TypingStats::default();
        let mut live = self.live.lock().unwrap();
        *live = None;
    }
}

// Tauri Commands

#[tauri::command]
pub fn typing_speed_keystroke(
    is_backspace: bool,
    is_space: bool,
    manager: tauri::State<'_, TypingSpeedManager>,
) {
    manager.record_keystroke(is_backspace, is_space);
}

#[tauri::command]
pub fn typing_speed_flush(manager: tauri::State<'_, TypingSpeedManager>) {
    manager.flush_burst();
}

#[tauri::command]
pub fn typing_speed_get_stats(manager: tauri::State<'_, TypingSpeedManager>) -> TypingStats {
    manager.get_stats()
}

#[tauri::command]
pub fn typing_speed_get_wpm(manager: tauri::State<'_, TypingSpeedManager>) -> f64 {
    manager.get_stats().current_wpm
}

#[tauri::command]
pub fn typing_speed_reset(manager: tauri::State<'_, TypingSpeedManager>) {
    manager.reset();
}
