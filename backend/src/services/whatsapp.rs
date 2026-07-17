use crate::error::{AppError, Result};
use serde::Deserialize;

const SIDECAR_URL: &str = "http://127.0.0.1:3099";

#[derive(Deserialize)]
pub struct SidecarStatus {
    pub connected: bool,
    pub qr: Option<String>,
}

/// Send a WhatsApp message via the local Baileys sidecar.
/// `phone` must be in international digits-only format, e.g. "919876543210".
pub async fn send_message(phone: &str, body: &str) -> Result<()> {
    let normalised = normalise_phone(phone);

    let client = reqwest::Client::new();
    let res = client
        .post(format!("{SIDECAR_URL}/api/send"))
        .json(&serde_json::json!({ "phone": normalised, "message": body }))
        .send()
        .await
        .map_err(|_| AppError::WhatsApp(
            "Could not reach the local WhatsApp service. Make sure the sidecar is running.".into()
        ))?;

    if res.status().as_u16() == 503 {
        return Err(AppError::WhatsApp(
            "WhatsApp is not connected. Please scan the QR code in Settings → WhatsApp.".into()
        ));
    }

    if !res.status().is_success() {
        let err: serde_json::Value = res.json().await.unwrap_or_default();
        let msg = err["error"].as_str().unwrap_or("Unknown sidecar error").to_string();
        return Err(AppError::WhatsApp(msg));
    }

    Ok(())
}

/// Proxy the sidecar's status (connected + QR data URL) to the frontend.
pub async fn get_status() -> Result<SidecarStatus> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{SIDECAR_URL}/api/status"))
        .send()
        .await
        .map_err(|_| AppError::WhatsApp(
            "Could not reach the local WhatsApp service. Make sure the sidecar is running.".into()
        ))?;

    let status: SidecarStatus = res.json().await
        .map_err(|e| AppError::WhatsApp(e.to_string()))?;

    Ok(status)
}

/// Disconnect WhatsApp and wipe saved credentials.
pub async fn logout() -> Result<()> {
    let client = reqwest::Client::new();
    client
        .post(format!("{SIDECAR_URL}/api/logout"))
        .send()
        .await
        .map_err(|_| AppError::WhatsApp("Could not reach the local WhatsApp service.".into()))?;
    Ok(())
}

/// Normalise an Indian phone number to digits-only international format.
/// 10-digit → "91" + digits
/// Leading "0" + 10 digits → "91" + digits
/// Already has "91" prefix → unchanged
fn normalise_phone(phone: &str) -> String {
    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.starts_with("91") && digits.len() == 12 {
        digits
    } else if digits.starts_with('0') && digits.len() == 11 {
        format!("91{}", &digits[1..])
    } else if digits.len() == 10 {
        format!("91{digits}")
    } else {
        digits
    }
}
