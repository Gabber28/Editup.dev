use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub is_clean: bool,
    pub branch: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommitResult {
    pub hash: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub message: String,
    pub timestamp: String,
}

pub fn status(project_root: &str) -> Result<GitStatus, String> {
    let root = Path::new(project_root);
    if !root.is_dir() {
        return Err(format!("not a directory: {project_root}"));
    }

    let is_repo = Command::new("git")
        .args(["rev-parse", "--is-inside-work-tree"])
        .current_dir(root)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !is_repo {
        return Ok(GitStatus {
            is_repo: false,
            is_clean: false,
            branch: String::new(),
        });
    }

    let porcelain = run_git(root, &["status", "--porcelain"])?;
    let is_clean = porcelain.trim().is_empty();

    let branch = run_git(root, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_default()
        .trim()
        .to_string();

    Ok(GitStatus {
        is_repo: true,
        is_clean,
        branch,
    })
}

pub fn auto_commit(
    project_root: &str,
    message: &str,
    files: &[String],
) -> Result<GitCommitResult, String> {
    let root = Path::new(project_root);

    if files.is_empty() {
        run_git(root, &["add", "-A"])?;
    } else {
        let mut args = vec!["add", "--"];
        let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
        args.extend(file_refs);
        run_git(root, &args)?;
    }

    run_git(root, &["commit", "-m", message])?;

    let hash = run_git(root, &["rev-parse", "--short", "HEAD"])?
        .trim()
        .to_string();

    Ok(GitCommitResult {
        hash,
        message: message.to_string(),
    })
}

pub fn revert_last(project_root: &str) -> Result<String, String> {
    let root = Path::new(project_root);
    let hash = run_git(root, &["rev-parse", "--short", "HEAD"])?
        .trim()
        .to_string();
    run_git(root, &["revert", "--no-edit", "HEAD"])?;
    Ok(hash)
}

pub fn log_recent(
    project_root: &str,
    limit: usize,
) -> Result<Vec<GitLogEntry>, String> {
    let root = Path::new(project_root);
    let n = format!("-{limit}");
    let raw = run_git(
        root,
        &["log", &n, "--format=%H%n%s%n%aI", "--no-merges"],
    )?;

    let lines: Vec<&str> = raw.lines().collect();
    let mut entries = Vec::new();
    for chunk in lines.chunks(3) {
        if chunk.len() < 3 {
            break;
        }
        entries.push(GitLogEntry {
            hash: chunk[0].to_string(),
            message: chunk[1].to_string(),
            timestamp: chunk[2].to_string(),
        });
    }
    Ok(entries)
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git spawn failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} failed: {stderr}", args.join(" ")));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
