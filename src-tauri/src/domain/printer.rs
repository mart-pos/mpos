#![allow(dead_code)]

use crate::discovery::common::MatchCandidate;

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PrinterKind {
    Thermal,
    Inkjet,
    Laser,
    Label,
    Unknown,
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaperWidthMm {
    Mm58,
    Mm80,
    Unknown,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionType {
    Usb,
    Network,
    Bluetooth,
    System,
    Unknown,
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolvedPrinterStatus {
    Online,
    Offline,
    Unknown,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterCapabilities {
    pub supports_cut: bool,
    pub supports_cash_drawer: bool,
    pub supports_qr: bool,
    pub supports_barcode: bool,
    pub raw_support: bool,
    pub encoding: String,
}

impl PrinterCapabilities {
    pub fn receipt() -> Self {
        Self {
            supports_cut: true,
            supports_cash_drawer: true,
            supports_qr: true,
            supports_barcode: true,
            raw_support: true,
            encoding: "cp437".into(),
        }
    }

    pub fn label() -> Self {
        Self {
            supports_cut: false,
            supports_cash_drawer: false,
            supports_qr: false,
            supports_barcode: true,
            raw_support: false,
            encoding: "utf-8".into(),
        }
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterProfile {
    pub paper_width_mm: PaperWidthMm,
    pub chars_per_line_normal: u16,
    pub chars_per_line_compressed: u16,
    pub supports_cut: bool,
    pub supports_cash_drawer: bool,
    pub supports_qr: bool,
    pub supports_barcode: bool,
    pub encoding: String,
    pub raw_support: bool,
    pub raw_device_path: Option<String>,
}

impl PrinterProfile {
    pub fn from_capabilities(width: PaperWidthMm, capabilities: &PrinterCapabilities) -> Self {
        let (normal, compressed) = match width {
            PaperWidthMm::Mm58 => (32, 42),
            PaperWidthMm::Mm80 => (48, 64),
            PaperWidthMm::Unknown => (42, 56),
        };

        Self {
            paper_width_mm: width,
            chars_per_line_normal: normal,
            chars_per_line_compressed: compressed,
            supports_cut: capabilities.supports_cut,
            supports_cash_drawer: capabilities.supports_cash_drawer,
            supports_qr: capabilities.supports_qr,
            supports_barcode: capabilities.supports_barcode,
            encoding: capabilities.encoding.clone(),
            raw_support: capabilities.raw_support,
            raw_device_path: None,
        }
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PrinterOverride {
    pub kind: Option<PrinterKind>,
    pub receipt_capable: Option<bool>,
    pub paper_width_mm: Option<PaperWidthMm>,
    pub chars_per_line_normal: Option<u16>,
    pub chars_per_line_compressed: Option<u16>,
    pub supports_cut: Option<bool>,
    pub supports_cash_drawer: Option<bool>,
    pub supports_qr: Option<bool>,
    pub supports_barcode: Option<bool>,
    pub encoding: Option<String>,
    pub raw_support: Option<bool>,
    pub raw_device_path: Option<String>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterDevice {
    pub vendor_id: Option<String>,
    pub product_id: Option<String>,
    pub manufacturer: Option<String>,
    pub product_string: Option<String>,
    pub serial_number: Option<String>,
    pub connection_type: ConnectionType,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemPrinter {
    pub system_name: String,
    pub system_backend: String,
    pub system_queue: String,
    pub is_default: bool,
    pub status: ResolvedPrinterStatus,
    pub driver: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPrinter {
    pub id: String,
    pub name: String,
    pub system_name: Option<String>,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub vendor_id: Option<String>,
    pub product_id: Option<String>,
    pub serial_number: Option<String>,
    pub connection_type: ConnectionType,
    pub system_backend: Option<String>,
    pub system_queue: Option<String>,
    pub is_system_printer: bool,
    pub is_usb_device: bool,
    pub is_default: bool,
    #[serde(rename = "type")]
    pub kind: PrinterKind,
    pub receipt_capable: bool,
    pub paper_width_mm: PaperWidthMm,
    pub status: ResolvedPrinterStatus,
    pub driver: String,
    pub last_seen_at: String,
    pub capabilities: PrinterCapabilities,
    pub profile: PrinterProfile,
    pub manual_override: PrinterOverride,
    pub match_reasons: Vec<MatchCandidate>,
}
