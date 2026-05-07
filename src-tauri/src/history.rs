use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub timestamp: String,
    pub project_root: String,
    pub element_tag: String,
    pub element_classes: Vec<String>,
    pub plan_summary: String,
    pub plan_files_count: usize,
    pub plan_confidence: String,
    pub side_effects_count: usize,
    pub user_approved: bool,
    pub approval_mode: String,
    pub ai_adapter_used: String,
    pub files_modified: Vec<String>,
    pub duration_ms: u64,
    pub verification_visual: String,
    pub verification_scope: String,
    pub verification_diff: String,
    pub correction_attempts: u32,
    pub git_commit: Option<String>,
    pub status: String,
}

/// Returns the path to `~/.editup/history/`.
fn history_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    Ok(home.join(".editup").join("history"))
}

/// Creates `~/.editup/history/` if it does not exist.
fn ensure_history_dir() -> Result<PathBuf, String> {
    let dir = history_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("create history dir failed: {e}"))?;
    }
    Ok(dir)
}

/// Writes a single history entry as a JSON file under `~/.editup/history/`.
#[tauri::command]
pub async fn write_history_entry(entry: HistoryEntry) -> Result<(), String> {
    let dir = ensure_history_dir()?;
    let ts = if entry.timestamp.is_empty() {
        Utc::now().to_rfc3339()
    } else {
        entry.timestamp.clone()
    };
    let safe_name = ts.replace(':', "-");
    let path = dir.join(format!("{safe_name}.json"));
    let json = serde_json::to_string_pretty(&entry)
        .map_err(|e| format!("serialize history: {e}"))?;
    fs::write(path, json)
        .map_err(|e| format!("write history entry: {e}"))?;
    Ok(())
}

/// Reads history entries from `~/.editup/history/`, newest first.
#[tauri::command]
pub async fn read_history(
    limit: Option<usize>,
) -> Result<Vec<HistoryEntry>, String> {
    let dir = history_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut files: Vec<PathBuf> = fs::read_dir(&dir)
        .map_err(|e| format!("read history dir: {e}"))?
        .filter_map(|r| r.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .map(|ext| ext == "json")
                .unwrap_or(false)
        })
        .collect();

    files.sort_by(|a, b| b.cmp(a));

    let cap = limit.unwrap_or(50);
    let mut entries = Vec::with_capacity(cap);
    for path in files.into_iter().take(cap) {
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("read entry: {e}"))?;
        let entry: HistoryEntry = serde_json::from_str(&raw)
            .map_err(|e| format!("parse entry: {e}"))?;
        entries.push(entry);
    }
    Ok(entries)
}
