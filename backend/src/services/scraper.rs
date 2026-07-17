//! Business discovery via Google Places Text Search + Place Details.
//!
//! Flow: Text Search finds up to 20 businesses matching `biz_type` in `area`.
//! Place Details fills in phone and website for each result.
//! Email is best-effort scraped from the business website (no Places field).

use crate::{config::Config, db::repo::InsertLead, error::{AppError, Result}};
use serde::Deserialize;
use std::collections::HashSet;
use std::time::Duration;
use uuid::Uuid;

const USER_AGENT: &str = "lead-gen-app/0.1 (local outreach tool)";
const TEXT_SEARCH_URL: &str = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const DETAILS_URL: &str = "https://maps.googleapis.com/maps/api/place/details/json";

// ── API response shapes ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct TextSearchResponse {
    #[serde(default)]
    results: Vec<PlaceResult>,
    status: String,
    #[serde(default)]
    error_message: String,
}

#[derive(Debug, Deserialize)]
struct PlaceResult {
    place_id: String,
    name: String,
    formatted_address: Option<String>,
    geometry: Geometry,
}

#[derive(Debug, Deserialize)]
struct Geometry {
    location: LatLng,
}

#[derive(Debug, Deserialize)]
struct LatLng {
    lat: f64,
    lng: f64,
}

#[derive(Debug, Deserialize)]
struct DetailsResponse {
    result: Option<PlaceDetails>,
    status: String,
}

#[derive(Debug, Deserialize)]
struct PlaceDetails {
    formatted_phone_number: Option<String>,
    international_phone_number: Option<String>,
    website: Option<String>,
    url: Option<String>,
}

// ── Public API ────────────────────────────────────────────────────────────────

pub async fn search_businesses(
    config: &Config,
    search_id: Uuid,
    biz_type: &str,
    area: &str,
) -> Result<Vec<InsertLead>> {
    if config.google_places_api_key.is_empty() || config.google_places_api_key == "your_key_here" {
        return Err(AppError::Scraper("GOOGLE_PLACES_API_KEY is not configured".into()));
    }

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Scraper(e.to_string()))?;

    let query = format!("{} in {}", biz_type.trim(), area.trim());
    let places = text_search(&client, &query, &config.google_places_api_key).await?;

    let mut leads: Vec<InsertLead> = Vec::with_capacity(places.len());

    for place in places {
        let details = place_details(&client, &place.place_id, &config.google_places_api_key).await;

        let phone = details.as_ref().and_then(|d| {
            d.formatted_phone_number.clone()
                .or_else(|| d.international_phone_number.clone())
        });
        let website = details.as_ref().and_then(|d| d.website.clone());
        let maps_url = details.as_ref().and_then(|d| d.url.clone())
            .unwrap_or_else(|| format!(
                "https://www.google.com/maps/search/?api=1&query_place_id={}",
                place.place_id
            ));

        leads.push(InsertLead {
            search_id,
            name: place.name,
            owner_name: None,
            address: place.formatted_address,
            phone,
            email: None,
            website: website.clone(),
            maps_url: Some(maps_url),
            lat: Some(place.geometry.location.lat),
            lon: Some(place.geometry.location.lng),
            source: Some("google_places".into()),
        });
    }

    let mut leads = dedupe(leads);

    // Best-effort email scraping from business websites
    enrich_emails(&client, &mut leads).await;

    Ok(leads)
}

// ── Google Places helpers ─────────────────────────────────────────────────────

async fn text_search(
    client: &reqwest::Client,
    query: &str,
    api_key: &str,
) -> Result<Vec<PlaceResult>> {
    let resp: TextSearchResponse = client
        .get(TEXT_SEARCH_URL)
        .query(&[("query", query), ("key", api_key)])
        .send()
        .await
        .map_err(|e| AppError::Scraper(format!("Places text search request failed: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::Scraper(format!("Places text search parse failed: {e}")))?;

    if resp.status != "OK" && resp.status != "ZERO_RESULTS" {
        return Err(AppError::Scraper(format!(
            "Places API error: {} — {}",
            resp.status, resp.error_message
        )));
    }

    Ok(resp.results)
}

async fn place_details(
    client: &reqwest::Client,
    place_id: &str,
    api_key: &str,
) -> Option<PlaceDetails> {
    let fields = "formatted_phone_number,international_phone_number,website,url";
    let resp: DetailsResponse = client
        .get(DETAILS_URL)
        .query(&[("place_id", place_id), ("fields", fields), ("key", api_key)])
        .send()
        .await
        .ok()?
        .json()
        .await
        .ok()?;

    if resp.status != "OK" {
        return None;
    }
    resp.result
}

// ── Utilities ────────────────────────────────────────────────────────────────

fn dedupe(leads: Vec<InsertLead>) -> Vec<InsertLead> {
    let mut seen = HashSet::new();
    leads
        .into_iter()
        .filter(|l| {
            let key = l.phone.clone().unwrap_or_else(|| l.name.to_lowercase());
            seen.insert(key)
        })
        .collect()
}

async fn enrich_emails(client: &reqwest::Client, leads: &mut [InsertLead]) {
    for lead in leads.iter_mut() {
        if lead.email.is_some() {
            continue;
        }
        if let Some(site) = lead.website.clone() {
            lead.email = scrape_email(client, &site).await;
        }
    }
}

async fn scrape_email(client: &reqwest::Client, url: &str) -> Option<String> {
    let html = client
        .get(url)
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    let doc = scraper::Html::parse_document(&html);
    let selector = scraper::Selector::parse("a[href^=\"mailto:\"]").ok()?;
    let href = doc.select(&selector).next()?.value().attr("href")?;
    let email = href
        .trim_start_matches("mailto:")
        .split('?')
        .next()?
        .trim()
        .to_string();

    if email.contains('@') && !email.is_empty() {
        Some(email)
    } else {
        None
    }
}
