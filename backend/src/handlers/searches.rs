use axum::{extract::{Path, State}, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use crate::{db::{repo, models::Search}, error::Result, services::scraper, state::AppState};

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct CreateSearchInput {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    #[validate(length(min = 1, message = "Business type is required"))]
    pub biz_type: String,
    #[validate(length(min = 1, message = "Area is required"))]
    pub area: String,
}

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: T,
}

pub async fn list_searches(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<Vec<Search>>>> {
    let searches = repo::get_searches(&state.db).await?;
    Ok(Json(ApiResponse { success: true, data: searches }))
}

pub async fn get_search(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<Search>>> {
    let search = repo::get_search(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: search }))
}

pub async fn create_search(
    State(state): State<AppState>,
    Json(input): Json<CreateSearchInput>,
) -> Result<Json<ApiResponse<Search>>> {
    input.validate().map_err(|e| crate::error::AppError::Validation(e.to_string()))?;
    let search = repo::insert_search(&state.db, &input.name, &input.biz_type, &input.area).await?;
    Ok(Json(ApiResponse { success: true, data: search }))
}

pub async fn delete_search(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<&'static str>>> {
    repo::delete_search(&state.db, id).await?;
    Ok(Json(ApiResponse { success: true, data: "deleted" }))
}

/// Kick off scraping for a search. Returns immediately; the scrape runs in the
/// background and updates the search status (running → done | error) as it goes.
pub async fn run_search(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiResponse<&'static str>>> {
    let search = repo::get_search(&state.db, id).await?;
    repo::update_search_status(&state.db, id, "running").await?;

    let db = state.db.clone();
    let config = state.config.clone();
    tokio::spawn(async move {
        match scraper::search_businesses(&config, search.id, &search.biz_type, &search.area).await {
            Ok(leads) => {
                let mut inserted = 0usize;
                for lead in &leads {
                    match repo::insert_lead(&db, lead).await {
                        Ok(_) => inserted += 1,
                        Err(e) => tracing::warn!("insert_lead failed for search {}: {e}", search.id),
                    }
                }
                tracing::info!("search {} done: {inserted} leads", search.id);
                // Auto-group the fresh leads by contact channel (best-effort).
                if let Err(e) = repo::auto_group_by_contact(&db, search.id).await {
                    tracing::warn!("auto-group failed for search {}: {e}", search.id);
                }
                let _ = repo::update_search_status(&db, search.id, "done").await;
            }
            Err(e) => {
                tracing::error!("scrape failed for search {}: {e}", search.id);
                let _ = repo::update_search_status(&db, search.id, "error").await;
            }
        }
    });

    Ok(Json(ApiResponse { success: true, data: "started" }))
}
