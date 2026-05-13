fn main() {
    println!("cargo:rerun-if-changed=../injected/dist/agent.js");
    #[cfg(target_os = "windows")]
    {
        let icon_src = std::path::Path::new("icons/icon.ico");
        if icon_src.exists() {
            let temp_icon = std::env::temp_dir().join("editup-build-icon.ico");
            std::fs::copy(icon_src, &temp_icon).expect("copy icon to temp");
            let attrs = tauri_build::Attributes::new().windows_attributes(
                tauri_build::WindowsAttributes::new().window_icon_path(&temp_icon),
            );
            tauri_build::try_build(attrs).expect("tauri build");
            return;
        }
    }
    tauri_build::build();
}
