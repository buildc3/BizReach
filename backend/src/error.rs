use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Scraper error: {0}")]
    Scraper(String),

    #[error("WhatsApp error: {0}")]
    WhatsApp(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION", msg.clone()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::Scraper(msg) => (StatusCode::BAD_GATEWAY, "SCRAPER", msg.clone()),
            AppError::WhatsApp(msg) => (StatusCode::BAD_GATEWAY, "WHATSAPP", msg.clone()),
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE", e.to_string()),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL", msg.clone()),
        };

        tracing::error!(code, %message, "request error");
        (status, Json(json!({ "success": false, "code": code, "message": message }))).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
