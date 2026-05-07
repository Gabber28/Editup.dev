use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub body: Option<String>,
    pub current_version: String,
}

/// Checks the configured endpoint for a newer version.
/// Returns UpdateInfo with `available: false` if already up to date.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let current = app
        .config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".into());

    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: update.version.clone(),
            body: update.body.clone(),
            current_version: current,
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: String::new(),
            body: None,
            current_version: current,
        }),
        Err(e) => {
            tracing::warn!("update check failed: {e}");
            Ok(UpdateInfo {
                available: false,
                version: String::new(),
                body: None,
                current_version: current,
            })
        }
    }
}

/// Downloads and installs the pending update, then restarts.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;

    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    update
        .download_and_install(|_downloaded, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
}

/// Returns the current app version string.
#[tauri::command]
pub fn get_current_version(app: AppHandle) -> String {
    app.config()
        .version
        .clone()
        .unwrap_or_else(|| "0.0.0".into())
}
