#![allow(dead_code)]

use crate::discovery::common::{DiscoveryBackend, MatchCandidate};

pub fn discover_printers() -> Vec<crate::domain::printer::ResolvedPrinter> {
    Vec::new()
}

pub fn describe() -> Vec<MatchCandidate> {
    vec![
        MatchCandidate {
            source: DiscoveryBackend::Usb,
            confidence: 91,
            reason: "libusb device metadata".into(),
        },
        MatchCandidate {
            source: DiscoveryBackend::Cups,
            confidence: 85,
            reason: "cups queue attributes".into(),
        },
    ]
}
