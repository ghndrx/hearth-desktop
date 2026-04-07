use chrono::Timelike;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};

// --- Types ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationPriority {
    Urgent,
    High,
    Normal,
    Low,
}

impl NotificationPriority {
    fn weight(&self) -> u8 {
        match self {
            Self::Urgent => 3,
            Self::High => 2,
            Self::Normal => 1,
            Self::Low => 0,
        }
    }
}

impl PartialOrd for NotificationPriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for NotificationPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        self.weight().cmp(&other.weight())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationCategory {
    Message,
    VoiceCall,
    Mention,
    System,
    FriendRequest,
    ServerUpdate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationAction {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_type_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationData {
    pub id: String,
    pub title: String,
    pub body: String,
    pub category: NotificationCategory,
    pub priority: NotificationPriority,
    pub timestamp: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actions: Option<Vec<NotificationAction>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default)]
    pub sound: bool,
    #[serde(default)]
    pub persistent: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationBatch {
    pub id: String,
    pub category: NotificationCategory,
    pub priority: NotificationPriority,
    pub notifications: Vec<NotificationData>,
    pub created_at: u64,
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySettings {
    pub enabled: bool,
    pub priority: NotificationPriority,
    pub sound: bool,
    pub batching_enabled: bool,
    pub batch_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuietHoursSettings {
    pub enabled: bool,
    pub start_hour: u8,
    pub start_minute: u8,
    pub end_hour: u8,
    pub end_minute: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub enabled: bool,
    pub categories: HashMap<NotificationCategory, CategorySettings>,
    pub quiet_hours: QuietHoursSettings,
    pub max_batch_size: usize,
    pub batching_delay_ms: u64,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        let mut categories = HashMap::new();
        categories.insert(NotificationCategory::Message, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: true,
            batching_enabled: true,
            batch_delay_ms: 2000,
        });
        categories.insert(NotificationCategory::VoiceCall, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Urgent,
            sound: true,
            batching_enabled: false,
            batch_delay_ms: 0,
        });
        categories.insert(NotificationCategory::Mention, CategorySettings {
            enabled: true,
            priority: NotificationPriority::High,
            sound: true,
            batching_enabled: true,
            batch_delay_ms: 1000,
        });
        categories.insert(NotificationCategory::System, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: false,
            batching_enabled: true,
            batch_delay_ms: 5000,
        });
        categories.insert(NotificationCategory::FriendRequest, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Normal,
            sound: true,
            batching_enabled: false,
            batch_delay_ms: 0,
        });
        categories.insert(NotificationCategory::ServerUpdate, CategorySettings {
            enabled: true,
            priority: NotificationPriority::Low,
            sound: false,
            batching_enabled: true,
            batch_delay_ms: 10000,
        });

        Self {
            enabled: true,
            categories,
            quiet_hours: QuietHoursSettings {
                enabled: false,
                start_hour: 22,
                start_minute: 0,
                end_hour: 8,
                end_minute: 0,
            },
            max_batch_size: 5,
            batching_delay_ms: 2000,
        }
    }
}

// --- Priority Queue Entry ---

#[derive(Debug, Clone)]
struct PriorityEntry {
    notification: NotificationData,
    queued_at: Instant,
}

impl PartialEq for PriorityEntry {
    fn eq(&self, other: &Self) -> bool {
        self.notification.priority == other.notification.priority
            && self.notification.timestamp == other.notification.timestamp
    }
}

impl Eq for PriorityEntry {}

impl PartialOrd for PriorityEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        // Higher priority first, then earlier timestamp
        match self.notification.priority.cmp(&other.notification.priority) {
            Ordering::Equal => other.notification.timestamp.cmp(&self.notification.timestamp),
            ord => ord,
        }
    }
}

// --- Batch Accumulator ---

#[derive(Debug)]
struct BatchAccumulator {
    key: String,
    category: NotificationCategory,
    notifications: Vec<NotificationData>,
    created_at: Instant,
    deadline: Instant,
}

// --- Stats ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationStats {
    pub pending_count: usize,
    pub pending_by_category: HashMap<NotificationCategory, usize>,
    pub batches_pending: usize,
    pub total_sent: u64,
    pub total_batched: u64,
}

// --- Manager ---

#[derive(Debug)]
struct ManagerInner {
    settings: NotificationSettings,
    priority_queue: BinaryHeap<PriorityEntry>,
    batches: HashMap<String, BatchAccumulator>,
    total_sent: u64,
    total_batched: u64,
    /// Notifications ready to be dispatched (title, body, sound)
    ready_queue: Vec<(String, String, bool)>,
}

#[derive(Debug, Clone)]
pub struct NotificationManager {
    inner: Arc<Mutex<ManagerInner>>,
}

impl NotificationManager {
    pub fn new(settings: NotificationSettings) -> Self {
        Self {
            inner: Arc::new(Mutex::new(ManagerInner {
                settings,
                priority_queue: BinaryHeap::new(),
                batches: HashMap::new(),
                total_sent: 0,
                total_batched: 0,
                ready_queue: Vec::new(),
            })),
        }
    }

    pub fn with_defaults() -> Self {
        Self::new(NotificationSettings::default())
    }

    /// Queue a notification for processing with smart batching and priority handling.
    pub async fn queue(&self, notification: NotificationData) -> Result<QueueResult, String> {
        let mut inner = self.inner.lock().await;

        if !inner.settings.enabled {
            return Ok(QueueResult::Disabled);
        }

        let cat_settings = inner.settings.categories.get(&notification.category)
            .cloned()
            .ok_or_else(|| format!("Unknown category: {:?}", notification.category))?;

        if !cat_settings.enabled {
            return Ok(QueueResult::CategoryDisabled);
        }

        if is_quiet_hours(&inner.settings.quiet_hours) {
            return Ok(QueueResult::QuietHours);
        }

        // Urgent notifications bypass batching entirely
        if notification.priority == NotificationPriority::Urgent {
            let title = notification.title.clone();
            let body = notification.body.clone();
            let sound = cat_settings.sound;
            inner.ready_queue.push((title, body, sound));
            inner.total_sent += 1;
            return Ok(QueueResult::SentImmediately);
        }

        // If batching is disabled for this category, send immediately
        if !cat_settings.batching_enabled {
            let title = notification.title.clone();
            let body = notification.body.clone();
            let sound = cat_settings.sound;
            inner.ready_queue.push((title, body, sound));
            inner.total_sent += 1;
            return Ok(QueueResult::SentImmediately);
        }

        // Add to priority queue
        let entry = PriorityEntry {
            notification: notification.clone(),
            queued_at: Instant::now(),
        };
        inner.priority_queue.push(entry);

        // Add to batch accumulator
        let batch_key = make_batch_key(&notification);
        let delay = Duration::from_millis(cat_settings.batch_delay_ms);

        let batch = inner.batches.entry(batch_key.clone()).or_insert_with(|| {
            let now = Instant::now();
            BatchAccumulator {
                key: batch_key,
                category: notification.category,
                notifications: Vec::new(),
                created_at: now,
                deadline: now + delay,
            }
        });
        batch.notifications.push(notification);
        // Extend deadline on each new notification (debounce)
        batch.deadline = Instant::now() + delay;

        Ok(QueueResult::Queued)
    }

    /// Flush any batches whose deadline has passed. Returns notifications ready to send.
    pub async fn flush_ready(&self) -> Vec<(String, String, bool)> {
        let mut inner = self.inner.lock().await;
        let now = Instant::now();

        // Drain the ready queue first
        let mut ready: Vec<(String, String, bool)> = inner.ready_queue.drain(..).collect();

        // Check batches for expired deadlines
        let max_batch_size = inner.settings.max_batch_size;
        let expired_keys: Vec<String> = inner.batches.iter()
            .filter(|(_, b)| now >= b.deadline)
            .map(|(k, _)| k.clone())
            .collect();

        for key in expired_keys {
            if let Some(batch) = inner.batches.remove(&key) {
                let cat_settings = inner.settings.categories.get(&batch.category);
                let sound = cat_settings.map(|c| c.sound).unwrap_or(false);

                if batch.notifications.is_empty() {
                    continue;
                }

                // Remove these notifications from the priority queue
                // (rebuild without the batch's notification IDs)
                let batch_ids: std::collections::HashSet<String> = batch.notifications.iter()
                    .map(|n| n.id.clone())
                    .collect();
                let remaining: Vec<PriorityEntry> = inner.priority_queue.drain()
                    .filter(|e| !batch_ids.contains(&e.notification.id))
                    .collect();
                inner.priority_queue = remaining.into_iter().collect();

                // Sort by priority then timestamp
                let mut sorted = batch.notifications;
                sorted.sort_by(|a, b| {
                    match b.priority.weight().cmp(&a.priority.weight()) {
                        Ordering::Equal => a.timestamp.cmp(&b.timestamp),
                        ord => ord,
                    }
                });

                if sorted.len() == 1 {
                    let n = &sorted[0];
                    ready.push((n.title.clone(), n.body.clone(), sound));
                    inner.total_sent += 1;
                } else {
                    // Create batched notification
                    let to_send = if sorted.len() > max_batch_size {
                        &sorted[..max_batch_size]
                    } else {
                        &sorted
                    };

                    let title = generate_batch_title(batch.category, to_send.len());
                    let body = generate_batch_body(to_send);
                    ready.push((title, body, sound));
                    inner.total_sent += 1;
                    inner.total_batched += to_send.len() as u64;
                }
            }
        }

        ready
    }

    /// Get current statistics.
    pub async fn stats(&self) -> NotificationStats {
        let inner = self.inner.lock().await;

        let mut pending_by_category: HashMap<NotificationCategory, usize> = HashMap::new();
        for entry in inner.priority_queue.iter() {
            *pending_by_category.entry(entry.notification.category).or_insert(0) += 1;
        }

        NotificationStats {
            pending_count: inner.priority_queue.len(),
            pending_by_category,
            batches_pending: inner.batches.len(),
            total_sent: inner.total_sent,
            total_batched: inner.total_batched,
        }
    }

    /// Update settings.
    pub async fn update_settings(&self, settings: NotificationSettings) {
        let mut inner = self.inner.lock().await;
        inner.settings = settings;
    }

    /// Get current settings.
    pub async fn get_settings(&self) -> NotificationSettings {
        let inner = self.inner.lock().await;
        inner.settings.clone()
    }

    /// Clear all pending notifications and batches.
    pub async fn clear_all(&self) {
        let mut inner = self.inner.lock().await;
        inner.priority_queue.clear();
        inner.batches.clear();
        inner.ready_queue.clear();
    }
}

// --- Queue Result ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QueueResult {
    SentImmediately,
    Queued,
    Disabled,
    CategoryDisabled,
    QuietHours,
}

// --- Helper functions ---

fn make_batch_key(notification: &NotificationData) -> String {
    let mut parts = vec![format!("{:?}", notification.category)];
    if let Some(ref source_id) = notification.source_id {
        parts.push(source_id.clone());
    } else if let Some(ref channel_id) = notification.channel_id {
        parts.push(channel_id.clone());
    } else if let Some(ref server_id) = notification.server_id {
        parts.push(server_id.clone());
    }
    parts.join("|")
}

fn is_quiet_hours(qh: &QuietHoursSettings) -> bool {
    if !qh.enabled {
        return false;
    }

    let now = chrono::Local::now();
    let current = now.hour() as u16 * 60 + now.minute() as u16;
    let start = qh.start_hour as u16 * 60 + qh.start_minute as u16;
    let end = qh.end_hour as u16 * 60 + qh.end_minute as u16;

    if start <= end {
        current >= start && current < end
    } else {
        // Overnight: e.g. 22:00 - 08:00
        current >= start || current < end
    }
}

fn generate_batch_title(category: NotificationCategory, count: usize) -> String {
    let label = match category {
        NotificationCategory::Message => "messages",
        NotificationCategory::VoiceCall => "voice calls",
        NotificationCategory::Mention => "mentions",
        NotificationCategory::System => "system notifications",
        NotificationCategory::FriendRequest => "friend requests",
        NotificationCategory::ServerUpdate => "server updates",
    };
    format!("{} new {}", count, label)
}

fn generate_batch_body(notifications: &[NotificationData]) -> String {
    if notifications.len() <= 3 {
        notifications.iter()
            .map(|n| format!("• {}", n.body))
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        let first_two: Vec<String> = notifications[..2].iter()
            .map(|n| format!("• {}", n.body))
            .collect();
        let remaining = notifications.len() - 2;
        format!("{}\n• and {} more...", first_two.join("\n"), remaining)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time;

    fn make_notification(id: &str, priority: NotificationPriority, category: NotificationCategory) -> NotificationData {
        NotificationData {
            id: id.to_string(),
            title: format!("Test {}", id),
            body: format!("Body for {}", id),
            category,
            priority,
            timestamp: 1000,
            source_id: None,
            user_id: None,
            server_id: None,
            channel_id: None,
            actions: None,
            icon: None,
            sound: false,
            persistent: false,
            expires_at: None,
        }
    }

    #[tokio::test]
    async fn test_urgent_bypasses_batching() {
        let mgr = NotificationManager::with_defaults();
        let n = make_notification("u1", NotificationPriority::Urgent, NotificationCategory::VoiceCall);
        let result = mgr.queue(n).await.unwrap();
        assert!(matches!(result, QueueResult::SentImmediately));

        let ready = mgr.flush_ready().await;
        assert_eq!(ready.len(), 1);
        assert_eq!(ready[0].0, "Test u1");
    }

    #[tokio::test]
    async fn test_normal_gets_batched() {
        let mgr = NotificationManager::with_defaults();
        let n = make_notification("n1", NotificationPriority::Normal, NotificationCategory::Message);
        let result = mgr.queue(n).await.unwrap();
        assert!(matches!(result, QueueResult::Queued));

        // Nothing ready yet (batch deadline hasn't passed)
        let ready = mgr.flush_ready().await;
        assert_eq!(ready.len(), 0);

        let stats = mgr.stats().await;
        assert_eq!(stats.pending_count, 1);
    }

    #[tokio::test]
    async fn test_batch_flush_after_delay() {
        let mut settings = NotificationSettings::default();
        // Set very short batch delay for testing
        settings.categories.get_mut(&NotificationCategory::Message).unwrap().batch_delay_ms = 10;
        let mgr = NotificationManager::new(settings);

        let n1 = make_notification("b1", NotificationPriority::Normal, NotificationCategory::Message);
        let n2 = make_notification("b2", NotificationPriority::Normal, NotificationCategory::Message);
        mgr.queue(n1).await.unwrap();
        mgr.queue(n2).await.unwrap();

        // Wait for deadline to pass
        time::sleep(Duration::from_millis(50)).await;

        let ready = mgr.flush_ready().await;
        assert_eq!(ready.len(), 1); // One batched notification
        assert!(ready[0].0.contains("2 new messages"));
    }

    #[tokio::test]
    async fn test_disabled_notifications() {
        let mut settings = NotificationSettings::default();
        settings.enabled = false;
        let mgr = NotificationManager::new(settings);

        let n = make_notification("d1", NotificationPriority::Normal, NotificationCategory::Message);
        let result = mgr.queue(n).await.unwrap();
        assert!(matches!(result, QueueResult::Disabled));
    }

    #[tokio::test]
    async fn test_category_disabled() {
        let mut settings = NotificationSettings::default();
        settings.categories.get_mut(&NotificationCategory::System).unwrap().enabled = false;
        let mgr = NotificationManager::new(settings);

        let n = make_notification("cd1", NotificationPriority::Normal, NotificationCategory::System);
        let result = mgr.queue(n).await.unwrap();
        assert!(matches!(result, QueueResult::CategoryDisabled));
    }

    #[tokio::test]
    async fn test_priority_ordering_in_batch() {
        let mut settings = NotificationSettings::default();
        settings.categories.get_mut(&NotificationCategory::Message).unwrap().batch_delay_ms = 10;
        let mgr = NotificationManager::new(settings);

        let mut low = make_notification("low", NotificationPriority::Low, NotificationCategory::Message);
        low.timestamp = 1000;
        let mut high = make_notification("high", NotificationPriority::High, NotificationCategory::Message);
        high.timestamp = 1001;
        let mut normal = make_notification("normal", NotificationPriority::Normal, NotificationCategory::Message);
        normal.timestamp = 1002;

        mgr.queue(low).await.unwrap();
        mgr.queue(high).await.unwrap();
        mgr.queue(normal).await.unwrap();

        time::sleep(Duration::from_millis(50)).await;
        let ready = mgr.flush_ready().await;
        assert_eq!(ready.len(), 1);
        // Body should list high priority item first
        assert!(ready[0].1.starts_with("• Body for high"));
    }

    #[tokio::test]
    async fn test_clear_all() {
        let mgr = NotificationManager::with_defaults();
        let n = make_notification("c1", NotificationPriority::Normal, NotificationCategory::Message);
        mgr.queue(n).await.unwrap();

        let stats = mgr.stats().await;
        assert_eq!(stats.pending_count, 1);

        mgr.clear_all().await;
        let stats = mgr.stats().await;
        assert_eq!(stats.pending_count, 0);
    }

    #[tokio::test]
    async fn test_stats() {
        let mgr = NotificationManager::with_defaults();

        let n1 = make_notification("s1", NotificationPriority::Normal, NotificationCategory::Message);
        let n2 = make_notification("s2", NotificationPriority::Normal, NotificationCategory::Mention);
        let n3 = make_notification("s3", NotificationPriority::Urgent, NotificationCategory::VoiceCall);

        mgr.queue(n1).await.unwrap();
        mgr.queue(n2).await.unwrap();
        mgr.queue(n3).await.unwrap();

        let stats = mgr.stats().await;
        // Urgent was sent immediately, not queued
        assert_eq!(stats.pending_count, 2);
        assert_eq!(*stats.pending_by_category.get(&NotificationCategory::Message).unwrap_or(&0), 1);
        assert_eq!(*stats.pending_by_category.get(&NotificationCategory::Mention).unwrap_or(&0), 1);
        assert_eq!(stats.total_sent, 1); // The urgent one
    }

    #[test]
    fn test_batch_key_generation() {
        let mut n = make_notification("k1", NotificationPriority::Normal, NotificationCategory::Message);
        n.channel_id = Some("ch-123".to_string());
        let key = make_batch_key(&n);
        assert!(key.contains("Message"));
        assert!(key.contains("ch-123"));
    }

    #[test]
    fn test_batch_title_generation() {
        let title = generate_batch_title(NotificationCategory::Message, 5);
        assert_eq!(title, "5 new messages");
    }

    #[test]
    fn test_batch_body_short() {
        let notifications = vec![
            make_notification("1", NotificationPriority::Normal, NotificationCategory::Message),
            make_notification("2", NotificationPriority::Normal, NotificationCategory::Message),
        ];
        let body = generate_batch_body(&notifications);
        assert!(body.contains("• Body for 1"));
        assert!(body.contains("• Body for 2"));
    }

    #[test]
    fn test_batch_body_long() {
        let notifications: Vec<NotificationData> = (1..=5)
            .map(|i| make_notification(&i.to_string(), NotificationPriority::Normal, NotificationCategory::Message))
            .collect();
        let body = generate_batch_body(&notifications);
        assert!(body.contains("and 3 more..."));
    }
}
