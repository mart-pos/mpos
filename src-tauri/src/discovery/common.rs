#![allow(dead_code)]

use crate::domain::printer::{
    ConnectionType, PaperWidthMm, PrinterCapabilities, PrinterKind, PrinterOverride,
    PrinterProfile, ResolvedPrinter, ResolvedPrinterStatus,
};

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscoveryBackend {
    Usb,
    Cups,
    Spooler,
    Unknown,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchCandidate {
    pub source: DiscoveryBackend,
    pub confidence: u8,
    pub reason: String,
}

pub fn normalize(value: &str) -> String {
    value.to_lowercase().replace(['_', '-', '/', '\\'], " ")
}

pub fn slug(value: &str) -> String {
    normalize(value)
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '_'
            }
        })
        .collect()
}

pub fn infer_manufacturer(name: &str) -> Option<String> {
    let normalized = normalize(name);

    for brand in [
        "epson", "brother", "zebra", "star", "bixolon", "xprinter", "rongta", "gainscha",
    ] {
        if normalized.contains(brand) {
            return Some(brand.to_uppercase());
        }
    }

    None
}

pub fn infer_model(name: &str) -> Option<String> {
    name.split_whitespace()
        .find(|token| token.chars().any(|character| character.is_ascii_digit()))
        .map(ToString::to_string)
}

pub fn looks_like_printer(name: &str, manufacturer: Option<&str>) -> bool {
    let haystack = normalize(&format!("{name} {}", manufacturer.unwrap_or_default()));
    haystack.contains("printer")
        || haystack.contains("receipt")
        || haystack.contains("epson")
        || haystack.contains("star")
        || haystack.contains("bixolon")
        || haystack.contains("zebra")
        || haystack.contains("brother")
        || haystack.contains("xprinter")
        || haystack.contains("rongta")
        || haystack.contains("gainscha")
        || haystack.contains("pos")
        || haystack.contains("tm-")
}

pub fn classify_printer(name: &str, manufacturer: Option<&str>, hint: Option<&str>) -> PrinterKind {
    let haystack = normalize(&format!(
        "{} {} {}",
        name,
        manufacturer.unwrap_or_default(),
        hint.unwrap_or_default()
    ));

    if haystack.contains("label") || haystack.contains("brother ql") || haystack.contains("zebra")
    {
        PrinterKind::Label
    } else if haystack.contains("tm-")
        || haystack.contains("thermal")
        || haystack.contains("receipt")
        || haystack.contains("pos")
        || haystack.contains("xprinter")
        || haystack.contains("star")
        || haystack.contains("bixolon")
        || haystack.contains("rongta")
    {
        PrinterKind::Thermal
    } else if haystack.contains("laser") {
        PrinterKind::Laser
    } else if haystack.contains("inkjet") {
        PrinterKind::Inkjet
    } else {
        PrinterKind::Unknown
    }
}

pub fn is_receipt_capable(name: &str, printer_kind: PrinterKind) -> bool {
    printer_kind == PrinterKind::Thermal
        || normalize(name).contains("receipt")
        || normalize(name).contains("pos")
        || normalize(name).contains("tm-")
}

pub fn infer_paper_width(name: &str, printer_kind: PrinterKind) -> PaperWidthMm {
    let normalized = normalize(name);

    if normalized.contains("58") {
        PaperWidthMm::Mm58
    } else if normalized.contains("80") || printer_kind == PrinterKind::Thermal {
        PaperWidthMm::Mm80
    } else {
        PaperWidthMm::Unknown
    }
}

pub fn capabilities_for_printer(kind: PrinterKind, receipt_capable: bool) -> PrinterCapabilities {
    if kind == PrinterKind::Label {
        PrinterCapabilities::label()
    } else if receipt_capable {
        PrinterCapabilities::receipt()
    } else {
        PrinterCapabilities {
            supports_cut: false,
            supports_cash_drawer: false,
            supports_qr: false,
            supports_barcode: true,
            raw_support: false,
            encoding: "utf-8".into(),
        }
    }
}

pub fn iso_timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    format!("unix:{seconds}")
}

pub fn dedupe_resolved_printers(printers: Vec<ResolvedPrinter>) -> Vec<ResolvedPrinter> {
    let mut deduped: Vec<ResolvedPrinter> = Vec::new();

    for candidate in printers {
        if let Some(index) = deduped
            .iter()
            .position(|existing| same_resolved_printer(existing, &candidate))
        {
            let merged = merge_resolved_printer(deduped[index].clone(), candidate);
            deduped[index] = merged;
        } else {
            deduped.push(candidate);
        }
    }

    deduped.sort_by(|left, right| {
        right
            .is_default
            .cmp(&left.is_default)
            .then_with(|| status_rank(right.status).cmp(&status_rank(left.status)))
            .then_with(|| richness_score(right).cmp(&richness_score(left)))
            .then_with(|| left.name.cmp(&right.name))
    });

    deduped
}

fn same_resolved_printer(left: &ResolvedPrinter, right: &ResolvedPrinter) -> bool {
    if left.id == right.id {
        return true;
    }

    if same_optional(&left.serial_number, &right.serial_number) {
        return true;
    }

    if same_optional(&left.vendor_id, &right.vendor_id)
        && same_optional(&left.product_id, &right.product_id)
        && names_are_similar(&left.name, &right.name)
    {
        return true;
    }

    let left_name = normalize(&left.name);
    let right_name = normalize(&right.name);
    let left_system = left.system_name.as_deref().map(normalize);
    let right_system = right.system_name.as_deref().map(normalize);

    (left_name == right_name
        || left_system.as_deref() == Some(&right_name)
        || right_system.as_deref() == Some(&left_name))
        && manufacturer_matches(left.manufacturer.as_deref(), right.manufacturer.as_deref())
        || same_device_family_with_invalid_system_queue(left, right)
}

fn merge_resolved_printer(primary: ResolvedPrinter, secondary: ResolvedPrinter) -> ResolvedPrinter {
    let prefer_secondary = printer_preference_score(&secondary) > printer_preference_score(&primary);
    let base = if prefer_secondary {
        secondary.clone()
    } else {
        primary.clone()
    };
    let other = if prefer_secondary { primary } else { secondary };

    let is_system_usable = base.is_system_printer
        && base.status == ResolvedPrinterStatus::Online
        && !is_invalid_queue(base.system_queue.as_deref(), base.match_reasons.as_slice());

    let merged_capabilities = PrinterCapabilities {
        supports_cut: base.capabilities.supports_cut || other.capabilities.supports_cut,
        supports_cash_drawer: base.capabilities.supports_cash_drawer
            || other.capabilities.supports_cash_drawer,
        supports_qr: base.capabilities.supports_qr || other.capabilities.supports_qr,
        supports_barcode: base.capabilities.supports_barcode || other.capabilities.supports_barcode,
        raw_support: base.capabilities.raw_support || other.capabilities.raw_support,
        encoding: choose_string(
            Some(base.capabilities.encoding.clone()),
            Some(other.capabilities.encoding.clone()),
        )
        .unwrap_or_else(|| "utf-8".into()),
    };

    let paper_width_mm = choose_paper_width(base.paper_width_mm, other.paper_width_mm);
    let mut profile = if profile_richness_score(&base.profile) >= profile_richness_score(&other.profile)
    {
        base.profile.clone()
    } else {
        other.profile.clone()
    };
    profile.paper_width_mm = choose_paper_width(profile.paper_width_mm, paper_width_mm);
    profile.supports_cut = merged_capabilities.supports_cut;
    profile.supports_cash_drawer = merged_capabilities.supports_cash_drawer;
    profile.supports_qr = merged_capabilities.supports_qr;
    profile.supports_barcode = merged_capabilities.supports_barcode;
    profile.raw_support = merged_capabilities.raw_support;
    profile.encoding = merged_capabilities.encoding.clone();
    profile.raw_device_path =
        choose_string(profile.raw_device_path.clone(), other.profile.raw_device_path.clone());

    let other_reasons = other.match_reasons.clone();
    let mut reasons = base.match_reasons.clone();
    for reason in &other_reasons {
        if !reasons
            .iter()
            .any(|existing| existing.source as u8 == reason.source as u8 && existing.reason == reason.reason)
        {
            reasons.push(reason.clone());
        }
    }

    let driver = if merged_capabilities.raw_support && (base.is_usb_device || other.is_usb_device) {
        "escpos_usb".into()
    } else if is_system_usable && (base.receipt_capable || other.receipt_capable) {
        "escpos_system".into()
    } else if is_system_usable {
        "system_print".into()
    } else {
        base.driver.clone()
    };

    ResolvedPrinter {
        id: base.id.clone(),
        name: choose_string(Some(base.name.clone()), Some(other.name.clone()))
            .unwrap_or_else(|| base.name.clone()),
        system_name: choose_string(base.system_name.clone(), other.system_name.clone()),
        model: choose_string(base.model.clone(), other.model.clone()),
        manufacturer: choose_string(base.manufacturer.clone(), other.manufacturer.clone()),
        vendor_id: choose_string(base.vendor_id.clone(), other.vendor_id.clone()),
        product_id: choose_string(base.product_id.clone(), other.product_id.clone()),
        serial_number: choose_string(base.serial_number.clone(), other.serial_number.clone()),
        connection_type: choose_connection_type(base.connection_type.clone(), other.connection_type),
        system_backend: choose_string(base.system_backend.clone(), other.system_backend.clone()),
        system_queue: choose_system_queue(
            base.system_queue.clone(),
            other.system_queue.clone(),
            base.match_reasons.as_slice(),
            other_reasons.as_slice(),
        ),
        is_system_printer: base.is_system_printer || other.is_system_printer,
        is_usb_device: base.is_usb_device || other.is_usb_device,
        is_default: base.is_default || other.is_default,
        kind: choose_kind(base.kind, other.kind),
        receipt_capable: base.receipt_capable || other.receipt_capable,
        paper_width_mm,
        status: choose_status(base.status, other.status),
        driver,
        last_seen_at: choose_string(Some(base.last_seen_at), Some(other.last_seen_at))
            .unwrap_or_else(iso_timestamp_now),
        capabilities: merged_capabilities,
        profile,
        manual_override: PrinterOverride::default(),
        match_reasons: reasons,
    }
}

fn choose_string(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(a), Some(b)) => {
            if richness_of_string(&b) > richness_of_string(&a) {
                Some(b)
            } else {
                Some(a)
            }
        }
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

fn choose_connection_type(left: ConnectionType, right: ConnectionType) -> ConnectionType {
    match (left, right) {
        (ConnectionType::Usb, _) | (_, ConnectionType::Usb) => ConnectionType::Usb,
        (ConnectionType::Network, _) | (_, ConnectionType::Network) => ConnectionType::Network,
        (ConnectionType::Bluetooth, _) | (_, ConnectionType::Bluetooth) => {
            ConnectionType::Bluetooth
        }
        (ConnectionType::System, _) | (_, ConnectionType::System) => ConnectionType::System,
        _ => ConnectionType::Unknown,
    }
}

fn choose_kind(left: PrinterKind, right: PrinterKind) -> PrinterKind {
    if left != PrinterKind::Unknown {
        left
    } else {
        right
    }
}

fn choose_paper_width(left: PaperWidthMm, right: PaperWidthMm) -> PaperWidthMm {
    match (left, right) {
        (PaperWidthMm::Mm58, _) | (_, PaperWidthMm::Mm58) if left != PaperWidthMm::Unknown => left,
        (_, PaperWidthMm::Mm58) => right,
        (PaperWidthMm::Mm80, _) | (_, PaperWidthMm::Mm80) if left != PaperWidthMm::Unknown => left,
        (_, PaperWidthMm::Mm80) => right,
        _ => PaperWidthMm::Unknown,
    }
}

fn choose_status(left: ResolvedPrinterStatus, right: ResolvedPrinterStatus) -> ResolvedPrinterStatus {
    if status_rank(left) >= status_rank(right) {
        left
    } else {
        right
    }
}

fn choose_system_queue(
    left: Option<String>,
    right: Option<String>,
    left_reasons: &[MatchCandidate],
    right_reasons: &[MatchCandidate],
) -> Option<String> {
    match (left, right) {
        (Some(a), Some(b)) => {
            if is_invalid_queue(Some(&a), left_reasons) && !is_invalid_queue(Some(&b), right_reasons)
            {
                Some(b)
            } else {
                Some(a)
            }
        }
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

fn same_optional(left: &Option<String>, right: &Option<String>) -> bool {
    match (left.as_deref(), right.as_deref()) {
        (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
        _ => false,
    }
}

fn names_are_similar(left: &str, right: &str) -> bool {
    let left = normalize(left);
    let right = normalize(right);
    left == right || left.contains(&right) || right.contains(&left)
}

fn manufacturer_matches(left: Option<&str>, right: Option<&str>) -> bool {
    match (left, right) {
        (Some(a), Some(b)) => normalize(a) == normalize(b),
        _ => true,
    }
}

fn same_device_family_with_invalid_system_queue(
    left: &ResolvedPrinter,
    right: &ResolvedPrinter,
) -> bool {
    let left_invalid_system =
        left.is_system_printer && is_invalid_queue(left.system_queue.as_deref(), left.match_reasons.as_slice());
    let right_invalid_system =
        right.is_system_printer && is_invalid_queue(right.system_queue.as_deref(), right.match_reasons.as_slice());

    (left_invalid_system || right_invalid_system)
        && (left.is_usb_device || right.is_usb_device)
        && manufacturer_matches(left.manufacturer.as_deref(), right.manufacturer.as_deref())
        && (left.receipt_capable || left.kind == PrinterKind::Thermal)
        && (right.receipt_capable || right.kind == PrinterKind::Thermal)
}

fn richness_of_string(value: &str) -> usize {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .count()
}

fn richness_score(printer: &ResolvedPrinter) -> usize {
    usize::from(printer.vendor_id.is_some())
        + usize::from(printer.product_id.is_some())
        + usize::from(printer.serial_number.is_some())
        + usize::from(printer.manufacturer.is_some())
        + usize::from(printer.model.is_some())
        + usize::from(printer.system_queue.is_some())
        + usize::from(printer.is_usb_device)
        + usize::from(printer.is_system_printer)
}

fn profile_richness_score(profile: &PrinterProfile) -> usize {
    usize::from(profile.raw_support)
        + usize::from(profile.supports_cut)
        + usize::from(profile.supports_cash_drawer)
        + usize::from(profile.supports_qr)
        + usize::from(profile.supports_barcode)
        + usize::from(profile.raw_device_path.is_some())
}

fn printer_preference_score(printer: &ResolvedPrinter) -> usize {
    richness_score(printer)
        + usize::from(printer.status == ResolvedPrinterStatus::Online) * 3
        + usize::from(printer.receipt_capable) * 2
        + usize::from(printer.capabilities.raw_support) * 2
}

fn status_rank(status: ResolvedPrinterStatus) -> usize {
    match status {
        ResolvedPrinterStatus::Online => 3,
        ResolvedPrinterStatus::Unknown => 2,
        ResolvedPrinterStatus::Offline => 1,
    }
}

fn is_invalid_queue(queue: Option<&str>, reasons: &[MatchCandidate]) -> bool {
    if queue.is_none() {
        return true;
    }

    reasons.iter().any(|reason| reason.reason.contains("/dev/null"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_printer(id: &str, name: &str) -> ResolvedPrinter {
        let capabilities = PrinterCapabilities::receipt();
        ResolvedPrinter {
            id: id.into(),
            name: name.into(),
            system_name: None,
            model: None,
            manufacturer: Some("RONGTA".into()),
            vendor_id: None,
            product_id: None,
            serial_number: None,
            connection_type: ConnectionType::Unknown,
            system_backend: None,
            system_queue: None,
            is_system_printer: false,
            is_usb_device: false,
            is_default: false,
            kind: PrinterKind::Unknown,
            receipt_capable: true,
            paper_width_mm: PaperWidthMm::Mm80,
            status: ResolvedPrinterStatus::Online,
            driver: "preview".into(),
            last_seen_at: "unix:1".into(),
            capabilities: capabilities.clone(),
            profile: PrinterProfile::from_capabilities(PaperWidthMm::Mm80, &capabilities),
            manual_override: PrinterOverride::default(),
            match_reasons: Vec::new(),
        }
    }

    #[test]
    fn dedupe_prefers_richer_usb_metadata() {
        let mut system = make_printer("system_usb_80series2", "USB_80Series2");
        system.is_system_printer = true;
        system.system_queue = Some("USB_80Series2".into());
        system.match_reasons.push(MatchCandidate {
            source: DiscoveryBackend::Cups,
            confidence: 70,
            reason: "device uri: ///dev/null".into(),
        });

        let mut usb = make_printer("usb_receipt", "USB Receipt Printer");
        usb.is_usb_device = true;
        usb.connection_type = ConnectionType::Usb;
        usb.kind = PrinterKind::Thermal;
        usb.vendor_id = Some("0fe6".into());
        usb.product_id = Some("811e".into());
        usb.serial_number = Some("ABC123".into());
        usb.driver = "escpos_usb".into();

        let deduped = dedupe_resolved_printers(vec![system, usb]);
        assert_eq!(deduped.len(), 1);
        assert_eq!(deduped[0].vendor_id.as_deref(), Some("0fe6"));
        assert_eq!(deduped[0].driver, "escpos_usb");
    }
}
