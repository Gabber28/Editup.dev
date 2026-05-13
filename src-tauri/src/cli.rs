use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::process::Command;

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
    let timeout = Duration::from_millis(input.timeout_ms.max(1000));

    let child = Command::new(&input.cmd)
        .args(&input.args)
        .current_dir(&input.cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn '{}' failed: {e}", input.cmd))?;

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(output)) => Ok(SpawnCliResult {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
        }),
        Ok(Err(e)) => Err(format!("'{}' I/O error: {e}", input.cmd)),
        Err(_) => Err(format!(
            "'{}' timed out after {}ms",
            input.cmd, input.timeout_ms
        )),
    }
}

#[tauri::command]
pub async fn detect_cli(name: String) -> Result<bool, String> {
    let cmd = if cfg!(windows) { "where" } else { "which" };
    let timeout = Duration::from_secs(5);

    let child = Command::new(cmd)
        .arg(&name)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("detect '{name}' failed: {e}"))?;

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(output)) => Ok(output.status.success()),
        Ok(Err(e)) => Err(format!("detect '{name}' I/O error: {e}")),
        Err(_) => Ok(false),
    }
}
