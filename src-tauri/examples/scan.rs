//! Read-only check of the backend on this PC: installed apps (winget),
//! graphics cards, problem devices and Windows Update driver offers.
//! Nothing is installed or changed.
//!
//!   cargo run --example scan

use windfox_studio_lib::{drivers, winget};

fn main() {
    let started = std::time::Instant::now();

    match winget::installed_ids() {
        Ok(ids) => println!("winget: {} installed packages visible", ids.len()),
        Err(e) => println!("winget export failed: {e}"),
    }

    match drivers::gpu::gpus() {
        Ok(gpus) => {
            for gpu in gpus {
                println!(
                    "gpu: {} [{}] driver {} ({}) basic={} tool={}",
                    gpu.name,
                    gpu.vendor,
                    gpu.driver_version.as_deref().unwrap_or("?"),
                    gpu.driver_date.as_deref().unwrap_or("?"),
                    gpu.basic_driver,
                    gpu.tool.map(|t| t.name).unwrap_or_default(),
                );
            }
        }
        Err(e) => println!("gpu error: {e}"),
    }

    match drivers::devices::problem_devices() {
        Ok(devices) => {
            println!("problem devices: {}", devices.len());
            for d in devices {
                println!("  {} - {} (code {})", d.name, d.problem, d.error_code);
            }
        }
        Err(e) => println!("devices error: {e}"),
    }

    println!("searching Windows Update for drivers…");
    match drivers::wua::search() {
        Ok(updates) => {
            println!("windows update drivers offered: {}", updates.len());
            for u in updates {
                println!(
                    "  {} | {} | {} | {} | optional={}",
                    u.title,
                    u.driver_class,
                    u.provider,
                    u.date.as_deref().unwrap_or("?"),
                    u.optional
                );
            }
        }
        Err(e) => println!("windows update error: {e}"),
    }

    println!("done in {:.1?}", started.elapsed());
}
