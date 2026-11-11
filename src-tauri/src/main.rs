// Hide the console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--worker") {
        std::process::exit(windfox_studio_lib::worker::run(&args));
    }
    windfox_studio_lib::run();
}
