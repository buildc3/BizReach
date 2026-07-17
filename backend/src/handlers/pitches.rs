use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use crate::{
    db::{repo, models::{Lead, Message, PitchWithLead, Search, SenderProfile}},
    error::{AppError, Result},
    services::pitch,
    state::AppState,
};
use super::searches::ApiResponse;

#[derive(serde::Serialize)]
pub struct SendGroupResult {
    pub queued: usize,
}

/// Case-insensitive `{TOKEN}` → value substitution.
///
/// Scans the template for `{…}` pairs, lowercases the token, looks it up in
/// `vars`, and replaces it. Unrecognised tokens are kept verbatim so the user
/// can see what's still unfilled.
pub fn render_template(body: &str, lead: &Lead, search: &Search, profile: Option<&SenderProfile>) -> String {
    let your_name    = profile.and_then(|p| p.your_name.as_deref()).unwrap_or("");
    let company_name = profile.and_then(|p| p.company_name.as_deref()).unwrap_or("");
    let your_phone   = profile.and_then(|p| p.phone.as_deref()).unwrap_or("");
    let your_website = profile.and_then(|p| p.website.as_deref()).unwrap_or("");

    let vars: &[(&str, &str)] = &[
        ("business_name",     lead.name.as_str()),
        ("owner_name",        lead.owner_name.as_deref().unwrap_or("there")),
        ("area",              lead.address.as_deref().unwrap_or("your area")),
        ("phone",             lead.phone.as_deref().unwrap_or("")),
        ("email",             lead.email.as_deref().unwrap_or("")),
        ("website",           lead.website.as_deref().unwrap_or("")),
        ("business_type",     search.biz_type.as_str()),
        ("business_category", search.biz_type.as_str()),
        ("your_name",         your_name),
        ("your_company_name", company_name),
        ("phone_number",      your_phone),
        ("website_url",       your_website),
    ];

    // Build lowercase → value lookup
    let lookup: std::collections::HashMap<String, &str> = vars
        .iter()
        .map(|(k, v)| (k.to_lowercase(), *v))
        .collect();

    let mut result = String::with_capacity(body.len() + 64);
    let mut rest = body;

    while let Some(open) = rest.find('{') {
        result.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        match after.find('}') {
            Some(close) => {
                let token = &after[..close];
                let key = token.to_lowercase();
                match lookup.get(key.as_str()) {
                    Some(val) => result.push_str(val),
                    None      => { result.push('{'); result.push_str(token); result.push('}'); }
                }
                rest = &after[close + 1..];
            }
            None => { result.push('{'); rest = after; }
        }
    }
    result.push_str(rest);
    result
}

fn has_phone(lead: &Lead) -> bool {
    lead.phone.as_deref().map(|p| !p.trim().is_empty()).unwrap_or(false)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateBatchInput {
    pub group_id: Uuid,
    pub mode: String, // "template" | "ai"
    #[serde(default)]
    pub template_id: Option<Uuid>,
    #[serde(default)]
    pub product_id: Option<Uuid>,
    #[serde(default)]
    pub instructions: Option<String>,
}

/// Generate a per-lead draft pitch for every messageable lead in a group.
/// Returns immediately; generation runs in the background (poll GET /pitches).
/// Existing un-reviewed drafts for the group are replaced.
pub async fn generate_batch(
    State(state): State<AppState>,
    Json(input): Json<GenerateBatchInput>,
) -> Result<Json<ApiResponse<&'static str>>> {
    let mode = input.mode.clone();
    if mode != "template" && mode != "ai" {
        return Err(AppError::Validation("mode must be 'template' or 'ai'".into()));
    }

    let group = repo::get_group(&state.db, input.group_id).await?;
    let search = repo::get_search(&state.db, group.search_id).await?;

    // Load template/product up front so bad inputs fail synchronously.
    let template = match input.template_id {
        Some(id) => Some(repo::get_template(&state.db, id).await?),
        None => None,
    };
    if mode == "template" && template.is_none() {
        return Err(AppError::Validation("templateId is required for template mode".into()));
    }
    let product = match input.product_id {
        Some(id) => Some(repo::get_product(&state.db, id).await?),
        None => None,
    };

    // Load sender profile (best-effort; missing fields are silently empty)
    let profile = repo::get_sender_profile(&state.db).await.ok();

    let db = state.db.clone();
    let config = state.config.clone();
    let group_id = input.group_id;
    let instructions = input.instructions.clone();

    tokio::spawn(async move {
        if let Err(e) = repo::delete_draft_pitches_for_group(&db, group_id).await {
            tracing::warn!("clearing old drafts failed for group {group_id}: {e}");
        }
        let leads = match repo::get_leads_in_group(&db, group_id).await {
            Ok(l) => l,
            Err(e) => { tracing::error!("loading leads for group {group_id} failed: {e}"); return; }
        };

        let mut made = 0usize;
        for lead in leads {
            if !has_phone(&lead) {
                continue; // can't message without a phone
            }
            let body = if mode == "ai" {
                match pitch::generate_pitch(&config, &lead, &search, product.as_ref(), instructions.as_deref(), profile.as_ref()).await {
                    Ok(b) => b,
                    Err(e) => { tracing::warn!("AI pitch failed for lead {}: {e}", lead.id); continue; }
                }
            } else {
                render_template(&template.as_ref().unwrap().body, &lead, &search, profile.as_ref())
            };
            let tid = template.as_ref().map(|t| t.id);
            match repo::insert_draft(&db, lead.id, tid, &body).await {
                Ok(_) => made += 1,
                Err(e) => tracing::warn!("insert draft failed for lead {}: {e}", lead.id),
            }
        }
        tracing::info!("group {group_id}: generated {made} draft pitches ({mode} mode)");
    });

    Ok(Json(ApiResponse { success: true, data: "started" }))
}

#[derive(Deserialize)]
pub struct PitchesQuery {
    pub group_id: Uuid,
}

pub async fn list_group_pitches(
    State(state): State<AppState>,
    Query(q): Query<PitchesQuery>,
) -> Result<Json<ApiResponse<Vec<PitchWithLead>>>> {
    let pitches = repo::get_group_pitches(&state.db, q.group_id).await?;
    Ok(Json(ApiResponse { success: true, data: pitches }))
}

#[derive(Deserialize)]
pub struct UpdatePitchInput {
    pub body: String,
}

/// Edit a draft/reviewed pitch's text.
pub async fn update_pitch(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdatePitchInput>,
) -> Result<Json<ApiResponse<Message>>> {
    if input.body.trim().is_empty() {
        return Err(AppError::Validation("Pitch body cannot be empty".into()));
    }
    let msg = repo::update_pitch_body(&state.db, id, input.body.trim()).await?;
    Ok(Json(ApiResponse { success: true, data: msg }))
}

pub async fn review_pitch(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<Message>>> {
    let msg = repo::set_pitch_status(&state.db, id, "reviewed").await?;
    Ok(Json(ApiResponse { success: true, data: msg }))
}

pub async fn reject_pitch(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<Message>>> {
    let msg = repo::set_pitch_status(&state.db, id, "rejected").await?;
    Ok(Json(ApiResponse { success: true, data: msg }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendGroupInput {
    pub group_id: Uuid,
}

/// Enqueue all reviewed pitches for a group into the rate-limited send queue.
/// Returns the count of pitches queued.
pub async fn send_group(
    State(state): State<AppState>,
    Json(input): Json<SendGroupInput>,
) -> Result<Json<ApiResponse<SendGroupResult>>> {
    let pitches = repo::get_group_pitches(&state.db, input.group_id).await?;
    let mut queued = 0usize;
    for p in &pitches {
        if p.status == "reviewed" {
            repo::set_pitch_status(&state.db, p.id, "queued").await?;
            state.send_queue.enqueue(p.id);
            queued += 1;
        }
    }
    Ok(Json(ApiResponse { success: true, data: SendGroupResult { queued } }))
}
