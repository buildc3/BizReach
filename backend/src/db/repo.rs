use sqlx::PgPool;
use uuid::Uuid;
use crate::{error::{AppError, Result}, db::models::*};

// ── Searches ─────────────────────────────────────────────────────────────────

pub async fn get_searches(pool: &PgPool) -> Result<Vec<Search>> {
    sqlx::query_as!(Search, "SELECT * FROM searches ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
}

pub async fn get_search(pool: &PgPool, id: Uuid) -> Result<Search> {
    sqlx::query_as!(Search, "SELECT * FROM searches WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Search {id} not found")))
}

pub async fn insert_search(pool: &PgPool, name: &str, biz_type: &str, area: &str) -> Result<Search> {
    sqlx::query_as!(
        Search,
        "INSERT INTO searches (name, biz_type, area) VALUES ($1, $2, $3) RETURNING *",
        name, biz_type, area
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn update_search_status(pool: &PgPool, id: Uuid, status: &str) -> Result<()> {
    sqlx::query!("UPDATE searches SET status = $1 WHERE id = $2", status, id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_search(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query!("DELETE FROM searches WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Leads ─────────────────────────────────────────────────────────────────────

pub async fn get_leads(pool: &PgPool, search_id: Uuid) -> Result<Vec<Lead>> {
    sqlx::query_as!(
        Lead,
        "SELECT * FROM leads WHERE search_id = $1 ORDER BY created_at DESC",
        search_id
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn get_lead(pool: &PgPool, id: Uuid) -> Result<Lead> {
    sqlx::query_as!(Lead, "SELECT * FROM leads WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Lead {id} not found")))
}

pub async fn insert_lead(pool: &PgPool, lead: &InsertLead) -> Result<Lead> {
    sqlx::query_as!(
        Lead,
        r#"INSERT INTO leads (search_id, name, owner_name, address, phone, email, website, maps_url, lat, lon, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *"#,
        lead.search_id, lead.name, lead.owner_name, lead.address,
        lead.phone, lead.email, lead.website, lead.maps_url, lead.lat, lead.lon, lead.source
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

// ── Groups ──────────────────────────────────────────────────────────────────────

pub async fn get_groups(pool: &PgPool, search_id: Uuid) -> Result<Vec<Group>> {
    sqlx::query_as!(
        Group,
        "SELECT * FROM groups WHERE search_id = $1 ORDER BY sort_order ASC, created_at ASC",
        search_id
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn insert_group(pool: &PgPool, search_id: Uuid, name: &str, kind: &str, sort_order: i32) -> Result<Group> {
    sqlx::query_as!(
        Group,
        "INSERT INTO groups (search_id, name, kind, sort_order) VALUES ($1, $2, $3, $4) RETURNING *",
        search_id, name, kind, sort_order
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn rename_group(pool: &PgPool, id: Uuid, name: &str) -> Result<Group> {
    sqlx::query_as!(Group, "UPDATE groups SET name = $1 WHERE id = $2 RETURNING *", name, id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group {id} not found")))
}

pub async fn delete_group(pool: &PgPool, id: Uuid) -> Result<()> {
    // ON DELETE SET NULL on leads.group_id keeps the leads, just ungroups them.
    sqlx::query!("DELETE FROM groups WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Move a single lead into a group (or out of any group when `group_id` is None).
pub async fn set_lead_group(pool: &PgPool, lead_id: Uuid, group_id: Option<Uuid>) -> Result<Lead> {
    sqlx::query_as!(Lead, "UPDATE leads SET group_id = $1 WHERE id = $2 RETURNING *", group_id, lead_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Lead {lead_id} not found")))
}

/// Auto-group a search's still-ungrouped leads by contact channel.
/// Creates the standard buckets (only the non-empty ones) and assigns leads.
/// Leads the user has already placed in a group are left untouched.
pub async fn auto_group_by_contact(pool: &PgPool, search_id: Uuid) -> Result<Vec<Group>> {
    // (kind, display name, SQL predicate over a lead row)
    let buckets: [(&str, &str, &str); 3] = [
        ("has_email",  "Has email + phone", "phone IS NOT NULL AND phone <> '' AND email IS NOT NULL AND email <> ''"),
        ("phone_only", "Phone only",        "phone IS NOT NULL AND phone <> '' AND (email IS NULL OR email = '')"),
        ("no_contact", "No phone",          "phone IS NULL OR phone = ''"),
    ];

    for (i, (kind, name, pred)) in buckets.iter().enumerate() {
        let has_any: bool = sqlx::query_scalar(&format!(
            "SELECT EXISTS(SELECT 1 FROM leads WHERE search_id = $1 AND group_id IS NULL AND ({pred}))"
        ))
        .bind(search_id)
        .fetch_one(pool)
        .await?;
        if !has_any {
            continue;
        }

        // Reuse an existing bucket of this kind, otherwise create it.
        let group = match sqlx::query_as!(
            Group,
            "SELECT * FROM groups WHERE search_id = $1 AND kind = $2 LIMIT 1",
            search_id, kind
        )
        .fetch_optional(pool)
        .await?
        {
            Some(g) => g,
            None => insert_group(pool, search_id, name, kind, i as i32).await?,
        };

        sqlx::query(&format!(
            "UPDATE leads SET group_id = $1 WHERE search_id = $2 AND group_id IS NULL AND ({pred})"
        ))
        .bind(group.id)
        .bind(search_id)
        .execute(pool)
        .await?;
    }

    get_groups(pool, search_id).await
}

pub async fn get_group(pool: &PgPool, id: Uuid) -> Result<Group> {
    sqlx::query_as!(Group, "SELECT * FROM groups WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Group {id} not found")))
}

pub async fn get_leads_in_group(pool: &PgPool, group_id: Uuid) -> Result<Vec<Lead>> {
    sqlx::query_as!(Lead, "SELECT * FROM leads WHERE group_id = $1 ORDER BY created_at ASC", group_id)
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
}

// ── Pitches (draft messages) ────────────────────────────────────────────────────

/// Insert a pitch as a draft message awaiting review.
pub async fn insert_draft(pool: &PgPool, lead_id: Uuid, template_id: Option<Uuid>, body: &str) -> Result<Message> {
    sqlx::query_as!(
        Message,
        "INSERT INTO messages (lead_id, template_id, body, status) VALUES ($1, $2, $3, 'draft') RETURNING *",
        lead_id, template_id, body
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

/// Remove only the not-yet-reviewed drafts for a group's leads (regeneration).
/// Reviewed/sent pitches are left untouched.
pub async fn delete_draft_pitches_for_group(pool: &PgPool, group_id: Uuid) -> Result<u64> {
    let res = sqlx::query!(
        "DELETE FROM messages WHERE status = 'draft'
           AND lead_id IN (SELECT id FROM leads WHERE group_id = $1)",
        group_id
    )
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}

/// All pitches for a group's leads, with lead display info, for the review screen.
pub async fn get_group_pitches(pool: &PgPool, group_id: Uuid) -> Result<Vec<PitchWithLead>> {
    sqlx::query_as!(
        PitchWithLead,
        r#"SELECT
               m.id            AS "id!",
               m.lead_id       AS "lead_id!",
               m.template_id   AS "template_id?",
               m.body          AS "body!",
               m.status        AS "status!",
               m.sent_at       AS "sent_at?",
               m.reviewed_at   AS "reviewed_at?",
               m.delivered_at  AS "delivered_at?",
               m.replied_at    AS "replied_at?",
               m.created_at    AS "created_at!",
               l.name          AS "lead_name!",
               l.phone         AS "lead_phone?"
           FROM messages m
           JOIN leads l ON l.id = m.lead_id
           WHERE l.group_id = $1
           ORDER BY m.created_at ASC"#,
        group_id
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

/// Move a pitch through its review lifecycle (draft → reviewed | rejected).
pub async fn set_pitch_status(pool: &PgPool, id: Uuid, status: &str) -> Result<Message> {
    let msg = match status {
        "reviewed" => sqlx::query_as!(
            Message,
            "UPDATE messages SET status = 'reviewed', reviewed_at = NOW() WHERE id = $1 RETURNING *",
            id
        ).fetch_optional(pool).await?,
        _ => sqlx::query_as!(
            Message,
            "UPDATE messages SET status = $1 WHERE id = $2 RETURNING *",
            status, id
        ).fetch_optional(pool).await?,
    };
    msg.ok_or_else(|| AppError::NotFound(format!("Pitch {id} not found")))
}

/// Edit a draft pitch's body (only while still a draft).
pub async fn update_pitch_body(pool: &PgPool, id: Uuid, body: &str) -> Result<Message> {
    sqlx::query_as!(
        Message,
        "UPDATE messages SET body = $1 WHERE id = $2 AND status IN ('draft', 'reviewed') RETURNING *",
        body, id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Editable pitch {id} not found")))
}

// ── Templates ─────────────────────────────────────────────────────────────────

pub async fn get_templates(pool: &PgPool) -> Result<Vec<Template>> {
    sqlx::query_as!(Template, "SELECT * FROM templates ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
}

pub async fn get_template(pool: &PgPool, id: Uuid) -> Result<Template> {
    sqlx::query_as!(Template, "SELECT * FROM templates WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Template {id} not found")))
}

pub async fn insert_template(pool: &PgPool, name: &str, body: &str, product_id: Option<Uuid>) -> Result<Template> {
    sqlx::query_as!(
        Template,
        "INSERT INTO templates (name, body, product_id) VALUES ($1, $2, $3) RETURNING *",
        name, body, product_id
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn update_template(pool: &PgPool, id: Uuid, name: &str, body: &str, product_id: Option<Uuid>) -> Result<Template> {
    sqlx::query_as!(
        Template,
        "UPDATE templates SET name = $1, body = $2, product_id = $3 WHERE id = $4 RETURNING *",
        name, body, product_id, id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Template {id} not found")))
}

pub async fn delete_template(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query!("DELETE FROM templates WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Sender profile ────────────────────────────────────────────────────────────

const PROFILE_ID: &str = "00000000-0000-0000-0000-000000000001";

pub async fn get_sender_profile(pool: &PgPool) -> Result<SenderProfile> {
    let id: Uuid = PROFILE_ID.parse().expect("valid constant UUID");
    sqlx::query_as!(SenderProfile, "SELECT * FROM sender_profile WHERE id = $1", id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn update_sender_profile(
    pool: &PgPool,
    your_name: Option<&str>,
    company_name: Option<&str>,
    phone: Option<&str>,
    website: Option<&str>,
) -> Result<SenderProfile> {
    let id: Uuid = PROFILE_ID.parse().expect("valid constant UUID");
    sqlx::query_as!(
        SenderProfile,
        "UPDATE sender_profile
         SET your_name=$1, company_name=$2, phone=$3, website=$4, updated_at=NOW()
         WHERE id=$5 RETURNING *",
        your_name, company_name, phone, website, id
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

// ── Messages ──────────────────────────────────────────────────────────────────

pub async fn get_message(pool: &PgPool, id: Uuid) -> Result<Message> {
    sqlx::query_as!(Message, "SELECT * FROM messages WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Message {id} not found")))
}

pub async fn get_messages(pool: &PgPool, lead_id: Option<Uuid>) -> Result<Vec<Message>> {
    match lead_id {
        Some(id) => sqlx::query_as!(
            Message,
            "SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at DESC",
            id
        ).fetch_all(pool).await.map_err(AppError::from),
        None => sqlx::query_as!(
            Message,
            "SELECT * FROM messages ORDER BY created_at DESC"
        ).fetch_all(pool).await.map_err(AppError::from),
    }
}

pub async fn get_followups(pool: &PgPool, older_than_days: i32) -> Result<Vec<Message>> {
    sqlx::query_as!(
        Message,
        r#"SELECT * FROM messages
           WHERE status IN ('sent', 'delivered')
             AND replied_at IS NULL
             AND sent_at < NOW() - ($1 || ' days')::INTERVAL
           ORDER BY sent_at ASC"#,
        older_than_days.to_string()
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn insert_message(pool: &PgPool, lead_id: Uuid, template_id: Option<Uuid>, body: &str) -> Result<Message> {
    sqlx::query_as!(
        Message,
        "INSERT INTO messages (lead_id, template_id, body) VALUES ($1, $2, $3) RETURNING *",
        lead_id, template_id, body
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn update_message_status(pool: &PgPool, id: Uuid, status: &str) -> Result<()> {
    match status {
        "sent" => sqlx::query!(
            "UPDATE messages SET status = $1, sent_at = NOW() WHERE id = $2", status, id
        ).execute(pool).await?,
        "replied" => sqlx::query!(
            "UPDATE messages SET status = $1, replied_at = NOW() WHERE id = $2", status, id
        ).execute(pool).await?,
        _ => sqlx::query!(
            "UPDATE messages SET status = $1 WHERE id = $2", status, id
        ).execute(pool).await?,
    };
    Ok(())
}

// ── Products ──────────────────────────────────────────────────────────────────

pub async fn get_products(pool: &PgPool) -> Result<Vec<Product>> {
    sqlx::query_as!(Product, "SELECT * FROM products ORDER BY created_at ASC")
        .fetch_all(pool)
        .await
        .map_err(AppError::from)
}

pub async fn get_product(pool: &PgPool, id: Uuid) -> Result<Product> {
    sqlx::query_as!(Product, "SELECT * FROM products WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Product {id} not found")))
}

pub async fn insert_product(pool: &PgPool, name: &str, description: Option<&str>, price: Option<f64>, category: &str) -> Result<Product> {
    sqlx::query_as!(
        Product,
        "INSERT INTO products (name, description, price, category) VALUES ($1, $2, $3, $4) RETURNING *",
        name, description, price, category
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn update_product(pool: &PgPool, id: Uuid, name: &str, description: Option<&str>, price: Option<f64>, category: &str, active: bool) -> Result<Product> {
    sqlx::query_as!(
        Product,
        "UPDATE products SET name=$1, description=$2, price=$3, category=$4, active=$5 WHERE id=$6 RETURNING *",
        name, description, price, category, active, id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Product {id} not found")))
}

pub async fn delete_product(pool: &PgPool, id: Uuid) -> Result<()> {
    sqlx::query!("DELETE FROM products WHERE id = $1", id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Helper types ─────────────────────────────────────────────────────────────

pub struct InsertLead {
    pub search_id: Uuid,
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
}
