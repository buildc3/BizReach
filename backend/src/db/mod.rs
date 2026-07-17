use sqlx::{postgres::PgPoolOptions, PgPool};
use tracing::info;

pub mod models;
pub mod repo;

pub async fn create_pool(database_url: &str) -> PgPool {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    info!("Connected to PostgreSQL");
    pool
}

pub async fn run_migrations(pool: &PgPool) {
    sqlx::migrate!("src/db/migrations")
        .run(pool)
        .await
        .expect("Failed to run migrations");

    info!("Migrations applied");
}
