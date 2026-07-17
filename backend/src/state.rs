use sqlx::PgPool;
use crate::config::Config;
use crate::services::send_queue::SendQueue;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub send_queue: SendQueue,
}
