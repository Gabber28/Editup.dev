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

/// Ensures a signing public key is configured. Without it, update signatures
/// cannot be verified and a compromised release host could push malicious
/// updates (RCE). Fail closed rather than install unsigned artifacts.
fn assert_pubkey_configured(app: &AppHandle) -> Result<(), String> {
    let pubkey = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|u| u.get("pubkey"))
        .and_then(|k| k.as_str())
        .unwrap_or("");
    if pubkey.trim().is_empty() {
        return Err(
            "updater public key is not configured; refusing to check or install updates".into(),
        );
    }
    Ok(())
}

/// Checks the configured endpoint for a newer version.
/// Returns UpdateInfo with `available: false` if already up to date.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateInfo, String> {
    assert_pubkey_configured(&app)?;
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
    assert_pubkey_configured(&app)?;
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
