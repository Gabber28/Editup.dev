use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use crate::git;
use crate::license;
use crate::proxy::{validate_target_origin, ProxyState, PROXY_PORT};
use crate::rate_limit;
use crate::ws::{WsState, WS_PORT};

#[derive(Debug, Serialize)]
pub struct SessionInfo {
    pub token: String,
    pub proxy_port: u16,
    pub ws_port: u16,
}

#[tauri::command]
pub fn get_session_token(state: State<'_, Arc<ProxyState>>) -> SessionInfo {
    SessionInfo {
        token: state.session_token.as_str().to_string(),
        proxy_port: PROXY_PORT,
        ws_port: WS_PORT,
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

#[tauri::command]
pub async fn set_project_root(
    path: String,
    state: State<'_, Arc<ProxyState>>,
) -> Result<(), String> {
    state.set_project_root(path).await
}

#[tauri::command]
pub async fn get_project_root(
    state: State<'_, Arc<ProxyState>>,
) -> Result<Option<String>, String> {
    Ok(state.project_root.read().await.clone())
}

#[tauri::command]
pub async fn get_agent_status(state: State<'_, Arc<WsState>>) -> Result<bool, String> {
    Ok(*state.connected.read().await)
}

#[tauri::command]
pub async fn start_editing(state: State<'_, Arc<WsState>>) -> Result<(), String> {
    let msg = serde_json::json!({
        "type": "set_editing",
        "payload": { "editing": true }
    });
    state
        .to_agent_tx
        .send(msg.to_string())
        .map_err(|_| "no agent connected".to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn stop_editing(state: State<'_, Arc<WsState>>) -> Result<(), String> {
    let msg = serde_json::json!({
        "type": "set_editing",
        "payload": { "editing": false }
    });
    state
        .to_agent_tx
        .send(msg.to_string())
        .map_err(|_| "no agent connected".to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn preview_style(
    property: String,
    value: String,
    state: State<'_, Arc<WsState>>,
) -> Result<(), String> {
    let msg = serde_json::json!({
        "type": "preview_style",
        "payload": { "property": property, "value": value }
    });
    state
        .to_agent_tx
        .send(msg.to_string())
        .map_err(|_| "no agent connected".to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reset_overrides(state: State<'_, Arc<WsState>>) -> Result<(), String> {
    let msg = serde_json::json!({ "type": "reset_overrides" });
    state
        .to_agent_tx
        .send(msg.to_string())
        .map_err(|_| "no agent connected".to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn request_snapshot(state: State<'_, Arc<WsState>>) -> Result<(), String> {
    let msg = serde_json::json!({ "type": "request_snapshot" });
    state
        .to_agent_tx
        .send(msg.to_string())
        .map_err(|_| "no agent connected".to_string())?;
    Ok(())
}

// --- Git commands ---

#[tauri::command]
pub async fn git_status(
    state: State<'_, Arc<ProxyState>>,
) -> Result<git::GitStatus, String> {
    let root = state.require_project_root().await?;
    git::status(&root)
}

#[tauri::command]
pub async fn git_auto_commit(
    message: String,
    files: Vec<String>,
    state: State<'_, Arc<ProxyState>>,
) -> Result<git::GitCommitResult, String> {
    let root = state.require_project_root().await?;
    git::auto_commit(&root, &message, &files)
}

#[tauri::command]
pub async fn git_revert(
    state: State<'_, Arc<ProxyState>>,
) -> Result<String, String> {
    let root = state.require_project_root().await?;
    git::revert_last(&root)
}

#[tauri::command]
pub async fn git_log(
    limit: Option<usize>,
    state: State<'_, Arc<ProxyState>>,
) -> Result<Vec<git::GitLogEntry>, String> {
    let root = state.require_project_root().await?;
    git::log_recent(&root, limit.unwrap_or(10))
}

// --- License commands ---

#[tauri::command]
pub async fn save_license_key(
    key: String,
) -> Result<license::LicenseStatus, String> {
    license::save_key(&key).await
}

#[tauri::command]
pub async fn check_license() -> Result<license::LicenseStatus, String> {
    license::check_and_reverify().await
}

#[tauri::command]
pub fn get_license_status() -> Result<license::LicenseStatus, String> {
    license::load_status()
}

#[tauri::command]
pub fn increment_edit_count() -> Result<rate_limit::RateLimitState, String> {
    rate_limit::increment()
}

#[tauri::command]
pub fn get_rate_limit_state() -> Result<rate_limit::RateLimitState, String> {
    rate_limit::get_state()
}

