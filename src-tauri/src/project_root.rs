//! Checks whether the folder the developer typed is really the source root of
//! the app answering at the target origin. A wrong root is not a harmless
//! mistake: git ops commit the wrong repo and the AI reads files that have
//! nothing to do with the page being edited, so the setup screen has to say so
//! instead of reporting a bare "connected".

use serde::Serialize;
use std::path::{Path, PathBuf};

mod evidence;
mod index_match;
use evidence::{
    attr_urls, detect_framework, framework_marker, is_source_like, resolve_candidates, Framework,
};
use index_match::{index_content_match, index_title_match};

/// How a candidate project root relates to the page served at the target origin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RootVerdict {
    /// The folder exists and the served page resolves into it.
    Ok,
    /// The path is missing, or is a file rather than a directory.
    NotFound,
    /// The folder exists but the page comes from a different project.
    Mismatch,
    /// The folder exists and the page gives no evidence either way.
    Unverified,
}

#[derive(Debug, Clone, Serialize)]
pub struct RootCheck {
    pub verdict: RootVerdict,
    /// User-facing sentence. Empty for `Ok` — the caller renders its own
    /// success wording.
    pub message: String,
}

impl RootCheck {
    fn new(verdict: RootVerdict, message: impl Into<String>) -> Self {
        Self {
            verdict,
            message: message.into(),
        }
    }
}

/// Strips the Windows verbatim prefix that `canonicalize` adds, so the string
/// compares cleanly against paths reported elsewhere.
fn canonical(path: &Path) -> PathBuf {
    match std::fs::canonicalize(path) {
        Ok(c) => {
            let s = c.to_string_lossy().to_string();
            PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s).to_string())
        }
        Err(_) => path.to_path_buf(),
    }
}

/// Decides the verdict from the page HTML alone — no network, no Tauri — so
/// every branch below is directly testable.
///
/// @param root existing directory to judge
/// @param origin target origin, only used to word the message
/// @param html page served at that origin, `None` when it could not be read
/// @returns the verdict plus the sentence explaining it
pub fn evaluate(root: &Path, origin: &str, html: Option<&str>) -> RootCheck {
    if !root.is_dir() {
        return RootCheck::new(
            RootVerdict::NotFound,
            format!("Folder not found: {}", root.display()),
        );
    }
    let root = canonical(root);

    let Some(html) = html else {
        return RootCheck::new(
            RootVerdict::Unverified,
            format!("Could not read the page at {origin} to confirm this folder."),
        );
    };

    if index_content_match(&root, html) {
        return RootCheck::new(RootVerdict::Ok, "");
    }

    let urls = attr_urls(html);
    let mut unmatched_source: Option<String> = None;
    for url in &urls {
        let matched = resolve_candidates(&root, url)
            .into_iter()
            .any(|c| c.is_file() && c.starts_with(&root));
        if matched {
            return RootCheck::new(RootVerdict::Ok, "");
        }
        if unmatched_source.is_none() && is_source_like(url) {
            unmatched_source = Some(url.clone());
        }
    }

    // Contrary evidence outranks the framework fingerprint below: a different
    // project of the same framework would otherwise pass as a match.
    if let Some(url) = unmatched_source {
        return RootCheck::new(
            RootVerdict::Mismatch,
            format!(
                "Not the root of the project at {origin} — it loads {url}, which does not exist in this folder."
            ),
        );
    }

    let fw = detect_framework(html);
    if fw != Framework::None {
        return if framework_marker(&root, fw) {
            RootCheck::new(RootVerdict::Ok, "")
        } else {
            RootCheck::new(
                RootVerdict::Mismatch,
                format!(
                    "Not the root of the project at {origin} — that page is served by {}, and this folder holds no {} project.",
                    fw.label(),
                    fw.label()
                ),
            )
        };
    }

    // Last and weakest: a shared <title>. Only reached when no path in the page
    // resolved either way, which is the norm for bundlers that serve their
    // output from memory.
    if index_title_match(&root, html) {
        return RootCheck::new(RootVerdict::Ok, "");
    }

    RootCheck::new(
        RootVerdict::Unverified,
        format!("Could not confirm this is the root of the project at {origin}."),
    )
}

/// Reads the target page so the root can be judged against what is actually
/// being served. Body is capped: this only needs the document head and the
/// asset references near it.
async fn fetch_html(origin: &str) -> Option<String> {
    const MAX_BYTES: usize = 512 * 1024;
    let resp = crate::proxy::upstream_client()
        .get(origin.trim_end_matches('/'))
        .timeout(std::time::Duration::from_secs(4))
        .send()
        .await
        .ok()?;
    let bytes = resp.bytes().await.ok()?;
    let end = bytes.len().min(MAX_BYTES);
    Some(String::from_utf8_lossy(&bytes[..end]).to_string())
}

/// Validates a candidate project root against the page running at `origin`.
///
/// @param path folder the developer typed in the setup screen
/// @param origin target origin already connected, when there is one
/// @returns verdict and message for the setup screen banner
#[tauri::command]
pub async fn validate_project_root(
    path: String,
    origin: Option<String>,
) -> Result<RootCheck, String> {
    let trimmed = path.trim().to_string();
    if trimmed.is_empty() {
        return Ok(RootCheck::new(
            RootVerdict::NotFound,
            "Enter a project root.",
        ));
    }
    let root = PathBuf::from(&trimmed);
    if !root.is_dir() {
        return Ok(RootCheck::new(
            RootVerdict::NotFound,
            format!("Folder not found: {trimmed}"),
        ));
    }
    let Some(origin) = origin else {
        return Ok(RootCheck::new(
            RootVerdict::Unverified,
            "No target origin connected — cannot confirm this folder.",
        ));
    };
    // The renderer supplies this origin, so re-check it here: this command is
    // the one place that would otherwise issue an outbound request to whatever
    // host it was handed.
    crate::proxy::validate_target_origin(&origin)?;
    let html = fetch_html(&origin).await;
    Ok(evaluate(&root, &origin, html.as_deref()))
}

#[cfg(test)]
mod tests;
