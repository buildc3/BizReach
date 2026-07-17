use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub host: String,
    pub port: u16,
    pub google_places_api_key: String,
    pub groq_api_key: String,
    pub groq_model: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: env::var("PORT").unwrap_or_else(|_| "3001".into()).parse().expect("PORT must be a number"),
            google_places_api_key: env::var("GOOGLE_PLACES_API_KEY").unwrap_or_default(),
            groq_api_key: env::var("GROQ_API_KEY").unwrap_or_default(),
            groq_model: env::var("GROQ_MODEL").unwrap_or_else(|_| "llama-3.3-70b-versatile".into()),
        }
    }
}
