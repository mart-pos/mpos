use crate::discovery::{common::dedupe_resolved_printers, linux, macos, windows};
use crate::domain::printer::ResolvedPrinter;

pub struct DiscoveryService;

impl DiscoveryService {
    pub fn new() -> Self {
        Self
    }

    pub fn discover_printers(&self) -> Vec<ResolvedPrinter> {
        let printers = if cfg!(target_os = "macos") {
            macos::discover_printers()
        } else if cfg!(target_os = "windows") {
            windows::discover_printers()
        } else {
            linux::discover_printers()
        };

        dedupe_resolved_printers(printers)
    }
}
