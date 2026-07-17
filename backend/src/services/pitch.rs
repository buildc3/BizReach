//! AI-generated outreach pitches via the Groq API (free tier).
//!
//! Uses Groq's OpenAI-compatible endpoint — fast inference, no cost on free tier.
//! The API key loads from `Config` (env) and is sent as a Bearer token — never
//! hardcoded, never logged.

use crate::{config::Config, db::models::{Lead, Product, Search, SenderProfile}, error::{AppError, Result}};
use serde::{Deserialize, Serialize};
use serde_json::json;

const API_URL: &str = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT: &str = "You write friendly WhatsApp outreach messages for a local marketing \
agency. Personalize to the business using the details provided. Keep the main message under 80 words, \
warm and human, no marketing clichés, end with a soft question as a call to action. Then add a brief \
signature with the sender's name, company, and contact if provided. Output ONLY the message text — \
no preamble, no quotes, no subject line.";

#[derive(Debug, Deserialize)]
struct ChatResponse {
    #[serde(default)]
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Option<Message>,
}

#[derive(Debug, Deserialize)]
struct Message {
    #[serde(default)]
    content: String,
}

/// Generate a personalized outreach message for `lead`.
/// `product` scopes the offer; `instructions` adds extra tone/context.
pub async fn generate_pitch(
    config: &Config,
    lead: &Lead,
    search: &Search,
    product: Option<&Product>,
    instructions: Option<&str>,
    profile: Option<&SenderProfile>,
) -> Result<String> {
    if config.groq_api_key.is_empty() {
        return Err(AppError::Internal("GROQ_API_KEY is not configured".into()));
    }

    let mut details = format!(
        "Business name: {}\nCategory: {}\nArea: {}",
        lead.name, search.biz_type, search.area
    );
    if let Some(owner) = &lead.owner_name {
        details.push_str(&format!("\nOwner name: {owner}"));
    }
    if let Some(addr) = &lead.address {
        details.push_str(&format!("\nAddress: {addr}"));
    }
    if let Some(site) = &lead.website {
        details.push_str(&format!("\nWebsite: {site}"));
    }
    if let Some(p) = product {
        details.push_str(&format!("\n\nService we are offering: {}", p.name));
        if let Some(desc) = &p.description {
            details.push_str(&format!(" — {desc}"));
        }
    }
    if let Some(extra) = instructions.map(str::trim).filter(|s| !s.is_empty()) {
        details.push_str(&format!("\nExtra instructions: {extra}"));
    }
    if let Some(p) = profile {
        details.push_str("\n\nSender info (use for the signature at the end):");
        if let Some(n) = &p.your_name    { details.push_str(&format!("\nName: {n}")); }
        if let Some(c) = &p.company_name { details.push_str(&format!("\nCompany: {c}")); }
        if let Some(ph) = &p.phone       { details.push_str(&format!("\nPhone: {ph}")); }
        if let Some(w) = &p.website      { details.push_str(&format!("\nWebsite: {w}")); }
    }

    let body = json!({
        "model": config.groq_model,
        "temperature": 0.9,
        "max_tokens": 500,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": format!("Write an outreach message for this business:\n\n{details}") }
        ]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", config.groq_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Groq request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Groq API returned {status}: {detail}"
        )));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Groq response: {e}")))?;

    let text = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message)
        .map(|m| m.content)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err(AppError::Internal("Groq returned an empty message".into()));
    }

    Ok(text)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductFill {
    pub name: String,
    pub description: String,
    pub category: String,
}

/// Given a rough product description, ask the AI to rephrase it into
/// clean marketing-ready name, description, and category.
pub async fn fill_product(config: &Config, raw: &str) -> Result<ProductFill> {
    if config.groq_api_key.is_empty() {
        return Err(AppError::Internal("GROQ_API_KEY is not configured".into()));
    }

    let system = "You are a product copywriter for a local digital marketing agency. \
Given a rough description of a service they offer, output a JSON object with these exact keys:\n\
- name: short product name (2-5 words, title case)\n\
- description: one punchy sentence describing the product's value for small business owners (max 25 words)\n\
- category: exactly one of \"website\", \"menu\", or \"other\"\n\n\
Output ONLY valid JSON. No markdown, no explanation, no extra text.";

    let body = json!({
        "model": config.groq_model,
        "temperature": 0.4,
        "max_tokens": 200,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": format!("Service description: {raw}") }
        ]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", config.groq_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Groq request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Groq API returned {status}: {detail}")));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Groq response: {e}")))?;

    let raw_json = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message)
        .map(|m| m.content)
        .unwrap_or_default();

    // Strip possible markdown fences the model may add despite instructions
    let clean = raw_json.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();

    serde_json::from_str::<ProductFill>(clean)
        .map_err(|e| AppError::Internal(format!("AI returned invalid JSON: {e} — raw: {clean}")))
}

/// AI-generate a reusable WhatsApp outreach template for `product`.
/// The product's name and description are auto-injected as context, and the
/// model is told to use the placeholder tokens the renderer understands.
pub async fn generate_template(config: &Config, product: &Product, description: &str) -> Result<String> {
    if config.groq_api_key.is_empty() {
        return Err(AppError::Internal("GROQ_API_KEY is not configured".into()));
    }

    let system = "You write reusable WhatsApp outreach message templates for a local marketing \
agency. A template is sent to many businesses, so insert these placeholder tokens where personal \
details belong — they are filled in later: {business_name}, {owner_name}, {area}, {phone}, {website}. \
Always include {business_name} and at least one other placeholder. Keep it under 60 words, warm and \
human, no marketing clichés, and end with a soft question as a call to action. Output ONLY the \
template text — no preamble, no quotes, no subject line.";

    let mut context = format!("Product/service being offered: {}", product.name);
    if let Some(desc) = &product.description {
        context.push_str(&format!(" — {desc}"));
    }
    context.push_str(&format!("\n\nTemplate goal / tone from the user: {description}"));

    let body = json!({
        "model": config.groq_model,
        "temperature": 0.8,
        "max_tokens": 400,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": context }
        ]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(API_URL)
        .header("Authorization", format!("Bearer {}", config.groq_api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Groq request failed: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let detail = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!("Groq API returned {status}: {detail}")));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse Groq response: {e}")))?;

    let text = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message)
        .map(|m| m.content)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err(AppError::Internal("Groq returned an empty template".into()));
    }

    Ok(text)
}
