use axum::{extract::State, Json};
use serde::Deserialize;
use crate::{db::{repo, models::SenderProfile}, error::Result, state::AppState};
use super::searches::ApiResponse;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileInput {
    #[serde(default)]
    pub your_name: Option<String>,
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
}

pub async fn get_profile(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<SenderProfile>>> {
    let profile = repo::get_sender_profile(&state.db).await?;
    Ok(Json(ApiResponse { success: true, data: profile }))
}

pub async fn update_profile(
    State(state): State<AppState>,
    Json(input): Json<UpdateProfileInput>,
) -> Result<Json<ApiResponse<SenderProfile>>> {
    let profile = repo::update_sender_profile(
        &state.db,
        input.your_name.as_deref(),
        input.company_name.as_deref(),
        input.phone.as_deref(),
        input.website.as_deref(),
    ).await?;
    Ok(Json(ApiResponse { success: true, data: profile }))
}
