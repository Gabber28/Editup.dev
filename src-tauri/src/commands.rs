use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::proxy::{validate_target_origin, ProxyState, PROXY_PORT};

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub token: String,
    pub proxy_port: u16,
}

#[tauri::command]
pub fn get_session_token(state: State<'_, Arc<ProxyState>>) -> SessionInfo {
    SessionInfo {
        token: state.session_token.as_str().to_string(),
        proxy_port: PROXY_PORT,
    }
}

#[tauri::command]
pub async fn set_target_origin(
    origin: String,
    state: State<'_, Arc<ProxyState>>,
) -> Result<(), String> {
    validate_target_origin(&origin)?;
    state.set_target(origin).await
}

#[tauri::command]
pub async fn get_target_origin(
    state: State<'_, Arc<ProxyState>>,
) -> Result<Option<String>, String> {
    Ok(state.target_origin.read().await.clone())
}
