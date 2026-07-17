use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use crate::{db::{repo, models::{Group, Lead}}, error::{AppError, Result}, state::AppState};
use super::searches::ApiResponse;

#[derive(Deserialize)]
pub struct GroupsQuery {
    pub search_id: Uuid,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupInput {
    pub search_id: Uuid,
    pub name: String,
}

#[derive(Deserialize)]
pub struct RenameGroupInput {
    pub name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveLeadInput {
    /// `None` ungroups the lead; `Some(id)` moves it into that group.
    pub group_id: Option<Uuid>,
}

pub async fn list_groups(
    State(state): State<AppState>,
    Query(q): Query<GroupsQuery>,
) -> Result<Json<ApiResponse<Vec<Group>>>> {
    let groups = repo::get_groups(&state.db, q.search_id).await?;
    Ok(Json(ApiResponse { success: true, data: groups }))
}

pub async fn create_group(
    State(state): State<AppState>,
    Json(input): Json<CreateGroupInput>,
) -> Result<Json<ApiResponse<Group>>> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Group name is required".into()));
    }
    let group = repo::insert_group(&state.db, input.search_id, name, "manual", 99).await?;
    Ok(Json(ApiResponse { success: true, data: group }))
}

/// (Re)build the contact-channel buckets for a search. Idempotent — only touches
/// leads that aren't already in a group.
pub async fn auto_group(
    State(state): State<AppState>,
    Path(search_id): Path<Uuid>,
) -> Result<Json<ApiResponse<Vec<Group>>>> {
    let groups = repo::auto_group_by_contact(&state.db, search_id).await?;
    Ok(Json(ApiResponse { success: true, data: groups }))
}

pub async fn rename_group(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<RenameGroupInput>,
) -> Result<Json<ApiResponse<Group>>> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Group name is required".into()));
    }
    let group = repo::rename_group(&state.db, id, name).await?;
    Ok(Json(ApiResponse { success: true, data: group }))
}

pub async fn delete_group(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<&'static str>>> {
    repo::delete_group(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: "deleted" }))
}

pub async fn move_lead(
    State(state): State<AppState>,
    Path(lead_id): Path<Uuid>,
    Json(input): Json<MoveLeadInput>,
) -> Result<Json<ApiResponse<Lead>>> {
    let lead = repo::set_lead_group(&state.db, lead_id, input.group_id).await?;
    Ok(Json(ApiResponse { success: true, data: lead }))
}
