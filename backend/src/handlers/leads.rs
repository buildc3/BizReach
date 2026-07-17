use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use crate::{db::{repo, models::Lead}, error::Result, state::AppState};
use super::searches::ApiResponse;

#[derive(Deserialize)]
pub struct LeadsQuery {
    pub search_id: Uuid,
}

pub async fn list_leads(
    State(state): State<AppState>,
    Query(q): Query<LeadsQuery>,
) -> Result<Json<ApiResponse<Vec<Lead>>>> {
    let leads = repo::get_leads(&state.db, q.search_id).await?;
    Ok(Json(ApiResponse { success: true, data: leads }))
}

pub async fn get_lead(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<Lead>>> {
    let lead = repo::get_lead(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: lead }))
}
