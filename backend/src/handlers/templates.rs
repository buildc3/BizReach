use axum::{extract::{Path, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;
use crate::{db::{repo, models::Template}, error::{AppError, Result}, services::pitch, state::AppState};
use super::{pitches::render_template, searches::ApiResponse};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratePitchInput {
    pub lead_id: Uuid,
    #[serde(default)]
    pub product_id: Option<Uuid>,
    #[serde(default)]
    pub instructions: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInput {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    #[validate(length(min = 1, message = "Body is required"))]
    pub body: String,
    #[serde(default)]
    pub product_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTemplateInput {
    pub product_id: Uuid,
    pub description: String,
}

pub async fn list_templates(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Template>>>> {
    let templates = repo::get_templates(&state.db).await?;
    Ok(Json(ApiResponse { success: true, data: templates }))
}

pub async fn create_template(
    State(state): State<AppState>,
    Json(input): Json<TemplateInput>,
) -> Result<Json<ApiResponse<Template>>> {
    input.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let template = repo::insert_template(&state.db, &input.name, &input.body, input.product_id).await?;
    Ok(Json(ApiResponse { success: true, data: template }))
}

pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<TemplateInput>,
) -> Result<Json<ApiResponse<Template>>> {
    input.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let template = repo::update_template(&state.db, id, &input.name, &input.body, input.product_id).await?;
    Ok(Json(ApiResponse { success: true, data: template }))
}

/// AI-generate a reusable template body for a product, given a short description.
/// The selected product's context is automatically injected into the prompt.
pub async fn generate_template(
    State(state): State<AppState>,
    Json(input): Json<GenerateTemplateInput>,
) -> Result<Json<ApiResponse<String>>> {
    if input.description.trim().is_empty() {
        return Err(AppError::Validation("description is required".into()));
    }
    let product = repo::get_product(&state.db, input.product_id).await?;
    let body = pitch::generate_template(&state.config, &product, input.description.trim()).await?;
    Ok(Json(ApiResponse { success: true, data: body }))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<&'static str>>> {
    repo::delete_template(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: "deleted" }))
}

pub async fn render_pitch(
    State(state): State<AppState>,
    Path((template_id, lead_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ApiResponse<String>>> {
    let template = repo::get_template(&state.db, template_id).await?;
    let lead = repo::get_lead(&state.db, lead_id).await?;
    let search = repo::get_search(&state.db, lead.search_id).await?;
    let profile = repo::get_sender_profile(&state.db).await.ok();

    let rendered = render_template(&template.body, &lead, &search, profile.as_ref());
    Ok(Json(ApiResponse { success: true, data: rendered }))
}

/// Generate a fresh, AI-written outreach message for a lead (no template needed).
pub async fn generate_pitch(
    State(state): State<AppState>,
    Json(input): Json<GeneratePitchInput>,
) -> Result<Json<ApiResponse<String>>> {
    let lead = repo::get_lead(&state.db, input.lead_id).await?;
    let search = repo::get_search(&state.db, lead.search_id).await?;
    let product = if let Some(pid) = input.product_id {
        Some(repo::get_product(&state.db, pid).await?)
    } else {
        None
    };
    let profile = repo::get_sender_profile(&state.db).await.ok();
    let message = pitch::generate_pitch(
        &state.config,
        &lead,
        &search,
        product.as_ref(),
        input.instructions.as_deref(),
        profile.as_ref(),
    ).await?;
    Ok(Json(ApiResponse { success: true, data: message }))
}
