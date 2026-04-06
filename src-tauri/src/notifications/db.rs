use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── Data Structures ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub global_enabled: bool,
    pub quiet_hours: Option<QuietHours>,
    pub keyword_triggers: Vec<String>,
    pub sounds: SoundPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuietHours {
    pub enabled: bool,
    pub start_time: String,   // "22:00"
    pub end_time: String,     // "08:00"
    pub timezone: String,     // "America/New_York"
    pub allow_mentions: bool,
    pub allow_dms: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum NotificationLevel {
    All = 0,
    MentionsOnly = 1,
    Nothing = 2,
}

impl NotificationLevel {
    pub fn from_u8(v: u8) -> Result<Self> {
        match v {
            0 => Ok(NotificationLevel::All),
            1 => Ok(NotificationLevel::MentionsOnly),
            2 => Ok(NotificationLevel::Nothing),
            _ => Err(rusqlite::Error::InvalidParameterName(
                format!("invalid notification level: {v}"),
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundPreferences {
    pub enabled: bool,
    pub volume: f32,               // 0.0 – 1.0
    pub mention_sound: String,     // filename or "default"
    pub dm_sound: String,
    pub server_sound: String,
}

// ── Database ─────────────────────────────────────────────────────────────────

pub struct NotificationDb {
    conn: Connection,
}

impl NotificationDb {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        Ok(Self { conn })
    }

    pub fn init(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS notification_prefs (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                global_enabled INTEGER NOT NULL DEFAULT 1,
                quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
                quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
                quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
                quiet_hours_tz TEXT NOT NULL DEFAULT 'UTC',
                quiet_hours_allow_mentions INTEGER NOT NULL DEFAULT 0,
                quiet_hours_allow_dms INTEGER NOT NULL DEFAULT 0,
                sounds_enabled INTEGER NOT NULL DEFAULT 1,
                sounds_volume REAL NOT NULL DEFAULT 0.8,
                mention_sound TEXT NOT NULL DEFAULT 'default',
                dm_sound TEXT NOT NULL DEFAULT 'default',
                server_sound TEXT NOT NULL DEFAULT 'default'
            );

            CREATE TABLE IF NOT EXISTS keyword_triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS server_notification_levels (
                server_id TEXT PRIMARY KEY,
                level INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS channel_notification_overrides (
                channel_id TEXT PRIMARY KEY,
                server_id TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS user_dm_preferences (
                user_id TEXT PRIMARY KEY,
                level INTEGER NOT NULL DEFAULT 1
            );

            INSERT OR IGNORE INTO notification_prefs (id) VALUES (1);",
        )?;
        Ok(())
    }

    pub fn get_preferences(&self) -> Result<NotificationPreferences> {
        let row = self.conn.query_row(
            "SELECT global_enabled, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
                    quiet_hours_tz, quiet_hours_allow_mentions, quiet_hours_allow_dms,
                    sounds_enabled, sounds_volume, mention_sound, dm_sound, server_sound
             FROM notification_prefs WHERE id = 1",
            [],
            |row| {
                let global_enabled: bool = row.get(0)?;
                let qh_enabled: bool = row.get(1)?;
                let qh_start: String = row.get(2)?;
                let qh_end: String = row.get(3)?;
                let qh_tz: String = row.get(4)?;
                let qh_allow_mentions: bool = row.get(5)?;
                let qh_allow_dms: bool = row.get(6)?;
                let sounds_enabled: bool = row.get(7)?;
                let sounds_volume: f32 = row.get::<_, f64>(8)? as f32;
                let mention_sound: String = row.get(9)?;
                let dm_sound: String = row.get(10)?;
                let server_sound: String = row.get(11)?;

                let quiet_hours = if qh_enabled {
                    Some(QuietHours {
                        enabled: true,
                        start_time: qh_start,
                        end_time: qh_end,
                        timezone: qh_tz,
                        allow_mentions: qh_allow_mentions,
                        allow_dms: qh_allow_dms,
                    })
                } else {
                    None
                };

                Ok((global_enabled, quiet_hours, SoundPreferences {
                    enabled: sounds_enabled,
                    volume: sounds_volume,
                    mention_sound,
                    dm_sound,
                    server_sound,
                }))
            },
        )?;

        let keywords = self.get_keyword_triggers()?;

        Ok(NotificationPreferences {
            global_enabled: row.0,
            quiet_hours: row.1,
            keyword_triggers: keywords,
            sounds: row.2,
        })
    }

    pub fn save_preferences(&self, prefs: &NotificationPreferences) -> Result<()> {
        let (qh_enabled, qh_start, qh_end, qh_tz, qh_allow_mentions, qh_allow_dms) =
            match &prefs.quiet_hours {
                Some(qh) => (
                    qh.enabled,
                    qh.start_time.as_str(),
                    qh.end_time.as_str(),
                    qh.timezone.as_str(),
                    qh.allow_mentions,
                    qh.allow_dms,
                ),
                None => (false, "22:00", "08:00", "UTC", false, false),
            };

        self.conn.execute(
            "UPDATE notification_prefs SET
                global_enabled = ?1,
                quiet_hours_enabled = ?2,
                quiet_hours_start = ?3,
                quiet_hours_end = ?4,
                quiet_hours_tz = ?5,
                quiet_hours_allow_mentions = ?6,
                quiet_hours_allow_dms = ?7,
                sounds_enabled = ?8,
                sounds_volume = ?9,
                mention_sound = ?10,
                dm_sound = ?11,
                server_sound = ?12
             WHERE id = 1",
            params![
                prefs.global_enabled,
                qh_enabled,
                qh_start,
                qh_end,
                qh_tz,
                qh_allow_mentions,
                qh_allow_dms,
                prefs.sounds.enabled,
                prefs.sounds.volume as f64,
                prefs.sounds.mention_sound,
                prefs.sounds.dm_sound,
                prefs.sounds.server_sound,
            ],
        )?;

        // Sync keyword triggers
        self.conn.execute("DELETE FROM keyword_triggers", [])?;
        for keyword in &prefs.keyword_triggers {
            self.conn.execute(
                "INSERT OR IGNORE INTO keyword_triggers (keyword) VALUES (?1)",
                params![keyword],
            )?;
        }

        Ok(())
    }

    pub fn get_server_level(&self, server_id: &str) -> Result<NotificationLevel> {
        let level: u8 = self
            .conn
            .query_row(
                "SELECT level FROM server_notification_levels WHERE server_id = ?1",
                params![server_id],
                |row| row.get(0),
            )
            .unwrap_or(1); // default MentionsOnly
        NotificationLevel::from_u8(level)
    }

    pub fn set_server_level(&self, server_id: &str, level: NotificationLevel) -> Result<()> {
        self.conn.execute(
            "INSERT INTO server_notification_levels (server_id, level) VALUES (?1, ?2)
             ON CONFLICT(server_id) DO UPDATE SET level = ?2",
            params![server_id, level as u8],
        )?;
        Ok(())
    }

    pub fn get_channel_override(&self, channel_id: &str) -> Result<Option<NotificationLevel>> {
        match self.conn.query_row(
            "SELECT level FROM channel_notification_overrides WHERE channel_id = ?1",
            params![channel_id],
            |row| row.get::<_, u8>(0),
        ) {
            Ok(level) => Ok(Some(NotificationLevel::from_u8(level)?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn set_channel_override(
        &self,
        channel_id: &str,
        server_id: &str,
        level: NotificationLevel,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO channel_notification_overrides (channel_id, server_id, level) VALUES (?1, ?2, ?3)
             ON CONFLICT(channel_id) DO UPDATE SET server_id = ?2, level = ?3",
            params![channel_id, server_id, level as u8],
        )?;
        Ok(())
    }

    pub fn remove_channel_override(&self, channel_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM channel_notification_overrides WHERE channel_id = ?1",
            params![channel_id],
        )?;
        Ok(())
    }

    pub fn get_user_dm_level(&self, user_id: &str) -> Result<NotificationLevel> {
        let level: u8 = self
            .conn
            .query_row(
                "SELECT level FROM user_dm_preferences WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .unwrap_or(1); // default MentionsOnly
        NotificationLevel::from_u8(level)
    }

    pub fn set_user_dm_level(&self, user_id: &str, level: NotificationLevel) -> Result<()> {
        self.conn.execute(
            "INSERT INTO user_dm_preferences (user_id, level) VALUES (?1, ?2)
             ON CONFLICT(user_id) DO UPDATE SET level = ?2",
            params![user_id, level as u8],
        )?;
        Ok(())
    }

    pub fn get_keyword_triggers(&self) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT keyword FROM keyword_triggers")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        let mut keywords = Vec::new();
        for kw in rows {
            keywords.push(kw?);
        }
        Ok(keywords)
    }

    pub fn add_keyword(&self, keyword: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR IGNORE INTO keyword_triggers (keyword) VALUES (?1)",
            params![keyword],
        )?;
        Ok(())
    }

    pub fn remove_keyword(&self, keyword: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM keyword_triggers WHERE keyword = ?1",
            params![keyword],
        )?;
        Ok(())
    }
}
