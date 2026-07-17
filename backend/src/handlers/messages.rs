use axum::{extract::{Query, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use crate::{db::{repo, models::Message}, error::{AppError, Result}, services::whatsapp, state::AppState};
use super::searches::ApiResponse;

#[derive(Deserialize)]
pub struct MessagesQuery {
    pub lead_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct FollowupsQuery {
    pub older_than_days: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPitchInput {
    pub lead_id: Uuid,
    pub template_id: Uuid,
}

pub async fn list_messages(
    State(state): State<AppState>,
    Query(q): Query<MessagesQuery>,
) -> Result<Json<ApiResponse<Vec<Message>>>> {
    let messages = repo::get_messages(&state.db, q.lead_id).await?;
    Ok(Json(ApiResponse { success: true, data: messages }))
}

pub async fn list_followups(
    State(state): State<AppState>,
    Query(q): Query<FollowupsQuery>,
) -> Result<Json<ApiResponse<Vec<Message>>>> {
    let days = q.older_than_days.unwrap_or(3);
    let messages = repo::get_followups(&state.db, days).await?;
    Ok(Json(ApiResponse { success: true, data: messages }))
}

pub async fn send_pitch(
    State(state): State<AppState>,
    Json(input): Json<SendPitchInput>,
) -> Result<Json<ApiResponse<Message>>> {
    let template = repo::get_template(&state.db, input.template_id).await?;
    let lead = repo::get_lead(&state.db, input.lead_id).await?;

    let phone = lead.phone.as_deref()
        .ok_or_else(|| AppError::Validation("Lead has no phone number".into()))?;

    let body = template.body
        .replace("{business_name}", &lead.name)
        .replace("{owner_name}", lead.owner_name.as_deref().unwrap_or("there"))
        .replace("{area}", lead.address.as_deref().unwrap_or("your area"));

    let message = repo::insert_message(&state.db, input.lead_id, Some(input.template_id), &body).await?;

    // Send via local Baileys sidecar — async so the HTTP response returns immediately
    let db = state.db.clone();
    let msg_id = message.id;
    let phone = phone.to_string();
    let body_clone = body.clone();
    tokio::spawn(async move {
        match whatsapp::send_message(&phone, &body_clone).await {
            Ok(_) => { let _ = repo::update_message_status(&db, msg_id, "sent").await; }
            Err(_) => { let _ = repo::update_message_status(&db, msg_id, "failed").await; }
        }
    });

    Ok(Json(ApiResponse { success: true, data: message }))
}

