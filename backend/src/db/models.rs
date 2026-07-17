use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Search {
    pub id: Uuid,
    pub name: String,
    pub biz_type: String,
    pub area: String,
    pub status: String, // pending | running | done | error
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Lead {
    pub id: Uuid,
    pub search_id: Uuid,
    pub group_id: Option<Uuid>,
    pub name: String,
    pub owner_name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub website: Option<String>,
    pub maps_url: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub source: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// A batch of leads within a search. Created automatically (by contact channel)
/// when a scrape finishes, and freely renamed / merged / repopulated by the user.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: Uuid,
    pub search_id: Uuid,
    pub name: String,
    pub kind: String, // has_email | phone_only | no_contact | manual
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    pub id: Uuid,
    pub name: String,
    pub body: String,
    pub product_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: Option<f64>,
    pub category: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: Uuid,
    pub lead_id: Uuid,
    pub template_id: Option<Uuid>,
    pub body: String,
    pub status: String, // draft | reviewed | rejected | queued | sent | delivered | replied | failed
    pub sent_at: Option<DateTime<Utc>>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub replied_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Sender identity used to fill signature placeholders in outreach templates.
/// Exactly one row always exists (pre-seeded by migration 007).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SenderProfile {
    pub id: Uuid,
    pub your_name: Option<String>,
    pub company_name: Option<String>,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub updated_at: DateTime<Utc>,
}

/// A pitch (message) joined with its lead's display info, for the review screen.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PitchWithLead {
    pub id: Uuid,
    pub lead_id: Uuid,
    pub template_id: Option<Uuid>,
    pub body: String,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub replied_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub lead_name: String,
    pub lead_phone: Option<String>,
}
