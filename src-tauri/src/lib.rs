pub mod cli;
pub mod commands;
pub mod git;
pub mod history;
pub mod license;
pub mod proxy;
pub mod rate_limit;
pub mod security;
pub mod updater;
pub mod ws;

use std::sync::Arc;

use tauri::{Emitter, Manager};
use tokio::sync::mpsc;

use crate::proxy::ProxyState;
use crate::ws::WsState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "editup=info,tower_http=warn".into()),
        )
        .init();

    let proxy_state: Arc<ProxyState> = ProxyState::new();
    let (from_agent_tx, from_agent_rx) = mpsc::channel(64);
    let ws_state = Arc::new(WsState::new(
        from_agent_tx,
        proxy_state.session_token.clone(),
    ));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(proxy_state.clone())
        .manage(ws_state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();

            let ps = proxy_state;
            let h1 = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = proxy::start_proxy(ps, h1).await {
                    tracing::error!("proxy failed: {err}");
                }
            });

            let ws = ws_state;
            tauri::async_runtime::spawn(async move {
                if let Err(err) = ws::start_ws_server(ws).await {
                    tracing::error!("ws server failed: {err}");
                }
            });

            spawn_event_forwarder(from_agent_rx, handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_session_token,
            commands::set_target_origin,
            commands::get_target_origin,
            commands::set_project_root,
            commands::get_project_root,
            commands::get_agent_status,
            commands::start_editing,
            commands::stop_editing,
            commands::preview_style,
            commands::reset_overrides,
            commands::request_snapshot,
            commands::git_status,
            commands::git_auto_commit,
            commands::git_revert,
            commands::git_log,
            commands::save_license_key,
            commands::check_license,
            commands::get_license_status,
            commands::increment_edit_count,
            commands::get_rate_limit_state,
            cli::spawn_cli,
            cli::detect_cli,
            history::write_history_entry,
            history::read_history,
            updater::check_for_update,
            updater::install_update,
            updater::get_current_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn spawn_event_forwarder(
    mut rx: mpsc::Receiver<ws::AgentMessage>,
    handle: tauri::AppHandle,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let event = format!("agent_{}", msg.msg_type);
            if let Err(err) = handle.emit(&event, &msg.payload) {
                tracing::debug!("event emit failed: {err}");
            }
        }
    });
}
