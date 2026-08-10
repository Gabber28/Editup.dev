//! Matches the served document against the HTML entry files a project keeps
//! on disk. This is the only evidence a static page or a memory-served bundle
//! offers — neither references a path that exists in the repository.

use std::path::Path;

const INDEX_CANDIDATES: &[&str] = &[
    "index.html",
    "public/index.html",
    "src/index.html",
    "app/index.html",
    "dist/index.html",
    "build/index.html",
    "out/index.html",
];

/// True when an HTML entry file in the folder *is* the document being served.
/// Conclusive, and the only signal a static page offers — it references no
/// source paths at all.
pub fn index_content_match(root: &Path, served: &str) -> bool {
    index_files(root).any(|content| content.trim() == served.trim())
}

/// True when an entry file merely shares the served `<title>`. Weak on its own
/// — every untouched CRA project answers "React App" — so the caller uses it
/// only after the path-based signals came back empty.
pub fn index_title_match(root: &Path, served: &str) -> bool {
    let Some(served_title) = title_of(served) else {
        return false;
    };
    index_files(root).any(|content| title_of(&content).is_some_and(|t| t == served_title))
}

fn index_files(root: &Path) -> impl Iterator<Item = String> + '_ {
    INDEX_CANDIDATES
        .iter()
        .filter_map(move |c| std::fs::read_to_string(root.join(c)).ok())
}

/// Extracts the document title, lowercased and trimmed. `None` when absent or
/// empty — two untitled pages are not evidence of anything.
fn title_of(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    let start = lower.find("<title")?;
    let open_end = lower[start..].find('>')? + start + 1;
    let close = lower[open_end..].find("</title>")? + open_end;
    let title = html[open_end..close].trim().to_lowercase();
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}
