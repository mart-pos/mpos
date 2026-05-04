use std::{fs, path::Path, process::Command};

use crate::{
    domain::{printer::ResolvedPrinter, receipt::ReceiptDocument},
    printing::{
        common::DriverKind,
        formatter::render_receipt_text,
        service::{write_temp_bytes, PrintResult},
    },
};

pub fn supported_drivers() -> Vec<DriverKind> {
    vec![DriverKind::SystemPrint, DriverKind::Preview]
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

    let content = render_receipt_text(document, &printer.profile);
    let file_path = write_temp_bytes(&printer.id, "txt", content.as_bytes())?;
    let result = if cfg!(target_os = "windows") {
        submit_text_file_to_windows_queue(&queue, &file_path)
    } else {
        submit_text_file_to_unix_queue(&queue, &file_path)
    };
    let _ = fs::remove_file(&file_path);

    if let Ok(detail) = result {
        Ok(PrintResult {
            printer_id: printer.id.clone(),
            driver: "system_print".into(),
            submitted: true,
            detail,
            preview_path: None,
        })
    } else {
        Err(result.err().unwrap_or_else(|| "failed to submit print job".into()))
    }
}

fn submit_text_file_to_unix_queue(queue: &str, file_path: &Path) -> Result<String, String> {
    let output = Command::new("/usr/bin/lp")
        .args(["-d", queue, file_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|error| format!("failed to execute lp: {error}"))?;

    if output.status.success() {
        Ok(read_command_detail(&output.stdout, &format!("submitted text job to {queue}")))
    } else {
        Err(read_command_detail(&output.stderr, "lp failed"))
    }
}

fn submit_text_file_to_windows_queue(queue: &str, file_path: &Path) -> Result<String, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            windows_text_print_script(),
        ])
        .env("MPOS_PRINTER_QUEUE", queue)
        .env("MPOS_PRINT_FILE", file_path)
        .output()
        .map_err(|error| format!("failed to execute PowerShell print job: {error}"))?;

    if output.status.success() {
        Ok(read_command_detail(
            &output.stdout,
            &format!("submitted text job to {queue}"),
        ))
    } else {
        Err(read_command_detail(&output.stderr, "PowerShell print job failed"))
    }
}

fn windows_text_print_script() -> &'static str {
    r#"$ErrorActionPreference = 'Stop'
$queue = $env:MPOS_PRINTER_QUEUE
$file = $env:MPOS_PRINT_FILE

if ([string]::IsNullOrWhiteSpace($queue)) { throw 'missing printer queue' }
if ([string]::IsNullOrWhiteSpace($file) -or -not (Test-Path -LiteralPath $file)) { throw 'missing print file' }

Get-Content -LiteralPath $file -Raw | Out-Printer -Name $queue
Write-Output ("submitted text job to {0}" -f $queue)"#
}

fn read_command_detail(output: &[u8], fallback: &str) -> String {
    let detail = String::from_utf8_lossy(output).trim().to_string();
    if detail.is_empty() {
        fallback.into()
    } else {
        detail
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_text_script_uses_out_printer_and_env_vars() {
        let script = windows_text_print_script();

        assert!(script.contains("Out-Printer"));
        assert!(script.contains("MPOS_PRINTER_QUEUE"));
        assert!(script.contains("MPOS_PRINT_FILE"));
    }
}
