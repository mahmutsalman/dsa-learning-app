fn main() {
    // Add microphone usage description for macOS
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-env=MACOSX_DEPLOYMENT_TARGET=10.13");
    }
    
    tauri_build::build()
}