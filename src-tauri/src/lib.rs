pub mod commands;
pub mod proxy;
pub mod security;
pub mod ws;

use std::sync::Arc;

use tauri::Manager;

use crate::proxy::ProxyState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "editup=info,tower_http=warn".into()),
        )
        .init();

    let state: Arc<ProxyState> = ProxyState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            let proxy_state = state.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(err) = proxy::start_proxy(proxy_state, handle).await {
                    tracing::error!("proxy failed: {err}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_session_token,
            commands::set_target_origin,
            commands::get_target_origin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
