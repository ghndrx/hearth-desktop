//! Channel Polls - Create and vote on polls in chat channels
//!
//! Provides poll creation, voting, and results with SQLite persistence.
//! Supports multiple-choice polls, single/multi-vote, and expiration.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Poll {
    pub id: String,
    pub channel_id: String,
    pub creator_id: String,
    pub question: String,
    pub options: Vec<PollOption>,
    pub multi_vote: bool,
    pub anonymous: bool,
    pub expires_at: Option<u64>,
    pub created_at: u64,
    pub closed: bool,
    pub total_votes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollOption {
    pub id: u32,
    pub label: String,
    pub votes: u32,
    pub voter_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePollRequest {
    pub channel_id: String,
    pub creator_id: String,
    pub question: String,
    pub options: Vec<String>,
    #[serde(default)]
    pub multi_vote: bool,
    #[serde(default)]
    pub anonymous: bool,
    pub expires_at: Option<u64>,
}

pub struct PollManager {
    db: Mutex<rusqlite::Connection>,
}

impl PollManager {
    pub fn new(app_data_dir: std::path::PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("polls.db");
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS polls (
                id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL,
                creator_id TEXT NOT NULL,
                question TEXT NOT NULL,
                multi_vote INTEGER NOT NULL DEFAULT 0,
                anonymous INTEGER NOT NULL DEFAULT 0,
                expires_at INTEGER,
                created_at INTEGER NOT NULL,
                closed INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS poll_options (
                poll_id TEXT NOT NULL,
                option_id INTEGER NOT NULL,
                label TEXT NOT NULL,
                PRIMARY KEY (poll_id, option_id),
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS poll_votes (
                poll_id TEXT NOT NULL,
                option_id INTEGER NOT NULL,
                voter_id TEXT NOT NULL,
                voted_at INTEGER NOT NULL,
                PRIMARY KEY (poll_id, option_id, voter_id),
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_polls_channel ON polls(channel_id);
            CREATE INDEX IF NOT EXISTS idx_polls_created ON polls(created_at DESC);",
        )
        .map_err(|e| e.to_string())?;

        Ok(Self {
            db: Mutex::new(conn),
        })
    }

    fn load_poll(&self, conn: &rusqlite::Connection, poll_id: &str) -> Result<Option<Poll>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, channel_id, creator_id, question, multi_vote, anonymous, expires_at, created_at, closed
                 FROM polls WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let poll_row = stmt
            .query_row(rusqlite::params![poll_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, bool>(4)?,
                    row.get::<_, bool>(5)?,
                    row.get::<_, Option<u64>>(6)?,
                    row.get::<_, u64>(7)?,
                    row.get::<_, bool>(8)?,
                ))
            })
            .optional()
            .map_err(|e| e.to_string())?;

        let Some((id, channel_id, creator_id, question, multi_vote, anonymous, expires_at, created_at, closed)) = poll_row else {
            return Ok(None);
        };

        // Load options
        let mut opt_stmt = conn
            .prepare("SELECT option_id, label FROM poll_options WHERE poll_id = ?1 ORDER BY option_id")
            .map_err(|e| e.to_string())?;

        let options_raw: Vec<(u32, String)> = opt_stmt
            .query_map(rusqlite::params![&id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Load votes
        let mut vote_stmt = conn
            .prepare("SELECT option_id, voter_id FROM poll_votes WHERE poll_id = ?1")
            .map_err(|e| e.to_string())?;

        let votes: Vec<(u32, String)> = vote_stmt
            .query_map(rusqlite::params![&id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut total_votes = 0u32;
        let options: Vec<PollOption> = options_raw
            .into_iter()
            .map(|(opt_id, label)| {
                let voter_ids: Vec<String> = votes
                    .iter()
                    .filter(|(vid, _)| *vid == opt_id)
                    .map(|(_, voter)| voter.clone())
                    .collect();
                let count = voter_ids.len() as u32;
                total_votes += count;
                PollOption {
                    id: opt_id,
                    label,
                    votes: count,
                    voter_ids: if anonymous { vec![] } else { voter_ids },
                }
            })
            .collect();

        Ok(Some(Poll {
            id,
            channel_id,
            creator_id,
            question,
            options,
            multi_vote,
            anonymous,
            expires_at,
            created_at,
            closed,
            total_votes,
        }))
    }
}

use rusqlite::OptionalExtension;

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tauri::command]
pub fn poll_create(
    app: AppHandle,
    state: State<'_, PollManager>,
    request: CreatePollRequest,
) -> Result<Poll, String> {
    if request.options.len() < 2 {
        return Err("Poll must have at least 2 options".into());
    }
    if request.options.len() > 10 {
        return Err("Poll cannot have more than 10 options".into());
    }
    if request.question.trim().is_empty() {
        return Err("Poll question cannot be empty".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let created_at = now_ms();
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO polls (id, channel_id, creator_id, question, multi_vote, anonymous, expires_at, created_at, closed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
        rusqlite::params![
            &id,
            &request.channel_id,
            &request.creator_id,
            &request.question,
            request.multi_vote,
            request.anonymous,
            request.expires_at,
            created_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    for (i, label) in request.options.iter().enumerate() {
        db.execute(
            "INSERT INTO poll_options (poll_id, option_id, label) VALUES (?1, ?2, ?3)",
            rusqlite::params![&id, i as u32, label],
        )
        .map_err(|e| e.to_string())?;
    }

    let poll = state.load_poll(&db, &id)?.ok_or("Failed to load created poll")?;
    let _ = app.emit("poll:created", &poll);
    Ok(poll)
}

#[tauri::command]
pub fn poll_vote(
    app: AppHandle,
    state: State<'_, PollManager>,
    poll_id: String,
    option_id: u32,
    voter_id: String,
) -> Result<Poll, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Check poll exists and is open
    let (closed, multi_vote, expires_at): (bool, bool, Option<u64>) = db
        .query_row(
            "SELECT closed, multi_vote, expires_at FROM polls WHERE id = ?1",
            rusqlite::params![&poll_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Poll not found".to_string())?;

    if closed {
        return Err("Poll is closed".into());
    }
    if let Some(exp) = expires_at {
        if now_ms() > exp {
            return Err("Poll has expired".into());
        }
    }

    // Check option exists
    let option_exists: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM poll_options WHERE poll_id = ?1 AND option_id = ?2",
            rusqlite::params![&poll_id, option_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if !option_exists {
        return Err("Invalid option".into());
    }

    if !multi_vote {
        // Remove previous vote for this user on this poll
        db.execute(
            "DELETE FROM poll_votes WHERE poll_id = ?1 AND voter_id = ?2",
            rusqlite::params![&poll_id, &voter_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Check if already voted for this specific option (multi-vote dedup)
    let already_voted: bool = db
        .query_row(
            "SELECT COUNT(*) > 0 FROM poll_votes WHERE poll_id = ?1 AND option_id = ?2 AND voter_id = ?3",
            rusqlite::params![&poll_id, option_id, &voter_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if already_voted {
        // Toggle off: remove vote
        db.execute(
            "DELETE FROM poll_votes WHERE poll_id = ?1 AND option_id = ?2 AND voter_id = ?3",
            rusqlite::params![&poll_id, option_id, &voter_id],
        )
        .map_err(|e| e.to_string())?;
    } else {
        db.execute(
            "INSERT INTO poll_votes (poll_id, option_id, voter_id, voted_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![&poll_id, option_id, &voter_id, now_ms()],
        )
        .map_err(|e| e.to_string())?;
    }

    let poll = state.load_poll(&db, &poll_id)?.ok_or("Poll not found")?;
    let _ = app.emit("poll:updated", &poll);
    Ok(poll)
}

#[tauri::command]
pub fn poll_close(
    app: AppHandle,
    state: State<'_, PollManager>,
    poll_id: String,
) -> Result<Poll, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE polls SET closed = 1 WHERE id = ?1",
        rusqlite::params![&poll_id],
    )
    .map_err(|e| e.to_string())?;

    let poll = state.load_poll(&db, &poll_id)?.ok_or("Poll not found")?;
    let _ = app.emit("poll:closed", &poll);
    Ok(poll)
}

#[tauri::command]
pub fn poll_get(
    state: State<'_, PollManager>,
    poll_id: String,
) -> Result<Poll, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    state.load_poll(&db, &poll_id)?.ok_or_else(|| "Poll not found".into())
}

#[tauri::command]
pub fn poll_list_by_channel(
    state: State<'_, PollManager>,
    channel_id: String,
    include_closed: Option<bool>,
) -> Result<Vec<Poll>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let include_closed = include_closed.unwrap_or(false);

    let query = if include_closed {
        "SELECT id FROM polls WHERE channel_id = ?1 ORDER BY created_at DESC"
    } else {
        "SELECT id FROM polls WHERE channel_id = ?1 AND closed = 0 ORDER BY created_at DESC"
    };

    let mut stmt = db.prepare(query).map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map(rusqlite::params![&channel_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut polls = Vec::new();
    for id in ids {
        if let Some(poll) = state.load_poll(&db, &id)? {
            polls.push(poll);
        }
    }
    Ok(polls)
}

#[tauri::command]
pub fn poll_delete(
    app: AppHandle,
    state: State<'_, PollManager>,
    poll_id: String,
) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM poll_votes WHERE poll_id = ?1", rusqlite::params![&poll_id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM poll_options WHERE poll_id = ?1", rusqlite::params![&poll_id])
        .map_err(|e| e.to_string())?;
    let deleted = db
        .execute("DELETE FROM polls WHERE id = ?1", rusqlite::params![&poll_id])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("poll:deleted", &poll_id);
    Ok(deleted > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_poll_request_validation() {
        let req = CreatePollRequest {
            channel_id: "ch-1".into(),
            creator_id: "user-1".into(),
            question: "Favorite color?".into(),
            options: vec!["Red".into(), "Blue".into(), "Green".into()],
            multi_vote: false,
            anonymous: false,
            expires_at: None,
        };
        assert_eq!(req.options.len(), 3);
        assert!(!req.multi_vote);
    }

    #[test]
    fn test_poll_serialization() {
        let poll = Poll {
            id: "poll-1".into(),
            channel_id: "ch-1".into(),
            creator_id: "user-1".into(),
            question: "Best language?".into(),
            options: vec![
                PollOption { id: 0, label: "Rust".into(), votes: 3, voter_ids: vec![] },
                PollOption { id: 1, label: "TypeScript".into(), votes: 2, voter_ids: vec![] },
            ],
            multi_vote: false,
            anonymous: true,
            expires_at: None,
            created_at: 1700000000000,
            closed: false,
            total_votes: 5,
        };
        let json = serde_json::to_string(&poll).unwrap();
        assert!(json.contains("Best language?"));
        assert!(json.contains("Rust"));
    }
}
