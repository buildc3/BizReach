use axum::{extract::{Path, State}, Json};
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;
use crate::{db::repo, error::{AppError, Result}, services::pitch, state::AppState};
use super::searches::ApiResponse;

#[derive(Debug, Deserialize, Validate)]
pub struct ProductInput {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    pub description: Option<String>,
    pub price: Option<f64>,
    #[validate(length(min = 1, message = "Category is required"))]
    pub category: String,
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool { true }

pub async fn list_products(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<crate::db::models::Product>>>> {
    let products = repo::get_products(&state.db).await?;
    Ok(Json(ApiResponse { success: true, data: products }))
}

pub async fn get_product(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<crate::db::models::Product>>> {
    let product = repo::get_product(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: product }))
}

pub async fn create_product(
    State(state): State<AppState>,
    Json(input): Json<ProductInput>,
) -> Result<Json<ApiResponse<crate::db::models::Product>>> {
    input.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let product = repo::insert_product(
        &state.db,
        &input.name,
        input.description.as_deref(),
        input.price,
        &input.category,
    ).await?;
    Ok(Json(ApiResponse { success: true, data: product }))
}

pub async fn update_product(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<ProductInput>,
) -> Result<Json<ApiResponse<crate::db::models::Product>>> {
    input.validate().map_err(|e| AppError::Validation(e.to_string()))?;
    let product = repo::update_product(
        &state.db,
        id,
        &input.name,
        input.description.as_deref(),
        input.price,
        &input.category,
        input.active,
    ).await?;
    Ok(Json(ApiResponse { success: true, data: product }))
}

pub async fn delete_product(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<&'static str>>> {
    repo::delete_product(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: "deleted" }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiFillInput {
    pub raw_description: String,
}

pub async fn ai_fill_product(
    State(state): State<AppState>,
    Json(input): Json<AiFillInput>,
) -> Result<Json<ApiResponse<pitch::ProductFill>>> {
    if input.raw_description.trim().is_empty() {
        return Err(AppError::Validation("rawDescription is required".into()));
    }
    let fill = pitch::fill_product(&state.config, input.raw_description.trim()).await?;
    Ok(Json(ApiResponse { success: true, data: fill }))
}
