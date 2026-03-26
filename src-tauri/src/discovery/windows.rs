#![allow(dead_code)]

use std::process::Command;

use serde_json::Value;

use crate::{
    discovery::common::{
        capabilities_for_printer, classify_printer, infer_manufacturer, infer_model,
        infer_paper_width, is_receipt_capable, iso_timestamp_now, looks_like_printer, normalize,
        slug, DiscoveryBackend, MatchCandidate,
    },
    domain::printer::{
        ConnectionType, PrinterOverride, PrinterProfile, ResolvedPrinter, ResolvedPrinterStatus,
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
    hardware_id: Option<String>,
}

#[derive(Clone)]
struct SystemPrinterCandidate {
    name: String,
    queue: String,
    driver_name: Option<String>,
    port_name: Option<String>,
    is_default: bool,
    status: ResolvedPrinterStatus,
    accepting_jobs: bool,
}

pub fn discover_printers() -> Vec<ResolvedPrinter> {
    let usb_devices = discover_usb_devices();
    let system_printers = discover_system_printers();

    let mut printers: Vec<ResolvedPrinter> = system_printers
        .iter()
        .map(|system_printer| {
            let usb_match = usb_devices
                .iter()
                .filter_map(|device| {
                    let score = probable_match_score(system_printer, device);
                    (score >= 65).then_some((score, device))
                })
                .max_by_key(|(score, _)| *score)
                .map(|(_, device)| device);

            let base_name = system_printer.name.clone();
            let manufacturer = usb_match
                .and_then(|device| device.manufacturer.clone())
                .or_else(|| infer_manufacturer(&base_name));
            let model = usb_match
                .and_then(|device| device.model.clone())
                .or_else(|| infer_model(&base_name));
            let hint = format!(
                "{} {}",
                system_printer.driver_name.clone().unwrap_or_default(),
                system_printer.port_name.clone().unwrap_or_default()
            );
            let printer_kind = classify_printer(&base_name, manufacturer.as_deref(), Some(&hint));
            let receipt_capable = is_receipt_capable(&base_name, printer_kind);
            let paper_width = infer_paper_width(&base_name, printer_kind);
            let capabilities = capabilities_for_printer(printer_kind, receipt_capable);
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
                system_backend: Some("windows_spooler".into()),
                system_queue: Some(system_printer.queue.clone()),
                is_system_printer: true,
                is_usb_device: usb_match.is_some(),
                is_default: system_printer.is_default,
                kind: printer_kind,
                receipt_capable,
                paper_width_mm: paper_width,
                status: system_printer.status,
                driver: driver.into(),
                last_seen_at: iso_timestamp_now(),
                capabilities: capabilities.clone(),
                profile: PrinterProfile::from_capabilities(paper_width, &capabilities),
                manual_override: PrinterOverride::default(),
                match_reasons: build_spooler_match_reasons(system_printer, usb_match),
            }
        })
        .collect();

    for usb_device in usb_devices {
        let already_reconciled = printers.iter().any(|printer| {
            same_optional(&printer.serial_number, &usb_device.serial_number)
                || (same_optional(&printer.vendor_id, &usb_device.vendor_id)
                    && same_optional(&printer.product_id, &usb_device.product_id)
                    && names_are_similar(&printer.name, &usb_device.name))
        });

        if already_reconciled || !looks_like_printer(&usb_device.name, usb_device.manufacturer.as_deref()) {
            continue;
        }

        let printer_kind = classify_printer(
            &usb_device.name,
            usb_device.manufacturer.as_deref(),
            usb_device.hardware_id.as_deref(),
        );
        let receipt_capable = is_receipt_capable(&usb_device.name, printer_kind);
        let paper_width = infer_paper_width(&usb_device.name, printer_kind);
        let capabilities = capabilities_for_printer(printer_kind, receipt_capable);

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
            receipt_capable,
            paper_width_mm: paper_width,
            status: ResolvedPrinterStatus::Online,
            driver: "escpos_usb".into(),
            last_seen_at: iso_timestamp_now(),
            capabilities: capabilities.clone(),
            profile: PrinterProfile::from_capabilities(paper_width, &capabilities),
            manual_override: PrinterOverride::default(),
            match_reasons: vec![MatchCandidate {
                source: DiscoveryBackend::Usb,
                confidence: 78,
                reason: "windows usb device discovered through Win32_PnPEntity".into(),
            }],
        });
    }

    printers
}

pub fn describe() -> Vec<MatchCandidate> {
    vec![
        MatchCandidate {
            source: DiscoveryBackend::Usb,
            confidence: 90,
            reason: "usb hardware id".into(),
        },
        MatchCandidate {
            source: DiscoveryBackend::Spooler,
            confidence: 84,
            reason: "windows spooler queue metadata".into(),
        },
    ]
}

fn discover_system_printers() -> Vec<SystemPrinterCandidate> {
    let output = run_powershell(
        "Get-CimInstance Win32_Printer | Select-Object Name,DriverName,PortName,Default,WorkOffline,PrinterStatus,DetectedErrorState | ConvertTo-Json -Depth 3",
    );
    let Some(entries) = parse_json_array(&output) else {
        return Vec::new();
    };

    entries
        .into_iter()
        .filter_map(|entry| {
            let name = json_string(&entry, "Name")?;
            let driver_name = json_string(&entry, "DriverName");
            if !looks_like_printer(&name, driver_name.as_deref()) {
                return None;
            }

            let work_offline = json_bool(&entry, "WorkOffline").unwrap_or(false);
            let printer_status = json_u64(&entry, "PrinterStatus").unwrap_or(3);
            let status = if work_offline {
                ResolvedPrinterStatus::Offline
            } else if matches!(printer_status, 3 | 4) {
                ResolvedPrinterStatus::Online
            } else if matches!(printer_status, 7 | 9) {
                ResolvedPrinterStatus::Offline
            } else {
                ResolvedPrinterStatus::Unknown
            };

            Some(SystemPrinterCandidate {
                queue: name.clone(),
                name,
                driver_name,
                port_name: json_string(&entry, "PortName"),
                is_default: json_bool(&entry, "Default").unwrap_or(false),
                status,
                accepting_jobs: !work_offline,
            })
        })
        .collect()
}

fn discover_usb_devices() -> Vec<UsbPrinterCandidate> {
    let output = run_powershell(
        "$items = Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -like 'USB\\\\*' -and ($_.Name -match 'printer|receipt|epson|star|bixolon|zebra|rongta|xprinter|pos') }; $items | Select-Object Name,Manufacturer,PNPDeviceID,DeviceID,Status | ConvertTo-Json -Depth 3",
    );
    let Some(entries) = parse_json_array(&output) else {
        return Vec::new();
    };

    entries
        .into_iter()
        .filter_map(|entry| {
            let name = json_string(&entry, "Name")?;
            let manufacturer = json_string(&entry, "Manufacturer");

            if !looks_like_printer(&name, manufacturer.as_deref()) {
                return None;
            }

            let hardware_id = json_string(&entry, "PNPDeviceID")
                .or_else(|| json_string(&entry, "DeviceID"));
            let (vendor_id, product_id, serial_number) =
                parse_hardware_id(hardware_id.as_deref());

            Some(UsbPrinterCandidate {
                name: name.clone(),
                manufacturer: manufacturer.or_else(|| infer_manufacturer(&name)),
                model: infer_model(&name),
                vendor_id,
                product_id,
                serial_number,
                hardware_id,
            })
        })
        .collect()
}

fn probable_match_score(
    system_printer: &SystemPrinterCandidate,
    usb_device: &UsbPrinterCandidate,
) -> u8 {
    let mut score = 0;
    let system_name = normalize(&system_printer.name);
    let queue_name = normalize(&system_printer.queue);
    let usb_name = normalize(&usb_device.name);

    if system_name == usb_name || queue_name == usb_name {
        score += 70;
    } else if system_name.contains(&usb_name)
        || usb_name.contains(&system_name)
        || queue_name.contains(&usb_name)
    {
        score += 45;
    }

    if let (Some(driver_name), Some(manufacturer)) =
        (system_printer.driver_name.as_deref(), usb_device.manufacturer.as_deref())
    {
        if normalize(driver_name).contains(&normalize(manufacturer)) {
            score += 20;
        }
    }

    if let (Some(port_name), Some(vendor_id)) =
        (system_printer.port_name.as_deref(), usb_device.vendor_id.as_deref())
    {
        if normalize(port_name).contains(&normalize(vendor_id)) {
            score += 15;
        }
    }

    score.min(99)
}

fn build_spooler_match_reasons(
    system_printer: &SystemPrinterCandidate,
    usb_match: Option<&UsbPrinterCandidate>,
) -> Vec<MatchCandidate> {
    let mut reasons = vec![
        MatchCandidate {
            source: DiscoveryBackend::Spooler,
            confidence: 88,
            reason: "windows spooler queue discovered via Win32_Printer".into(),
        },
        MatchCandidate {
            source: DiscoveryBackend::Spooler,
            confidence: 86,
            reason: if system_printer.accepting_jobs {
                "queue is available for jobs".into()
            } else {
                "queue appears offline or paused".into()
            },
        },
    ];

    if let Some(driver_name) = &system_printer.driver_name {
        reasons.push(MatchCandidate {
            source: DiscoveryBackend::Spooler,
            confidence: 74,
            reason: format!("driver: {driver_name}"),
        });
    }

    if let Some(port_name) = &system_printer.port_name {
        reasons.push(MatchCandidate {
            source: DiscoveryBackend::Spooler,
            confidence: 72,
            reason: format!("port: {port_name}"),
        });
    }

    if let Some(device) = usb_match {
        reasons.push(MatchCandidate {
            source: DiscoveryBackend::Usb,
            confidence: probable_match_score(system_printer, device),
            reason: "matched by queue, driver or USB hardware id".into(),
        });
    }

    reasons
}

fn parse_hardware_id(hardware_id: Option<&str>) -> (Option<String>, Option<String>, Option<String>) {
    let Some(hardware_id) = hardware_id else {
        return (None, None, None);
    };

    let upper = hardware_id.to_uppercase();
    let vendor_id = upper
        .split("VID_")
        .nth(1)
        .and_then(|tail| tail.get(..4))
        .map(|value| value.to_lowercase());
    let product_id = upper
        .split("PID_")
        .nth(1)
        .and_then(|tail| tail.get(..4))
        .map(|value| value.to_lowercase());
    let serial_number = hardware_id
        .rsplit('\\')
        .next()
        .filter(|value| !value.is_empty() && !value.contains('&'))
        .map(ToString::to_string);

    (vendor_id, product_id, serial_number)
}

fn parse_json_array(raw: &str) -> Option<Vec<Value>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    match serde_json::from_str::<Value>(trimmed).ok()? {
        Value::Array(items) => Some(items),
        Value::Object(_) => Some(vec![serde_json::from_str(trimmed).ok()?]),
        _ => None,
    }
}

fn json_string(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(ToString::to_string)
}

fn json_bool(value: &Value, key: &str) -> Option<bool> {
    value.get(key).and_then(Value::as_bool)
}

fn json_u64(value: &Value, key: &str) -> Option<u64> {
    value.get(key).and_then(Value::as_u64)
}

fn run_powershell(script: &str) -> String {
    match Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
    {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_windows_hardware_id() {
        let (vendor, product, serial) =
            parse_hardware_id(Some(r#"USB\VID_0FE6&PID_811E\GD2077C8291FF1435"#));
        assert_eq!(vendor.as_deref(), Some("0fe6"));
        assert_eq!(product.as_deref(), Some("811e"));
        assert_eq!(serial.as_deref(), Some("GD2077C8291FF1435"));
    }
}
