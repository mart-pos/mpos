use std::process::Command;

use rusb::{Context, UsbContext};
use serde_json::Value;

use crate::{
    discovery::common::{DiscoveryBackend, MatchCandidate},
    domain::printer::{
        ConnectionType, PaperWidthMm, PrinterCapabilities, PrinterKind, PrinterOverride,
        PrinterProfile, ResolvedPrinter, ResolvedPrinterStatus,
    },
};

#[derive(Clone)]
struct UsbPrinterCandidate {
    name: String,
    manufacturer: Option<String>,
    model: Option<String>,
    vendor_id: Option<String>,
    product_id: Option<String>,
    serial_number: Option<String>,
}

#[derive(Clone)]
struct SystemPrinterCandidate {
    name: String,
    queue: String,
    device_uri: Option<String>,
    is_default: bool,
    status: ResolvedPrinterStatus,
    accepting_jobs: bool,
}

pub fn discover_printers() -> Vec<ResolvedPrinter> {
    let usb_devices = discover_usb_devices();
    let system_printers = discover_system_printers();

    let mut printers: Vec<ResolvedPrinter> = system_printers
        .iter()
        .filter(|system_printer| !should_skip_system_queue(system_printer, &usb_devices))
        .map(|system_printer| {
            let usb_match = usb_devices
                .iter()
                .find(|device| is_probable_match(system_printer, device));

            let base_name = system_printer.name.clone();
            let manufacturer = usb_match
                .and_then(|device| device.manufacturer.clone())
                .or_else(|| infer_manufacturer(&base_name));
            let model = usb_match
                .and_then(|device| device.model.clone())
                .or_else(|| infer_model(&base_name));
            let printer_kind = classify_printer(
                &base_name,
                manufacturer.as_deref(),
                system_printer.device_uri.as_deref(),
            );
            let receipt_capable = is_receipt_capable(&base_name, printer_kind);
            let paper_width = infer_paper_width(&base_name, printer_kind);
            let driver = if receipt_capable {
                "escpos_system"
            } else {
                "system_print"
            };

            ResolvedPrinter {
                id: format!("system_{}", slug(&system_printer.queue)),
                name: base_name.clone(),
                system_name: Some(system_printer.name.clone()),
                model,
                manufacturer,
                vendor_id: usb_match.and_then(|device| device.vendor_id.clone()),
                product_id: usb_match.and_then(|device| device.product_id.clone()),
                serial_number: usb_match.and_then(|device| device.serial_number.clone()),
                connection_type: usb_match
                    .map(|_| ConnectionType::Usb)
                    .unwrap_or(ConnectionType::System),
                system_backend: Some("cups".into()),
                system_queue: Some(system_printer.queue.clone()),
                is_system_printer: true,
                is_usb_device: usb_match.is_some(),
                is_default: system_printer.is_default,
                kind: printer_kind,
                receipt_capable,
                paper_width_mm: paper_width,
                status: system_printer.status.clone(),
                driver: driver.into(),
                last_seen_at: iso_timestamp_now(),
                capabilities: capabilities_for_printer(printer_kind, receipt_capable),
                profile: PrinterProfile::from_capabilities(
                    paper_width,
                    &capabilities_for_printer(printer_kind, receipt_capable),
                ),
                manual_override: PrinterOverride::default(),
                match_reasons: build_match_reasons(
                    usb_match.is_some(),
                    system_printer.device_uri.as_deref(),
                    system_printer.accepting_jobs,
                ),
            }
        })
        .collect();

    for usb_device in usb_devices {
        let already_reconciled = printers.iter().any(|printer| {
            printer.serial_number == usb_device.serial_number
                || printer
                    .name
                    .to_lowercase()
                    .contains(&usb_device.name.to_lowercase())
                || usb_device
                    .name
                    .to_lowercase()
                    .contains(&printer.name.to_lowercase())
        });

        if already_reconciled || !looks_like_printer(&usb_device.name, usb_device.manufacturer.as_deref()) {
            continue;
        }

        let printer_kind = classify_printer(
            &usb_device.name,
            usb_device.manufacturer.as_deref(),
            None,
        );

        printers.push(ResolvedPrinter {
            id: format!("usb_{}", slug(&usb_device.name)),
            name: usb_device.name.clone(),
            system_name: None,
            model: usb_device.model.clone(),
            manufacturer: usb_device.manufacturer.clone(),
            vendor_id: usb_device.vendor_id.clone(),
            product_id: usb_device.product_id.clone(),
            serial_number: usb_device.serial_number.clone(),
            connection_type: ConnectionType::Usb,
            system_backend: None,
            system_queue: None,
            is_system_printer: false,
            is_usb_device: true,
            is_default: false,
            kind: printer_kind,
            receipt_capable: is_receipt_capable(&usb_device.name, printer_kind),
            paper_width_mm: infer_paper_width(&usb_device.name, printer_kind),
            status: ResolvedPrinterStatus::Online,
            driver: "escpos_usb".into(),
            last_seen_at: iso_timestamp_now(),
            capabilities: capabilities_for_printer(
                printer_kind,
                is_receipt_capable(&usb_device.name, printer_kind),
            ),
            profile: PrinterProfile::from_capabilities(
                infer_paper_width(&usb_device.name, printer_kind),
                &capabilities_for_printer(
                    printer_kind,
                    is_receipt_capable(&usb_device.name, printer_kind),
                ),
            ),
            manual_override: PrinterOverride::default(),
            match_reasons: vec![MatchCandidate {
                source: DiscoveryBackend::Usb,
                confidence: 76,
                reason: "usb device detected without system queue".into(),
            }],
        });
    }

    printers
}

fn should_skip_system_queue(
    system_printer: &SystemPrinterCandidate,
    usb_devices: &[UsbPrinterCandidate],
) -> bool {
    let invalid_queue = !system_printer.accepting_jobs
        || system_printer
            .device_uri
            .as_deref()
            .map(|uri| uri.contains("/dev/null"))
            .unwrap_or(false);

    if !invalid_queue {
        return false;
    }

    usb_devices.iter().any(|device| {
        let usb_name = normalize(&device.name);
        let queue_name = normalize(&system_printer.name);

        usb_name.contains("receipt printer")
            || queue_name.contains("80series")
            || queue_name.contains("receipt")
            || same_optional(&device.vendor_id, &Some("0fe6".into()))
            || same_optional(&device.manufacturer, &Some("RONGTA".into()))
    })
}

fn discover_system_printers() -> Vec<SystemPrinterCandidate> {
    let printer_output = run_command("/usr/bin/lpstat", &["-p"]);
    let device_output = run_command("/usr/bin/lpstat", &["-v"]);
    let accepting_output = run_command("/usr/bin/lpstat", &["-a"]);
    let default_output = run_command("/usr/bin/lpstat", &["-d"]);
    let default_queue = parse_default_queue(&default_output);

    parse_lpstat_printers(&printer_output)
        .into_iter()
        .map(|(name, status)| {
            let accepting_jobs = printer_accepts_jobs(&accepting_output, &name);
            let device_uri = parse_device_uri_for_printer(&device_output, &name);
            let valid_device_uri = device_uri
                .as_deref()
                .map(|uri| !uri.contains("/dev/null"))
                .unwrap_or(true);

            SystemPrinterCandidate {
                device_uri,
                is_default: default_queue.as_deref() == Some(name.as_str()),
                queue: name.clone(),
                name,
                status: if accepting_jobs && valid_device_uri {
                    status
                } else {
                    ResolvedPrinterStatus::Offline
                },
                accepting_jobs: accepting_jobs && valid_device_uri,
            }
        })
        .collect()
}

fn discover_usb_devices() -> Vec<UsbPrinterCandidate> {
    let output = run_command("/usr/sbin/system_profiler", &["SPUSBDataType", "-json"]);
    let mut devices = Vec::new();

    if let Ok(json) = serde_json::from_str::<Value>(&output) {
        if let Some(items) = json.get("SPUSBDataType").and_then(Value::as_array) {
            for item in items {
                walk_usb_tree(item, &mut devices);
            }
        }
    }

    let ioreg_output = run_command("/usr/sbin/ioreg", &["-p", "IOUSB", "-l", "-w", "0"]);
    devices.extend(parse_ioreg_usb_devices(&ioreg_output));
    devices.extend(discover_usb_devices_with_rusb());

    dedupe_usb_devices(devices)
}

fn walk_usb_tree(value: &Value, devices: &mut Vec<UsbPrinterCandidate>) {
    if let Some(name) = value.get("_name").and_then(Value::as_str) {
        let manufacturer = string_field(value, "manufacturer");
        if looks_like_printer(name, manufacturer.as_deref()) {
            devices.push(UsbPrinterCandidate {
                name: name.into(),
                manufacturer,
                model: infer_model(name),
                vendor_id: hex_field(value, "vendor_id"),
                product_id: hex_field(value, "product_id"),
                serial_number: string_field(value, "serial_num"),
            });
        }
    }

    if let Some(children) = value.get("_items").and_then(Value::as_array) {
        for child in children {
            walk_usb_tree(child, devices);
        }
    }
}

fn parse_ioreg_usb_devices(output: &str) -> Vec<UsbPrinterCandidate> {
    let mut devices = Vec::new();
    let mut current_block = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        let starts_block = trimmed.contains("+-o ");

        if starts_block && !current_block.is_empty() {
            if let Some(device) = parse_ioreg_block(&current_block) {
                devices.push(device);
            }
            current_block.clear();
        }

        if starts_block || !current_block.is_empty() {
            current_block.push(trimmed.to_string());
        }
    }

    if !current_block.is_empty() {
        if let Some(device) = parse_ioreg_block(&current_block) {
            devices.push(device);
        }
    }

    devices
}

fn parse_ioreg_block(lines: &[String]) -> Option<UsbPrinterCandidate> {
    let header = lines.first()?.trim();
    if !header.contains("IOUSBHostDevice") {
        return None;
    }

    let name = extract_name_from_ioreg_header(header)
        .or_else(|| extract_ioreg_field(lines, "\"USB Product Name\" = \""))
        .or_else(|| extract_ioreg_field(lines, "\"kUSBProductString\" = \""))?;
    let manufacturer = extract_ioreg_field(lines, "\"USB Vendor Name\" = \"")
        .or_else(|| extract_ioreg_field(lines, "\"kUSBVendorString\" = \""));

    if !looks_like_printer(&name, manufacturer.as_deref()) {
        return None;
    }

    Some(UsbPrinterCandidate {
        name: name.clone(),
        manufacturer,
        model: infer_model(&name),
        vendor_id: extract_ioreg_number(lines, "\"idVendor\" = ").map(|value| format!("{value:04x}")),
        product_id: extract_ioreg_number(lines, "\"idProduct\" = ").map(|value| format!("{value:04x}")),
        serial_number: extract_ioreg_field(lines, "\"USB Serial Number\" = \"")
            .or_else(|| extract_ioreg_field(lines, "\"kUSBSerialNumberString\" = \"")),
    })
}

fn extract_name_from_ioreg_header(header: &str) -> Option<String> {
    let start = header.find("+-o ")? + 4;
    let rest = &header[start..];
    let end = rest.find('@').or_else(|| rest.find("  <"))?;
    Some(rest[..end].trim().to_string())
}

fn extract_ioreg_field(lines: &[String], prefix: &str) -> Option<String> {
    lines
        .iter()
        .find_map(|line| line.trim().strip_prefix(prefix))
        .and_then(|value| value.split('"').next())
        .map(|value| value.trim().to_string())
}

fn extract_ioreg_number(lines: &[String], prefix: &str) -> Option<u16> {
    lines
        .iter()
        .find_map(|line| line.trim().strip_prefix(prefix))
        .and_then(|value| value.split_whitespace().next())
        .and_then(|value| value.parse::<u16>().ok())
}

fn discover_usb_devices_with_rusb() -> Vec<UsbPrinterCandidate> {
    let Ok(context) = Context::new() else {
        return Vec::new();
    };
    let Ok(devices) = context.devices() else {
        return Vec::new();
    };

    let mut results = Vec::new();

    for device in devices.iter() {
        let Ok(descriptor) = device.device_descriptor() else {
            continue;
        };
        let Ok(handle) = device.open() else {
            continue;
        };

        let product = handle
            .read_product_string_ascii(&descriptor)
            .ok()
            .or_else(|| Some(format!("USB_{:04x}_{:04x}", descriptor.vendor_id(), descriptor.product_id())));
        let manufacturer = handle.read_manufacturer_string_ascii(&descriptor).ok();

        let Some(name) = product else {
            continue;
        };

        if !looks_like_printer(&name, manufacturer.as_deref()) {
            continue;
        }

        results.push(UsbPrinterCandidate {
            name: name.clone(),
            manufacturer,
            model: infer_model(&name),
            vendor_id: Some(format!("{:04x}", descriptor.vendor_id())),
            product_id: Some(format!("{:04x}", descriptor.product_id())),
            serial_number: handle.read_serial_number_string_ascii(&descriptor).ok(),
        });
    }

    results
}

fn dedupe_usb_devices(devices: Vec<UsbPrinterCandidate>) -> Vec<UsbPrinterCandidate> {
    let mut deduped: Vec<UsbPrinterCandidate> = Vec::new();

    for candidate in devices {
        if let Some(index) = deduped.iter().position(|existing| {
            is_same_usb_candidate(existing, &candidate)
        }) {
            deduped[index] = merge_usb_candidates(deduped[index].clone(), candidate);
        } else {
            deduped.push(candidate);
        }
    }

    deduped
}

fn is_same_usb_candidate(left: &UsbPrinterCandidate, right: &UsbPrinterCandidate) -> bool {
    same_optional(&left.serial_number, &right.serial_number)
        || (same_optional(&left.vendor_id, &right.vendor_id)
            && same_optional(&left.product_id, &right.product_id))
        || normalize(&left.name) == normalize(&right.name)
}

fn merge_usb_candidates(primary: UsbPrinterCandidate, secondary: UsbPrinterCandidate) -> UsbPrinterCandidate {
    UsbPrinterCandidate {
        name: choose_better_string(Some(primary.name), Some(secondary.name)).unwrap_or_default(),
        manufacturer: choose_better_string(primary.manufacturer, secondary.manufacturer),
        model: choose_better_string(primary.model, secondary.model),
        vendor_id: choose_better_string(primary.vendor_id, secondary.vendor_id),
        product_id: choose_better_string(primary.product_id, secondary.product_id),
        serial_number: choose_better_string(primary.serial_number, secondary.serial_number),
    }
}

fn choose_better_string(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(a), Some(b)) => {
            if a.len() >= b.len() {
                Some(a)
            } else {
                Some(b)
            }
        }
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
}

fn same_optional(left: &Option<String>, right: &Option<String>) -> bool {
    match (left.as_deref(), right.as_deref()) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

fn parse_lpstat_printers(output: &str) -> Vec<(String, ResolvedPrinterStatus)> {
    output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if !line.starts_with("printer ") {
                return None;
            }

            let rest = line.strip_prefix("printer ")?;
            let name = rest.split_whitespace().next()?.to_string();
            let status = if line.contains(" disabled ") {
                ResolvedPrinterStatus::Offline
            } else {
                ResolvedPrinterStatus::Online
            };

            Some((name, status))
        })
        .collect()
}

fn parse_default_queue(output: &str) -> Option<String> {
    output
        .lines()
        .find_map(|line| line.strip_prefix("system default destination: "))
        .map(|value| value.trim().to_string())
}

fn parse_device_uri_for_printer(output: &str, queue: &str) -> Option<String> {
    let prefix = format!("device for {queue}:");
    output
        .lines()
        .find_map(|line| line.strip_prefix(&prefix))
        .map(|value| value.trim().to_string())
}

fn printer_accepts_jobs(output: &str, queue: &str) -> bool {
    output
        .lines()
        .map(str::trim)
        .any(|line| line.starts_with(queue) && line.contains("accepting requests"))
}

fn build_match_reasons(
    has_usb_match: bool,
    device_uri: Option<&str>,
    accepting_jobs: bool,
) -> Vec<MatchCandidate> {
    let mut reasons = vec![MatchCandidate {
        source: DiscoveryBackend::Cups,
        confidence: 88,
        reason: "system print queue discovered via lpstat".into(),
    }];

    reasons.push(MatchCandidate {
        source: DiscoveryBackend::Cups,
        confidence: 93,
        reason: if accepting_jobs {
            "queue is accepting jobs".into()
        } else {
            "queue is not accepting jobs".into()
        },
    });

    if has_usb_match {
        reasons.push(MatchCandidate {
            source: DiscoveryBackend::Usb,
            confidence: 83,
            reason: "matched by manufacturer/model/name similarity".into(),
        });
    }

    if let Some(uri) = device_uri {
        reasons.push(MatchCandidate {
            source: DiscoveryBackend::Cups,
            confidence: 72,
            reason: format!("device uri: {uri}"),
        });
    }

    reasons
}

fn classify_printer(name: &str, manufacturer: Option<&str>, uri: Option<&str>) -> PrinterKind {
    let haystack = normalize(&format!(
        "{} {} {}",
        name,
        manufacturer.unwrap_or_default(),
        uri.unwrap_or_default()
    ));

    if haystack.contains("label") || haystack.contains("brother ql") || haystack.contains("zebra") {
        PrinterKind::Label
    } else if haystack.contains("tm-")
        || haystack.contains("thermal")
        || haystack.contains("receipt")
        || haystack.contains("pos")
        || haystack.contains("xprinter")
        || haystack.contains("star")
        || haystack.contains("bixolon")
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

fn is_receipt_capable(name: &str, printer_kind: PrinterKind) -> bool {
    printer_kind == PrinterKind::Thermal
        || normalize(name).contains("receipt")
        || normalize(name).contains("pos")
        || normalize(name).contains("tm-")
}

fn infer_paper_width(name: &str, printer_kind: PrinterKind) -> PaperWidthMm {
    let normalized = normalize(name);

    if normalized.contains("58") {
        PaperWidthMm::Mm58
    } else if normalized.contains("80") || printer_kind == PrinterKind::Thermal {
        PaperWidthMm::Mm80
    } else {
        PaperWidthMm::Unknown
    }
}

fn capabilities_for_printer(kind: PrinterKind, receipt_capable: bool) -> PrinterCapabilities {
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

fn is_probable_match(system_printer: &SystemPrinterCandidate, usb_device: &UsbPrinterCandidate) -> bool {
    let system_name = normalize(&system_printer.name);
    let usb_name = normalize(&usb_device.name);

    system_name.contains(&usb_name)
        || usb_name.contains(&system_name)
        || usb_device
            .manufacturer
            .as_ref()
            .map(|manufacturer| system_name.contains(&normalize(manufacturer)))
            .unwrap_or(false)
}

fn looks_like_printer(name: &str, manufacturer: Option<&str>) -> bool {
    let haystack = normalize(&format!("{name} {}", manufacturer.unwrap_or_default()));
    haystack.contains("printer")
        || haystack.contains("epson")
        || haystack.contains("star")
        || haystack.contains("bixolon")
        || haystack.contains("zebra")
        || haystack.contains("brother")
        || haystack.contains("xprinter")
        || haystack.contains("pos")
        || haystack.contains("tm-")
}

fn infer_manufacturer(name: &str) -> Option<String> {
    let normalized = normalize(name);

    for brand in ["epson", "brother", "zebra", "star", "bixolon", "xprinter"] {
        if normalized.contains(brand) {
            return Some(brand.to_uppercase());
        }
    }

    None
}

fn infer_model(name: &str) -> Option<String> {
    name.split_whitespace()
        .find(|token| token.chars().any(|character| character.is_ascii_digit()))
        .map(ToString::to_string)
}

fn normalize(value: &str) -> String {
    value.to_lowercase().replace(['_', '-', '/'], " ")
}

fn slug(value: &str) -> String {
    normalize(value)
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() { character } else { '_' })
        .collect()
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(|entry| entry.trim().to_string())
}

fn hex_field(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).and_then(|entry| {
        entry
            .split_whitespace()
            .next()
            .map(|segment| segment.trim_start_matches("0x").to_lowercase())
    })
}

fn run_command(binary: &str, args: &[&str]) -> String {
    match Command::new(binary).args(args).output() {
        Ok(output) => {
            let mut content = String::from_utf8_lossy(&output.stdout).to_string();
            if !output.stderr.is_empty() {
                content.push('\n');
                content.push_str(&String::from_utf8_lossy(&output.stderr));
            }
            content
        }
        Err(_) => String::new(),
    }
}

fn iso_timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    format!("unix:{seconds}")
}
