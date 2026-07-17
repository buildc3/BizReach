use axum::{extract::State, Json};
use serde::Serialize;
use crate::{error::Result, services::whatsapp, state::AppState};
use super::searches::ApiResponse;

#[derive(Serialize)]
pub struct WhatsAppStatus {
    pub connected: bool,
    pub qr: Option<String>,
}

/// GET /api/v1/whatsapp/status
/// Returns sidecar connection state and QR data URL (if waiting for scan).
pub async fn status(_: State<AppState>) -> Result<Json<ApiResponse<WhatsAppStatus>>> {
    let s = whatsapp::get_status().await?;
    Ok(Json(ApiResponse {
        success: true,
        data: WhatsAppStatus { connected: s.connected, qr: s.qr },
    }))
}

/// POST /api/v1/whatsapp/logout
/// Disconnects WhatsApp and wipes the saved credentials (forces new QR scan).
pub async fn logout(_: State<AppState>) -> Result<Json<ApiResponse<&'static str>>> {
    whatsapp::logout().await?;
    Ok(Json(ApiResponse { success: true, data: "logged out" }))
}
