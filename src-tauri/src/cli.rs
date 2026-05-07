use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Instant;

#[derive(Debug, Deserialize)]
pub struct SpawnCliInput {
    pub cmd: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize)]
pub struct SpawnCliResult {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

#[tauri::command]
pub async fn spawn_cli(input: SpawnCliInput) -> Result<SpawnCliResult, String> {
    let start = Instant::now();
    let output = Command::new(&input.cmd)
        .args(&input.args)
        .current_dir(&input.cwd)
        .output()
        .map_err(|e| format!("spawn '{}' failed: {e}", input.cmd))?;

    Ok(SpawnCliResult {
        exit_code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        duration_ms: start.elapsed().as_millis() as u64,
    })
}

#[tauri::command]
pub async fn detect_cli(name: String) -> Result<bool, String> {
    let cmd = if cfg!(windows) { "where" } else { "which" };
    let result = Command::new(cmd)
        .arg(&name)
        .output()
        .map_err(|e| format!("detect '{name}' failed: {e}"))?;
    Ok(result.status.success())
}
