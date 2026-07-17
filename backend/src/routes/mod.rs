use axum::{routing::{get, post, put}, Router};
use crate::{handlers::{groups, leads, messages, pitches, products, searches, settings, templates, whatsapp}, state::AppState};

pub fn app_router() -> Router<AppState> {
    Router::new()
        // Products
        .route("/api/v1/products", get(products::list_products).post(products::create_product))
        .route("/api/v1/products/fill", post(products::ai_fill_product))
        .route("/api/v1/products/:id", get(products::get_product).put(products::update_product).delete(products::delete_product))
        // Searches
        .route("/api/v1/searches", get(searches::list_searches).post(searches::create_search))
        .route("/api/v1/searches/:id", get(searches::get_search).delete(searches::delete_search))
        .route("/api/v1/searches/:id/run", post(searches::run_search))
        // Leads
        .route("/api/v1/leads", get(leads::list_leads))
        .route("/api/v1/leads/:id", get(leads::get_lead))
        .route("/api/v1/leads/:id/group", put(groups::move_lead))
        // Groups
        .route("/api/v1/groups", get(groups::list_groups).post(groups::create_group))
        .route("/api/v1/groups/:id", put(groups::rename_group).delete(groups::delete_group))
        .route("/api/v1/searches/:id/autogroup", post(groups::auto_group))
        // Templates
        .route("/api/v1/templates", get(templates::list_templates).post(templates::create_template))
        .route("/api/v1/templates/generate", post(templates::generate_template))
        .route("/api/v1/templates/:id", put(templates::update_template).delete(templates::delete_template))
        .route("/api/v1/templates/:template_id/render/:lead_id", get(templates::render_pitch))
        // AI pitch generation (single lead, returns text only)
        .route("/api/v1/pitches/generate", post(templates::generate_pitch))
        // Batch pitch generation + review lifecycle (stored as draft messages)
        .route("/api/v1/pitches", get(pitches::list_group_pitches))
        .route("/api/v1/pitches/generate-batch", post(pitches::generate_batch))
        .route("/api/v1/pitches/:id", put(pitches::update_pitch))
        .route("/api/v1/pitches/:id/review", post(pitches::review_pitch))
        .route("/api/v1/pitches/:id/reject", post(pitches::reject_pitch))
        .route("/api/v1/pitches/send-group", post(pitches::send_group))
        // Sender profile
        .route("/api/v1/settings/profile", get(settings::get_profile).put(settings::update_profile))
        // Messages
        .route("/api/v1/messages", get(messages::list_messages))
        .route("/api/v1/messages/send", post(messages::send_pitch))
        .route("/api/v1/messages/followups", get(messages::list_followups))
        // WhatsApp sidecar proxy
        .route("/api/v1/whatsapp/status", get(whatsapp::status))
        .route("/api/v1/whatsapp/logout", post(whatsapp::logout))
}
