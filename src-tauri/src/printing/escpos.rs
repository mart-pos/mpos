use std::{fs, io::Write, path::Path, process::Command, time::Duration};

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

    let payload = render_receipt_escpos(document, &printer.profile);
    let file_path = write_temp_bytes(&printer.id, "bin", &payload)?;
    let result = if cfg!(target_os = "windows") {
        submit_raw_file_to_windows_queue(&queue, &file_path)
    } else {
        submit_raw_file_to_unix_queue(&queue, &file_path)
    };
    let _ = fs::remove_file(&file_path);

    if let Ok(detail) = result {
        Ok(PrintResult {
            printer_id: printer.id.clone(),
            driver: "esc_pos_system".into(),
            submitted: true,
            detail,
            preview_path: None,
        })
    } else {
        Err(result.err().unwrap_or_else(|| "failed to submit raw print job".into()))
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
    if cfg!(target_os = "windows") {
        if let Some(queue) = printer
            .system_queue
            .clone()
            .or_else(|| printer.system_name.clone())
        {
            let file_path = write_temp_bytes(&printer.id, "bin", payload)?;
            let result = submit_raw_file_to_windows_queue(&queue, &file_path);
            let _ = fs::remove_file(&file_path);

            return result.map(|detail| PrintResult {
                printer_id: printer.id.clone(),
                driver: "esc_pos_system".into(),
                submitted: true,
                detail,
                preview_path: None,
            });
        }
    }

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

fn submit_raw_file_to_unix_queue(queue: &str, file_path: &Path) -> Result<String, String> {
    let output = Command::new("/usr/bin/lp")
        .args(["-d", queue, "-o", "raw", file_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|error| format!("failed to execute lp raw: {error}"))?;

    if output.status.success() {
        Ok(read_command_detail(
            &output.stdout,
            &format!("submitted raw job to {queue}"),
        ))
    } else {
        Err(read_command_detail(&output.stderr, "lp raw failed"))
    }
}

fn submit_raw_file_to_windows_queue(queue: &str, file_path: &Path) -> Result<String, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            windows_raw_print_script(),
        ])
        .env("MPOS_PRINTER_QUEUE", queue)
        .env("MPOS_PRINT_FILE", file_path)
        .output()
        .map_err(|error| format!("failed to execute PowerShell raw print job: {error}"))?;

    if output.status.success() {
        Ok(read_command_detail(
            &output.stdout,
            &format!("submitted raw job to {queue}"),
        ))
    } else {
        Err(read_command_detail(
            &output.stderr,
            "PowerShell raw print job failed",
        ))
    }
}

fn windows_raw_print_script() -> &'static str {
    r#"$ErrorActionPreference = 'Stop'
$queue = $env:MPOS_PRINTER_QUEUE
$file = $env:MPOS_PRINT_FILE

if ([string]::IsNullOrWhiteSpace($queue)) { throw 'missing printer queue' }
if ([string]::IsNullOrWhiteSpace($file) -or -not (Test-Path -LiteralPath $file)) { throw 'missing print file' }

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO docInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static void SendBytes(string printerName, byte[] bytes, string documentName)
    {
        IntPtr handle;
        if (!OpenPrinter(printerName, out handle, IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error());

        try
        {
            var docInfo = new DOCINFO
            {
                pDocName = documentName,
                pDataType = "RAW"
            };

            if (!StartDocPrinter(handle, 1, docInfo))
                throw new Win32Exception(Marshal.GetLastWin32Error());

            try
            {
                if (!StartPagePrinter(handle))
                    throw new Win32Exception(Marshal.GetLastWin32Error());

                try
                {
                    int written;
                    if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length)
                        throw new Win32Exception(Marshal.GetLastWin32Error());
                }
                finally
                {
                    EndPagePrinter(handle);
                }
            }
            finally
            {
                EndDocPrinter(handle);
            }
        }
        finally
        {
            ClosePrinter(handle);
        }
    }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($file)
[RawPrinterHelper]::SendBytes($queue, $bytes, 'MPOS Core raw receipt')
Write-Output ("sent {0} bytes to {1}" -f $bytes.Length, $queue)"#
}

fn read_command_detail(output: &[u8], fallback: &str) -> String {
    let detail = String::from_utf8_lossy(output).trim().to_string();
    if detail.is_empty() {
        fallback.into()
    } else {
        detail
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_raw_script_uses_winspool_and_env_vars() {
        let script = windows_raw_print_script();

        assert!(script.contains("OpenPrinterW"));
        assert!(script.contains("WritePrinter"));
        assert!(script.contains("MPOS_PRINTER_QUEUE"));
        assert!(script.contains("MPOS_PRINT_FILE"));
        assert!(script.contains("RAW"));
    }
}
