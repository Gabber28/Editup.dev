use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

const ORIGIN: &str = "http://localhost:3000";

/// Scratch directory that cleans itself up, so each case judges a real folder
/// instead of a mocked filesystem.
struct TempRoot(PathBuf);

impl TempRoot {
    fn new() -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("editup-root-{}-{n}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("create temp root");
        Self(dir)
    }

    fn file(&self, rel: &str, contents: &str) -> &Self {
        let path = self.0.join(rel);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("create parent");
        }
        std::fs::write(path, contents).expect("write file");
        self
    }

    fn dir(&self, rel: &str) -> &Self {
        std::fs::create_dir_all(self.0.join(rel)).expect("create dir");
        self
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn missing_folder_is_not_found() {
    let missing = std::env::temp_dir().join("editup-does-not-exist-9d1f");
    let check = evaluate(&missing, ORIGIN, Some("<html></html>"));
    assert_eq!(check.verdict, RootVerdict::NotFound);
    assert!(check.message.contains("not found"), "{}", check.message);
}

#[test]
fn file_path_is_not_found() {
    let root = TempRoot::new();
    root.file("index.html", "<html></html>");
    let check = evaluate(
        &root.path().join("index.html"),
        ORIGIN,
        Some("<html></html>"),
    );
    assert_eq!(check.verdict, RootVerdict::NotFound);
}

#[test]
fn unreadable_page_is_unverified() {
    let root = TempRoot::new();
    let check = evaluate(root.path(), ORIGIN, None);
    assert_eq!(check.verdict, RootVerdict::Unverified);
}

#[test]
fn static_page_served_verbatim_matches_its_folder() {
    let html = "<html><head><title>Acme</title></head><body>hi</body></html>";
    let root = TempRoot::new();
    root.file("index.html", html);
    assert_eq!(
        evaluate(root.path(), ORIGIN, Some(html)).verdict,
        RootVerdict::Ok
    );
}

#[test]
fn resolved_source_asset_matches() {
    let html = r#"<html><head><script type="module" src="/src/main.tsx"></script></head></html>"#;
    let root = TempRoot::new();
    root.file("src/main.tsx", "export {};");
    assert_eq!(
        evaluate(root.path(), ORIGIN, Some(html)).verdict,
        RootVerdict::Ok
    );
}

#[test]
fn source_asset_absent_from_folder_is_mismatch() {
    let html = r#"<html><head><script type="module" src="/src/main.tsx"></script></head></html>"#;
    let root = TempRoot::new();
    root.file("src/other.tsx", "export {};");
    let check = evaluate(root.path(), ORIGIN, Some(html));
    assert_eq!(check.verdict, RootVerdict::Mismatch);
    assert!(check.message.contains("/src/main.tsx"), "{}", check.message);
}

#[test]
fn another_vite_project_does_not_pass_as_the_root() {
    // Contrary evidence must outrank the framework fingerprint, or any Vite
    // project on disk would validate against any Vite page.
    let html = r#"<html><head><script type="module" src="/@vite/client"></script>
      <script type="module" src="/src/main.tsx"></script></head></html>"#;
    let root = TempRoot::new();
    root.file("vite.config.ts", "export default {};");
    let check = evaluate(root.path(), ORIGIN, Some(html));
    assert_eq!(check.verdict, RootVerdict::Mismatch);
}

#[test]
fn vite_page_without_a_vite_project_is_mismatch() {
    let html = r#"<html><head><script type="module" src="/@vite/client"></script></head></html>"#;
    let root = TempRoot::new();
    root.file("readme.md", "not a project");
    let check = evaluate(root.path(), ORIGIN, Some(html));
    assert_eq!(check.verdict, RootVerdict::Mismatch);
    assert!(check.message.contains("Vite"), "{}", check.message);
}

#[test]
fn next_page_matches_a_next_project() {
    let html = r#"<html><head><script src="/_next/static/chunks/main.js"></script></head></html>"#;
    let root = TempRoot::new();
    root.file("next.config.js", "module.exports = {};");
    assert_eq!(
        evaluate(root.path(), ORIGIN, Some(html)).verdict,
        RootVerdict::Ok
    );
}

#[test]
fn bundled_output_missing_on_disk_is_not_contrary_evidence() {
    // webpack/CRA serve bundles from memory; their absence says nothing, so the
    // shared title is what decides.
    let html = r#"<html><head><title>React App</title>
      <script src="/static/js/bundle.js"></script></head></html>"#;
    let root = TempRoot::new();
    root.file(
        "public/index.html",
        "<html><head><title>React App</title></head></html>",
    );
    assert_eq!(
        evaluate(root.path(), ORIGIN, Some(html)).verdict,
        RootVerdict::Ok
    );
}

#[test]
fn unrelated_folder_stays_unverified_when_nothing_lines_up() {
    let html = r#"<html><head><title>Acme</title></head><body>hi</body></html>"#;
    let root = TempRoot::new();
    root.dir("src");
    let check = evaluate(root.path(), ORIGIN, Some(html));
    assert_eq!(check.verdict, RootVerdict::Unverified);
    assert!(check.message.contains(ORIGIN), "{}", check.message);
}

#[tokio::test]
async fn a_non_loopback_origin_is_refused_before_any_request() {
    let root = TempRoot::new();
    let result = validate_project_root(
        root.path().to_string_lossy().to_string(),
        Some("http://attacker.com".to_string()),
    )
    .await;
    assert!(result.is_err(), "external origin must not be fetched");
}

#[test]
fn editup_virtual_paths_are_ignored() {
    let urls = evidence::attr_urls(
        r#"<script src="/__editup__/agent.js"></script><script src="/src/app.tsx"></script>"#,
    );
    assert_eq!(urls, vec!["/src/app.tsx"]);
}

#[test]
fn query_strings_are_stripped_from_urls() {
    let urls = evidence::attr_urls(r#"<script src="/src/main.tsx?t=1712345"></script>"#);
    assert_eq!(urls, vec!["/src/main.tsx"]);
}
