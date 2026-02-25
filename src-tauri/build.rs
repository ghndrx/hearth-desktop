fn main() {
    // Pass the target triple to the build
    println!(
        "cargo:rustc-env=TARGET={}",
        std::env::var("TARGET").unwrap_or_else(|_| "unknown".to_string())
    );
    
    tauri_build::build()
}
