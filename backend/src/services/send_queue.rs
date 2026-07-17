//! Rate-limited WhatsApp send queue.
//!
//! A single background worker drains message IDs off an unbounded channel and
//! sends them one at a time, sleeping a jittered 20–40s between sends so traffic
//! looks human and the WhatsApp number is not flagged. All bulk sends go through
//! here — never loop-and-send directly.

use std::time::{Duration, SystemTime, UNIX_EPOCH};
use sqlx::PgPool;
use tokio::sync::mpsc;
use uuid::Uuid;
use crate::{db::repo, error::Result, services::whatsapp};

#[derive(Clone)]
pub struct SendQueue {
    tx: mpsc::UnboundedSender<Uuid>,
}

impl SendQueue {
    /// Start the worker and return a cloneable handle for enqueuing.
    pub fn start(pool: PgPool) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<Uuid>();
        tokio::spawn(async move {
            while let Some(message_id) = rx.recv().await {
                match process_one(&pool, message_id).await {
                    Ok(true) => {} // actually attempted a send
                    Ok(false) => continue, // skipped (e.g. no longer queued) — don't pace
                    Err(e) => tracing::warn!("send queue: message {message_id} failed: {e}"),
                }
                // Pace the next send.
                tokio::time::sleep(Duration::from_millis(jitter_ms())).await;
            }
            tracing::warn!("send queue worker stopped (channel closed)");
        });
        Self { tx }
    }

    /// Hand a queued message to the worker. No-op if the worker has stopped.
    pub fn enqueue(&self, message_id: Uuid) {
        if self.tx.send(message_id).is_err() {
            tracing::error!("send queue: failed to enqueue {message_id} (worker gone)");
        }
    }
}

/// Returns Ok(true) if a send was attempted (so the worker should pace),
/// Ok(false) if the job was skipped without contacting WhatsApp.
async fn process_one(pool: &PgPool, message_id: Uuid) -> Result<bool> {
    let msg = repo::get_message(pool, message_id).await?;
    if msg.status != "queued" {
        return Ok(false); // already handled or cancelled
    }
    let lead = repo::get_lead(pool, msg.lead_id).await?;
    let phone = match lead.phone.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => p.to_string(),
        None => {
            repo::update_message_status(pool, message_id, "failed").await?;
            return Ok(false);
        }
    };

    match whatsapp::send_message(&phone, &msg.body).await {
        Ok(_) => {
            repo::update_message_status(pool, message_id, "sent").await?;
            Ok(true)
        }
        Err(e) => {
            repo::update_message_status(pool, message_id, "failed").await?;
            Err(e)
        }
    }
}

/// A jittered delay in 20_000..=40_000 ms, derived from clock entropy
/// (no extra rng dependency).
fn jitter_ms() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0) as u64;
    20_000 + (nanos % 20_001)
}
