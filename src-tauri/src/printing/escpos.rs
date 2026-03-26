use std::{fs, io::Write, process::Command, time::Duration};

use rusb::{Context, Direction, TransferType, UsbContext};

use crate::{
    domain::{printer::ResolvedPrinter, receipt::ReceiptDocument},
    printing::{
        common::DriverKind,
        formatter::render_receipt_escpos,
        service::{write_temp_bytes, PrintResult},
    },
};

pub fn supported_drivers() -> Vec<DriverKind> {
    vec![DriverKind::EscPosUsb, DriverKind::EscPosSystem]
}

pub fn print_via_system_queue(
    printer: &ResolvedPrinter,
    document: &ReceiptDocument,
) -> Result<PrintResult, String> {
    let queue = printer
        .system_queue
        .clone()
        .or_else(|| printer.system_name.clone())
        .ok_or_else(|| "selected printer has no system queue".to_string())?;

    if cfg!(target_os = "windows") {
        return Err("escpos system printing is not implemented on windows yet".into());
    }

    let payload = render_receipt_escpos(document, &printer.profile);
    let file_path = write_temp_bytes(&printer.id, "bin", &payload)?;
    let output = Command::new("/usr/bin/lp")
        .args(["-d", &queue, "-o", "raw", file_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|error| format!("failed to execute lp raw: {error}"))?;
    let _ = fs::remove_file(&file_path);

    if output.status.success() {
        Ok(PrintResult {
            printer_id: printer.id.clone(),
            driver: "esc_pos_system".into(),
            submitted: true,
            detail: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            preview_path: None,
        })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

pub fn print_via_usb_device(
    printer: &ResolvedPrinter,
    document: &ReceiptDocument,
) -> Result<PrintResult, String> {
    let payload = render_receipt_escpos(document, &printer.profile);
    send_usb_payload(printer, &payload)
}

pub fn send_raw_bytes(printer: &ResolvedPrinter, payload: &[u8]) -> Result<PrintResult, String> {
    send_usb_payload(printer, payload)
}

fn write_raw_bytes(device_path: &str, payload: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .open(device_path)
        .map_err(|error| format!("failed to open raw device path {device_path}: {error}"))?;
    file.write_all(payload)
        .map_err(|error| format!("failed to write raw bytes to {device_path}: {error}"))
}

fn send_usb_payload(printer: &ResolvedPrinter, payload: &[u8]) -> Result<PrintResult, String> {
    if let Some(device_path) = &printer.profile.raw_device_path {
        write_raw_bytes(device_path, payload)?;

        return Ok(PrintResult {
            printer_id: printer.id.clone(),
            driver: "esc_pos_usb".into(),
            submitted: true,
            detail: format!("raw bytes written to {device_path}"),
            preview_path: None,
        });
    }

    let vendor_id = parse_hex_id(printer.vendor_id.as_deref())
        .ok_or_else(|| "missing vendor_id for usb printing".to_string())?;
    let product_id = parse_hex_id(printer.product_id.as_deref())
        .ok_or_else(|| "missing product_id for usb printing".to_string())?;
    let serial_number = printer.serial_number.as_deref();

    let context = Context::new().map_err(|error| format!("failed to create usb context: {error}"))?;
    let devices = context
        .devices()
        .map_err(|error| format!("failed to enumerate usb devices: {error}"))?;

    for device in devices.iter() {
        let Ok(descriptor) = device.device_descriptor() else {
            continue;
        };

        if descriptor.vendor_id() != vendor_id || descriptor.product_id() != product_id {
            continue;
        }

        let Ok(handle) = device.open() else {
            continue;
        };

        if let Some(expected_serial) = serial_number {
            let serial_ok = handle
                .read_serial_number_string_ascii(&descriptor)
                .map(|actual| actual == expected_serial)
                .unwrap_or(false);

            if !serial_ok {
                continue;
            }
        }

        if let Some((interface_number, endpoint_address)) =
            find_bulk_out_endpoint(&device, &descriptor)
        {
            #[allow(unused_must_use)]
            {
                handle.set_auto_detach_kernel_driver(true);
            }

            handle
                .claim_interface(interface_number)
                .map_err(|error| format!("failed to claim usb interface {interface_number}: {error}"))?;

            let result = handle.write_bulk(endpoint_address, payload, Duration::from_secs(3));
            let _ = handle.release_interface(interface_number);

            return result
                .map(|written| PrintResult {
                    printer_id: printer.id.clone(),
                    driver: "esc_pos_usb".into(),
                    submitted: true,
                    detail: format!("sent {written} bytes via usb bulk endpoint"),
                    preview_path: None,
                })
                .map_err(|error| format!("failed to send usb bulk payload: {error}"));
        }
    }

    Err("no matching usb bulk endpoint found for printer".into())
}

fn parse_hex_id(value: Option<&str>) -> Option<u16> {
    value.and_then(|entry| u16::from_str_radix(entry.trim_start_matches("0x"), 16).ok())
}

fn find_bulk_out_endpoint<T: UsbContext>(
    device: &rusb::Device<T>,
    descriptor: &rusb::DeviceDescriptor,
) -> Option<(u8, u8)> {
    for config_index in 0..descriptor.num_configurations() {
        let Ok(config_descriptor) = device.config_descriptor(config_index) else {
            continue;
        };

        for interface in config_descriptor.interfaces() {
            for interface_descriptor in interface.descriptors() {
                for endpoint in interface_descriptor.endpoint_descriptors() {
                    if endpoint.transfer_type() == TransferType::Bulk
                        && endpoint.direction() == Direction::Out
                    {
                        return Some((interface_descriptor.interface_number(), endpoint.address()));
                    }
                }
            }
        }
    }

    None
}
