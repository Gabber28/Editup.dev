//! Signals extracted from a served page and matched against a folder on disk.
//! Kept free of I/O beyond `is_file`/`read_to_string` so the verdict logic in
//! the parent module stays testable against real temp directories.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Framework {
    Vite,
    Next,
    None,
}

impl Framework {
    pub fn label(self) -> &'static str {
        match self {
            Framework::Vite => "Vite",
            Framework::Next => "Next.js",
            Framework::None => "unknown",
        }
    }
}

/// Fingerprints the dev server from markers it always injects.
pub fn detect_framework(html: &str) -> Framework {
    if html.contains("/@vite/client") {
        Framework::Vite
    } else if html.contains("/_next/static") {
        Framework::Next
    } else {
        Framework::None
    }
}

const VITE_CONFIGS: &[&str] = &[
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.mts",
    "vite.config.cjs",
];

const NEXT_CONFIGS: &[&str] = &[
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "next.config.cjs",
];

/// True when the folder holds the config (or build dir) that framework leaves
/// at the root of a project.
pub fn framework_marker(root: &Path, fw: Framework) -> bool {
    match fw {
        Framework::Vite => VITE_CONFIGS.iter().any(|f| root.join(f).is_file()),
        Framework::Next => {
            NEXT_CONFIGS.iter().any(|f| root.join(f).is_file()) || root.join(".next").is_dir()
        }
        Framework::None => false,
    }
}

/// Collects root-relative `src`/`href` values, deduped and capped — a page with
/// hundreds of assets proves nothing the first few do not.
pub fn attr_urls(html: &str) -> Vec<String> {
    const MAX_URLS: usize = 40;
    let mut out: Vec<String> = Vec::new();
    for attr in ["src=", "href="] {
        let mut rest = html;
        while let Some(idx) = rest.find(attr) {
            rest = &rest[idx + attr.len()..];
            let quote = match rest.as_bytes().first() {
                Some(b'"') => '"',
                Some(b'\'') => '\'',
                _ => continue,
            };
            let after = &rest[1..];
            let Some(end) = after.find(quote) else { break };
            let value = clean_url(&after[..end]);
            rest = &after[end..];
            if !value.starts_with('/') || value.starts_with("//") {
                continue;
            }
            if is_virtual(value) || out.iter().any(|u| u == value) {
                continue;
            }
            out.push(value.to_string());
            if out.len() >= MAX_URLS {
                return out;
            }
        }
    }
    out
}

/// Drops the cache-busting query and fragment dev servers append.
fn clean_url(value: &str) -> &str {
    let end = value.find(['?', '#']).unwrap_or(value.len());
    &value[..end]
}

/// Paths the dev server synthesises: they exist for the browser but never on
/// disk, so failing to resolve them says nothing about the root.
fn is_virtual(path: &str) -> bool {
    const VIRTUAL: &[&str] = &[
        "/@vite/",
        "/@react-refresh",
        "/@id/",
        "/__editup__/",
        "/node_modules/.vite/",
        "/_next/webpack-hmr",
        "/sockjs-node/",
        "/__nextjs",
    ];
    VIRTUAL.iter().any(|p| path.starts_with(p))
}

/// Where a served URL could live inside the project, most specific first.
pub fn resolve_candidates(root: &Path, url: &str) -> Vec<PathBuf> {
    if let Some(abs) = url.strip_prefix("/@fs/") {
        // Vite serves files outside its root under /@fs/<absolute path>; on
        // POSIX the leading slash is part of that path and was consumed above.
        let abs = if cfg!(windows) {
            abs.to_string()
        } else {
            format!("/{abs}")
        };
        return vec![PathBuf::from(abs)];
    }
    if let Some(rest) = url.strip_prefix("/_next/") {
        return vec![root.join(".next").join(rest)];
    }
    let rel = url.trim_start_matches('/');
    ["", "public", "src", "static", "app", "dist", "build", "out"]
        .iter()
        .map(|dir| {
            if dir.is_empty() {
                root.join(rel)
            } else {
                root.join(dir).join(rel)
            }
        })
        .collect()
}

/// True for URLs that must exist as authored source. Bundles under `/_next/`
/// or `/static/` are excluded: dev servers serve those from memory, so their
/// absence on disk is normal and would fake a mismatch.
pub fn is_source_like(url: &str) -> bool {
    if url.starts_with("/_next/")
        || url.starts_with("/static/")
        || url.starts_with("/node_modules/")
    {
        return false;
    }
    if url.starts_with("/src/") {
        return true;
    }
    let ext = url.rsplit('.').next().unwrap_or("");
    matches!(ext, "tsx" | "ts" | "jsx" | "vue" | "svelte")
}
