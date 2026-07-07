use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::process::Command;

fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

#[derive(Debug, Deserialize)]
pub struct SpawnCliInput {
    pub cmd: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub timeout_ms: u64,
}

/// Binaries the app is ever allowed to spawn. Defense-in-depth: the TS layer
/// (`spawn-safe.ts`) enforces the same rules, but the backend must not trust
/// the renderer.
const ALLOWED_COMMANDS: &[&str] = &["claude", "aider", "git", "where", "which"];

/// Flags that must never reach an AI CLI (mirrors `FORBIDDEN_FLAGS` in TS).
const FORBIDDEN_FLAGS: &[&str] = &[
    "--dangerously-skip-permissions",
    "--skip-permissions",
];

/// Tools that must never appear in an `--allowedTools` value.
const FORBIDDEN_TOOLS: &[&str] = &["Write", "Bash", "WebFetch"];

/// Validates a spawn request against the same invariants enforced in TS.
/// Returns an error string suitable for surfacing to the caller.
fn assert_spawn_safe(input: &SpawnCliInput) -> Result<(), String> {
    let base = std::path::Path::new(&input.cmd)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&input.cmd);
    if !ALLOWED_COMMANDS.contains(&base) {
        return Err(format!("command not allowed: {}", input.cmd));
    }

    for arg in &input.args {
        let flag = arg.split('=').next().unwrap_or(arg);
        if FORBIDDEN_FLAGS.iter().any(|f| flag == *f || arg.contains(*f)) {
            return Err(format!("forbidden flag detected: {arg}"));
        }
    }

    // If an --allowedTools value is present, ensure it contains no forbidden tool.
    let mut i = 0;
    while i < input.args.len() {
        let arg = &input.args[i];
        let flag = arg.split('=').next().unwrap_or(arg);
        if flag == "--allowedTools" || flag == "--allowed-tools" {
            let value = if let Some((_, v)) = arg.split_once('=') {
                v.to_string()
            } else {
                i += 1;
                input.args.get(i).cloned().unwrap_or_default()
            };
            for tool in value.split(',').map(|t| t.trim()).filter(|t| !t.is_empty()) {
                if FORBIDDEN_TOOLS.contains(&tool) {
                    return Err(format!("forbidden tool in allowedTools: {tool}"));
                }
            }
        }
        i += 1;
    }

    Ok(())
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
    assert_spawn_safe(&input)?;

    let start = Instant::now();
    let timeout = Duration::from_millis(input.timeout_ms.max(1000));

    let child = Command::new(&input.cmd)
        .args(&input.args)
        .current_dir(&input.cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn '{}' failed: {e}", input.cmd))?;

    let pid = child.id();

    match tokio::time::timeout(timeout, child.wait_with_output()).await {
        Ok(Ok(output)) => Ok(SpawnCliResult {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
        }),
        Ok(Err(e)) => Err(format!("'{}' I/O error: {e}", input.cmd)),
        Err(_) => {
            if let Some(pid) = pid {
                kill_process_tree(pid);
            }
            Err(format!(
                "'{}' timed out after {}ms",
                input.cmd, input.timeout_ms
            ))
        }
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
